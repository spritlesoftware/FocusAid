import Foundation
import React
import AVFoundation
import TensorFlowLite

/**
 * AcousticSceneModule.swift
 *
 * React Native NativeModule — on-device acoustic scene classification (YAMNet / TFLite).
 *
 * Pipeline:
 *   AVAudioEngine tap (hardware rate) → AVAudioConverter (→ 16 kHz Int16)
 *   → rolling sample buffer (keeps last 2 × 15,600 samples)
 *   → every 15 s: normalize Int16 → Float32, run YAMNet inference
 *   → map top output indices to a place label
 *   → emit "onSceneChanged" { place: String } to JS
 *
 * Model:  yamnet.tflite — must be added to the Xcode project bundle.
 *         Download via scripts/download_yamnet.sh, then drag into Xcode
 *         with "Add to targets: HearingTriggerRN" checked.
 *
 * YAMNet place-relevant output indices (from yamnet_class_map.csv):
 *   64  – Crowd
 *   500 – Inside, small room
 *   501 – Inside, large room or hall
 *   502 – Inside, public space
 *   503 – Outside, urban or manmade
 *   504 – Outside, rural or natural
 */
@objc(AcousticSceneModule)
class AcousticSceneModule: RCTEventEmitter {

    // ─── Constants ─────────────────────────────────────────────────────────
    private let TARGET_SAMPLES       = 15_600        // 0.975 s at 16 kHz (YAMNet window)
    private let SAMPLE_RATE          = Double(16_000)
    private let NUM_CLASSES          = 521
    private let INTERVAL_SECONDS     = 15.0
    private let THRESHOLD_ENVIRONMENT = Float(0.005)
    private let THRESHOLD_EVENT       = Float(0.04)

    // YAMNet class indices for environmental scenes
    private let IDX_CROWD         = 64
    private let IDX_SMALL_ROOM    = 500
    private let IDX_LARGE_ROOM    = 501
    private let IDX_PUBLIC_SPACE  = 502
    private let IDX_URBAN_OUT     = 503
    private let IDX_RURAL_OUT     = 504

    // ─── State ─────────────────────────────────────────────────────────────
    private var interpreter: Interpreter?
    private var audioEngine:  AVAudioEngine?
    private var sampleBuffer: [Int16] = []
    private var classifyTimer: Timer?
    private var smoothedScores: [Float] = []
    private let EMA_ALPHA: Float = 0.5

    private let workQueue = DispatchQueue(label: "com.hearingtrigger.scene", qos: .utility)
    private let bufferLock = NSLock()

    // ─────────────────────────────────────────────────────────────────────
    override static func requiresMainQueueSetup() -> Bool { false }

    override func supportedEvents() -> [String]! {
        ["onSceneChanged"]
    }

    // ─── JS-callable ───────────────────────────────────────────────────────

