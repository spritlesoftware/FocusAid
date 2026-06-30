import SwiftUI

struct SplashScreenView: View {
    @State private var logoScale: CGFloat = 0.7
    @State private var logoOpacity: Double = 0
    @State private var glowOpacity: Double = 0

    var body: some View {
        ZStack {
            // Gradient background
            LinearGradient(
                gradient: Gradient(stops: [
                    .init(color: Color(hex: "0B47A8"), location: 0.0),
                    .init(color: Color(hex: "072660"), location: 0.35),
                    .init(color: Color(hex: "031540"), location: 0.65),
                    .init(color: Color(hex: "010A18"), location: 1.0)
                ]),
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()

            // Radial glow behind logo
            RadialGradient(
                gradient: Gradient(colors: [
                    Color(hex: "00D4FF").opacity(0.18),
                    Color.clear
                ]),
                center: .center,
                startRadius: 0,
                endRadius: 220
            )
            .ignoresSafeArea()
            .opacity(glowOpacity)

            Image("SplashLogo")
                .renderingMode(.template)
                .resizable()
                .scaledToFit()
                .frame(width: 200, height: 200)
                .foregroundColor(Color(hex: "00D4FF"))
                .scaleEffect(logoScale)
                .opacity(logoOpacity)
        }
        .onAppear {
            withAnimation(.easeOut(duration: 0.6)) {
                logoScale = 1.0
                logoOpacity = 1.0
                glowOpacity = 1.0
            }
        }
    }
}
