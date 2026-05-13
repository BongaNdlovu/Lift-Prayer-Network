import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LiftButton, LiftEmptyState, LiftTextButton } from './LiftLayout';
import { lightImpact } from '../utils/haptics';

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

const EMPTY_STATE_CONFIGS: Record<Exclude<EmptyStateType, 'custom'>, { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string }> = {
  'no-prayers': { icon: 'heart-outline', title: 'No prayers yet', subtitle: 'Be the first to lift someone up in prayer.' },
  'no-requests': { icon: 'create-outline', title: 'No prayer requests', subtitle: 'Share what is on your heart and let others pray with you.' },
  'no-testimonies': { icon: 'sparkles-outline', title: 'No testimonies yet', subtitle: 'Share how God has answered your prayers.' },
  'no-groups': { icon: 'people-outline', title: 'No groups yet', subtitle: 'Create a prayer circle or join one with an invite code.' },
  'no-notifications': { icon: 'notifications-outline', title: 'All caught up', subtitle: 'You will see notifications here when someone prays for you.' },
  'no-search-results': { icon: 'search-outline', title: 'No results found', subtitle: 'Try a different search term or filter.' },
  'no-history': { icon: 'reader-outline', title: 'No prayer history', subtitle: 'Your prayer journey will appear here.' },
  'no-comments': { icon: 'chatbubble-ellipses-outline', title: 'No encouragements yet', subtitle: 'Be the first to write a kind word.' },
  offline: { icon: 'cloud-offline-outline', title: 'You are offline', subtitle: 'Connect to the internet to see the latest prayers.' },
  error: { icon: 'alert-circle-outline', title: 'Something went wrong', subtitle: 'Please try again later.' },
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
  customTitle,
  customSubtitle,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
}) => {
  const config = type === 'custom'
    ? { icon: 'leaf-outline' as keyof typeof Ionicons.glyphMap, title: customTitle || '', subtitle: customSubtitle || '' }
    : EMPTY_STATE_CONFIGS[type];

  const action = actionLabel || secondaryActionLabel ? (
    <View style={{ gap: 8, marginTop: 16, minWidth: 180 }}>
      {actionLabel && onAction ? (
        <LiftButton onPress={() => { lightImpact(); onAction(); }}>{actionLabel}</LiftButton>
      ) : null}
      {secondaryActionLabel && onSecondaryAction ? (
        <LiftTextButton onPress={() => { lightImpact(); onSecondaryAction(); }}>{secondaryActionLabel}</LiftTextButton>
      ) : null}
    </View>
  ) : null;

  return (
    <LiftEmptyState
      title={config.title}
      message={config.subtitle}
      icon={config.icon}
      action={action}
    />
  );
};

