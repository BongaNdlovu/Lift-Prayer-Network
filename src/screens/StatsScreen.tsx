import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../hooks/useAuth';
import { getUserStats, type UserStats } from '../services/stats';
import { palette, radius, spacing } from '../theme/colors';

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
  const { user } = useAuth();
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
      <SafeAreaView style={styles.center}>
        <Text style={styles.emoji}>📊</Text>
        <Text style={styles.title}>Sign in to view your stats</Text>
        <Text style={styles.subtitle}>Track your prayer journey</Text>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={palette.accent} />
      </SafeAreaView>
    );
  }

  const streakMessage = stats?.streakDays === 0
    ? 'Start your streak today!'
    : stats?.streakDays === 1
    ? 'Great start! Keep it up!'
    : `${stats?.streakDays} days strong! 💪`;

  return (
    <LinearGradient colors={['#fefce8', '#f4f4f5']} style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={styles.heading}>Your Journey</Text>
          <Text style={styles.subheading}>Prayer statistics & streaks</Text>

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
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.background,
    padding: spacing.lg,
  },
  emoji: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: palette.text,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 14,
    color: palette.muted,
  },
  heading: {
    fontSize: 28,
    fontWeight: '900',
    color: palette.text,
  },
  subheading: {
    fontSize: 14,
    color: palette.muted,
    marginBottom: spacing.lg,
  },
  streakBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 2,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
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
});

