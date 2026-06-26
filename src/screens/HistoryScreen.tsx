/**
 * HistoryScreen.tsx
 *
 * Shows the local detection log with timestamps, scores, and Whisper transcripts.
 */
import React, { useCallback, useState, useRef } from "react";
import {
  View,
  FlatList,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
  ImageBackground,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { getDetections, clearDetections } from "../services/detectionStore";
import { DetectionCard } from "../components/DetectionCard";
import { Detection } from "../types/detection";
import { COLORS } from "../config/colors";

export function HistoryScreen() {
  const [items, setItems] = useState<Detection[]>([]);
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setItems(await getDetections());
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
      load();
    }, [load]),
  );

  const handleClear = () => {
    Alert.alert("Clear History", "Delete all detection records?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: async () => {
          await clearDetections();
          setItems([]);
        },
      },
    ]);
  };

  return (
    <ImageBackground
      source={require("../../assets/bg_gradient.png")}
      style={styles.backgroundImage}
    >
      <View style={styles.container}>
        {items.length > 0 && (
          <TouchableOpacity style={styles.clearBtn} onPress={handleClear}>
            <Text style={styles.clearText}>Clear All</Text>
          </TouchableOpacity>
        )}
        <FlatList
          ref={flatListRef}
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <DetectionCard item={item} />}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={load}
              tintColor="#FFFFFF"
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No detections yet</Text>
              <Text style={styles.emptyHint}>
                Start listening on the Home tab and say your trigger word.
              </Text>
            </View>
          }
        />
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  backgroundImage: { flex: 1, width: "100%", height: "100%" },
  container: { flex: 1, backgroundColor: "transparent", marginBottom: 96 },
  root: { flex: 1, backgroundColor: COLORS.neutral },
  list: { padding: 16, paddingBottom: 24 },
  clearBtn: { alignSelf: "flex-end", margin: 16, marginBottom: 0 },
  clearText: { color: COLORS.secondary, fontSize: 14, fontWeight: "600" },
  empty: { flex: 1, paddingTop: 80, alignItems: "center" },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.tertiary,
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 14,
    color: COLORS.tertiary,
    textAlign: "center",
    maxWidth: 280,
  },
});
