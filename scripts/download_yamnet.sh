#!/usr/bin/env bash
# download_yamnet.sh
#
# Downloads the YAMNet TFLite model and copies it to both native asset folders.
#
# Usage:
#   chmod +x scripts/download_yamnet.sh
#   ./scripts/download_yamnet.sh
#
# Source: TensorFlow Hub / Kaggle — Google YAMNet classification (float32, ~3.7 MB)
# After running this script you still need to:
#   iOS  → In Xcode, right-click the HearingTriggerRN target → "Add Files to..."
#           → select ios/HearingTrigger/yamnet.tflite, tick "Add to targets: HearingTriggerRN"
#   Android → model is placed directly into assets/ (picked up automatically on next build)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

ANDROID_ASSETS="$ROOT_DIR/android/app/src/main/assets"
IOS_BUNDLE="$ROOT_DIR/ios/HearingTrigger"
MODEL_NAME="yamnet.tflite"

# Primary source: MediaPipe Audio Classification assets (float32, 521 AudioSet classes)
MODEL_URL="https://storage.googleapis.com/mediapipe-assets/yamnet_audio_classifier_with_metadata.tflite"

echo "📥  Downloading YAMNet TFLite model..."
TMP_FILE="$(mktemp /tmp/yamnet_XXXXXX.tflite)"

if command -v curl &>/dev/null; then
  curl -L --progress-bar -o "$TMP_FILE" "$MODEL_URL"
elif command -v wget &>/dev/null; then
  wget -q --show-progress -O "$TMP_FILE" "$MODEL_URL"
else
  echo "❌  Neither curl nor wget found. Install one and retry."
  exit 1
fi

echo "📂  Copying to Android assets..."
mkdir -p "$ANDROID_ASSETS"
cp "$TMP_FILE" "$ANDROID_ASSETS/$MODEL_NAME"

echo "📂  Copying to iOS bundle folder..."
mkdir -p "$IOS_BUNDLE"
cp "$TMP_FILE" "$IOS_BUNDLE/$MODEL_NAME"

rm -f "$TMP_FILE"

echo ""
echo "✅  Done! Model placed at:"
echo "    $ANDROID_ASSETS/$MODEL_NAME"
echo "    $IOS_BUNDLE/$MODEL_NAME"
echo ""
echo "⚠️   iOS: open Xcode → right-click HearingTriggerRN target"
echo "         → 'Add Files to HearingTriggerRN' → select $IOS_BUNDLE/$MODEL_NAME"
echo "         → ensure 'Add to targets: HearingTriggerRN' is checked → Add"
echo ""
echo "Then rebuild the app:"
echo "  Android:  npx react-native run-android"
echo "  iOS:      cd ios && pod install && cd .. && npx react-native run-ios"
