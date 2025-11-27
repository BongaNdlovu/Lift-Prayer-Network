import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { useAuth } from '../../hooks/useAuth';
import { db, firebaseEnabled } from '../../services/firebase';
import { palette, radius, spacing } from '../../theme/colors';
import type { PeopleStat } from '../../types';

export const PeopleScreen: React.FC = () => {
  const { user } = useAuth();
  const [people, setPeople] = useState<PeopleStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !firebaseEnabled || !db) {
      setLoading(false);
      return undefined;
    }
    const q = query(
      collection(db, 'userPrayedFor', user.uid, 'people'),
      orderBy('lastPrayedAt', 'desc'),
    );
    const unsub = onSnapshot(q, (snap) => {
      setPeople(
        snap.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as any),
        })) as PeopleStat[],
      );
      setLoading(false);
    });
    return unsub;
  }, [user]);

  if (!user) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.title}>Sign in to see who you have prayed for.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.heading}>People you prayed for</Text>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={palette.accent} />
        </View>
      ) : (
        <FlatList
          data={people}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.summary}>{item.targetName || item.targetOwnerUid}</Text>
              <Text style={styles.meta}>Prayers: {item.count}</Text>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.meta}>No people tracked yet.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
    padding: spacing.lg,
  },
  heading: {
    fontSize: 22,
    fontWeight: '900',
    color: palette.text,
    marginBottom: spacing.md,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.border,
    marginBottom: spacing.sm,
  },
  summary: {
    fontWeight: '700',
    color: palette.text,
    marginBottom: 4,
  },
  meta: {
    color: palette.muted,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.text,
  },
});
