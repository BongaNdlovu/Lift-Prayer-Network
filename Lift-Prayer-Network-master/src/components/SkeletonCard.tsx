import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, AccessibilityInfo } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { radius, spacing } from '../theme/colors';

type SkeletonVariant = 
  | 'card' 
  | 'list' 
  | 'group' 
  | 'notification' 
  | 'compact'
  | 'profile'
  | 'detail'
  | 'comment'
  | 'announcement';

type Props = {
  variant?: SkeletonVariant;
  count?: number;
  /** Accessibility label for screen readers */
  accessibilityLabel?: string;
};

export const SkeletonCard: React.FC<Props> = ({ 
  variant = 'card', 
  count = 1,
  accessibilityLabel = 'Loading content',
}) => {
  const shimmer = useRef(new Animated.Value(0)).current;
  const { colors, isDark } = useTheme();

  useEffect(() => {
    // Announce loading state for screen readers
    AccessibilityInfo.announceForAccessibility(accessibilityLabel);
    
    Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      }),
    ).start();
  }, [shimmer, accessibilityLabel]);

  const translateX = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-40, 200],
  });

  const skeletonBg = isDark ? '#334155' : '#e5e7eb';
  const shimmerBg = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.5)';

  const renderSkeleton = (index: number) => {
    switch (variant) {
      case 'list':
        return (
          <View key={index} style={[styles.listItem, { backgroundColor: colors.surface }]} accessibilityLabel="Loading list item">
            <View style={[styles.avatar, { backgroundColor: skeletonBg }]} />
            <View style={styles.listContent}>
              <View style={[styles.lineWide, { backgroundColor: skeletonBg }]} />
              <View style={[styles.lineNarrow, { backgroundColor: skeletonBg }]} />
            </View>
            <Animated.View style={[styles.shimmer, { backgroundColor: shimmerBg, transform: [{ translateX }] }]} />
          </View>
        );
      
      case 'group':
        return (
          <View key={index} style={[styles.groupCard, { backgroundColor: colors.surface }]} accessibilityLabel="Loading group">
            <View style={[styles.groupEmoji, { backgroundColor: skeletonBg }]} />
            <View style={styles.groupContent}>
              <View style={[styles.lineWide, { backgroundColor: skeletonBg }]} />
              <View style={[styles.lineNarrow, { backgroundColor: skeletonBg, marginTop: 6 }]} />
            </View>
            <Animated.View style={[styles.shimmer, { backgroundColor: shimmerBg, transform: [{ translateX }] }]} />
          </View>
        );
      
      case 'notification':
        return (
          <View key={index} style={[styles.notificationItem, { backgroundColor: colors.surface }]} accessibilityLabel="Loading notification">
            <View style={[styles.notifIcon, { backgroundColor: skeletonBg }]} />
            <View style={styles.notifContent}>
              <View style={[styles.lineWide, { backgroundColor: skeletonBg }]} />
              <View style={[styles.line, { backgroundColor: skeletonBg, marginTop: 4 }]} />
            </View>
            <Animated.View style={[styles.shimmer, { backgroundColor: shimmerBg, transform: [{ translateX }] }]} />
          </View>
        );
      
      case 'compact':
        return (
          <View key={index} style={[styles.compactCard, { backgroundColor: colors.surface }]} accessibilityLabel="Loading">
            <View style={[styles.line, { backgroundColor: skeletonBg }]} />
            <Animated.View style={[styles.shimmer, { backgroundColor: shimmerBg, transform: [{ translateX }] }]} />
          </View>
        );
      
      case 'profile':
        return (
          <View key={index} style={[styles.profileCard, { backgroundColor: colors.surface }]} accessibilityLabel="Loading profile">
            <View style={[styles.profileAvatar, { backgroundColor: skeletonBg }]} />
            <View style={[styles.lineWide, { backgroundColor: skeletonBg, marginTop: spacing.md }]} />
            <View style={[styles.lineNarrow, { backgroundColor: skeletonBg, marginTop: spacing.xs, alignSelf: 'center' }]} />
            <View style={styles.profileStats}>
              <View style={[styles.statBox, { backgroundColor: skeletonBg }]} />
              <View style={[styles.statBox, { backgroundColor: skeletonBg }]} />
              <View style={[styles.statBox, { backgroundColor: skeletonBg }]} />
            </View>
            <Animated.View style={[styles.shimmer, { backgroundColor: shimmerBg, transform: [{ translateX }] }]} />
          </View>
        );
      
      case 'detail':
        return (
          <View key={index} style={[styles.detailCard, { backgroundColor: colors.surface }]} accessibilityLabel="Loading details">
            <View style={styles.detailHeader}>
              <View style={[styles.avatar, { backgroundColor: skeletonBg }]} />
              <View style={styles.detailHeaderText}>
                <View style={[styles.lineWide, { backgroundColor: skeletonBg }]} />
                <View style={[styles.lineNarrow, { backgroundColor: skeletonBg, marginTop: 4 }]} />
              </View>
            </View>
            <View style={[styles.lineWide, { backgroundColor: skeletonBg, marginTop: spacing.md }]} />
            <View style={[styles.line, { backgroundColor: skeletonBg, marginTop: spacing.xs }]} />
            <View style={[styles.line, { backgroundColor: skeletonBg, marginTop: spacing.xs }]} />
            <View style={[styles.lineNarrow, { backgroundColor: skeletonBg, marginTop: spacing.xs }]} />
            <View style={styles.detailFooter}>
              <View style={[styles.badge, { backgroundColor: skeletonBg }]} />
              <View style={[styles.badge, { backgroundColor: skeletonBg }]} />
            </View>
            <Animated.View style={[styles.shimmer, { backgroundColor: shimmerBg, transform: [{ translateX }] }]} />
          </View>
        );
      
      case 'comment':
        return (
          <View key={index} style={[styles.commentItem, { backgroundColor: colors.surface }]} accessibilityLabel="Loading comment">
            <View style={[styles.commentAvatar, { backgroundColor: skeletonBg }]} />
            <View style={styles.commentContent}>
              <View style={[styles.lineNarrow, { backgroundColor: skeletonBg, width: '40%' }]} />
              <View style={[styles.line, { backgroundColor: skeletonBg, marginTop: 4 }]} />
            </View>
            <Animated.View style={[styles.shimmer, { backgroundColor: shimmerBg, transform: [{ translateX }] }]} />
          </View>
        );
      
      case 'announcement':
        return (
          <View key={index} style={[styles.announcementCard, { backgroundColor: colors.surface }]} accessibilityLabel="Loading announcement">
            <View style={[styles.announcementBadge, { backgroundColor: skeletonBg }]} />
            <View style={[styles.lineWide, { backgroundColor: skeletonBg, marginTop: spacing.sm }]} />
            <View style={[styles.line, { backgroundColor: skeletonBg, marginTop: spacing.xs }]} />
            <View style={[styles.lineNarrow, { backgroundColor: skeletonBg, marginTop: spacing.xs }]} />
            <Animated.View style={[styles.shimmer, { backgroundColor: shimmerBg, transform: [{ translateX }] }]} />
          </View>
        );
      
      default: // 'card'
        return (
          <View key={index} style={[styles.card, { backgroundColor: colors.surface }]} accessibilityLabel="Loading prayer request">
            <View style={[styles.lineWide, { backgroundColor: skeletonBg }]} />
            <View style={[styles.line, { backgroundColor: skeletonBg }]} />
            <View style={styles.footer}>
              <View style={[styles.badge, { backgroundColor: skeletonBg }]} />
              <View style={[styles.badgeSmall, { backgroundColor: skeletonBg }]} />
            </View>
            <Animated.View style={[styles.shimmer, { backgroundColor: shimmerBg, transform: [{ translateX }] }]} />
          </View>
        );
    }
  };

  return (
    <View accessibilityRole="progressbar" accessibilityLabel={accessibilityLabel}>
      {Array.from({ length: count }).map((_, index) => renderSkeleton(index))}
    </View>
  );
};

