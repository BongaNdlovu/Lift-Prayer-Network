import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../hooks/useAuth';
import { getUserStats, type UserStats } from '../services/stats';
import { useTheme } from '../contexts/ThemeContext';
import { fonts, shadows, spacing } from '../theme/colors';
import { RootStackParamList } from '../navigation/types';
import {
  LiftButton,
  LiftEmptyState,
  LiftFlatCard,
  LiftHeader,
  LiftMiniStat,
  LiftPrayerRhythmCard,
  LiftScreen,
  LiftSectionHeader,
  LiftStreakCard,
} from '../components/LiftLayout';

export const StatsScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const { colors } = useTheme();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    getUserStats(user.uid).then((data) => {
      setStats(data);
      setLoading(false);
    });
  }, [user]);

  if (!user) {
    return (
      <LiftScreen>
        <LiftEmptyState
          icon="stats-chart-outline"
          title="Sign in to view your stats"
          message="Track your prayer rhythm, answered prayers, and the people you support."
        />
      </LiftScreen>
    );
  }

  if (loading) {
    return (
      <LiftScreen>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading prayer stats...</Text>
        </View>
      </LiftScreen>
    );
  }

  const streakDays = stats?.streakDays || 0;
  const encouragement =
    (stats?.prayerCount || 0) === 0
      ? 'Every journey begins with one faithful prayer. Start by lifting someone today.'
      : (stats?.prayerCount || 0) >= 100
      ? 'Your steady intercession is becoming a meaningful rhythm.'
      : 'Keep going. Every prayer counts and brings hope to someone.';

  return (
    <LiftScreen scroll>
      <LiftHeader title="Stats" subtitle="Prayer statistics and streaks" />

      <LiftPrayerRhythmCard
        prayersCount={stats?.prayerCount || 0}
        supportedCount={stats?.peopleSupported || 0}
        answeredCount={stats?.testimonyCount || 0}
      />

      <LiftSectionHeader title="Prayer Streak" />
      <LiftStreakCard
        currentStreak={streakDays}
        longestStreak={stats?.longestStreak || 0}
        onPress={() => navigation.navigate('History')}
      />

      <LiftSectionHeader title="Lifetime Activity" />
      <View style={styles.statsGrid}>
        <LiftMiniStat label="Prayers" value={stats?.prayerCount || 0} icon="heart" />
        <LiftMiniStat label="Supported" value={stats?.peopleSupported || 0} icon="people" />
        <LiftMiniStat label="Requests" value={stats?.requestCount || 0} icon="send" />
        <LiftMiniStat label="Answered" value={stats?.testimonyCount || 0} icon="sparkles" />
      </View>

      <LiftSectionHeader title="Recent Activity" />
      <LiftFlatCard>
        <View style={styles.periodRow}>
          <View style={styles.periodCard}>
            <Text style={[styles.periodValue, { color: colors.text }]}>{stats?.prayersThisWeek || 0}</Text>
            <Text style={[styles.periodLabel, { color: colors.textSecondary }]}>This week</Text>
          </View>
          <View style={[styles.periodDivider, { backgroundColor: colors.border }]} />
          <View style={styles.periodCard}>
            <Text style={[styles.periodValue, { color: colors.text }]}>{stats?.prayersThisMonth || 0}</Text>
            <Text style={[styles.periodLabel, { color: colors.textSecondary }]}>This month</Text>
          </View>
        </View>
      </LiftFlatCard>

      <LiftFlatCard style={[styles.encouragement, { backgroundColor: colors.successLight, borderColor: colors.successLight }]}>
        <Text style={[styles.encouragementText, { color: colors.success }]}>{encouragement}</Text>
      </LiftFlatCard>

      <Pressable
        onPress={() => navigation.navigate('AnsweredPrayers')}
        style={({ pressed }) => [
          styles.galleryLink,
          { backgroundColor: colors.accent },
          shadows.md,
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.galleryText}>
          <Text style={styles.galleryTitle}>Answered Prayers Gallery</Text>
          <Text style={styles.gallerySubtitle}>Celebrate God&apos;s faithfulness</Text>
        </View>
        <Ionicons name="chevron-forward" size={22} color="#fff" />
      </Pressable>

      <LiftButton variant="secondary" onPress={() => navigation.navigate('History')} style={styles.historyButton}>
        View Prayer History
      </LiftButton>
    </LiftScreen>
  );
};

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontFamily: fonts.body,
    fontSize: 14,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  periodRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  periodCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  periodDivider: {
    width: 1,
    height: 46,
  },
  periodValue: {
    fontFamily: fonts.heading,
    fontSize: 32,
    lineHeight: 38,
  },
  periodLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    marginTop: 4,
  },
  encouragement: {
    marginTop: spacing.lg,
  },
  encouragementText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  galleryLink: {
    minHeight: 74,
    borderRadius: 20,
    padding: 16,
    marginTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  galleryText: {
    flex: 1,
  },
  galleryTitle: {
    fontFamily: fonts.bodyMedium,
    color: '#fff',
    fontSize: 16,
  },
  gallerySubtitle: {
    fontFamily: fonts.body,
    color: 'rgba(255,255,255,0.82)',
    fontSize: 13,
    marginTop: 3,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  historyButton: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
});

export default StatsScreen;
