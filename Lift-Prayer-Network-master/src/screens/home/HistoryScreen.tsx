import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, SafeAreaView, StyleSheet, Text, View } from 'react-native';
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
import { CinematicBackground, RoundedPage } from '../../components/CinematicBackground';
import { GlassIconButton } from '../../components/GlassCard';
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

  if (!user) {
    return (
      <CinematicBackground useOuterBackground>
        <SafeAreaView style={styles.center}>
          <Text style={[styles.title, { color: colors.text }]}>Sign in to track your prayer history.</Text>
        </SafeAreaView>
      </CinematicBackground>
    );
  }

  return (
    <CinematicBackground useOuterBackground>
      <SafeAreaView style={styles.container}>
        {/* === HEADER SECTION === */}
        <View style={styles.headerSection}>
          <GlassIconButton onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color={colors.stone700} />
          </GlassIconButton>
          <View style={styles.headerCenter}>
            <Text style={[styles.kicker, { color: colors.stone500 }]}>YOUR IMPACT</Text>
            <Text style={styles.heading}>
              History<Text style={styles.headingDot}>.</Text>
            </Text>
          </View>
          <View style={{ width: 44 }} />
        </View>

        {/* === MAIN CONTENT === */}
        <RoundedPage style={styles.mainContent}>
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
      </RoundedPage>
    </SafeAreaView>
  </CinematicBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  
  // Header styles
  headerSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    zIndex: 20,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  kicker: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
    opacity: 0.8,
  },
  heading: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontSize: 32,
    fontWeight: '500',
    letterSpacing: -1.5,
    lineHeight: 34,
    color: '#1c1917',
  },
  headingDot: {
    color: '#f59e0b',
  },
  
  // Content styles
  mainContent: {
    flex: 1,
    zIndex: 10,
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
