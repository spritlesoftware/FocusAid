/**
 * PermissionGate.tsx
 *
 * Shows a prompt if microphone permission is not granted.
 */
import React, {useEffect} from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {usePermissions} from '../hooks/usePermissions';
import {COLORS} from '../config/colors';

interface Props {
  children: React.ReactNode;
}

export function PermissionGate({children}: Props) {
  const {micStatus, checkMic, requestMic} = usePermissions();

  useEffect(() => { checkMic(); }, [checkMic]);

  if (micStatus === 'granted') return <>{children}</>;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Microphone Access Required</Text>
      <Text style={styles.body}>
        This app listens locally for your trigger word. Audio is never sent to
        any server.
      </Text>
      {micStatus === 'blocked' ? (
        <Text style={styles.hint}>
          Microphone access is blocked. Please enable it in your device Settings.
        </Text>
      ) : (
        <TouchableOpacity style={styles.button} onPress={requestMic}>
          <Text style={styles.buttonText}>Grant Microphone Access</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: COLORS.neutral},
  title:     {fontSize: 22, fontWeight: '700', marginBottom: 16, textAlign: 'center', color: COLORS.tertiary},
  body:      {fontSize: 15, color: COLORS.tertiary, textAlign: 'center', marginBottom: 24, maxWidth: 320},
  hint:      {fontSize: 14, color: COLORS.primary, textAlign: 'center'},
  button:    {backgroundColor: COLORS.primary, paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12},
  buttonText:{color: COLORS.white, fontSize: 16, fontWeight: '600'},
});
