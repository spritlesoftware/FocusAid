/**
 * audioBridge.ts
 *
 * Listens to native-module events, routes them to whisper.rn for
 * post-trigger transcription, checks for keyword in the transcript,
 * then fires haptic + audio cue only when the keyword is confirmed.
 *
 * Detection lifecycle:
 *   1. Native detects sustained speech → emits onKeywordDetected
 *   2. Bridge saves a draft record (confirmed=false) → notifies UI immediately
 *   3. whisper.rn transcribes the clip (~1-3s)
 *   4. If keyword found in transcript → confirmed=true, haptic fires
 *   5. Bridge saves updated record → notifies UI again with confirmed state
 */
import {Platform, Vibration} from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {hearingEvents, NativeDetectionEvent} from '../native/HearingTriggerModule';
import {transcribeClip} from './whisperService';
import {saveDetection} from './detectionStore';
import {Detection} from '../types/detection';

type DetectionCallback = (d: Detection) => void;
const listeners: DetectionCallback[] = [];

let started = false;

export function onDetection(cb: DetectionCallback): () => void {
  listeners.push(cb);
  return () => {
    const idx = listeners.indexOf(cb);
    if (idx !== -1) listeners.splice(idx, 1);
  };
}

export function startAudioBridge() {
  if (started) return;
  started = true;

  const SETTINGS_KEY = '@hearing_trigger:settings';

  hearingEvents.addListener('onKeywordDetected', async (rawEvent: NativeDetectionEvent) => {
    if (!rawEvent.clipPath) return;

    try {
      // 1. Transcribe the captured audio clip
      const transcript = await transcribeClip(rawEvent.clipPath);
      
      // Parse active keywords passed from native layer
      const activeKeywords = rawEvent.keyword.toLowerCase().split(',').map(k => k.trim()).filter(Boolean);
      
      // Find the first keyword that matches the transcribed text (using fuzzy matching)
      const matchedKeyword = activeKeywords.find(kw => fuzzyIncludes(transcript, kw));
      const confirmed = matchedKeyword !== undefined;

      // Load debug logs preference from AsyncStorage
      let enableDebugLogs = false;
      try {
        const rawSettings = await AsyncStorage.getItem(SETTINGS_KEY);
        if (rawSettings) {
          const parsed = JSON.parse(rawSettings);
          enableDebugLogs = !!parsed.enableDebugLogs;
        }
      } catch {}

      if (__DEV__ && enableDebugLogs) {
        console.log(`[AudioBridge] KWS Triggered. Active Keywords: ${JSON.stringify(activeKeywords)}`);
        console.log(`[AudioBridge] Whisper Transcript: "${transcript}" | Matched: ${matchedKeyword || 'None'} | Confirmed: ${confirmed}`);
      }

      // 2. Only trigger haptic alert and save/display the detection if one of the keywords is confirmed (spoken)
      if (confirmed && matchedKeyword) {
        // Retrieve original casing of the matched keyword if possible
        const originalKw = rawEvent.keyword.split(',').map(k => k.trim()).find(k => k.toLowerCase() === matchedKeyword) || matchedKeyword;

        const detection: Detection = {
          id:        `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          keyword:   originalKw,
          score:     rawEvent.score,
          timestamp: rawEvent.timestamp ?? Date.now(),
          clipPath:  rawEvent.clipPath,
          transcript,
          confirmed: true,
        };

        // Fire the haptic feedback
        triggerDetectionHaptic();

        // Save the confirmed detection to store
        await saveDetection(detection);

        // Notify the active listeners/UI
        listeners.forEach(cb => cb(detection));
      }
    } catch (err) {
      // Load debug logs preference from AsyncStorage for warning logs too
      let enableDebugLogs = false;
      try {
        const rawSettings = await AsyncStorage.getItem(SETTINGS_KEY);
        if (rawSettings) {
          const parsed = JSON.parse(rawSettings);
          enableDebugLogs = !!parsed.enableDebugLogs;
        }
      } catch {}

      if (__DEV__ && enableDebugLogs) {
        console.warn('[AudioBridge] Whisper error during verification:', err);
      }
    }
  });
}

function triggerDetectionHaptic() {
  const options = {enableVibrateFallback: true, ignoreAndroidSystemSettings: false};
  if (Platform.OS === 'ios') {
    // Standard vibration fallback for iOS
    Vibration.vibrate();
    ReactNativeHapticFeedback.trigger('notificationSuccess', options);
  } else {
    // Use React Native's built-in Vibration API for robust Android support
    Vibration.vibrate(500);
    // Also call the haptic library for devices that support haptic engine effects
    ReactNativeHapticFeedback.trigger('impactHeavy', options);
  }
}

// ─── Fuzzy String Matching Helpers (Levenshtein Distance) ─────────

function getLevenshteinDistance(a: string, b: string): number {
  const tmp: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    tmp[i] = [i];
  }
  for (let j = 0; j <= b.length; j++) {
    tmp[0][j] = j;
  }
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      tmp[i][j] = Math.min(
        tmp[i - 1][j] + 1, // deletion
        tmp[i][j - 1] + 1, // insertion
        tmp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1) // substitution
      );
    }
  }
  return tmp[a.length][b.length];
}

function isFuzzyMatch(word: string, keyword: string): boolean {
  const w = word.toLowerCase().trim();
  const kw = keyword.toLowerCase().trim();
  
  if (w === kw) return true;
  
  // Check for simple inclusion if lengths are very close (e.g., "spatial" vs "spatia")
  if (w.includes(kw) || kw.includes(w)) {
    const lenDiff = Math.abs(w.length - kw.length);
    if (lenDiff <= 2) return true;
  }
  
  const dist = getLevenshteinDistance(w, kw);
  
  // Custom thresholds based on the keyword length to prevent false matches on short words
  if (kw.length <= 3) {
    return dist === 0; // Exact match only for short words like "mom", "dad"
  } else if (kw.length <= 6) {
    return dist <= 1;  // Allow 1 character mismatch for medium words (e.g. "spatia" vs "spatial")
  } else {
    return dist <= 2;  // Allow up to 2 character mismatches for longer words
  }
}

function fuzzyIncludes(transcript: string, keyword: string): boolean {
  const cleanTranscript = transcript.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "").trim();
  const kw = keyword.toLowerCase().trim();
  
  if (cleanTranscript.includes(kw)) return true;
  
  const transcriptWords = cleanTranscript.split(/\s+/).filter(Boolean);
  const keywordWords = kw.split(/\s+/).filter(Boolean);
  
  if (keywordWords.length === 0) return false;
  
  if (keywordWords.length === 1) {
    // Single word: match against each word in the transcript
    return transcriptWords.some(word => isFuzzyMatch(word, kw));
  } else {
    // Multi-word phrase: match using a sliding window
    const windowSize = keywordWords.length;
    for (let i = 0; i <= transcriptWords.length - windowSize; i++) {
      const windowWords = transcriptWords.slice(i, i + windowSize);
      const windowJoined = windowWords.join(' ');
      const dist = getLevenshteinDistance(windowJoined, kw);
      
      const maxAllowedDist = kw.length <= 6 ? 1 : 2;
      if (dist <= maxAllowedDist) {
        return true;
      }
    }
  }
  
  return false;
}
