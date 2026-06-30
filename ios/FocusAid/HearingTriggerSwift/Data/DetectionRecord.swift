import Foundation
import SwiftData

@Model
public final class DetectionRecord {
    @Attribute(.unique) public var id: String
    public var keyword: String
    public var score: Double
    public var timestamp: Date
    public var clipPath: String?
    public var transcript: String?
    public var confirmed: Bool
    public var placeType: String?
    
    public init(id: String = UUID().uuidString,
                keyword: String,
                score: Double,
                timestamp: Date = Date(),
                clipPath: String? = nil,
                transcript: String? = nil,
                confirmed: Bool = false,
                placeType: String? = nil) {
        self.id = id
        self.keyword = keyword
        self.score = score
        self.timestamp = timestamp
        self.clipPath = clipPath
        self.transcript = transcript
        self.confirmed = confirmed
        self.placeType = placeType
    }
}
