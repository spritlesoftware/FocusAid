/**
 * HistoryScreen.tsx
 *
 * Shows the local detection log with timestamps, scores, and Whisper transcripts.
 */
import React, { useCallback, useState, useRef } from 'react';
import {
  View, FlatList, Text, TouchableOpacity, StyleSheet, Alert, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getDetections, clearDetections } from '../services/detectionStore';
import { DetectionCard } from '../components/DetectionCard';
import { Detection } from '../types/detection';
import { COLORS } from '../config/colors';

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
    }, [load])
  );

  const handleClear = () => {
    Alert.alert('Clear History', 'Delete all detection records?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear', style: 'destructive',
        onPress: async () => { await clearDetections(); setItems([]); },
      },
    ]);
  };

  return (
    <View style={styles.root}>
      {items.length > 0 && (
        <TouchableOpacity style={styles.clearBtn} onPress={handleClear}>
          <Text style={styles.clearText}>Clear All</Text>
        </TouchableOpacity>
      )}
      <FlatList
        ref={flatListRef}
        data={items}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <DetectionCard item={item} />}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
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
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.neutral },
  list: { padding: 16, paddingBottom: 40 },
  clearBtn: { alignSelf: 'flex-end', margin: 16, marginBottom: 0 },
  clearText: { color: COLORS.primary, fontSize: 14, fontWeight: '600' },
  empty: { flex: 1, paddingTop: 80, alignItems: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.tertiary, marginBottom: 8 },
  emptyHint: { fontSize: 14, color: COLORS.tertiary, textAlign: 'center', maxWidth: 280 },
});
