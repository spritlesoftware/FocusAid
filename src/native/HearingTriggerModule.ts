/**
 * HearingTriggerModule.ts
 *
 * Typed JS bridge to the native module (Kotlin / Swift).
 * The native module handles:
 *   - mic capture (16 kHz mono PCM)
 *   - sherpa-onnx KWS streaming
 *   - cooldown enforcement
 *   - WAV clip recording (post-trigger)
 *   - Android foreground service lifecycle
 *   - iOS audio session management
 */
import {NativeModules, NativeEventEmitter, Platform} from 'react-native';

const {HearingTriggerModule: _native} = NativeModules;

if (!_native) {
  console.error(
    '[HearingTriggerModule] Native module not found. ' +
    'Ensure you have run `npx pod-install` (iOS) or rebuilt the Android project.',
  );
}

export interface StartOptions {
  keyword: string;
  threshold: number;
  cooldownMs: number;
  capturePostMs: number;
  sherpaModelDir: string;
  sampleRate: 16000;
}

export interface NativeDetectionEvent {
  keyword: string;
  score: number;
  timestamp: number;
  clipPath?: string;
}

export const hearingModule = {
  startListening: (opts: StartOptions): Promise<boolean> =>
    _native.startListening(opts),
  stopListening: (): Promise<boolean> =>
    _native.stopListening(),
  updateConfig: (partial: Partial<StartOptions>): Promise<boolean> =>
    _native.updateConfig(partial),
  getListeningState: (): Promise<string> =>
    _native.getListeningState(),
};

export const hearingEvents = new NativeEventEmitter(_native);
