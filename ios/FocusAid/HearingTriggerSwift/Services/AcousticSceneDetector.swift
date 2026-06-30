import Foundation
import AVFoundation
import TensorFlowLite

public final class AcousticSceneDetector {
    // ─── Constants ─────────────────────────────────────────────────────────
    private let TARGET_SAMPLES = 15_600        // 0.975 s at 16 kHz (YAMNet window)
    private let SAMPLE_RATE = Double(16_000)
    private let NUM_CLASSES = 521
    private let INTERVAL_SECONDS = 3.0          // Classify every 3 s (was 15 s)
    private let THRESHOLD_ENVIRONMENT = Float(0.005)
    private let THRESHOLD_EVENT = Float(0.04)
    
    // YAMNet class indices for environmental scenes
    private let IDX_CROWD = 64
    private let IDX_SMALL_ROOM = 500
    private let IDX_LARGE_ROOM = 501
    private let IDX_PUBLIC_SPACE = 502
    private let IDX_URBAN_OUT = 503
    private let IDX_RURAL_OUT = 504
    
    // ─── State ─────────────────────────────────────────────────────────────
    private var interpreter: Interpreter?
    private var audioEngine: AVAudioEngine?
    private var sampleBuffer: [Int16] = []
    private var classifyTimer: Timer?
    private var smoothedScores: [Float] = []
    private let EMA_ALPHA: Float = 0.6          // Lower = faster scene transitions (was 0.8)
    
    private let workQueue = DispatchQueue(label: "com.hearingtrigger.scene", qos: .utility)
    private let bufferLock = NSLock()
    
    private var _isDetecting = false
    public var isDetecting: Bool {
        return _isDetecting
    }
    
    // Callbacks
    private var onSceneChanged: ((String) -> Void)?
    private var onLogging: ((String) -> Void)?
    
    public init() {}
    
