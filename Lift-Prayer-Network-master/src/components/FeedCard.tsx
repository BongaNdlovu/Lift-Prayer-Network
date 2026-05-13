import React, { memo, useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, TouchableOpacity, Alert, Modal, Image, Animated, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';
import { radius, spacing, fonts, fontSizes } from '../theme/colors';
import type { FeedItem, LiftRequest } from '../types';
import { reportContent, blockUser, banUser, blockUserFromPosting, REPORT_REASONS, ReportReason } from '../services/moderation';
import { getVerifiedBadge, BADGE_STYLES, canEditContent, canDeleteContent, hasAdminPermission, hasModeratorPermission } from '../config/admins';
import { deletePrayerRequest, deleteTestimony } from '../services/prayers';
import { LiftCard } from './LiftLayout';

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

type ReactionType = 'heart' | 'fire' | 'strong';

const REACTIONS: { type: ReactionType; emoji: string; label: string }[] = [
  { type: 'heart', emoji: '❤️', label: 'Love' },
  { type: 'fire', emoji: '🔥', label: 'Fire' },
  { type: 'strong', emoji: '💪', label: 'Strength' },
];

type Props = {
  item: FeedItem;
  onPray?: (id: string) => void;
  onLike?: (id: string) => void;
  onReact?: (id: string, reaction: ReactionType) => void;
  onPromise?: (id: string) => void;
  disabled?: boolean;
  hasPrayed?: boolean;
  onPress?: (item: FeedItem) => void;
  onEdit?: (item: FeedItem) => void;
  onDelete?: (item: FeedItem) => void;
  onPin?: (id: string, isPinned: boolean) => void;
  onFollow?: (targetUid: string, displayName: string, photoURL?: string | null) => Promise<boolean>;
  onUnfollow?: (targetUid: string) => Promise<boolean>;
  isFollowing?: boolean;
  currentUserId?: string;
  currentUserEmail?: string | null;
};

const FeedCardComponent: React.FC<Props> = ({ 
  item, 
  onPray, 
  onLike, 
  onReact, 
  disabled, 
  hasPrayed = false,
  onPress, 
  onEdit,
  onDelete,
  onPin,
  onFollow,
  onUnfollow,
  isFollowing = false,
  currentUserId,
  currentUserEmail,
}) => {
  const { colors } = useTheme();
  const isRequest = item.type === 'REQUEST';
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null);
  const [reporting, setReporting] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [activeReaction, setActiveReaction] = useState<ReactionType | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [isPraying, setIsPraying] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  
  // Animation refs for pray button
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const prayerLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  // Praying animation effect
  useEffect(() => {
    if (isPraying) {
      // Start pulse and glow animation
      prayerLoopRef.current?.stop();
      prayerLoopRef.current = Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1.15,
              duration: 400,
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 400,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(glowAnim, {
              toValue: 1,
              duration: 400,
              useNativeDriver: true,
            }),
            Animated.timing(glowAnim, {
              toValue: 0.3,
              duration: 400,
              useNativeDriver: true,
            }),
          ]),
        ])
      );
      prayerLoopRef.current.start();
      
      // Stop after 1.5 seconds
      const timer = setTimeout(() => {
        prayerLoopRef.current?.stop();
        prayerLoopRef.current = null;
        setIsPraying(false);
        pulseAnim.setValue(1);
        glowAnim.setValue(0);
      }, 1500);
      
      return () => {
        clearTimeout(timer);
        prayerLoopRef.current?.stop();
        prayerLoopRef.current = null;
      };
    }
  }, [isPraying, pulseAnim, glowAnim]);

  // Permission checks
  const canEdit = canEditContent(item.ownerUid, currentUserId, currentUserEmail);
  const canDelete = canDeleteContent(item.ownerUid, currentUserId, currentUserEmail);
  const isAdmin = hasAdminPermission(currentUserEmail);
  const isModerator = hasModeratorPermission(currentUserEmail);
  const isOwner = item.ownerUid === currentUserId;
  
  // Pin status (only for requests)
  const isPinned = isRequest && (item as LiftRequest).isPinned;

  // Handle follow/unfollow
  const handleFollowToggle = async () => {
    if (!currentUserId || isOwner || followLoading) return;
    
    setFollowLoading(true);
    try {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      
      if (isFollowing) {
        const success = await onUnfollow?.(item.ownerUid);
        if (success) {
          Alert.alert('Unfollowed', `You unfollowed ${item.userDisplayName}`);
        }
      } else {
        const success = await onFollow?.(item.ownerUid, item.userDisplayName, (item as any).userPhotoURL);
        if (success) {
          Alert.alert('Following', `You are now following ${item.userDisplayName}. Their posts will appear first in your feed.`);
        }
      }
    } catch {
      Alert.alert('Error', 'Could not update follow status. Please try again.');
    } finally {
      setFollowLoading(false);
    }
  };

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
    } catch {
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

  const handleBlockFromPosting = async () => {
    if (!isModerator) return;
    
    Alert.alert(
      '🚫 Block User from Posting',
      `This will prevent "${item.userDisplayName}" from creating new posts. They can still view and pray for others.\n\nAre you sure?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block from Posting',
          style: 'destructive',
          onPress: async () => {
            const result = await blockUserFromPosting(item.ownerUid, 'Blocked by moderator');
            if (result.success) {
              if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
              Alert.alert('User Blocked', `${item.userDisplayName} can no longer create posts.`);
            } else {
              Alert.alert('Error', result.error || 'Could not block user.');
            }
          },
        },
      ]
    );
  };

  const handleBanUser = async () => {
    if (!isAdmin) return;
    
    Alert.alert(
      '⛔ Ban User from App',
      `This will ban "${item.userDisplayName}" from the entire app. They won't be able to post, pray, or interact.\n\nAre you sure?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Ban User',
          style: 'destructive',
          onPress: async () => {
            const result = await banUser(item.ownerUid, 'Banned by admin');
            if (result.success) {
              if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
              Alert.alert('User Banned', `${item.userDisplayName} has been banned from the app.`);
            } else {
              Alert.alert('Error', result.error || 'Could not ban user.');
            }
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
    setShowOptionsModal(true);
  };

  // Check if sharing is allowed for this item
  const canShare = isRequest && (item as any).isShareable !== false;

  const handleShare = async () => {
    if (!canShare) {
      Alert.alert('Sharing Disabled', 'The author has disabled sharing for this prayer request.');
      return;
    }

    try {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      const authorName = (item as any).isAnonymous ? 'Someone' : item.userDisplayName;
      const prayerCount = (item as any).prayers ?? 0;
      const contentPreview = item.content.length > 150 
        ? item.content.substring(0, 150) + '...' 
        : item.content;

      const shareMessage = `🙏 Prayer Request from ${authorName}\n\n"${contentPreview}"\n\n${prayerCount} people are praying for this.\n\nJoin us in prayer on Lift! 💛`;

      await Share.share({
        message: shareMessage,
        title: 'Share Prayer Request',
      });
    } catch (error: any) {
      if (error.message !== 'User did not share') {
        Alert.alert('Error', 'Could not share. Please try again.');
      }
    }
  };

  // Build options list for the modal
  const getOptionsMenuItems = () => {
    const options: { text: string; onPress: () => void; destructive?: boolean; icon: string }[] = [];

    // Admin-only: View user profile
    if (isAdmin && !isOwner) {
      options.push({
        text: 'View User Profile',
        icon: 'person-outline',
        onPress: () => {
          setShowOptionsModal(false);
          Alert.alert(
            'User Profile',
            `Display Name: ${item.userDisplayName}\nUser ID: ${item.ownerUid}\nEmail: ${(item as any).userEmail || 'Not available'}`,
            [{ text: 'OK' }]
          );
        },
      });
    }

    // Pin/Unpin option - admin only, requests only
    if (isAdmin && isRequest) {
      options.push({
        text: isPinned ? 'Unpin from Top' : 'Pin to Top',
        icon: 'pin-outline',
        onPress: () => {
          setShowOptionsModal(false);
          onPin?.(item.id, !isPinned);
        },
      });
    }

    // Edit option - for owner or admin
    if (canEdit) {
      options.push({
        text: 'Edit',
        icon: 'create-outline',
        onPress: () => {
          setShowOptionsModal(false);
          onEdit?.(item);
        },
      });
    }

    // Delete option - for owner or admin
    if (canDelete) {
      options.push({
        text: 'Delete',
        icon: 'trash-outline',
        destructive: true,
        onPress: () => {
          setShowOptionsModal(false);
          handleDeleteContent();
        },
      });
    }

    // Follow/Unfollow option - for non-owners only
    if (!isOwner && currentUserId && (onFollow || onUnfollow)) {
      options.push({
        text: isFollowing ? 'Unfollow User' : 'Follow User',
        icon: isFollowing ? 'person-remove-outline' : 'person-add-outline',
        onPress: () => {
          setShowOptionsModal(false);
          handleFollowToggle();
        },
      });
    }

    // Report & Block - for non-owners only
    if (!isOwner && currentUserId) {
      options.push({
        text: 'Report Content',
        icon: 'flag-outline',
        onPress: () => {
          setShowOptionsModal(false);
          setShowReportModal(true);
        },
      });
      options.push({
        text: 'Block This User',
        icon: 'ban-outline',
        destructive: true,
        onPress: () => {
          setShowOptionsModal(false);
          handleBlockUser();
        },
      });
    }

    // Moderator/Admin: Block user from posting
    if (isModerator && !isOwner) {
      options.push({
        text: 'Block from Posting',
        icon: 'hand-left-outline',
        destructive: true,
        onPress: () => {
          setShowOptionsModal(false);
          handleBlockFromPosting();
        },
      });
    }

    // Admin-only: Ban user from app entirely
    if (isAdmin && !isOwner) {
      options.push({
        text: 'Ban User from App',
        icon: 'remove-circle-outline',
        destructive: true,
        onPress: () => {
          setShowOptionsModal(false);
          handleBanUser();
        },
      });
    }

    // Share option - for shareable requests only
    if (canShare) {
      options.unshift({
        text: 'Share Prayer Request',
        icon: 'share-outline',
        onPress: () => {
          setShowOptionsModal(false);
          handleShare();
        },
      });
    }

    return options;
  };

  const handlePrayPress = () => {
    // Prevent double-taps or if disabled or already praying
    if (disabled || isPraying) return;
    
    // Prevent praying on own request
    if (isOwner) return;
    
    // Start praying animation
    setIsPraying(true);
    
    // Haptic feedback (optional - don't crash if unavailable)
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {
        // Haptics not available on this device - ignore silently
      }
    }
    
    // Call the pray handler - ONLY ONCE
    if (onPray && item?.id) {
      onPray(item.id);
    }
  };

  const handleAmenPress = () => {
    // Prevent amening own testimony
    if (isOwner) return;
    
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
  
  // Check if user is verified admin or has email verified
  const verifiedBadge = getVerifiedBadge((item as any).userEmail);
  const isEmailVerified = (item as any).isEmailVerified === true;
  // Use admin badge if exists, otherwise use email verified badge (icon only)
  const badgeStyle = verifiedBadge 
    ? BADGE_STYLES[verifiedBadge.badgeType] 
    : (isEmailVerified ? BADGE_STYLES.emailVerified : null);
  const badgeLabel = verifiedBadge?.badgeLabel || null; // No label for email verified
  const showEmailVerifiedTick = !verifiedBadge && isEmailVerified;
  
  // Privacy info
  const visibility = (item as any).visibility || 'PUBLIC';
  const isPrivate = (item as any).isPrivate || visibility === 'PRIVATE';
  const isGroupOnly = visibility === 'GROUP';
  const showPrivacyBadge = isPrivate || isGroupOnly;
  
  // Anonymous post detection - admin can see real identity
  const isAnonymousPost = (item as any).isAnonymous === true;
  const realDisplayName = (item as any)._realDisplayName;
  const realEmail = (item as any)._realEmail;

  return (
    <Pressable onPress={() => onPress?.(item)} style={isPinned && styles.pinnedCardWrapper}>
      <LiftCard style={[styles.mediumCard, isPinned && styles.cardPinned, isUrgent && styles.cardUrgent]}>
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
                <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{item.userDisplayName}</Text>
                {isAnonymousPost && (
                  <View style={styles.anonymousBadge}>
                    <Ionicons name="eye-off" size={10} color="#6b7280" />
                  </View>
                )}
                {/* Admin/Moderator badge with label */}
                {badgeStyle && badgeLabel && (
                  <View style={[styles.verifiedBadge, { backgroundColor: badgeStyle.backgroundColor }]}>
                    <Ionicons name={badgeStyle.icon as any} size={10} color={badgeStyle.textColor} />
                    <Text style={[styles.verifiedBadgeText, { color: badgeStyle.textColor }]}>
                      {badgeLabel}
                    </Text>
                  </View>
                )}
                {/* Email verified tick - small icon only */}
                {showEmailVerifiedTick && (
                  <Ionicons name="checkmark-circle" size={14} color="#16a34a" style={{ marginLeft: 2 }} />
                )}
              </View>
              {/* Admin-only: Show real identity for anonymous posts */}
              {isAdmin && isAnonymousPost && realDisplayName && (
                <View style={styles.adminRevealRow}>
                  <Ionicons name="shield-checkmark" size={10} color="#7c3aed" />
                  <Text style={styles.adminRevealText}>
                    {realDisplayName}{realEmail ? ` (${realEmail})` : ''}
                  </Text>
                </View>
              )}
              <View style={styles.metaRow}>
                <Text style={[styles.meta, { color: colors.muted }]}>{formatRelativeTime((item as any).createdAt)}</Text>
                {/* Quick follow button - only show for non-owners */}
                {!isOwner && currentUserId && (onFollow || onUnfollow) && (
                  <TouchableOpacity
                    style={[
                      styles.followButton,
                      isFollowing && styles.followButtonActive,
                      followLoading && styles.disabled,
                    ]}
                    onPress={handleFollowToggle}
                    disabled={followLoading}
                  >
                    <Ionicons
                      name={isFollowing ? 'checkmark' : 'add'}
                      size={12}
                      color={isFollowing ? '#16a34a' : '#6b7280'}
                    />
                    <Text style={[styles.followButtonText, isFollowing && styles.followButtonTextActive]}>
                      {followLoading ? '...' : isFollowing ? 'Following' : 'Follow'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
          <View style={styles.headerRight}>
            {showPrivacyBadge && (
              <View style={[styles.privacyBadge, isGroupOnly && styles.privacyBadgeGroup]}>
                <Ionicons 
                  name={isPrivate ? "lock-closed" : "people"} 
                  size={10} 
                  color={isGroupOnly ? "#7c3aed" : "#6b7280"} 
                />
                <Text style={[styles.privacyBadgeText, isGroupOnly && styles.privacyBadgeTextGroup]}>
                  {isPrivate ? 'Private' : 'Group'}
                </Text>
              </View>
            )}
            <View style={[
              styles.statusBadge, 
              displayStatus === 'PENDING' && styles.statusPending,
              displayStatus === 'ACTIVE' && styles.statusActive,
              (displayStatus === 'RESOLVED' || displayStatus === 'ANSWERED') && styles.statusResolved,
            ]}>
              <Text style={[
                styles.statusText,
                displayStatus === 'PENDING' && styles.statusTextPending,
                displayStatus === 'ACTIVE' && styles.statusTextActive,
                (displayStatus === 'RESOLVED' || displayStatus === 'ANSWERED') && styles.statusTextResolved,
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
                  color={isOwner ? colors.accentDark : colors.muted} 
                />
              </TouchableOpacity>
            )}
          </View>
        </View>
        {(item as any).title ? (
          <>
            <Text style={[styles.contentTitle, { color: colors.text }]}>{(item as any).title}</Text>
            <Text style={[styles.contentPreview, { color: colors.text }]} numberOfLines={3}>{item.content}</Text>
          </>
        ) : (
          <Text style={[styles.content, { color: colors.text }]}>{item.content}</Text>
        )}
        
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
              {/* Main Pray Button - disabled for own requests or already prayed */}
              <TouchableOpacity
                onPress={handlePrayPress}
                onLongPress={() => !isOwner && !hasPrayed && setShowReactions(!showReactions)}
                style={[
                  styles.actionButton, 
                  styles.prayButtonWrapper, 
                  (disabled || isOwner || isPraying || hasPrayed) && styles.disabled,
                  isPraying && styles.prayingActive,
                  hasPrayed && styles.prayedButton,
                ]}
                disabled={disabled || isOwner || isPraying || hasPrayed}
                activeOpacity={0.7}
              >
                {isPraying && (
                  <Animated.View 
                    style={[
                      styles.prayingGlow,
                      { opacity: glowAnim }
                    ]} 
                  />
                )}
                <Animated.Text 
                  style={[
                    styles.prayEmoji,
                    isPraying && { transform: [{ scale: pulseAnim }] }
                  ]}
                >
                  {hasPrayed ? '✓' : '🙏'}
                </Animated.Text>
                <Text style={[styles.actionText, isPraying && styles.prayingText, hasPrayed && styles.prayedText]}>
                  {isOwner ? 'Your Request' : isPraying ? 'Praying...' : hasPrayed ? 'Prayed' : 'Pray'}
                </Text>
                <Text style={styles.counter}>{item.prayers ?? 0}</Text>
              </TouchableOpacity>

              {/* Additional Reactions */}
              <View style={styles.extraReactions}>
                {REACTIONS.map((reaction) => {
                  // Get count for this reaction type
                  const countMap: Record<string, number> = {
                    heart: (item as any).heartCount ?? 0,
                    fire: (item as any).fireCount ?? 0,
                    strong: (item as any).strongCount ?? 0,
                  };
                  const count = countMap[reaction.type] ?? 0;
                  
                  return (
                    <TouchableOpacity
                      key={reaction.type}
                      style={[
                        styles.reactionButton,
                        { borderColor: colors.border },
                        activeReaction === reaction.type && [styles.reactionButtonActive, { borderColor: colors.accent }],
                        count > 0 && styles.reactionButtonWithCount,
                      ]}
                      onPress={() => {
                        if (Platform.OS !== 'web') {
                          try {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          } catch {
                            // Haptics not available
                          }
                        }
                        setActiveReaction(activeReaction === reaction.type ? null : reaction.type);
                        onReact?.(item.id, reaction.type);
                      }}
                      disabled={disabled}
                    >
                      <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
                      {count > 0 && <Text style={styles.reactionCount}>{count}</Text>}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ) : (
            <View style={styles.reactionsRow}>
              <Pressable
                onPress={handleAmenPress}
                style={({ pressed }) => [
                  styles.actionButton,
                  styles.amenButton,
                  pressed && !isOwner && styles.amenButtonPressed,
                  (disabled || isOwner) && styles.disabled,
                ]}
                disabled={disabled || isOwner}
              >
                <Text style={styles.amenEmoji}>🙌</Text>
                <Text style={styles.actionText}>{isOwner ? 'Your Testimony' : 'Amen'}</Text>
                <Text style={styles.counter}>{item.likes ?? 0}</Text>
              </Pressable>

              {/* Additional Reactions for Testimonies */}
              <View style={styles.extraReactions}>
                {[{ type: 'heart' as ReactionType, emoji: '❤️' }, { type: 'fire' as ReactionType, emoji: '🔥' }].map((reaction) => {
                  const countMap: Record<string, number> = {
                    heart: (item as any).heartCount ?? 0,
                    fire: (item as any).fireCount ?? 0,
                  };
                  const count = countMap[reaction.type] ?? 0;
                  
                  return (
                    <TouchableOpacity
                      key={reaction.type}
                      style={[
                        styles.reactionButton,
                        { borderColor: colors.border },
                        activeReaction === reaction.type && [styles.reactionButtonActive, { borderColor: colors.accent }],
                        count > 0 && styles.reactionButtonWithCount,
                      ]}
                      onPress={() => {
                        if (Platform.OS !== 'web') {
                          try {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          } catch {
                            // Haptics not available
                          }
                        }
                        setActiveReaction(activeReaction === reaction.type ? null : reaction.type);
                        onReact?.(item.id, reaction.type);
                      }}
                      disabled={disabled}
                    >
                      <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
                      {count > 0 && <Text style={styles.reactionCount}>{count}</Text>}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
          
          {/* Footer info row */}
          <View style={styles.footerInfo}>
            {/* Comment indicator */}
            <View style={styles.commentBadge}>
              <Ionicons name="chatbubble-outline" size={11} color={colors.muted} />
              <Text style={[styles.commentCount, { color: colors.muted }]}>
                {((item as any).commentCount ?? 0) > 0 
                  ? `${(item as any).commentCount} ${(item as any).commentCount === 1 ? 'comment' : 'comments'}`
                  : 'Comment'}
              </Text>
            </View>
            <View style={styles.footerSpacer} />
            {/* Share button - only for shareable requests */}
            {canShare && (
              <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
                <Ionicons name="share-outline" size={14} color={colors.muted} />
                <Text style={[styles.shareButtonText, { color: colors.muted }]}>Share</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </LiftCard>

      {showReportModal ? (
        <Modal
          visible={showReportModal}
          animationType="slide"
          transparent
          onRequestClose={() => setShowReportModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Report Content</Text>
                <TouchableOpacity onPress={() => setShowReportModal(false)}>
                  <Ionicons name="close" size={24} color={colors.muted} />
                </TouchableOpacity>
              </View>
              <Text style={[styles.modalSubtitle, { color: colors.muted }]}>Why are you reporting this?</Text>
              
              {REPORT_REASONS.map((reason) => (
                <TouchableOpacity
                  key={reason.id}
                  style={[
                    styles.reasonOption,
                    selectedReason === reason.id && [styles.reasonOptionSelected, { borderColor: colors.accent }],
                  ]}
                  onPress={() => setSelectedReason(reason.id)}
                >
                  <Text style={styles.reasonEmoji}>{reason.emoji}</Text>
                  <Text style={[
                    styles.reasonLabel,
                    { color: colors.text },
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
      ) : null}

      {showOptionsModal ? (
        <Modal
          visible={showOptionsModal}
          animationType="slide"
          transparent
          onRequestClose={() => setShowOptionsModal(false)}
        >
          <Pressable style={styles.optionsOverlay} onPress={() => setShowOptionsModal(false)}>
            <Pressable style={styles.optionsSheet} onPress={(e) => e.stopPropagation()}>
            {/* Header */}
            <View style={[styles.optionsHeader, { borderBottomColor: colors.border }]}>
              <View style={styles.optionsHandle} />
              <Text style={[styles.optionsTitle, { color: colors.text }]}>
                {isOwner ? 'Manage Your Post' : (isAdmin ? '🛡️ Admin Options' : 'Options')}
              </Text>
              {isAdmin && !isOwner && (
                <Text style={[styles.optionsSubtitle, { color: colors.muted }]}>Viewing: {item.userDisplayName}</Text>
              )}
            </View>

            {/* Options List */}
            <View style={styles.optionsList}>
              {getOptionsMenuItems().map((option, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.optionItem,
                    option.destructive && styles.optionItemDestructive,
                  ]}
                  onPress={option.onPress}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={option.icon as any}
                    size={22}
                    color={option.destructive ? '#ef4444' : colors.text}
                  />
                  <Text
                    style={[
                      styles.optionText,
                      { color: colors.text },
                      option.destructive && styles.optionTextDestructive,
                    ]}
                  >
                    {option.text}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Cancel Button */}
            <TouchableOpacity
              style={styles.optionsCancelButton}
              onPress={() => setShowOptionsModal(false)}
            >
              <Text style={[styles.optionsCancelText, { color: colors.muted }]}>Cancel</Text>
            </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </Pressable>
  );
};

export const FeedCard = memo(FeedCardComponent);

const styles = StyleSheet.create({
  mediumCard: {
    marginVertical: spacing.xs,
  },
  card: {
    borderRadius: radius.lg,
    padding: spacing.md,
    marginVertical: spacing.xs,
    elevation: 0,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  cardUrgent: {
    borderColor: 'rgba(252,165,165,0.5)',
    borderWidth: 1,
  },
  cardPinned: {
    borderColor: 'rgba(245,158,11,0.4)',
    borderWidth: 1,
  },
  pinnedCardWrapper: {
    marginTop: 4,
  },
  pinnedBadge: {
    backgroundColor: '#f59e0b',
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginBottom: spacing.xs,
  },
  pinnedBadgeText: {
    color: '#fff',
    fontSize: fontSizes.xs - 2,
    fontWeight: '700',
    fontFamily: fonts.bodyBold,
    letterSpacing: 0.5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
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
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  avatarImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  avatarText: {
    fontSize: fontSizes.xs - 2,
    fontWeight: '700',
    fontFamily: fonts.bodyBold,
    color: '#fff',
  },
  userTextInfo: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
    fontFamily: fonts.bodyMedium,
    color: '#1c1917',
    flexShrink: 1,
    letterSpacing: -0.2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  verifiedBadgeText: {
    fontSize: fontSizes.xs - 3,
    fontWeight: '700',
    fontFamily: fonts.bodyBold,
    letterSpacing: 0.2,
  },
  meta: {
    fontSize: fontSizes.xs - 1,
    fontFamily: fonts.body,
    marginTop: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 1,
  },
  followButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  followButtonActive: {
    backgroundColor: 'rgba(22,163,74,0.1)',
    borderColor: 'rgba(22,163,74,0.3)',
  },
  followButtonText: {
    fontSize: fontSizes.xs - 2,
    fontFamily: fonts.bodyMedium,
    color: '#6b7280',
    fontWeight: '500',
  },
  followButtonTextActive: {
    color: '#16a34a',
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    alignItems: 'center',
    flexShrink: 0,
  },
  statusPending: {
    backgroundColor: '#fef2f2',
    // Removed border for subtlety
  },
  statusActive: {
    backgroundColor: '#fffbeb', // Lighter amber
    // Removed border
  },
  statusResolved: {
    backgroundColor: '#f0fdf4', // Lighter green
    // Removed border
  },
  statusText: {
    fontSize: fontSizes.xs - 3,
    fontWeight: '600',
    fontFamily: fonts.bodyMedium,
    letterSpacing: 0.3,
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
    fontFamily: fonts.heading,
    fontSize: fontSizes.md,
    lineHeight: 22,
    color: '#1c1917',
    marginBottom: spacing.md,
    letterSpacing: 0.1,
  },
  contentTitle: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.md,
    lineHeight: 22,
    color: '#1c1917',
    marginBottom: 4,
    fontWeight: '700',
  },
  contentPreview: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    lineHeight: 20,
    color: '#1c1917',
    marginBottom: spacing.md,
    opacity: 0.88,
  },
  footer: {
    gap: spacing.sm,
  },
  footerInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  commentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  commentCount: {
    fontSize: fontSizes.xs - 2,
    fontFamily: fonts.body,
    fontWeight: '500',
  },
  prayButtonWrapper: {
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
    backgroundColor: '#1c1917',
    minHeight: 36,
  },
  amenButton: {
    backgroundColor: '#facc15',
  },
  amenButtonPressed: {
    backgroundColor: '#d97706',
  },
  prayEmoji: {
    fontSize: 16,
  },
  prayingActive: {
    backgroundColor: '#fde68a',
    borderWidth: 2,
    borderColor: '#f59e0b',
  },
  prayingGlow: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: radius.md + 4,
    backgroundColor: '#fde68a',
  },
  prayingText: {
    color: '#92400e',
    fontWeight: '800',
  },
  prayedButton: {
    backgroundColor: '#10b981',
    opacity: 1,
  },
  prayedText: {
    color: '#fff',
    fontWeight: '600',
  },
  amenEmoji: {
    fontSize: 12,
  },
  actionText: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
    fontFamily: fonts.bodyMedium,
    color: '#fffbeb',
    letterSpacing: 0.2,
  },
  counter: {
    fontSize: fontSizes.xs,
    fontWeight: '500',
    fontFamily: fonts.body,
    color: 'rgba(255,251,235,0.6)',
    marginLeft: 2,
  },
  footerSpacer: {
    flex: 1,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  shareButtonText: {
    fontSize: fontSizes.xs - 1,
    fontFamily: fonts.body,
    fontWeight: '500',
  },
  disabled: {
    opacity: 0.5,
  },
  urgentBadge: {
    position: 'absolute',
    top: -6,
    right: 10,
    backgroundColor: '#ef4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    zIndex: 10,
  },
  urgentBadgeText: {
    color: '#fff',
    fontSize: fontSizes.xs - 2,
    fontWeight: '700',
    fontFamily: fonts.bodyBold,
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
    fontSize: fontSizes.xs - 2,
    fontWeight: '700',
    fontFamily: fonts.bodyBold,
    color: '#166534',
  },
  reactionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  extraReactions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reactionButton: {
    flexDirection: 'row',
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    paddingHorizontal: 4,
  },
  reactionButtonActive: {
    backgroundColor: '#fef3c7',
  },
  reactionButtonWithCount: {
    paddingHorizontal: 6,
    minWidth: 36,
  },
  reactionEmoji: {
    fontSize: 11,
  },
  reactionCount: {
    fontSize: fontSizes.xs - 2,
    fontWeight: '600',
    fontFamily: fonts.bodyMedium,
    color: '#6b7280',
    marginLeft: 2,
  },
  // Report Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  modalTitle: {
    fontSize: fontSizes.md,
    fontWeight: '600',
    fontFamily: fonts.bodyMedium,
  },
  modalSubtitle: {
    fontSize: fontSizes.xs,
    fontFamily: fonts.body,
    marginBottom: spacing.md,
  },
  reasonOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    marginBottom: spacing.xs,
    backgroundColor: '#f8fafc',
    gap: spacing.sm,
  },
  reasonOptionSelected: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
  },
  reasonEmoji: {
    fontSize: 16,
  },
  reasonLabel: {
    flex: 1,
    fontSize: fontSizes.sm - 1,
    fontWeight: '500',
    fontFamily: fonts.body,
  },
  reasonLabelSelected: {
    color: '#92400e',
  },
  reportButton: {
    backgroundColor: '#ef4444',
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  reportButtonDisabled: {
    backgroundColor: '#fca5a5',
  },
  reportButtonText: {
    fontSize: fontSizes.sm - 1,
    fontWeight: '600',
    fontFamily: fonts.bodyMedium,
    color: '#fff',
  },
  // Privacy badge styles
  privacyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: spacing.xs,
  },
  privacyBadgeGroup: {
    backgroundColor: '#ede9fe',
  },
  privacyBadgeText: {
    fontSize: fontSizes.xs - 2,
    fontWeight: '600',
    fontFamily: fonts.bodyMedium,
    color: '#6b7280',
  },
  privacyBadgeTextGroup: {
    color: '#7c3aed',
  },
  // Anonymous post styles
  anonymousBadge: {
    backgroundColor: '#f1f5f9',
    padding: 3,
    borderRadius: 6,
    marginLeft: 4,
  },
  adminRevealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ede9fe',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 2,
    alignSelf: 'flex-start',
  },
  adminRevealText: {
    fontSize: fontSizes.xs - 2,
    fontWeight: '600',
    fontFamily: fonts.bodyMedium,
    color: '#7c3aed',
  },
  // Options ActionSheet Modal styles
  optionsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  optionsSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 28, // Safe area padding
  },
  optionsHeader: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  optionsHandle: {
    width: 32,
    height: 3,
    backgroundColor: '#d1d5db',
    borderRadius: 2,
    marginBottom: spacing.xs,
  },
  optionsTitle: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
    fontFamily: fonts.bodyMedium,
  },
  optionsSubtitle: {
    fontSize: fontSizes.xs - 1,
    fontFamily: fonts.body,
    marginTop: 2,
  },
  optionsList: {
    paddingVertical: spacing.xs,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  optionItemDestructive: {
    backgroundColor: '#fef2f2',
  },
  optionText: {
    fontSize: fontSizes.sm - 1,
    fontWeight: '500',
    fontFamily: fonts.body,
  },
  optionTextDestructive: {
    color: '#ef4444',
  },
  optionsCancelButton: {
    marginHorizontal: spacing.sm,
    marginTop: spacing.xs,
    paddingVertical: spacing.sm,
    backgroundColor: '#f1f5f9',
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  optionsCancelText: {
    fontSize: fontSizes.sm - 1,
    fontWeight: '600',
    fontFamily: fonts.bodyMedium,
  },
});
