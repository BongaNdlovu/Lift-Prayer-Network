import React, { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../hooks/useAuth';
import {
  createGroup,
  subscribeToUserGroups,
  leaveGroup,
  deleteGroup,
  joinGroup,
  findGroupByInviteCode,
  getInviteCode,
} from '../services/groups';
import { collection, query, where, orderBy, limit, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useTheme } from '../contexts/ThemeContext';
import { palette, radius, spacing } from '../theme/colors';
import { SkeletonGroups } from '../components/SkeletonCard';
import type { PrayerGroup } from '../types';
import type { RootStackParamList } from '../navigation/types';

const GROUP_ITEM_HEIGHT = 220;
const GROUP_EMOJIS = ['🙏', '⛪', '👨‍👩‍👧‍👦', '❤️', '✝️', '🕊️', '📖', '🌟', '💒', '🤝'];

type GroupNotification = {
  id: string;
  type: string;
  groupName: string;
  groupEmoji: string;
  groupId: string;
  read: boolean;
};

export const GroupsScreen: React.FC = () => {
  const { user } = useAuth();
  const { colors } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [groups, setGroups] = useState<PrayerGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [newGroupEmoji, setNewGroupEmoji] = useState('🙏');
  const [inviteCode, setInviteCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [notifications, setNotifications] = useState<GroupNotification[]>([]);

  const handleGroupPress = (group: PrayerGroup) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    navigation.navigate('GroupDetail', {
      groupId: group.id,
      groupName: group.name,
      groupEmoji: group.emoji,
    });
  };

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const unsub = subscribeToUserGroups(user.uid, (data) => {
      setGroups(data);
      setLoading(false);
    });

    return () => unsub();
  }, [user]);

  // Public groups discovery disabled - requires moderation features

  // Subscribe to group-related notifications
  useEffect(() => {
    if (!user || !db) return;
    
    const notifQuery = query(
      collection(db, 'notifications'),
      where('recipientUid', '==', user.uid),
      where('type', '==', 'group_join_approved'),
      where('read', '==', false),
      orderBy('createdAt', 'desc'),
      limit(5)
    );
    
    const unsub = onSnapshot(notifQuery, (snapshot) => {
      const notifs = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as GroupNotification[];
      setNotifications(notifs);
    }, (err) => {
      console.warn('[GroupsScreen] Notification subscription error:', err);
    });
    
    return () => unsub();
  }, [user]);

  // Dismiss a notification
  const dismissNotification = async (notifId: string) => {
    if (!db) return;
    try {
      await updateDoc(doc(db, 'notifications', notifId), { read: true });
      setNotifications(prev => prev?.filter(n => n.id !== notifId) || []);
    } catch (err) {
      console.warn('[GroupsScreen] Error dismissing notification:', err);
    }
  };

  const handleCreateGroup = async () => {
    if (!user || !newGroupName.trim()) return;

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    setCreating(true);
    try {
      console.log('[GroupsScreen] Creating group:', newGroupName.trim());
      
      const groupId = await createGroup(
        newGroupName.trim(),
        user.uid,
        newGroupDesc.trim(),
        newGroupEmoji,
        true
      );

      if (groupId) {
        console.log('[GroupsScreen] Group created successfully:', groupId);
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        setShowCreateModal(false);
        setNewGroupName('');
        setNewGroupDesc('');
        setNewGroupEmoji('🙏');
        Alert.alert('Success', 'Prayer group created! 🙏');
      } else {
        Alert.alert('Error', 'Could not create group. Please try again.');
      }
    } catch (err: any) {
      console.error('[GroupsScreen] Create group error:', err);
      const message = err?.message || 'Could not create group. Please try again.';
      Alert.alert('Error', message);
    } finally {
      setCreating(false);
    }
  };

  const handleJoinGroup = async () => {
    if (!user || !inviteCode.trim()) return;

    setJoining(true);
    try {
      const group = await findGroupByInviteCode(inviteCode.trim());
      
      if (!group) {
        Alert.alert('Not Found', 'No group found with that invite code');
        setJoining(false);
        return;
      }

      const result = await joinGroup(group.id, user.uid);
      
      if (result.success) {
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        setShowJoinModal(false);
        setInviteCode('');
        
        if (result.status === 'joined') {
          Alert.alert('Joined!', `You've joined ${group.name}`);
        } else if (result.status === 'pending') {
          Alert.alert(
            'Request Sent',
            `Your request to join "${group.name}" has been sent. The group owner will review it.`
          );
        }
      } else {
        Alert.alert('Error', result.error || 'Could not join group');
      }
    } catch {
      Alert.alert('Error', 'Could not join group');
    } finally {
      setJoining(false);
    }
  };

  const handleShareInvite = async (group: PrayerGroup) => {
    const code = getInviteCode(group.id);
    try {
      await Share.share({
        message: `Join my prayer group "${group.name}" on Lift!\n\nInvite code: ${code}`,
      });
    } catch {
      // User cancelled
    }
  };

  // Public group joining disabled - requires moderation features
  // const handleJoinPublicGroup = async (group: PrayerGroup) => { ... };

  const handleLeaveGroup = (group: PrayerGroup) => {
    if (!user) return;

    Alert.alert(
      'Leave Group',
      `Are you sure you want to leave "${group.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            if (group.ownerUid === user.uid) {
              // Owner leaving = delete group
              await deleteGroup(group.id, user.uid);
            } else {
              await leaveGroup(group.id, user.uid);
            }
          },
        },
      ]
    );
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.emptyEmoji}>👥</Text>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>Sign in to join groups</Text>
        <Text style={[styles.emptySubtitle, { color: colors.muted }]}>Create prayer circles with family & friends</Text>
      </SafeAreaView>
    );
  }

  const renderGroup = ({ item }: { item: PrayerGroup }) => (
    <TouchableOpacity 
      style={[styles.groupCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={() => handleGroupPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.groupHeader}>
        <View style={[styles.groupEmoji, { backgroundColor: colors.accentLight }]}>
          <Text style={styles.groupEmojiText}>{item.emoji || '🙏'}</Text>
        </View>
        <View style={styles.groupInfo}>
          <Text style={[styles.groupName, { color: colors.text }]}>{item.name}</Text>
          <Text style={[styles.groupMembers, { color: colors.muted }]}>
            {item.memberUids.length} member{item.memberUids.length !== 1 ? 's' : ''}
          </Text>
        </View>
        <View style={styles.groupRightSection}>
          {item.ownerUid === user?.uid && (
            <View style={[styles.ownerBadge, { backgroundColor: colors.accentLight }]}>
              <Text style={styles.ownerBadgeText}>Owner</Text>
            </View>
          )}
          <Ionicons name="chevron-forward" size={20} color={colors.muted} />
        </View>
      </View>
      
      {item.description && (
        <Text style={[styles.groupDesc, { color: colors.muted }]}>{item.description}</Text>
      )}

      <View style={[styles.groupActions, { borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.accentLight }]}
          onPress={(e) => {
            e.stopPropagation();
            handleShareInvite(item);
          }}
        >
          <Ionicons name="share-outline" size={18} color={colors.accent} />
          <Text style={[styles.actionBtnText, { color: colors.accent }]}>Invite</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionBtn, styles.leaveBtn, { backgroundColor: colors.dangerLight }]}
          onPress={(e) => {
            e.stopPropagation();
            handleLeaveGroup(item);
          }}
        >
          <Ionicons name="exit-outline" size={18} color={colors.danger} />
          <Text style={[styles.leaveBtnText, { color: colors.danger }]}>
            {item.ownerUid === user?.uid ? 'Delete' : 'Leave'}
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.heading, { color: colors.text }]}>Prayer Groups</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={[styles.headerBtn, { backgroundColor: colors.surface }]}
            onPress={() => setShowJoinModal(true)}
          >
            <Ionicons name="enter-outline" size={20} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerBtn, styles.createBtn, { backgroundColor: colors.accent }]}
            onPress={() => setShowCreateModal(true)}
          >
            <Ionicons name="add" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Notification Banner for Group Join Approvals */}
      {notifications.map((notif) => (
        <View key={notif.id} style={styles.notificationBanner}>
          <View style={styles.notificationContent}>
            <Text style={styles.notificationEmoji}>{notif.groupEmoji || '🙏'}</Text>
            <View style={styles.notificationText}>
              <Text style={[styles.notificationTitle, { color: colors.text }]}>Welcome!</Text>
              <Text style={[styles.notificationMessage, { color: colors.muted }]}>
                You&apos;ve been added to &quot;{notif.groupName}&quot;
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.notificationDismiss}
            onPress={() => dismissNotification(notif.id)}
          >
            <Ionicons name="close" size={18} color={colors.muted} />
          </TouchableOpacity>
        </View>
      ))}

      {loading ? (
        <View style={styles.list}>
          <SkeletonGroups count={4} />
        </View>
      ) : groups.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🤝</Text>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No groups yet</Text>
          <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
            Create a prayer circle or join one with an invite code
          </Text>
          <View style={styles.emptyActions}>
            <TouchableOpacity
              style={[styles.emptyBtn, { backgroundColor: colors.accentLight }]}
              onPress={() => setShowCreateModal(true)}
            >
              <Ionicons name="add-circle-outline" size={20} color={colors.accent} />
              <Text style={[styles.emptyBtnText, { color: colors.accent }]}>Create Group</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.emptyBtn, { backgroundColor: colors.accentLight }]}
              onPress={() => setShowJoinModal(true)}
            >
              <Ionicons name="enter-outline" size={20} color={colors.accent} />
              <Text style={[styles.emptyBtnText, { color: colors.accent }]}>Join with Code</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(item) => item.id}
          renderItem={renderGroup}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          initialNumToRender={8}
          windowSize={5}
          maxToRenderPerBatch={8}
          updateCellsBatchingPeriod={50}
          removeClippedSubviews={Platform.OS !== 'web'}
          getItemLayout={(_, index) => ({
            length: GROUP_ITEM_HEIGHT,
            offset: GROUP_ITEM_HEIGHT * index,
            index,
          })}
        />
      )}

      {/* Create Group Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Create Prayer Group</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <Ionicons name="close" size={24} color={colors.muted} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.inputLabel, { color: colors.muted }]}>Group Name</Text>
            <TextInput
              style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
              placeholder="e.g., Family Prayers"
              placeholderTextColor={colors.muted}
              value={newGroupName}
              onChangeText={setNewGroupName}
              maxLength={50}
            />

            <Text style={[styles.inputLabel, { color: colors.muted }]}>Description (optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
              placeholder="What is this group for?"
              placeholderTextColor={colors.muted}
              value={newGroupDesc}
              onChangeText={setNewGroupDesc}
              multiline
              maxLength={200}
            />

            <Text style={[styles.inputLabel, { color: colors.muted }]}>Choose an Emoji</Text>
            <View style={styles.emojiPicker}>
              {GROUP_EMOJIS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={[
                    styles.emojiOption,
                    { backgroundColor: colors.surface },
                    newGroupEmoji === emoji && [styles.emojiOptionActive, { backgroundColor: colors.accentLight, borderColor: colors.accent }],
                  ]}
                  onPress={() => setNewGroupEmoji(emoji)}
                >
                  <Text style={styles.emojiText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.createButton, { backgroundColor: colors.accent }, !newGroupName.trim() && styles.buttonDisabled]}
              onPress={handleCreateGroup}
              disabled={!newGroupName.trim() || creating}
            >
              <Text style={[styles.createButtonText, { color: '#fff' }]}>
                {creating ? 'Creating...' : 'Create Group'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Join Group Modal */}
      <Modal
        visible={showJoinModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowJoinModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Join Prayer Group</Text>
              <TouchableOpacity onPress={() => setShowJoinModal(false)}>
                <Ionicons name="close" size={24} color={colors.muted} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.inputLabel, { color: colors.muted }]}>Enter Invite Code</Text>
            <TextInput
              style={[styles.input, styles.codeInput, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
              placeholder="ABCD1234"
              placeholderTextColor={colors.muted}
              value={inviteCode}
              onChangeText={(text) => setInviteCode(text.toUpperCase())}
              maxLength={8}
              autoCapitalize="characters"
            />

            <TouchableOpacity
              style={[styles.createButton, { backgroundColor: colors.accent }, !inviteCode.trim() && styles.buttonDisabled]}
              onPress={handleJoinGroup}
              disabled={!inviteCode.trim() || joining}
            >
              <Text style={[styles.createButtonText, { color: '#fff' }]}>
                {joining ? 'Joining...' : 'Join Group'}
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.background,
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
  },
  heading: {
    fontSize: 28,
    fontWeight: '900',
    color: palette.text,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  headerBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createBtn: {
    backgroundColor: palette.accent,
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  list: {
    padding: spacing.lg,
    paddingTop: 0,
  },
  groupCard: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: palette.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  groupEmoji: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: palette.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  groupEmojiText: {
    fontSize: 24,
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 18,
    fontWeight: '800',
    color: palette.text,
  },
  groupMembers: {
    fontSize: 13,
    color: palette.muted,
  },
  groupRightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  ownerBadge: {
    backgroundColor: palette.accentLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  ownerBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: palette.accent,
  },
  groupDesc: {
    fontSize: 14,
    color: palette.muted,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  groupActions: {
    flexDirection: 'row',
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingTop: spacing.lg,
    marginTop: spacing.sm,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: palette.accentLight,
  },
  actionBtnText: {
    fontWeight: '700',
    color: palette.accentDark,
  },
  leaveBtn: {
    backgroundColor: palette.dangerLight,
  },
  leaveBtnText: {
    fontWeight: '700',
    color: '#dc2626',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: palette.text,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: 14,
    color: palette.muted,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  emptyActions: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: palette.accentLight,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  emptyBtnText: {
    fontWeight: '700',
    color: palette.accentDark,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: palette.surface,
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
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: palette.text,
    borderWidth: 1,
    borderColor: palette.border,
    marginBottom: spacing.lg,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
    paddingTop: spacing.md,
  },
  codeInput: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 4,
    textAlign: 'center',
  },
  emojiPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.xl,
    marginTop: spacing.sm,
  },
  emojiOption: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiOptionActive: {
    backgroundColor: palette.accentLight,
    borderWidth: 2,
    borderColor: palette.accent,
  },
  emojiText: {
    fontSize: 24,
  },
  createButton: {
    backgroundColor: palette.accent,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing.md,
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: palette.accentDark,
  },
  // Discover section styles
  discoverSection: {
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
  discoverHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  discoverTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: palette.text,
  },
  discoverSubtitle: {
    fontSize: 13,
    color: palette.muted,
    marginBottom: spacing.md,
  },
  discoverCard: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: palette.border,
  },
  discoverCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  discoverCardInfo: {
    flex: 1,
  },
  discoverCardDesc: {
    fontSize: 13,
    color: palette.muted,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: palette.success,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  joinBtnDisabled: {
    opacity: 0.6,
  },
  joinBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  // Notification banner styles
  notificationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: palette.successLight,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.success,
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm,
  },
  notificationEmoji: {
    fontSize: 24,
  },
  notificationText: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.success,
  },
  notificationMessage: {
    fontSize: 13,
    color: palette.success,
    marginTop: 2,
  },
  notificationDismiss: {
    padding: spacing.xs,
  },
});

