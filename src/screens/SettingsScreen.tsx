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
import { updateThreshold, stopKeywordSpotting } from "../services/kwsService";
import { COLORS } from "../config/colors";

const SETTINGS_KEY = "@hearing_trigger:settings";

export function SettingsScreen() {
  const [keywords, setKeywords] = useState<string[]>(["test", "help"]);
  const [customInput, setCustomInput] = useState("");
  const [threshold, setThreshold] = useState("0.5");
  const [cooldown, setCooldown] = useState("6000");
  const [useWhisper, setUseWhisper] = useState(true);
  const [enableDebugLogs, setEnableDebugLogs] = useState(false);
  const [whisperModel, setWhisperModel] = useState("tiny.en");

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
        if (s.enableDebugLogs != null) setEnableDebugLogs(s.enableDebugLogs);
        if (s.whisperModel != null) setWhisperModel(s.whisperModel);
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
      enableDebugLogs,
      whisperModel,
    };
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(parsed));
    await updateThreshold(parsed.threshold);
    await stopKeywordSpotting();
    Alert.alert(
      "Saved",
      "Settings updated. Listening stopped. Restart listening to apply changes.",
    );
  };

  const saveKeywordsDirectly = async (updatedKeywords: string[]) => {
    let currentSettings: any = {};
    try {
      const raw = await AsyncStorage.getItem(SETTINGS_KEY);
      if (raw) {
        currentSettings = JSON.parse(raw);
      }
    } catch {}

    const merged = {
      ...currentSettings,
      keywords: updatedKeywords.map((w) => w.toLowerCase().trim()),
      threshold: currentSettings.threshold ?? parseFloat(threshold) ?? 0.5,
      cooldownMs: currentSettings.cooldownMs ?? parseInt(cooldown, 10) ?? 6000,
      useWhisper: currentSettings.useWhisper ?? useWhisper,
      enableDebugLogs: currentSettings.enableDebugLogs ?? enableDebugLogs,
      whisperModel: currentSettings.whisperModel ?? whisperModel,
    };

    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
    await updateThreshold(merged.threshold);
    await stopKeywordSpotting();
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
    const updated = [...keywords, val];
    setKeywords(updated);
    setCustomInput("");
    saveKeywordsDirectly(updated);
  };

  const removeKeyword = (word: string) => {
    const updated = keywords.filter((w) => w !== word);
    setKeywords(updated);
    saveKeywordsDirectly(updated);
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

      <Text style={styles.sectionLabel}>Sensitivity Threshold</Text>
      <Text style={styles.hint}>
        0.3 = more sensitive (more false positives). 0.7 = strict (fewer
        alerts). Default 0.5 is a good start.
      </Text>
      <TextInput
        style={styles.input}
        value={threshold}
        onChangeText={async (val) => {
          setThreshold(val);
          await stopKeywordSpotting();
        }}
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
        onChangeText={async (val) => {
          setCooldown(val);
          await stopKeywordSpotting();
        }}
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
          onValueChange={async (val) => {
            setUseWhisper(val);
            await stopKeywordSpotting();
          }}
          thumbColor={useWhisper ? COLORS.secondary : COLORS.grayThumb}
          trackColor={{ true: COLORS.secondaryLight, false: COLORS.grayTrack }}
        />
      </View>

      {useWhisper && (
        <>
          <Text style={styles.sectionLabel}>Whisper Model Size</Text>
          <Text style={styles.hint}>
            Larger models offer higher transcription accuracy but require more
            disk space, longer download times, and higher memory/CPU usage.
          </Text>
          <View style={styles.chipsContainer}>
            {(["tiny.en", "base.en", "small.en", "medium.en"] as const).map(
              (key) => {
                const isActive = whisperModel === key;
                let label = "";
                let size = "";
                if (key === "tiny.en") {
                  label = "Tiny";
                  size = "75 MB";
                } else if (key === "base.en") {
                  label = "Base";
                  size = "142 MB";
                } else if (key === "small.en") {
                  label = "Small";
                  size = "466 MB";
                } else if (key === "medium.en") {
                  label = "Medium";
                  size = "1.53 GB";
                }

                return (
                  <TouchableOpacity
                    key={key}
                    style={[
                      styles.modelChip,
                      isActive && styles.modelChipActive,
                    ]}
                    onPress={async () => {
                      setWhisperModel(key);
                      await stopKeywordSpotting();
                    }}
                  >
                    <Text
                      style={[
                        styles.modelChipText,
                        isActive && styles.modelChipTextActive,
                      ]}
                    >
                      {label}
                    </Text>
                    <Text
                      style={[
                        styles.modelSizeText,
                        isActive && styles.modelSizeTextActive,
                      ]}
                    >
                      {size}
                    </Text>
                  </TouchableOpacity>
                );
              },
            )}
          </View>
        </>
      )}

      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionLabel}>Enable Debug Logs</Text>
          <Text style={styles.hint}>
            Print key verification and transcription logs (helpful for local
            debugging).
          </Text>
        </View>
        <Switch
          value={enableDebugLogs}
          onValueChange={async (val) => {
            setEnableDebugLogs(val);
            await stopKeywordSpotting();
          }}
          thumbColor={enableDebugLogs ? COLORS.secondary : COLORS.grayThumb}
          trackColor={{ true: COLORS.secondaryLight, false: COLORS.grayTrack }}
        />
      </View>

      <TouchableOpacity style={styles.saveBtn} onPress={saveSettings}>
        <Text style={styles.saveBtnText}>Save Settings</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.neutral },
  content: { padding: 24, paddingBottom: 48 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.tertiary,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 24,
  },
  hint: { fontSize: 14, color: COLORS.tertiary, marginBottom: 12, lineHeight: 20 },
  activeTagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginVertical: 8,
  },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.secondaryBg,
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: COLORS.secondary,
  },
  tagText: { fontSize: 14, color: COLORS.secondary, fontWeight: "600" },
  tagRemoveBtn: {
    marginLeft: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.secondaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  tagRemoveText: {
    fontSize: 12,
    color: COLORS.secondary,
    fontWeight: "700",
    marginTop: -2,
  },
  noWordsText: {
    fontSize: 14,
    color: COLORS.tertiary,
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
    backgroundColor: COLORS.secondary,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  addBtnText: { color: COLORS.white, fontSize: 15, fontWeight: "700" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  chip: {
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 14,
    backgroundColor: COLORS.grayLight,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
  },
  chipActive: { backgroundColor: COLORS.secondary, borderColor: COLORS.secondary },
  chipText: { fontSize: 14, color: COLORS.tertiary },
  chipTextActive: { color: COLORS.white, fontWeight: "600" },
  input: {
    backgroundColor: COLORS.white,
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
    marginBottom: 8,
  },
  row: { flexDirection: "row", alignItems: "center", marginTop: 44 },
  saveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 32,
  },
  saveBtnText: { color: COLORS.white, fontSize: 17, fontWeight: "700" },
  chipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginVertical: 10,
  },
  modelChip: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  modelChipActive: {
    backgroundColor: COLORS.secondary,
    borderColor: COLORS.secondary,
  },
  modelChipText: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.tertiary,
    marginBottom: 2,
  },
  modelChipTextActive: {
    color: COLORS.white,
  },
  modelSizeText: {
    fontSize: 12,
    color: COLORS.tertiary,
  },
  modelSizeTextActive: {
    color: COLORS.secondaryBg,
  },
  warningBox: {
    backgroundColor: COLORS.primaryBg,
    borderColor: COLORS.primaryBorder,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    marginBottom: 16,
  },
  warningText: {
    color: COLORS.primary,
    fontSize: 13,
    lineHeight: 18,
  },
  infoBox: {
    backgroundColor: COLORS.secondaryLightBg,
    borderColor: COLORS.secondaryLight,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    marginBottom: 16,
  },
  infoText: {
    color: COLORS.secondary,
    fontSize: 13,
    lineHeight: 18,
  },
});
