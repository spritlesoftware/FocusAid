/**
 * modelManager.ts
 *
 * Copies pre-bundled models from app assets/bundle to the local documents folder on startup.
 * Whisper: ggml-medium.en-q5_0.bin (~510 MB) - quantized for offline, RAM-safe, high-accuracy use.
 * sherpa-onnx KWS: a pre-trained keyword spotter ONNX + tokens.
 */
import { Platform } from 'react-native';
import RNFS from 'react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getActiveWhisperModelPath, getWhisperModelPath, SHERPA_DIR, ensureDirectories } from '../utils/paths';

const SETTINGS_KEY = '@hearing_trigger:settings';

export const WHISPER_MODELS = {
  'medium.en-q5_0': {
    name: 'Whisper medium.en-q5_0 (~510 MB)',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.en-q5_0.bin',
  },
  'tiny.en': {
    name: 'Whisper tiny.en (~75 MB)',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin',
  },
  'base.en': {
    name: 'Whisper base.en (~142 MB)',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin',
  },
};

export type WhisperModelKey = keyof typeof WHISPER_MODELS;

export interface DownloadProgress {
  file: string;
  percent: number;
}

export async function initModels(
  onProgress?: (p: DownloadProgress) => void,
): Promise<void> {
  await ensureDirectories();

  // Load the active model key from AsyncStorage (defaults to medium.en-q5_0)
  let modelKey: WhisperModelKey = 'medium.en-q5_0';
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.whisperModel && WHISPER_MODELS[parsed.whisperModel as WhisperModelKey]) {
        modelKey = parsed.whisperModel as WhisperModelKey;
      }
    }
  } catch {}

  const whisperFileName = `ggml-${modelKey}.bin`;
  const whisperDestPath = getWhisperModelPath(modelKey);

  const filesToCopy = [
    { name: whisperFileName, dest: whisperDestPath, label: `Whisper Model (${modelKey})` },
    { name: 'encoder.onnx', dest: `${SHERPA_DIR}/encoder.onnx`, label: 'KWS Encoder' },
    { name: 'decoder.onnx', dest: `${SHERPA_DIR}/decoder.onnx`, label: 'KWS Decoder' },
    { name: 'tokens.txt', dest: `${SHERPA_DIR}/tokens.txt`, label: 'KWS Tokens' },
  ];

  for (const file of filesToCopy) {
    const progressLabel = file.label;
    onProgress?.({ file: progressLabel, percent: 10 });

    if (await RNFS.exists(file.dest)) {
      onProgress?.({ file: progressLabel, percent: 100 });
      continue;
    }

    try {
      if (Platform.OS === 'android') {
        // Android assets copy
        // On Android, copyFileAssets expects path relative to "assets" folder
        const assetSrc = `models/${file.name}`;
        onProgress?.({ file: progressLabel, percent: 40 });
        await RNFS.copyFileAssets(assetSrc, file.dest);
        onProgress?.({ file: progressLabel, percent: 100 });
      } else {
        // iOS main bundle copy
        const bundleSrc = `${RNFS.MainBundlePath}/models/${file.name}`;
        if (await RNFS.exists(bundleSrc)) {
          onProgress?.({ file: progressLabel, percent: 40 });
          await RNFS.copyFile(bundleSrc, file.dest);
          onProgress?.({ file: progressLabel, percent: 100 });
        } else {
          // Fallback check: if no models subfolder, check if it's placed in main bundle root
          const rootBundleSrc = `${RNFS.MainBundlePath}/${file.name}`;
          if (await RNFS.exists(rootBundleSrc)) {
            onProgress?.({ file: progressLabel, percent: 40 });
            await RNFS.copyFile(rootBundleSrc, file.dest);
            onProgress?.({ file: progressLabel, percent: 100 });
          } else {
            console.warn(`Source model not found in iOS bundle: ${bundleSrc}`);
            throw new Error(`Model file not found in iOS bundle: ${file.name}`);
          }
        }
      }
    } catch (err) {
      console.error(`Failed to copy model ${file.name} from app assets:`, err);
      throw err;
    }
  }
}

export async function isModelsReady(): Promise<boolean> {
  const whisperPath = await getActiveWhisperModelPath();
  return (
    (await RNFS.exists(whisperPath)) &&
    (await RNFS.exists(`${SHERPA_DIR}/encoder.onnx`)) &&
    (await RNFS.exists(`${SHERPA_DIR}/decoder.onnx`)) &&
    (await RNFS.exists(`${SHERPA_DIR}/tokens.txt`))
  );
}
