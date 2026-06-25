/**
 * HomeScreen.tsx
 *
 * Main screen: shows listening state, last detection, and start/stop control.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { startKeywordSpotting, stopKeywordSpotting, isCurrentlyListening } from '../services/kwsService';
import { useDetectionEvents } from '../hooks/useDetectionEvents';
import { DetectionCard } from '../components/DetectionCard';
import { initModels, isModelsReady } from '../services/modelManager';
import { initWhisperEngine, releaseWhisper } from '../services/whisperService';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  startSceneDetection,
  stopSceneDetection,
  getCurrentScene,
  onSceneChange,
  PLACE_ICON,
  PlaceType,
} from '../services/acousticSceneService';
import { COLORS } from '../config/colors';

const SETTINGS_KEY = '@hearing_trigger:settings';
type Phase = 'setup' | 'ready' | 'listening' | 'error';

import { MicIcon, StopIcon, PlayIcon } from '../components/Icons';

export function HomeScreen() {
  const [phase, setPhase] = useState<Phase>('setup');
  const [progress, setProgress] = useState('');
  const [keywords, setKeywords] = useState<string[]>(['test', 'help']);
  const [scene, setScene] = useState<PlaceType>(getCurrentScene);
  const detections = useDetectionEvents(10);
  const activeModelRef = useRef<string>('medium.en-q5_0');
  const navigation = useNavigation<any>();
  const scrollViewRef = useRef<ScrollView>(null);

  // Subscribe to acoustic scene updates
  useEffect(() => onSceneChange(setScene), []);

  // Sync listening phase with KWS service state
  useFocusEffect(
    useCallback(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
      const currentListening = isCurrentlyListening();
      if (!currentListening && phase === 'listening') {
        setPhase('ready');
      }

      if (phase === 'listening' || currentListening) return;

      AsyncStorage.getItem(SETTINGS_KEY).then(async (raw) => {
        if (!raw) return;
        try {
          const s = JSON.parse(raw);
          if (s.keywords) {
            setKeywords(s.keywords);
          } else if (s.keyword) {
            setKeywords([s.keyword]);
          }

          const newModel = s.whisperModel || 'medium.en-q5_0';
          if (newModel !== activeModelRef.current) {
            activeModelRef.current = newModel;
            setPhase('setup');
            setProgress('Releasing old model…');
            await releaseWhisper();

            setProgress('Checking new model…');
            const ready = await isModelsReady();
            if (!ready) {
              await initModels((p) => setProgress(`Downloading ${p.file}… ${p.percent}%`));
            }

            setProgress('Warming up Whisper…');
            await initWhisperEngine();
            setPhase('ready');
            setProgress('');
          }
        } catch (err) {
          console.error(err);
          setPhase('error');
          setProgress('Model switch failed.');
        }
      });
    }, [phase])
  );

  // Download & warm models on mount
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(SETTINGS_KEY);
        if (raw) {
          try {
            const s = JSON.parse(raw);
            if (s.whisperModel) {
              activeModelRef.current = s.whisperModel;
            }
          } catch { }
        }
        const ready = await isModelsReady();
        if (!ready) {
          await initModels((p) => setProgress(`Downloading ${p.file}… ${p.percent}%`));
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
    if (phase === 'setup') return;
    if (phase === 'listening') {
      await stopKeywordSpotting();
      await stopSceneDetection();
      setPhase('ready');
      const raw = await AsyncStorage.getItem(SETTINGS_KEY);
      if (raw) {
        try {
          const s = JSON.parse(raw);
          if (s.keywords) {
            setKeywords(s.keywords);
          } else if (s.keyword) {
            setKeywords([s.keyword]);
          }
        } catch { }
      }
    } else if (phase === 'ready') {
      const raw = await AsyncStorage.getItem(SETTINGS_KEY);
      let kws = keywords;
      if (raw) {
        try {
          const s = JSON.parse(raw);
          kws = s.keywords || (s.keyword ? [s.keyword] : keywords);
        } catch { }
      }
      setKeywords(kws);
      await startKeywordSpotting(kws);
      startSceneDetection();
      setPhase('listening');
    }
  };

  const keywordsString = keywords.map(w => `"${w}"`).join(', ');

  const renderCircleContent = () => {
    if (phase === 'setup') {
      return <ActivityIndicator size="large" color={COLORS.primary} />;
    }
    const isListening = phase === 'listening';
    return (
      <MicIcon
        color={isListening ? COLORS.secondary : '#9CA3AF'}
        size={36}
      />
    );
  };

  return (
    <ScrollView ref={scrollViewRef} style={styles.root} contentContainerStyle={styles.content}>
      {/* 1. Mic Button / Loader Container */}
      <View style={styles.micCircleWrapper}>
        <TouchableOpacity
          style={[
            styles.micOuterCircle,
            phase === 'listening' ? styles.micOuterActive : styles.micOuterIdle,
            phase === 'setup' && styles.micOuterSetup,
          ]}
          onPress={handleToggle}
          disabled={phase === 'setup'}
        >
          <View style={[
            styles.micInnerCircle,
            phase === 'listening' && { borderColor: COLORS.secondary },
          ]}>
            {renderCircleContent()}
          </View>
        </TouchableOpacity>
      </View>

      {/* 2. Status Label and Main Text */}
      <View style={styles.statusContainer}>
        {phase === 'setup' && (
          <>
            <Text style={styles.statusHeaderLabel}>Preparing Models</Text>
            <Text style={styles.statusMainText}>{progress || 'Checking files…'}</Text>
          </>
        )}
        {phase === 'ready' && (
          <>
            <Text style={styles.statusHeaderLabel}>Mic Inactive</Text>
            <Text style={styles.statusMainText}>Tap mic or button to start</Text>
          </>
        )}
        {phase === 'listening' && (
          <>
            <Text style={styles.statusHeaderLabel}>Active Listening</Text>
            <Text style={styles.statusMainText}>
              Listening for <Text style={styles.keywordHighlight}>{keywordsString}</Text>
            </Text>
            <View style={styles.sceneBadge}>
              <Ionicons
                name={PLACE_ICON[scene] ?? 'help-circle-outline'}
                size={16}
                color={COLORS.secondary}
                style={styles.sceneIcon}
              />
              <Text style={styles.sceneBadgeText}>
                {scene === 'Unknown' ? 'Analyzing environment...' : scene}
              </Text>
            </View>
          </>
        )}
        {phase === 'error' && (
          <>
            <Text style={styles.statusHeaderLabel}>Setup Error</Text>
            <Text style={styles.statusMainText}>Model Switch failed</Text>
          </>
        )}
      </View>

      {/* 3. Control Button */}
      {phase !== 'setup' && (
        <TouchableOpacity
          style={[
            styles.controlBtn,
            phase === 'listening' ? styles.controlBtnStop : styles.controlBtnStart,
          ]}
          onPress={handleToggle}
        >
          <View style={styles.controlIconContainer}>
            {phase === 'listening' ? <StopIcon /> : <PlayIcon />}
          </View>
          <Text style={styles.controlBtnText}>
            {phase === 'listening' ? 'Stop Listening' : 'Start Listening'}
          </Text>
        </TouchableOpacity>
      )}

      {/* 4. Recent Detections Divider */}
      <View style={styles.dividerContainer}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>Recent Detections</Text>
        <View style={styles.dividerLine} />
      </View>

      {/* 5. Detections List */}
      <View style={styles.detectionsContainer}>
        {detections.slice(0, 3).map((d) => (
          <DetectionCard key={d.id} item={d} />
        ))}
        {detections.length === 0 && (
          <Text style={styles.waitText}>
            {phase === 'listening'
              ? `Waiting to hear ${keywordsString}…`
              : 'No detections yet. Start listening above.'}
          </Text>
        )}
      </View>

      {/* 6. View Full History Link */}
      {detections.length > 3 && (
        <TouchableOpacity
          style={styles.fullHistoryLink}
          onPress={() => navigation.navigate('History')}
        >
          <Text style={styles.fullHistoryText}>View full history</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.neutral,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    alignItems: 'center',
  },
  micCircleWrapper: {
    marginVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micOuterCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    // elevation: 4,
  },
  micOuterActive: {
    backgroundColor: '#d2ece7',
  },
  micOuterIdle: {
    backgroundColor: '#F3F4F6',
  },
  micOuterSetup: {
    backgroundColor: '#F9FAFB',
  },
  micInnerCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statusContainer: {
    alignItems: 'center',
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  statusHeaderLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  statusMainText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    lineHeight: 26,
  },
  keywordHighlight: {
    color: COLORS.primary,
    fontStyle: 'italic',
  },
  controlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 32,
    alignSelf: 'center',
  },
  controlBtnStart: {
    backgroundColor: COLORS.secondary,
  },
  controlBtnStop: {
    backgroundColor: COLORS.primary,
  },
  controlIconContainer: {
    marginRight: 10,
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    marginHorizontal: 12,
  },
  detectionsContainer: {
    width: '100%',
    marginBottom: 16,
  },
  waitText: {
    fontSize: 14,
    color: '#6B7280',
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: 20,
  },
  fullHistoryLink: {
    paddingVertical: 12,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullHistoryText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary,
  },
  sceneBadge: {
    marginTop: 10,
    backgroundColor: COLORS.secondaryBg,
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sceneIcon: {
    marginRight: 6,
  },
  sceneBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.secondary,
  },
});
