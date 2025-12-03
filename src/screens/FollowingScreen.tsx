import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Image,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../hooks/useAuth';
import { useFollowing } from '../hooks/useFollowing';
import { useTheme } from '../contexts/ThemeContext';
import { CinematicBackground, RoundedPage } from '../components/CinematicBackground';
import { palette, fonts, fontSizes, spacing, radius } from '../theme/colors';
import type { FollowRecord } from '../types';

const getInitials = (name: string): string => {
  if (!name) return '?';
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

const getAvatarColor = (name: string): string => {
  const colors = ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

export const FollowingScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const { following, loading, unfollow } = useFollowing(user?.uid);

  const handleUnfollow = async (record: FollowRecord) => {
    Alert.alert(
      'Unfollow',
      `Unfollow ${record.targetDisplayName}? Their posts will no longer appear first in your feed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unfollow',
          style: 'destructive',
          onPress: async () => {
            if (Platform.OS !== 'web') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
            const success = await unfollow(record.targetUid);
            if (success) {
              Alert.alert('Unfollowed', `You unfollowed ${record.targetDisplayName}`);
            } else {
              Alert.alert('Error', 'Could not unfollow. Please try again.');
            }
          },
        },
      ]
    );
  };

  const renderFollowItem = ({ item }: { item: FollowRecord }) => {
    const initials = getInitials(item.targetDisplayName);
    const avatarColor = getAvatarColor(item.targetDisplayName);

    return (
      <View style={[styles.followItem, { backgroundColor: colors.glassWhite, borderColor: colors.glassBorder }]}>
        <View style={styles.userInfo}>
          {item.targetPhotoURL ? (
            <Image source={{ uri: item.targetPhotoURL }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: avatarColor }]}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          )}
          <View style={styles.userDetails}>
            <Text style={[styles.userName, { color: colors.text }]}>{item.targetDisplayName}</Text>
            <Text style={styles.followedAt}>
              Following since {item.followedAt ? new Date((item.followedAt as any).toDate?.() || item.followedAt).toLocaleDateString() : 'recently'}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.unfollowButton}
          onPress={() => handleUnfollow(item)}
        >
          <Ionicons name="person-remove-outline" size={18} color="#dc2626" />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <CinematicBackground>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Following</Text>
          <View style={styles.headerSpacer} />
        </View>

        <RoundedPage style={styles.content}>
          {/* Info Banner */}
          <View style={[styles.infoBanner, { backgroundColor: colors.glassWhiteLight, borderColor: colors.glassBorder }]}>
            <Ionicons name="information-circle-outline" size={20} color={colors.amber600} />
            <Text style={[styles.infoText, { color: colors.stone600 }]}>
              Posts from people you follow appear first in your feed.
            </Text>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={[styles.loadingText, { color: colors.stone500 }]}>Loading...</Text>
            </View>
          ) : following.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>👥</Text>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>Not following anyone yet</Text>
              <Text style={[styles.emptySubtitle, { color: colors.stone500 }]}>
                Follow users from the feed to see their prayer requests first.
              </Text>
            </View>
          ) : (
            <FlatList
              data={following}
              keyExtractor={(item) => item.id}
              renderItem={renderFollowItem}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
              ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
            />
          )}
        </RoundedPage>
      </SafeAreaView>
    </CinematicBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backButton: {
    padding: spacing.xs,
  },
  title: {
    fontSize: fontSizes.lg,
    fontFamily: fonts.heading,
    fontWeight: '700',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  infoText: {
    flex: 1,
    fontSize: fontSizes.sm,
    fontFamily: fonts.body,
    lineHeight: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: fontSizes.md,
    fontFamily: fonts.body,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: fontSizes.lg,
    fontFamily: fonts.heading,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.body,
    textAlign: 'center',
    lineHeight: 20,
  },
  list: {
    paddingBottom: spacing.xl,
  },
  followItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  avatarText: {
    fontSize: fontSizes.sm,
    fontWeight: '700',
    fontFamily: fonts.bodyBold,
    color: '#fff',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: fontSizes.md,
    fontFamily: fonts.bodyMedium,
    fontWeight: '600',
  },
  followedAt: {
    fontSize: fontSizes.xs,
    fontFamily: fonts.body,
    color: palette.muted,
    marginTop: 2,
  },
  unfollowButton: {
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(220,38,38,0.1)',
  },
});

export default FollowingScreen;
