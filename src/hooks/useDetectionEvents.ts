/**
 * useDetectionEvents.ts
 *
 * Subscribes to real-time detection events emitted by audioBridge.
 */
import {useState, useEffect} from 'react';
import {onDetection} from '../services/audioBridge';
import {Detection} from '../types/detection';

export function useDetectionEvents(limit = 50) {
  const [detections, setDetections] = useState<Detection[]>([]);

  useEffect(() => {
    const unsub = onDetection(detection => {
      setDetections(prev => {
        // Update existing record (transcript enrichment) or prepend new
        const idx = prev.findIndex(d => d.id === detection.id);
        if (idx !== -1) {
          const updated = [...prev];
          updated[idx] = detection;
          return updated;
        }
        return [detection, ...prev].slice(0, limit);
      });
    });
    return unsub;
  }, [limit]);

  return detections;
}
