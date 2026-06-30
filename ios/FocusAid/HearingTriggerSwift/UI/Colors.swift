import SwiftUI

// ─── Hex Color Helper ──────────────────────────────────────────────────────────
extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3:
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6:
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8:
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}

// ─── Premium Dark-Blue + Cyan Design System ────────────────────────────────────
public struct AppColors {
    // Background layers — aligned with reference screenshot
    public static let bgDeep      = Color(hex: "010A18")   // near-black navy (bottom)
    public static let bgMid       = Color(hex: "031540")   // deep navy (mid)
    public static let bgShallow   = Color(hex: "0B47A8")   // royal blue (top)

    // Legacy aliases
    public static let neutral          = bgDeep
    public static let secondaryLightBg = bgMid

    // Cyan accent (primary highlight)
    public static let cyan        = Color(hex: "00D4FF")   // vivid cyan
    public static let cyanSoft    = Color(hex: "38BDF8")   // lighter sky-blue
    public static let cyanGlow    = cyan.opacity(0.18)
    public static let cyanBorder  = cyan.opacity(0.35)

    // Legacy secondary aliases → maps to cyan
    public static let secondary       = cyan
    public static let secondaryLight  = cyanSoft
    public static let secondaryBg     = cyanGlow

    // Blue accent (secondary interactive color)
    public static let blue        = Color(hex: "3B82F6")
    public static let primary     = blue
    public static let primaryBg   = blue.opacity(0.15)
    public static let primaryBorder = blue
    public static let primaryLightBg = Color(hex: "1E3A8A")

    // Card / glass surfaces
    public static let cardFill    = Color.white.opacity(0.06)    // translucent white glass
    public static let cardBorder  = Color.white.opacity(0.12)    // subtle white border
    public static let cardStroke  = cyan.opacity(0.25)           // cyan-tinted stroke

    // Legacy card alias
    public static let white       = cardFill   // was a dark slab — now glass

    // Text
    public static let textPrimary   = Color.white
    public static let textSecondary = Color(hex: "94A3B8")       // slate-400
    public static let tertiary      = Color(hex: "CBD5E1")       // slate-300

    // Dividers / tracks
    public static let grayBorder = Color.white.opacity(0.10)
    public static let grayLight  = Color(hex: "1E293B")
    public static let grayTrack  = Color(hex: "1E293B")
    public static let grayThumb  = Color(hex: "94A3B8")

    // Full-screen background gradient (top → bottom, matching reference screenshot)
    public static let backgroundGradient = LinearGradient(
        gradient: Gradient(stops: [
            .init(color: Color(hex: "0B47A8"), location: 0.0),   // vivid royal blue
            .init(color: Color(hex: "072660"), location: 0.30),  // medium navy
            .init(color: Color(hex: "031540"), location: 0.60),  // deep navy
            .init(color: Color(hex: "010A18"), location: 1.0)    // near-black
        ]),
        startPoint: .top,
        endPoint: .bottom
    )
}

// ─── Glass Card modifier ────────────────────────────────────────────────────────
struct GlassCard: ViewModifier {
    var radius: CGFloat = 16
    var useCyanBorder: Bool = false

    func body(content: Content) -> some View {
        content
            .background(
                RoundedRectangle(cornerRadius: radius)
                    .fill(AppColors.cardFill)
                    .background(
                        RoundedRectangle(cornerRadius: radius)
                            .fill(.ultraThinMaterial)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: radius))
            )
            .overlay(
                RoundedRectangle(cornerRadius: radius)
                    .stroke(
                        useCyanBorder ? AppColors.cardStroke : AppColors.cardBorder,
                        lineWidth: 1
                    )
            )
            .shadow(color: Color.black.opacity(0.30), radius: 12, x: 0, y: 4)
    }
}

extension View {
    func glassCard(radius: CGFloat = 16, cyanBorder: Bool = false) -> some View {
        modifier(GlassCard(radius: radius, useCyanBorder: cyanBorder))
    }
}
