import Foundation
import React
import AVFoundation
import UIKit

/**
 * HearingTriggerModule.swift
 *
 * React Native NativeModule + RCTEventEmitter for iOS.
 *
 * Audio pipeline:
 *   AVAudioEngine inputNode tap → AVAudioConverter (→ 16kHz mono Int16)
 *   → energy VAD → cooldown check
 *   → on speech onset sustained ≥ 300ms: buffer capturePostMs of audio
 *   → write WAV clip → emit onKeywordDetected → JS runs whisper.rn to confirm keyword
 *
 * Keyword confirmation (and the heavy haptic cue) happens in audioBridge.ts after
 * Whisper transcription. The light haptic here signals "speech detected."
 */
@objc(HearingTriggerModule)
class HearingTriggerModule: RCTEventEmitter {

    // ─── Config ───────────────────────────────────────────────────
    private var keyword       = ""
    private var threshold     = Float(0.5)
    private var cooldownMs    = 6000
    private var capturePostMs = 3000

    // ─── Audio engine ─────────────────────────────────────────────
    private var audioEngine: AVAudioEngine?
    private var converter:   AVAudioConverter?
    private var isListening  = false

    private let targetFormat = AVAudioFormat(
        commonFormat: .pcmFormatInt16,
        sampleRate:   16000,
        channels:     1,
        interleaved:  true
    )!

    // ─── VAD state (accessed only on vadQueue) ────────────────────
    private let vadQueue      = DispatchQueue(label: "com.hearingtrigger.vad", qos: .userInteractive)
    private let ENERGY_THRESHOLD = Float(0.045)  // normalized RMS — filters room noise, HVAC, TV hum
    private let MIN_SPEECH_MS    = 700.0         // sustained speech required before triggering

    private var speechOnsetAt:     Date?
    private var isRecording        = false
    private var recordingStartedAt = Date.distantPast
    private var recordedSamples    = [Int16]()
    private var preRollSamples     = [Int16]()   // 1-second sliding pre-roll
    private let preRollMaxCount    = 16000        // 1s at 16kHz

    // ─── Cooldown ─────────────────────────────────────────────────
    private var lastDetectAt = Date.distantPast

    // ─────────────────────────────────────────────────────────────
    override static func requiresMainQueueSetup() -> Bool { false }

    override func supportedEvents() -> [String]! {
        ["onKeywordDetected", "onListeningStateChange", "onListeningError"]
    }

    // ─── JS-callable methods ──────────────────────────────────────

    @objc(startListening:resolver:rejecter:)
    func startListening(
        options: NSDictionary,
        resolve: @escaping RCTPromiseResolveBlock,
        reject:  @escaping RCTPromiseRejectBlock
    ) {
        keyword       = (options["keyword"]       as? String) ?? ""
        threshold     = Float((options["threshold"] as? Double) ?? 0.5)
        cooldownMs    = (options["cooldownMs"]    as? Int)    ?? 6000
        capturePostMs = (options["capturePostMs"] as? Int)    ?? 3000

        do {
            try configureAudioSession()
            try startAudioEngine()
            isListening = true
            sendEvent(withName: "onListeningStateChange", body: ["state": "active"])
            resolve(true)
        } catch {
            reject("START_ERROR", error.localizedDescription, error)
        }
    }

    @objc(stopListening:rejecter:)
    func stopListening(resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) {
        stopEngine()
        sendEvent(withName: "onListeningStateChange", body: ["state": "idle"])
        resolve(true)
    }

    @objc(updateConfig:resolver:rejecter:)
    func updateConfig(
        partial: NSDictionary,
        resolve: RCTPromiseResolveBlock,
        reject:  RCTPromiseRejectBlock
    ) {
        if let t = partial["threshold"] as? Double { threshold  = Float(t) }
        if let c = partial["cooldownMs"] as? Int   { cooldownMs = c        }
        resolve(true)
    }

    @objc(getListeningState:rejecter:)
    func getListeningState(resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) {
        resolve(isListening ? "active" : "idle")
    }

