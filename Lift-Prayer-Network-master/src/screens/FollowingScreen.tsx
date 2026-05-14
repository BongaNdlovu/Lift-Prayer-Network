import React from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../hooks/useAuth';
import { useFollowing } from '../hooks/useFollowing';
import { useTheme } from '../contexts/ThemeContext';
import { fonts, spacing } from '../theme/colors';
import {
  LiftActionRow,
  LiftAvatar,
  LiftEmptyState,
  LiftFlatCard,
  LiftHeader,
  LiftLoadingState,
  LiftScreen,
} from '../components/LiftLayout';
import type { FollowRecord } from '../types';

export const FollowingScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { colors } = useTheme();
  const { following, loading, unfollow } = useFollowing(user?.uid);

  const handleUnfollow = async (record: FollowRecord) => {
    Alert.alert('Unfollow', `Unfollow ${record.targetDisplayName}? Their posts will no longer appear first in your feed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unfollow',
        style: 'destructive',
        onPress: async () => {
          if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
          const success = await unfollow(record.targetUid);
          Alert.alert(success ? 'Unfollowed' : 'Error', success ? `You unfollowed ${record.targetDisplayName}.` : 'Could not unfollow. Please try again.');
        },
      },
    ]);
  };

  return (
    <LiftScreen scroll>
      <LiftHeader title="Following" subtitle="People whose prayers you follow" onBack={() => navigation.goBack()} />

      <LiftFlatCard style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Ionicons name="information-circle-outline" size={20} color={colors.accent} />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Posts from people you follow appear first in your feed.
          </Text>
        </View>
      </LiftFlatCard>

      {loading ? (
        <LiftLoadingState label="Loading following..." />
      ) : following.length === 0 ? (
        <LiftEmptyState
          icon="people-outline"
          title="Not following anyone yet"
          message="Follow users from the feed to see their prayer requests first."
        />
      ) : (
        <View style={styles.list}>
          {following.map((record) => {
            const followedAt = record.followedAt
              ? new Date((record.followedAt as any).toDate?.() || record.followedAt).toLocaleDateString()
              : 'recently';

            return (
              <LiftFlatCard key={record.id}>
                <View style={styles.followRow}>
                  <LiftAvatar name={record.targetDisplayName} photoURL={record.targetPhotoURL} size={46} />
                  <View style={styles.followText}>
                    <Text style={[styles.userName, { color: colors.text }]} numberOfLines={1}>
                      {record.targetDisplayName}
                    </Text>
                    <Text style={[styles.followedAt, { color: colors.textSecondary }]}>Following since {followedAt}</Text>
                  </View>
                  <Pressable
                    onPress={() => handleUnfollow(record)}
                    style={({ pressed }) => [styles.unfollowButton, { backgroundColor: colors.dangerLight }, pressed && styles.pressed]}
                  >
                    <Ionicons name="person-remove-outline" size={18} color={colors.danger} />
                  </Pressable>
                </View>
              </LiftFlatCard>
            );
          })}
        </View>
      )}

      <LiftActionRow
        icon="search-outline"
        title="Find More People"
        subtitle="Search the prayer network"
        onPress={() => (navigation as any).navigate('Search')}
        style={styles.searchRow}
      />
    </LiftScreen>
  );
};

const styles = StyleSheet.create({
  infoCard: {
    marginBottom: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
  },
  list: {
    gap: spacing.md,
  },
  followRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  followText: {
    flex: 1,
  },
  userName: {
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
  },
  followedAt: {
    fontFamily: fonts.body,
    fontSize: 13,
    marginTop: 3,
  },
  unfollowButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.97 }],
  },
  searchRow: {
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
});

export default FollowingScreen;
