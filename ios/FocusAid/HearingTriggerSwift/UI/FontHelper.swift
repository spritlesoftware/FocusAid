import SwiftUI
import UIKit

// ─── Google Sans font names as registered in Info.plist ──────────────────────
private enum GoogleSansName {
    static let regular  = "GoogleSans-Regular"
    static let medium   = "GoogleSans-Medium"
    static let bold     = "GoogleSans-Bold"
    static let italic   = "GoogleSans-Italic"
}

// ─── SwiftUI Font extension ───────────────────────────────────────────────────
extension Font {
    /// Returns a Google Sans font at the given size and weight.
    /// Falls back to system font if the font isn't loaded yet.
    static func googleSans(size: CGFloat, weight: Font.Weight = .regular) -> Font {
        let name = googleSansFontName(for: weight)
        return Font.custom(name, size: size)
    }

    /// Italic variant of Google Sans.
    static func googleSansItalic(size: CGFloat) -> Font {
        Font.custom(GoogleSansName.italic, size: size)
    }

    private static func googleSansFontName(for weight: Font.Weight) -> String {
        switch weight {
        case .bold, .heavy, .black:
            return GoogleSansName.bold
        case .medium, .semibold:
            return GoogleSansName.medium
        default:
            return GoogleSansName.regular
        }
    }
}

// ─── UIFont extension (for any UIKit bridging) ───────────────────────────────
extension UIFont {
    static func googleSans(size: CGFloat, weight: UIFont.Weight = .regular) -> UIFont {
        let name: String
        switch weight {
        case .bold, .heavy, .black:
            name = GoogleSansName.bold
        case .medium, .semibold:
            name = GoogleSansName.medium
        default:
            name = GoogleSansName.regular
        }
        return UIFont(name: name, size: size) ?? .systemFont(ofSize: size, weight: weight)
    }
}

// ─── Debug helper: print all loaded Google Sans variants at launch ────────────
func printGoogleSansFamilyNames() {
    for family in UIFont.familyNames.sorted() {
        if family.lowercased().contains("google") {
            for name in UIFont.fontNames(forFamilyName: family) {
                print("Loaded font: \(name)")
            }
        }
    }
}
