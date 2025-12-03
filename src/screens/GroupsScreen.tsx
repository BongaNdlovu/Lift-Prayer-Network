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
import { LinearGradient } from 'expo-linear-gradient';
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
import { fonts, palette, radius, spacing, shadows } from '../theme/colors';
import { SkeletonGroups } from '../components/SkeletonCard';
import { CinematicBackground, RoundedPage, GlassHeader } from '../components/CinematicBackground';
import { GlassCard, GlassIconButton } from '../components/GlassCard';
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
  const { colors, isDark } = useTheme();
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
    <GlassCard 
      onPress={() => handleGroupPress(item)}
      style={styles.groupCard}
      padding="lg"
      rounded="xl"
    >
      <View style={styles.groupHeader}>
        <View style={[styles.groupEmoji, { backgroundColor: isDark ? colors.glassWhite : colors.accentLight }]}>
          <Text style={styles.groupEmojiText}>{item.emoji || '🙏'}</Text>
        </View>
        <View style={styles.groupInfo}>
          <Text style={[styles.groupName, { color: colors.stone900 }]}>{item.name}</Text>
          <Text style={[styles.groupMembers, { color: colors.stone500 }]}>
            {item.memberUids.length} member{item.memberUids.length !== 1 ? 's' : ''}
          </Text>
        </View>
        <View style={styles.groupRightSection}>
          {item.ownerUid === user?.uid && (
            <View style={[styles.ownerBadge, { backgroundColor: colors.amber100 }]}>
              <Text style={[styles.ownerBadgeText, { color: colors.amber600 }]}>Owner</Text>
            </View>
          )}
          <Ionicons name="chevron-forward" size={20} color={colors.stone400} />
        </View>
      </View>
      
      {item.description && (
        <Text style={[styles.groupDesc, { color: colors.stone500 }]}>{item.description}</Text>
      )}

      <View style={[styles.groupActions, { borderTopColor: colors.glassBorder }]}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: isDark ? colors.glassWhite : colors.stone100 }]}
          onPress={(e) => {
            e.stopPropagation();
            handleShareInvite(item);
          }}
        >
          <Ionicons name="share-outline" size={18} color={colors.stone700} />
          <Text style={[styles.actionBtnText, { color: colors.stone700 }]}>Invite</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionBtn, styles.leaveBtn, { backgroundColor: colors.rose100 }]}
          onPress={(e) => {
            e.stopPropagation();
            handleLeaveGroup(item);
          }}
        >
          <Ionicons name="exit-outline" size={18} color={colors.rose600} />
          <Text style={[styles.leaveBtnText, { color: colors.rose600 }]}>
            {item.ownerUid === user?.uid ? 'Delete' : 'Leave'}
          </Text>
        </TouchableOpacity>
      </View>
    </GlassCard>
  );

  return (
    <CinematicBackground useOuterBackground>
      <SafeAreaView style={styles.container}>
        {/* === HEADER SECTION === */}
        <View style={styles.headerSection}>
          <View style={styles.header}>
            <Text style={[styles.kicker, { color: colors.stone500 }]}>YOUR CIRCLES</Text>
            <Text style={styles.heading}>
              Groups<Text style={styles.headingDot}>.</Text>
            </Text>
          </View>
          <View style={styles.headerButtons}>
            <GlassIconButton
              onPress={() => setShowJoinModal(true)}
            >
              <Ionicons name="enter-outline" size={22} color={colors.stone700} strokeWidth={1.5} />
            </GlassIconButton>
            <GlassIconButton
              onPress={() => setShowCreateModal(true)}
              style={{ backgroundColor: colors.amber100, borderColor: colors.amber200 }}
            >
              <Ionicons name="add" size={24} color={colors.amber700} strokeWidth={2} />
            </GlassIconButton>
          </View>
        </View>

        {/* === MAIN CONTENT === */}
        <RoundedPage style={styles.mainContent}>
          {/* Notification Banner */}
          {notifications.map((notif) => (
            <View key={notif.id} style={styles.notificationBanner}>
              <View style={styles.notificationContent}>
                <Text style={styles.notificationEmoji}>{notif.groupEmoji || '🙏'}</Text>
                <View style={styles.notificationText}>
                  <Text style={[styles.notificationTitle, { color: colors.stone900 }]}>Welcome!</Text>
                  <Text style={[styles.notificationMessage, { color: colors.stone500 }]}>
                    You&apos;ve been added to &quot;{notif.groupName}&quot;
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.notificationDismiss}
                onPress={() => dismissNotification(notif.id)}
              >
                <Ionicons name="close" size={18} color={colors.stone400} />
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
              <Text style={[styles.emptyTitle, { color: colors.stone900 }]}>No groups yet</Text>
              <Text style={[styles.emptySubtitle, { color: colors.stone500 }]}>
                Create a prayer circle or join one with an invite code
              </Text>
              <View style={styles.emptyActions}>
                <TouchableOpacity
                  style={[styles.emptyBtn, { backgroundColor: colors.amber100 }]}
                  onPress={() => setShowCreateModal(true)}
                >
                  <Ionicons name="add-circle-outline" size={20} color={colors.amber700} />
                  <Text style={[styles.emptyBtnText, { color: colors.amber700 }]}>Create Group</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.emptyBtn, { backgroundColor: colors.stone100 }]}
                  onPress={() => setShowJoinModal(true)}
                >
                  <Ionicons name="enter-outline" size={20} color={colors.stone700} />
                  <Text style={[styles.emptyBtnText, { color: colors.stone700 }]}>Join with Code</Text>
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
              ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
              getItemLayout={(_, index) => ({
                length: GROUP_ITEM_HEIGHT,
                offset: GROUP_ITEM_HEIGHT * index,
                index,
              })}
            />
          )}
        </RoundedPage>


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
    </CinematicBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
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
  header: {
    flex: 1,
  },
  kicker: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
    opacity: 0.8,
  },
  heading: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontSize: 32,
    fontWeight: '500',
    letterSpacing: -1.5,
    lineHeight: 34,
    color: '#1c1917',
  },
  headingDot: {
    color: '#f59e0b',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: 4,
  },
  
  // Content styles
  mainContent: {
    flex: 1,
    zIndex: 10,
  },
  list: {
    padding: spacing.lg,
    paddingBottom: 140,
    paddingTop: spacing.md,
  },
  
  // Group Card styles
  groupCard: {
    marginBottom: 0, // Managed by ItemSeparatorComponent
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  groupEmoji: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  groupEmojiText: {
    fontSize: 28,
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    marginBottom: 2,
  },
  groupMembers: {
    fontSize: 13,
    fontWeight: '500',
  },
  groupRightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  ownerBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  ownerBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  groupDesc: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: spacing.md,
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
  },
  groupActions: {
    flexDirection: 'row',
    gap: spacing.md,
    borderTopWidth: 1,
    paddingTop: spacing.md,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 10,
    borderRadius: radius.full,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  leaveBtn: {
    // Custom bg set inline
  },
  leaveBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  
  // Empty State
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
    lineHeight: 22,
  },
  emptyActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderRadius: radius.full,
  },
  emptyBtnText: {
    fontWeight: '700',
    fontSize: 14,
  },
  
  // Notifications
  notificationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f0fdf4',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: '#bbf7d0',
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
  },
  notificationMessage: {
    fontSize: 13,
    marginTop: 2,
  },
  notificationDismiss: {
    padding: spacing.xs,
  },
  
  // Modals (keep existing styles but tidy up)
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
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
    fontSize: 24,
    fontWeight: '700',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  input: {
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16,
    borderWidth: 1,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiOptionActive: {
    borderWidth: 2,
  },
  emojiText: {
    fontSize: 24,
  },
  createButton: {
    paddingVertical: 16,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    alignItems: 'center',
    marginTop: spacing.md,
    ...shadows.glow,
  },
  buttonDisabled: {
    opacity: 0.5,
    
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
});

