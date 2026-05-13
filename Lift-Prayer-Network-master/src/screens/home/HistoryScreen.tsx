import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../contexts/ThemeContext';
import { db, firebaseEnabled } from '../../services/firebase';
import { fonts, radius, spacing } from '../../theme/colors';
import { LiftScreen } from '../../components/LiftLayout';
import type { PrayerRecord } from '../../types';

export const HistoryScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { colors } = useTheme();
  const [items, setItems] = useState<PrayerRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
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
    
    getDocs(q)
      .then((snap) => {
        if (!mounted) return;
        const next = snap.docs.map((docSnap) => ({ ...(docSnap.data() as any), id: docSnap.id }));
        console.log('[History] Loaded', next.length, 'prayers received');
        setItems(next as PrayerRecord[]);
        setLoading(false);
      })
      .catch((error) => {
        console.error('[History] Query error:', error?.code, error?.message);
        // Handle missing index error
        if (error?.code === 'failed-precondition') {
          console.error('[History] Missing Firestore index. Please create a composite index for prayers collection: targetOwnerUid (==) + prayedAt (desc)');
        }
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [user]);

  if (!user) {
    return (
      <LiftScreen>
        <Text style={[styles.title, { color: colors.text }]}>Sign in to track your prayer history.</Text>
      </LiftScreen>
    );
  }

  return (
    <LiftScreen scroll>
      {/* === HEADER SECTION === */}
      <View style={styles.headerSection}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.kicker, { color: colors.muted }]}>YOUR IMPACT</Text>
          <Text style={[styles.heading, { color: colors.text }]}>
            History<Text style={styles.headingDot}>.</Text>
          </Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      {/* === MAIN CONTENT === */}
      <View style={styles.mainContent}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
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
              <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
                When someone prays for your request,{'\n'}it will appear here
              </Text>
            </View>
          }
        />
      )}
      </View>
    </LiftScreen>
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
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    fontFamily: fonts.heading,
    fontSize: 32,
    fontWeight: '500',
    letterSpacing: -1.5,
    lineHeight: 34,
    color: '#1c1917',
  },
  headingDot: {
    color: '#4A5D4E',
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
