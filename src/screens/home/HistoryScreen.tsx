import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import {
  Unsubscribe,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { useAuth } from '../../hooks/useAuth';
import { db, firebaseEnabled } from '../../services/firebase';
import { palette, radius, spacing } from '../../theme/colors';
import type { PrayerRecord } from '../../types';

export const HistoryScreen: React.FC = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<PrayerRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsub: Unsubscribe | undefined;
    if (!user || !firebaseEnabled || !db) {
      setLoading(false);
      return undefined;
    }
    const q = query(
      collection(db, 'prayers'),
      where('actorUid', '==', user.uid),
      orderBy('prayedAt', 'desc'),
      limit(50),
    );
    unsub = onSnapshot(q, (snap) => {
      const next = snap.docs.map((docSnap) => ({ ...(docSnap.data() as any), id: docSnap.id }));
      setItems(next as PrayerRecord[]);
      setLoading(false);
    });
    return () => unsub?.();
  }, [user]);

  if (!user) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.title}>Sign in to track your prayer history.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.heading}>Prayer history</Text>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={palette.accent} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.summary}>{item.targetSummary}</Text>
              <Text style={styles.meta}>Prayed for request {item.targetRequestId}</Text>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.meta}>No prayers logged yet.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
    padding: spacing.lg,
  },
  heading: {
    fontSize: 22,
    fontWeight: '900',
    color: palette.text,
    marginBottom: spacing.md,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.border,
    marginBottom: spacing.sm,
  },
  summary: {
    fontWeight: '700',
    color: palette.text,
    marginBottom: 4,
  },
  meta: {
    color: palette.muted,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.text,
  },
});