// Convenience components for specific use cases
export const SkeletonList: React.FC<{ count?: number }> = ({ count = 5 }) => (
  <SkeletonCard variant="list" count={count} accessibilityLabel="Loading list" />
);

export const SkeletonGroups: React.FC<{ count?: number }> = ({ count = 3 }) => (
  <SkeletonCard variant="group" count={count} accessibilityLabel="Loading groups" />
);

export const SkeletonNotifications: React.FC<{ count?: number }> = ({ count = 5 }) => (
  <SkeletonCard variant="notification" count={count} accessibilityLabel="Loading notifications" />
);

export const SkeletonProfile: React.FC = () => (
  <SkeletonCard variant="profile" count={1} accessibilityLabel="Loading profile" />
);

export const SkeletonDetail: React.FC = () => (
  <SkeletonCard variant="detail" count={1} accessibilityLabel="Loading details" />
);

export const SkeletonComments: React.FC<{ count?: number }> = ({ count = 3 }) => (
  <SkeletonCard variant="comment" count={count} accessibilityLabel="Loading comments" />
);

export const SkeletonAnnouncements: React.FC<{ count?: number }> = ({ count = 3 }) => (
  <SkeletonCard variant="announcement" count={count} accessibilityLabel="Loading announcements" />
);

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginVertical: spacing.sm,
    overflow: 'hidden',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    marginVertical: spacing.xs,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: spacing.md,
  },
  listContent: {
    flex: 1,
  },
  groupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    marginVertical: spacing.sm,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  groupEmoji: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    marginRight: spacing.md,
  },
  groupContent: {
    flex: 1,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    marginVertical: spacing.xs,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  notifIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: spacing.sm,
  },
  notifContent: {
    flex: 1,
  },
  compactCard: {
    padding: spacing.md,
    marginVertical: spacing.xs,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  lineWide: {
    height: 16,
    backgroundColor: '#e5e7eb',
    borderRadius: 8,
    marginBottom: spacing.sm,
  },
  line: {
    height: 14,
    backgroundColor: '#e5e7eb',
    borderRadius: 8,
    width: '80%',
  },
  lineNarrow: {
    height: 12,
    backgroundColor: '#e5e7eb',
    borderRadius: 6,
    width: '60%',
    marginTop: spacing.xs,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  badge: {
    width: 80,
    height: 20,
    backgroundColor: '#e5e7eb',
    borderRadius: 10,
  },
  badgeSmall: {
    width: 60,
    height: 20,
    backgroundColor: '#e5e7eb',
    borderRadius: 10,
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    width: 60,
    backgroundColor: 'rgba(255,255,255,0.5)',
    opacity: 0.6,
  },
  // Profile skeleton styles
  profileCard: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginVertical: spacing.sm,
    overflow: 'hidden',
    alignItems: 'center',
  },
  profileAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  profileStats: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  statBox: {
    width: 60,
    height: 50,
    borderRadius: radius.md,
  },
  // Detail skeleton styles
  detailCard: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginVertical: spacing.sm,
    overflow: 'hidden',
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailHeaderText: {
    flex: 1,
  },
  detailFooter: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  // Comment skeleton styles
  commentItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.sm,
    marginVertical: spacing.xs,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: spacing.sm,
  },
  commentContent: {
    flex: 1,
  },
  // Announcement skeleton styles
  announcementCard: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginVertical: spacing.sm,
    overflow: 'hidden',
  },
  announcementBadge: {
    width: 100,
    height: 24,
    borderRadius: radius.sm,
  },
});
