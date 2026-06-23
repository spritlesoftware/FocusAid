import RNFS from 'react-native-fs';

import AsyncStorage from '@react-native-async-storage/async-storage';

export const MODEL_DIR   = `${RNFS.DocumentDirectoryPath}/models`;
export const CLIPS_DIR   = `${RNFS.DocumentDirectoryPath}/clips`;
export const SHERPA_DIR  = `${MODEL_DIR}/sherpa-kws`;

const SETTINGS_KEY = '@hearing_trigger:settings';

export function getWhisperModelPath(modelKey: string): string {
  return `${MODEL_DIR}/ggml-${modelKey}.bin`;
}

export async function getActiveWhisperModelPath(): Promise<string> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.whisperModel) {
        return getWhisperModelPath(parsed.whisperModel);
      }
    }
  } catch {}
  return getWhisperModelPath('tiny.en');
}

export async function ensureDirectories() {
  for (const dir of [MODEL_DIR, CLIPS_DIR, SHERPA_DIR]) {
    if (!(await RNFS.exists(dir))) {
      await RNFS.mkdir(dir);
    }
  }
}
