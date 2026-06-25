// ─── Detection types ────────────────────────────────────────────
export interface Detection {
  id: string;
  keyword: string;
  score: number;          // 0–1 confidence from KWS engine
  timestamp: number;      // Unix ms
  clipPath?: string;      // local path to 3-sec PCM/wav clip
  transcript?: string;    // whisper.rn result: undefined=pending, ''=no speech, string=result
  confirmed: boolean;     // true only after Whisper finds the keyword in transcript
  placeType?: string;     // acoustic scene at time of detection (e.g. "Office", "Mall")
}

export interface TriggerConfig {
  keyword: string;
  threshold: number;      // 0.5 default
  cooldownMs: number;     // ms before re-trigger is allowed
  capturePostMs: number;  // how long to record after hit for whisper
}

export type ListeningState = 'idle' | 'starting' | 'active' | 'stopping' | 'error';
