/**
 * HomeScreen.tsx
 *
 * Main screen: shows listening state, last detection, and start/stop control.
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Animated,
  Easing,
  ImageBackground,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import {
  startKeywordSpotting,
  stopKeywordSpotting,
  isCurrentlyListening,
} from "../services/kwsService";
import { useDetectionEvents } from "../hooks/useDetectionEvents";
import { DetectionCard } from "../components/DetectionCard";
import { initModels, isModelsReady } from "../services/modelManager";
import { initWhisperEngine, releaseWhisper } from "../services/whisperService";
import Ionicons from "react-native-vector-icons/Ionicons";
import {
  startSceneDetection,
  stopSceneDetection,
  getCurrentScene,
  onSceneChange,
  PLACE_ICON,
  PlaceType,
} from "../services/acousticSceneService";
import { COLORS } from "../config/colors";

const SETTINGS_KEY = "@hearing_trigger:settings";

const SCENE_IMAGES: Record<string, any> = {
  Office: require("../../assets/office.png"),
  School: require("../../assets/school.png"),
  Theatre: require("../../assets/theatre.png"),
  Mall: require("../../assets/mall.png"),
  Hall: require("../../assets/hall.png"),
  "Public Space": require("../../assets/public_space.png"),
  Outdoors: require("../../assets/outdoors.png"),
  Nature: require("../../assets/nature.png"),
  Vehicle: require("../../assets/vehicle.png"),
  Factory: require("../../assets/factory.png"),
  Restaurant: require("../../assets/restaurant.png"),
};

type Phase = "setup" | "ready" | "listening" | "error";

import { MicIcon, StopIcon, PlayIcon } from "../components/Icons";

interface PulseRingProps {
  delay: number;
  active: boolean;
}

function PulseRing({ delay, active }: PulseRingProps) {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      animatedValue.setValue(0);
      return;
    }

    let animation: Animated.CompositeAnimation | null = null;

    const timeoutId = setTimeout(() => {
      animatedValue.setValue(0);
      animation = Animated.loop(
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 2500,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      );
      animation.start();
    }, delay);

    return () => {
      clearTimeout(timeoutId);
      if (animation) {
        animation.stop();
      }
      animatedValue.stopAnimation();
    };
  }, [active, delay, animatedValue]);

  if (!active) return null;

  const scale = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 2.2],
  });

  const opacity = animatedValue.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.6, 0.3, 0],
  });

  return (
    <Animated.View
      style={[
        styles.pulseRing,
        {
          transform: [{ scale }],
          opacity,
        },
      ]}
    />
  );
}

export function HomeScreen() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [progress, setProgress] = useState("");
  const [keywords, setKeywords] = useState<string[]>(["test", "help"]);
  const [scene, setScene] = useState<PlaceType>(getCurrentScene);
  const detections = useDetectionEvents(10);
  const activeModelRef = useRef<string>("medium.en-q5_0");
  const navigation = useNavigation<any>();
  const scrollViewRef = useRef<ScrollView>(null);

  // Subscribe to acoustic scene updates
  useEffect(() => onSceneChange(setScene), []);

  // Sync listening phase with KWS service state
  useFocusEffect(
    useCallback(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
      const currentListening = isCurrentlyListening();
      if (!currentListening && phase === "listening") {
        setPhase("ready");
      }

      if (phase === "listening" || currentListening) return;

      AsyncStorage.getItem(SETTINGS_KEY).then(async (raw) => {
        if (!raw) return;
        try {
          const s = JSON.parse(raw);
          if (s.keywords) {
            setKeywords(s.keywords);
          } else if (s.keyword) {
            setKeywords([s.keyword]);
          }

          const newModel = s.whisperModel || "medium.en-q5_0";
          if (newModel !== activeModelRef.current) {
            activeModelRef.current = newModel;
            setPhase("setup");
            setProgress("Releasing old model…");
            await releaseWhisper();

            setProgress("Checking new model…");
            const ready = await isModelsReady();
            if (!ready) {
              await initModels((p) =>
                setProgress(`Downloading ${p.file}… ${p.percent}%`),
              );
            }

            setProgress("Warming up Whisper…");
            await initWhisperEngine();
            setPhase("ready");
            setProgress("");
          }
        } catch (err) {
          console.error(err);
          setPhase("error");
          setProgress("Model switch failed.");
        }
      });
    }, [phase]),
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
          } catch {}
        }
        const ready = await isModelsReady();
        if (!ready) {
          await initModels((p) =>
            setProgress(`Downloading ${p.file}… ${p.percent}%`),
          );
        }
        setProgress("Warming up Whisper…");
        await initWhisperEngine();
        setPhase("ready");
        setProgress("");
      } catch (e) {
        console.error(e);
        setPhase("error");
        setProgress("Model setup failed.");
      }
    })();
  }, []);

  const handleToggle = async () => {
    if (phase === "setup") return;
    if (phase === "listening") {
      await stopKeywordSpotting();
      await stopSceneDetection();
      setPhase("ready");
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
    } else if (phase === "ready") {
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
      startSceneDetection();
      setPhase("listening");
    }
  };

  const keywordsString = keywords.map((w) => `"${w}"`).join(", ");

  const renderCircleContent = () => {
    if (phase === "setup") {
      return <ActivityIndicator size="large" color={COLORS.primary} />;
    }
    const isListening = phase === "listening";
    return (
      <MicIcon color={isListening ? COLORS.secondary : "#9CA3AF"} size={42} />
    );
  };

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
        {/* 1. Top Card (with dynamic background based on active acoustic scene) */}
        <View style={styles.topCardContainer}>
          {phase === "listening" &&
          scene !== "Unknown" &&
          SCENE_IMAGES[scene] ? (
            <ImageBackground
              source={SCENE_IMAGES[scene]}
              style={styles.topCardBg}
              imageStyle={styles.topCardImage}
            >
              <View style={styles.topCardOverlay}>
                {/* Mic Circle */}
                <View style={styles.micCircleWrapper}>
                  <PulseRing delay={0} active={true} />
                  <PulseRing delay={800} active={true} />
                  <PulseRing delay={1600} active={true} />
                  <TouchableOpacity
                    style={[styles.micInnerCircle, styles.micInnerActive]}
                    onPress={handleToggle}
                  >
                    {renderCircleContent()}
                  </TouchableOpacity>
                </View>

                {/* Status Container */}
                <View style={styles.statusContainer}>
                  {/* <Text style={styles.statusHeaderLabel}>Active Listening</Text> */}
                  <Text style={styles.statusMainText}>
                    Listening for{" "}
                    <Text style={styles.keywordHighlight}>
                      {keywordsString}
                    </Text>
                  </Text>
                  <View style={styles.sceneBadge}>
                    <Ionicons
                      name={PLACE_ICON[scene] ?? "help-circle-outline"}
                      size={16}
                      color={COLORS.secondary}
                      style={styles.sceneIcon}
                    />
                    <Text style={styles.sceneBadgeText}>{scene}</Text>
                  </View>
                </View>

                {/* Control Button */}
                <TouchableOpacity
                  style={[styles.controlBtn, styles.controlBtnStop]}
                  onPress={handleToggle}
                >
                  <View style={styles.controlIconContainer}>
                    <StopIcon />
                  </View>
                  <Text style={styles.controlBtnText}>Stop Listening</Text>
                </TouchableOpacity>
              </View>
            </ImageBackground>
          ) : (
            <View style={styles.topCardBgDefault}>
              {/* Mic Circle */}
              <View style={styles.micCircleWrapper}>
                {phase === "listening" && (
                  <>
                    <PulseRing delay={0} active={true} />
                    <PulseRing delay={800} active={true} />
                    <PulseRing delay={1600} active={true} />
                  </>
                )}
                <TouchableOpacity
                  style={[
                    styles.micInnerCircle,
                    phase === "listening" && styles.micInnerActive,
                    phase === "setup" && styles.micInnerSetup,
                  ]}
                  onPress={handleToggle}
                  disabled={phase === "setup"}
                >
                  {renderCircleContent()}
                </TouchableOpacity>
              </View>

              {/* Status Container */}
              <View style={styles.statusContainer}>
                {phase === "setup" && (
                  <>
                    <Text style={styles.statusHeaderLabel}>
                      Preparing Models
                    </Text>
                    <Text style={styles.statusMainText}>
                      {progress || "Checking files…"}
                    </Text>
                  </>
                )}
                {phase === "ready" && (
                  <>
                    <Text style={styles.statusHeaderLabel}>Mic Inactive</Text>
                    <Text style={styles.statusMainText}>
                      Tap mic or button to start
                    </Text>
                  </>
                )}
                {phase === "listening" && (
                  <>
                    <Text style={styles.statusHeaderLabel}>
                      Active Listening
                    </Text>
                    <Text style={styles.statusMainText}>
                      Listening for{" "}
                      <Text style={styles.keywordHighlight}>
                        {keywordsString}
                      </Text>
                    </Text>
                    <View style={styles.sceneBadge}>
                      <Ionicons
                        name={PLACE_ICON[scene] ?? "help-circle-outline"}
                        size={16}
                        color={COLORS.secondary}
                        style={styles.sceneIcon}
                      />
                      <Text style={styles.sceneBadgeText}>
                        {scene === "Unknown"
                          ? "Analyzing environment..."
                          : scene}
                      </Text>
                    </View>
                  </>
                )}
                {phase === "error" && (
                  <>
                    <Text style={styles.statusHeaderLabel}>Setup Error</Text>
                    <Text style={styles.statusMainText}>
                      Model Switch failed
                    </Text>
                  </>
                )}
              </View>

              {/* Control Button */}
              {phase !== "setup" && (
                <TouchableOpacity
                  style={[
                    styles.controlBtn,
                    phase === "listening"
                      ? styles.controlBtnStop
                      : styles.controlBtnStart,
                  ]}
                  onPress={handleToggle}
                >
                  <View style={styles.controlIconContainer}>
                    {phase === "listening" ? (
                      <StopIcon />
                    ) : (
                      <PlayIcon color={COLORS.neutral} />
                    )}
                  </View>
                  <Text
                    style={[
                      styles.controlBtnText,
                      phase !== "listening" && { color: COLORS.neutral },
                    ]}
                  >
                    {phase === "listening"
                      ? "Stop Listening"
                      : "Start Listening"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

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
              {phase === "listening"
                ? `Waiting to hear ${keywordsString}…`
                : "No detections yet. Start listening above."}
            </Text>
          )}
        </View>

        {/* 6. View Full History Link */}
        {detections.length > 3 && (
          <TouchableOpacity
            style={styles.fullHistoryLink}
            onPress={() => navigation.navigate("History")}
          >
            <Text style={styles.fullHistoryText}>View full history</Text>
          </TouchableOpacity>
        )}
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
    paddingBottom: 24,
    alignItems: "center",
  },
  topCardContainer: {
    width: "100%",
    overflow: "hidden",
    backgroundColor: "transparent",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 4,
    marginBottom: 24,
  },
  topCardBg: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  topCardImage: {
    resizeMode: "cover",
  },
  topCardOverlay: {
    width: "100%",
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: "center",
    backgroundColor: "rgba(10, 25, 47, 0.70)",
  },
  topCardBgDefault: {
    width: "100%",
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: "center",
    backgroundColor: "transparent",
  },
  micCircleWrapper: {
    marginVertical: 24,
    width: 200,
    height: 200,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  pulseRing: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1.5,
    borderColor: "rgba(56, 189, 248, 0.4)",
    backgroundColor: "rgba(56, 189, 248, 0.05)",
  },
  micInnerCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#172A45",
    borderWidth: 3,
    borderColor: COLORS.grayBorder,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
    zIndex: 2,
  },
  micInnerActive: {
    borderColor: COLORS.secondary,
  },
  micInnerSetup: {
    borderColor: COLORS.grayBorder,
  },
  statusContainer: {
    alignItems: "center",
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  statusHeaderLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.secondary,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  statusMainText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
    lineHeight: 28,
  },
  keywordHighlight: {
    color: COLORS.secondary,
    fontStyle: "italic",
  },
  controlBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 25,
    paddingVertical: 14,
    paddingHorizontal: 36,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    alignSelf: "center",
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
    alignItems: "center",
    justifyContent: "center",
  },
  controlBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginVertical: 20,
    padding: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.grayBorder,
  },
  dividerText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.tertiary,
    marginHorizontal: 12,
  },
  detectionsContainer: {
    width: "100%",
    marginBottom: 16,
    padding: 16,
  },
  waitText: {
    fontSize: 14,
    color: COLORS.tertiary,
    fontStyle: "italic",
    textAlign: "center",
    marginVertical: 20,
  },
  fullHistoryLink: {
    paddingVertical: 12,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  fullHistoryText: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.secondary,
  },
  sceneBadge: {
    marginTop: 10,
    backgroundColor: COLORS.secondaryBg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(45, 122, 110, 0.2)",
    paddingVertical: 4,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  sceneIcon: {
    marginRight: 6,
  },
  sceneBadgeText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.secondary,
  },
});
