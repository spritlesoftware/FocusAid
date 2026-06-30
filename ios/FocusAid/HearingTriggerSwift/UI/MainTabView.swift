import SwiftUI

public struct MainTabView: View {
    @State private var selectedTab: Int = 0

    public init() {}

    public var body: some View {
        ZStack(alignment: .bottom) {
            // Full-screen gradient lives here, behind all tabs
            AppColors.backgroundGradient
                .ignoresSafeArea()

            Group {
                switch selectedTab {
                case 0:
                    NavigationStack { HomeView(selectedTab: $selectedTab) }
                case 1:
                    NavigationStack { HistoryView() }
                case 2:
                    NavigationStack { SettingsView() }
                default:
                    EmptyView()
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            // ── Premium floating tab bar ────────────────────────────────
            customTabBar
        }
        .ignoresSafeArea(.keyboard, edges: .bottom)
    }

    private var customTabBar: some View {
        HStack {
            Spacer()
            tabItem(index: 0, activeIcon: "mic.fill",      inactiveIcon: "mic",       label: "Listen")
            Spacer()
            tabItem(index: 1, activeIcon: "clock.fill",    inactiveIcon: "clock",     label: "History")
            Spacer()
            tabItem(index: 2, activeIcon: "gearshape.fill",inactiveIcon: "gearshape", label: "Settings")
            Spacer()
        }
        .frame(height: 68)
        .background(
            RoundedRectangle(cornerRadius: 22)
                // Deep near-black navy glass — sits flush against gradient bottom
                .fill(Color(hex: "010A18").opacity(0.92))
                .background(
                    RoundedRectangle(cornerRadius: 22)
                        .fill(.ultraThinMaterial)
                )
                .clipShape(RoundedRectangle(cornerRadius: 22))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 22)
                .stroke(
                    LinearGradient(
                        gradient: Gradient(colors: [
                            AppColors.cyan.opacity(0.30),
                            AppColors.cyan.opacity(0.06)
                        ]),
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    lineWidth: 1
                )
        )
        .padding(.horizontal, 20)
        .padding(.bottom, 24)
        .shadow(color: AppColors.cyan.opacity(0.10), radius: 16, x: 0, y: -4)
        .shadow(color: Color.black.opacity(0.35), radius: 20, x: 0, y: 8)
    }

    private func tabItem(index: Int, activeIcon: String, inactiveIcon: String, label: String) -> some View {
        let isActive = selectedTab == index
        return Button(action: {
            guard selectedTab != index else { return }
            let generator = UIImpactFeedbackGenerator(style: .light)
            generator.impactOccurred()
            selectedTab = index
        }) {
            VStack(spacing: 4) {
                ZStack {
                    if isActive {
                        // Cyan glow spot behind active icon
                        Circle()
                            .fill(AppColors.cyan.opacity(0.15))
                            .frame(width: 36, height: 36)
                    }
                    Image(systemName: isActive ? activeIcon : inactiveIcon)
                        .font(.googleSans(size: 20, weight: isActive ? .semibold : .regular))
                        .foregroundColor(isActive ? AppColors.cyan : AppColors.grayThumb)
                }

                Text(label)
                    .font(.googleSans(size: 10, weight: .bold))
                    .foregroundColor(isActive ? AppColors.cyan : AppColors.grayThumb)
                    .tracking(0.5)
            }
            .frame(width: 80, height: 52)
        }
        .buttonStyle(PlainButtonStyle())
    }
}
