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
import {WHISPER_BIN, SHERPA_DIR, ensureDirectories} from '../utils/paths';

// Replace with your actual CDN URLs
const WHISPER_MODEL_URL =
  'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin';

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
  await maybeDownload(WHISPER_BIN, WHISPER_MODEL_URL, 'Whisper tiny.en', onProgress);
  await maybeDownload(`${SHERPA_DIR}/encoder.onnx`, SHERPA_ENCODER_URL, 'KWS Encoder', onProgress);
  await maybeDownload(`${SHERPA_DIR}/decoder.onnx`, SHERPA_DECODER_URL, 'KWS Decoder', onProgress);
  await maybeDownload(`${SHERPA_DIR}/tokens.txt`, SHERPA_TOKENS_URL, 'KWS Tokens', onProgress);
}

export async function isModelsReady(): Promise<boolean> {
  return (
    (await RNFS.exists(WHISPER_BIN)) &&
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
