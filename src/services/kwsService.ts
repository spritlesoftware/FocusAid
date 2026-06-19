/**
 * kwsService.ts
 *
 * JavaScript orchestration layer for keyword spotting.
 * The heavy audio work (mic capture + sherpa-onnx KWS) runs inside
 * a native module (Kotlin foreground service on Android, Swift
 * audio session on iOS). This service acts as the JS-side controller.
 */
import {hearingModule} from '../native/HearingTriggerModule';
import {TriggerConfig} from '../types/detection';
import {SHERPA_DIR} from '../utils/paths';

const DEFAULT_CONFIG: Omit<TriggerConfig, 'keyword'> = {
  threshold: 0.5,
  cooldownMs: 6000,
  capturePostMs: 3000,
};

export async function startKeywordSpotting(keyword: string, overrides?: Partial<TriggerConfig>) {
  const cfg: TriggerConfig = {
    ...DEFAULT_CONFIG,
    ...overrides,
    keyword: keyword.toLowerCase().trim(),
  };

  await hearingModule.startListening({
    keyword: cfg.keyword,
    threshold: cfg.threshold,
    cooldownMs: cfg.cooldownMs,
    capturePostMs: cfg.capturePostMs,
    sherpaModelDir: SHERPA_DIR,
    sampleRate: 16000,
  });
}

export async function stopKeywordSpotting() {
  await hearingModule.stopListening();
}

export async function updateThreshold(value: number) {
  await hearingModule.updateConfig({threshold: value});
}
