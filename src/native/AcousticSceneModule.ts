import { NativeModules, NativeEventEmitter } from 'react-native';

const { AcousticSceneModule: _native } = NativeModules;

if (!_native) {
  console.warn(
    '[AcousticSceneModule] Native module not found. ' +
    'Rebuild the app after adding the native files and the yamnet.tflite model.',
  );
}

export interface SceneChangedEvent {
  place: string;
}

export const acousticSceneNative = {
  /** Begin periodic scene classification (every ~15 s). */
  startSceneDetection: (): Promise<boolean> =>
    _native?.startSceneDetection() ?? Promise.resolve(false),

  /** Stop the timer and release the audio tap. */
  stopSceneDetection: (): Promise<boolean> =>
    _native?.stopSceneDetection() ?? Promise.resolve(false),

  /** Run a single classification immediately and return the place label. */
  classifyOnce: (): Promise<string> =>
    _native?.classifyOnce() ?? Promise.resolve('Unknown'),
};

export const acousticSceneEvents = _native
  ? new NativeEventEmitter(_native)
  : null;
