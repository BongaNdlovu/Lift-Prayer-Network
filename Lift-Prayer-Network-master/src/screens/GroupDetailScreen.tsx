import React, { useEffect, useState, useCallback } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Share,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import * as ImagePicker from 'expo-image-picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../hooks/useAuth';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { getGroup, getGroupMembers, updateGroup, leaveGroup, deleteGroup, getInviteCode, uploadGroupPhoto, deleteGroupPhoto, approveJoinRequest, rejectJoinRequest, removeMemberFromGroup, blockUserFromGroupPosting, isUserBlockedFromGroupPosting, type GroupMember } from '../services/groups';
import { subscribeToGroupRequests, submitGroupRequest, logPrayer, logReaction, likeTestimony } from '../services/prayers';
import type { ReactionType } from '../services/prayers';
import { useTheme } from '../contexts/ThemeContext';
import { fonts, fontSizes, palette, radius, spacing } from '../theme/colors';
import { FeedCard } from '../components/FeedCard';
import { hasAdminPermission, getVerifiedBadge, BADGE_STYLES } from '../config/admins';
import type { PrayerGroup, FeedItem, LiftRequest } from '../types';
import type { RootStackParamList } from '../navigation/types';
import { CinematicBackground, RoundedPage } from '../components/CinematicBackground';
import { GlassIconButton } from '../components/GlassCard';

type Props = NativeStackScreenProps<RootStackParamList, 'GroupDetail'>;

const GROUP_FEED_ITEM_HEIGHT = 260;
const GROUP_MEMBER_ITEM_HEIGHT = 72;
const GROUP_PENDING_ITEM_HEIGHT = 72;

