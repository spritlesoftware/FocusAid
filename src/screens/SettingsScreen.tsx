/**
 * SettingsScreen.tsx
 *
 * Lets the user configure multiple trigger words, sensitivity threshold, and cooldown.
 * Settings are persisted to AsyncStorage and re-loaded on mount.
 */
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Switch,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { updateThreshold } from "../services/kwsService";

const PRESET_WORDS = ["Grandma", "Mom", "Dad", "Help"];

const SETTINGS_KEY = "@hearing_trigger:settings";

export function SettingsScreen() {
  const [keywords, setKeywords] = useState<string[]>(["help"]);
  const [customInput, setCustomInput] = useState("");
  const [threshold, setThreshold] = useState("0.5");
  const [cooldown, setCooldown] = useState("6000");
  const [useWhisper, setUseWhisper] = useState(true);

  // Load persisted settings on mount
  useEffect(() => {
    AsyncStorage.getItem(SETTINGS_KEY).then((raw) => {
      if (!raw) return;
      try {
        const s = JSON.parse(raw);
        if (s.keywords) {
          setKeywords(s.keywords);
        } else if (s.keyword) {
          // Migration from single keyword string to keywords array
          setKeywords([s.keyword]);
        }
        if (s.threshold != null) setThreshold(String(s.threshold));
        if (s.cooldownMs != null) setCooldown(String(s.cooldownMs));
        if (s.useWhisper != null) setUseWhisper(s.useWhisper);
      } catch {}
    });
  }, []);

  const saveSettings = async () => {
    if (keywords.length === 0) {
      Alert.alert("Error", "Please add at least one trigger word.");
      return;
    }
    const parsed = {
      keywords: keywords.map((w) => w.toLowerCase().trim()),
      threshold: parseFloat(threshold) || 0.5,
      cooldownMs: parseInt(cooldown, 10) || 6000,
      useWhisper,
    };
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(parsed));
    await updateThreshold(parsed.threshold);
    Alert.alert(
      "Saved",
      "Settings updated. Restart listening to apply keyword changes.",
    );
  };

  const toggleKeyword = (word: string) => {
    const lower = word.toLowerCase().trim();
    if (keywords.includes(lower)) {
      setKeywords((prev) => prev.filter((w) => w !== lower));
    } else {
      setKeywords((prev) => [...prev, lower]);
    }
  };

  const addCustomKeyword = () => {
    const val = customInput.toLowerCase().trim();
    if (!val) return;
    if (keywords.includes(val)) {
      Alert.alert(
        "Duplicate",
        `"${val}" is already in your trigger words list.`,
      );
      return;
    }
    if (val.length > 20) {
      Alert.alert("Too Long", "Trigger words cannot exceed 20 characters.");
      return;
    }
    setKeywords((prev) => [...prev, val]);
    setCustomInput("");
  };

  const removeKeyword = (word: string) => {
    setKeywords((prev) => prev.filter((w) => w !== word));
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.sectionLabel}>Active Trigger Words</Text>
      <Text style={styles.hint}>
        Your device will listen for these words. Tap the "×" on a tag to remove
        it.
      </Text>

      {/* Active tags container */}
      <View style={styles.activeTagsContainer}>
        {keywords.map((w) => (
          <View key={w} style={styles.tag}>
            <Text style={styles.tagText}>{w}</Text>
            <TouchableOpacity
              onPress={() => removeKeyword(w)}
              style={styles.tagRemoveBtn}
            >
              <Text style={styles.tagRemoveText}>×</Text>
            </TouchableOpacity>
          </View>
        ))}
        {keywords.length === 0 && (
          <Text style={styles.noWordsText}>
            No active trigger words. Select or add one below.
          </Text>
        )}
      </View>

      <Text style={styles.sectionLabel}>Add Custom Word</Text>
      <View style={styles.inputContainer}>
        <TextInput
          style={[styles.input, { flex: 1, marginBottom: 0 }]}
          value={customInput}
          onChangeText={setCustomInput}
          placeholder="Type custom word..."
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={20}
          onSubmitEditing={addCustomKeyword}
        />
        <TouchableOpacity style={styles.addBtn} onPress={addCustomKeyword}>
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionLabel}>Preset Options</Text>
      <Text style={styles.hint}>
        Tap to toggle presets into your active trigger list. Simple 1–2 syllable
        words work best.
      </Text>

      {/* Preset chips */}
      <View style={styles.chips}>
        {PRESET_WORDS.map((w) => {
          const lower = w.toLowerCase();
          const isActive = keywords.includes(lower);
          return (
            <TouchableOpacity
              key={w}
              style={[styles.chip, isActive && styles.chipActive]}
              onPress={() => toggleKeyword(w)}
            >
              <Text
                style={[styles.chipText, isActive && styles.chipTextActive]}
              >
                {w}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.sectionLabel}>Sensitivity Threshold</Text>
      <Text style={styles.hint}>
        0.3 = more sensitive (more false positives). 0.7 = strict (fewer
        alerts). Default 0.5 is a good start.
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
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionLabel}>Transcribe with Whisper</Text>
          <Text style={styles.hint}>
            Shows what was said around the trigger word and confirms the
            keyword.
          </Text>
        </View>
        <Switch
          value={useWhisper}
          onValueChange={setUseWhisper}
          thumbColor={useWhisper ? "#01696f" : "#ccc"}
          trackColor={{ true: "#cedcd8", false: "#eee" }}
        />
      </View>

      <TouchableOpacity style={styles.saveBtn} onPress={saveSettings}>
        <Text style={styles.saveBtnText}>Save Settings</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f7f6f2" },
  content: { padding: 24, paddingBottom: 48 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#7a7974",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 24,
  },
  hint: { fontSize: 14, color: "#7a7974", marginBottom: 12, lineHeight: 20 },
  activeTagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginVertical: 8,
  },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e2efeb",
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#01696f",
  },
  tagText: { fontSize: 14, color: "#01696f", fontWeight: "600" },
  tagRemoveBtn: {
    marginLeft: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#cbe0da",
    alignItems: "center",
    justifyContent: "center",
  },
  tagRemoveText: {
    fontSize: 12,
    color: "#01696f",
    fontWeight: "700",
    marginTop: -2,
  },
  noWordsText: {
    fontSize: 14,
    color: "#bab9b4",
    fontStyle: "italic",
    marginVertical: 8,
  },
  inputContainer: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    marginBottom: 8,
  },
  addBtn: {
    backgroundColor: "#01696f",
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  addBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  chip: {
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 14,
    backgroundColor: "#f3f0ec",
    borderWidth: 1,
    borderColor: "#d4d1ca",
  },
  chipActive: { backgroundColor: "#01696f", borderColor: "#01696f" },
  chipText: { fontSize: 14, color: "#28251d" },
  chipTextActive: { color: "#fff", fontWeight: "600" },
  input: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    borderWidth: 1,
    borderColor: "#d4d1ca",
    marginBottom: 8,
  },
  row: { flexDirection: "row", alignItems: "center", marginTop: 24 },
  saveBtn: {
    backgroundColor: "#01696f",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 32,
  },
  saveBtnText: { color: "#fff", fontSize: 17, fontWeight: "700" },
});
