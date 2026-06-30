import SwiftUI
import SwiftData

@main
struct HearingTriggerApp: App {
    let container: ModelContainer

    init() {
        clearLaunchScreenCache()

        do {
            let schema = Schema([DetectionRecord.self])
            let config = ModelConfiguration(schema: schema, isStoredInMemoryOnly: false)
            container = try ModelContainer(for: schema, configurations: [config])

            // Pass modelContext to the HearingManager singleton
            let context = container.mainContext
            Task { @MainActor in
                HearingManager.shared.setModelContext(context)
            }
        } catch {
            fatalError("Failed to initialize SwiftData model container: \(error.localizedDescription)")
        }
    }

    @State private var showSplash = true

    var body: some Scene {
        WindowGroup {
            ZStack {
                if showSplash {
                    SplashScreenView()
                        .transition(AnyTransition.opacity)
                } else {
                    PermissionGateView {
                        MainTabView()
                    }
                    .modelContainer(container)
                    .transition(AnyTransition.opacity)
                }
            }
            .modelContainer(container)
            .preferredColorScheme(.dark)
            .onAppear {
                DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
                    withAnimation(.easeInOut(duration: 0.5)) {
                        showSplash = false
                    }
                }
            }
        }
    }
}

// ─── Programmatically clear launch screen cache ──────────────────────────────
private func clearLaunchScreenCache() {
    #if DEBUG
    let fileManager = FileManager.default
    
    // Path 1: SplashBoard (iOS 13+)
    let splashBoardPath = NSHomeDirectory() + "/Library/SplashBoard"
    if fileManager.fileExists(atPath: splashBoardPath) {
        try? fileManager.removeItem(atPath: splashBoardPath)
    }
    
    // Path 2: Snapshots
    let cachePath = NSHomeDirectory() + "/Library/Caches/Snapshots"
    if fileManager.fileExists(atPath: cachePath) {
        try? fileManager.removeItem(atPath: cachePath)
    }
    
    print("Launch screen cache cleared successfully.")
    #endif
}

