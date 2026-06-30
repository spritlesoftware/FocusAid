import SwiftUI
import AVFoundation

public struct PermissionGateView<Content: View>: View {
    let content: Content

    @State private var recordPermission: AVAudioSession.RecordPermission = AVAudioSession.sharedInstance().recordPermission

    public init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    public var body: some View {
        ZStack {
            if recordPermission == .granted {
                content
            } else {
                permissionPromptView
            }
        }
        .onAppear { checkPermission() }
        .onReceive(NotificationCenter.default.publisher(
            for: UIApplication.willEnterForegroundNotification)) { _ in
            checkPermission()
        }
    }

    private func checkPermission() {
        recordPermission = AVAudioSession.sharedInstance().recordPermission
    }

    private func requestPermission() {
        AVAudioSession.sharedInstance().requestRecordPermission { _ in
            DispatchQueue.main.async { checkPermission() }
        }
    }

    private func openSettings() {
        if let url = URL(string: UIApplication.openSettingsURLString) {
            UIApplication.shared.open(url)
        }
    }

    // ── Permission prompt UI ────────────────────────────────────────────────
    private var permissionPromptView: some View {
        ZStack {
            // Background
            AppColors.backgroundGradient
                .ignoresSafeArea()

            // Radial glow behind the mic icon
            RadialGradient(
                gradient: Gradient(colors: [
                    AppColors.cyan.opacity(0.12),
                    Color.clear
                ]),
                center: .center,
                startRadius: 0,
                endRadius: 280
            )
            .ignoresSafeArea()

            VStack(spacing: 0) {

                // ── Brand row ──────────────────────────────────────────
                HStack(spacing: 10) {
                    Image(systemName: "waveform.circle.fill")
                        .font(.googleSans(size: 26))
                        .foregroundColor(AppColors.cyan)
                    Text("Focus Aid")
                        .font(.googleSans(size: 22, weight: .bold))
                        .foregroundColor(.white)
                }
                .padding(.top, 48)

                Spacer()

                // ── Center content ─────────────────────────────────────
                VStack(spacing: 28) {

                    // Mic icon with multi-ring glow
                    ZStack {
                        // Outer glow rings
                        Circle()
                            .fill(AppColors.cyan.opacity(0.05))
                            .frame(width: 170, height: 170)
                        Circle()
                            .fill(AppColors.cyan.opacity(0.09))
                            .frame(width: 130, height: 130)
                        // Glass pill
                        Circle()
                            .fill(AppColors.cardFill)
                            .frame(width: 96, height: 96)
                            .overlay(
                                Circle()
                                    .stroke(AppColors.cyanBorder, lineWidth: 1.5)
                            )
                        Image(systemName: "mic.fill")
                            .font(.googleSans(size: 38))
                            .foregroundColor(AppColors.cyan)
                    }
                    .shadow(color: AppColors.cyan.opacity(0.20), radius: 24, x: 0, y: 8)

                    VStack(spacing: 12) {
                        Text("Microphone Access Required")
                            .font(.googleSans(size: 24, weight: .heavy))
                            .foregroundColor(.white)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 16)

                        Text("This app listens locally for your trigger word. Audio is never sent to any server.")
                            .font(.googleSans(size: 15))
                            .foregroundColor(AppColors.textSecondary)
                            .lineSpacing(4)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 36)

                        if recordPermission == .denied {
                            Text("Microphone access is blocked. Please enable it in your device settings to continue.")
                                .font(.googleSans(size: 13, weight: .semibold))
                                .foregroundColor(Color(hex: "F87171"))
                                .multilineTextAlignment(.center)
                                .padding(.horizontal, 28)
                                .padding(.top, 4)
                        }
                    }
                }

                Spacer()

                // ── CTA button ─────────────────────────────────────────
                Button(action: {
                    recordPermission == .denied ? openSettings() : requestPermission()
                }) {
                    Text(recordPermission == .denied ? "Open Device Settings" : "Grant Microphone Access")
                        .font(.googleSans(size: 16, weight: .bold))
                        .foregroundColor(AppColors.bgDeep)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .background(AppColors.cyan)
                        .clipShape(RoundedRectangle(cornerRadius: 14))
                        .shadow(color: AppColors.cyan.opacity(0.45), radius: 16, x: 0, y: 6)
                }
                .padding(.horizontal, 28)
                .padding(.bottom, 48)
            }
        }
    }
}