    // ─── Audio session ────────────────────────────────────────────
    private func configureAudioSession() throws {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(
            .playAndRecord,
            mode: .default,
            options: [.allowBluetooth, .allowBluetoothA2DP, .mixWithOthers]
        )
        if #available(iOS 13.0, *) {
            try session.setAllowHapticsAndSystemSoundsDuringRecording(true)
        }
        try session.setPreferredSampleRate(16000)
        try session.setActive(true)
    }

    // ─── Audio engine + PCM tap ───────────────────────────────────
    private func startAudioEngine() throws {
        let engine    = AVAudioEngine()
        let inputNode = engine.inputNode
        let hwFormat  = inputNode.outputFormat(forBus: 0)

        guard let cvt = AVAudioConverter(from: hwFormat, to: targetFormat) else {
            throw NSError(domain: "HearingTrigger", code: -1,
                          userInfo: [NSLocalizedDescriptionKey: "Could not create audio converter"])
        }
        converter = cvt

        inputNode.installTap(onBus: 0, bufferSize: 4096, format: hwFormat) { [weak self] buffer, _ in
            self?.handleBuffer(buffer, hwFormat: hwFormat)
        }

        try engine.start()
        audioEngine = engine
    }

    private func stopEngine() {
        audioEngine?.stop()
        audioEngine?.inputNode.removeTap(onBus: 0)
        audioEngine  = nil
        converter    = nil
        isListening  = false
        vadQueue.async { [weak self] in
            self?.isRecording    = false
            self?.recordedSamples = []
            self?.preRollSamples  = []
            self?.speechOnsetAt   = nil
        }
    }

    // ─── Buffer conversion + VAD dispatch ─────────────────────────
    private func handleBuffer(_ buffer: AVAudioPCMBuffer, hwFormat: AVAudioFormat) {
        guard let cvt = converter else { return }

        // Compute output frame count proportional to input
        let outCount = AVAudioFrameCount(
            Double(buffer.frameLength) * targetFormat.sampleRate / hwFormat.sampleRate + 1
        )
        guard outCount > 0,
              let outBuf = AVAudioPCMBuffer(pcmFormat: targetFormat, frameCapacity: outCount)
        else { return }

        var inputGiven = false
        var convertError: NSError?
        cvt.convert(to: outBuf, error: &convertError) { _, status in
            guard !inputGiven else { status.pointee = .noDataNow; return nil }
            inputGiven           = true
            status.pointee       = .haveData
            return buffer
        }
        guard convertError == nil, outBuf.frameLength > 0 else { return }

        let count = Int(outBuf.frameLength)
        guard let ptr = outBuf.int16ChannelData?[0] else { return }
        let samples = Array(UnsafeBufferPointer(start: ptr, count: count))
        let rms     = computeRMS(samples)
        let now     = Date()

        vadQueue.async { [weak self] in self?.processVAD(samples: samples, rms: rms, now: now) }
    }

    // ─── VAD state machine ────────────────────────────────────────
    private func processVAD(samples: [Int16], rms: Float, now: Date) {
        if !isRecording {
            // Maintain sliding pre-roll
            preRollSamples.append(contentsOf: samples)
            if preRollSamples.count > preRollMaxCount {
                preRollSamples.removeFirst(preRollSamples.count - preRollMaxCount)
            }

            if rms > ENERGY_THRESHOLD {
                if speechOnsetAt == nil { speechOnsetAt = now }

                let onsetMs       = speechOnsetAt.map { now.timeIntervalSince($0) * 1000 } ?? 0
                let cooldownElapsed = now.timeIntervalSince(lastDetectAt) * 1000 > Double(cooldownMs)

                if onsetMs >= MIN_SPEECH_MS && cooldownElapsed {
                    lastDetectAt       = now
                    isRecording        = true
                    recordingStartedAt = now
                    recordedSamples    = preRollSamples   // seed with pre-roll
                    recordedSamples.append(contentsOf: samples)
                }
            } else {
                speechOnsetAt = nil
            }
        } else {
            recordedSamples.append(contentsOf: samples)

            let elapsedMs = now.timeIntervalSince(recordingStartedAt) * 1000
            if elapsedMs >= Double(capturePostMs) {
                let captured      = recordedSamples
                recordedSamples   = []
                isRecording       = false
                speechOnsetAt     = nil
                preRollSamples    = []
                finalizeDetection(samples: captured)
            }
        }
    }

    // ─── Clip finalization ────────────────────────────────────────
    private func finalizeDetection(samples: [Int16]) {
        let clipPath = writeWAV(samples: samples)

        sendEvent(withName: "onKeywordDetected", body: [
            "keyword":   keyword,
            "score":     0.7,
            "timestamp": Date().timeIntervalSince1970 * 1000,
            "clipPath":  clipPath as Any,
        ])
    }

    // ─── WAV writer ───────────────────────────────────────────────
    private func writeWAV(samples: [Int16]) -> String? {
        let docsDir  = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
        let clipsDir = docsDir.appendingPathComponent("clips")
        try? FileManager.default.createDirectory(at: clipsDir, withIntermediateDirectories: true)

        let filename = "clip-\(Int64(Date().timeIntervalSince1970 * 1000)).wav"
        let fileURL  = clipsDir.appendingPathComponent(filename)

        let sampleRate:    UInt32 = 16000
        let numChannels:   UInt16 = 1
        let bitsPerSample: UInt16 = 16
        let dataSize               = UInt32(samples.count * 2)

        var data = Data(capacity: 44 + Int(dataSize))

        func addStr(_ s: String)   { data.append(contentsOf: s.utf8) }
        func addU32(_ v: UInt32)   { var x = v.littleEndian; withUnsafeBytes(of: x) { data.append(contentsOf: $0) } }
        func addU16(_ v: UInt16)   { var x = v.littleEndian; withUnsafeBytes(of: x) { data.append(contentsOf: $0) } }

        // RIFF header
        addStr("RIFF");  addU32(36 + dataSize)
        addStr("WAVE")
        // fmt chunk
        addStr("fmt ");  addU32(16)
        addU16(1)                                               // PCM
        addU16(numChannels)
        addU32(sampleRate)
        addU32(sampleRate * UInt32(numChannels) * UInt32(bitsPerSample) / 8)
        addU16(numChannels * bitsPerSample / 8)
        addU16(bitsPerSample)
        // data chunk
        addStr("data");  addU32(dataSize)

        // PCM samples (little-endian)
        var pcm = Data(count: samples.count * 2)
        pcm.withUnsafeMutableBytes { ptr in
            let buf = ptr.bindMemory(to: Int16.self)
            for (i, s) in samples.enumerated() { buf[i] = s.littleEndian }
        }
        data.append(pcm)

        do {
            try data.write(to: fileURL)
            return fileURL.path
        } catch {
            return nil
        }
    }

    // ─── Energy helper ────────────────────────────────────────────
    private func computeRMS(_ samples: [Int16]) -> Float {
        guard !samples.isEmpty else { return 0 }
        let sumSq = samples.reduce(Double(0)) { acc, s in
            let f = Double(s) / 32768.0; return acc + f * f
        }
        return Float(sqrt(sumSq / Double(samples.count)))
    }
}
