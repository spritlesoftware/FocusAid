import Foundation
import SwiftUI
import SwiftData
import Observation
import AudioToolbox
import UIKit
import CoreHaptics

@Observable
@MainActor
public final class HearingManager {
    public static let shared = HearingManager()
    
    // ─── Published States ─────────────────────────────────────────
    public var setupPhase: String = "setup" // "setup" | "ready" | "listening" | "error"
    public var setupProgress: String = ""
    public var currentScene: String = "Unknown"
    public var activeKeywords: [String] = []
    
    // ─── Managers & Engines ────────────────────────────────────────
    public let settings = SettingsStore()
    private let vadEngine = VADEngine()
    private let sceneDetector = AcousticSceneDetector()
    private var transcriber: SpeechTranscriber?
    private var modelContext: ModelContext?
    private var hapticEngine: CHHapticEngine?
    
    private var activeModelKey = ""
    
    private init() {
        self.activeKeywords = settings.keywords
        
        // Asynchronously warm up the default model on startup
        Task {
            await warmupActiveModel()
        }
    }
    
    public func setModelContext(_ context: ModelContext) {
        self.modelContext = context
    }
    
    // ─── Public Controls ──────────────────────────────────────────
    public func startListening() async {
        guard setupPhase == "ready" else { return }
        
        self.activeKeywords = settings.keywords
        let thresh = settings.threshold
        let cool = settings.cooldownMs
        
        // Cooldown for recording is passed to VAD, capture duration defaults to 1.0 seconds
        // (matching 1000ms capturePostMs from optimised React Native logic to reduce latency)
        vadEngine.start(
            threshold: Float(thresh),
            cooldownMs: cool,
            capturePostMs: 1000,
            onClipCaptured: { [weak self] fileURL in
                Task { @MainActor in
                    await self?.handleClipCaptured(url: fileURL)
                }
            },
            onError: { [weak self] error in
                Task { @MainActor in
                    self?.setupPhase = "error"
                    self?.setupProgress = "VAD error: \(error.localizedDescription)"
                }
            },
            onLogging: { [weak self] logMsg in
                if self?.settings.enableDebugLogs == true {
                    print(logMsg)
                }
            }
        )
        
        sceneDetector.start(onSceneChanged: { [weak self] place in
            Task { @MainActor in
                self?.currentScene = place
                self?.log("Scene updated: \(place)")
            }
        }, onLogging: { [weak self] logMsg in
            if self?.settings.enableDebugLogs == true {
                print(logMsg)
            }
        })
        
        setupPhase = "listening"
        log("Started Listening.")
    }
    
    public func stopListening() async {
        guard setupPhase == "listening" else { return }
        
        vadEngine.stop()
        sceneDetector.stop()
        currentScene = "Unknown"
        setupPhase = "ready"
        log("Stopped Listening.")
    }
    
    public func updateThreshold(value: Double) {
        settings.threshold = value
        if setupPhase == "listening" {
            vadEngine.updateConfig(threshold: Float(value), cooldownMs: settings.cooldownMs, capturePostMs: 1000)
        }
    }
    
    public func updateCooldown(seconds: Int) {
        settings.cooldownMs = seconds * 1000
        if setupPhase == "listening" {
            vadEngine.updateConfig(threshold: Float(settings.threshold), cooldownMs: seconds * 1000, capturePostMs: 1000)
        }
    }
    
    public func changeModel(_ modelKey: String) async {
        settings.whisperModel = modelKey
        await warmupActiveModel()
    }
    
    // ─── Warmup Pipeline ──────────────────────────────────────────
    public func warmupActiveModel() async {
        setupPhase = "setup"
        setupProgress = "Warming up transcription engine..."
        
        // Clear previous transcriber
        transcriber = nil

        
        let targetModel = settings.whisperModel
        activeModelKey = targetModel
        
        if settings.useWhisper {
            if let path = getWhisperModelPath(modelKey: targetModel) {
                setupProgress = "Loading local Whisper model..."
                let whisper = WhisperTranscriber(modelPath: path)
                transcriber = whisper
                activeModelKey = targetModel
                setupPhase = "ready"
                setupProgress = ""
                log("Whisper engine loaded successfully with model: \(targetModel)")
            } else {
                setupPhase = "error"
                setupProgress = "Model file not found. Ensure ggml-\(targetModel).bin is bundled."
                log("Model file not found for: \(targetModel)")
            }
        } else {
            // Using Apple's native SFSpeechRecognizer
            setupProgress = "Configuring Apple speech recognizer..."
            transcriber = AppleSpeechTranscriber()
            setupPhase = "ready"
            setupProgress = ""
            log("Apple speech transcriber selected.")
        }
    }
    
