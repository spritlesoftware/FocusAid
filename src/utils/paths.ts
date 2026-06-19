import RNFS from 'react-native-fs';

export const MODEL_DIR   = `${RNFS.DocumentDirectoryPath}/models`;
export const CLIPS_DIR   = `${RNFS.DocumentDirectoryPath}/clips`;
export const WHISPER_BIN = `${MODEL_DIR}/ggml-tiny.en.bin`;
export const SHERPA_DIR  = `${MODEL_DIR}/sherpa-kws`;

export async function ensureDirectories() {
  for (const dir of [MODEL_DIR, CLIPS_DIR, SHERPA_DIR]) {
    if (!(await RNFS.exists(dir))) {
      await RNFS.mkdir(dir);
    }
  }
}
