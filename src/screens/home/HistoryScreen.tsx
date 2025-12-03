import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
import { useTheme } from '../../contexts/ThemeContext';
import { db, firebaseEnabled } from '../../services/firebase';
import { palette, radius, spacing } from '../../theme/colors';
import type { PrayerRecord } from '../../types';

export const HistoryScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { colors } = useTheme();
  const [items, setItems] = useState<PrayerRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsub: Unsubscribe | undefined;
    if (!user || !firebaseEnabled || !db) {
      setLoading(false);
      return undefined;
    }
    
    console.log('[History] Loading prayers received for user:', user.uid);
    
    // Query prayers received ON the user's requests (who prayed for them)
    const q = query(
      collection(db, 'prayers'),
      where('targetOwnerUid', '==', user.uid),
      orderBy('prayedAt', 'desc'),
      limit(50),
    );
    
    unsub = onSnapshot(
      q,
      (snap) => {
        const next = snap.docs.map((docSnap) => ({ ...(docSnap.data() as any), id: docSnap.id }));
        console.log('[History] Loaded', next.length, 'prayers received');
        setItems(next as PrayerRecord[]);
        setLoading(false);
      },
      (error) => {
        console.error('[History] Query error:', error.code, error.message);
        // Handle missing index error
        if (error.code === 'failed-precondition') {
          console.error('[History] Missing Firestore index. Please create a composite index for prayers collection: targetOwnerUid (==) + prayedAt (desc)');
        }
        setLoading(false);
      }
    );
    return () => unsub?.();
  }, [user]);

  // Bold diagonal gradient
  const gradientColors = [...colors.gradientBoldScreen] as [string, string, ...string[]];

  if (!user) {
    return (
      <LinearGradient colors={gradientColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }}>
      <SafeAreaView style={[styles.center, { backgroundColor: 'transparent' }]}>
        <Text style={[styles.title, { color: colors.text }]}>Sign in to track your prayer history.</Text>
      </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={gradientColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }}>
    <SafeAreaView style={[styles.container, { backgroundColor: 'transparent' }]}>
      {/* Header with Back Button */}
      <View style={[styles.header, { backgroundColor: colors.surface }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Prayers Received</Text>
        <View style={{ width: 40 }} />
      </View>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <Text style={[styles.summary, { color: colors.text }]}>{(item as any).actorDisplayName || 'Someone'} prayed for you</Text>
              <Text style={[styles.meta, { color: colors.muted }]}>{item.targetSummary}</Text>
            </View>
          )}
          ListEmptyComponent={
            <View style={[styles.emptyState, { backgroundColor: colors.surface }]}>
              <View style={styles.emptyIcon}>
                <View style={[styles.emptyCircle, { backgroundColor: colors.surface }]}>
                  <Text style={styles.emptyEmoji}>🙏</Text>
                </View>
                <View style={[styles.emptyRing, { borderColor: colors.muted }]} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No prayers received yet</Text>
              <Text style={styles.emptySubtitle}>
                When someone prays for your request,{'\n'}it will appear here
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  },
  heading: {
    fontSize: 22,
    fontWeight: '900',
    marginBottom: spacing.md,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.border,
    marginBottom: spacing.sm,
  },
  summary: {
    fontWeight: '700',
    marginBottom: 4,
  },
  meta: {
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
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
    borderStyle: 'dashed',
  },
  emptyEmoji: {
    fontSize: 36,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
});
