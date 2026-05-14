import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../contexts/ThemeContext';
import { fonts, radius, spacing } from '../theme/colors';
import { LiftScreen, LiftHeader } from '../components/LiftLayout';
import { updateUserSettings } from '../services/userProfile';
import { getBlockedUsers, unblockUser, syncBlockedUsers } from '../services/moderation';
import { deletePrayerHistory } from '../services/prayers';
import { db, firebaseEnabled } from '../services/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { hasAdminPermission, hasModeratorPermission } from '../config/admins';
import { useNetInfo } from '@react-native-community/netinfo';
import { 
  getPendingActionCounts, 
  clearAllCache,
  type PendingActionCounts 
} from '../services/offlineCache';
import { syncPendingActions } from '../services/syncService';

export const SettingsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user, deleteAccount, signOut } = useAuth();
  const { isDark, themeMode, setThemeMode, colors } = useTheme();
  const netInfo = useNetInfo();
  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deletingHistory, setDeletingHistory] = useState(false);
  
  // Privacy settings
  const [shareProfile, setShareProfile] = useState(false);
  
  // Sync state
  const [pendingCounts, setPendingCounts] = useState<PendingActionCounts>({ 
    prayers: 0, requests: 0, comments: 0, reactions: 0, promises: 0, total: 0 
  });
  const [syncing, setSyncing] = useState(false);

  const isOnline = netInfo.isConnected !== false;

  useEffect(() => {
    loadBlockedUsers();
    loadPrivacySettings();
    loadPendingCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadPendingCounts = async () => {
    const counts = await getPendingActionCounts();
    setPendingCounts(counts);
  };

  const loadBlockedUsers = async () => {
    if (user) {
      await syncBlockedUsers(user.uid);
    }
    const blocked = await getBlockedUsers();
    setBlockedUsers(blocked);
  };

  const loadPrivacySettings = async () => {
    if (!user || !firebaseEnabled || !db) return;
    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (snap.exists()) {
        const settings = (snap.data() as any)?.settings || {};
        if (settings.shareProfile !== undefined) {
          setShareProfile(!!settings.shareProfile);
        }
      }
    } catch (err) {
      console.warn('[Settings] Could not load privacy settings', err);
    }
  };

  const handleUnblock = async (blockedUserId: string) => {
    if (!user) return;
    
    Alert.alert(
      'Unblock User',
      'Are you sure you want to unblock this user?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: async () => {
            await unblockUser(user.uid, blockedUserId);
            setBlockedUsers((prev) => prev.filter((id) => id !== blockedUserId));
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    if (!user) return;
    
    if (user.isAnonymous) {
      // Anonymous users can delete without password
      Alert.alert(
        'Delete Account',
        'This will permanently delete your guest account and all associated data. This cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteAccount();
              } catch (err: any) {
                Alert.alert('Error', err.message || 'Could not delete account');
              }
            },
          },
        ]
      );
    } else {
      // Email/password users need to enter password
      setShowDeleteModal(true);
    }
  };

  const confirmDelete = async () => {
    if (!deletePassword.trim()) {
      Alert.alert('Password Required', 'Please enter your password to confirm deletion.');
      return;
    }

    setDeleting(true);
    try {
      await deleteAccount(deletePassword);
      setShowDeleteModal(false);
    } catch (err: any) {
      if (err.code === 'auth/wrong-password') {
        Alert.alert('Wrong Password', 'The password you entered is incorrect.');
      } else {
        Alert.alert('Error', err.message || 'Could not delete account');
      }
    } finally {
      setDeleting(false);
    }
  };

  const handlePrivacyToggle = async (setting: string, value: boolean) => {
    if (!user) return;
    
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }

    if (setting === 'shareProfile') {
      setShareProfile(value);
      await updateUserSettings(user, { shareProfile: value });
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (err: any) {
      if (err?.message === 'PENDING_DATA') {
        Alert.alert(
          'Unsynced Data',
          `You have ${err.pendingPrayers ?? 0} prayers and ${err.pendingRequests ?? 0} requests that haven't been synced. Sign out anyway?`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign Out', style: 'destructive', onPress: () => signOut(true) },
          ]
        );
      } else {
        Alert.alert('Error', err?.message || 'Could not sign out');
      }
    }
  };

  const handleDeletePrayerHistory = () => {
    if (!user) return;

    Alert.alert(
      'Delete Prayer History',
      'This will permanently delete all your prayer history records. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            setDeletingHistory(true);
            try {
              await deletePrayerHistory(user.uid);
              if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
              Alert.alert('Deleted', 'Your prayer history has been deleted.');
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Could not delete prayer history');
            } finally {
              setDeletingHistory(false);
            }
          },
        },
      ]
    );
  };

  const handleForceSync = async () => {
    if (!user || !isOnline) {
      Alert.alert('Offline', 'You need to be online to sync.');
      return;
    }

    setSyncing(true);
    try {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      
      const result = await syncPendingActions(user);
      await loadPendingCounts();
      
      const totalSynced = result.synced.prayers + result.synced.requests + 
                          result.synced.comments + result.synced.reactions + result.synced.promises;
      
      if (result.success && totalSynced > 0) {
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        Alert.alert('Synced!', `Successfully synced ${totalSynced} action${totalSynced !== 1 ? 's' : ''}.`);
      } else if (totalSynced === 0) {
        Alert.alert('All Synced', 'No pending actions to sync.');
      } else {
        Alert.alert('Partial Sync', `Synced ${totalSynced} actions. Some failed - will retry later.`);
      }
    } catch (err: any) {
      Alert.alert('Sync Failed', err.message || 'Could not sync pending actions');
    } finally {
      setSyncing(false);
    }
  };

  const handleClearCache = async () => {
    Alert.alert(
      'Clear Cache',
      'This will clear all cached data. Pending actions will be lost. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await clearAllCache();
            await loadPendingCounts();
            if (Platform.OS !== 'web') {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
            Alert.alert('Cleared', 'Cache has been cleared.');
          },
        },
      ]
    );
  };

  // Dynamic styles based on theme
  const dynamicStyles = useMemo(() => ({
    container: { backgroundColor: colors.background },
    header: { borderBottomColor: colors.border },
    backButton: { backgroundColor: isDark ? colors.surface : '#f1f5f9' },
    section: { backgroundColor: colors.surface, borderColor: colors.border },
    heading: { color: colors.text },
    headerTitle: { color: colors.text },
    sectionTitle: { color: colors.muted },
    settingLabel: { color: colors.text },
    settingDesc: { color: colors.muted },
    menuLabel: { color: colors.text },
    menuDesc: { color: colors.muted },
    blockedId: { color: colors.text },
    blockedAvatar: { backgroundColor: isDark ? colors.surface : '#f1f5f9' },
    emptyText: { color: colors.muted },
    divider: { backgroundColor: colors.border },
    modalContent: { backgroundColor: colors.surface },
    modalTitle: { color: colors.text },
    inputLabel: { color: colors.muted },
    input: { backgroundColor: isDark ? colors.background : '#FAF8F5', color: colors.text, borderColor: colors.border },
    cancelBtnText: { color: colors.muted },
    exitButton: { backgroundColor: isDark ? colors.surface : '#f1f5f9' },
    exitButtonText: { color: colors.muted },
    infoSection: { backgroundColor: isDark ? colors.accentLight : '#F7F1E8' },
    infoText: { color: isDark ? colors.accent : '#92400e' },
  }), [colors, isDark]);

  return (
    <>
    <LiftScreen scroll>
      <LiftHeader title="Settings" subtitle="Preferences and account settings" onBack={() => navigation.goBack()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* Appearance Section */}
        <View style={[styles.section, dynamicStyles.section]}>
          <Text style={[styles.sectionTitle, dynamicStyles.sectionTitle]}>Appearance</Text>
          
          <View style={styles.themeSelector}>
            <TouchableOpacity
              style={[styles.themeOption, { backgroundColor: isDark ? colors.surface : '#f1f5f9' }, themeMode === 'light' && styles.themeOptionActive]}
              onPress={() => setThemeMode('light')}
            >
              <Ionicons name="sunny" size={20} color={themeMode === 'light' ? '#4A5D4E' : colors.muted} />
              <Text style={[styles.themeOptionText, { color: colors.muted }, themeMode === 'light' && styles.themeOptionTextActive]}>Light</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.themeOption, { backgroundColor: isDark ? colors.surface : '#f1f5f9' }, themeMode === 'system' && styles.themeOptionActive]}
              onPress={() => setThemeMode('system')}
            >
              <Ionicons name="phone-portrait" size={20} color={themeMode === 'system' ? '#4A5D4E' : colors.muted} />
              <Text style={[styles.themeOptionText, { color: colors.muted }, themeMode === 'system' && styles.themeOptionTextActive]}>System</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Privacy Section */}
        <View style={[styles.section, dynamicStyles.section]}>
          <Text style={[styles.sectionTitle, dynamicStyles.sectionTitle]}>Privacy</Text>
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="eye-outline" size={22} color={colors.text} />
              <View style={styles.settingText}>
                <Text style={[styles.settingLabel, dynamicStyles.settingLabel]}>Public Profile</Text>
                <Text style={[styles.settingDesc, dynamicStyles.settingDesc]}>Allow others to see your prayer stats</Text>
              </View>
            </View>
            <Switch
              value={shareProfile}
              onValueChange={(val) => handlePrivacyToggle('shareProfile', val)}
              trackColor={{ false: '#e5e7eb', true: '#fde68a' }}
              thumbColor={shareProfile ? '#4A5D4E' : '#9ca3af'}
            />
          </View>
        </View>

        {/* Blocked Users Section */}
        <View style={[styles.section, dynamicStyles.section]}>
          <Text style={[styles.sectionTitle, dynamicStyles.sectionTitle]}>Blocked Users</Text>
          
          {blockedUsers.length === 0 ? (
            <View style={styles.emptyBlock}>
              <Ionicons name="checkmark-circle-outline" size={32} color={colors.muted} />
              <Text style={[styles.emptyText, dynamicStyles.emptyText]}>No blocked users</Text>
            </View>
          ) : (
            blockedUsers.map((userId) => (
              <View key={userId} style={styles.blockedUser}>
                <View style={[styles.blockedAvatar, dynamicStyles.blockedAvatar]}>
                  <Ionicons name="person" size={18} color={colors.muted} />
                </View>
                <Text style={[styles.blockedId, dynamicStyles.blockedId]} numberOfLines={1}>
                  User {userId.slice(0, 8)}...
                </Text>
                <TouchableOpacity
                  style={styles.unblockBtn}
                  onPress={() => handleUnblock(userId)}
                >
                  <Text style={styles.unblockText}>Unblock</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        {/* Admin/Moderator Section */}
        {hasModeratorPermission(user?.email) && (
          <View style={[styles.section, dynamicStyles.section]}>
            <Text style={[styles.sectionTitle, dynamicStyles.sectionTitle]}>
              {hasAdminPermission(user?.email) ? 'Admin' : 'Moderator'}
            </Text>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => navigation.navigate('AdminDashboard' as never)}
            >
              <Ionicons name="shield-checkmark-outline" size={22} color={colors.text} />
              <View style={styles.settingText}>
                <Text style={[styles.settingLabel, dynamicStyles.settingLabel]}>
                  {hasAdminPermission(user?.email) ? 'Admin Tools' : 'Moderator Tools'}
                </Text>
                <Text style={[styles.settingDesc, dynamicStyles.settingDesc]}>
                  {hasAdminPermission(user?.email) 
                    ? 'Access reports, pinned requests, and global stats' 
                    : 'Review reports, delete content, and block users'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Sync & Cache Section */}
        <View style={[styles.section, dynamicStyles.section]}>
          <Text style={[styles.sectionTitle, dynamicStyles.sectionTitle]}>Sync & Cache</Text>
          
          {/* Offline Status */}
          {!isOnline && (
            <View style={[styles.offlineBanner, { backgroundColor: isDark ? '#7f1d1d' : '#fef2f2' }]}>
              <Ionicons name="cloud-offline-outline" size={18} color={isDark ? '#fecaca' : '#dc2626'} />
              <Text style={[styles.offlineText, { color: isDark ? '#fecaca' : '#991b1b' }]}>
                You&apos;re offline
              </Text>
            </View>
          )}
          
          {/* Pending Actions Count */}
          {pendingCounts.total > 0 && (
            <View style={styles.pendingInfo}>
              <Ionicons name="hourglass-outline" size={18} color={colors.accent} />
              <Text style={[styles.pendingText, { color: colors.text }]}>
                {pendingCounts.total} pending action{pendingCounts.total !== 1 ? 's' : ''}
              </Text>
            </View>
          )}
          
          <TouchableOpacity 
            style={styles.menuItem} 
            onPress={handleForceSync}
            disabled={syncing || !isOnline}
          >
            <Ionicons name="sync-outline" size={22} color={isOnline ? colors.text : colors.muted} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.menuLabel, { color: isOnline ? colors.text : colors.muted }]}>Force Sync</Text>
              <Text style={[styles.menuDesc, dynamicStyles.menuDesc]}>Sync all pending actions now</Text>
            </View>
            {syncing ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <Ionicons name="chevron-forward" size={20} color={colors.muted} />
            )}
          </TouchableOpacity>

          <View style={[styles.divider, dynamicStyles.divider]} />

          <TouchableOpacity 
            style={styles.menuItem} 
            onPress={handleClearCache}
          >
            <Ionicons name="trash-bin-outline" size={22} color={colors.text} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.menuLabel, dynamicStyles.menuLabel]}>Clear Cache</Text>
              <Text style={[styles.menuDesc, dynamicStyles.menuDesc]}>Clear cached data and pending actions</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </TouchableOpacity>
        </View>

        {/* Data Management Section */}
        <View style={[styles.section, dynamicStyles.section]}>
          <Text style={[styles.sectionTitle, dynamicStyles.sectionTitle]}>Data Management</Text>
          
          <TouchableOpacity 
            style={styles.menuItem} 
            onPress={handleDeletePrayerHistory}
            disabled={deletingHistory}
          >
            <Ionicons name="time-outline" size={22} color={colors.text} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.menuLabel, dynamicStyles.menuLabel]}>Delete Prayer History</Text>
              <Text style={[styles.menuDesc, dynamicStyles.menuDesc]}>Remove all your prayer records</Text>
            </View>
            {deletingHistory ? (
              <ActivityIndicator size="small" color={colors.muted} />
            ) : (
              <Ionicons name="chevron-forward" size={20} color={colors.muted} />
            )}
          </TouchableOpacity>
        </View>

        {/* Account Section */}
        <View style={[styles.section, dynamicStyles.section]}>
          <Text style={[styles.sectionTitle, dynamicStyles.sectionTitle]}>Account</Text>
          
          <TouchableOpacity style={styles.menuItem} onPress={handleSignOut}>
            <Ionicons name="log-out-outline" size={22} color={colors.text} />
            <Text style={[styles.menuLabel, dynamicStyles.menuLabel]}>Sign Out</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </TouchableOpacity>

          <View style={[styles.divider, dynamicStyles.divider]} />

          <TouchableOpacity style={styles.dangerItem} onPress={handleDeleteAccount}>
            <Ionicons name="trash-outline" size={22} color="#dc2626" />
            <Text style={styles.dangerLabel}>Delete Account</Text>
            <Ionicons name="chevron-forward" size={20} color="#dc2626" />
          </TouchableOpacity>
        </View>

        {/* Legal Section */}
        <View style={[styles.section, dynamicStyles.section]}>
          <Text style={[styles.sectionTitle, dynamicStyles.sectionTitle]}>Legal</Text>
          
          <TouchableOpacity 
            style={styles.menuItem} 
            onPress={() => (navigation as any).navigate('PrivacyPolicy')}
          >
            <Ionicons name="document-text-outline" size={22} color={colors.text} />
            <Text style={[styles.menuLabel, dynamicStyles.menuLabel]}>Privacy Policy</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </TouchableOpacity>

          <View style={[styles.divider, dynamicStyles.divider]} />

          <TouchableOpacity 
            style={styles.menuItem} 
            onPress={() => (navigation as any).navigate('TermsOfService')}
          >
            <Ionicons name="reader-outline" size={22} color={colors.text} />
            <Text style={[styles.menuLabel, dynamicStyles.menuLabel]}>Terms of Service</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </TouchableOpacity>
        </View>

        {/* Data & Privacy Info */}
        <View style={[styles.infoSection, dynamicStyles.infoSection]}>
          <Ionicons name="shield-checkmark-outline" size={24} color={colors.accent} />
          <Text style={[styles.infoText, dynamicStyles.infoText]}>
            Your data is encrypted and stored securely. We never share your personal information with third parties.
          </Text>
        </View>

        {/* Exit App Button */}
        <TouchableOpacity 
          style={[styles.exitButton, dynamicStyles.exitButton]}
          onPress={() => {
            Alert.alert(
              'Exit App',
              'Are you sure you want to exit the app?',
              [
                { text: 'Cancel', style: 'cancel' },
                { 
                  text: 'Exit', 
                  style: 'destructive',
                  onPress: () => {
                    try {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    } catch {}
                    BackHandler.exitApp();
                  }
                },
              ]
            );
          }}
        >
          <Ionicons name="exit-outline" size={22} color={colors.muted} />
          <Text style={[styles.exitButtonText, dynamicStyles.exitButtonText]}>Exit App</Text>
        </TouchableOpacity>
          </ScrollView>
    </LiftScreen>

    {/* Delete Account Modal */}
    <Modal
        visible={showDeleteModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, dynamicStyles.modalContent]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, dynamicStyles.modalTitle]}>Delete Account</Text>
              <TouchableOpacity onPress={() => setShowDeleteModal(false)}>
                <Ionicons name="close" size={24} color={colors.muted} />
              </TouchableOpacity>
            </View>

            <View style={styles.warningBox}>
              <Ionicons name="warning" size={24} color="#dc2626" />
              <Text style={styles.warningText}>
                This action is permanent and cannot be undone. All your data will be deleted.
              </Text>
            </View>

            <Text style={[styles.inputLabel, dynamicStyles.inputLabel]}>Enter your password to confirm</Text>
            <TextInput
              style={[styles.input, dynamicStyles.input]}
              placeholder="Password"
              placeholderTextColor={colors.muted}
              secureTextEntry
              value={deletePassword}
              onChangeText={setDeletePassword}
            />

            <TouchableOpacity
              style={[styles.deleteBtn, !deletePassword.trim() && styles.deleteBtnDisabled]}
              onPress={confirmDelete}
              disabled={!deletePassword.trim() || deleting}
            >
              <Text style={styles.deleteBtnText}>
                {deleting ? 'Deleting...' : 'Permanently Delete Account'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setShowDeleteModal(false)}
            >
              <Text style={[styles.cancelBtnText, dynamicStyles.cancelBtnText]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
        </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  heading: {
    fontFamily: fonts.heading,
    fontSize: 32,
    fontWeight: '500',
    letterSpacing: -1.5,
    lineHeight: 34,
    color: '#2C332E',
  },
  
  // Content styles
  mainContent: {
    flex: 1,
    zIndex: 10,
  },
  scrollContent: {
    paddingBottom: 140,
  },
  
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  section: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.md,
  },
  themeSelector: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  themeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: '#f1f5f9',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  themeOptionActive: {
    backgroundColor: '#F7F1E8',
    borderColor: '#4A5D4E',
  },
  themeOptionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  themeOptionTextActive: {
    color: '#92400e',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.md,
  },
  settingText: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  settingDesc: {
    fontSize: 12,
  },
  emptyBlock: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  emptyText: {
    fontSize: 14,
  },
  blockedUser: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  blockedAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockedId: {
    flex: 1,
    fontSize: 14,
  },
  unblockBtn: {
    backgroundColor: '#fef2f2',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  unblockText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#dc2626',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  menuLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  menuDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginVertical: spacing.sm,
  },
  dangerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  dangerLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#dc2626',
  },
  infoSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xl,
    padding: spacing.lg,
    backgroundColor: '#F7F1E8',
    borderRadius: radius.lg,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#92400e',
    lineHeight: 20,
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
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    backgroundColor: '#fef2f2',
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: '#991b1b',
    lineHeight: 20,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  input: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16,
    borderWidth: 1,
    marginBottom: spacing.lg,
  },
  deleteBtn: {
    backgroundColor: '#dc2626',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  deleteBtnDisabled: {
    opacity: 0.5,
  },
  deleteBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },
  cancelBtn: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  cancelBtnText: {
    fontSize: 16,
    fontWeight: '600',
  },
  exitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  exitButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.sm,
    marginBottom: spacing.md,
  },
  offlineText: {
    fontSize: 13,
    fontWeight: '600',
  },
  pendingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  pendingText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
