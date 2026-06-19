# Hearing Trigger RN

A React Native project blueprint for an on-device accessibility app that uses **sherpa-onnx** for always-on keyword spotting and **whisper.rn** for short offline transcription windows.

## Goal

The user chooses a trigger word, such as their own name or a family member's name. The phone listens locally, detects the keyword, and sends a subtle haptic or audio cue so the user can focus attention when that name is spoken.

## Stack

- React Native CLI
- TypeScript
- sherpa-onnx for KWS/native speech utilities
- whisper.rn for offline Whisper transcription
- Native Android foreground service for stable background microphone handling
- Native iOS audio session manager for foreground or constrained background listening

## Project structure

```text
hearing-trigger-rn/
├─ package.json
├─ metro.config.js
├─ tsconfig.json
├─ App.tsx
├─ src/
│  ├─ screens/
│  │  ├─ HomeScreen.tsx
│  │  ├─ SettingsScreen.tsx
│  │  └─ HistoryScreen.tsx
│  ├─ components/
│  │  ├─ DetectionCard.tsx
│  │  └─ PermissionGate.tsx
│  ├─ services/
│  │  ├─ kwsService.ts
│  │  ├─ whisperService.ts
│  │  ├─ audioBridge.ts
│  │  ├─ modelManager.ts
│  │  └─ detectionStore.ts
│  ├─ native/
│  │  ├─ HearingTriggerModule.ts
│  │  └─ eventNames.ts
│  ├─ hooks/
│  │  ├─ useDetectionEvents.ts
│  │  └─ usePermissions.ts
│  ├─ types/
│  │  └─ detection.ts
│  └─ utils/
│     ├─ debounce.ts
│     └─ paths.ts
├─ assets/
│  └─ models/
│     └─ README.md
├─ android/
│  └─ app/src/main/java/com/hearingtrigger/
│     ├─ HearingTriggerModule.kt
│     ├─ HearingTriggerPackage.kt
│     ├─ audio/
│     │  ├─ AudioCapture.kt
│     │  ├─ KeywordSpotter.kt
│     │  ├─ AlertRouter.kt
│     │  └─ HearingForegroundService.kt
│     └─ model/
│        └─ ModelPaths.kt
└─ ios/
   └─ HearingTrigger/
      ├─ HearingTriggerModule.swift
      ├─ AudioSessionManager.swift
      ├─ KeywordSpotter.swift
      └─ AlertRouter.swift
```

## Step-by-step implementation

### 1. Create the app

```bash
npx react-native init HearingTriggerRN --template react-native-template-typescript
cd HearingTriggerRN
```

Use React Native CLI rather than Expo because continuous mic capture, background services, and native audio routing need native control.[web:153][web:158]

### 2. Install dependencies

```bash
npm install whisper.rn react-native-nitro-modules @react-native-async-storage/async-storage react-native-fs react-native-permissions react-native-haptic-feedback react-native-sound
npm install react-native-sherpa-onnx @dr.pogodin/react-native-fs
cd ios && pod install && cd ..
```

`whisper.rn` supports React Native offline Whisper with local model files.[web:169][web:172]

`react-native-sherpa-onnx` provides a React Native wrapper around sherpa-onnx with model download and STT features; sherpa-onnx itself supports Android and iOS offline speech processing.[web:165][web:148][web:166]

### 3. Configure Metro for bundled Whisper models

Create `metro.config.js`:

```js
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

const config = {
  resolver: {
    assetExts: [...getDefaultConfig(__dirname).resolver.assetExts, 'bin', 'onnx', 'txt'],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
```

Bundling `.bin` is required if you ship Whisper models with the app rather than downloading them at runtime.[web:167][web:169]

### 4. Android permissions and service

Add to `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MICROPHONE" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.BLUETOOTH" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
```

Also register a foreground service:

```xml
<service
  android:name=".audio.HearingForegroundService"
  android:foregroundServiceType="microphone"
  android:exported="false" />
```

`whisper.rn` explicitly requires microphone permission on Android, and for background listening your app needs a foreground microphone service.[web:161]

### 5. iOS permissions

Add to `ios/HearingTriggerRN/Info.plist`:

```xml
<key>NSMicrophoneUsageDescription</key>
<string>This app listens locally for a user-selected trigger word.</string>
<key>NSBluetoothAlwaysUsageDescription</key>
<string>This app sends subtle audio cues to connected hearing devices.</string>
```

`whisper.rn` requires microphone permission on iOS for recording/transcription workflows.[web:161]

### 6. Model strategy

Use:
- sherpa-onnx KWS assets for trigger detection
- Whisper tiny.en for short post-trigger transcription

Production recommendation:
- download models on first launch to reduce app size
- checksum the files
- store inside app documents directory

