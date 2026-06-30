import SwiftUI

public struct PulseRingView: View {
    let delay: Double
    let active: Bool

    @State private var scale: CGFloat = 1.0
    @State private var opacity: Double = 0.55

    public init(delay: Double, active: Bool) {
        self.delay = delay
        self.active = active
    }

    public var body: some View {
        ZStack {
            if active {
                // Outer glow ring — vivid cyan pulse
                Circle()
                    .stroke(AppColors.cyan.opacity(0.45), lineWidth: 1.5)
                    .background(Circle().fill(AppColors.cyan.opacity(0.04)))
                    .scaleEffect(scale)
                    .opacity(opacity)
                    .frame(width: 120, height: 120)
                    .onAppear { startAnimation() }
            }
        }
    }

    private func startAnimation() {
        scale = 1.0
        opacity = 0.55
        DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
            withAnimation(Animation.easeOut(duration: 2.4).repeatForever(autoreverses: false)) {
                scale = 2.6
                opacity = 0.0
            }
        }
    }
}
