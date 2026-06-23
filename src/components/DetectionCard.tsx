/**
 * DetectionCard.tsx
 *
 * Renders a single keyword-detection event.
 *
 * transcript states:
 *   undefined  → Whisper still running ("Transcribing…")
 *   ''         → Whisper ran, keyword not found or no speech ("No speech detected")
 *   string     → Whisper transcript text
 */
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Detection } from "../types/detection";
import { COLORS } from "../config/colors";

interface Props {
  item: Detection;
}

export function DetectionCard({ item }: Props) {
  const time = new Date(item.timestamp).toLocaleTimeString();
  const pct = Math.round(item.score * 100);

  const transcriptNode = (() => {
    if (item.transcript === undefined) {
      return <Text style={styles.transcriptPending}>Transcribing…</Text>;
    }
    if (item.transcript === "") {
      return <Text style={styles.transcriptNone}>No speech detected</Text>;
    }
    return <Text style={styles.transcript}>"{item.transcript}"</Text>;
  })();

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.keyword}>"{item.keyword}"</Text>
        <View
          style={[
            styles.badge,
            item.confirmed ? styles.badgeOk : styles.badgeLow,
          ]}
        >
          <Text style={[styles.badgeText, { color: item.confirmed ? COLORS.secondary : COLORS.primary }]}>
            {item.confirmed ? "confirmed" : "low confidence"}
          </Text>
        </View>
      </View>
      <Text style={styles.meta}>
        {time} · {pct}% confidence
      </Text>
      {transcriptNode}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#f2e6f0",
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  keyword: { fontSize: 17, fontWeight: "700", color: COLORS.tertiary },
  badge: { borderRadius: 20, paddingVertical: 2, paddingHorizontal: 10 },
  badgeOk: { backgroundColor: COLORS.secondaryBg },
  badgeLow: { backgroundColor: COLORS.primaryLightBg },
  badgeText: { fontSize: 12, fontWeight: "600" },
  meta: { fontSize: 13, color: COLORS.tertiary, marginBottom: 8 },
  transcript: { fontSize: 14, color: COLORS.tertiary, fontStyle: "italic" },
  transcriptPending: { fontSize: 13, color: COLORS.tertiary, fontStyle: "italic", opacity: 0.6 },
  transcriptNone: { fontSize: 13, color: COLORS.primary, fontStyle: "italic" },
});
