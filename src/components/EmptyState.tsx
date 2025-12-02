import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { radius, spacing } from '../theme/colors';

type EmptyStateType = 
  | 'no-prayers'
  | 'no-requests'
  | 'no-testimonies'
  | 'no-groups'
  | 'no-notifications'
  | 'no-search-results'
  | 'no-history'
  | 'no-comments'
  | 'offline'
  | 'error'
  | 'custom';

type EmptyStateConfig = {
  emoji: string;
  title: string;
  subtitle: string;
};

const EMPTY_STATE_CONFIGS: Record<Exclude<EmptyStateType, 'custom'>, EmptyStateConfig> = {
  'no-prayers': {
    emoji: '🙏',
    title: 'No prayers yet',
    subtitle: 'Be the first to lift someone up in prayer',
  },
  'no-requests': {
    emoji: '✨',
    title: 'No prayer requests',
    subtitle: 'Share what\'s on your heart and let others pray with you',
  },
  'no-testimonies': {
    emoji: '🎉',
    title: 'No testimonies yet',
    subtitle: 'Share how God has answered your prayers',
  },
  'no-groups': {
    emoji: '🤝',
    title: 'No groups yet',
    subtitle: 'Create a prayer circle or join one with an invite code',
  },
  'no-notifications': {
    emoji: '🔔',
    title: 'All caught up!',
    subtitle: 'You\'ll see notifications here when someone prays for you',
  },
  'no-search-results': {
    emoji: '🔍',
    title: 'No results found',
    subtitle: 'Try a different search term or filter',
  },
  'no-history': {
    emoji: '📜',
    title: 'No prayer history',
    subtitle: 'Your prayer journey will appear here',
  },
  'no-comments': {
    emoji: '💬',
    title: 'No comments yet',
    subtitle: 'Be the first to encourage with a comment',
  },
  'offline': {
    emoji: '📡',
    title: 'You\'re offline',
    subtitle: 'Connect to the internet to see the latest prayers',
  },
  'error': {
    emoji: '😔',
    title: 'Something went wrong',
    subtitle: 'Please try again later',
  },
};

type Props = {
  type: EmptyStateType;
  customEmoji?: string;
  customTitle?: string;
  customSubtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  compact?: boolean;
};

export const EmptyState: React.FC<Props> = ({
  type,
  customEmoji,
  customTitle,
  customSubtitle,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  compact = false,
}) => {
  const { colors } = useTheme();
  
  const config = type === 'custom' 
    ? { emoji: customEmoji || '📭', title: customTitle || '', subtitle: customSubtitle || '' }
    : EMPTY_STATE_CONFIGS[type];
  
  const emoji = customEmoji || config.emoji;
  const title = customTitle || config.title;
  const subtitle = customSubtitle || config.subtitle;

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <Text style={[styles.emoji, compact && styles.emojiCompact]}>{emoji}</Text>
      <Text style={[styles.title, { color: colors.text }, compact && styles.titleCompact]}>
        {title}
      </Text>
      <Text style={[styles.subtitle, { color: colors.muted }, compact && styles.subtitleCompact]}>
        {subtitle}
      </Text>
      
      {(actionLabel || secondaryActionLabel) && (
        <View style={styles.actions}>
          {actionLabel && onAction && (
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: colors.accent }]} 
              onPress={onAction}
            >
              <Text style={styles.actionButtonText}>{actionLabel}</Text>
            </TouchableOpacity>
          )}
          {secondaryActionLabel && onSecondaryAction && (
            <TouchableOpacity 
              style={[styles.secondaryButton, { borderColor: colors.border }]} 
              onPress={onSecondaryAction}
            >
              <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
                {secondaryActionLabel}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  containerCompact: {
    paddingVertical: spacing.md,
  },
  emoji: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  emojiCompact: {
    fontSize: 36,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  titleCompact: {
    fontSize: 14,
  },
  subtitle: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 260,
  },
  subtitleCompact: {
    fontSize: 11,
    maxWidth: 220,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  actionButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  actionButtonText: {
    color: '#1f2937',
    fontWeight: '600',
    fontSize: 12,
  },
  secondaryButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontWeight: '600',
    fontSize: 12,
  },
});
