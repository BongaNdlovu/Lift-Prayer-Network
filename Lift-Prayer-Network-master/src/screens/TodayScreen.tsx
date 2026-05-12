import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CinematicBackground, RoundedPage } from '../components/CinematicBackground';
import { GlassCard } from '../components/GlassCard';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../hooks/useAuth';
import { archivePrayerPromise, getTodayPrayerPromises, markPromiseAnswered, markPromisePrayed } from '../services/prayerPromises';
import { radius, spacing } from '../theme/colors';
import type { PrayerPromise } from '../types';
import type { RootStackParamList } from '../navigation/types';

const isToday = (value: any) => {
  if (!value) return false;
  const date = value.toDate ? value.toDate() : new Date(value);
  const now = new Date();
  return date.toDateString() === now.toDateString();
};

export const TodayScreen: React.FC = () => {
  const { colors } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [items, setItems] = useState<PrayerPromise[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadPromises = useCallback(async () => {
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }

    try {
      const data = await getTodayPrayerPromises(user.uid);
      setItems(data);
    } catch (err) {
      console.error('[TodayScreen] Could not load promises:', err);
      Alert.alert('Error', 'Could not load your prayer promises.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    loadPromises();
  }, [loadPromises]);

  const sections = useMemo(() => {
    const dueToday = items.filter((item) => item.status === 'ACTIVE' && (!item.nextReminderAt || isToday(item.nextReminderAt)));
    const ongoing = items.filter((item) => item.status === 'ACTIVE' && item.nextReminderAt && !isToday(item.nextReminderAt));
    const recentlyPrayed = items.filter((item) => item.status === 'PRAYED_TODAY');
    const answered = items.filter((item) => item.status === 'ANSWERED');
    return { dueToday, ongoing, recentlyPrayed, answered };
  }, [items]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPromises();
  };

  const handleMarkPrayed = async (item: PrayerPromise) => {
    if (!user) return;
    try {
      await markPromisePrayed(item.id, user.uid);
      setItems((prev) => prev.map((p) => p.id === item.id ? { ...p, status: 'PRAYED_TODAY', prayedCount: (p.prayedCount || 0) + 1, lastPrayedAt: new Date() } : p));
    } catch (err) {
      console.error('[TodayScreen] Mark prayed failed:', err);
      Alert.alert('Error', 'Could not mark this promise as prayed.');
    }
  };

  const handleMarkAnswered = async (item: PrayerPromise) => {
    if (!user) return;
    try {
      await markPromiseAnswered(item.id, user.uid);
      setItems((prev) => prev.map((p) => p.id === item.id ? { ...p, status: 'ANSWERED' } : p));
    } catch (err) {
      console.error('[TodayScreen] Mark answered failed:', err);
      Alert.alert('Error', 'Could not mark this promise as answered.');
    }
  };

  const handleArchive = async (item: PrayerPromise) => {
    if (!user) return;
    try {
      await archivePrayerPromise(item.id, user.uid);
      setItems((prev) => prev.filter((p) => p.id !== item.id));
    } catch (err) {
      console.error('[TodayScreen] Archive failed:', err);
      Alert.alert('Error', 'Could not archive this promise.');
    }
  };

  const renderPromise = (item: PrayerPromise) => (
    <GlassCard key={item.id} padding="md" rounded="xl" style={styles.promiseCard}>
      <View style={styles.promiseHeader}>
        <Text style={[styles.promiseText, { color: colors.text }]} numberOfLines={3}>{item.requestSummary}</Text>
        {item.requestIsUrgent && <Text style={styles.urgentBadge}>URGENT</Text>}
      </View>
      <Text style={[styles.promiseMeta, { color: colors.muted }]}>Prayed {item.prayedCount || 0} time{item.prayedCount === 1 ? '' : 's'}</Text>
      <View style={styles.actionsRow}>
        <TouchableOpacity style={[styles.smallButton, { backgroundColor: colors.accent }]} onPress={() => handleMarkPrayed(item)}>
          <Text style={styles.smallButtonText}>Prayed</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.outlineButton} onPress={() => handleMarkAnswered(item)}>
          <Text style={[styles.outlineButtonText, { color: colors.stone700 }]}>Answered</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconButton} onPress={() => handleArchive(item)}>
          <Ionicons name="archive-outline" size={18} color={colors.muted} />
        </TouchableOpacity>
      </View>
    </GlassCard>
  );

  const renderSection = (title: string, data: PrayerPromise[]) => {
    if (data.length === 0) return null;
    return (
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
        {data.map(renderPromise)}
      </View>
    );
  };

  const hasAny = items.length > 0;

  return (
    <CinematicBackground useOuterBackground>
      <SafeAreaView style={styles.container}>
        <View style={styles.headerSection}>
          <Text style={[styles.kicker, { color: colors.stone500 }]}>PRAYER PROMISES</Text>
          <Text style={[styles.heading, { color: colors.stone900 }]}>Today</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>Your prayer promises for today</Text>
        </View>

        <RoundedPage style={styles.mainContent}>
          {loading ? (
            <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>
          ) : (
            <ScrollView contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />} showsVerticalScrollIndicator={false}>
              {!hasAny && (
                <GlassCard padding="lg" rounded="xl" style={styles.emptyCard}>
                  <Ionicons name="sunny-outline" size={40} color={colors.accent} />
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>No prayer promises yet</Text>
                  <Text style={[styles.emptyText, { color: colors.muted }]}>Tap &quot;I&apos;ll Pray&quot; on a request to add it here.</Text>
                </GlassCard>
              )}

              {renderSection('Due Today', sections.dueToday)}
              {renderSection('Ongoing', sections.ongoing)}
              {renderSection('Recently Prayed', sections.recentlyPrayed)}
              {renderSection('Answered', sections.answered)}

              <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.accent }]} onPress={() => navigation.navigate('MainTabs')}>
                <Ionicons name="reader-outline" size={20} color="#1f2937" />
                <Text style={styles.primaryButtonText}>Browse Prayer Wall</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('CreateRequest')}>
                <Ionicons name="add-circle-outline" size={20} color={colors.stone700} />
                <Text style={[styles.secondaryButtonText, { color: colors.stone700 }]}>Create Prayer Request</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </RoundedPage>
      </SafeAreaView>
    </CinematicBackground>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerSection: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  kicker: { fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', marginBottom: spacing.xs },
  heading: { fontSize: 36, fontWeight: '700', letterSpacing: -1 },
  subtitle: { fontSize: 15, marginTop: 4 },
  mainContent: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { padding: spacing.lg, gap: spacing.md },
  emptyCard: { alignItems: 'center', gap: spacing.sm },
  emptyTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  emptyText: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
  section: { gap: spacing.sm },
  sectionTitle: { fontSize: 18, fontWeight: '800', marginTop: spacing.sm },
  promiseCard: { gap: spacing.sm },
  promiseHeader: { gap: spacing.xs },
  promiseText: { fontSize: 16, fontWeight: '700', lineHeight: 23 },
  promiseMeta: { fontSize: 13 },
  urgentBadge: { alignSelf: 'flex-start', backgroundColor: '#fee2e2', color: '#b91c1c', fontSize: 11, fontWeight: '900', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  smallButton: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.md },
  smallButtonText: { color: '#1f2937', fontWeight: '800' },
  outlineButton: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.md, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e7e5e4' },
  outlineButtonText: { fontWeight: '800' },
  iconButton: { padding: 9 },
  primaryButton: { minHeight: 52, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.sm },
  primaryButtonText: { color: '#1f2937', fontSize: 16, fontWeight: '800' },
  secondaryButton: { minHeight: 52, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.sm, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e7e5e4' },
  secondaryButtonText: { fontSize: 16, fontWeight: '800' },
});
