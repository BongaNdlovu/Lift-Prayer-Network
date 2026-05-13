import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
  Alert,
  TextInput,
  Modal,
  Platform,
  Image,
  ActivityIndicator,
} from 'react-native';
import { doc, getDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../contexts/ThemeContext';
import { fonts, radius, spacing } from '../theme/colors';
import { LiftScreen } from '../components/LiftLayout';
import { db, firebaseEnabled } from '../services/firebase';
import { registerForPushNotifications, setupNotificationHandler, storePushToken } from '../services/notifications';
import { updateUserSettings, updateUserProfile } from '../services/userProfile';
import { deleteProfilePhoto, uploadProfilePhoto } from '../services/profilePhotos';
import { RootStackParamList } from '../navigation/types';
import { getVerifiedBadge, BADGE_STYLES, hasAdminPermission } from '../config/admins';
import { validateDisplayName, validateEmail } from '../utils/security';
import { PrayerStreakWidget } from '../components/PrayerStreakWidget';

export const ProfileScreen: React.FC = () => {
  const { user, signOut, resendVerification, linkGuestToEmail } = useAuth();
  const { colors } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [pushEnabled, setPushEnabled] = useState(false);
  const [upgradeName, setUpgradeName] = useState('');
  const [upgradeEmail, setUpgradeEmail] = useState('');
  const [upgradePassword, setUpgradePassword] = useState('');
  const [busyUpgrade, setBusyUpgrade] = useState(false);
  const [verifying, setVerifying] = useState(false);
  
  // Profile editing state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);
  
  // Profile picture state
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const isAdminUser = hasAdminPermission(user?.email);
  const [streakData, setStreakData] = useState({
    currentStreak: 0,
    longestStreak: 0,
    lastPrayedDate: undefined as string | undefined,
  });

  useEffect(() => {
    setupNotificationHandler();
  }, []);

  // Load profile image from user data
  useEffect(() => {
    if (user?.photoURL) {
      setProfileImage(user.photoURL);
    }
  }, [user?.photoURL]);

  const pickProfileImage = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    // Request permission
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please allow access to your photo library to change your profile picture.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Launch image picker
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1, // Keep quality, we'll resize
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      
      setUploadingImage(true);
      try {
        if (!user) {
          throw new Error('User not logged in');
        }

        const photoURL = await uploadProfilePhoto(user.uid, asset.uri);
        
        // Update Firebase Auth profile
        await updateProfile(user, { photoURL });
        
        // Update Firestore user profile
        await updateUserProfile(user.uid, { photoURL });
        
        setProfileImage(photoURL);
        
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        
        Alert.alert('Success', 'Profile picture updated! 📸');
      } catch (err: any) {
        console.error('[Profile] Error updating photo:', err);
        Alert.alert('Error', err.message || 'Could not update profile picture. Please try again.');
      } finally {
        setUploadingImage(false);
      }
    }
  };

  const removeProfileImage = async () => {
    if (!user) return;
    
    Alert.alert(
      'Remove Photo',
      'Are you sure you want to remove your profile picture?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setUploadingImage(true);
            try {
              await deleteProfilePhoto(user.uid);
              await updateProfile(user, { photoURL: null });
              await updateUserProfile(user.uid, { photoURL: null });
              setProfileImage(null);
              Alert.alert('Removed', 'Profile picture removed.');
            } catch {
              Alert.alert('Error', 'Could not remove profile picture.');
            } finally {
              setUploadingImage(false);
            }
          },
        },
      ]
    );
  };

  useEffect(() => {
    const loadSettings = async () => {
      if (!user || !firebaseEnabled || !db) return;
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (snap.exists()) {
        const settings = (snap.data() as any).settings;
        if (settings?.notificationsCritical !== undefined) {
          setPushEnabled(!!settings.notificationsCritical);
        }
        const stats = (snap.data() as any).stats || {};
        setStreakData({
          currentStreak: stats.streakDays || 0,
          longestStreak: stats.longestStreak || 0,
          lastPrayedDate: stats.streakLastDate,
        });
      }
    };
    loadSettings();
  }, [user]);

  const togglePush = async (next: boolean) => {
    if (!user) return;
    if (next) {
      const registration = await registerForPushNotifications();
      if (registration.status !== 'granted' || !registration.expoPushToken) {
        Alert.alert('Permission needed', 'Enable notifications in settings to subscribe.');
        return;
      }
      await storePushToken(user.uid, registration.expoPushToken, registration.devicePushToken);
      await updateUserSettings(user, {
        notificationsCritical: true,
        notifications: true,
      });
      setPushEnabled(true);
    } else {
      await updateUserSettings(user, { notificationsCritical: false });
      setPushEnabled(false);
    }
  };

  const handleEditProfile = () => {
    setEditName(user?.displayName || '');
    setShowEditModal(true);
  };

  const openPhotoActions = () => {
    if (!user || uploadingImage) return;

    Alert.alert(
      'Profile Photo',
      undefined,
      profileImage
        ? [
            { text: 'Change Photo', onPress: pickProfileImage },
            { text: 'Remove Photo', style: 'destructive', onPress: removeProfileImage },
            { text: 'Cancel', style: 'cancel' },
          ]
        : [
            { text: 'Change Photo', onPress: pickProfileImage },
            { text: 'Cancel', style: 'cancel' },
          ],
    );
  };

  const handleSaveProfile = async () => {
    if (!user || !editName.trim()) return;
    const nameValidation = validateDisplayName(editName);
    if (!nameValidation.isValid) {
      Alert.alert('Invalid Name', nameValidation.error || 'Please choose a different display name.');
      return;
    }
    const sanitizedName = nameValidation.sanitized || editName.trim();
    
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    
    setSaving(true);
    try {
      // Update Firebase Auth profile
      await updateProfile(user, { displayName: sanitizedName });
      
      // Update Firestore user profile
      await updateUserProfile(user.uid, { displayName: sanitizedName });
      
      setShowEditModal(false);
      Alert.alert('Success', 'Profile updated!');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not update profile');
    } finally {
      setSaving(false);
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

  return (
    <LiftScreen scroll>
      <View style={styles.headerSection}>
        <View>
          <Text style={[styles.kicker, { color: colors.muted }]}>YOUR ACCOUNT</Text>
          <Text style={styles.heading}>
            Profile<Text style={styles.headingDot}>.</Text>
          </Text>
        </View>
        {user && (
          <TouchableOpacity
            onPress={handleEditProfile}
            style={[styles.iconButton, { backgroundColor: colors.amber100, borderColor: colors.amber200 }]}
          >
            <Ionicons name="pencil" size={20} color={colors.amber700} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.mainContent}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* Profile Avatar */}
        {user && (
          <View style={styles.avatarSection}>
            <TouchableOpacity 
              style={styles.avatarContainer}
              onPress={openPhotoActions}
              disabled={uploadingImage}
            >
              {profileImage ? (
                <Image source={{ uri: profileImage }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {(user.displayName || 'G')[0].toUpperCase()}
                  </Text>
                </View>
              )}
              
              {/* Camera badge */}
              <View style={styles.cameraBadge}>
                {uploadingImage ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="camera" size={14} color="#fff" />
                )}
              </View>
            </TouchableOpacity>
            
            <View style={styles.nameRowProfile}>
              <Text style={[styles.displayName, { color: colors.text }]}>{user.displayName || 'Guest'}</Text>
              {(() => {
                const badge = getVerifiedBadge(user.email);
                const badgeStyle = badge ? BADGE_STYLES[badge.badgeType] : null;
                // Show admin/moderator badge with label
                if (badge && badgeStyle) {
                  return (
                    <View style={[styles.verifiedBadgeProfile, { backgroundColor: badgeStyle.backgroundColor }]}>
                      <Ionicons name="checkmark-circle" size={12} color={badgeStyle.textColor} />
                      <Text style={[styles.verifiedBadgeTextProfile, { color: badgeStyle.textColor }]}>
                        {badge.badgeLabel}
                      </Text>
                    </View>
                  );
                }
                // Show email verified tick for regular users
                if (!user.isAnonymous && user.emailVerified) {
                  return (
                    <Ionicons name="checkmark-circle" size={16} color="#16a34a" style={{ marginLeft: 4 }} />
                  );
                }
                return null;
              })()}
            </View>
            <Text style={[styles.email, { color: colors.muted }]}>{user.email || (user.isAnonymous ? 'Guest account' : 'No email')}</Text>
            
          </View>
        )}

        {user && (
          <PrayerStreakWidget
            currentStreak={streakData.currentStreak}
            longestStreak={streakData.longestStreak}
            lastPrayedDate={streakData.lastPrayedDate}
            onPress={() => navigation.navigate('Stats')}
          />
        )}

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.infoRow}>
            <Ionicons name="person-outline" size={20} color={colors.muted} />
            <View style={styles.infoContent}>
              <Text style={[styles.label, { color: colors.muted }]}>Display Name</Text>
              <Text style={[styles.value, { color: colors.text }]}>{user?.displayName || 'Guest'}</Text>
            </View>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={20} color={colors.muted} />
            <View style={styles.infoContent}>
              <Text style={[styles.label, { color: colors.muted }]}>Email</Text>
              <Text style={[styles.value, { color: colors.text }]}>{user?.email || 'Not set'}</Text>
            </View>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.infoRow}>
            <Ionicons name="shield-checkmark-outline" size={20} color={colors.muted} />
            <View style={styles.infoContent}>
              <Text style={[styles.label, { color: colors.muted }]}>Account Type</Text>
              <Text style={[styles.value, { color: colors.text }]}>
                {user?.isAnonymous ? 'Guest' : user?.providerData?.[0]?.providerId === 'google.com' ? 'Google' : 'Email'}
              </Text>
            </View>
          </View>
        </View>
      {user?.isAnonymous && (
        <View style={styles.card}>
          <TextInput
            style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
            placeholder="Display name"
            placeholderTextColor={colors.muted}
            value={upgradeName}
            onChangeText={setUpgradeName}
            editable={!busyUpgrade}
          />
          <TextInput
            style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
            placeholder="Email"
            placeholderTextColor={colors.muted}
            value={upgradeEmail}
            onChangeText={setUpgradeEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!busyUpgrade}
          />
          <TextInput
            style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
            placeholder="Password"
            placeholderTextColor={colors.muted}
            value={upgradePassword}
            onChangeText={setUpgradePassword}
            secureTextEntry
            editable={!busyUpgrade}
          />
          <TouchableOpacity
            style={styles.button}
            onPress={async () => {
              if (!upgradeEmail || !upgradePassword) {
                Alert.alert('Missing info', 'Email and password required.');
                return;
              }
              const nameValidation = validateDisplayName(upgradeName);
              if (!nameValidation.isValid) {
                Alert.alert('Invalid Name', nameValidation.error || 'Please choose a different display name.');
                return;
              }
              const emailValidation = validateEmail(upgradeEmail);
              if (!emailValidation.isValid) {
                Alert.alert('Invalid Email', emailValidation.error || 'Please enter a valid email address.');
                return;
              }
              setBusyUpgrade(true);
              try {
                const sanitizedName = nameValidation.sanitized || upgradeName.trim();
                const sanitizedEmail = emailValidation.sanitized || upgradeEmail.trim();
                await linkGuestToEmail(sanitizedName, sanitizedEmail, upgradePassword);
                Alert.alert('Upgraded', 'Account linked. Please verify your email.');
              } catch (err: any) {
                Alert.alert('Upgrade failed', err.message ?? 'Try again.');
              } finally {
                setBusyUpgrade(false);
              }
            }}
            disabled={busyUpgrade}
          >
            <Text style={styles.buttonText}>{busyUpgrade ? 'Linking...' : 'Link account'}</Text>
          </TouchableOpacity>
        </View>
      )}
      {/* Email Verification Status */}
      {user && !user.isAnonymous && user.email && (
        <View style={[styles.card, { backgroundColor: user.emailVerified ? colors.successLight : '#fef2f2' }]}>
          <View style={styles.row}>
            <Ionicons 
              name={user.emailVerified ? "checkmark-circle" : "alert-circle"} 
              size={24} 
              color={user.emailVerified ? colors.success : "#dc2626"} 
            />
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <Text style={[styles.label, { color: user.emailVerified ? colors.success : "#dc2626" }]}>
                {user.emailVerified ? 'Email Verified ✓' : 'Email Not Verified'}
              </Text>
              <Text style={[styles.value, { color: colors.muted, fontSize: 12 }]}>
                {user.emailVerified 
                  ? 'Your account is verified and trusted' 
                  : 'Verify your email to get a verified badge'}
              </Text>
            </View>
          </View>
          {!user.emailVerified && (
            <TouchableOpacity
              style={[styles.button, { marginTop: spacing.sm, backgroundColor: '#dc2626' }]}
              onPress={async () => {
                setVerifying(true);
                try {
                  await resendVerification();
                  Alert.alert(
                    'Verification Email Sent! 📧',
                    'Check your inbox (and spam folder) for the verification link. After clicking it, come back and refresh your profile.',
                    [{ text: 'OK' }]
                  );
                } catch (err: any) {
                  Alert.alert('Failed to send', err.message ?? 'Try again.');
                } finally {
                  setVerifying(false);
                }
              }}
              disabled={verifying}
            >
              <Text style={[styles.buttonText, { color: '#fff' }]}>
                {verifying ? 'Sending...' : 'Send Verification Email'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      {user && (
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Critical alerts</Text>
              <Text style={styles.value}>Notify me for critical requests</Text>
            </View>
            <Switch value={pushEnabled} onValueChange={togglePush} />
          </View>
        </View>
      )}

      {/* Feature Menu */}
      {user && (
        <View style={[styles.menuCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.menuHeading, { color: colors.muted }]}>Features</Text>
          
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('MyPrayers')}
          >
            <View style={[styles.menuIcon, { backgroundColor: '#fef3c7' }]}>
              <Ionicons name="bookmark" size={20} color="#4A5D4E" />
            </View>
            <View style={styles.menuContent}>
              <Text style={[styles.menuTitle, { color: colors.text }]}>My Prayers</Text>
              <Text style={[styles.menuSubtitle, { color: colors.muted }]}>View your requests & testimonies</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </TouchableOpacity>

          <View style={styles.menuDivider} />
          
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('People')}
          >
            <View style={[styles.menuIcon, { backgroundColor: '#dcfce7' }]}>
              <Ionicons name="heart" size={20} color="#22c55e" />
            </View>
            <View style={styles.menuContent}>
              <Text style={styles.menuTitle}>People I Prayed For</Text>
              <Text style={styles.menuSubtitle}>Track your prayer connections</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('Following')}
          >
            <View style={[styles.menuIcon, { backgroundColor: '#ede9fe' }]}>
              <Ionicons name="people" size={20} color="#8b5cf6" />
            </View>
            <View style={styles.menuContent}>
              <Text style={styles.menuTitle}>Following</Text>
              <Text style={styles.menuSubtitle}>Manage users you follow</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('History')}
          >
            <View style={[styles.menuIcon, { backgroundColor: '#e0f2fe' }]}>
              <Ionicons name="time-outline" size={20} color="#0ea5e9" />
            </View>
            <View style={styles.menuContent}>
              <Text style={styles.menuTitle}>Prayer History</Text>
              <Text style={styles.menuSubtitle}>View all your prayers</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('Achievements')}
          >
            <View style={[styles.menuIcon, { backgroundColor: '#fef3c7' }]}>
              <Ionicons name="trophy" size={20} color="#4A5D4E" />
            </View>
            <View style={styles.menuContent}>
              <Text style={styles.menuTitle}>Achievements</Text>
              <Text style={styles.menuSubtitle}>View your badges and progress</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('Reminders')}
          >
            <View style={[styles.menuIcon, { backgroundColor: '#dbeafe' }]}>
              <Ionicons name="alarm" size={20} color="#3b82f6" />
            </View>
            <View style={styles.menuContent}>
              <Text style={styles.menuTitle}>Prayer Reminders</Text>
              <Text style={styles.menuSubtitle}>Set daily prayer notifications</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('NotificationsSettings')}
          >
            <View style={[styles.menuIcon, { backgroundColor: '#fef3c7' }]}>
              <Ionicons name="notifications" size={20} color="#4A5D4E" />
            </View>
            <View style={styles.menuContent}>
              <Text style={styles.menuTitle}>Notification Settings</Text>
              <Text style={styles.menuSubtitle}>Customize your alerts</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('Settings')}
          >
            <View style={[styles.menuIcon, { backgroundColor: '#f1f5f9' }]}>
              <Ionicons name="settings-outline" size={20} color="#64748b" />
            </View>
            <View style={styles.menuContent}>
              <Text style={styles.menuTitle}>Settings & Privacy</Text>
              <Text style={styles.menuSubtitle}>Account, blocked users, data</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </TouchableOpacity>

          {isAdminUser && (
            <>
              <View style={styles.menuDivider} />
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => navigation.navigate('AdminReports')}
              >
                <View style={[styles.menuIcon, { backgroundColor: '#e0f2fe' }]}>
                  <Ionicons name="shield-checkmark" size={20} color="#2563eb" />
                </View>
                <View style={styles.menuContent}>
                  <Text style={styles.menuTitle}>Moderation Reports</Text>
                  <Text style={styles.menuSubtitle}>Review community flags</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.muted} />
              </TouchableOpacity>
            </>
          )}

          <View style={styles.menuDivider} />

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('Help')}
          >
            <View style={[styles.menuIcon, { backgroundColor: '#fef3c7' }]}>
              <Ionicons name="help-circle" size={20} color="#4A5D4E" />
            </View>
            <View style={styles.menuContent}>
              <Text style={styles.menuTitle}>Help & Tutorial</Text>
              <Text style={styles.menuSubtitle}>Learn how to use Lift</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('Donation')}
          >
            <View style={[styles.menuIcon, { backgroundColor: '#fce7f3' }]}>
              <Ionicons name="heart" size={20} color="#ec4899" />
            </View>
            <View style={styles.menuContent}>
              <Text style={styles.menuTitle}>Support Lift</Text>
              <Text style={styles.menuSubtitle}>Help keep the app running</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </TouchableOpacity>
        </View>
      )}

      {user && (
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={20} color="#dc2626" />
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      )}
          </ScrollView>
        </View>

        {/* Edit Profile Modal */}
        <Modal
          visible={showEditModal}
          animationType="slide"
          transparent
          onRequestClose={() => setShowEditModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.stone900 }]}>Edit Profile</Text>
                <TouchableOpacity onPress={() => setShowEditModal(false)}>
                  <Ionicons name="close" size={24} color={colors.stone400} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.inputLabel, { color: colors.stone500 }]}>Display Name</Text>
              <TextInput
                style={[styles.modalInput, { color: colors.stone900, backgroundColor: colors.stone100, borderColor: colors.stone200 }]}
                placeholder="Your name"
                placeholderTextColor={colors.stone400}
                value={editName}
                onChangeText={setEditName}
                autoFocus
                maxLength={50}
              />

              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: colors.stone900 }, !editName.trim() && styles.saveButtonDisabled]}
                onPress={handleSaveProfile}
                disabled={!editName.trim() || saving}
              >
                <Text style={styles.saveButtonText}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
    </LiftScreen>
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
  kicker: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
    opacity: 0.8,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: {
    fontFamily: fonts.heading,
    fontSize: 32,
    fontWeight: '500',
    letterSpacing: -1.5,
    lineHeight: 34,
    color: '#1c1917',
  },
  headingDot: {
    color: '#4A5D4E',
  },
  
  // Content styles
  mainContent: {
    flex: 1,
    zIndex: 10,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 140,
    gap: spacing.lg,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: spacing.sm,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#4A5D4E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#e5e7eb',
  },
  avatarText: {
    fontSize: 40,
    fontWeight: '800',
    color: '#1f2937',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4A5D4E',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    elevation: 4,
  },
  nameRowProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  displayName: {
    fontFamily: fonts.heading,
    fontSize: 20,
    fontWeight: '700',
    color: '#1c1917',
  },
  verifiedBadgeProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  verifiedBadgeTextProfile: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  email: {
    fontSize: 14,
    color: '#64748b',
  },
  photoHint: {
    fontSize: 12,
    color: '#64748b',
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
  card: {
    backgroundColor: '#e5e7eb',
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  infoContent: {
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: spacing.sm,
  },
  label: {
    fontSize: 11,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1c1917',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: '#f8fafc',
    color: '#1c1917',
    marginBottom: spacing.sm,
  },
  button: {
    backgroundColor: '#4A5D4E',
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonText: {
    fontWeight: '800',
    color: '#1f2937',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  menuCard: {
    backgroundColor: '#e5e7eb',
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  menuHeading: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.md,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
    fontWeight: '600',
    color: '#1c1917',
    marginBottom: 2,
  },
  menuSubtitle: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#64748b',
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: spacing.sm,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: '#fef2f2',
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  signOutText: {
    fontWeight: '700',
    color: '#dc2626',
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
    color: '#1c1917',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  modalInput: {
    backgroundColor: '#f8fafc',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: '#1c1917',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: spacing.lg,
  },
  saveButton: {
    backgroundColor: '#4A5D4E',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1f2937',
  },
});
