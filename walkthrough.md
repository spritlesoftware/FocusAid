# Walkthrough: Splash Screens, Offline Model Bundling & Latency Optimizations

We have successfully integrated native splash screens, bundled the Whisper and KWS models directly inside the application, and optimized latency parameters to provide a snappy, fully offline experience.

---

## 1. Native Splash Screens Integration

- **Logo Generation**: Created a high-resolution logo graphic containing the "Focus Aid" branding and clinical suite information, converting the background to transparent.
- **Android**: Configured a themed launcher splash screen using [launch_screen.xml](file:///Users/sathyapriya/Desktop/React-Native/hearing-trigger-rn/android/app/src/main/res/drawable/launch_screen.xml) to show the logo instantly on startup and transition smoothly.
- **iOS**: Updated [LaunchScreen.storyboard](file:///Users/sathyapriya/Desktop/React-Native/hearing-trigger-rn/ios/HearingTriggerRN/LaunchScreen.storyboard) to present a centered `UIImageView` using the new logo asset, forcing a white background in all system themes.

---

## 2. Offline Model Bundling & linking

### Whisper and Sherpa-ONNX Models Staged:

- **Android**: Plist & Model assets copied to `android/app/src/main/assets/models/`.
- **iOS**: Copied to `ios/models/`.

### iOS Xcode Project Linking:

- We wrote and executed a custom Swift compilation tool using the XcodeProj library in the `scratch/` directory to link the `ios/models/` folder reference directly to `HearingTriggerRN.xcodeproj`.
- Verified that the folder reference correctly appears in the resources copy build phase under [project.pbxproj](file:///Users/sathyapriya/Desktop/React-Native/hearing-trigger-rn/ios/HearingTriggerRN.xcodeproj/project.pbxproj).

### JS Asset Copy Logic:

- Updated [modelManager.ts](file:///Users/sathyapriya/Desktop/React-Native/hearing-trigger-rn/src/services/modelManager.ts) to check for local model existence in `RNFS.DocumentDirectoryPath`. On first run, the app extracts the models from native assets (using `copyFileAssets` on Android or bundle path `copyFile` on iOS) to the filesystem instead of downloading over the internet.
- Updated [paths.ts](file:///Users/sathyapriya/Desktop/React-Native/hearing-trigger-rn/src/utils/paths.ts), [HomeScreen.tsx](file:///Users/sathyapriya/Desktop/React-Native/hearing-trigger-rn/src/screens/HomeScreen.tsx), and [SettingsScreen.tsx](file:///Users/sathyapriya/Desktop/React-Native/hearing-trigger-rn/src/screens/SettingsScreen.tsx) to use the quantized medium model (`medium.en-q5_0`) by default.

---

## 3. Latency Optimizations

- **Pre-roll Tuning**: Reduced the pre-roll capture buffer to **0.5 seconds** (down from 1.0s) in the Android foreground service to minimize the amount of audio passed to Whisper.
- **VAD Sensitivity**: Lowered the minimum sustained speech verification threshold in [HearingForegroundService.kt](file:///Users/sathyapriya/Desktop/React-Native/hearing-trigger-rn/android/app/src/main/java/com/hearingtrigger/audio/HearingForegroundService.kt) to **350ms** (down from 700ms) for faster activation.
- **Post-Capture Window**: Reduced the keyword post-capture duration to **1.5 seconds** (down from 3.0s) in [kwsService.ts](file:///Users/sathyapriya/Desktop/React-Native/hearing-trigger-rn/src/services/kwsService.ts).
- **Multithreading**: Configured Whisper to utilize **4 CPU threads** during transcription in [whisperService.ts](file:///Users/sathyapriya/Desktop/React-Native/hearing-trigger-rn/src/services/whisperService.ts).

---

## 4. Compilation Verification

- **Android**: Executed `./gradlew assembleDebug` successfully with all assets bundled.
- **iOS**: Executed `xcodebuild` successfully on the simulator target workspace with resources linked.
