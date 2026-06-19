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
import {Platform} from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import {hearingEvents} from '../native/HearingTriggerModule';
import {transcribeClip} from './whisperService';
import {saveDetection, updateDetectionTranscript} from './detectionStore';
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
    // 1. Build draft detection record — transcript undefined = Whisper still pending
    const detection: Detection = {
      id:        `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      keyword:   rawEvent.keyword,
      score:     rawEvent.score,
      timestamp: rawEvent.timestamp ?? Date.now(),
      clipPath:  rawEvent.clipPath,
      transcript: undefined,
      confirmed: false,
    };

    // 2. Haptic fires immediately — hearing aid users need the alert NOW, not after Whisper
    triggerDetectionHaptic();

    // 3. Save draft and notify UI immediately so the card appears right away
    await saveDetection(detection);
    listeners.forEach(cb => cb(detection));

    // 4. Whisper runs in background to confirm keyword and update the UI badge
    if (detection.clipPath) {
      try {
        const transcript = await transcribeClip(detection.clipPath);
        detection.transcript = transcript;
        const kw = detection.keyword.toLowerCase();
        detection.confirmed = transcript.toLowerCase().includes(kw);
        await updateDetectionTranscript(detection.id, transcript);
        listeners.forEach(cb => cb(detection));
      } catch (err) {
        console.warn('[AudioBridge] Whisper error:', err);
        detection.transcript = '';
        await updateDetectionTranscript(detection.id, '');
        listeners.forEach(cb => cb(detection));
      }
    }
  });
}

function triggerDetectionHaptic() {
  const options = {enableVibrateFallback: true, ignoreAndroidSystemSettings: false};
  if (Platform.OS === 'ios') {
    ReactNativeHapticFeedback.trigger('notificationSuccess', options);
  } else {
    ReactNativeHapticFeedback.trigger('impactHeavy', options);
  }
}
