import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { palette, radius, spacing } from '../theme/colors';
import type { FeedItem } from '../types';

type Props = {
  item: FeedItem;
  onPray?: (id: string) => void;
  onLike?: (id: string) => void;
  disabled?: boolean;
  onPress?: (item: FeedItem) => void;
};

export const FeedCard: React.FC<Props> = ({ item, onPray, onLike, disabled, onPress }) => {
  const isRequest = item.type === 'REQUEST';
  return (
    <Pressable onPress={() => onPress?.(item)}>
      <LinearGradient
        colors={['#ffffff', '#fef3c7']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{item.userDisplayName}</Text>
            <Text style={styles.meta}>{item.location}</Text>
          </View>
          <View style={[styles.severity, isRequest ? styles.requestChip : styles.testimonyChip]}>
            <Text style={styles.severityText}>{isRequest ? item.severity : 'RESOLVED'}</Text>
          </View>
        </View>
        <Text style={styles.content}>{item.content}</Text>
        <View style={styles.footer}>
          {isRequest ? (
            <Pressable
              onPress={() => onPray?.(item.id)}
              style={({ pressed }) => [
                styles.actionButton,
                { backgroundColor: pressed ? palette.accentDark : palette.accent },
                disabled && styles.disabled,
              ]}
              disabled={disabled}
            >
              <Text style={styles.actionText}>Pray</Text>
              <Text style={styles.counter}>{item.prayers ?? 0}</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => onLike?.(item.id)}
              style={({ pressed }) => [
                styles.actionButton,
                { backgroundColor: pressed ? '#d97706' : '#facc15' },
                disabled && styles.disabled,
              ]}
              disabled={disabled}
            >
              <Text style={styles.actionText}>Amen</Text>
              <Text style={styles.counter}>{item.likes ?? 0}</Text>
            </Pressable>
          )}
          <Text style={styles.timestampLabel}>{item.createdAt ? 'Live' : 'Recently'}</Text>
        </View>
      </LinearGradient>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginVertical: spacing.sm,
    shadowColor: palette.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 4,
    borderWidth: 1,
    borderColor: palette.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: palette.text,
  },
  meta: {
    fontSize: 12,
    color: palette.muted,
    marginTop: 2,
  },
  severity: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  severityText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: '#1f2937',
  },
  requestChip: {
    backgroundColor: '#fee2e2',
  },
  testimonyChip: {
    backgroundColor: '#dcfce7',
  },
  content: {
    fontSize: 15,
    lineHeight: 22,
    color: '#111827',
    marginBottom: spacing.md,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  actionText: {
    fontWeight: '800',
    color: '#1f2937',
  },
  counter: {
    fontWeight: '700',
    color: '#111827',
  },
  timestampLabel: {
    fontSize: 12,
    color: palette.muted,
  },
  disabled: {
    opacity: 0.5,
  },
});
