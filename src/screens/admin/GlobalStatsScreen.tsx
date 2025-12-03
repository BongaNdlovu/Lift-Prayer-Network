import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { doc, getDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../services/firebase';
import { hasAdminPermission } from '../../config/admins';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../contexts/ThemeContext';
import { palette, radius, spacing } from '../../theme/colors';

type GlobalStats = {
  totalPrayers?: number;
  totalRequests?: number;
  updatedAt?: any;
};

export const GlobalStatsScreen: React.FC = () => {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [loading, setLoading] = useState(true);

  const isAdmin = hasAdminPermission(user?.email);

  // Bold diagonal gradient
  const gradientColors = [...colors.gradientBoldScreen] as [string, string, ...string[]];

  useEffect(() => {
    const loadStats = async () => {
      if (!db || !isAdmin) {
        setLoading(false);
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'stats', 'global'));
        if (snap.exists()) {
          setStats(snap.data() as GlobalStats);
        } else {
          setStats({});
        }
      } catch (err) {
        console.warn('[GlobalStats] Failed to load global stats', err);
        setStats({});
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <LinearGradient colors={gradientColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }}>
      <View style={[styles.center, { backgroundColor: 'transparent' }]}>
        <Ionicons name="shield" size={32} color={colors.muted} />
        <Text style={[styles.denied, { color: colors.text }]}>Admin access required</Text>
      </View>
      </LinearGradient>
    );
  }

  if (loading) {
    return (
      <LinearGradient colors={gradientColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }}>
      <View style={[styles.center, { backgroundColor: 'transparent' }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={gradientColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }}>
    <View style={[styles.container, { backgroundColor: 'transparent' }]}>
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <Text style={[styles.title, { color: colors.text }]}>Global Prayer Activity</Text>
        <View style={styles.row}>
          <View style={[styles.metric, { backgroundColor: colors.surface }]}>
            <Text style={[styles.metricLabel, { color: colors.muted }]}>Total Requests</Text>
            <Text style={[styles.metricValue, { color: colors.text }]}>{stats?.totalRequests ?? 0}</Text>
          </View>
          <View style={[styles.metric, { backgroundColor: colors.surface }]}>
            <Text style={[styles.metricLabel, { color: colors.muted }]}>Total Prayers</Text>
            <Text style={[styles.metricValue, { color: colors.text }]}>{stats?.totalPrayers ?? 0}</Text>
          </View>
        </View>
        {stats?.updatedAt ? (
          <Text style={[styles.updated, { color: colors.muted }]}>
            Updated at {new Date(stats.updatedAt.toDate ? stats.updatedAt.toDate() : stats.updatedAt).toLocaleString()}
          </Text>
        ) : null}
      </View>
    </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
  },
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  metric: {
    flex: 1,
  },
  metricLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  updated: {
    marginTop: spacing.md,
    fontSize: 12,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  denied: {
    marginTop: spacing.sm,
  },
});