`whisper.rn` recommends downloading models at runtime for production, while bundled assets are fine for development.[web:169]

### 7. App bootstrap

`src/services/modelManager.ts`

```ts
import RNFS from 'react-native-fs';

export const MODEL_DIR = `${RNFS.DocumentDirectoryPath}/models`;

export async function ensureDirs() {
  const exists = await RNFS.exists(MODEL_DIR);
  if (!exists) await RNFS.mkdir(MODEL_DIR);
}

export async function getWhisperModelPath() {
  return `${MODEL_DIR}/ggml-tiny.en.bin`;
}

export async function getSherpaModelDir() {
  return `${MODEL_DIR}/sherpa-kws`;
}
```

### 8. Whisper service

`src/services/whisperService.ts`

```ts
import {initWhisper, WhisperContext} from 'whisper.rn';
import {getWhisperModelPath} from './modelManager';

let ctx: WhisperContext | null = null;

export async function initWhisperEngine() {
  if (ctx) return ctx;
  const filePath = await getWhisperModelPath();
  ctx = await initWhisper({ filePath });
  return ctx;
}

export async function transcribeClip(audioPath: string) {
  const engine = await initWhisperEngine();
  const {result} = await engine.transcribe(audioPath, {
    language: 'en',
    maxLen: 1,
    tokenTimestamps: false,
  });
  return result;
}
```

`initWhisper` with a local model file is the standard integration path for whisper.rn.[web:167][web:172]

### 9. Native bridge contract

`src/native/HearingTriggerModule.ts`

```ts
import {NativeEventEmitter, NativeModules} from 'react-native';

export type DetectionPayload = {
  keyword: string;
  score: number;
  timestamp: number;
  clipPath?: string;
};

const {HearingTriggerModule} = NativeModules;

export const hearingModule = HearingTriggerModule;
export const hearingEvents = new NativeEventEmitter(HearingTriggerModule);
```

### 10. JS KWS orchestration

`src/services/kwsService.ts`

```ts
import {hearingModule} from '../native/HearingTriggerModule';

export async function startKeywordSpotting(keyword: string) {
  await hearingModule.startListening({
    keyword,
    sampleRate: 16000,
    cooldownMs: 6000,
    capturePostTriggerMs: 3000,
  });
}

export async function stopKeywordSpotting() {
  await hearingModule.stopListening();
}
```

### 11. Detection store

`src/services/detectionStore.ts`

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'detections';

export async function saveDetection(entry: any) {
  const raw = await AsyncStorage.getItem(KEY);
  const items = raw ? JSON.parse(raw) : [];
  items.unshift(entry);
  await AsyncStorage.setItem(KEY, JSON.stringify(items.slice(0, 200)));
}

export async function getDetections() {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : [];
}
```

### 12. App screen wiring

`App.tsx`

```tsx
import React, {useEffect, useState} from 'react';
import {SafeAreaView, Text, Button, View} from 'react-native';
import {hearingEvents} from './src/native/HearingTriggerModule';
import {startKeywordSpotting, stopKeywordSpotting} from './src/services/kwsService';
import {saveDetection} from './src/services/detectionStore';
import {transcribeClip} from './src/services/whisperService';

export default function App() {
  const [running, setRunning] = useState(false);
  const [lastText, setLastText] = useState('');

  useEffect(() => {
    const sub = hearingEvents.addListener('onKeywordDetected', async (event) => {
      let transcript = '';
      if (event.clipPath) {
        try {
          const res = await transcribeClip(event.clipPath);
          transcript = typeof res === 'string' ? res : JSON.stringify(res);
          setLastText(transcript);
        } catch {}
      }
      await saveDetection({...event, transcript});
    });
    return () => sub.remove();
  }, []);

  const toggle = async () => {
    if (running) {
      await stopKeywordSpotting();
      setRunning(false);
    } else {
      await startKeywordSpotting('priya');
      setRunning(true);
    }
  };

  return (
    <SafeAreaView style={{flex: 1, padding: 24}}>
      <Text style={{fontSize: 24, fontWeight: '700'}}>Hearing Trigger</Text>
      <Text style={{marginTop: 12}}>
        Always-on keyword spotting with on-device transcription after detection.
      </Text>
      <View style={{height: 24}} />
      <Button title={running ? 'Stop Listening' : 'Start Listening'} onPress={toggle} />
      <Text style={{marginTop: 24}}>Last transcript: {lastText || '—'}</Text>
    </SafeAreaView>
  );
}
```

### 13. Android native module skeleton

`android/app/src/main/java/com/hearingtrigger/HearingTriggerModule.kt`

```kotlin
package com.hearingtrigger

import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

class HearingTriggerModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    override fun getName() = "HearingTriggerModule"

    @ReactMethod
    fun startListening(options: ReadableMap, promise: Promise) {
        // Start foreground service, pass keyword and config.
        promise.resolve(true)
    }

    @ReactMethod
    fun stopListening(promise: Promise) {
        // Stop service.
        promise.resolve(true)
    }

    fun emitDetected(keyword: String, score: Double, clipPath: String?) {
        val map = Arguments.createMap().apply {
            putString("keyword", keyword)
            putDouble("score", score)
            putDouble("timestamp", System.currentTimeMillis().toDouble())
            if (clipPath != null) putString("clipPath", clipPath)
        }
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit("onKeywordDetected", map)
    }
}
```

### 14. Android foreground service skeleton

`android/app/src/main/java/com/hearingtrigger/audio/HearingForegroundService.kt`

```kotlin
package com.hearingtrigger.audio

import android.app.Notification
import android.app.Service
import android.content.Intent
import android.os.IBinder

class HearingForegroundService : Service() {
    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(1001, buildNotification())
        // 1. Open mic
        // 2. Stream PCM 16k mono
        // 3. Feed sherpa-onnx keyword spotter
        // 4. On hit: vibrate, optional tone, save short wav clip, emit to RN
        return START_STICKY
    }

    private fun buildNotification(): Notification {
        TODO("Build persistent notification")
    }
}
```

### 15. iOS native module skeleton

`ios/HearingTrigger/HearingTriggerModule.swift`

```swift
import Foundation
import React

@objc(HearingTriggerModule)
class HearingTriggerModule: RCTEventEmitter {
  override static func requiresMainQueueSetup() -> Bool { false }
  override func supportedEvents() -> [String]! { ["onKeywordDetected"] }

  @objc(startListening:resolver:rejecter:)
  func startListening(options: NSDictionary, resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) {
    // Configure audio session and start sherpa-based keyword spotter.
    resolve(true)
  }

  @objc(stopListening:rejecter:)
  func stopListening(resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) {
    // Stop listening.
    resolve(true)
  }

  func emitKeyword(keyword: String, score: Double, clipPath: String?) {
    sendEvent(withName: "onKeywordDetected", body: [
      "keyword": keyword,
      "score": score,
      "timestamp": Date().timeIntervalSince1970 * 1000,
      "clipPath": clipPath as Any,
    ])
  }
}
```

### 16. sherpa-onnx integration notes

The React Native sherpa wrappers are strongest today for STT/TTS workflows, while official sherpa-onnx docs specifically note command-line and Android-app support for keyword spotting.[web:163][web:165]

Because of that, the most stable production route is:
- keep React Native for UI
- write a thin native Kotlin/Swift wrapper around sherpa-onnx KWS APIs for real-time mic frames
- emit detection events back to JS

That avoids trying to force a file-based STT wrapper into an always-on KWS problem.[web:163][web:166]

### 17. Alerting path

Start with phone haptics and local audio. Hearing-aid routed tones can be added later, because Bluetooth hearing-device routing differs by platform and vendor.

In Android native code:
- vibrate with `VibratorManager`
- optionally play a short PCM tone through audio routing
- later add BLE-specific hearing-aid routing where supported

### 18. False-positive protection

Add all of these:
- confidence threshold
- cooldown window
- two-hit confirmation in noisy rooms
- optional VAD before KWS
- post-trigger Whisper verification

Example rule:
- KWS hit above threshold
- capture 3-second clip
- run whisper.rn
- if transcript contains likely intended name or surrounding speech confidence is acceptable, keep event; else mark as low confidence

### 19. Testing plan

Test these conditions:
- quiet room, 1 speaker
- TV noise
- restaurant/cafe noise
- family group conversation
- phone in pocket vs table
- wired headphones vs hearing aids connected

Track:
- false positives/hour
- misses/hour
- average trigger latency
- battery drain over 1 hour and 8 hours

### 20. Delivery phases

#### V1
- Android only
- one configured keyword
- haptic alert
- post-trigger Whisper transcript

#### V2
- multiple trigger words
- iOS support
- better denoise/VAD
- local event review UI

#### V3
- hearing-aid-specific cue routing
- directional inference experiments
- custom user-trained names

## Recommended commands

```bash
npm install
npx pod-install
npx react-native run-android
npx react-native run-ios
```

## Practical conclusion

Use **React Native for product UI and workflow**, **native Kotlin/Swift for mic + KWS**, and **whisper.rn for local post-trigger ASR**. That is the lowest-risk way to ship this concept with sherpa-onnx today because Whisper integration is straightforward in RN, while KWS is better handled in a native streaming module.[web:167][web:169][web:163][web:165]
