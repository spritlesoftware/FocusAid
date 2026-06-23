/**
 * modelManager.ts
 *
 * Downloads and verifies local model files at first launch.
 * Whisper: ggml-tiny.en.bin (~75 MB) - good balance of accuracy and speed.
 * sherpa-onnx KWS: a pre-trained keyword spotter ONNX + tokens.
 *
 * In production, host these files on your CDN and verify SHA256.
 */
import RNFS from 'react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {getActiveWhisperModelPath, getWhisperModelPath, SHERPA_DIR, ensureDirectories} from '../utils/paths';

const SETTINGS_KEY = '@hearing_trigger:settings';

export const WHISPER_MODELS = {
  'tiny.en': {
    name: 'Whisper tiny.en (~75 MB)',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin',
  },
  'base.en': {
    name: 'Whisper base.en (~142 MB)',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin',
  },
  'small.en': {
    name: 'Whisper small.en (~466 MB)',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin',
  },
  'medium.en': {
    name: 'Whisper medium.en (~1.53 GB)',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.en.bin',
  },
};

export type WhisperModelKey = keyof typeof WHISPER_MODELS;

const SHERPA_ENCODER_URL =
  'https://github.com/k2-fsa/sherpa-onnx/releases/download/kws-models/sherpa-onnx-kws-zipformer-wenetspeech-3.3M-2024-01-01-encoder.onnx';

const SHERPA_DECODER_URL =
  'https://github.com/k2-fsa/sherpa-onnx/releases/download/kws-models/sherpa-onnx-kws-zipformer-wenetspeech-3.3M-2024-01-01-decoder.onnx';

const SHERPA_TOKENS_URL =
  'https://github.com/k2-fsa/sherpa-onnx/releases/download/kws-models/tokens.txt';

export interface DownloadProgress {
  file: string;
  percent: number;
}

export async function initModels(
  onProgress?: (p: DownloadProgress) => void,
): Promise<void> {
  await ensureDirectories();

  // Load the active model key from AsyncStorage
  let modelKey: WhisperModelKey = 'tiny.en';
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.whisperModel && WHISPER_MODELS[parsed.whisperModel as WhisperModelKey]) {
        modelKey = parsed.whisperModel as WhisperModelKey;
      }
    }
  } catch {}

  const modelInfo = WHISPER_MODELS[modelKey];
  const whisperPath = getWhisperModelPath(modelKey);

  await maybeDownload(whisperPath, modelInfo.url, modelInfo.name, onProgress);
  await maybeDownload(`${SHERPA_DIR}/encoder.onnx`, SHERPA_ENCODER_URL, 'KWS Encoder', onProgress);
  await maybeDownload(`${SHERPA_DIR}/decoder.onnx`, SHERPA_DECODER_URL, 'KWS Decoder', onProgress);
  await maybeDownload(`${SHERPA_DIR}/tokens.txt`, SHERPA_TOKENS_URL, 'KWS Tokens', onProgress);
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

async function maybeDownload(
  destPath: string,
  url: string,
  label: string,
  onProgress?: (p: DownloadProgress) => void,
): Promise<void> {
  if (await RNFS.exists(destPath)) return;

  await RNFS.downloadFile({
    fromUrl: url,
    toFile: destPath,
    progress: res => {
      const percent = Math.round((res.bytesWritten / res.contentLength) * 100);
      onProgress?.({file: label, percent});
    },
  }).promise;
}
