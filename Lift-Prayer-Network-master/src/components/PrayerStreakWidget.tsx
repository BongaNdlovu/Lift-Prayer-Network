import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { radius, spacing } from '../theme/colors';

type Props = {
  currentStreak: number;
  longestStreak: number;
  lastPrayedDate?: string;
  onPress?: () => void;
};

export const PrayerStreakWidget: React.FC<Props> = ({
  currentStreak,
  longestStreak,
  lastPrayedDate,
  onPress,
}) => {
  const { colors, isDark } = useTheme();
  const flameAnim = useRef(new Animated.Value(1)).current;

  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const isStreakActive = lastPrayedDate === today || lastPrayedDate === yesterday;
  const prayedToday = lastPrayedDate === today;

  useEffect(() => {
    if (isStreakActive && currentStreak > 0) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(flameAnim, {
            toValue: 1.1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(flameAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [isStreakActive, currentStreak, flameAnim]);

  const getStreakColor = () => {
    if (!isStreakActive) return colors.muted;
    if (currentStreak >= 30) return '#ef4444';
    if (currentStreak >= 14) return '#f97316';
    if (currentStreak >= 7) return '#eab308';
    return '#C4A882';
  };

  const getStreakIcon = (): React.ComponentProps<typeof Ionicons>['name'] => {
    if (!isStreakActive) return 'leaf-outline';
    if (currentStreak >= 30) return 'flame';
    if (currentStreak >= 14) return 'flash';
    if (currentStreak >= 7) return 'sparkles';
    return 'heart';
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        { backgroundColor: isDark ? colors.surface : '#fff', borderColor: colors.border },
      ]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Animated.View style={[styles.iconContainer, { transform: [{ scale: flameAnim }] }]}>
        <Ionicons name={getStreakIcon()} size={30} color={getStreakColor()} />
      </Animated.View>

      <View style={styles.content}>
        <View style={styles.streakRow}>
          <Text style={[styles.streakNumber, { color: getStreakColor() }]}>
            {currentStreak}
          </Text>
          <Text style={[styles.streakLabel, { color: colors.text }]}>
            day{currentStreak !== 1 ? 's' : ''}
          </Text>
        </View>

        <Text style={[styles.subtitle, { color: colors.muted }]}>
          {prayedToday
            ? 'Prayed today'
            : isStreakActive
            ? 'Pray today to continue!'
            : 'Start a new streak'}
        </Text>

        {longestStreak > currentStreak && (
          <Text style={[styles.record, { color: colors.muted }]}>
            Record: {longestStreak} days
          </Text>
        )}
      </View>

      <Ionicons name="chevron-forward" size={20} color={colors.muted} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  iconContainer: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  emoji: {
    fontSize: 32,
  },
  content: {
    flex: 1,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  streakNumber: {
    fontSize: 28,
    fontWeight: '900',
  },
  streakLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  record: {
    fontSize: 11,
    marginTop: 4,
  },
});
