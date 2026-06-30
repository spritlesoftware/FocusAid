import Foundation
import Speech
import AVFoundation

// ─── Protocol ────────────────────────────────────────────────────────────────
public protocol SpeechTranscriber {
    func transcribe(audioURL: URL) async throws -> String
}

// ─── Apple Speech Framework Transcriber (Default / Production) ────────────────
/// Uses SFSpeechRecognizer for on-device or cloud speech recognition.
/// On-device recognition is used when the device supports it and the model
/// has been downloaded. Falls back to cloud recognition transparently.
public final class AppleSpeechTranscriber: SpeechTranscriber {
    private let locale: Locale

    public init(locale: Locale = Locale(identifier: "en-US")) {
        self.locale = locale
    }

    public func transcribe(audioURL: URL) async throws -> String {
        return try await withCheckedThrowingContinuation { continuation in
            SFSpeechRecognizer.requestAuthorization { status in
                guard status == .authorized else {
                    continuation.resume(throwing: NSError(
                        domain: "AppleSpeechTranscriber", code: -1,
                        userInfo: [NSLocalizedDescriptionKey: "Speech recognition permission denied."]))
                    return
                }

                guard let recognizer = SFSpeechRecognizer(locale: self.locale),
                      recognizer.isAvailable else {
                    continuation.resume(throwing: NSError(
                        domain: "AppleSpeechTranscriber", code: -2,
                        userInfo: [NSLocalizedDescriptionKey: "Speech recognizer unavailable for locale \(self.locale.identifier)."]))
                    return
                }

                let request = SFSpeechURLRecognitionRequest(url: audioURL)
                request.shouldReportPartialResults = false

                // Prefer on-device recognition when the device supports it
                if recognizer.supportsOnDeviceRecognition {
                    request.requiresOnDeviceRecognition = true
                }

                var isCompleted = false
                let task = recognizer.recognitionTask(with: request) { result, error in
                    if isCompleted { return }

                    if let error = error {
                        isCompleted = true
                        continuation.resume(throwing: error)
                        return
                    }

                    if let result = result, result.isFinal {
                        isCompleted = true
                        continuation.resume(returning: result.bestTranscription.formattedString)
                    }
                }

                // 10-second safety timeout
                DispatchQueue.main.asyncAfter(deadline: .now() + 10.0) {
                    if !isCompleted {
                        isCompleted = true
                        task.cancel()
                        continuation.resume(throwing: NSError(
                            domain: "AppleSpeechTranscriber", code: -3,
                            userInfo: [NSLocalizedDescriptionKey: "Speech recognition timed out."]))
                    }
                }
            }
        }
    }
}

// ─── Whisper Transcriber (Placeholder — SPM not linked) ──────────────────────
/// This class acts as a placeholder for a future whisper.cpp integration.
/// When whisper.cpp SPM is properly linked, replace the body with the real
/// C-API calls. For now it falls back to AppleSpeechTranscriber.
public final class WhisperTranscriber: SpeechTranscriber {
    private let modelPath: String
    private let fallback: AppleSpeechTranscriber

    public init(modelPath: String) {
        self.modelPath = modelPath
        self.fallback = AppleSpeechTranscriber()
    }

    public func transcribe(audioURL: URL) async throws -> String {
        // TODO: Replace with direct whisper.cpp C-API calls once the
        // whisper.spm or custom xcframework is linked to the target.
        // For now, delegate to Apple's on-device speech recognizer.
        print("[WhisperTranscriber] whisper.cpp not linked — falling back to SFSpeechRecognizer.")
        return try await fallback.transcribe(audioURL: audioURL)
    }
}
