import React, { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { collection, doc, limit, onSnapshot, orderBy, query, updateDoc, where } from 'firebase/firestore';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../hooks/useAuth';
import {
  createGroup,
  deleteGroup,
  findGroupByInviteCode,
  getInviteCode,
  joinGroup,
  leaveGroup,
  subscribeToUserGroups,
} from '../services/groups';
import { db } from '../services/firebase';
import { useTheme } from '../contexts/ThemeContext';
import { fonts, shadows, spacing } from '../theme/colors';
import {
  LiftBadge,
  LiftBottomSheet,
  LiftButton,
  LiftCard,
  LiftChips,
  LiftEmptyState,
  LiftFormSection,
  LiftHeader,
  LiftIconButton,
  LiftInput,
  LiftLoadingState,
  LiftScreen,
  LiftTextArea,
} from '../components/LiftLayout';
import type { PrayerGroup } from '../types';
import type { RootStackParamList } from '../navigation/types';
import { NOTIFICATION_TYPES } from '../types/notifications';

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

  useEffect(() => {
    if (!user || !db) return;

    const notifQuery = query(
      collection(db, 'notifications'),
      where('recipientUid', '==', user.uid),
      where('type', '==', NOTIFICATION_TYPES.GROUP_JOIN),
      where('read', '==', false),
      orderBy('createdAt', 'desc'),
      limit(5)
    );

    const unsub = onSnapshot(
      notifQuery,
      (snapshot) => {
        const notifs = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as GroupNotification[];
        setNotifications(notifs);
      },
      (err) => {
        console.warn('[GroupsScreen] Notification subscription error:', err);
      }
    );

    return () => unsub();
  }, [user]);

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

  const dismissNotification = async (notifId: string) => {
    if (!db) return;
    try {
      await updateDoc(doc(db, 'notifications', notifId), { read: true });
      setNotifications((prev) => prev.filter((n) => n.id !== notifId));
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
      const groupId = await createGroup(newGroupName.trim(), user.uid, newGroupDesc.trim(), newGroupEmoji, true);

      if (groupId) {
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        setShowCreateModal(false);
        setNewGroupName('');
        setNewGroupDesc('');
        setNewGroupEmoji('🙏');
        Alert.alert('Success', 'Prayer group created.');
      } else {
        Alert.alert('Error', 'Could not create group. Please try again.');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not create group. Please try again.');
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
        Alert.alert('Not Found', 'No group found with that invite code.');
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
          Alert.alert('Joined', `You've joined ${group.name}.`);
        } else if (result.status === 'pending') {
          Alert.alert('Request Sent', `Your request to join "${group.name}" has been sent.`);
        }
      } else {
        Alert.alert('Error', result.error || 'Could not join group.');
      }
    } catch {
      Alert.alert('Error', 'Could not join group.');
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
      // User cancelled the share sheet.
    }
  };

  const handleLeaveGroup = (group: PrayerGroup) => {
    if (!user) return;

    Alert.alert('Leave Group', `Are you sure you want to leave "${group.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: group.ownerUid === user.uid ? 'Delete' : 'Leave',
        style: 'destructive',
        onPress: async () => {
          if (group.ownerUid === user.uid) {
            await deleteGroup(group.id, user.uid);
          } else {
            await leaveGroup(group.id, user.uid);
          }
        },
      },
    ]);
  };

  if (!user) {
    return (
      <LiftScreen>
        <LiftEmptyState
          icon="people-outline"
          title="Sign in to join groups"
          message="Create prayer circles with family and friends."
        />
      </LiftScreen>
    );
  }

  return (
    <LiftScreen scroll>
      <LiftHeader
        title="Groups"
        subtitle="Your prayer circles"
        right={
          <View style={styles.headerActions}>
            <LiftIconButton icon="enter-outline" onPress={() => setShowJoinModal(true)} />
            <LiftIconButton icon="add" onPress={() => setShowCreateModal(true)} color={colors.accent} />
          </View>
        }
      />

      {notifications.map((notif) => (
        <LiftCard key={notif.id} style={[styles.notificationCard, { backgroundColor: colors.successLight }]}>
          <View style={styles.notificationContent}>
            <Text style={styles.notificationEmoji}>{notif.groupEmoji || '🙏'}</Text>
            <View style={styles.notificationText}>
              <Text style={[styles.notificationTitle, { color: colors.text }]}>Welcome</Text>
              <Text style={[styles.notificationMessage, { color: colors.textSecondary }]}>
                You have been added to &quot;{notif.groupName}&quot;.
              </Text>
            </View>
            <Pressable onPress={() => dismissNotification(notif.id)} hitSlop={10}>
              <Ionicons name="close" size={18} color={colors.muted} />
            </Pressable>
          </View>
        </LiftCard>
      ))}

      {loading ? (
        <LiftLoadingState label="Loading groups..." />
      ) : groups.length === 0 ? (
        <LiftEmptyState
          icon="people-outline"
          title="No groups yet"
          message="Create a prayer circle or join one with an invite code."
          action={
            <View style={styles.emptyActions}>
              <LiftButton onPress={() => setShowCreateModal(true)}>Create Group</LiftButton>
              <LiftButton variant="secondary" onPress={() => setShowJoinModal(true)}>
                Join with Code
              </LiftButton>
            </View>
          }
        />
      ) : (
        <View style={styles.groupList}>
          {groups.map((group) => (
            <LiftCard key={group.id} onPress={() => handleGroupPress(group)}>
              <View style={styles.groupHeader}>
                <View style={[styles.groupEmoji, { backgroundColor: colors.accentLight }]}>
                  <Text style={styles.groupEmojiText}>{group.emoji || '🙏'}</Text>
                </View>
                <View style={styles.groupInfo}>
                  <Text style={[styles.groupName, { color: colors.text }]} numberOfLines={1}>
                    {group.name}
                  </Text>
                  <Text style={[styles.groupMembers, { color: colors.textSecondary }]}>
                    {group.memberUids.length} member{group.memberUids.length !== 1 ? 's' : ''}
                  </Text>
                </View>
                {group.ownerUid === user.uid ? <LiftBadge label="Owner" tone="warning" /> : null}
              </View>

              {group.description ? (
                <Text style={[styles.groupDesc, { color: colors.textSecondary }]}>{group.description}</Text>
              ) : null}

              <View style={[styles.groupActions, { borderTopColor: colors.border }]}>
                <Pressable
                  style={({ pressed }) => [styles.actionButton, { backgroundColor: colors.surfaceSecondary }, pressed && styles.pressed]}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleShareInvite(group);
                  }}
                >
                  <Ionicons name="share-outline" size={17} color={colors.text} />
                  <Text style={[styles.actionButtonText, { color: colors.text }]}>Invite</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.actionButton, { backgroundColor: colors.dangerLight }, pressed && styles.pressed]}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleLeaveGroup(group);
                  }}
                >
                  <Ionicons name="exit-outline" size={17} color={colors.danger} />
                  <Text style={[styles.actionButtonText, { color: colors.danger }]}>
                    {group.ownerUid === user.uid ? 'Delete' : 'Leave'}
                  </Text>
                </Pressable>
              </View>
            </LiftCard>
          ))}
        </View>
      )}

      <LiftBottomSheet visible={showCreateModal} onClose={() => setShowCreateModal(false)}>
        <Text style={[styles.sheetTitle, { color: colors.text }]}>Create Prayer Group</Text>
        <LiftFormSection label="Group Name" hint={`${newGroupName.length}/50`}>
          <LiftInput
            value={newGroupName}
            onChangeText={setNewGroupName}
            placeholder="e.g., Family Prayers"
            maxLength={50}
            style={styles.embeddedInput}
          />
        </LiftFormSection>
        <LiftFormSection label="Description" hint={`${newGroupDesc.length}/200`}>
          <LiftTextArea
            value={newGroupDesc}
            onChangeText={setNewGroupDesc}
            placeholder="What is this group for?"
            maxLength={200}
            style={styles.embeddedInput}
          />
        </LiftFormSection>
        <LiftFormSection label="Group Icon">
          <LiftChips
            chips={GROUP_EMOJIS.map((emoji) => ({ value: emoji, label: emoji }))}
            active={newGroupEmoji}
            onChange={setNewGroupEmoji}
          />
        </LiftFormSection>
        <LiftButton onPress={handleCreateGroup} disabled={!newGroupName.trim() || creating} style={styles.sheetButton}>
          {creating ? 'Creating...' : 'Create Group'}
        </LiftButton>
      </LiftBottomSheet>

      <LiftBottomSheet visible={showJoinModal} onClose={() => setShowJoinModal(false)}>
        <Text style={[styles.sheetTitle, { color: colors.text }]}>Join Prayer Group</Text>
        <Text style={[styles.sheetSubtitle, { color: colors.textSecondary }]}>Enter the invite code shared by a group member.</Text>
        <LiftFormSection label="Invite Code">
          <LiftInput
            value={inviteCode}
            onChangeText={(text) => setInviteCode(text.toUpperCase())}
            placeholder="ABCD1234"
            maxLength={8}
            style={styles.embeddedInput}
            inputStyle={styles.codeInput}
          />
        </LiftFormSection>
        <LiftButton onPress={handleJoinGroup} disabled={!inviteCode.trim() || joining} style={styles.sheetButton}>
          {joining ? 'Joining...' : 'Join Group'}
        </LiftButton>
      </LiftBottomSheet>
    </LiftScreen>
  );
};

const styles = StyleSheet.create({
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  notificationCard: {
    marginBottom: spacing.md,
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  notificationEmoji: {
    fontSize: 24,
  },
  notificationText: {
    flex: 1,
  },
  notificationTitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
  },
  notificationMessage: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  emptyActions: {
    gap: 10,
    marginTop: 16,
    alignSelf: 'stretch',
  },
  groupList: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  groupEmoji: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupEmojiText: {
    fontSize: 26,
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontFamily: fonts.heading,
    fontSize: 20,
    lineHeight: 25,
  },
  groupMembers: {
    fontFamily: fonts.body,
    fontSize: 13,
    marginTop: 3,
  },
  groupDesc: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 14,
  },
  groupActions: {
    flexDirection: 'row',
    gap: 10,
    borderTopWidth: 1,
    marginTop: 16,
    paddingTop: 14,
  },
  actionButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionButtonText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
  sheetTitle: {
    fontFamily: fonts.heading,
    fontSize: 26,
    lineHeight: 32,
    marginBottom: 6,
  },
  sheetSubtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  embeddedInput: {
    borderWidth: 0,
    backgroundColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  codeInput: {
    fontFamily: fonts.bodyMedium,
    fontSize: 22,
    textAlign: 'center',
    letterSpacing: 3,
  },
  sheetButton: {
    marginTop: spacing.md,
    ...shadows.md,
  },
});

export default GroupsScreen;
