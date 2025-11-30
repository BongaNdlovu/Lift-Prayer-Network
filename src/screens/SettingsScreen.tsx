import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  FlatList,
  Modal,
  Platform,
  SafeAreaView,
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
import { palette, radius, spacing } from '../theme/colors';
import { updateUserSettings } from '../services/userProfile';
import { getBlockedUsers, unblockUser, syncBlockedUsers } from '../services/moderation';
import { deletePrayerHistory } from '../services/prayers';
import { db, firebaseEnabled } from '../services/firebase';
import { doc, getDoc } from 'firebase/firestore';

export const SettingsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user, deleteAccount, signOut } = useAuth();
  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deletingHistory, setDeletingHistory] = useState(false);
  
  // Privacy settings
  const [shareProfile, setShareProfile] = useState(false);
  const [showPrayerCount, setShowPrayerCount] = useState(true);

  useEffect(() => {
    loadBlockedUsers();
    loadPrivacySettings();
  }, []);

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

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with Back Button */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={palette.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>
      
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.heading}>Settings & Privacy</Text>

        {/* Privacy Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy</Text>
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="eye-outline" size={22} color={palette.text} />
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>Public Profile</Text>
                <Text style={styles.settingDesc}>Allow others to see your prayer stats</Text>
              </View>
            </View>
            <Switch
              value={shareProfile}
              onValueChange={(val) => handlePrivacyToggle('shareProfile', val)}
              trackColor={{ false: '#e5e7eb', true: '#fde68a' }}
              thumbColor={shareProfile ? '#f59e0b' : '#9ca3af'}
            />
          </View>
        </View>

        {/* Blocked Users Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Blocked Users</Text>
          
          {blockedUsers.length === 0 ? (
            <View style={styles.emptyBlock}>
              <Ionicons name="checkmark-circle-outline" size={32} color={palette.muted} />
              <Text style={styles.emptyText}>No blocked users</Text>
            </View>
          ) : (
            blockedUsers.map((userId) => (
              <View key={userId} style={styles.blockedUser}>
                <View style={styles.blockedAvatar}>
                  <Ionicons name="person" size={18} color={palette.muted} />
                </View>
                <Text style={styles.blockedId} numberOfLines={1}>
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

        {/* Data Management Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data Management</Text>
          
          <TouchableOpacity 
            style={styles.menuItem} 
            onPress={handleDeletePrayerHistory}
            disabled={deletingHistory}
          >
            <Ionicons name="time-outline" size={22} color={palette.text} />
            <View style={{ flex: 1 }}>
              <Text style={styles.menuLabel}>Delete Prayer History</Text>
              <Text style={styles.menuDesc}>Remove all your prayer records</Text>
            </View>
            {deletingHistory ? (
              <ActivityIndicator size="small" color={palette.muted} />
            ) : (
              <Ionicons name="chevron-forward" size={20} color={palette.muted} />
            )}
          </TouchableOpacity>
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          
          <TouchableOpacity style={styles.menuItem} onPress={signOut}>
            <Ionicons name="log-out-outline" size={22} color={palette.text} />
            <Text style={styles.menuLabel}>Sign Out</Text>
            <Ionicons name="chevron-forward" size={20} color={palette.muted} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.dangerItem} onPress={handleDeleteAccount}>
            <Ionicons name="trash-outline" size={22} color="#dc2626" />
            <Text style={styles.dangerLabel}>Delete Account</Text>
            <Ionicons name="chevron-forward" size={20} color="#dc2626" />
          </TouchableOpacity>
        </View>

        {/* Legal Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Legal</Text>
          
          <TouchableOpacity 
            style={styles.menuItem} 
            onPress={() => (navigation as any).navigate('PrivacyPolicy')}
          >
            <Ionicons name="document-text-outline" size={22} color={palette.text} />
            <Text style={styles.menuLabel}>Privacy Policy</Text>
            <Ionicons name="chevron-forward" size={20} color={palette.muted} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity 
            style={styles.menuItem} 
            onPress={() => (navigation as any).navigate('TermsOfService')}
          >
            <Ionicons name="reader-outline" size={22} color={palette.text} />
            <Text style={styles.menuLabel}>Terms of Service</Text>
            <Ionicons name="chevron-forward" size={20} color={palette.muted} />
          </TouchableOpacity>
        </View>

        {/* Data & Privacy Info */}
        <View style={styles.infoSection}>
          <Ionicons name="shield-checkmark-outline" size={24} color={palette.accent} />
          <Text style={styles.infoText}>
            Your data is encrypted and stored securely. We never share your personal information with third parties.
          </Text>
        </View>

        {/* Exit App Button */}
        <TouchableOpacity 
          style={styles.exitButton}
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
          <Ionicons name="exit-outline" size={22} color={palette.muted} />
          <Text style={styles.exitButtonText}>Exit App</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Delete Account Modal */}
      <Modal
        visible={showDeleteModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Delete Account</Text>
              <TouchableOpacity onPress={() => setShowDeleteModal(false)}>
                <Ionicons name="close" size={24} color={palette.muted} />
              </TouchableOpacity>
            </View>

            <View style={styles.warningBox}>
              <Ionicons name="warning" size={24} color="#dc2626" />
              <Text style={styles.warningText}>
                This action is permanent and cannot be undone. All your data will be deleted.
              </Text>
            </View>

            <Text style={styles.inputLabel}>Enter your password to confirm</Text>
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={palette.muted}
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
              <Text style={styles.cancelBtnText}>Cancel</Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.text,
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  heading: {
    fontSize: 24,
    fontWeight: '900',
    color: palette.text,
    padding: spacing.lg,
    paddingBottom: spacing.md,
  },
  section: {
    backgroundColor: '#fff',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: palette.border,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.md,
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
    color: palette.text,
  },
  settingDesc: {
    fontSize: 12,
    color: palette.muted,
  },
  emptyBlock: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  emptyText: {
    color: palette.muted,
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
    color: palette.text,
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
    color: palette.text,
  },
  menuDesc: {
    fontSize: 12,
    color: palette.muted,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: palette.border,
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
    backgroundColor: '#fef3c7',
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
    color: palette.text,
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
    color: palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
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
    color: palette.muted,
  },
  exitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xl,
    paddingVertical: spacing.md,
    backgroundColor: '#f1f5f9',
    borderRadius: radius.md,
  },
  exitButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: palette.muted,
  },
});

