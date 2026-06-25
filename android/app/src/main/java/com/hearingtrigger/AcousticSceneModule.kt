package com.hearingtrigger

import android.Manifest
import android.content.pm.PackageManager
import android.util.Log
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import org.tensorflow.lite.support.label.Category
import org.tensorflow.lite.task.audio.classifier.AudioClassifier
import org.tensorflow.lite.task.audio.classifier.AudioClassifier.AudioClassifierOptions
import java.util.concurrent.*

/**
 * AcousticSceneModule.kt
 *
 * React Native native module — acoustic scene classification via YAMNet (TFLite).
 *
 * Periodically captures ~1 s of microphone audio, runs on-device YAMNet inference,
 * maps the top AudioSet labels to a human-friendly place type, and emits
 * "onSceneChanged" { place: string } events to JS every ~15 seconds.
 *
 * Model file: android/app/src/main/assets/yamnet.tflite
 * Download:   scripts/download_yamnet.sh
 */
class AcousticSceneModule(private val ctx: ReactApplicationContext)
    : ReactContextBaseJavaModule(ctx) {

    companion object {
        private const val TAG          = "AcousticScene"
        private const val MODEL_FILE   = "yamnet.tflite"
        private const val INTERVAL_S   = 15L   // classify every 15 seconds
        private const val BUFFER_MS    = 1100L // wait for YAMNet's 0.975 s ring-buffer to fill
    }

    override fun getName() = "AcousticSceneModule"

    private val executor: ScheduledExecutorService = Executors.newSingleThreadScheduledExecutor()
    private var scheduledTask: ScheduledFuture<*>? = null
    private var classifier: AudioClassifier? = null
    private val smoothedScores = FloatArray(521)
    private val EMA_ALPHA = 0.5f

    // ─── JS-callable methods ──────────────────────────────────────────────────

    @ReactMethod
    fun startSceneDetection(promise: Promise) {
        if (ContextCompat.checkSelfPermission(ctx, Manifest.permission.RECORD_AUDIO)
                != PackageManager.PERMISSION_GRANTED) {
            promise.reject("NO_PERMISSION", "Microphone permission is required for scene detection")
            return
        }
        try {
            ensureClassifier()
            scheduledTask?.cancel(false)
            scheduledTask = executor.scheduleAtFixedRate(
                { runAndEmit() }, 2L, INTERVAL_S, TimeUnit.SECONDS
            )
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "startSceneDetection failed", e)
            promise.reject("INIT_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun stopSceneDetection(promise: Promise) {
        scheduledTask?.cancel(false)
        scheduledTask = null
        smoothedScores.fill(0f)
        promise.resolve(true)
    }

    /** One-shot classification — useful for getting the initial scene before the timer fires. */
    @ReactMethod
    fun classifyOnce(promise: Promise) {
        executor.submit {
            try {
                ensureClassifier()
                promise.resolve(doClassify())
            } catch (e: Exception) {
                promise.reject("CLASSIFY_ERROR", e.message, e)
            }
        }
    }

    // ─── Internal ─────────────────────────────────────────────────────────────

    private fun ensureClassifier() {
        if (classifier != null) return
        val opts = AudioClassifierOptions.builder()
            .setMaxResults(100)
            .setScoreThreshold(0.005f) // Lowered to capture subtle background environment classes
            .build()
        classifier = AudioClassifier.createFromFileAndOptions(ctx, MODEL_FILE, opts)
    }

    private fun runAndEmit() {
        try {
            val place = doClassify()
            val map = Arguments.createMap().apply { putString("place", place) }
            ctx.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("onSceneChanged", map)
        } catch (e: Exception) {
            Log.w(TAG, "Scene classification skipped: ${e.message}")
        }
    }

    private fun doClassify(): String {
        val cl = classifier ?: throw IllegalStateException("Classifier not initialised")
        val audioRecord = cl.createAudioRecord()
        val tensor      = cl.createInputTensorAudio()
        try {
            audioRecord.startRecording()
            Thread.sleep(BUFFER_MS)   // let the ring-buffer fill to 0.975 s
            tensor.load(audioRecord)
        } finally {
            runCatching { audioRecord.stop() }
            runCatching { audioRecord.release() }
        }
        val results = cl.classify(tensor)
        if (results.isEmpty()) {
            Log.d(TAG, "YAMNet classification returned empty results list")
            return "Unknown"
        }
        
        val cats = results[0].categories
        
        // Create current frame scores array (521 classes)
        val currentScores = FloatArray(521)
        for (cat in cats) {
            val idx = cat.index
            if (idx in 0..520) {
                currentScores[idx] = cat.score
            }
        }
        
        // Apply Exponential Moving Average (EMA) to smooth out fluctuations
        for (i in 0..520) {
            smoothedScores[i] = EMA_ALPHA * currentScores[i] + (1f - EMA_ALPHA) * smoothedScores[i]
        }
        
        // Log top categories for debugging (up to 20 for rich diagnostic info)
        val sortedSmoothed = smoothedScores.indices.map { it to smoothedScores[it] }
            .sortedByDescending { it.second }
        Log.d(TAG, "--- YAMNet Classification top results (Smoothed) ---")
        for (i in 0 until minOf(20, sortedSmoothed.size)) {
            val (idx, score) = sortedSmoothed[i]
            val label = cats.find { it.index == idx }?.label ?: "Class #$idx"
            Log.d(TAG, "Rank $i: label='$label' index=$idx score=$score")
        }
        
        val place = mapToPlace(smoothedScores)
        Log.d(TAG, "Mapped place: $place")
        return place
    }

    /**
     * Maps YAMNet's AudioSet labels to a human-friendly place type using smoothed scores.
     * YAMNet's environment-specific classes (indices 500-504) are the primary signal;
     * secondary labels like "Music" and "Crowd" refine the result.
     */
    private fun mapToPlace(scores: FloatArray): String {
        val smallRoom   = scores[500]
        val largeRoom   = scores[501]
        val publicSpace = scores[502]
        val urbanOut    = scores[503]
        val ruralOut    = scores[504]
        val crowd       = scores[64]

        val tEnv = 0.005f
        val tEvt = 0.04f

        fun hasEventInRange(start: Int, end: Int): Boolean {
            for (idx in start..end) {
                if (idx < scores.size && scores[idx] > tEvt) {
                    return true
                }
            }
            return false
        }

        fun hasEventInIndices(indices: IntArray): Boolean {
            for (idx in indices) {
                if (idx < scores.size && scores[idx] > tEvt) {
                    return true
                }
            }
            return false
        }

        val hasMusic     = (scores.size > 132 && scores[132] > tEvt) || hasEventInRange(133, 276)
        val hasVehicle   = hasEventInRange(294, 336)
        val hasMachinery = hasEventInRange(337, 347) || (scores.size > 398 && scores[398] > tEvt) || hasEventInRange(403, 407) || hasEventInRange(412, 419)
        val hasChildren  = hasEventInIndices(intArrayOf(1, 10, 66))
        val hasSpeech    = (scores.size > 0 && scores[0] > tEvt) || (scores.size > 5 && scores[5] > tEvt)
        val hasCrowd     = crowd > tEvt || (scores.size > 65 && scores[65] > tEvt)

        return when {
            smallRoom > tEnv && (hasChildren || hasSpeech) -> "School"
            smallRoom > tEnv                               -> "Office"
            largeRoom > tEnv && hasMusic                   -> "Theatre"
            largeRoom > tEnv && hasCrowd                   -> "Mall"
            largeRoom > tEnv                               -> "Hall"
            publicSpace > tEnv && hasCrowd                 -> "Mall"
            publicSpace > tEnv                             -> "Public Space"
            urbanOut > tEnv                                -> "Outdoors"
            ruralOut > tEnv                                -> "Nature"
            hasVehicle                                     -> "Vehicle"
            hasMachinery                                   -> "Factory"
            hasCrowd                                       -> "Mall"
            hasMusic                                       -> "Restaurant"
            hasChildren                                    -> "School"
            else                                           -> "Unknown"
        }
    }

    override fun onCatalystInstanceDestroy() {
        scheduledTask?.cancel(false)
        classifier?.close()
        classifier = null
        smoothedScores.fill(0f)
    }

    @ReactMethod fun addListener(eventName: String) {}
    @ReactMethod fun removeListeners(count: Int) {}
}
