import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  Animated,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../hooks/useAuth';
import { getUserStats, type UserStats } from '../services/stats';
import { useTheme } from '../contexts/ThemeContext';
import { palette, radius, spacing } from '../theme/colors';
import { RootStackParamList } from '../navigation/types';
import { PrayerStreakWidget } from '../components/PrayerStreakWidget';
import { LiftScreen, LiftHeader } from '../components/LiftLayout';

type StatCardProps = {
  emoji: string;
  value: number;
  label: string;
  color: string;
  delay?: number;
};

const StatCard: React.FC<StatCardProps> = ({ emoji, value, label, color, delay = 0 }) => {
  const scaleAnim = React.useRef(new Animated.Value(0)).current;
  const opacityAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 8,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 300,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View
      style={[
        styles.statCard,
        { backgroundColor: color, transform: [{ scale: scaleAnim }], opacity: opacityAnim },
      ]}
    >
      <Text style={styles.statEmoji}>{emoji}</Text>
      <Text style={styles.statValue}>{value.toLocaleString()}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Animated.View>
  );
};

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
        <View style={styles.center}>
          <Text style={styles.emoji}>📊</Text>
          <Text style={[styles.title, { color: colors.text }]}>Sign in to view your stats</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>Track your prayer journey</Text>
        </View>
      </LiftScreen>
    );
  }

  if (loading) {
    return (
      <LiftScreen>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accentDark} />
        </View>
      </LiftScreen>
    );
  }

  const streakMessage = stats?.streakDays === 0
    ? 'Start your streak today!'
    : stats?.streakDays === 1
    ? 'Great start! Keep it up!'
    : `${stats?.streakDays} days strong! 💪`;

  return (
    <LiftScreen scroll>
      <LiftHeader title="Stats" subtitle="Prayer statistics & streaks" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

          <PrayerStreakWidget
            currentStreak={stats?.streakDays || 0}
            longestStreak={stats?.longestStreak || 0}
            lastPrayedDate={stats?.streakLastDate}
            onPress={() => navigation.navigate('History')}
          />

          {/* Streak Banner */}
          <View style={styles.streakBanner}>
            <Text style={styles.streakEmoji}>🔥</Text>
            <View style={styles.streakInfo}>
              <Text style={styles.streakCount}>{stats?.streakDays || 0} Day Streak</Text>
              <Text style={styles.streakMessage}>{streakMessage}</Text>
            </View>
            <View style={styles.longestStreak}>
              <Text style={styles.longestLabel}>Best</Text>
              <Text style={styles.longestValue}>{stats?.longestStreak || 0}</Text>
            </View>
          </View>

          {/* Main Stats Grid */}
          <View style={styles.statsGrid}>
            <StatCard
              emoji="🙏"
              value={stats?.prayerCount || 0}
              label="Total Prayers"
              color="#fef3c7"
              delay={0}
            />
            <StatCard
              emoji="👥"
              value={stats?.peopleSupported || 0}
              label="People Supported"
              color="#dbeafe"
              delay={100}
            />
            <StatCard
              emoji="📡"
              value={stats?.requestCount || 0}
              label="Requests Sent"
              color="#dcfce7"
              delay={200}
            />
            <StatCard
              emoji="✨"
              value={stats?.testimonyCount || 0}
              label="Testimonies"
              color="#fce7f3"
              delay={300}
            />
          </View>

          {/* Period Stats */}
          <View style={styles.periodSection}>
            <Text style={styles.periodTitle}>Recent Activity</Text>
            <View style={styles.periodRow}>
              <View style={styles.periodCard}>
                <Text style={styles.periodValue}>{stats?.prayersThisWeek || 0}</Text>
                <Text style={styles.periodLabel}>This Week</Text>
              </View>
              <View style={styles.periodDivider} />
              <View style={styles.periodCard}>
                <Text style={styles.periodValue}>{stats?.prayersThisMonth || 0}</Text>
                <Text style={styles.periodLabel}>This Month</Text>
              </View>
            </View>
          </View>

          {/* Encouragement */}
          <View style={styles.encouragement}>
            <Text style={styles.encouragementText}>
              {stats?.prayerCount === 0
                ? '🌱 Every journey begins with a single step. Start praying for others today!'
                : stats?.prayerCount && stats.prayerCount >= 100
                ? '🌟 You\'re a prayer warrior! Your intercession makes a difference.'
                : '💫 Keep going! Every prayer counts and brings hope to someone.'}
            </Text>
          </View>

          {/* Answered Prayers Gallery Link */}
          <TouchableOpacity
            style={styles.galleryLink}
            onPress={() => navigation.navigate('AnsweredPrayers')}
          >
            <View style={[styles.galleryGradient, { backgroundColor: colors.accentDark }]}>
              <View style={styles.galleryContent}>
                <Text style={styles.galleryEmoji}>🎉</Text>
                <View style={styles.galleryText}>
                  <Text style={styles.galleryTitle}>Answered Prayers Gallery</Text>
                  <Text style={styles.gallerySubtitle}>Celebrate God&apos;s faithfulness</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#fff" />
            </View>
          </TouchableOpacity>
          </ScrollView>
    </LiftScreen>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  
  // Header styles
  headerSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    zIndex: 20,
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
  subheading: {
    fontSize: 14,
    marginTop: spacing.xs,
  },
  
  // Content styles
  mainContent: {
    flex: 1,
    zIndex: 10,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 140,
  },
  
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  emoji: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 14,
  },
  streakBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: '#fef3c7',
  },
  streakEmoji: {
    fontSize: 48,
    marginRight: spacing.md,
  },
  streakInfo: {
    flex: 1,
  },
  streakCount: {
    fontSize: 24,
    fontWeight: '900',
    color: palette.text,
  },
  streakMessage: {
    fontSize: 14,
    color: palette.muted,
  },
  longestStreak: {
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  longestLabel: {
    fontSize: 11,
    color: '#92400e',
    fontWeight: '600',
  },
  longestValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#92400e',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  statCard: {
    width: '47%',
    padding: spacing.lg,
    borderRadius: radius.lg,
    alignItems: 'center',
  },
  statEmoji: {
    fontSize: 32,
    marginBottom: spacing.sm,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '900',
    color: palette.text,
  },
  statLabel: {
    fontSize: 12,
    color: palette.muted,
    fontWeight: '600',
    marginTop: 4,
  },
  periodSection: {
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: palette.border,
  },
  periodTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: palette.text,
    marginBottom: spacing.md,
  },
  periodRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  periodCard: {
    flex: 1,
    alignItems: 'center',
  },
  periodDivider: {
    width: 1,
    height: 40,
    backgroundColor: palette.border,
  },
  periodValue: {
    fontSize: 32,
    fontWeight: '900',
    color: palette.accent,
  },
  periodLabel: {
    fontSize: 12,
    color: palette.muted,
    fontWeight: '600',
  },
  encouragement: {
    backgroundColor: '#f0fdf4',
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  encouragementText: {
    fontSize: 14,
    color: '#166534',
    lineHeight: 22,
    textAlign: 'center',
  },
  galleryLink: {
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  galleryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderRadius: radius.lg,
  },
  galleryContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  galleryEmoji: {
    fontSize: 32,
  },
  galleryText: {
    gap: 2,
  },
  galleryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  gallerySubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
});