    private func getWhisperModelPath(modelKey: String) -> String? {
        // 1. Check documents directory first
        let fileManager = FileManager.default
        let docsDir = fileManager.urls(for: .documentDirectory, in: .userDomainMask).first!
        let localPath = docsDir.appendingPathComponent("models/ggml-\(modelKey).bin").path
        if fileManager.fileExists(atPath: localPath) {
            return localPath
        }
        
        // 2. Check main bundle
        if let bundlePath = Bundle.main.path(forResource: "ggml-\(modelKey)", ofType: "bin") {
            return bundlePath
        }
        // Fallback for models subfolder inside bundle
        if let subPath = Bundle.main.path(forResource: "ggml-\(modelKey)", ofType: "bin", inDirectory: "models") {
            return subPath
        }
        return nil
    }
    
    // ─── Core Trigger Logic ───────────────────────────────────────
    private func handleClipCaptured(url: URL) async {
        let startTime = Date()
        let activeKws = settings.keywords.map { $0.lowercased().trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
        let capturedScene = currentScene

        log("VAD Triggered. Spawning speech transcription pipeline for: \(url.lastPathComponent)")

        // 1. Transcribe clip first — do NOT save to history yet
        var transcript = ""
        do {
            if let engine = transcriber {
                transcript = try await engine.transcribe(audioURL: url)
            }
        } catch {
            log("Transcription error: \(error.localizedDescription)")
            transcript = ""
        }

        let durationMs = Int(Date().timeIntervalSince(startTime) * 1000)
        log("Transcribed in \(durationMs)ms: \"\(transcript)\"")

        // 2. Match keyword (fuzzy matching)
        let matchedKeywords = activeKws.filter { fuzzyIncludes(transcript: transcript, keyword: $0) }
        let isConfirmed = !matchedKeywords.isEmpty

        // 3. Only save to history if a trigger word was detected
        guard isConfirmed else {
            log("No trigger keyword matched — skipping history save.")
            return
        }

        // Re-case keywords based on user original inputs
        let mappedKeywords = matchedKeywords.map { matchedKw in
            settings.keywords.first { $0.lowercased() == matchedKw } ?? matchedKw
        }

        let newRecord = DetectionRecord(
            keyword: mappedKeywords.joined(separator: ", "),
            score: 0.7,
            timestamp: Date(),
            clipPath: url.path,
            transcript: transcript,
            confirmed: true,
            placeType: capturedScene
        )

        modelContext?.insert(newRecord)
        try? modelContext?.save()

        // Trigger haptic alert
        triggerSuccessHaptics()
    }
    
    private func triggerSuccessHaptics() {
        // Try CoreHaptics first — gives full control over duration & intensity
        if CHHapticEngine.capabilitiesForHardware().supportsHaptics {
            do {
                // (Re-)create engine if needed
                if hapticEngine == nil {
                    hapticEngine = try CHHapticEngine()
                    hapticEngine?.isAutoShutdownEnabled = true
                }
                try hapticEngine?.start()

                // 4 strong pulses at 0.0 s, 0.35 s, 0.70 s, 1.05 s
                var events: [CHHapticEvent] = []
                let pulseTimes: [TimeInterval] = [0.0, 0.35, 0.70, 1.05]
                for t in pulseTimes {
                    let intensity = CHHapticEventParameter(parameterID: .hapticIntensity, value: 1.0)
                    let sharpness = CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.8)
                    let event = CHHapticEvent(
                        eventType: .hapticTransient,
                        parameters: [intensity, sharpness],
                        relativeTime: t
                    )
                    events.append(event)
                }

                let pattern = try CHHapticPattern(events: events, parameters: [])
                let player = try hapticEngine?.makePlayer(with: pattern)
                try player?.start(atTime: CHHapticTimeImmediate)
                return          // CoreHaptics succeeded — skip fallback
            } catch {
                log("CoreHaptics error: \(error.localizedDescription)")
                hapticEngine = nil
            }
        }

        // Fallback: 3 heavy impacts spaced 300 ms apart via UIImpactFeedbackGenerator
        let impact = UIImpactFeedbackGenerator(style: .heavy)
        impact.prepare()
        impact.impactOccurred()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.30) {
            impact.impactOccurred()
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.60) {
            impact.impactOccurred()
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.90) {
            impact.impactOccurred()
        }
    }
    
    // ─── Fuzzy String Matching ─────────────────────────────────────
    private func getLevenshteinDistance(_ a: String, _ b: String) -> Int {
        let aArr = Array(a)
        let bArr = Array(b)
        
        var matrix = [[Int]](repeating: [Int](repeating: 0, count: bArr.count + 1), count: aArr.count + 1)
        
        for i in 0...aArr.count {
            matrix[i][0] = i
        }
        for j in 0...bArr.count {
            matrix[0][j] = j
        }
        
        for i in 1...aArr.count {
            for j in 1...bArr.count {
                if aArr[i - 1] == bArr[j - 1] {
                    matrix[i][j] = matrix[i - 1][j - 1]
                } else {
                    matrix[i][j] = min(
                        matrix[i - 1][j] + 1,    // deletion
                        matrix[i][j - 1] + 1,    // insertion
                        matrix[i - 1][j - 1] + 1 // substitution
                    )
                }
            }
        }
        return matrix[aArr.count][bArr.count]
    }
    
    private func isFuzzyMatch(word: String, keyword: String) -> Bool {
        let w = word.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        let kw = keyword.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        
        if w == kw { return true }
        
        // Short keywords must match exactly
        if kw.count <= 3 {
            return false
        }
        
        // Simple inclusion check
        if w.count > 3 && kw.count > 3 && (w.contains(kw) || kw.contains(w)) {
            let lenDiff = abs(w.count - kw.count)
            if lenDiff <= 2 { return true }
        }
        
        let dist = getLevenshteinDistance(w, kw)
        
        if kw.count <= 6 {
            return dist <= 1 // Allow 1 mismatch
        } else {
            return dist <= 2 // Allow up to 2 mismatches
        }
    }
    
    private func fuzzyIncludes(transcript: String, keyword: String) -> Bool {
        let characterSet = CharacterSet.punctuationCharacters.union(CharacterSet.symbols)
        let cleanTranscript = transcript.lowercased()
            .components(separatedBy: characterSet).joined()
            .trimmingCharacters(in: .whitespacesAndNewlines)
        
        let kw = keyword.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        
        if cleanTranscript.contains(kw) { return true }
        
        let transcriptWords = cleanTranscript.components(separatedBy: .whitespacesAndNewlines).filter { !$0.isEmpty }
        let keywordWords = kw.components(separatedBy: .whitespacesAndNewlines).filter { !$0.isEmpty }
        
        if keywordWords.isEmpty { return false }
        
        if keywordWords.count == 1 {
            return transcriptWords.contains { isFuzzyMatch(word: $0, keyword: kw) }
        } else {
            // Multi-word phrase sliding window
            let windowSize = keywordWords.count
            guard transcriptWords.count >= windowSize else { return false }
            
            for i in 0...(transcriptWords.count - windowSize) {
                let windowJoined = transcriptWords[i..<(i + windowSize)].joined(separator: " ")
                let dist = getLevenshteinDistance(windowJoined, kw)
                let maxAllowedDist = kw.count <= 6 ? 1 : 2
                if dist <= maxAllowedDist {
                    return true
                }
            }
        }
        return false
    }
    
    private func log(_ message: String) {
        if settings.enableDebugLogs {
            print("[HearingManager] \(message)")
        }
    }
}
