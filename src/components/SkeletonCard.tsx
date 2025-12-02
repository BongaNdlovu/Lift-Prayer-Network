import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { radius, spacing } from '../theme/colors';

type SkeletonVariant = 'card' | 'list' | 'group' | 'notification' | 'compact';

type Props = {
  variant?: SkeletonVariant;
  count?: number;
};

export const SkeletonCard: React.FC<Props> = ({ variant = 'card', count = 1 }) => {
  const shimmer = useRef(new Animated.Value(0)).current;
  const { colors, isDark } = useTheme();

  useEffect(() => {
    Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      }),
    ).start();
  }, [shimmer]);

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
          <View key={index} style={[styles.listItem, { backgroundColor: colors.surface }]}>
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
          <View key={index} style={[styles.groupCard, { backgroundColor: colors.surface }]}>
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
          <View key={index} style={[styles.notificationItem, { backgroundColor: colors.surface }]}>
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
          <View key={index} style={[styles.compactCard, { backgroundColor: colors.surface }]}>
            <View style={[styles.line, { backgroundColor: skeletonBg }]} />
            <Animated.View style={[styles.shimmer, { backgroundColor: shimmerBg, transform: [{ translateX }] }]} />
          </View>
        );
      
      default: // 'card'
        return (
          <View key={index} style={[styles.card, { backgroundColor: colors.surface }]}>
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
    <>
      {Array.from({ length: count }).map((_, index) => renderSkeleton(index))}
    </>
  );
};

// Convenience components for specific use cases
export const SkeletonList: React.FC<{ count?: number }> = ({ count = 5 }) => (
  <SkeletonCard variant="list" count={count} />
);

export const SkeletonGroups: React.FC<{ count?: number }> = ({ count = 3 }) => (
  <SkeletonCard variant="group" count={count} />
);

export const SkeletonNotifications: React.FC<{ count?: number }> = ({ count = 5 }) => (
  <SkeletonCard variant="notification" count={count} />
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
});
