/**
 * acousticSceneService.ts
 *
 * Manages the acoustic scene detection lifecycle and exposes the current
 * detected place type to the rest of the app.
 *
 * Scene types produced by YAMNet inference:
 *   Office | School | Theatre | Mall | Hall | Public Space |
 *   Outdoors | Nature | Vehicle | Factory | Restaurant | Unknown
 */
import { EmitterSubscription } from 'react-native';
import { acousticSceneNative, acousticSceneEvents, SceneChangedEvent } from '../native/AcousticSceneModule';

export type PlaceType =
  | 'Office'
  | 'School'
  | 'Theatre'
  | 'Mall'
  | 'Hall'
  | 'Public Space'
  | 'Outdoors'
  | 'Nature'
  | 'Vehicle'
  | 'Factory'
  | 'Restaurant'
  | 'Unknown';

// Ionicons name for each place type — shown in the UI
export const PLACE_ICON: Record<string, string> = {
  Office:       'business-outline',
  School:       'school-outline',
  Theatre:      'film-outline',
  Mall:         'cart-outline',
  Hall:         'home-outline',
  'Public Space': 'people-outline',
  Outdoors:     'sunny-outline',
  Nature:       'leaf-outline',
  Vehicle:      'car-outline',
  Factory:      'construct-outline',
  Restaurant:   'restaurant-outline',
  Unknown:      'help-circle-outline',
};

let currentScene: PlaceType = 'Unknown';
let subscription: EmitterSubscription | null = null;
let started = false;

type SceneListener = (place: PlaceType) => void;
const listeners: SceneListener[] = [];

export function onSceneChange(cb: SceneListener): () => void {
  listeners.push(cb);
  return () => {
    const i = listeners.indexOf(cb);
    if (i !== -1) listeners.splice(i, 1);
  };
}

export function getCurrentScene(): PlaceType {
  return currentScene;
}

export async function startSceneDetection(): Promise<void> {
  if (started || !acousticSceneEvents) return;
  started = true;

  subscription = acousticSceneEvents.addListener(
    'onSceneChanged',
    (event: SceneChangedEvent) => {
      currentScene = (event.place as PlaceType) ?? 'Unknown';
      listeners.forEach(cb => cb(currentScene));
    },
  );

  try {
    await acousticSceneNative.startSceneDetection();
    // Get an immediate reading without waiting for the first timer tick
    const initial = await acousticSceneNative.classifyOnce();
    currentScene = (initial as PlaceType) ?? 'Unknown';
    listeners.forEach(cb => cb(currentScene));
  } catch (e) {
    console.warn('[AcousticScene] startSceneDetection error:', e);
  }
}

export async function stopSceneDetection(): Promise<void> {
  if (!started) return;
  started = false;
  subscription?.remove();
  subscription = null;
  await acousticSceneNative.stopSceneDetection().catch(() => {});
  currentScene = 'Unknown';
}
