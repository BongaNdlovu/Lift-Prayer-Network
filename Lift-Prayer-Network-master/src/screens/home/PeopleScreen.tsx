import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../contexts/ThemeContext';
import { db, firebaseEnabled } from '../../services/firebase';
import { radius, spacing } from '../../theme/colors';
import { LiftAvatar, LiftEmptyState, LiftHeader, LiftInput, LiftScreen, LiftTabs } from '../../components/LiftLayout';
import type { PeopleStat } from '../../types';

export const PeopleScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { colors } = useTheme();
  const [people, setPeople] = useState<PeopleStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const filteredPeople = people.filter((person) => {
    const label = `${person.targetName || ''} ${person.targetOwnerUid || ''}`.toLowerCase();
    return label.includes(search.trim().toLowerCase());
  });

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
        <LiftInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search people you've prayed for..."
          right={<Ionicons name="search-outline" size={18} color={colors.muted} />}
          style={styles.searchInput}
        />
        <LiftTabs
          tabs={[
            { value: 'people', label: 'People' },
            { value: 'following', label: 'Following' },
          ]}
          active="people"
          onChange={(value) => {
            if (value === 'following') navigation.navigate('Following' as never);
          }}
        />
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : (
          <FlatList
            data={filteredPeople}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <LiftAvatar name={item.targetName || item.targetOwnerUid} size={42} />
                <View style={styles.personText}>
                  <Text style={[styles.summary, { color: colors.text }]}>{item.targetName || item.targetOwnerUid}</Text>
                  <Text style={[styles.meta, { color: colors.muted }]}>Prayers: {item.count}</Text>
                </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  searchInput: {
    marginBottom: spacing.sm,
  },
  personText: {
    flex: 1,
  },
  summary: {
    fontWeight: '700',
    marginBottom: 4,
  },
  meta: {
    fontSize: 13,
  },
});
