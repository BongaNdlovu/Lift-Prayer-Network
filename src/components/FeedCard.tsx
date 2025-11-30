import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, TouchableOpacity, Alert, Modal, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { palette, radius, spacing } from '../theme/colors';
import type { FeedItem, LiftRequest } from '../types';
import { reportContent, blockUser, REPORT_REASONS, ReportReason } from '../services/moderation';
import { getVerifiedBadge, BADGE_STYLES, canEditContent, canDeleteContent, hasAdminPermission } from '../config/admins';
import { deletePrayerRequest, deleteTestimony } from '../services/prayers';

// Relative time formatting
export const formatRelativeTime = (date: any): string => {
  if (!date) return 'Just now';
  
  let timestamp: number;
  if (date.toDate) {
    timestamp = date.toDate().getTime();
  } else if (date instanceof Date) {
    timestamp = date.getTime();
  } else if (typeof date === 'number') {
    timestamp = date;
  } else {
    return 'Recently';
  }

  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);

  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  if (weeks < 4) return `${weeks}w ago`;
  return new Date(timestamp).toLocaleDateString();
};

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

type ReactionType = 'pray' | 'heart' | 'fire' | 'strong';

const REACTIONS: { type: ReactionType; emoji: string; label: string }[] = [
  { type: 'pray', emoji: '🙏', label: 'Pray' },
  { type: 'heart', emoji: '❤️', label: 'Love' },
  { type: 'fire', emoji: '🔥', label: 'Fire' },
  { type: 'strong', emoji: '💪', label: 'Strength' },
];

type Props = {
  item: FeedItem;
  onPray?: (id: string) => void;
  onLike?: (id: string) => void;
  onReact?: (id: string, reaction: ReactionType) => void;
  disabled?: boolean;
  onPress?: (item: FeedItem) => void;
  onEdit?: (item: FeedItem) => void;
  onDelete?: (item: FeedItem) => void;
  onPin?: (id: string, isPinned: boolean) => void;
  currentUserId?: string;
  currentUserEmail?: string | null;
};

