import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { doc, getDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../services/firebase';
import { hasAdminPermission } from '../../config/admins';
import { useAuth } from '../../hooks/useAuth';
import { palette, radius, spacing } from '../../theme/colors';

type GlobalStats = {
  totalPrayers?: number;
  totalRequests?: number;
  updatedAt?: any;
};

export const GlobalStatsScreen: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [loading, setLoading] = useState(true);

  const isAdmin = hasAdminPermission(user?.email);

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
      <View style={styles.center}>
        <Ionicons name="shield" size={32} color={palette.muted} />
        <Text style={styles.denied}>Admin access required</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={palette.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Global Prayer Activity</Text>
        <View style={styles.row}>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Total Requests</Text>
            <Text style={styles.metricValue}>{stats?.totalRequests ?? 0}</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Total Prayers</Text>
            <Text style={styles.metricValue}>{stats?.totalPrayers ?? 0}</Text>
          </View>
        </View>
        {stats?.updatedAt ? (
          <Text style={styles.updated}>
            Updated at {new Date(stats.updatedAt.toDate ? stats.updatedAt.toDate() : stats.updatedAt).toLocaleString()}
          </Text>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
    backgroundColor: palette.background,
  },
  card: {
    backgroundColor: '#ffffff',
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: palette.text,
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
    color: palette.muted,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '800',
    color: palette.text,
  },
  updated: {
    marginTop: spacing.md,
    fontSize: 12,
    color: palette.muted,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.background,
  },
  denied: {
    marginTop: spacing.sm,
    color: palette.muted,
  },
});