    public func start(onSceneChanged: @escaping (String) -> Void, onLogging: ((String) -> Void)? = nil) {
        self.onSceneChanged = onSceneChanged
        self.onLogging = onLogging
        
        workQueue.async { [weak self] in
            guard let self else { return }
            do {
                try self.loadModelIfNeeded()
                try self.startCapture()
                self._isDetecting = true
                
                DispatchQueue.main.async {
                    self.classifyTimer?.invalidate()
                    self.classifyTimer = Timer.scheduledTimer(
                        withTimeInterval: self.INTERVAL_SECONDS, repeats: true
                    ) { [weak self] _ in
                        self?.workQueue.async { self?.classifyAndEmit() }
                    }
                    // First classification after a short warm-up delay
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) { [weak self] in
                        self?.workQueue.async { self?.classifyAndEmit() }
                    }
                }
                self.log("Acoustic Scene Detector started.")
            } catch {
                self._isDetecting = false
                self.log("Failed to start Acoustic Scene Detector: \(error.localizedDescription)")
            }
        }
    }
    
    public func stop() {
        classifyTimer?.invalidate()
        classifyTimer = nil
        stopCapture()
        _isDetecting = false
        log("Acoustic Scene Detector stopped.")
    }
    
    public func classifyOnce(completion: @escaping (String) -> Void) {
        workQueue.async { [weak self] in
            guard let self else { completion("Unknown"); return }
            do {
                try self.loadModelIfNeeded()
                if self.audioEngine == nil { try self.startCapture() }
                Thread.sleep(forTimeInterval: 1.3) // let buffer fill
                let place = try self.runInference()
                completion(place)
            } catch {
                self.log("Single classification error: \(error.localizedDescription)")
                completion("Unknown")
            }
        }
    }
    
    // ─── Model loading ──────────────────────────────────────────────────────
    private func loadModelIfNeeded() throws {
        guard interpreter == nil else { return }
        var modelPath = Bundle.main.path(forResource: "yamnet", ofType: "tflite")
        if modelPath == nil {
            modelPath = Bundle.main.path(forResource: "yamnet", ofType: "tflite", inDirectory: "models")
        }
        guard let finalPath = modelPath else {
            throw NSError(
                domain: "AcousticSceneDetector", code: -1,
                userInfo: [NSLocalizedDescriptionKey: "yamnet.tflite not found in the app bundle."]
            )
        }
        var options = Interpreter.Options()
        options.threadCount = 2
        interpreter = try Interpreter(modelPath: finalPath, options: options)
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
        
        let engine = AVAudioEngine()
        let inputNode = engine.inputNode
        let hwFmt = inputNode.outputFormat(forBus: 0)
        
        let targetFmt = AVAudioFormat(
            commonFormat: .pcmFormatInt16,
            sampleRate: SAMPLE_RATE,
            channels: 1,
            interleaved: true
        )!
        
        guard let cvt = AVAudioConverter(from: hwFmt, to: targetFmt) else {
            throw NSError(domain: "AcousticSceneDetector", code: -2,
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
                inputGiven = true
                status.pointee = .haveData
                return buf
            }
            guard outBuf.frameLength > 0, let ptr = outBuf.int16ChannelData?[0] else { return }
            let samples = Array(UnsafeBufferPointer(start: ptr, count: Int(outBuf.frameLength)))
            
            self.bufferLock.lock()
            self.sampleBuffer.append(contentsOf: samples)
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
            onSceneChanged?(place)
        } catch {
            // Buffer not yet full or model not loaded — silently skip
        }
    }
    
    private func runInference() throws -> String {
        guard let interp = interpreter else {
            throw NSError(domain: "AcousticSceneDetector", code: -3,
                          userInfo: [NSLocalizedDescriptionKey: "Interpreter not ready"])
        }
        
        bufferLock.lock()
        let count = sampleBuffer.count
        let raw = count >= TARGET_SAMPLES
            ? Array(sampleBuffer.suffix(TARGET_SAMPLES))
            : nil
        bufferLock.unlock()
        
        guard let samples = raw else {
            throw NSError(domain: "AcousticSceneDetector", code: -4,
                          userInfo: [NSLocalizedDescriptionKey: "Insufficient audio samples"])
        }
        
        // Int16 → Float32 normalized [-1, 1]
        let floats = samples.map { Float($0) / 32_768.0 }
        
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
        
        return mapToPlace(scores: smoothedScores)
    }
    
    // ─── Place mapping ──────────────────────────────────────────────────────
    private func mapToPlace(scores: [Float]) -> String {
        let smallRoom = scores[IDX_SMALL_ROOM]
        let largeRoom = scores[IDX_LARGE_ROOM]
        let publicSpace = scores[IDX_PUBLIC_SPACE]
        let urbanOut = scores[IDX_URBAN_OUT]
        let ruralOut = scores[IDX_RURAL_OUT]
        let crowd = scores[IDX_CROWD]
        
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
        
        let hasMusic = (scores.count > 132 && scores[132] > tEvt) || hasEventInRange(133...276)
        let hasVehicle = hasEventInRange(294...336)
        let hasMachinery = hasEventInRange(337...347) || (scores.count > 398 && scores[398] > tEvt) || hasEventInRange(403...407) || hasEventInRange(412...419)
        let hasChildren = hasEventInIndices([1, 10, 66])
        let hasSpeech = (scores.count > 0 && scores[0] > tEvt) || (scores.count > 5 && scores[5] > tEvt)
        let hasCrowd = crowd > tEvt || (scores.count > 65 && scores[65] > tEvt)
        let hasRestaurant = hasEventInIndices([487, 490, 491, 492, 493, 494, 495])
        
        // 1. High-confidence specific events take absolute precedence
        if hasVehicle { return "Vehicle" }
        if hasMachinery { return "Factory" }
        
        // 2. Combined room tone + specific event rules
        if smallRoom > tEnv && hasChildren { return "School" }
        if smallRoom > tEnv { return "Office" }
        
        if largeRoom > tEnv && hasMusic { return "Theatre" }
        if largeRoom > tEnv && hasCrowd { return "Mall" }
        if largeRoom > tEnv && hasRestaurant { return "Restaurant" }
        if largeRoom > tEnv { return "Hall" }
        
        if publicSpace > tEnv && hasCrowd { return "Mall" }
        if publicSpace > tEnv && hasRestaurant { return "Restaurant" }
        if publicSpace > tEnv { return "Public Space" }
        
        if urbanOut > tEnv { return "Outdoors" }
        if ruralOut > tEnv { return "Nature" }
        
        // 3. Lower confidence fallback rules based on individual event types
        if hasCrowd { return "Mall" }
        if hasRestaurant { return "Restaurant" }
        if hasMusic { return "Restaurant" }
        if hasChildren { return "School" }
        if hasSpeech { return "Office" }
        return "Unknown"
    }
    
    private func log(_ message: String) {
        onLogging?("[AcousticSceneDetector] \(message)")
    }
}

// MARK: - Array helper for reading TFLite output tensors
private extension Array {
    init?(unsafeData: Data) {
        guard unsafeData.count % MemoryLayout<Element>.stride == 0 else { return nil }
        self = unsafeData.withUnsafeBytes { .init($0.bindMemory(to: Element.self)) }
    }
}
