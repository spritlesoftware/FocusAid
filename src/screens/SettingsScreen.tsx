/**
 * SettingsScreen.tsx
 *
 * Lets the user configure trigger word, sensitivity threshold, and cooldown.
 * Settings are persisted to AsyncStorage and re-loaded on mount.
 */
import React, {useState, useEffect} from 'react';
import {
  View, Text, TextInput, StyleSheet, Switch, TouchableOpacity, ScrollView, Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {updateThreshold} from '../services/kwsService';

const PRESET_WORDS = ['Priya', 'Aarav', 'Grandma', 'Mom', 'Dad', 'Help'];

const SETTINGS_KEY = '@hearing_trigger:settings';

export function SettingsScreen() {
  const [keyword, setKeyword]       = useState('priya');
  const [threshold, setThreshold]   = useState('0.5');
  const [cooldown, setCooldown]     = useState('6000');
  const [useWhisper, setUseWhisper] = useState(true);

  // Load persisted settings on mount
  useEffect(() => {
    AsyncStorage.getItem(SETTINGS_KEY).then(raw => {
      if (!raw) return;
      try {
        const s = JSON.parse(raw);
        if (s.keyword)    setKeyword(s.keyword);
        if (s.threshold != null) setThreshold(String(s.threshold));
        if (s.cooldownMs != null) setCooldown(String(s.cooldownMs));
        if (s.useWhisper != null) setUseWhisper(s.useWhisper);
      } catch {}
    });
  }, []);

  const saveSettings = async () => {
    const parsed = {
      keyword:    keyword.toLowerCase().trim(),
      threshold:  parseFloat(threshold) || 0.5,
      cooldownMs: parseInt(cooldown, 10) || 6000,
      useWhisper,
    };
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(parsed));
    await updateThreshold(parsed.threshold);
    Alert.alert('Saved', 'Settings updated. Restart listening to apply keyword change.');
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.sectionLabel}>Trigger Word</Text>
      <Text style={styles.hint}>
        Choose a name or short word to listen for. Simple 1–2 syllable words
        work best in noisy environments.
      </Text>

      {/* Preset chips */}
      <View style={styles.chips}>
        {PRESET_WORDS.map(w => (
          <TouchableOpacity
            key={w}
            style={[styles.chip, keyword === w.toLowerCase() && styles.chipActive]}
            onPress={() => setKeyword(w.toLowerCase())}>
            <Text style={[styles.chipText, keyword === w.toLowerCase() && styles.chipTextActive]}>
              {w}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Custom input */}
      <TextInput
        style={styles.input}
        value={keyword}
        onChangeText={v => setKeyword(v.toLowerCase())}
        placeholder="Or type your own…"
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={20}
      />

      <Text style={styles.sectionLabel}>Sensitivity Threshold</Text>
      <Text style={styles.hint}>
        0.3 = more sensitive (more false positives). 0.7 = strict (fewer alerts).
        Default 0.5 is a good start.
      </Text>
      <TextInput
        style={styles.input}
        value={threshold}
        onChangeText={setThreshold}
        keyboardType="decimal-pad"
        placeholder="0.5"
      />

      <Text style={styles.sectionLabel}>Cooldown (ms)</Text>
      <Text style={styles.hint}>
        Minimum time between alerts. 6000 ms = one alert per 6 seconds max.
      </Text>
      <TextInput
        style={styles.input}
        value={cooldown}
        onChangeText={setCooldown}
        keyboardType="number-pad"
        placeholder="6000"
      />

      <View style={styles.row}>
        <View style={{flex: 1}}>
          <Text style={styles.sectionLabel}>Transcribe with Whisper</Text>
          <Text style={styles.hint}>
            Shows what was said around the trigger word and confirms the keyword.
          </Text>
        </View>
        <Switch
          value={useWhisper}
          onValueChange={setUseWhisper}
          thumbColor={useWhisper ? '#01696f' : '#ccc'}
          trackColor={{true: '#cedcd8', false: '#eee'}}
        />
      </View>

      <TouchableOpacity style={styles.saveBtn} onPress={saveSettings}>
        <Text style={styles.saveBtnText}>Save Settings</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root:           {flex: 1, backgroundColor: '#f7f6f2'},
  content:        {padding: 24, paddingBottom: 48},
  sectionLabel:   {fontSize: 13, fontWeight: '700', color: '#7a7974', textTransform: 'uppercase',
                   letterSpacing: 1, marginBottom: 8, marginTop: 24},
  hint:           {fontSize: 14, color: '#7a7974', marginBottom: 12, lineHeight: 20},
  chips:          {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12},
  chip:           {borderRadius: 20, paddingVertical: 7, paddingHorizontal: 14,
                   backgroundColor: '#f3f0ec', borderWidth: 1, borderColor: '#d4d1ca'},
  chipActive:     {backgroundColor: '#01696f', borderColor: '#01696f'},
  chipText:       {fontSize: 14, color: '#28251d'},
  chipTextActive: {color: '#fff', fontWeight: '600'},
  input:          {backgroundColor: '#fff', borderRadius: 10, padding: 14, fontSize: 15,
                   borderWidth: 1, borderColor: '#d4d1ca', marginBottom: 8},
  row:            {flexDirection: 'row', alignItems: 'center', marginTop: 24},
  saveBtn:        {backgroundColor: '#01696f', borderRadius: 14, paddingVertical: 16,
                   alignItems: 'center', marginTop: 32},
  saveBtnText:    {color: '#fff', fontSize: 17, fontWeight: '700'},
});
