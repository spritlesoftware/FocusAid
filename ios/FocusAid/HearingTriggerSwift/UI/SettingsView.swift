import SwiftUI
import SwiftData

public struct SettingsView: View {
    @Environment(\.modelContext) private var modelContext
    @Bindable var manager = HearingManager.shared

    @State private var customInput: String = ""
    @State private var showingClearAlert = false

    public init() {}

    private var presetChips: [String] {
        var combined = ["priya", "aarav", "grandma", "mom", "dad", "help"]
        for kw in manager.settings.keywords where !combined.contains(kw) {
            combined.append(kw)
        }
        return combined
    }

    public var body: some View {
        @Bindable var settings = manager.settings
        ZStack {
            AppColors.backgroundGradient
                .ignoresSafeArea()

            ScrollView(showsIndicators: false) {
                VStack(spacing: 14) {

                    // ── 1. Trigger Word ─────────────────────────────────
                    settingsCard {
                        cardHeader(icon: "key.fill", title: "Trigger Word")

                        Text("Choose a word that Focus Aid will prioritize for alerts.")
                            .font(.googleSans(size: 14))
                            .foregroundColor(AppColors.grayThumb)

                        // Keyword chips
                        FlowLayout(spacing: 8) {
                            ForEach(presetChips, id: \.self) { word in
                                let isActive = manager.settings.keywords.contains(word)
                                Button(action: { toggleKeyword(word) }) {
                                    Text(word.prefix(1).uppercased() + word.dropFirst())
                                        .font(.googleSans(size: 13, weight: .semibold))
                                        .foregroundColor(isActive ? AppColors.bgDeep : AppColors.grayThumb)
                                        .padding(.horizontal, 16)
                                        .padding(.vertical, 8)
                                        .background(
                                            Capsule()
                                                .fill(isActive ? AppColors.cyan : AppColors.cardFill)
                                        )
                                        .overlay(
                                            Capsule()
                                                .stroke(isActive ? AppColors.cyan : AppColors.cardBorder, lineWidth: 1)
                                        )
                                }
                            }
                        }

                        sectionLabel("Custom Trigger Word")

                        HStack(spacing: 8) {
                            TextField("Type a word…", text: $customInput)
                                .font(.googleSans(size: 15))
                                .foregroundColor(.white)
                                .padding(.horizontal, 14)
                                .frame(height: 46)
                                .background(
                                    RoundedRectangle(cornerRadius: 10)
                                        .fill(AppColors.cardFill)
                                )
                                .overlay(
                                    RoundedRectangle(cornerRadius: 10)
                                        .stroke(AppColors.cardBorder, lineWidth: 1)
                                )
                                .autocapitalization(.none)
                                .disableAutocorrection(true)

                            Button(action: { addCustomKeyword() }) {
                                Text("Add")
                                    .font(.googleSans(size: 14, weight: .bold))
                                    .foregroundColor(AppColors.bgDeep)
                                    .frame(height: 46)
                                    .padding(.horizontal, 20)
                                    .background(AppColors.cyan)
                                    .clipShape(RoundedRectangle(cornerRadius: 10))
                                    .shadow(color: AppColors.cyan.opacity(0.35), radius: 8, x: 0, y: 3)
                            }
                        }
                    }

                    // ── 2. Sensitivity Threshold ────────────────────────
                    settingsCard {
                        cardHeader(icon: "speaker.wave.2.fill", title: "Sensitivity Threshold")

                        Text("Adjust how sensitive the microphone is to background noise.")
                            .font(.googleSans(size: 14))
                            .foregroundColor(AppColors.grayThumb)

                        HStack {
                            Text("Low")
                                .font(.googleSans(size: 12, weight: .semibold))
                                .foregroundColor(AppColors.grayThumb)
                            Spacer()
                            Text(String(format: "%.1f", manager.settings.threshold))
                                .font(.googleSans(size: 18, weight: .bold))
                                .foregroundColor(AppColors.cyan)
                            Spacer()
                            Text("High")
                                .font(.googleSans(size: 12, weight: .semibold))
                                .foregroundColor(AppColors.grayThumb)
                        }
                        .padding(.top, 4)

                        Slider(value: Binding(
                            get: { manager.settings.threshold },
                            set: { manager.updateThreshold(value: round($0 * 10) / 10) }
                        ), in: 0.3...0.7, step: 0.1)
                        .tint(AppColors.cyan)

                        HStack {
                            Text("0.3").font(.googleSans(size: 11)).foregroundColor(AppColors.grayThumb)
                            Spacer()
                            Text("0.7").font(.googleSans(size: 11)).foregroundColor(AppColors.grayThumb)
                        }
                        .padding(.top, -4)
                    }

                    // ── 3. Cooldown Period ──────────────────────────────
                    settingsCard {
                        cardHeader(icon: "clock.fill", title: "Cooldown Period")

                        Text("Wait time between repeat alerts for the same word.")
                            .font(.googleSans(size: 14))
                            .foregroundColor(AppColors.grayThumb)

                        HStack {
                            Text("Min")
                                .font(.googleSans(size: 12, weight: .semibold))
                                .foregroundColor(AppColors.grayThumb)
                            Spacer()
                            let seconds = Int(manager.settings.cooldownMs / 1000)
                            Text("\(seconds)s")
                                .font(.googleSans(size: 18, weight: .bold))
                                .foregroundColor(AppColors.cyan)
                            Spacer()
                            Text("Max")
                                .font(.googleSans(size: 12, weight: .semibold))
                                .foregroundColor(AppColors.grayThumb)
                        }
                        .padding(.top, 4)

                        HStack(spacing: 0) {
                            Button(action: { incrementCooldown(-1) }) {
                                Image(systemName: "minus")
                                    .font(.googleSans(size: 14, weight: .bold))
                                    .foregroundColor(AppColors.cyan)
                                    .frame(maxWidth: .infinity)
                            }

                            Divider()
                                .background(AppColors.cardBorder)
                                .padding(.vertical, 8)

                            Text("\(Int(manager.settings.cooldownMs / 1000)) sec")
                                .font(.googleSans(size: 15, weight: .semibold))
                                .foregroundColor(.white)
                                .frame(maxWidth: .infinity)

                            Divider()
                                .background(AppColors.cardBorder)
                                .padding(.vertical, 8)

                            Button(action: { incrementCooldown(1) }) {
                                Image(systemName: "plus")
                                    .font(.googleSans(size: 14, weight: .bold))
                                    .foregroundColor(AppColors.cyan)
                                    .frame(maxWidth: .infinity)
                            }
                        }
                        .frame(height: 48)
                        .frame(maxWidth: .infinity)
                        .background(RoundedRectangle(cornerRadius: 10).fill(AppColors.cardFill))
                        .overlay(RoundedRectangle(cornerRadius: 10).stroke(AppColors.cardBorder, lineWidth: 1))

                        HStack {
                            Text("0.5").font(.googleSans(size: 11)).foregroundColor(AppColors.grayThumb)
                            Spacer()
                            Text("Recommended: 38s")
                                .font(.googleSansItalic(size: 11))
                                .foregroundColor(AppColors.grayThumb)
                            Spacer()
                            Text("120").font(.googleSans(size: 11)).foregroundColor(AppColors.grayThumb)
                        }
                        .padding(.top, -4)
                    }

                    // ── 4. Transcribe with Whisper ──────────────────────
                    settingsCard {
                        HStack {
                            cardHeaderContent(icon: "bubble.left.and.bubble.right.fill",
                                              title: "Transcribe with Whisper")
                            Spacer()
                            Toggle("", isOn: Binding(
                                get: { manager.settings.useWhisper },
                                set: { val in
                                    manager.settings.useWhisper = val
                                    Task {
                                        await manager.warmupActiveModel()
                                        await manager.stopListening()
                                    }
                                }
                            ))
                            .labelsHidden()
                            .tint(AppColors.cyan)
                        }

                        Text("AI-powered transcription for higher accuracy.")
                            .font(.googleSans(size: 14))
                            .foregroundColor(AppColors.grayThumb)

                        if manager.settings.useWhisper {
                            VStack(alignment: .leading, spacing: 8) {
                                Divider().background(AppColors.cardBorder).padding(.vertical, 6)

                                Text("Whisper Model Size")
                                    .font(.googleSans(size: 14, weight: .bold))
                                    .foregroundColor(.white)

                                Text("Larger models offer higher accuracy but use more memory and disk space.")
                                    .font(.googleSans(size: 13))
                                    .foregroundColor(AppColors.grayThumb)
                                    .lineSpacing(2)

                                // Model option pill
                                Button(action: {}) {
                                    VStack(spacing: 3) {
                                        Text("Medium (Quantized)")
                                            .font(.googleSans(size: 14, weight: .bold))
                                            .foregroundColor(AppColors.bgDeep)
                                        Text("510 MB · Bundled Offline")
                                            .font(.googleSans(size: 12))
                                            .foregroundColor(AppColors.bgDeep.opacity(0.75))
                                    }
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 12)
                                    .background(AppColors.cyan)
                                    .clipShape(RoundedRectangle(cornerRadius: 12))
                                    .shadow(color: AppColors.cyan.opacity(0.30), radius: 8, x: 0, y: 3)
                                }
                                .disabled(true)
                            }
                        }
                    }

                    // ── 5. Debug Logs ───────────────────────────────────
                    settingsCard {
                        HStack {
                            cardHeaderContent(icon: "list.bullet.rectangle", title: "Enable Debug Logs")
                            Spacer()
                            Toggle("", isOn: $settings.enableDebugLogs)
                                .labelsHidden()
                                .tint(AppColors.cyan)
                        }

                        Text("Print verification and transcription logs for local debugging.")
                            .font(.googleSans(size: 14))
                            .foregroundColor(AppColors.grayThumb)
                    }

                    // ── 6. Danger Zone ──────────────────────────────────
                    Divider()
                        .background(AppColors.cardBorder)
                        .padding(.vertical, 8)

                    Button(action: { showingClearAlert = true }) {
                        HStack(spacing: 8) {
                            Image(systemName: "trash")
                                .font(.googleSans(size: 16))
                            Text("Clear All History & Settings")
                                .font(.googleSans(size: 15, weight: .bold))
                        }
                        .foregroundColor(Color(hex: "F87171"))
                        .frame(maxWidth: .infinity)
                        .frame(height: 50)
                        .background(
                            RoundedRectangle(cornerRadius: 12)
                                .fill(Color(hex: "F87171").opacity(0.08))
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(Color(hex: "F87171").opacity(0.35), lineWidth: 1)
                        )
                    }
                }
                .padding(16)
            }
            // Tab bar height (68) + bottom padding (24) = 92pt above safe area bottom.
            // Shrinking the scroll view by that amount stops content from scrolling behind the tab bar.
            .padding(.bottom, 92)
        }
        .navigationTitle("Settings")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .alert(isPresented: $showingClearAlert) {
            Alert(
                title: Text("Clear All History & Settings"),
                message: Text("Delete all detection history and restore settings to defaults?"),
                primaryButton: .destructive(Text("Clear")) { clearAllData() },
                secondaryButton: .cancel()
            )
        }
    }

    // ── Reusable card container ─────────────────────────────────────────────
    @ViewBuilder
    private func settingsCard<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            content()
        }
        .padding(18)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(AppColors.cardFill)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(AppColors.cardBorder, lineWidth: 1)
        )
        .shadow(color: Color.black.opacity(0.20), radius: 10, x: 0, y: 3)
    }

    // ── Card header row (icon + title) ──────────────────────────────────────
    @ViewBuilder
    private func cardHeader(icon: String, title: String) -> some View {
        HStack(spacing: 10) {
            cardHeaderContent(icon: icon, title: title)
        }
    }

    @ViewBuilder
    private func cardHeaderContent(icon: String, title: String) -> some View {
        ZStack {
            Circle()
                .fill(AppColors.cyanGlow)
                .frame(width: 32, height: 32)
            Image(systemName: icon)
                .font(.googleSans(size: 13, weight: .semibold))
                .foregroundColor(AppColors.cyan)
        }
        Text(title)
            .font(.googleSans(size: 15, weight: .bold))
            .foregroundColor(.white)
    }

    @ViewBuilder
    private func sectionLabel(_ text: String) -> some View {
        Text(text)
            .font(.googleSans(size: 10, weight: .bold))
            .foregroundColor(AppColors.grayThumb)
            .tracking(1.5)
            .textCase(.uppercase)
            .padding(.top, 4)
    }

    // ── Logic ───────────────────────────────────────────────────────────────
    private func toggleKeyword(_ word: String) {
        var kws = manager.settings.keywords
        if kws.contains(word) { kws.removeAll { $0 == word } }
        else { kws.append(word) }
        guard !kws.isEmpty else { return }
        manager.settings.keywords = kws
        manager.activeKeywords = kws
        Task { await manager.stopListening() }
    }

    private func addCustomKeyword() {
        let val = customInput.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        guard !val.isEmpty, !manager.settings.keywords.contains(val) else { return }
        manager.settings.keywords.append(val)
        manager.activeKeywords = manager.settings.keywords
        customInput = ""
        Task { await manager.stopListening() }
    }

    private func incrementCooldown(_ delta: Int) {
        let newSec = max(1, Int(manager.settings.cooldownMs / 1000) + delta)
        manager.updateCooldown(seconds: newSec)
    }

    private func clearAllData() {
        do {
            try modelContext.delete(model: DetectionRecord.self)
            try modelContext.save()
        } catch {
            print("[SettingsView] Failed to clear: \(error)")
        }
        manager.settings.keywords    = ["help"]
        manager.settings.threshold   = 0.5
        manager.settings.cooldownMs  = 6000
        manager.settings.useWhisper  = true
        manager.settings.whisperModel = "medium.en-q5_0"
        manager.settings.enableDebugLogs = false
        manager.activeKeywords = ["help"]
        Task {
            await manager.warmupActiveModel()
            await manager.stopListening()
        }
    }
}

// ─── FlowLayout for chip wrapping ──────────────────────────────────────────────
struct FlowLayout: Layout {
    var spacing: CGFloat

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let sizes = subviews.map { $0.sizeThatFits(.unspecified) }
        let width = proposal.width ?? 0
        var x: CGFloat = 0, y: CGFloat = 0, lineH: CGFloat = 0, maxW: CGFloat = 0

        for size in sizes {
            if x + size.width > width {
                maxW = max(maxW, x)
                x = 0
                y += lineH + spacing
                lineH = 0
            }
            x += size.width + spacing
            lineH = max(lineH, size.height)
        }
        return CGSize(width: max(maxW, x), height: y + lineH)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let sizes = subviews.map { $0.sizeThatFits(.unspecified) }
        var x: CGFloat = bounds.minX, y: CGFloat = bounds.minY, lineH: CGFloat = 0

        for (i, subview) in subviews.enumerated() {
            let size = sizes[i]
            if x + size.width > bounds.maxX { x = bounds.minX; y += lineH + spacing; lineH = 0 }
            subview.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
            x += size.width + spacing
            lineH = max(lineH, size.height)
        }
    }
}