export const GroupDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { groupId, groupName, groupEmoji } = route.params;
  const { user } = useAuth();
  const { colors } = useTheme();
  const [group, setGroup] = useState<PrayerGroup | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [prayers, setPrayers] = useState<LiftRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPostModal, setShowPostModal] = useState(false);
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [pendingUsers, setPendingUsers] = useState<GroupMember[]>([]);
  const [processingRequest, setProcessingRequest] = useState<string | null>(null);
  
  // Edit group state
  const [editName, setEditName] = useState(groupName);
  const [editDesc, setEditDesc] = useState('');
  const [editPhotoURL, setEditPhotoURL] = useState<string | null>(null);
  const [editIsPrivate, setEditIsPrivate] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photoNeedsUpload, setPhotoNeedsUpload] = useState(false);
  
  // Post prayer state
  const [newPrayerContent, setNewPrayerContent] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [posting, setPosting] = useState(false);
  const [busyPrayIds, setBusyPrayIds] = useState<Set<string>>(new Set());

  const isAdmin = hasAdminPermission(user?.email);
  const isOwner = group?.ownerUid === user?.uid;
  const canManageGroup = isAdmin || isOwner;

  // Load group details
  useEffect(() => {
    const loadGroup = async () => {
      const groupData = await getGroup(groupId);
      if (groupData) {
        setGroup(groupData);
        setEditName(groupData.name);
        setEditDesc(groupData.description || '');
        setEditPhotoURL(groupData.photoURL || null);
        setEditIsPrivate(groupData.isPrivate);
        setPhotoNeedsUpload(false);
      }
    };
    loadGroup();
  }, [groupId]);

  // Load members
  useEffect(() => {
    const loadMembers = async () => {
      const membersList = await getGroupMembers(groupId);
      setMembers(membersList);
    };
    loadMembers();
  }, [groupId]);

  // Subscribe to group prayers
  useEffect(() => {
    const unsub = subscribeToGroupRequests(groupId, (data) => {
      setPrayers(data);
      setLoading(false);
    });
    return () => unsub();
  }, [groupId]);

  const onRefresh = useCallback(async () => {
    // Haptic feedback on pull-to-refresh
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {
        // Haptics not available
      }
    }
    
    setRefreshing(true);
    const groupData = await getGroup(groupId);
    if (groupData) {
      setGroup(groupData);
    }
    const membersList = await getGroupMembers(groupId);
    setMembers(membersList);
    setRefreshing(false);
  }, [groupId]);

  // Load pending request users when modal opens
  const loadPendingUsers = useCallback(async () => {
    if (!group?.pendingRequests?.length) {
      setPendingUsers([]);
      return;
    }
    
    // Fetch user profiles for pending requests
    const users: GroupMember[] = [];
    for (const uid of group.pendingRequests) {
      try {
        if (db) {
          const userDoc = await getDoc(doc(db, 'users', uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            users.push({
              uid,
              displayName: userData.displayName || 'Anonymous',
              email: userData.email,
              photoURL: userData.photoURL,
            });
          } else {
            users.push({ uid, displayName: 'Unknown User' });
          }
        }
      } catch {
        users.push({ uid, displayName: 'Unknown User' });
      }
    }
    setPendingUsers(users);
  }, [group?.pendingRequests]);

  // Handle approve join request
  const handleApproveRequest = async (userId: string) => {
    if (!user) return;
    
    setProcessingRequest(userId);
    try {
      const success = await approveJoinRequest(groupId, userId, user.uid);
      if (success) {
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        // Remove from pending list
        setPendingUsers(prev => prev.filter(u => u.uid !== userId));
        // Update group state
        setGroup(prev => prev ? {
          ...prev,
          pendingRequests: prev.pendingRequests?.filter(id => id !== userId),
          memberUids: [...prev.memberUids, userId],
        } : null);
        // Refresh members list
        const membersList = await getGroupMembers(groupId);
        setMembers(membersList);
      } else {
        Alert.alert('Error', 'Could not approve request');
      }
    } catch {
      Alert.alert('Error', 'Could not approve request');
    } finally {
      setProcessingRequest(null);
    }
  };

  // Handle reject join request
  const handleRejectRequest = async (userId: string) => {
    if (!user) return;
    
    setProcessingRequest(userId);
    try {
      const success = await rejectJoinRequest(groupId, userId, user.uid);
      if (success) {
        if (Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
        // Remove from pending list
        setPendingUsers(prev => prev.filter(u => u.uid !== userId));
        // Update group state
        setGroup(prev => prev ? {
          ...prev,
          pendingRequests: prev.pendingRequests?.filter(id => id !== userId),
        } : null);
      } else {
        Alert.alert('Error', 'Could not reject request');
      }
    } catch {
      Alert.alert('Error', 'Could not reject request');
    } finally {
      setProcessingRequest(null);
    }
  };

  const handleShareInvite = async () => {
    const code = getInviteCode(groupId);
    try {
      await Share.share({
        message: `Join my prayer group "${groupName}" on Lift!\n\nInvite code: ${code}`,
      });
    } catch (error) {
      console.error('Error sharing invite:', error);
    }
  };

  const pickGroupImage = async () => {
    try {
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow access to your photos to change the group image.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        if (asset.uri) {
          setEditPhotoURL(asset.uri);
          setPhotoNeedsUpload(true);
        }
        
        if (Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Could not select image. Please try again.');
    }
  };

  const removeGroupImage = () => {
    setEditPhotoURL(null);
    setPhotoNeedsUpload(false);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleEditGroup = async () => {
    if (!editName.trim()) {
      Alert.alert('Error', 'Group name is required');
      return;
    }

    setSaving(true);
    try {
      let finalPhotoURL = editPhotoURL;

      if (photoNeedsUpload && editPhotoURL && !editPhotoURL.startsWith('http')) {
        finalPhotoURL = await uploadGroupPhoto(groupId, editPhotoURL, user!.uid);
      }

      if (!editPhotoURL && group?.photoURL && group.photoURL.startsWith('http')) {
        await deleteGroupPhoto(groupId, user!.uid);
      }

      await updateGroup(groupId, {
        name: editName.trim(),
        description: editDesc.trim(),
        photoURL: finalPhotoURL,
        isPrivate: editIsPrivate,
      });
      
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      
      setShowEditModal(false);
      setGroup(prev => prev ? { ...prev, name: editName.trim(), description: editDesc.trim(), photoURL: finalPhotoURL, isPrivate: editIsPrivate } : null);
      setPhotoNeedsUpload(false);
      Alert.alert('Success', 'Group updated!');
    } catch (error) {
      console.error('Error editing group:', error);
      Alert.alert('Error', 'Could not update group');
    } finally {
      setSaving(false);
    }
  };

  const handleLeaveGroup = () => {
    if (!user) return;

    const message = isOwner
      ? 'As the owner, leaving will delete this group for everyone. Are you sure?'
      : `Are you sure you want to leave "${groupName}"?`;

    Alert.alert(
      isOwner ? 'Delete Group' : 'Leave Group',
      message,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isOwner ? 'Delete' : 'Leave',
          style: 'destructive',
          onPress: async () => {
            if (isOwner) {
              await deleteGroup(groupId, user.uid);
            } else {
              await leaveGroup(groupId, user.uid);
            }
            navigation.goBack();
          },
        },
      ]
    );
  };

  const handlePostPrayer = async () => {
    if (!user || !newPrayerContent.trim()) return;

    if (newPrayerContent.trim().length < 10) {
      Alert.alert('Too Short', 'Please provide more details about your prayer request.');
      return;
    }

    // Check if user is blocked from posting in this group
    const isBlocked = await isUserBlockedFromGroupPosting(groupId, user.uid);
    if (isBlocked) {
      Alert.alert(
        'Posting Restricted',
        'You have been blocked from posting in this group by the group owner.',
      );
      return;
    }

    setPosting(true);
    try {
      await submitGroupRequest(
        groupId,
        newPrayerContent.trim(),
        user.uid,
        user.displayName || 'Anonymous',
        user.email || undefined,
        isUrgent
      );

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      setShowPostModal(false);
      setNewPrayerContent('');
      setIsUrgent(false);
      Alert.alert('Posted!', 'Your prayer request has been shared with the group. 🙏');
    } catch (error) {
      console.error('Error posting prayer:', error);
      Alert.alert('Error', 'Could not post prayer request');
    } finally {
      setPosting(false);
    }
  };

  const handlePrayerPress = (item: FeedItem) => {
    navigation.navigate('RequestDetail', {
      id: item.id,
      type: item.type,
      item,
    });
  };

  const handlePray = async (requestId: string) => {
    if (!user) {
      Alert.alert('Sign in required', 'Please sign in to pray for requests.');
      return;
    }

    const target = prayers.find((p) => p.id === requestId);
    if (!target) return;

    setBusyPrayIds((prev) => new Set(prev).add(requestId));
    try {
      const result = await logPrayer(
        user.uid,
        requestId,
        target.ownerUid || 'anonymous',
        target.content?.slice(0, 120) || '',
        user.displayName || undefined
      );

      if (result.success) {
        if (Platform.OS !== 'web') {
          try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          } catch (error) {
            console.error('Error playing haptic feedback:', error);
          }
        }
        
        // If self-prayer, send a local notification
        if (result.isSelfPrayer && Platform.OS !== 'web') {
          try {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: '🙏 Prayer Recorded',
                body: 'Your prayer for your own request has been recorded. Keep praying!',
                sound: true,
              },
              trigger: null,
            });
          } catch (e) {
            console.warn('[GroupDetail] Could not send notification:', e);
          }
        }
      } else {
        if (result.alreadyPrayed) {
          Alert.alert('Already Prayed', 'You have already prayed for this request. Thank you for your prayer! 🙏');
        } else {
          Alert.alert('Unable to pray', result.error || 'Please try again.');
        }
      }
    } catch (err: any) {
      console.error('[GroupDetail] Prayer error:', err);
      Alert.alert('Unable to pray', err.message ?? 'Please try again.');
    } finally {
      setBusyPrayIds((prev) => {
        const next = new Set(prev);
        next.delete(requestId);
        return next;
      });
    }
  };

  // Handler for amen/like button (testimonies - if any in groups)
  const handleLike = async (id: string) => {
    if (!user) return;
    setBusyPrayIds((prev) => new Set(prev).add(id));
    try {
      await likeTestimony(user.uid, id);
      if (Platform.OS !== 'web') {
        try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
      }
    } catch (err) {
      console.error('[GroupDetail] Like error:', err);
    } finally {
      setBusyPrayIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }
  };

  // Handler for reactions
  const handleReact = async (id: string, reactionType: ReactionType) => {
    if (!user) return;
    const target = prayers.find((p) => p.id === id);
    if (!target) return;
    try {
      await logReaction(user.uid, id, 'REQUEST', reactionType);
    } catch (err) {
      console.error('[GroupDetail] Reaction error:', err);
    }
  };

  const renderPrayer = ({ item }: { item: LiftRequest }) => {
    const feedItem: FeedItem = { ...item, type: 'REQUEST' };
    return (
      <FeedCard
        item={feedItem}
        onPress={handlePrayerPress}
        onPray={handlePray}
        onLike={handleLike}
        onReact={handleReact}
        disabled={busyPrayIds.has(item.id)}
        currentUserId={user?.uid}
        currentUserEmail={user?.email}
      />
    );
  };

  const handleRemoveMember = (member: GroupMember) => {
    if (!user || !group) return;
    
    Alert.alert(
      'Remove Member',
      `Remove "${member.displayName}" from this group?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const result = await removeMemberFromGroup(group.id, member.uid, user.uid);
            if (result.success) {
              if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Removed', `${member.displayName} has been removed from the group.`);
              // Refresh members
              const updatedMembers = await getGroupMembers(group.id);
              setMembers(updatedMembers);
            } else {
              Alert.alert('Error', result.error || 'Could not remove member.');
            }
          },
        },
      ]
    );
  };

  const handleBlockMemberFromPosting = (member: GroupMember) => {
    if (!user || !group) return;
    
    Alert.alert(
      'Block from Posting',
      `Block "${member.displayName}" from posting in this group? They can still view content.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            const result = await blockUserFromGroupPosting(group.id, member.uid, user.uid);
            if (result.success) {
              if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Blocked', `${member.displayName} can no longer post in this group.`);
            } else {
              Alert.alert('Error', result.error || 'Could not block member.');
            }
          },
        },
      ]
    );
  };

  const renderMember = ({ item }: { item: GroupMember }) => {
    const isGroupOwner = item.uid === group?.ownerUid;
    const isSelf = item.uid === user?.uid;
    const verifiedBadge = getVerifiedBadge(item.email, item.uid);
    const badgeStyle = verifiedBadge ? BADGE_STYLES[verifiedBadge.badgeType] : null;
    const hasProfilePicture = item.photoURL && item.photoURL.trim() !== '';
    const showAdminActions = isOwner && !isGroupOwner && !isSelf;

    return (
      <View style={[styles.memberItem, { backgroundColor: colors.surface }]}>
        {/* Profile Picture or Avatar */}
        {hasProfilePicture ? (
          <Image 
            source={{ uri: item.photoURL! }} 
            style={styles.memberProfileImage}
          />
        ) : (
          <View style={[styles.memberAvatar, { backgroundColor: getAvatarColor(item.displayName) }]}>
            <Text style={styles.memberAvatarText}>
              {item.displayName?.[0]?.toUpperCase() || '?'}
            </Text>
          </View>
        )}
        
        <View style={styles.memberInfo}>
          <View style={styles.memberNameRow}>
            <Text style={[styles.memberName, { color: colors.text }]}>{item.displayName || 'Unknown'}</Text>
            
            {/* Verified Badge (App Creator, Admin, etc.) */}
            {verifiedBadge && badgeStyle && (
              <View style={[styles.memberBadge, { backgroundColor: badgeStyle.backgroundColor }]}>
                <Ionicons 
                  name={badgeStyle.icon as any} 
                  size={10} 
                  color={badgeStyle.textColor} 
                />
                <Text style={[styles.memberBadgeText, { color: badgeStyle.textColor }]}>
                  {verifiedBadge.badgeLabel}
                </Text>
              </View>
            )}
          </View>
          
          {/* Group Role */}
          <View style={styles.memberRoleRow}>
            {isGroupOwner && (
              <View style={styles.ownerBadge}>
                <Ionicons name="star" size={10} color="#f59e0b" />
                <Text style={styles.ownerBadgeText}>Group Owner</Text>
              </View>
            )}
            {item.email && (
              <Text style={[styles.memberEmail, { color: colors.muted }]} numberOfLines={1}>
                {item.email}
              </Text>
            )}
          </View>

          {/* Admin Actions for Group Owner */}
          {showAdminActions && (
            <View style={styles.memberActions}>
              <TouchableOpacity 
                style={[styles.memberActionBtn, { backgroundColor: colors.dangerLight }]}
                onPress={() => handleBlockMemberFromPosting(item)}
              >
                <Ionicons name="hand-left-outline" size={14} color={colors.danger} />
                <Text style={[styles.memberActionText, { color: colors.danger }]}>Block Posting</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.memberActionBtn, { backgroundColor: colors.dangerLight }]}
                onPress={() => handleRemoveMember(item)}
              >
                <Ionicons name="person-remove-outline" size={14} color={colors.danger} />
                <Text style={[styles.memberActionText, { color: colors.danger }]}>Remove</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  const getAvatarColor = (name: string): string => {
    const colors = ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444'];
    let hash = 0;
    for (let i = 0; i < (name || '').length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const ListHeader = () => (
    <View style={styles.headerContainer}>
      {/* Group Info Card */}
      <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.infoHeader}>
          {group?.photoURL ? (
            <Image source={{ uri: group.photoURL }} style={styles.groupIconImage} />
          ) : (
            <View style={[styles.groupIcon, { backgroundColor: colors.accentLight }]}>
              <Text style={styles.groupIconText}>{groupEmoji || group?.emoji || '🙏'}</Text>
            </View>
          )}
          <View style={styles.groupTitleContainer}>
            <Text style={[styles.groupTitle, { color: colors.text }]}>{group?.name || groupName}</Text>
            <Text style={[styles.memberCount, { color: colors.muted }]}>
              {members.length} member{members.length !== 1 ? 's' : ''}
            </Text>
          </View>
          {canManageGroup && (
            <TouchableOpacity style={[styles.editIconButton, { backgroundColor: colors.accentLight }]} onPress={() => setShowEditModal(true)}>
              <Ionicons name="pencil" size={18} color={colors.accent} />
            </TouchableOpacity>
          )}
        </View>
        
        {group?.description && (
          <Text style={[styles.groupDescription, { color: colors.muted }]}>{group.description}</Text>
        )}

        {/* Pending Requests Banner (for owners of private groups) */}
        {isOwner && group?.isPrivate && (group?.pendingRequests?.length ?? 0) > 0 && (
          <TouchableOpacity 
            style={styles.pendingBanner}
            onPress={() => {
              loadPendingUsers();
              setShowPendingModal(true);
            }}
          >
            <View style={styles.pendingBannerContent}>
              <Ionicons name="person-add" size={20} color="#f59e0b" />
              <Text style={styles.pendingBannerText}>
                {group.pendingRequests!.length} pending join request{group.pendingRequests!.length !== 1 ? 's' : ''}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#f59e0b" />
          </TouchableOpacity>
        )}

        {/* Action Buttons */}
        <View style={[styles.actionRow, { borderTopColor: colors.border }]}>
          <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.accentLight }]} onPress={() => setShowMembersModal(true)}>
            <Ionicons name="people" size={18} color={colors.accent} />
            <Text style={[styles.actionButtonText, { color: colors.accent }]}>Members</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.accentLight }]} onPress={handleShareInvite}>
            <Ionicons name="share-outline" size={18} color={colors.accent} />
            <Text style={[styles.actionButtonText, { color: colors.accent }]}>Invite</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, styles.leaveButton, { backgroundColor: colors.dangerLight }]} 
            onPress={handleLeaveGroup}
          >
            <Ionicons name="exit-outline" size={18} color={colors.danger} />
            <Text style={[styles.leaveButtonText, { color: colors.danger }]}>{isOwner ? 'Delete' : 'Leave'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Post Prayer Button */}
      <TouchableOpacity style={[styles.postButton, { backgroundColor: colors.accent }]} onPress={() => setShowPostModal(true)}>
        <Ionicons name="add-circle" size={24} color="#fff" />
        <Text style={styles.postButtonText}>Share Prayer Request</Text>
      </TouchableOpacity>

      {/* Section Header */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Group Prayers</Text>
        <Text style={[styles.sectionCount, { color: colors.muted }]}>{prayers.length} request{prayers.length !== 1 ? 's' : ''}</Text>
      </View>
    </View>
  );

  const ListEmpty = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyEmoji}>🙏</Text>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>No prayers yet</Text>
      <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
        Be the first to share a prayer request with this group
      </Text>
    </View>
  );

  if (loading) {
    return (
      <CinematicBackground useOuterBackground>
        <SafeAreaView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </SafeAreaView>
      </CinematicBackground>
    );
  }

  return (
    <CinematicBackground useOuterBackground>
      <SafeAreaView style={styles.container}>
        {/* === HEADER SECTION === */}
        <View style={styles.headerSection}>
          <GlassIconButton onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color={colors.stone700} />
          </GlassIconButton>
          <View style={styles.headerCenter}>
            <Text style={[styles.kicker, { color: colors.stone500 }]}>COMMUNITY</Text>
            <Text style={styles.headingTitle} numberOfLines={1}>
              {group?.name || groupName}<Text style={styles.headingDot}>.</Text>
            </Text>
          </View>
          <View style={{ width: 44 }} />
        </View>

        {/* === MAIN CONTENT === */}
        <RoundedPage style={styles.mainContent}>

      <FlatList
        data={prayers}
        keyExtractor={(item) => item.id}
        renderItem={renderPrayer}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        initialNumToRender={10}
        windowSize={5}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        removeClippedSubviews={Platform.OS !== 'web'}
        getItemLayout={(_, index) => ({
          length: GROUP_FEED_ITEM_HEIGHT,
          offset: GROUP_FEED_ITEM_HEIGHT * index,
          index,
        })}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />

      {/* Members Modal */}
      <Modal
        visible={showMembersModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowMembersModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Group Members</Text>
              <TouchableOpacity onPress={() => setShowMembersModal(false)}>
                <Ionicons name="close" size={24} color={colors.muted} />
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={members}
              keyExtractor={(item) => item.uid}
              renderItem={renderMember}
              contentContainerStyle={styles.membersList}
              showsVerticalScrollIndicator={false}
              initialNumToRender={10}
              windowSize={5}
              maxToRenderPerBatch={10}
              updateCellsBatchingPeriod={50}
              removeClippedSubviews={Platform.OS !== 'web'}
              getItemLayout={(_, index) => ({
                length: GROUP_MEMBER_ITEM_HEIGHT,
                offset: GROUP_MEMBER_ITEM_HEIGHT * index,
                index,
              })}
            />
          </View>
        </View>
      </Modal>

      {/* Edit Group Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Edit Group</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Ionicons name="close" size={24} color={colors.muted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Group Photo Picker */}
              <Text style={[styles.inputLabel, { color: colors.muted }]}>Group Photo</Text>
              <View style={styles.photoPickerContainer}>
                {editPhotoURL ? (
                  <Image source={{ uri: editPhotoURL }} style={styles.photoPreview} />
                ) : (
                  <View style={[styles.photoPlaceholder, { borderColor: colors.border }]}>
                    <Ionicons name="camera" size={32} color={colors.muted} />
                  </View>
                )}
                <View style={styles.photoButtons}>
                  <TouchableOpacity style={[styles.photoButton, { backgroundColor: colors.accentLight }]} onPress={pickGroupImage}>
                    <Ionicons name="image-outline" size={18} color={colors.accent} />
                    <Text style={[styles.photoButtonText, { color: colors.accent }]}>
                      {editPhotoURL ? 'Change Photo' : 'Add Photo'}
                    </Text>
                  </TouchableOpacity>
                  {editPhotoURL && (
                    <TouchableOpacity style={styles.photoButtonRemove} onPress={removeGroupImage}>
                      <Ionicons name="trash-outline" size={18} color="#dc2626" />
                      <Text style={styles.photoButtonRemoveText}>Remove</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <Text style={[styles.inputLabel, { color: colors.muted }]}>Group Name</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                placeholder="Group name"
                placeholderTextColor={colors.muted}
                value={editName}
                onChangeText={setEditName}
                maxLength={50}
              />

              <Text style={[styles.inputLabel, { color: colors.muted }]}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                placeholder="What is this group for?"
                placeholderTextColor={colors.muted}
                value={editDesc}
                onChangeText={setEditDesc}
                multiline
                maxLength={200}
              />

              {/* Privacy Info - Public groups disabled for now */}
              <View style={[styles.privacyInfoBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                <Ionicons name="lock-closed" size={20} color={colors.accent} />
                <View style={{ flex: 1, marginLeft: spacing.sm }}>
                  <Text style={[styles.privacyInfoTitle, { color: colors.text }]}>Private Group</Text>
                  <Text style={[styles.privacyInfoDesc, { color: colors.muted }]}>
                    Members join via invite code or owner approval
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.saveButton, !editName.trim() && styles.buttonDisabled]}
                onPress={handleEditGroup}
                disabled={!editName.trim() || saving}
              >
                <Text style={styles.saveButtonText}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Post Prayer Modal */}
      <Modal
        visible={showPostModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowPostModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Share Prayer Request</Text>
              <TouchableOpacity onPress={() => setShowPostModal(false)}>
                <Ionicons name="close" size={24} color={palette.muted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>What do you need prayer for?</Text>
            <TextInput
              style={[styles.input, styles.textArea, { minHeight: 120 }]}
              placeholder="Share your prayer request with the group..."
              placeholderTextColor={palette.muted}
              value={newPrayerContent}
              onChangeText={setNewPrayerContent}
              multiline
              maxLength={1000}
            />
            <Text style={styles.charCount}>{newPrayerContent.length}/1000</Text>

            <TouchableOpacity
              style={styles.urgentToggle}
              onPress={() => setIsUrgent(!isUrgent)}
            >
              <View style={[styles.checkbox, isUrgent && styles.checkboxChecked]}>
                {isUrgent && <Ionicons name="checkmark" size={14} color="#fff" />}
              </View>
              <Text style={styles.urgentToggleText}>🚨 Mark as Urgent</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.postSubmitButton, (!newPrayerContent.trim() || posting) && styles.buttonDisabled]}
              onPress={handlePostPrayer}
              disabled={!newPrayerContent.trim() || posting}
            >
              <Text style={styles.postSubmitButtonText}>
                {posting ? 'Posting...' : 'Post Prayer Request'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Pending Requests Modal */}
      <Modal
        visible={showPendingModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowPendingModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Pending Requests</Text>
              <TouchableOpacity onPress={() => setShowPendingModal(false)}>
                <Ionicons name="close" size={24} color={palette.muted} />
              </TouchableOpacity>
            </View>
            
            {pendingUsers.length === 0 ? (
              <View style={styles.emptyPending}>
                <Ionicons name="checkmark-circle" size={48} color={palette.muted} />
                <Text style={styles.emptyPendingText}>No pending requests</Text>
              </View>
            ) : (
              <FlatList
                data={pendingUsers}
                keyExtractor={(item) => item.uid}
                initialNumToRender={8}
                windowSize={5}
                maxToRenderPerBatch={8}
                updateCellsBatchingPeriod={50}
                removeClippedSubviews={Platform.OS !== 'web'}
                getItemLayout={(_, index) => ({
                  length: GROUP_PENDING_ITEM_HEIGHT,
                  offset: GROUP_PENDING_ITEM_HEIGHT * index,
                  index,
                })}
                renderItem={({ item }) => (
                  <View style={styles.pendingItem}>
                    <View style={styles.pendingUserInfo}>
                      {item.photoURL ? (
                        <Image source={{ uri: item.photoURL }} style={styles.pendingAvatar} />
                      ) : (
                        <View style={[styles.pendingAvatarPlaceholder, { backgroundColor: getAvatarColor(item.displayName) }]}>
                          <Text style={styles.pendingAvatarText}>
                            {(item.displayName || '?')[0].toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <View style={styles.pendingUserDetails}>
                        <Text style={styles.pendingUserName}>{item.displayName}</Text>
                        {item.email && (
                          <Text style={styles.pendingUserEmail} numberOfLines={1}>{item.email}</Text>
                        )}
                      </View>
                    </View>
                    <View style={styles.pendingActions}>
                      <TouchableOpacity
                        style={styles.rejectButton}
                        onPress={() => handleRejectRequest(item.uid)}
                        disabled={processingRequest === item.uid}
                      >
                        {processingRequest === item.uid ? (
                          <ActivityIndicator size="small" color="#dc2626" />
                        ) : (
                          <Ionicons name="close" size={20} color="#dc2626" />
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.approveButton}
                        onPress={() => handleApproveRequest(item.uid)}
                        disabled={processingRequest === item.uid}
                      >
                        {processingRequest === item.uid ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Ionicons name="checkmark" size={20} color="#fff" />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
                contentContainerStyle={styles.pendingList}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        </View>
        </Modal>
        </RoundedPage>
      </SafeAreaView>
    </CinematicBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Header styles
  headerSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    zIndex: 20,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  kicker: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
    opacity: 0.8,
  },
  headingTitle: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontSize: 28,
    fontWeight: '500',
    letterSpacing: -0.5,
    lineHeight: 32,
    color: '#1c1917',
    textAlign: 'center',
  },
  headingDot: {
    color: '#f59e0b',
  },
  mainContent: {
    flex: 1,
    zIndex: 10,
  },
  
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    backgroundColor: '#fff',
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: palette.text,
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 32,
  },
  listContent: {
    padding: spacing.sm,
    paddingBottom: 40,
  },
  headerContainer: {
    marginBottom: spacing.md,
  },
  infoCard: {
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  groupIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  groupIconImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: spacing.sm,
    backgroundColor: '#f1f5f9',
  },
  groupIconText: {
    fontSize: 22,
  },
  groupTitleContainer: {
    flex: 1,
  },
  groupTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: palette.text,
  },
  memberCount: {
    fontSize: 14,
    color: palette.muted,
    marginTop: 2,
  },
  editIconButton: {
    padding: spacing.sm,
    backgroundColor: '#fef3c7',
    borderRadius: radius.md,
  },
  groupDescription: {
    fontSize: 14,
    color: palette.muted,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingTop: spacing.md,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: '#fef3c7',
  },
  actionButtonText: {
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
    fontSize: fontSizes.sm,
    color: palette.accentDark,
  },
  leaveButton: {
    backgroundColor: '#fef2f2',
  },
  leaveButtonText: {
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
    fontSize: fontSizes.sm,
    color: '#dc2626',
  },
  postButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: palette.accent,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
    
    
    
    
    elevation: 4,
  },
  postButtonText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.md,
    fontWeight: '800',
    color: '#1f2937',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.lg,
    fontWeight: '800',
    color: palette.text,
  },
  sectionCount: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: palette.muted,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.lg,
    fontWeight: '800',
    color: palette.text,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: palette.muted,
    textAlign: 'center',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.xl,
    fontWeight: '800',
    color: palette.text,
  },
  inputLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.xs,
    fontWeight: '600',
    color: palette.muted,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    fontFamily: fonts.body,
    backgroundColor: '#f8fafc',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: fontSizes.md,
    color: palette.text,
    borderWidth: 1,
    borderColor: palette.border,
    marginBottom: spacing.md,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
    paddingTop: spacing.md,
  },
  charCount: {
    fontFamily: fonts.body,
    textAlign: 'right',
    fontSize: fontSizes.xs,
    color: palette.muted,
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
  },
  saveButton: {
    backgroundColor: palette.accent,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  saveButtonText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.md,
    fontWeight: '800',
    color: '#1f2937',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  urgentToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#ef4444',
    borderColor: '#ef4444',
  },
  urgentToggleText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.md,
    fontWeight: '600',
    color: palette.text,
  },
  postSubmitButton: {
    backgroundColor: palette.accent,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  postSubmitButtonText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.md,
    fontWeight: '800',
    color: '#1f2937',
  },
  // Members list
  membersList: {
    paddingBottom: spacing.sm,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  memberProfileImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: spacing.md,
    backgroundColor: '#f1f5f9',
  },
  memberAvatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
  },
  memberInfo: {
    flex: 1,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  memberName: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.md,
    fontWeight: '700',
    color: palette.text,
  },
  memberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 3,
  },
  memberBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
    fontWeight: '700',
  },
  memberRoleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: 2,
  },
  ownerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 3,
  },
  ownerBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
    fontWeight: '700',
    color: '#92400e',
  },
  memberEmail: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: palette.muted,
  },
  memberRole: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.xs,
    color: palette.accent,
    fontWeight: '600',
  },
  memberActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  memberActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  memberActionText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.xs,
    fontWeight: '600',
  },
  // Photo picker styles
  photoPickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  photoPreview: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f1f5f9',
  },
  photoPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: palette.border,
    borderStyle: 'dashed',
  },
  photoButtons: {
    flex: 1,
    gap: spacing.sm,
  },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: '#fef3c7',
    borderRadius: radius.md,
  },
  photoButtonText: {
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
    fontSize: fontSizes.sm,
    color: palette.accentDark,
  },
  photoButtonRemove: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: '#fef2f2',
    borderRadius: radius.md,
  },
  photoButtonRemoveText: {
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
    fontSize: fontSizes.sm,
    color: '#dc2626',
  },
  // Pending requests styles
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fef3c7',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#fcd34d',
  },
  pendingBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pendingBannerText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.sm,
    fontWeight: '700',
    color: '#92400e',
  },
  emptyPending: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
  },
  emptyPendingText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.md,
    color: palette.muted,
    marginTop: spacing.md,
  },
  pendingList: {
    paddingBottom: spacing.sm,
  },
  pendingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  pendingUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  pendingAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: spacing.md,
    backgroundColor: '#f1f5f9',
  },
  pendingAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingAvatarText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },
  pendingUserDetails: {
    flex: 1,
  },
  pendingUserName: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.md,
    fontWeight: '700',
    color: palette.text,
  },
  pendingUserEmail: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: palette.muted,
    marginTop: 2,
  },
  pendingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rejectButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fef2f2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  approveButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Privacy toggle styles
  privacyToggleContainer: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  privacyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: palette.border,
    gap: spacing.md,
  },
  privacyOptionActive: {
    backgroundColor: '#fef3c7',
    borderColor: '#fcd34d',
  },
  privacyOptionContent: {
    flex: 1,
  },
  privacyOptionTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.md,
    fontWeight: '700',
    color: palette.text,
  },
  privacyOptionTitleActive: {
    color: palette.accentDark,
  },
  privacyOptionDesc: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: palette.muted,
    marginTop: 2,
  },
  privacyInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.lg,
  },
  privacyInfoTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.md,
    fontWeight: '700',
  },
  privacyInfoDesc: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    marginTop: 2,
  },
});