    @objc(startSceneDetection:rejecter:)
    func startSceneDetection(resolve: @escaping RCTPromiseResolveBlock,
                             reject:  @escaping RCTPromiseRejectBlock) {
        workQueue.async { [weak self] in
            guard let self else { return }
            do {
                try self.loadModelIfNeeded()
                try self.startCapture()
                DispatchQueue.main.async {
                    self.classifyTimer?.invalidate()
                    self.classifyTimer = Timer.scheduledTimer(
                        withTimeInterval: self.INTERVAL_SECONDS, repeats: true
                    ) { [weak self] _ in
                        self?.workQueue.async { self?.classifyAndEmit() }
                    }
                    // First classification after a short warm-up delay
                    DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) { [weak self] in
                        self?.workQueue.async { self?.classifyAndEmit() }
                    }
                }
                resolve(true)
            } catch {
                reject("INIT_ERROR", error.localizedDescription, error)
            }
        }
    }

    @objc(stopSceneDetection:rejecter:)
    func stopSceneDetection(resolve: RCTPromiseResolveBlock,
                            reject:  RCTPromiseRejectBlock) {
        classifyTimer?.invalidate()
        classifyTimer = nil
        stopCapture()
        resolve(true)
    }

    @objc(classifyOnce:rejecter:)
    func classifyOnce(resolve: @escaping RCTPromiseResolveBlock,
                      reject:  @escaping RCTPromiseRejectBlock) {
        workQueue.async { [weak self] in
            guard let self else { return }
            do {
                try self.loadModelIfNeeded()
                if self.audioEngine == nil { try self.startCapture() }
                Thread.sleep(forTimeInterval: 1.3) // let buffer fill
                let place = try self.runInference()
                resolve(place)
            } catch {
                reject("CLASSIFY_ERROR", error.localizedDescription, error)
            }
        }
    }

    // ─── Model loading ──────────────────────────────────────────────────────

    private func loadModelIfNeeded() throws {
        guard interpreter == nil else { return }
        guard let modelPath = Bundle.main.path(forResource: "yamnet", ofType: "tflite") else {
            throw NSError(
                domain: "AcousticSceneModule", code: -1,
                userInfo: [NSLocalizedDescriptionKey:
                    "yamnet.tflite not found in the app bundle. " +
                    "Run scripts/download_yamnet.sh and add the file to Xcode."]
            )
        }
        var options = Interpreter.Options()
        options.threadCount = 2
        interpreter = try Interpreter(modelPath: modelPath, options: options)
        try interpreter!.allocateTensors()
    }

    // ─── Audio capture ──────────────────────────────────────────────────────

    private func startCapture() throws {
        guard audioEngine == nil else { return }

        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playAndRecord, mode: .default,
                                options: [.mixWithOthers, .allowBluetooth, .allowBluetoothA2DP])
        try session.setPreferredSampleRate(SAMPLE_RATE)
        try session.setActive(true)

        let engine    = AVAudioEngine()
        let inputNode = engine.inputNode
        let hwFmt     = inputNode.outputFormat(forBus: 0)

        let targetFmt = AVAudioFormat(
            commonFormat: .pcmFormatInt16,
            sampleRate:   SAMPLE_RATE,
            channels:     1,
            interleaved:  true
        )!

        guard let cvt = AVAudioConverter(from: hwFmt, to: targetFmt) else {
            throw NSError(domain: "AcousticSceneModule", code: -2,
                          userInfo: [NSLocalizedDescriptionKey: "Cannot create audio converter"])
        }

        inputNode.installTap(onBus: 0, bufferSize: 4096, format: hwFmt) { [weak self] buf, _ in
            guard let self else { return }

            let outCount = AVAudioFrameCount(
                Double(buf.frameLength) * self.SAMPLE_RATE / hwFmt.sampleRate + 1
            )
            guard outCount > 0,
                  let outBuf = AVAudioPCMBuffer(pcmFormat: targetFmt, frameCapacity: outCount)
            else { return }

            var inputGiven = false
            cvt.convert(to: outBuf, error: nil) { _, status in
                guard !inputGiven else { status.pointee = .noDataNow; return nil }
                inputGiven = true; status.pointee = .haveData; return buf
            }
            guard outBuf.frameLength > 0, let ptr = outBuf.int16ChannelData?[0] else { return }
            let samples = Array(UnsafeBufferPointer(start: ptr, count: Int(outBuf.frameLength)))

            self.bufferLock.lock()
            self.sampleBuffer.append(contentsOf: samples)
            // Cap memory: keep at most 2 × TARGET_SAMPLES
            if self.sampleBuffer.count > self.TARGET_SAMPLES * 2 {
                self.sampleBuffer.removeFirst(self.sampleBuffer.count - self.TARGET_SAMPLES * 2)
            }
            self.bufferLock.unlock()
        }

        try engine.start()
        audioEngine = engine
    }

    private func stopCapture() {
        audioEngine?.stop()
        audioEngine?.inputNode.removeTap(onBus: 0)
        audioEngine = nil
        bufferLock.lock()
        sampleBuffer.removeAll()
        smoothedScores.removeAll()
        bufferLock.unlock()
    }

    // ─── Inference ──────────────────────────────────────────────────────────

    private func classifyAndEmit() {
        do {
            let place = try runInference()
            sendEvent(withName: "onSceneChanged", body: ["place": place])
        } catch {
            // Buffer not yet full or model not loaded — silently skip
        }
    }

    private func runInference() throws -> String {
        guard let interp = interpreter else {
            throw NSError(domain: "AcousticSceneModule", code: -3,
                          userInfo: [NSLocalizedDescriptionKey: "Interpreter not ready"])
        }

        bufferLock.lock()
        let count = sampleBuffer.count
        let raw   = count >= TARGET_SAMPLES
            ? Array(sampleBuffer.suffix(TARGET_SAMPLES))
            : nil
        bufferLock.unlock()

        guard let samples = raw else { return "Unknown" }

        // Int16 → Float32 normalized [-1, 1]
        var floats = samples.map { Float($0) / 32_768.0 }

        let inputData = floats.withUnsafeBufferPointer { Data(buffer: $0) }
        try interp.copy(inputData, toInputAt: 0)
        try interp.invoke()

        let outputTensor = try interp.output(at: 0)
        guard let scores = [Float](unsafeData: outputTensor.data),
              scores.count == NUM_CLASSES
        else { return "Unknown" }

        // Apply Exponential Moving Average (EMA) to smooth out fluctuations
        if smoothedScores.count != NUM_CLASSES {
            smoothedScores = scores
        } else {
            for i in 0..<NUM_CLASSES {
                smoothedScores[i] = EMA_ALPHA * scores[i] + (1.0 - EMA_ALPHA) * smoothedScores[i]
            }
        }

        // Log top categories for debugging
        let sortedScores = smoothedScores.enumerated().sorted { $0.element > $1.element }
        print("--- iOS YAMNet Classification top results (Smoothed) ---")
        for i in 0..<min(20, sortedScores.count) {
            let item = sortedScores[i]
            print("Rank \(i): index=\(item.offset) score=\(item.element)")
        }

        return mapToPlace(scores: smoothedScores)
    }

    // ─── Place mapping ──────────────────────────────────────────────────────

    private func mapToPlace(scores: [Float]) -> String {
        let smallRoom   = scores[IDX_SMALL_ROOM]
        let largeRoom   = scores[IDX_LARGE_ROOM]
        let publicSpace = scores[IDX_PUBLIC_SPACE]
        let urbanOut    = scores[IDX_URBAN_OUT]
        let ruralOut    = scores[IDX_RURAL_OUT]
        let crowd       = scores[IDX_CROWD]

        let tEnv = THRESHOLD_ENVIRONMENT
        let tEvt = THRESHOLD_EVENT

        func hasEventInRange(_ range: ClosedRange<Int>) -> Bool {
            for idx in range {
                if idx < scores.count && scores[idx] > tEvt {
                    return true
                }
            }
            return false
        }

        func hasEventInIndices(_ indices: [Int]) -> Bool {
            for idx in indices {
                if idx < scores.count && scores[idx] > tEvt {
                    return true
                }
            }
            return false
        }

        let hasMusic     = (scores.count > 132 && scores[132] > tEvt) || hasEventInRange(133...276)
        let hasVehicle   = hasEventInRange(294...336)
        let hasMachinery = hasEventInRange(337...347) || (scores.count > 398 && scores[398] > tEvt) || hasEventInRange(403...407) || hasEventInRange(412...419)
        let hasChildren  = hasEventInIndices([1, 10, 66])
        let hasSpeech    = (scores.count > 0 && scores[0] > tEvt) || (scores.count > 5 && scores[5] > tEvt)
        let hasCrowd     = crowd > tEvt || (scores.count > 65 && scores[65] > tEvt)

        if smallRoom > tEnv && (hasChildren || hasSpeech) { return "School" }
        if smallRoom > tEnv                               { return "Office" }
        if largeRoom > tEnv && hasMusic                   { return "Theatre" }
        if largeRoom > tEnv && hasCrowd                   { return "Mall" }
        if largeRoom > tEnv                               { return "Hall" }
        if publicSpace > tEnv && hasCrowd                 { return "Mall" }
        if publicSpace > tEnv                             { return "Public Space" }
        if urbanOut > tEnv                                { return "Outdoors" }
        if ruralOut > tEnv                                { return "Nature" }
        if hasVehicle                                     { return "Vehicle" }
        if hasMachinery                                   { return "Factory" }
        if hasCrowd                                       { return "Mall" }
        if hasMusic                                       { return "Restaurant" }
        if hasChildren                                    { return "School" }
        return "Unknown"
    }
}

// MARK: - Array helper for reading TFLite output tensors

private extension Array {
    init?(unsafeData: Data) {
        guard unsafeData.count % MemoryLayout<Element>.stride == 0 else { return nil }
        self = unsafeData.withUnsafeBytes { .init($0.bindMemory(to: Element.self)) }
    }
}
