/**
 * PermissionGate.tsx
 *
 * Shows a prompt if microphone permission is not granted.
 */
import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking, Image } from 'react-native';
import { usePermissions } from '../hooks/usePermissions';
import { COLORS } from '../config/colors';
import { MicIcon } from './Icons';

interface Props {
  children: React.ReactNode;
}

export function PermissionGate({ children }: Props) {
  const { micStatus, checkMic, requestMic } = usePermissions();

  useEffect(() => {
    checkMic();
  }, [checkMic]);

  if (micStatus === 'granted') return <>{children}</>;

  return (
    <View style={styles.container}>
      {/* Top Brand Logo */}
      <View style={styles.brandRow}>
        <View style={styles.brandBox}>
          <Image source={require('../../assets/logo.png')} style={styles.brandLogo} resizeMode="contain" />
        </View>
        <Text style={styles.brandText}>Focus Aid</Text>
      </View>

      {/* Center Content */}
      <View style={styles.centerContent}>
        <View style={styles.micCircle}>
          <MicIcon size={40} color={COLORS.primary} />
        </View>

        <Text style={styles.title}>Microphone Access Required</Text>

        <Text style={styles.body}>
          This app listens locally for your trigger word. Audio is never sent to any server.
        </Text>

        {micStatus === 'blocked' && (
          <Text style={styles.warningHint}>
            Microphone access is blocked. Please enable it in your device settings to continue.
          </Text>
        )}
      </View>

      {/* Bottom Button Container */}
      <View style={styles.buttonContainer}>
        {micStatus === 'blocked' ? (
          <TouchableOpacity style={styles.button} onPress={() => Linking.openSettings()}>
            <Text style={styles.buttonText}>Open Device Settings</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.button} onPress={requestMic}>
            <Text style={styles.buttonText}>Grant Microphone Access</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  brandBox: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  brandLogo: {
    width: 30,
    height: 25,
  },
  brandText: {
    fontSize: 25,
    fontWeight: '700',
    color: COLORS.primary,
    marginLeft: 8,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    // justifyContent: 'center',
    paddingTop: 90,
    paddingHorizontal: 16,
  },
  micCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 32,
  },
  body: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 290,
  },
  warningHint: {
    fontSize: 14,
    color: '#EF4444',
    textAlign: 'center',
    fontWeight: '600',
    marginTop: 20,
    lineHeight: 20,
    maxWidth: 280,
  },
  buttonContainer: {
    width: '100%',
    paddingHorizontal: 8,
  },
  button: {
    backgroundColor: COLORS.primary,
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
