import SwiftUI
import SwiftData

public struct HomeView: View {
    @Binding var selectedTab: Int
    @Bindable var manager = HearingManager.shared

    @Query(sort: \DetectionRecord.timestamp, order: .reverse)
    private var detections: [DetectionRecord]

    public init(selectedTab: Binding<Int>) {
        self._selectedTab = selectedTab
    }

    private var activeKeywordsString: String {
        manager.activeKeywords.map { "\"\($0)\"" }.joined(separator: ", ")
    }

    private var recentDetections: [DetectionRecord] {
        Array(detections.prefix(3))
    }

    /// Returns the asset catalog image name for the current acoustic scene.
    private var sceneImageName: String? {
        switch manager.currentScene {
        case "Office":       return "scene_office"
        case "School":       return "scene_school"
        case "Theatre":      return "scene_theatre"
        case "Mall":         return "scene_mall"
        case "Hall":         return "scene_hall"
        case "Public Space": return "scene_public_space"
        case "Outdoors":     return "scene_outdoors"
        case "Nature":       return "scene_nature"
        case "Vehicle":      return "scene_vehicle"
        case "Factory":      return "scene_factory"
        case "Restaurant":   return "scene_restaurant"
        default:             return nil
        }
    }

    public var body: some View {
        ZStack {
            // ── Base dark-blue background ──────────────────────────────
            AppColors.backgroundGradient
                .ignoresSafeArea()


            // ── Subtle radial glow behind mic ─────────────────────────
            RadialGradient(
                gradient: Gradient(colors: [
                    AppColors.cyan.opacity(0.08),
                    Color.clear
                ]),
                center: .init(x: 0.5, y: 0.22),
                startRadius: 0,
                endRadius: 320
            )
            .ignoresSafeArea()

            ScrollView(showsIndicators: false) {
                VStack(spacing: 0) {
                    topCardView
                        .frame(maxWidth: .infinity)
                        .background {
                            // Scene image only behind top card (mic + status + stop button)
                            GeometryReader { geo in
                                if manager.setupPhase == "listening",
                                   let imgName = sceneImageName,
                                   let uiImg = UIImage(named: imgName) {
                                    ZStack {
                                        Image(uiImage: uiImg)
                                            .resizable()
                                            .scaledToFill()
                                            .frame(width: geo.size.width, height: geo.size.height)
                                            .clipped()
                                            .opacity(0.35)
                                            .id(imgName)
                                            .animation(.easeInOut(duration: 0.6), value: imgName)

                                        // Dark overlay for readability
                                        LinearGradient(
                                            gradient: Gradient(stops: [
                                                .init(color: Color(hex: "020D1F").opacity(0.45), location: 0),
                                                .init(color: Color(hex: "020D1F").opacity(0.20), location: 0.5),
                                                .init(color: Color(hex: "020D1F").opacity(0.55), location: 1)
                                            ]),
                                            startPoint: .top,
                                            endPoint: .bottom
                                        )
                                    }
                                }
                            }
                        }
                        .clipped()

                    // ── Recent Detections Divider ──────────────────────
                    HStack(spacing: 12) {
                        Rectangle()
                            .fill(AppColors.grayBorder)
                            .frame(height: 1)

                        Text("Recent Detections")
                            .font(.googleSans(size: 11, weight: .bold))
                            .foregroundColor(AppColors.grayThumb)
                            .tracking(1.8)
                            .textCase(.uppercase)
                            .fixedSize()
                            .frame(maxWidth: .infinity, alignment: .center)

                        Rectangle()
                            .fill(AppColors.grayBorder)
                            .frame(height: 1)
                    }
                    .padding(.horizontal, 20)
                    .padding(.vertical, 24)

                    // ── Detections list ────────────────────────────────
                    VStack(spacing: 12) {
                        ForEach(recentDetections) { d in
                            DetectionCardView(item: d)
                        }

                        if recentDetections.isEmpty {
                            VStack(spacing: 8) {
                                Image(systemName: "waveform")
                                    .font(.googleSans(size: 28))
                                    .foregroundColor(AppColors.cyan.opacity(0.35))

                                Text(manager.setupPhase == "listening"
                                     ? "Waiting to hear \(activeKeywordsString)…"
                                     : "No detections yet. Start listening above.")
                                    .font(.googleSansItalic(size: 14))
                                    .foregroundColor(AppColors.grayThumb)
                                    .multilineTextAlignment(.center)
                            }
                            .padding(.vertical, 40)
                            .padding(.horizontal, 40)
                        }
                    }
                    .padding(.horizontal, 16)

                    // ── View full history link ─────────────────────────
                    if detections.count > 3 {
                        Button(action: { selectedTab = 1 }) {
                            HStack(spacing: 6) {
                                Text("View full history")
                                    .font(.googleSans(size: 14, weight: .semibold))
                                    .foregroundColor(AppColors.cyan)
                                Image(systemName: "chevron.right")
                                    .font(.googleSans(size: 11, weight: .bold))
                                    .foregroundColor(AppColors.cyan.opacity(0.7))
                            }
                            .padding(.vertical, 16)
                        }
                    }

                    Spacer()
                }
            }
            // Tab bar height (68) + bottom padding (24) = 92pt above safe area bottom.
            // Shrinking the scroll view stops content from scrolling behind the tab bar.
            .padding(.bottom, 92)
        }
        .navigationTitle("Listen")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarColorScheme(.dark, for: .navigationBar)
    }

