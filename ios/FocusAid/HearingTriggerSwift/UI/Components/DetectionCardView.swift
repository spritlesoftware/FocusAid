import SwiftUI

public struct DetectionCardView: View {
    let item: DetectionRecord

    public init(item: DetectionRecord) {
        self.item = item
    }

    private var formattedTime: String {
        let formatter = DateFormatter()
        formatter.timeStyle = .medium
        return formatter.string(from: item.timestamp)
    }

    private var confidencePct: Int {
        return Int(round(item.score * 100))
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 10) {

            // ── Row 1: Keyword + confidence badge ────────────────────
            HStack(alignment: .center) {
                Text("\"\(item.keyword)\"")
                    .font(.googleSans(size: 17, weight: .bold))
                    .foregroundColor(.white)

                Spacer()

                // Pill badge
                Text(item.confirmed ? "confirmed" : "low confidence")
                    .font(.googleSans(size: 11, weight: .bold))
                    .foregroundColor(item.confirmed ? AppColors.cyan : AppColors.cyanSoft)
                    .padding(.horizontal, 11)
                    .padding(.vertical, 4)
                    .background(
                        Capsule()
                            .fill(item.confirmed ? AppColors.cyanGlow : AppColors.primaryBg)
                    )
                    .overlay(
                        Capsule()
                            .stroke(
                                item.confirmed ? AppColors.cyanBorder : AppColors.blue.opacity(0.35),
                                lineWidth: 1
                            )
                    )
            }

            // ── Row 2: Time · confidence% + scene badge ───────────────
            HStack {
                Text("\(formattedTime) · \(confidencePct)%")
                    .font(.googleSans(size: 12))
                    .foregroundColor(AppColors.grayThumb)

                Spacer()

                if let place = item.placeType, place != "Unknown" {
                    HStack(spacing: 4) {
                        Image(systemName: getPlaceIconName(place))
                            .font(.googleSans(size: 11))
                            .foregroundColor(AppColors.cyan)
                        Text(place)
                            .font(.googleSans(size: 11, weight: .semibold))
                            .foregroundColor(AppColors.cyan)
                    }
                    .padding(.horizontal, 9)
                    .padding(.vertical, 3)
                    .background(Capsule().fill(AppColors.cyanGlow))
                    .overlay(Capsule().stroke(AppColors.cyanBorder, lineWidth: 0.8))
                }
            }

            // ── Row 3: Transcription ───────────────────────────────────
            Group {
                if item.transcript == nil {
                    Text("Transcribing…")
                        .font(.googleSansItalic(size: 13))
                        .foregroundColor(AppColors.grayThumb.opacity(0.6))
                } else if item.transcript == "" {
                    Text("No speech detected")
                        .font(.googleSansItalic(size: 13))
                        .foregroundColor(AppColors.grayThumb)
                } else if let txt = item.transcript {
                    Text("\"\(txt)\"")
                        .font(.googleSansItalic(size: 14))
                        .foregroundColor(AppColors.tertiary)
                }
            }
        }
        .padding(16)
        // Glass card surface
        .background(
            RoundedRectangle(cornerRadius: 14)
                .fill(AppColors.cardFill)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(AppColors.cardBorder, lineWidth: 1)
        )
        .shadow(color: AppColors.cyan.opacity(0.06), radius: 10, x: 0, y: 3)
    }

    private func getPlaceIconName(_ place: String) -> String {
        switch place {
        case "Office":       return "briefcase"
        case "School":       return "graduationcap"
        case "Theatre":      return "film"
        case "Mall":         return "cart"
        case "Hall":         return "house"
        case "Public Space": return "person.3"
        case "Outdoors":     return "sun.max"
        case "Nature":       return "leaf"
        case "Vehicle":      return "car"
        case "Factory":      return "hammer"
        case "Restaurant":   return "fork.knife"
        default:             return "questionmark.circle"
        }
    }
}
