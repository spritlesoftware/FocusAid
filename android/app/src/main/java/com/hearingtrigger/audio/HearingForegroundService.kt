package com.hearingtrigger.audio

import android.app.*
import android.content.Context
import android.content.Intent
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.*
import androidx.core.app.NotificationCompat
import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.sqrt

/**
 * HearingForegroundService.kt
 *
 * Always-on foreground service for keyword detection.
 *
 * Audio pipeline:
 *   AudioRecord (16kHz mono PCM16) → 64ms frames → energy VAD → cooldown check
 *   → on speech onset sustained > MIN_SPEECH_MS: start buffering capturePostMs of audio
 *   → write WAV clip → emit onKeywordDetected event to RN → JS runs Whisper to confirm keyword
 *
 * The energy VAD fires on any sustained speech. Keyword confirmation happens in JS
 * via whisper.rn transcription — only confirmed detections trigger haptic feedback.
 */
class HearingForegroundService : Service() {

    companion object {
        const val CHANNEL_ID = "hearing_trigger_channel"
        const val NOTIF_ID   = 1001
        var currentState     = "idle"
        var moduleRef: com.hearingtrigger.HearingTriggerModule? = null

        // Live-update from updateConfig without restarting the service
        @Volatile var pendingThreshold:  Float? = null
        @Volatile var pendingCooldownMs: Long?  = null
    }

    private val SAMPLE_RATE      = 16000
    private val FRAME_SIZE       = 1024          // ~64ms at 16kHz
    private val MIN_SPEECH_MS    = 700L          // sustained speech required before triggering
    private val ENERGY_THRESHOLD = 0.045f        // normalized RMS — filters room noise, HVAC, TV hum
    private val PRE_ROLL_SAMPLES = SAMPLE_RATE   // 1 second pre-roll to avoid clipping onset

    // Config (set from intent extras, updated live via pendingThreshold / pendingCooldownMs)
    private var keyword       = ""
    private var threshold     = 0.5f
    private var cooldownMs    = 6000L
    private var capturePostMs = 3000L

    // AudioRecord
    private var audioRecord: AudioRecord? = null
    private var captureThread: Thread? = null
    private var running = false

    // VAD state
    private var speechOnsetAt    = 0L
    private var isRecording      = false
    private var recordingStartAt = 0L
    private val recordedSamples  = ArrayList<Short>(SAMPLE_RATE * 5)
    private val preRollDeque     = ArrayDeque<Short>(PRE_ROLL_SAMPLES + FRAME_SIZE)

    // Cooldown
    private var lastDetectAt = 0L

    override fun onBind(intent: Intent?) = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        intent?.let {
            keyword       = it.getStringExtra("keyword")       ?: ""
            threshold     = it.getFloatExtra("threshold",      0.5f)
            cooldownMs    = it.getIntExtra("cooldownMs",       6000).toLong()
            capturePostMs = it.getIntExtra("capturePostMs",    3000).toLong()
        }

