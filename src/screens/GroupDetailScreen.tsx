import React, { useEffect, useState, useCallback } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  SafeAreaView,
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
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../hooks/useAuth';
import { getGroup, getGroupMembers, updateGroup, leaveGroup, deleteGroup, getInviteCode } from '../services/groups';
import { subscribeToGroupRequests, submitGroupRequest, logPrayer } from '../services/prayers';
import { palette, radius, spacing } from '../theme/colors';
import { FeedCard } from '../components/FeedCard';
import { hasAdminPermission, canEditContent, canDeleteContent, getVerifiedBadge, BADGE_STYLES } from '../config/admins';
import type { PrayerGroup, FeedItem, LiftRequest } from '../types';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'GroupDetail'>;

type GroupMember = {
  uid: string;
  displayName: string;
  email?: string;
  photoURL?: string | null;
};

export const GroupDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { groupId, groupName, groupEmoji } = route.params;
  const { user } = useAuth();
  const [group, setGroup] = useState<PrayerGroup | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [prayers, setPrayers] = useState<LiftRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPostModal, setShowPostModal] = useState(false);
  
  // Edit group state
  const [editName, setEditName] = useState(groupName);
  const [editDesc, setEditDesc] = useState('');
  const [saving, setSaving] = useState(false);
  
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
    setRefreshing(true);
    const groupData = await getGroup(groupId);
    if (groupData) {
      setGroup(groupData);
    }
    const membersList = await getGroupMembers(groupId);
    setMembers(membersList);
    setRefreshing(false);
  }, [groupId]);

  const handleShareInvite = async () => {
    const code = getInviteCode(groupId);
    try {
      await Share.share({
        message: `Join my prayer group "${groupName}" on Lift!\n\nInvite code: ${code}`,
      });
    } catch (err) {
      // User cancelled
    }
  };

  const handleEditGroup = async () => {
    if (!editName.trim()) {
      Alert.alert('Error', 'Group name is required');
      return;
    }

    setSaving(true);
    try {
      await updateGroup(groupId, {
        name: editName.trim(),
        description: editDesc.trim(),
      });
      
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      
      setShowEditModal(false);
      setGroup(prev => prev ? { ...prev, name: editName.trim(), description: editDesc.trim() } : null);
      Alert.alert('Success', 'Group updated!');
    } catch (err) {
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
    } catch (err) {
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
          } catch (e) {}
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

  const renderPrayer = ({ item }: { item: LiftRequest }) => {
    const feedItem: FeedItem = { ...item, type: 'REQUEST' };
    return (
      <FeedCard
        item={feedItem}
        onPress={handlePrayerPress}
        onPray={handlePray}
        disabled={busyPrayIds.has(item.id)}
        currentUserId={user?.uid}
        currentUserEmail={user?.email}
      />
    );
  };

  const renderMember = ({ item }: { item: GroupMember }) => {
    const isGroupOwner = item.uid === group?.ownerUid;
    const verifiedBadge = getVerifiedBadge(item.email, item.uid);
    const badgeStyle = verifiedBadge ? BADGE_STYLES[verifiedBadge.badgeType] : null;
    const hasProfilePicture = item.photoURL && item.photoURL.trim() !== '';

    return (
      <View style={styles.memberItem}>
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
            <Text style={styles.memberName}>{item.displayName || 'Unknown'}</Text>
            
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
              <Text style={styles.memberEmail} numberOfLines={1}>
                {item.email}
              </Text>
            )}
          </View>
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
      <View style={styles.infoCard}>
        <View style={styles.infoHeader}>
          <View style={styles.groupIcon}>
            <Text style={styles.groupIconText}>{groupEmoji || group?.emoji || '🙏'}</Text>
          </View>
          <View style={styles.groupTitleContainer}>
            <Text style={styles.groupTitle}>{group?.name || groupName}</Text>
            <Text style={styles.memberCount}>
              {members.length} member{members.length !== 1 ? 's' : ''}
            </Text>
          </View>
          {canManageGroup && (
            <TouchableOpacity style={styles.editIconButton} onPress={() => setShowEditModal(true)}>
              <Ionicons name="pencil" size={18} color={palette.accentDark} />
            </TouchableOpacity>
          )}
        </View>
        
        {group?.description && (
          <Text style={styles.groupDescription}>{group.description}</Text>
        )}

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionButton} onPress={() => setShowMembersModal(true)}>
            <Ionicons name="people" size={18} color={palette.accentDark} />
            <Text style={styles.actionButtonText}>Members</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton} onPress={handleShareInvite}>
            <Ionicons name="share-outline" size={18} color={palette.accentDark} />
            <Text style={styles.actionButtonText}>Invite</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, styles.leaveButton]} 
            onPress={handleLeaveGroup}
          >
            <Ionicons name="exit-outline" size={18} color="#dc2626" />
            <Text style={styles.leaveButtonText}>{isOwner ? 'Delete' : 'Leave'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Post Prayer Button */}
      <TouchableOpacity style={styles.postButton} onPress={() => setShowPostModal(true)}>
        <Ionicons name="add-circle" size={24} color="#fff" />
        <Text style={styles.postButtonText}>Share Prayer Request</Text>
      </TouchableOpacity>

      {/* Section Header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Group Prayers</Text>
        <Text style={styles.sectionCount}>{prayers.length} request{prayers.length !== 1 ? 's' : ''}</Text>
      </View>
    </View>
  );

  const ListEmpty = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyEmoji}>🙏</Text>
      <Text style={styles.emptyTitle}>No prayers yet</Text>
      <Text style={styles.emptySubtitle}>
        Be the first to share a prayer request with this group
      </Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={palette.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={palette.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{group?.name || groupName}</Text>
        <View style={styles.placeholder} />
      </View>

      <FlatList
        data={prayers}
        keyExtractor={(item) => item.id}
        renderItem={renderPrayer}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
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
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Group Members</Text>
              <TouchableOpacity onPress={() => setShowMembersModal(false)}>
                <Ionicons name="close" size={24} color={palette.muted} />
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={members}
              keyExtractor={(item) => item.uid}
              renderItem={renderMember}
              contentContainerStyle={styles.membersList}
              showsVerticalScrollIndicator={false}
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
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Group</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Ionicons name="close" size={24} color={palette.muted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Group Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Group name"
              placeholderTextColor={palette.muted}
              value={editName}
              onChangeText={setEditName}
              maxLength={50}
            />

            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="What is this group for?"
              placeholderTextColor={palette.muted}
              value={editDesc}
              onChangeText={setEditDesc}
              multiline
              maxLength={200}
            />

            <TouchableOpacity
              style={[styles.saveButton, !editName.trim() && styles.buttonDisabled]}
              onPress={handleEditGroup}
              disabled={!editName.trim() || saving}
            >
              <Text style={styles.saveButtonText}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Text>
            </TouchableOpacity>
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.background,
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
    padding: spacing.md,
    paddingBottom: 40,
  },
  headerContainer: {
    marginBottom: spacing.md,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: palette.border,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  groupIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  groupIconText: {
    fontSize: 28,
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
    fontWeight: '700',
    fontSize: 13,
    color: palette.accentDark,
  },
  leaveButton: {
    backgroundColor: '#fef2f2',
  },
  leaveButtonText: {
    fontWeight: '700',
    fontSize: 13,
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
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  postButtonText: {
    fontSize: 16,
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
    fontSize: 18,
    fontWeight: '800',
    color: palette.text,
  },
  sectionCount: {
    fontSize: 13,
    color: palette.muted,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: palette.text,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    fontSize: 14,
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
    fontSize: 20,
    fontWeight: '800',
    color: palette.text,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.muted,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16,
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
    textAlign: 'right',
    fontSize: 12,
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
    fontSize: 16,
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
    fontSize: 15,
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
    fontSize: 16,
    fontWeight: '800',
    color: '#1f2937',
  },
  // Members list
  membersList: {
    paddingBottom: spacing.lg,
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
    fontSize: 16,
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
    fontSize: 10,
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
    fontSize: 10,
    fontWeight: '700',
    color: '#92400e',
  },
  memberEmail: {
    fontSize: 12,
    color: palette.muted,
  },
  memberRole: {
    fontSize: 12,
    color: palette.accent,
    fontWeight: '600',
  },
});

