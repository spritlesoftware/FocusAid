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
import {hearingEvents} from '../native/HearingTriggerModule';
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

  hearingEvents.addListener('onKeywordDetected', async rawEvent => {
    if (!rawEvent.clipPath) return;

    try {
      // 1. Transcribe the captured audio clip
      const transcript = await transcribeClip(rawEvent.clipPath);
      
      // Parse active keywords passed from native layer
      const activeKeywords = rawEvent.keyword.toLowerCase().split(',').map(k => k.trim()).filter(Boolean);
      
      // Find the first keyword that matches the transcribed text
      const matchedKeyword = activeKeywords.find(kw => transcript.toLowerCase().includes(kw));
      const confirmed = matchedKeyword !== undefined;

      console.log(`[AudioBridge] KWS Triggered. Active Keywords: ${JSON.stringify(activeKeywords)}`);
      console.log(`[AudioBridge] Whisper Transcript: "${transcript}" | Matched: ${matchedKeyword || 'None'} | Confirmed: ${confirmed}`);

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
      console.warn('[AudioBridge] Whisper error during verification:', err);
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
