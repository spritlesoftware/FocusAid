/**
 * usePermissions.ts
 *
 * Requests RECORD_AUDIO (Android) and Microphone (iOS).
 */
import {useState, useCallback} from 'react';
import {Platform} from 'react-native';
import {check, request, PERMISSIONS, RESULTS, Permission} from 'react-native-permissions';

export type PermStatus = 'unknown' | 'granted' | 'denied' | 'blocked';

export function usePermissions() {
  const [micStatus, setMicStatus] = useState<PermStatus>('unknown');

  const micPermission: Permission = Platform.select({
    android: PERMISSIONS.ANDROID.RECORD_AUDIO,
    ios:     PERMISSIONS.IOS.MICROPHONE,
    default: PERMISSIONS.ANDROID.RECORD_AUDIO,
  });

  const checkMic = useCallback(async () => {
    const result = await check(micPermission);
    const mapped = mapResult(result);
    setMicStatus(mapped);
    return mapped;
  }, [micPermission]);

  const requestMic = useCallback(async () => {
    const result = await request(micPermission);
    const mapped = mapResult(result);
    setMicStatus(mapped);
    return mapped;
  }, [micPermission]);

  return {micStatus, checkMic, requestMic};
}

function mapResult(r: string): PermStatus {
  switch (r) {
    case RESULTS.GRANTED:   return 'granted';
    case RESULTS.DENIED:    return 'denied';
    case RESULTS.BLOCKED:   return 'blocked';
    default:                return 'unknown';
  }
}
