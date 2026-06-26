/**
 * SettingsScreen.tsx
 *
 * Lets the user configure multiple trigger words, sensitivity threshold, and cooldown.
 * Settings are persisted to AsyncStorage and re-loaded on mount.
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Switch,
  TouchableOpacity,
  ScrollView,
  Alert,
  ImageBackground,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { updateThreshold, stopKeywordSpotting } from "../services/kwsService";
import { clearDetections } from "../services/detectionStore";
import { COLORS } from "../config/colors";

const SETTINGS_KEY = "@hearing_trigger:settings";
const PRESET_KEYWORDS = ["priya", "aarav", "grandma", "mom", "dad", "help"];

import {
  KeyIcon,
  GearIcon as VolumeIcon, // We can map GearIcon/VolumeIcon appropriately
  ClockIcon,
  MessageSquareIcon,
  ListIcon,
  TrashIcon,
  ChevronUpIcon,
  ChevronDownIcon,
} from "../components/Icons";

interface IconProps {
  name: string;
  size?: number;
  color?: string;
  style?: any;
}

function Icon({ name, size = 18, color = "#9D2B7A", style }: IconProps) {
  if (name === "key")
    return <KeyIcon size={size} color={color} style={style} />;
  // Note: For volume/sensitivity we will use the custom styled SpeakerIcon inside Icons.tsx which was named VolumeIcon
  if (name === "volume-2")
    return <VolumeIcon size={size} color={color} style={style} />;
  if (name === "clock")
    return <ClockIcon size={size} color={color} style={style} />;
  if (name === "message-square")
    return <MessageSquareIcon size={size} color={color} style={style} />;
  if (name === "list")
    return <ListIcon size={size} color={color} style={style} />;
  if (name === "trash-2")
    return <TrashIcon size={size} color={color} style={style} />;
  if (name === "chevron-up")
    return <ChevronUpIcon size={size} color={color} style={style} />;
  if (name === "chevron-down")
    return <ChevronDownIcon size={size} color={color} style={style} />;
  return null;
}
// Custom Slider component using parent touch responder to avoid jumpiness
interface SensitivitySliderProps {
  value: number;
  onChange: (val: number) => void;
  onComplete: (val: number) => void;
}

function SensitivitySlider({
  value,
  onChange,
  onComplete,
}: SensitivitySliderProps) {
  const min = 0.3;
  const max = 0.7;
  const [width, setWidth] = useState(0);

  const getPercent = (val: number) => {
    return (val - min) / (max - min);
  };

  const handleTouch = (locationX: number, isRelease = false) => {
    if (width <= 0) return;
    const pct = Math.max(0, Math.min(1, locationX / width));
    const newVal = min + pct * (max - min);
    const roundedVal = Math.round(newVal * 10) / 10;
    onChange(roundedVal);
    if (isRelease) {
      onComplete(roundedVal);
    }
  };

  const percent = getPercent(value);

  return (
    <View
      style={sliderStyles.container}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(evt) => handleTouch(evt.nativeEvent.locationX)}
      onResponderMove={(evt) => handleTouch(evt.nativeEvent.locationX)}
      onResponderRelease={(evt) => handleTouch(evt.nativeEvent.locationX, true)}
    >
      <View style={sliderStyles.track} pointerEvents="none" />
      <View
        style={[sliderStyles.activeTrack, { width: `${percent * 100}%` }]}
        pointerEvents="none"
      />
      <View
        style={[sliderStyles.thumb, { left: percent * width - 12 }]}
        pointerEvents="none"
      />
    </View>
  );
}

const sliderStyles = StyleSheet.create({
  container: {
    height: 32,
    justifyContent: "center",
    position: "relative",
    width: "100%",
    marginVertical: 12,
  },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.grayTrack,
    width: "100%",
    position: "absolute",
    top: 13,
  },
  activeTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.secondary,
    position: "absolute",
    left: 0,
    top: 13,
  },
  thumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.secondary,
    position: "absolute",
    top: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
});

// Custom Stepper component
interface CooldownStepperProps {
  value: number;
  onChange: (val: number) => void;
}

function CooldownStepper({ value, onChange }: CooldownStepperProps) {
  const handleIncrement = () => {
    onChange(value + 1);
  };

  const handleDecrement = () => {
    if (value > 1) {
      onChange(value - 1);
    }
  };

  return (
    <View style={stepperStyles.container}>
      <TextInput
        style={stepperStyles.input}
        value={String(value)}
        onChangeText={(text) => {
          const parsed = parseInt(text, 10);
          if (!isNaN(parsed)) {
            onChange(parsed);
          } else if (text === "") {
            onChange(0);
          }
        }}
        keyboardType="number-pad"
      />
      <View style={stepperStyles.buttons}>
        <TouchableOpacity style={stepperStyles.btn} onPress={handleIncrement}>
          <Icon name="chevron-up" size={14} color={COLORS.secondary} />
        </TouchableOpacity>
        <TouchableOpacity style={stepperStyles.btn} onPress={handleDecrement}>
          <Icon name="chevron-down" size={14} color={COLORS.secondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const stepperStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.neutral,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
    borderRadius: 10,
    width: 120,
    height: 48,
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    paddingVertical: 0,
  },
  buttons: {
    flexDirection: "column",
    justifyContent: "space-between",
    alignItems: "center",
    height: "100%",
    paddingVertical: 4,
    borderLeftWidth: 1,
    borderLeftColor: COLORS.grayBorder,
    paddingLeft: 8,
  },
  btn: {
    paddingVertical: 2,
    justifyContent: "center",
    alignItems: "center",
  },
});

export function SettingsScreen() {
  const [keywords, setKeywords] = useState<string[]>(["test", "help"]);
  const scrollViewRef = useRef<ScrollView>(null);

  useFocusEffect(
    useCallback(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
    }, []),
  );
  const [customInput, setCustomInput] = useState("");
  const [threshold, setThreshold] = useState("0.5");
  const [cooldown, setCooldown] = useState("6000");
  const [useWhisper, setUseWhisper] = useState(true);
  const [enableDebugLogs, setEnableDebugLogs] = useState(false);
  const [whisperModel, setWhisperModel] = useState("medium.en-q5_0");

  // Load persisted settings on mount
  useEffect(() => {
    AsyncStorage.getItem(SETTINGS_KEY).then((raw) => {
      if (!raw) return;
      try {
        const s = JSON.parse(raw);
        if (s.keywords) {
          setKeywords(s.keywords);
        } else if (s.keyword) {
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

  const autoSaveSettings = async (updates: {
    keywords?: string[];
    threshold?: string;
    cooldown?: string;
    useWhisper?: boolean;
    enableDebugLogs?: boolean;
    whisperModel?: string;
  }) => {
    let currentSettings: any = {};
    try {
      const raw = await AsyncStorage.getItem(SETTINGS_KEY);
      if (raw) currentSettings = JSON.parse(raw);
    } catch {}

    const kws = updates.keywords !== undefined ? updates.keywords : keywords;
    const thresh =
      updates.threshold !== undefined ? updates.threshold : threshold;
    const cool = updates.cooldown !== undefined ? updates.cooldown : cooldown;
    const whisper =
      updates.useWhisper !== undefined ? updates.useWhisper : useWhisper;
    const debug =
      updates.enableDebugLogs !== undefined
        ? updates.enableDebugLogs
        : enableDebugLogs;
    const model =
      updates.whisperModel !== undefined ? updates.whisperModel : whisperModel;

    const merged = {
      keywords: kws.map((w) => w.toLowerCase().trim()),
      threshold: parseFloat(thresh) || 0.5,
      cooldownMs: parseInt(cool, 10) || 6000,
      useWhisper: whisper,
      enableDebugLogs: debug,
      whisperModel: model,
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
    autoSaveSettings({ keywords: updated });
  };

  const toggleKeyword = (word: string) => {
    let updated: string[];
    if (keywords.includes(word)) {
      updated = keywords.filter((w) => w !== word);
    } else {
      updated = [...keywords, word];
    }
    if (updated.length === 0) {
      Alert.alert("Error", "Please keep at least one trigger word active.");
      return;
    }
    setKeywords(updated);
    autoSaveSettings({ keywords: updated });
  };

  const handleSliderComplete = async (val: number) => {
    setThreshold(String(val));
    await autoSaveSettings({ threshold: String(val) });
  };

  const handleCooldownChange = async (val: number) => {
    const ms = val * 1000;
    setCooldown(String(ms));
    await autoSaveSettings({ cooldown: String(ms) });
  };

  const handleWhisperToggle = async (val: boolean) => {
    setUseWhisper(val);
    await autoSaveSettings({ useWhisper: val });
  };

  const handleModelChange = async (model: string) => {
    setWhisperModel(model);
    await autoSaveSettings({ whisperModel: model });
  };

  const handleDebugLogsToggle = async (val: boolean) => {
    setEnableDebugLogs(val);
    await autoSaveSettings({ enableDebugLogs: val });
  };

  const handleClearAll = () => {
    Alert.alert(
      "Clear All History & Settings",
      "Delete all detection history and restore settings to defaults?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            await clearDetections();
            await AsyncStorage.removeItem(SETTINGS_KEY);
            setKeywords(["help"]);
            setThreshold("0.5");
            setCooldown("6000");
            setUseWhisper(true);
            setWhisperModel("medium.en-q5_0");
            setEnableDebugLogs(false);
            await updateThreshold(0.5);
            await stopKeywordSpotting();
          },
        },
      ],
    );
  };

  const displayChips = Array.from(new Set([...PRESET_KEYWORDS, ...keywords]));

  return (
    <ImageBackground
      source={require("../../assets/bg_gradient.png")}
      style={styles.backgroundImage}
    >
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.content}
      >
        {/* 1. Trigger Word Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: "rgba(56, 189, 248, 0.12)" },
              ]}
            >
              <Icon name="key" size={18} color={COLORS.secondary} />
            </View>
            <Text style={[styles.cardTitle, { flex: 1 }]}>Trigger Word</Text>
          </View>

          <Text style={styles.cardDescription}>
            Choose a word that Focus Aid will prioritize for alerts.
          </Text>

          <View style={styles.chipsContainer}>
            {displayChips.map((word) => {
              const isActive = keywords.includes(word);
              const displayWord = word.charAt(0).toUpperCase() + word.slice(1);
              return (
                <TouchableOpacity
                  key={word}
                  style={[
                    styles.chip,
                    isActive ? styles.chipActive : styles.chipInactive,
                  ]}
                  onPress={() => toggleKeyword(word)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      isActive
                        ? styles.chipTextActive
                        : styles.chipTextInactive,
                    ]}
                  >
                    {displayWord}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.inputLabel}>Custom Trigger Word</Text>
          <View style={styles.customInputContainer}>
            <TextInput
              style={styles.customInput}
              value={customInput}
              onChangeText={setCustomInput}
              placeholder="Type a word..."
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={20}
              onSubmitEditing={addCustomKeyword}
            />
            <TouchableOpacity style={styles.addBtn} onPress={addCustomKeyword}>
              <Text style={styles.addBtnText}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 2. Sensitivity Threshold Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: "rgba(56, 189, 248, 0.12)" },
              ]}
            >
              <Icon name="volume-2" size={18} color={COLORS.secondary} />
            </View>
            <Text style={[styles.cardTitle, { flex: 1 }]}>
              Sensitivity Threshold
            </Text>
          </View>

          <Text style={styles.cardDescription}>
            Adjust how sensitive the microphone is to background noise.
          </Text>

          <View style={styles.sliderLabelRow}>
            <Text style={styles.sliderLabelSide}>Low Sensitivity</Text>
            <Text style={styles.sliderValueText}>
              {parseFloat(threshold).toFixed(1)}
            </Text>
            <Text style={styles.sliderLabelSide}>High Sensitivity</Text>
          </View>

          <SensitivitySlider
            value={parseFloat(threshold) || 0.5}
            onChange={(val) => setThreshold(String(val))}
            onComplete={handleSliderComplete}
          />

          <View style={styles.sliderTicksRow}>
            <Text style={styles.sliderTickText}>0.3</Text>
            <Text style={styles.sliderTickText}>0.7</Text>
          </View>
        </View>

        {/* 3. Cooldown Period Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: "rgba(56, 189, 248, 0.12)" },
              ]}
            >
              <Icon name="clock" size={18} color={COLORS.secondary} />
            </View>
            <Text style={[styles.cardTitle, { flex: 1 }]}>Cooldown Period</Text>
          </View>

          <Text style={styles.cardDescription}>
            Wait time between repeat alerts for the same word.
          </Text>

          <Text style={styles.inputLabel}>Seconds</Text>
          <View style={styles.cooldownRow}>
            <CooldownStepper
              value={Math.round((parseInt(cooldown, 10) || 6000) / 1000)}
              onChange={handleCooldownChange}
            />
            <Text style={styles.cooldownRecommended}>Recommended: 38s</Text>
          </View>
        </View>

        {/* 4. Transcribe with Whisper Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: "rgba(56, 189, 248, 0.12)" },
              ]}
            >
              <Icon name="message-square" size={18} color={COLORS.secondary} />
            </View>
            <Text style={[styles.cardTitle, { flex: 1 }]}>
              Transcribe with Whisper
            </Text>
            <Switch
              value={useWhisper}
              onValueChange={handleWhisperToggle}
              thumbColor={useWhisper ? COLORS.secondary : "#9CA3AF"}
              trackColor={{
                true: COLORS.primaryLightBg,
                false: COLORS.grayTrack,
              }}
              style={{ marginLeft: 8 }}
            />
          </View>

          <Text style={styles.cardDescription}>
            AI-powered transcription for higher accuracy.
          </Text>

          {useWhisper && (
            <View style={styles.whisperModelSection}>
              <Text style={styles.whisperModelTitle}>Whisper Model Size</Text>
              <Text style={styles.whisperModelDesc}>
                Larger models offer higher transcription accuracy but require
                more disk space, longer download times, and higher memory/CPU
                usage.
              </Text>
              <View style={styles.modelChipsGrid}>
                <View style={styles.modelChipsRow}>
                  <TouchableOpacity
                    style={[styles.modelChip, styles.modelChipActive]}
                    disabled={true}
                  >
                    <Text
                      style={[styles.modelChipText, styles.modelChipTextActive]}
                    >
                      Medium (Quantized)
                    </Text>
                    <Text
                      style={[styles.modelSizeText, styles.modelSizeTextActive]}
                    >
                      510 MB (Bundled Offline)
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* 5. Enable Debug Logs Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: "rgba(56, 189, 248, 0.12)" },
              ]}
            >
              <Icon name="list" size={18} color={COLORS.secondary} />
            </View>
            <Text style={[styles.cardTitle, { flex: 1 }]}>
              Enable Debug Logs
            </Text>
            <Switch
              value={enableDebugLogs}
              onValueChange={handleDebugLogsToggle}
              thumbColor={enableDebugLogs ? COLORS.secondary : "#9CA3AF"}
              trackColor={{
                true: COLORS.primaryLightBg,
                false: COLORS.grayTrack,
              }}
              style={{ marginLeft: 8 }}
            />
          </View>
          <Text style={styles.cardDescription}>
            Print key verification and transcription logs (helpful for local
            debugging).
          </Text>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* 6. Clear All History & Settings */}
        <TouchableOpacity style={styles.clearBtn} onPress={handleClearAll}>
          <Icon
            name="trash-2"
            size={18}
            color="#EF4444"
            style={{ marginRight: 8 }}
          />
          <Text style={styles.clearBtnText}>Clear All History & Settings</Text>
        </TouchableOpacity>
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  scrollView: {
    flex: 1,
    backgroundColor: "transparent",
    marginBottom: 96,
  },
  root: {
    flex: 1,
    backgroundColor: COLORS.neutral,
  },
  content: {
    padding: 16,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    marginLeft: 12,
  },
  cardDescription: {
    fontSize: 14,
    color: COLORS.tertiary,
    lineHeight: 20,
    marginTop: 4,
    marginBottom: 16,
  },
  chipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
  },
  chipActive: {
    backgroundColor: COLORS.secondary,
    borderColor: COLORS.secondary,
  },
  chipInactive: {
    backgroundColor: COLORS.neutral,
    borderColor: COLORS.grayBorder,
  },
  chipText: {
    fontSize: 14,
    fontWeight: "600",
  },
  chipTextActive: {
    color: COLORS.neutral,
  },
  chipTextInactive: {
    color: COLORS.tertiary,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.tertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  customInputContainer: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  customInput: {
    flex: 1,
    backgroundColor: COLORS.neutral,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 15,
    color: "#FFFFFF",
  },
  addBtn: {
    backgroundColor: COLORS.secondary,
    borderRadius: 10,
    paddingHorizontal: 20,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  addBtnText: {
    color: COLORS.neutral,
    fontSize: 15,
    fontWeight: "700",
  },
  sliderLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  sliderLabelSide: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.tertiary,
  },
  sliderValueText: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.secondary,
  },
  sliderTicksRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: -4,
  },
  sliderTickText: {
    fontSize: 12,
    color: COLORS.tertiary,
  },
  cooldownRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  cooldownRecommended: {
    fontSize: 14,
    color: COLORS.tertiary,
    fontStyle: "italic",
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.grayBorder,
    marginVertical: 16,
  },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#EF4444",
    borderRadius: 12,
    height: 48,
    marginTop: 8,
  },
  clearBtnText: {
    color: "#EF4444",
    fontSize: 15,
    fontWeight: "700",
  },
  whisperModelSection: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.grayBorder,
    paddingTop: 16,
  },
  whisperModelTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  whisperModelDesc: {
    fontSize: 13,
    color: COLORS.tertiary,
    lineHeight: 18,
    marginBottom: 12,
  },
  modelChipsGrid: {
    flexDirection: "column",
    gap: 10,
    width: "100%",
  },
  modelChipsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    width: "100%",
  },
  modelChip: {
    flex: 1,
    backgroundColor: COLORS.neutral,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  modelChipActive: {
    backgroundColor: COLORS.secondary,
    borderColor: COLORS.secondary,
  },
  modelChipText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.tertiary,
    marginBottom: 2,
  },
  modelChipTextActive: {
    color: COLORS.neutral,
  },
  modelSizeText: {
    fontSize: 12,
    color: COLORS.tertiary,
  },
  modelSizeTextActive: {
    color: COLORS.neutral,
  },
});