    // ── Top card: mic circle + status + button ─────────────────────────────
    private var topCardView: some View {
        VStack(spacing: 0) {

            // Mic pulse + circle
            ZStack {
                if manager.setupPhase == "listening" {
                    PulseRingView(delay: 0.0, active: true)
                    PulseRingView(delay: 0.8, active: true)
                    PulseRingView(delay: 1.6, active: true)
                }

                Button(action: { toggleListening() }) {
                    ZStack {
                        // Outer glow ring
                        Circle()
                            .stroke(
                                manager.setupPhase == "listening"
                                    ? AppColors.cyan.opacity(0.4)
                                    : AppColors.cardBorder,
                                lineWidth: 2
                            )
                            .frame(width: 126, height: 126)

                        // Glass fill
                        Circle()
                            .fill(AppColors.cardFill)
                            .frame(width: 120, height: 120)

                        if manager.setupPhase == "setup" {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: AppColors.cyan))
                        } else {
                            Image(systemName: manager.setupPhase == "listening" ? "mic.fill" : "mic")
                                .font(.googleSans(size: 42))
                                .foregroundColor(
                                    manager.setupPhase == "listening"
                                        ? AppColors.cyan
                                        : AppColors.grayThumb
                                )
                        }
                    }
                }
                .disabled(manager.setupPhase == "setup")
                .buttonStyle(PlainButtonStyle())
            }
            .frame(height: 200)
            .padding(.top, 28)

            // Status labels
            VStack(spacing: 10) {
                switch manager.setupPhase {
                case "setup":
                    statusLabel("Preparing Models", color: AppColors.cyan)
                    statusBody(manager.setupProgress.isEmpty ? "Checking files…" : manager.setupProgress)

                case "ready":
                    statusLabel("Mic Inactive", color: AppColors.grayThumb)
                    statusBody("Tap mic or button to start")

                case "listening":
                    statusLabel("Active Listening", color: AppColors.cyan)
                    (Text("Listening for ")
                        .font(.googleSans(size: 18, weight: .bold))
                        .foregroundColor(.white)
                    + Text(activeKeywordsString)
                        .font(.googleSansItalic(size: 18))
                        .foregroundColor(AppColors.cyan))

                    // Acoustic scene pill
                    HStack(spacing: 6) {
                        Image(systemName: getPlaceIconName(manager.currentScene))
                            .font(.googleSans(size: 13))
                            .foregroundColor(AppColors.cyan)
                        Text(manager.currentScene == "Unknown"
                             ? "Analyzing environment…"
                             : manager.currentScene)
                            .font(.googleSans(size: 12, weight: .semibold))
                            .foregroundColor(AppColors.cyan)
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 6)
                    .background(AppColors.cyanGlow)
                    .overlay(
                        Capsule().stroke(AppColors.cyanBorder, lineWidth: 1)
                    )
                    .clipShape(Capsule())
                    .padding(.top, 4)

                case "error":
                    statusLabel("Setup Error", color: .red)
                    statusBody(manager.setupProgress)

                default:
                    EmptyView()
                }
            }
            .padding(.horizontal, 32)
            .padding(.bottom, 24)

            // Start / Stop button
            if manager.setupPhase != "setup" {
                Button(action: { toggleListening() }) {
                    HStack(spacing: 10) {
                        Image(systemName: manager.setupPhase == "listening" ? "square.fill" : "play.fill")
                            .font(.googleSans(size: 13, weight: .bold))
                        Text(manager.setupPhase == "listening" ? "Stop Listening" : "Start Listening")
                            .font(.googleSans(size: 16, weight: .bold))
                    }
                    .foregroundColor(manager.setupPhase == "listening" ? .white : AppColors.bgDeep)
                    .padding(.vertical, 15)
                    .padding(.horizontal, 40)
                    .background(
                        Group {
                            if manager.setupPhase == "listening" {
                                // Muted blue when active
                                RoundedRectangle(cornerRadius: 28)
                                    .fill(AppColors.blue)
                            } else {
                                // Glowing cyan when idle
                                RoundedRectangle(cornerRadius: 28)
                                    .fill(AppColors.cyan)
                            }
                        }
                    )
                    .shadow(
                        color: manager.setupPhase == "listening"
                            ? AppColors.blue.opacity(0.4)
                            : AppColors.cyan.opacity(0.45),
                        radius: 14, x: 0, y: 6
                    )
                }
                .padding(.bottom, 16)
            }
        }
    }

    // ── Helpers ─────────────────────────────────────────────────────────────
    @ViewBuilder
    private func statusLabel(_ text: String, color: Color) -> some View {
        Text(text)
            .font(.googleSans(size: 11, weight: .black))
            .foregroundColor(color)
            .tracking(1.8)
            .textCase(.uppercase)
    }

    @ViewBuilder
    private func statusBody(_ text: String) -> some View {
        Text(text)
            .font(.googleSans(size: 17, weight: .bold))
            .foregroundColor(.white)
            .multilineTextAlignment(.center)
            .frame(minHeight: 44)
    }

    private func toggleListening() {
        Task {
            if manager.setupPhase == "listening" {
                await manager.stopListening()
            } else if manager.setupPhase == "ready" {
                await manager.startListening()
            }
        }
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
