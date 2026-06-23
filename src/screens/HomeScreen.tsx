/**
 * HomeScreen.tsx
 *
 * Main screen: shows listening state, last detection, and start/stop control.
 */
import React, {useState, useEffect, useCallback} from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useFocusEffect} from '@react-navigation/native';
import {startKeywordSpotting, stopKeywordSpotting} from '../services/kwsService';
import {useDetectionEvents} from '../hooks/useDetectionEvents';
import {DetectionCard} from '../components/DetectionCard';
import {initModels, isModelsReady} from '../services/modelManager';
import {initWhisperEngine} from '../services/whisperService';

const SETTINGS_KEY = '@hearing_trigger:settings';

type Phase = 'setup' | 'ready' | 'listening' | 'error';

export function HomeScreen() {
  const [phase, setPhase]       = useState<Phase>('setup');
  const [progress, setProgress] = useState('');
  const [keywords, setKeywords] = useState<string[]>(['priya']);
  const detections              = useDetectionEvents(10);

  // Load persisted keywords from Settings on every focus
  useFocusEffect(
    useCallback(() => {
      if (phase === 'listening') return;
      AsyncStorage.getItem(SETTINGS_KEY).then(raw => {
        if (!raw) return;
        try {
          const s = JSON.parse(raw);
          if (s.keywords) {
            setKeywords(s.keywords);
          } else if (s.keyword) {
            setKeywords([s.keyword]);
          }
        } catch {}
      });
    }, [phase])
  );

  // Download + warm models on mount
  useEffect(() => {
    (async () => {
      try {
        const ready = await isModelsReady();
        if (!ready) {
          await initModels(p => setProgress(`Downloading ${p.file}… ${p.percent}%`));
        }
        setProgress('Warming up Whisper…');
        await initWhisperEngine();
        setPhase('ready');
        setProgress('');
      } catch (e) {
        console.error(e);
        setPhase('error');
        setProgress('Model setup failed.');
      }
    })();
  }, []);

  const handleToggle = async () => {
    if (phase === 'listening') {
      await stopKeywordSpotting();
      setPhase('ready');
      // Load latest keywords from storage since we just stopped
      const raw = await AsyncStorage.getItem(SETTINGS_KEY);
      if (raw) {
        try {
          const s = JSON.parse(raw);
          if (s.keywords) {
            setKeywords(s.keywords);
          } else if (s.keyword) {
            setKeywords([s.keyword]);
          }
        } catch {}
      }
    } else if (phase === 'ready') {
      // Re-read keywords in case Settings changed while we were on another tab
      const raw = await AsyncStorage.getItem(SETTINGS_KEY);
      let kws = keywords;
      if (raw) {
        try {
          const s = JSON.parse(raw);
          kws = s.keywords || (s.keyword ? [s.keyword] : keywords);
        } catch {}
      }
      setKeywords(kws);
      await startKeywordSpotting(kws);
      setPhase('listening');
    }
  };

  const keywordsString = keywords.join(', ');

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      {/* Status row */}
      <View style={styles.statusRow}>
        <View style={[styles.dot, phase === 'listening' ? styles.dotActive : styles.dotIdle]} />
        <Text style={styles.statusText}>
          {phase === 'setup'     && 'Preparing models…'}
          {phase === 'ready'     && 'Ready'}
          {phase === 'listening' && `Listening for "${keywordsString}"`}
          {phase === 'error'     && 'Setup error'}
        </Text>
      </View>

      {/* Progress during model download */}
      {phase === 'setup' && (
        <View style={styles.setupBox}>
          <ActivityIndicator color="#01696f" />
          <Text style={styles.progressText}>{progress}</Text>
        </View>
      )}

      {/* Start / Stop button */}
      {(phase === 'ready' || phase === 'listening') && (
        <TouchableOpacity
          style={[styles.mainBtn, phase === 'listening' ? styles.mainBtnStop : styles.mainBtnStart]}
          onPress={handleToggle}>
          <Text style={styles.mainBtnText}>
            {phase === 'listening' ? 'Stop Listening' : 'Start Listening'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Latest detections */}
      {detections.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>Recent Detections</Text>
          {detections.slice(0, 3).map(d => <DetectionCard key={d.id} item={d} />)}
        </>
      )}

      {phase === 'listening' && detections.length === 0 && (
        <Text style={styles.waitText}>
          Waiting to hear "{keywordsString}"…
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root:         {flex: 1, backgroundColor: '#f7f6f2'},
  content:      {padding: 24, paddingBottom: 48},
  statusRow:    {flexDirection: 'row', alignItems: 'center', marginBottom: 24},
  dot:          {width: 12, height: 12, borderRadius: 6, marginRight: 10},
  dotActive:    {backgroundColor: '#437a22'},
  dotIdle:      {backgroundColor: '#bab9b4'},
  statusText:   {fontSize: 16, color: '#28251d', fontWeight: '600'},
  setupBox:     {alignItems: 'center', paddingVertical: 40, gap: 16},
  progressText: {fontSize: 14, color: '#7a7974', textAlign: 'center'},
  mainBtn:      {borderRadius: 14, paddingVertical: 18, alignItems: 'center', marginBottom: 32},
  mainBtnStart: {backgroundColor: '#01696f'},
  mainBtnStop:  {backgroundColor: '#a12c7b'},
  mainBtnText:  {color: '#fff', fontSize: 18, fontWeight: '700'},
  sectionLabel: {fontSize: 13, fontWeight: '700', color: '#7a7974', textTransform: 'uppercase',
                 letterSpacing: 1, marginBottom: 12},
  waitText:     {textAlign: 'center', color: '#7a7974', marginTop: 40, fontSize: 15},
});
