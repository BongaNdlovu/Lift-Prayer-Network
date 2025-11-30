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
import { palette, radius, spacing } from '../theme/colors';
import type { PrayerGroup } from '../types';
import type { RootStackParamList } from '../navigation/types';

const GROUP_EMOJIS = ['🙏', '⛪', '👨‍👩‍👧‍👦', '❤️', '✝️', '🕊️', '📖', '🌟', '💒', '🤝'];

export const GroupsScreen: React.FC = () => {
  const { user } = useAuth();
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

      if (group.memberUids.includes(user.uid)) {
        Alert.alert('Already Member', 'You are already in this group');
        setJoining(false);
        return;
      }

      const success = await joinGroup(group.id, user.uid);
      
      if (success) {
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        setShowJoinModal(false);
        setInviteCode('');
        Alert.alert('Joined!', `You've joined ${group.name}`);
      } else {
        Alert.alert('Error', 'Could not join group');
      }
    } catch (err) {
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
    } catch (err) {
      // User cancelled
    }
  };

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
        <Text style={styles.emptyTitle}>Sign in to join groups</Text>
        <Text style={styles.emptySubtitle}>Create prayer circles with family & friends</Text>
      </SafeAreaView>
    );
  }

  const renderGroup = ({ item }: { item: PrayerGroup }) => (
    <TouchableOpacity 
      style={styles.groupCard}
      onPress={() => handleGroupPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.groupHeader}>
        <View style={styles.groupEmoji}>
          <Text style={styles.groupEmojiText}>{item.emoji || '🙏'}</Text>
        </View>
        <View style={styles.groupInfo}>
          <Text style={styles.groupName}>{item.name}</Text>
          <Text style={styles.groupMembers}>
            {item.memberUids.length} member{item.memberUids.length !== 1 ? 's' : ''}
          </Text>
        </View>
        <View style={styles.groupRightSection}>
          {item.ownerUid === user?.uid && (
            <View style={styles.ownerBadge}>
              <Text style={styles.ownerBadgeText}>Owner</Text>
            </View>
          )}
          <Ionicons name="chevron-forward" size={20} color={palette.muted} />
        </View>
      </View>
      
      {item.description && (
        <Text style={styles.groupDesc}>{item.description}</Text>
      )}

      <View style={styles.groupActions}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={(e) => {
            e.stopPropagation();
            handleShareInvite(item);
          }}
        >
          <Ionicons name="share-outline" size={18} color={palette.accentDark} />
          <Text style={styles.actionBtnText}>Invite</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionBtn, styles.leaveBtn]}
          onPress={(e) => {
            e.stopPropagation();
            handleLeaveGroup(item);
          }}
        >
          <Ionicons name="exit-outline" size={18} color="#dc2626" />
          <Text style={styles.leaveBtnText}>
            {item.ownerUid === user?.uid ? 'Delete' : 'Leave'}
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.heading}>Prayer Groups</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => setShowJoinModal(true)}
          >
            <Ionicons name="enter-outline" size={20} color={palette.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerBtn, styles.createBtn]}
            onPress={() => setShowCreateModal(true)}
          >
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {groups.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🤝</Text>
          <Text style={styles.emptyTitle}>No groups yet</Text>
          <Text style={styles.emptySubtitle}>
            Create a prayer circle or join one with an invite code
          </Text>
          <View style={styles.emptyActions}>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => setShowCreateModal(true)}
            >
              <Ionicons name="add-circle-outline" size={20} color={palette.accentDark} />
              <Text style={styles.emptyBtnText}>Create Group</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => setShowJoinModal(true)}
            >
              <Ionicons name="enter-outline" size={20} color={palette.accentDark} />
              <Text style={styles.emptyBtnText}>Join with Code</Text>
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
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Prayer Group</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <Ionicons name="close" size={24} color={palette.muted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Group Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Family Prayers"
              placeholderTextColor={palette.muted}
              value={newGroupName}
              onChangeText={setNewGroupName}
              maxLength={50}
            />

            <Text style={styles.inputLabel}>Description (optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="What is this group for?"
              placeholderTextColor={palette.muted}
              value={newGroupDesc}
              onChangeText={setNewGroupDesc}
              multiline
              maxLength={200}
            />

            <Text style={styles.inputLabel}>Choose an Emoji</Text>
            <View style={styles.emojiPicker}>
              {GROUP_EMOJIS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={[
                    styles.emojiOption,
                    newGroupEmoji === emoji && styles.emojiOptionActive,
                  ]}
                  onPress={() => setNewGroupEmoji(emoji)}
                >
                  <Text style={styles.emojiText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.createButton, !newGroupName.trim() && styles.buttonDisabled]}
              onPress={handleCreateGroup}
              disabled={!newGroupName.trim() || creating}
            >
              <Text style={styles.createButtonText}>
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
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Join Prayer Group</Text>
              <TouchableOpacity onPress={() => setShowJoinModal(false)}>
                <Ionicons name="close" size={24} color={palette.muted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Enter Invite Code</Text>
            <TextInput
              style={[styles.input, styles.codeInput]}
              placeholder="ABCD1234"
              placeholderTextColor={palette.muted}
              value={inviteCode}
              onChangeText={(text) => setInviteCode(text.toUpperCase())}
              maxLength={8}
              autoCapitalize="characters"
            />

            <TouchableOpacity
              style={[styles.createButton, !inviteCode.trim() && styles.buttonDisabled]}
              onPress={handleJoinGroup}
              disabled={!inviteCode.trim() || joining}
            >
              <Text style={styles.createButtonText}>
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
    backgroundColor: '#f1f5f9',
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
    backgroundColor: '#fff',
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
    backgroundColor: '#fef3c7',
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
    backgroundColor: '#dbeafe',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  ownerBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#3b82f6',
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
    backgroundColor: '#fef3c7',
  },
  actionBtnText: {
    fontWeight: '700',
    color: palette.accentDark,
  },
  leaveBtn: {
    backgroundColor: '#fef2f2',
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
    backgroundColor: '#fef3c7',
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
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiOptionActive: {
    backgroundColor: '#fef3c7',
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
    color: '#1f2937',
  },
});

