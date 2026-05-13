import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../contexts/ThemeContext';
import { db, firebaseEnabled } from '../../services/firebase';
import { radius, spacing } from '../../theme/colors';
import { LiftEmptyState, LiftHeader, LiftScreen } from '../../components/LiftLayout';
import type { PeopleStat } from '../../types';

export const PeopleScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { colors } = useTheme();
  const [people, setPeople] = useState<PeopleStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    if (!user || !firebaseEnabled || !db) {
      setLoading(false);
      return undefined;
    }
    const q = query(
      collection(db, 'userPrayedFor', user.uid, 'people'),
      orderBy('lastPrayedAt', 'desc'),
    );
    getDocs(q)
      .then((snap) => {
        if (!mounted) return;
        setPeople(
          snap.docs.map((docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() as any),
          })) as PeopleStat[],
        );
        setLoading(false);
      })
      .catch(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [user]);

  if (!user) {
    return (
      <LiftScreen>
        <LiftHeader title="People" subtitle="Your prayer network" />
        <LiftEmptyState
          icon="people-outline"
          title="Sign in to see your people"
          message="The people you pray for will appear here once you are signed in."
        />
      </LiftScreen>
    );
  }

  return (
    <LiftScreen scroll>
      <LiftHeader title="People" subtitle="Your prayer network" onBack={() => navigation.goBack()} />
      <View style={styles.mainContent}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : (
          <FlatList
            data={people}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.summary, { color: colors.text }]}>{item.targetName || item.targetOwnerUid}</Text>
                <Text style={[styles.meta, { color: colors.muted }]}>Prayers: {item.count}</Text>
              </View>
            )}
            ListEmptyComponent={
              <LiftEmptyState
                icon="people-outline"
                title="No connections yet"
                message="People you pray for will appear in your network."
              />
            }
          />
        )}
      </View>
    </LiftScreen>
  );
};

const styles = StyleSheet.create({
  mainContent: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  summary: {
    fontWeight: '700',
    marginBottom: 4,
  },
  meta: {
    fontSize: 13,
  },
});
