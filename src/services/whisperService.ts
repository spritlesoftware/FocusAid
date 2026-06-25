/**
 * whisperService.ts
 *
 * Wraps whisper.rn for post-trigger short-window transcription.
 * Whisper is NOT used for always-on KWS. It runs only after the
 * keyword is detected to transcribe the surrounding 3-second clip.
 *
 * whisper.rn: https://github.com/mybigday/whisper.rn
 */
import {initWhisper, WhisperContext} from 'whisper.rn';
import {getActiveWhisperModelPath} from '../utils/paths';

let _ctx: WhisperContext | null = null;

export async function initWhisperEngine(): Promise<WhisperContext> {
  if (_ctx) return _ctx;
  const whisperPath = await getActiveWhisperModelPath();
  _ctx = await initWhisper({
    filePath: whisperPath,
    // Use CoreML on iOS for faster inference if available
    useCoreMLIos: true,
  });
  return _ctx;
}

/**
 * Transcribe a short audio clip recorded after a keyword hit.
 * @param audioPath  Path to a 16 kHz mono WAV/PCM file
 */
export async function transcribeClip(audioPath: string): Promise<string> {
  const ctx = await initWhisperEngine();
  const {promise} = ctx.transcribe(audioPath, {
    language: 'en',
    maxLen: 60,
    tokenTimestamps: false,
    maxThreads: 4, // Utilize multiple threads to speed up transcription inference
    // Best performance for short clips
    beamSize: 1,
    temperature: 0,
  });
  const {result} = await promise;
  return result?.trim() ?? '';
}

export async function releaseWhisper() {
  await _ctx?.release();
  _ctx = null;
}