        startForeground(NOTIF_ID, buildNotification())
        startCapture()
        currentState = "active"
        moduleRef?.emitState("active")
        return START_STICKY
    }

    // ─── Audio capture ────────────────────────────────────────────
    private fun startCapture() {
        if (running) return
        val minBuf = AudioRecord.getMinBufferSize(
            SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT
        )
        val bufSize = maxOf(minBuf, FRAME_SIZE * 4)

        audioRecord = AudioRecord(
            MediaRecorder.AudioSource.MIC,
            SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT, bufSize,
        )

        running = true
        audioRecord?.startRecording()

        captureThread = Thread {
            val frame = ShortArray(FRAME_SIZE)
            while (running) {
                // Apply any live config changes
                pendingThreshold?.let  { threshold  = it; pendingThreshold  = null }
                pendingCooldownMs?.let { cooldownMs = it; pendingCooldownMs = null }

                val read = audioRecord?.read(frame, 0, frame.size) ?: break
                if (read <= 0) continue
                processFrame(frame, read)
            }
        }.also { it.start() }
    }

    // ─── VAD + recording state machine ───────────────────────────
    private fun processFrame(frame: ShortArray, read: Int) {
        val rms = computeRms(frame, read)
        val now = System.currentTimeMillis()

        synchronized(recordedSamples) {
            if (!isRecording) {
                // Maintain a rolling pre-roll buffer so we don't clip the speech onset
                for (i in 0 until read) preRollDeque.addLast(frame[i])
                while (preRollDeque.size > PRE_ROLL_SAMPLES) preRollDeque.removeFirst()

                if (rms > ENERGY_THRESHOLD) {
                    if (speechOnsetAt == 0L) speechOnsetAt = now

                    // Speech sustained long enough AND cooldown elapsed → start recording
                    if (now - speechOnsetAt >= MIN_SPEECH_MS && now - lastDetectAt >= cooldownMs) {
                        lastDetectAt    = now
                        isRecording     = true
                        recordingStartAt = now
                        recordedSamples.clear()
                        recordedSamples.addAll(preRollDeque)   // include pre-roll
                        for (i in 0 until read) recordedSamples.add(frame[i])
                    }
                } else {
                    speechOnsetAt = 0L
                }
            } else {
                // Accumulate post-trigger audio
                for (i in 0 until read) recordedSamples.add(frame[i])

                if (now - recordingStartAt >= capturePostMs) {
                    val samples = recordedSamples.toShortArray()
                    recordedSamples.clear()
                    isRecording   = false
                    speechOnsetAt = 0L
                    preRollDeque.clear()

                    // Run clip finalization off the capture thread
                    Handler(Looper.getMainLooper()).post { finalizeDetection(samples) }
                }
            }
        }
    }

    // ─── Clip finalization + event emit ──────────────────────────
    private fun finalizeDetection(samples: ShortArray) {
        val clipPath = writeWav(samples)
        moduleRef?.emitDetection(keyword, 0.7, clipPath)
    }

    private fun vibrateShort() {
        val vib = getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vib.vibrate(VibrationEffect.createOneShot(80, VibrationEffect.DEFAULT_AMPLITUDE))
        } else {
            @Suppress("DEPRECATION")
            vib.vibrate(80)
        }
    }

    // ─── WAV writer ───────────────────────────────────────────────
    private fun writeWav(samples: ShortArray): String? {
        val clipsDir = File(filesDir, "clips").also { it.mkdirs() }
        val file     = File(clipsDir, "clip-${System.currentTimeMillis()}.wav")

        return try {
            val numChannels   = 1
            val bitsPerSample = 16
            val dataSize      = samples.size * 2
            val headerSize    = 44

            val buf = ByteBuffer.allocate(headerSize + dataSize).order(ByteOrder.LITTLE_ENDIAN)

            // RIFF / WAVE header
            buf.put("RIFF".toByteArray(Charsets.US_ASCII))
            buf.putInt(36 + dataSize)
            buf.put("WAVE".toByteArray(Charsets.US_ASCII))

            // fmt chunk
            buf.put("fmt ".toByteArray(Charsets.US_ASCII))
            buf.putInt(16)
            buf.putShort(1)                                           // PCM
            buf.putShort(numChannels.toShort())
            buf.putInt(SAMPLE_RATE)
            buf.putInt(SAMPLE_RATE * numChannels * bitsPerSample / 8)
            buf.putShort((numChannels * bitsPerSample / 8).toShort())
            buf.putShort(bitsPerSample.toShort())

            // data chunk
            buf.put("data".toByteArray(Charsets.US_ASCII))
            buf.putInt(dataSize)
            for (s in samples) buf.putShort(s)

            file.writeBytes(buf.array())
            file.absolutePath
        } catch (e: Exception) {
            null
        }
    }

    // ─── Energy helper ────────────────────────────────────────────
    private fun computeRms(samples: ShortArray, count: Int): Float {
        if (count == 0) return 0f
        var sum = 0.0
        for (i in 0 until count) {
            val s = samples[i].toDouble() / 32768.0
            sum += s * s
        }
        return sqrt(sum / count).toFloat()
    }

    // ─── Service lifecycle ────────────────────────────────────────
    override fun onDestroy() {
        running = false
        captureThread?.interrupt()
        audioRecord?.stop()
        audioRecord?.release()
        audioRecord    = null
        captureThread  = null
        currentState   = "idle"
        moduleRef?.emitState("idle")
        super.onDestroy()
    }

    // ─── Notification ─────────────────────────────────────────────
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID, "Hearing Trigger", NotificationManager.IMPORTANCE_LOW,
            ).apply { description = "Always-on speech listener" }
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }

    private fun buildNotification(): Notification =
        NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Hearing Trigger active")
            .setContentText("Listening for \"$keyword\"")
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setOngoing(true)
            .build()
}
