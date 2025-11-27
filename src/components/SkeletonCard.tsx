import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { radius, spacing } from '../theme/colors';

export const SkeletonCard: React.FC = () => {
  const shimmer = useRef(new Animated.Value(0)).current;

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

  return (
    <View style={styles.card}>
      <View style={styles.lineWide} />
      <View style={styles.line} />
      <View style={styles.footer}>
        <View style={styles.badge} />
        <View style={styles.badgeSmall} />
      </View>
      <Animated.View style={[styles.shimmer, { transform: [{ translateX }] }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginVertical: spacing.sm,
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
