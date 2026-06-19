/**
 * detectionStore.ts
 *
 * Persist detection events locally using AsyncStorage.
 * Max 200 records kept (newest first).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {Detection} from '../types/detection';

const STORAGE_KEY = '@hearing_trigger:detections';
const MAX_RECORDS = 200;

export async function saveDetection(entry: Detection): Promise<void> {
  const existing = await getDetections();
  const updated = [entry, ...existing].slice(0, MAX_RECORDS);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export async function getDetections(): Promise<Detection[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function clearDetections(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

export async function updateDetectionTranscript(id: string, transcript: string): Promise<void> {
  const items = await getDetections();
  const updated = items.map(d =>
    d.id === id ? {...d, transcript, confirmed: transcript.length > 2} : d,
  );
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}
