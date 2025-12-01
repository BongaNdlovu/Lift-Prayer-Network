import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  Unsubscribe,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../hooks/useAuth';
import { db, firebaseEnabled } from '../../services/firebase';
import { palette, radius, spacing } from '../../theme/colors';
import type { PrayerRecord } from '../../types';

export const HistoryScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [items, setItems] = useState<PrayerRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsub: Unsubscribe | undefined;
    if (!user || !firebaseEnabled || !db) {
      setLoading(false);
      return undefined;
    }
    
    console.log('[History] Loading prayer history for user:', user.uid);
    
    const q = query(
      collection(db, 'prayers'),
      where('actorUid', '==', user.uid),
      orderBy('prayedAt', 'desc'),
      limit(50),
    );
    
    unsub = onSnapshot(
      q,
      (snap) => {
        const next = snap.docs.map((docSnap) => ({ ...(docSnap.data() as any), id: docSnap.id }));
        console.log('[History] Loaded', next.length, 'prayer records');
        setItems(next as PrayerRecord[]);
        setLoading(false);
      },
      (error) => {
        console.error('[History] Query error:', error.code, error.message);
        // Handle missing index error
        if (error.code === 'failed-precondition') {
          console.error('[History] Missing Firestore index. Please create a composite index for prayers collection: actorUid (==) + prayedAt (desc)');
        }
        setLoading(false);
      }
    );
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
      {/* Header with Back Button */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={palette.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Prayer History</Text>
        <View style={{ width: 40 }} />
      </View>
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
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <View style={styles.emptyCircle}>
                  <Text style={styles.emptyEmoji}>🙏</Text>
                </View>
                <View style={styles.emptyRing} />
              </View>
              <Text style={styles.emptyTitle}>No prayers yet</Text>
              <Text style={styles.emptySubtitle}>
                When you pray for someone&apos;s request,{'\n'}it will appear here
              </Text>
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.text,
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
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  emptyRing: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: '#fde68a',
    borderStyle: 'dashed',
  },
  emptyEmoji: {
    fontSize: 36,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: palette.text,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: 14,
    color: palette.muted,
    textAlign: 'center',
    lineHeight: 22,
  },
});
