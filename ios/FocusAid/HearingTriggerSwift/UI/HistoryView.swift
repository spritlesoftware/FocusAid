import SwiftUI
import SwiftData

public struct HistoryView: View {
    @Environment(\.modelContext) private var modelContext

    @Query(sort: \DetectionRecord.timestamp, order: .reverse)
    private var detections: [DetectionRecord]

    @State private var showingClearAlert = false

    public init() {}

    public var body: some View {
        ZStack {
            AppColors.backgroundGradient
                .ignoresSafeArea()

            VStack(spacing: 0) {
                // ── Clear All button ──────────────────────────────────
                if !detections.isEmpty {
                    HStack {
                        Spacer()
                        Button(action: { showingClearAlert = true }) {
                            HStack(spacing: 4) {
                                Image(systemName: "trash")
                                    .font(Font.googleSans(size: 12))
                                Text("Clear All")
                                    .font(Font.googleSans(size: 13, weight: .semibold))
                            }
                            .foregroundColor(AppColors.cyan)
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 12)
                    }
                }

                // ── List ──────────────────────────────────────────────
                ScrollView(showsIndicators: false) {
                    LazyVStack(spacing: 12) {
                        ForEach(detections) { item in
                            DetectionCardView(item: item)
                        }
                    }
                    .padding(16)
                }
                // Tab bar height (68) + bottom padding (24) = 92pt above safe area bottom.
                // Shrinking the scroll view stops content from scrolling behind the tab bar.
                .padding(.bottom, 92)
                .overlay(
                    Group {
                        if detections.isEmpty {
                            VStack(spacing: 12) {
                                Image(systemName: "clock.badge.questionmark")
                                    .font(Font.googleSans(size: 40))
                                    .foregroundColor(AppColors.cyan.opacity(0.30))

                                Text("No detections yet")
                                    .font(Font.googleSans(size: 18, weight: .bold))
                                    .foregroundColor(.white)

                                Text("Start listening on the Home tab and say your trigger word.")
                                    .font(Font.googleSans(size: 14))
                                    .foregroundColor(AppColors.grayThumb)
                                    .multilineTextAlignment(.center)
                                    .frame(maxWidth: 280)
                            }
                            .padding(.top, 120)
                        }
                    }
                )
            }
        }
        .navigationTitle("History")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .alert(isPresented: $showingClearAlert) {
            Alert(
                title: Text("Clear History"),
                message: Text("Delete all detection records?"),
                primaryButton: .destructive(Text("Clear")) { clearAllRecords() },
                secondaryButton: .cancel()
            )
        }
    }

    private func clearAllRecords() {
        do {
            try modelContext.delete(model: DetectionRecord.self)
            try modelContext.save()
        } catch {
            print("[HistoryView] Failed to clear detections: \(error)")
        }
    }
}
