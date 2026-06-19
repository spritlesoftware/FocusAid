package com.hearingtrigger

import android.os.Vibrator
import android.os.VibrationEffect
import android.os.Build
import android.content.Intent
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.hearingtrigger.audio.HearingForegroundService

/**
 * HearingTriggerModule.kt
 *
 * React Native native module bridge.
 * Starts/stops the HearingForegroundService which owns:
 *   - mic capture (AudioRecord at 16kHz mono PCM)
 *   - energy-based VAD
 *   - WAV clip recorder (capturePostMs after speech onset)
 *
 * Events emitted to JS:
 *   onKeywordDetected  { keyword, score, timestamp, clipPath? }
 *   onListeningStateChange { state: "active"|"idle"|"error" }
 */
class HearingTriggerModule(private val ctx: ReactApplicationContext)
    : ReactContextBaseJavaModule(ctx) {

    override fun getName() = "HearingTriggerModule"

    @ReactMethod
    fun startListening(options: ReadableMap, promise: Promise) {
        try {
            // Wire the service back to this module so it can emit events
            HearingForegroundService.moduleRef = this

            val intent = Intent(ctx, HearingForegroundService::class.java).apply {
                putExtra("keyword",       options.getString("keyword") ?: "")
                putExtra("threshold",     options.getDouble("threshold").toFloat())
                putExtra("cooldownMs",    options.getInt("cooldownMs"))
                putExtra("capturePostMs", options.getInt("capturePostMs"))
                putExtra("modelDir",      options.getString("sherpaModelDir") ?: "")
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ctx.startForegroundService(intent)
            } else {
                ctx.startService(intent)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("START_ERROR", e)
        }
    }

    @ReactMethod
    fun stopListening(promise: Promise) {
        ctx.stopService(Intent(ctx, HearingForegroundService::class.java))
        HearingForegroundService.moduleRef = null
        promise.resolve(true)
    }

    @ReactMethod
    fun updateConfig(partial: ReadableMap, promise: Promise) {
        if (partial.hasKey("threshold")) {
            HearingForegroundService.pendingThreshold = partial.getDouble("threshold").toFloat()
        }
        if (partial.hasKey("cooldownMs")) {
            HearingForegroundService.pendingCooldownMs = partial.getInt("cooldownMs").toLong()
        }
        promise.resolve(true)
    }

    @ReactMethod
    fun getListeningState(promise: Promise) {
        promise.resolve(HearingForegroundService.currentState)
    }

    /** Called by HearingForegroundService when speech is detected */
    fun emitDetection(keyword: String, score: Double, clipPath: String?) {
        val map = Arguments.createMap().apply {
            putString("keyword",   keyword)
            putDouble("score",     score)
            putDouble("timestamp", System.currentTimeMillis().toDouble())
            clipPath?.let { putString("clipPath", it) }
        }
        emit("onKeywordDetected", map)
    }

    fun emitState(state: String) {
        val map = Arguments.createMap().also { it.putString("state", state) }
        emit("onListeningStateChange", map)
    }

    private fun emit(event: String, data: WritableMap) {
        ctx.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(event, data)
    }

    @ReactMethod fun addListener(eventName: String) {}
    @ReactMethod fun removeListeners(count: Int) {}
}
