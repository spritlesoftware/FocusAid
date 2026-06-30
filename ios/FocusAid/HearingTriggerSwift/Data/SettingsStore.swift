import Foundation
import Observation

@Observable
public class SettingsStore {
    private let SETTINGS_KEY = "@hearing_trigger:settings"
    
    public var keywords: [String] {
        didSet { save() }
    }
    
    public var threshold: Double {
        didSet { save() }
    }
    
    public var cooldownMs: Int {
        didSet { save() }
    }
    
    public var useWhisper: Bool {
        didSet { save() }
    }
    
    public var whisperModel: String {
        didSet { save() }
    }
    
    public var enableDebugLogs: Bool {
        didSet { save() }
    }
    
    public init() {
        // Load default values first
        self.keywords = ["priya", "aarav", "grandma", "mom", "dad", "help"]
        self.threshold = 0.5
        self.cooldownMs = 6000
        self.useWhisper = true
        self.whisperModel = "medium.en-q5_0"
        self.enableDebugLogs = false
        
        // Attempt to load from UserDefaults
        if let data = UserDefaults.standard.data(forKey: SETTINGS_KEY) {
            do {
                if let dict = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    if let kws = dict["keywords"] as? [String] {
                        self.keywords = kws
                    } else if let kw = dict["keyword"] as? String {
                        self.keywords = [kw]
                    }
                    if let t = dict["threshold"] as? Double {
                        self.threshold = t
                    }
                    if let c = dict["cooldownMs"] as? Int {
                        self.cooldownMs = c
                    }
                    if let w = dict["useWhisper"] as? Bool {
                        self.useWhisper = w
                    }
                    if let m = dict["whisperModel"] as? String {
                        self.whisperModel = m
                    }
                    if let d = dict["enableDebugLogs"] as? Bool {
                        self.enableDebugLogs = d
                    }
                }
            } catch {
                print("[SettingsStore] Failed to deserialize settings: \(error)")
            }
        }
    }
    
    private func save() {
        let dict: [String: Any] = [
            "keywords": keywords,
            "threshold": threshold,
            "cooldownMs": cooldownMs,
            "useWhisper": useWhisper,
            "whisperModel": whisperModel,
            "enableDebugLogs": enableDebugLogs
        ]
        do {
            let data = try JSONSerialization.data(withJSONObject: dict)
            UserDefaults.standard.set(data, forKey: SETTINGS_KEY)
        } catch {
            print("[SettingsStore] Failed to serialize settings: \(error)")
        }
    }
}