export const FeedCard: React.FC<Props> = ({ 
  item, 
  onPray, 
  onLike, 
  onReact, 
  disabled, 
  onPress, 
  onEdit,
  onDelete,
  onPin,
  currentUserId,
  currentUserEmail,
}) => {
  const isRequest = item.type === 'REQUEST';
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null);
  const [reporting, setReporting] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [activeReaction, setActiveReaction] = useState<ReactionType | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Permission checks
  const canEdit = canEditContent(item.ownerUid, currentUserId, currentUserEmail);
  const canDelete = canDeleteContent(item.ownerUid, currentUserId, currentUserEmail);
  const isAdmin = hasAdminPermission(currentUserEmail);
  const isOwner = item.ownerUid === currentUserId;
  
  // Pin status (only for requests)
  const isPinned = isRequest && (item as LiftRequest).isPinned;

  const handleReport = async () => {
    if (!currentUserId || !selectedReason) return;
    
    setReporting(true);
    try {
      await reportContent(
        currentUserId,
        item.type === 'REQUEST' ? 'request' : 'testimony',
        item.id,
        item.ownerUid,
        selectedReason
      );
      setShowReportModal(false);
      setSelectedReason(null);
      Alert.alert('Reported', 'Thank you for helping keep our community safe.');
    } catch (err) {
      Alert.alert('Error', 'Could not submit report. Please try again.');
    } finally {
      setReporting(false);
    }
  };

  const handleBlockUser = async () => {
    if (!currentUserId) return;
    
    Alert.alert(
      'Block User',
      `Block ${item.userDisplayName}? You won't see their posts anymore.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            await blockUser(currentUserId, item.ownerUid);
            Alert.alert('Blocked', `${item.userDisplayName} has been blocked.`);
          },
        },
      ]
    );
  };

  const handleDeleteContent = async () => {
    if (!currentUserId) return;

    Alert.alert(
      'Delete ' + (isRequest ? 'Prayer Request' : 'Testimony'),
      'Are you sure you want to delete this? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              let result;
              if (isRequest) {
                result = await deletePrayerRequest(item.id, currentUserId, currentUserEmail);
              } else {
                result = await deleteTestimony(item.id, currentUserId, currentUserEmail);
              }

              if (result.success) {
                if (Platform.OS !== 'web') {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }
                onDelete?.(item);
              } else {
                Alert.alert('Error', result.error || 'Could not delete.');
              }
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Could not delete.');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  const showOptions = () => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }

    const options: any[] = [];

    // Pin/Unpin option - admin only, requests only
    if (isAdmin && isRequest) {
      options.push({
        text: isPinned ? '📌 Unpin from Top' : '📌 Pin to Top',
        onPress: () => onPin?.(item.id, !isPinned),
      });
    }

    // Edit option - for owner or admin
    if (canEdit) {
      options.push({
        text: '✏️ Edit',
        onPress: () => onEdit?.(item),
      });
    }

    // Delete option - for owner or admin
    if (canDelete) {
      options.push({
        text: '🗑️ Delete',
        onPress: handleDeleteContent,
        style: 'destructive',
      });
    }

    // Report & Block - for non-owners only
    if (!isOwner) {
      options.push({ text: '🚩 Report', onPress: () => setShowReportModal(true) });
      options.push({ text: '🚫 Block User', onPress: handleBlockUser, style: 'destructive' });
    }

    options.push({ text: 'Cancel', style: 'cancel' });
    
    Alert.alert(
      isOwner ? 'Manage Your Post' : (isAdmin ? 'Admin Options' : 'Options'),
      isAdmin && !isOwner ? 'You are viewing as admin' : undefined,
      options
    );
  };

  const handlePrayPress = () => {
    // Prevent double-taps
    if (disabled) return;
    
    // Haptic feedback (optional - don't crash if unavailable)
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch (err) {
        // Haptics not available on this device - ignore silently
      }
    }
    
    // Call the pray handler - ONLY ONCE
    if (onPray && item?.id) {
      onPray(item.id);
    }
  };

  const handleAmenPress = () => {
    // Haptic feedback for Amen (wrapped in try-catch to prevent crashes on some devices)
    if (Platform.OS !== 'web') {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (err) {
        console.warn('[FeedCard] Haptics not available:', err);
      }
    }
    onLike?.(item.id);
  };

  const avatarColor = getAvatarColor(item.userDisplayName || '');
  const initials = getInitials(item.userDisplayName || '');
  const userPhotoURL = (item as any).userPhotoURL;
  
  // Check if this is an urgent/critical prayer
  const isUrgent = isRequest && (item.severity === 'CRITICAL' || (item as any).isUrgent);
  
  // Get the actual status for display
  const displayStatus = isRequest ? (item as LiftRequest).status : 'RESOLVED';
  
  // Check if user is verified admin
  const verifiedBadge = getVerifiedBadge((item as any).userEmail);
  const badgeStyle = verifiedBadge ? BADGE_STYLES[verifiedBadge.badgeType] : null;

  // Different gradient for urgent prayers
  const cardColors: [string, string] = isUrgent
    ? ['#fef2f2', '#fee2e2']
    : ['#ffffff', '#fef3c7'];

  return (
    <Pressable onPress={() => onPress?.(item)}>
      {isPinned && (
        <View style={styles.pinnedBadge}>
          <Ionicons name="pin" size={10} color="#fff" />
          <Text style={styles.pinnedBadgeText}>PINNED</Text>
        </View>
      )}
      {isUrgent && !isPinned && (
        <View style={styles.urgentBadge}>
          <Text style={styles.urgentBadgeText}>🚨 URGENT</Text>
        </View>
      )}
      <LinearGradient
        colors={isPinned ? ['#fef3c7', '#fde68a'] : cardColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.card, isUrgent && styles.cardUrgent, isPinned && styles.cardPinned]}
      >
        <View style={styles.header}>
          <View style={styles.userInfo}>
            {userPhotoURL ? (
              <Image source={{ uri: userPhotoURL }} style={styles.avatarImage} />
            ) : (
            <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            )}
            <View style={styles.userTextInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.title} numberOfLines={1}>{item.userDisplayName}</Text>
                {verifiedBadge && badgeStyle && (
                  <View style={[styles.verifiedBadge, { backgroundColor: badgeStyle.backgroundColor }]}>
                    <Ionicons name="checkmark-circle" size={10} color={badgeStyle.textColor} />
                    <Text style={[styles.verifiedBadgeText, { color: badgeStyle.textColor }]}>
                      {verifiedBadge.badgeLabel}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.meta}>{formatRelativeTime((item as any).createdAt)}</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <View style={[
              styles.statusBadge, 
              displayStatus === 'PENDING' && styles.statusPending,
              displayStatus === 'ACTIVE' && styles.statusActive,
              displayStatus === 'RESOLVED' && styles.statusResolved,
            ]}>
              <Text style={[
                styles.statusText,
                displayStatus === 'PENDING' && styles.statusTextPending,
                displayStatus === 'ACTIVE' && styles.statusTextActive,
                displayStatus === 'RESOLVED' && styles.statusTextResolved,
              ]}>{displayStatus}</Text>
            </View>
            {currentUserId && (canEdit || canDelete || item.ownerUid !== currentUserId) && (
              <TouchableOpacity 
                style={[styles.optionsButton, deleting && styles.disabled]} 
                onPress={showOptions}
                disabled={deleting}
              >
                <Ionicons 
                  name={isOwner ? "settings-outline" : "ellipsis-horizontal"} 
                  size={18} 
                  color={isOwner ? palette.accentDark : palette.muted} 
                />
              </TouchableOpacity>
            )}
          </View>
        </View>
        <Text style={styles.content}>{item.content}</Text>
        
        {/* Show linked prayer request badge for testimonies */}
        {!isRequest && (item as any).linkedRequestId && (
          <View style={styles.linkedBadge}>
            <Ionicons name="checkmark-circle" size={14} color="#22c55e" />
            <Text style={styles.linkedBadgeText}>Answered Prayer ✨</Text>
          </View>
        )}
        
        <View style={styles.footer}>
          {isRequest ? (
            <View style={styles.reactionsRow}>
              {/* Main Pray Button - simplified to avoid Android crashes */}
              <TouchableOpacity
                onPress={handlePrayPress}
                onLongPress={() => setShowReactions(!showReactions)}
                style={[styles.actionButton, styles.prayButtonWrapper, disabled && styles.disabled]}
                disabled={disabled}
                activeOpacity={0.7}
              >
                <Text style={styles.prayEmoji}>🙏</Text>
                <Text style={styles.actionText}>Pray</Text>
                <Text style={styles.counter}>{item.prayers ?? 0}</Text>
              </TouchableOpacity>

              {/* Additional Reactions */}
              <View style={styles.extraReactions}>
                {REACTIONS.slice(1).map((reaction) => (
                  <TouchableOpacity
                    key={reaction.type}
                    style={[
                      styles.reactionButton,
                      activeReaction === reaction.type && styles.reactionButtonActive,
                    ]}
                    onPress={() => {
                      if (Platform.OS !== 'web') {
                        try {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        } catch (err) {
                          // Haptics not available
                        }
                      }
                      setActiveReaction(activeReaction === reaction.type ? null : reaction.type);
                      onReact?.(item.id, reaction.type);
                    }}
                    disabled={disabled}
                  >
                    <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.reactionsRow}>
              <Pressable
                onPress={handleAmenPress}
                style={({ pressed }) => [
                  styles.actionButton,
                  styles.amenButton,
                  pressed && styles.amenButtonPressed,
                  disabled && styles.disabled,
                ]}
                disabled={disabled}
              >
                <Text style={styles.amenEmoji}>🙌</Text>
                <Text style={styles.actionText}>Amen</Text>
                <Text style={styles.counter}>{item.likes ?? 0}</Text>
              </Pressable>

              {/* Additional Reactions for Testimonies */}
              <View style={styles.extraReactions}>
                {[{ type: 'heart' as ReactionType, emoji: '❤️' }, { type: 'fire' as ReactionType, emoji: '🔥' }].map((reaction) => (
                  <TouchableOpacity
                    key={reaction.type}
                    style={[
                      styles.reactionButton,
                      activeReaction === reaction.type && styles.reactionButtonActive,
                    ]}
                    onPress={() => {
                      if (Platform.OS !== 'web') {
                        try {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        } catch (err) {
                          // Haptics not available
                        }
                      }
                      setActiveReaction(activeReaction === reaction.type ? null : reaction.type);
                      onReact?.(item.id, reaction.type);
                    }}
                    disabled={disabled}
                  >
                    <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
          
          {/* Footer info row */}
          <View style={styles.footerInfo}>
            {/* Comment count */}
            {((item as any).commentCount ?? 0) > 0 && (
              <View style={styles.commentBadge}>
                <Ionicons name="chatbubble-outline" size={12} color={palette.muted} />
                <Text style={styles.commentCount}>{(item as any).commentCount} comments</Text>
              </View>
            )}
            <View style={styles.footerSpacer} />
          </View>
        </View>
      </LinearGradient>

      {/* Report Modal */}
      <Modal
        visible={showReportModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowReportModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Report Content</Text>
              <TouchableOpacity onPress={() => setShowReportModal(false)}>
                <Ionicons name="close" size={24} color={palette.muted} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>Why are you reporting this?</Text>
            
            {REPORT_REASONS.map((reason) => (
              <TouchableOpacity
                key={reason.id}
                style={[
                  styles.reasonOption,
                  selectedReason === reason.id && styles.reasonOptionSelected,
                ]}
                onPress={() => setSelectedReason(reason.id)}
              >
                <Text style={styles.reasonEmoji}>{reason.emoji}</Text>
                <Text style={[
                  styles.reasonLabel,
                  selectedReason === reason.id && styles.reasonLabelSelected,
                ]}>{reason.label}</Text>
                {selectedReason === reason.id && (
                  <Ionicons name="checkmark-circle" size={20} color="#f59e0b" />
                )}
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={[styles.reportButton, !selectedReason && styles.reportButtonDisabled]}
              onPress={handleReport}
              disabled={!selectedReason || reporting}
            >
              <Text style={styles.reportButtonText}>
                {reporting ? 'Submitting...' : 'Submit Report'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    padding: spacing.md,
    marginVertical: spacing.xs,
    shadowColor: palette.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: palette.border,
  },
  cardUrgent: {
    borderColor: '#fca5a5',
    borderWidth: 2,
    shadowColor: '#ef4444',
    shadowOpacity: 0.15,
  },
  cardPinned: {
    borderColor: '#f59e0b',
    borderWidth: 2,
    shadowColor: '#f59e0b',
    shadowOpacity: 0.2,
  },
  pinnedBadge: {
    position: 'absolute',
    top: -8,
    left: 12,
    backgroundColor: '#f59e0b',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    zIndex: 10,
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  pinnedBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
    minWidth: 0,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
    flexShrink: 0,
  },
  avatarImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: palette.accent,
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#fff',
  },
  userTextInfo: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.text,
    flexShrink: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
  },
  verifiedBadgeText: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  meta: {
    fontSize: 11,
    color: palette.muted,
    marginTop: 1,
  },
  statusBadge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
    borderRadius: radius.sm,
    alignItems: 'center',
    flexShrink: 0,
  },
  statusPending: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  statusActive: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  statusResolved: {
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  statusText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  statusTextPending: {
    color: '#dc2626',
  },
  statusTextActive: {
    color: '#d97706',
  },
  statusTextResolved: {
    color: '#16a34a',
  },
  content: {
    fontSize: 13,
    lineHeight: 19,
    color: '#1f2937',
    marginBottom: spacing.sm,
  },
  footer: {
    gap: spacing.sm,
  },
  footerInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  commentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#f8fafc',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  commentCount: {
    fontSize: 10,
    color: palette.muted,
    fontWeight: '600',
  },
  prayButtonWrapper: {
    borderRadius: radius.md,
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 4 },
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    gap: 4,
    backgroundColor: palette.accent,
    minHeight: 32,
  },
  amenButton: {
    backgroundColor: '#facc15',
  },
  amenButtonPressed: {
    backgroundColor: '#d97706',
  },
  prayEmoji: {
    fontSize: 14,
  },
  amenEmoji: {
    fontSize: 14,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1f2937',
  },
  counter: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1f2937',
  },
  footerSpacer: {
    flex: 1,
  },
  disabled: {
    opacity: 0.5,
  },
  urgentBadge: {
    position: 'absolute',
    top: -8,
    right: 12,
    backgroundColor: '#ef4444',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    zIndex: 10,
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  urgentBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexShrink: 0,
  },
  optionsButton: {
    padding: 6,
  },
  linkedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginBottom: spacing.xs,
  },
  linkedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#166534',
  },
  reactionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  extraReactions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reactionButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.border,
  },
  reactionButtonActive: {
    backgroundColor: '#fef3c7',
    borderColor: palette.accent,
  },
  reactionEmoji: {
    fontSize: 13,
  },
  // Report Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: palette.text,
  },
  modalSubtitle: {
    fontSize: 14,
    color: palette.muted,
    marginBottom: spacing.lg,
  },
  reasonOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    backgroundColor: '#f8fafc',
    gap: spacing.md,
  },
  reasonOptionSelected: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: palette.accent,
  },
  reasonEmoji: {
    fontSize: 20,
  },
  reasonLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: palette.text,
  },
  reasonLabelSelected: {
    color: '#92400e',
  },
  reportButton: {
    backgroundColor: '#ef4444',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  reportButtonDisabled: {
    backgroundColor: '#fca5a5',
  },
  reportButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },
});
