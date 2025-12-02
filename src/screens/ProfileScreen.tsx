import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
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
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as ImageManipulator from 'expo-image-manipulator';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../contexts/ThemeContext';
import { palette, radius, spacing } from '../theme/colors';
import { db, firebaseEnabled, storage } from '../services/firebase';
import { registerForPushNotifications, setupNotificationHandler, storePushToken } from '../services/notifications';
import { updateUserSettings, updateUserProfile } from '../services/userProfile';
import { RootStackParamList } from '../navigation/types';
import { getVerifiedBadge, BADGE_STYLES, hasAdminPermission } from '../config/admins';
import { validateDisplayName, validateEmail } from '../utils/security';
import { PrayerStreakWidget } from '../components/PrayerStreakWidget';

export const ProfileScreen: React.FC = () => {
  const { user, signOut, resendVerification, linkGuestToEmail } = useAuth();
  const { colors, isDark } = useTheme();
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

        // Resize and compress the image to max 400x400 and 80% quality
        // This keeps file size reasonable (typically under 100KB)
        const manipulated = await ImageManipulator.manipulateAsync(
          asset.uri,
          [{ resize: { width: 400, height: 400 } }],
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
        );

        let photoURL: string;

        // Upload to Firebase Storage if available
        if (storage && firebaseEnabled) {
          // Fetch the resized image as a blob
          const response = await fetch(manipulated.uri);
          const blob = await response.blob();
          
          // Create a reference to the profile image using folder structure
          // This matches the storage rules: profile-pictures/{userId}/{fileName}
          const imageRef = ref(storage, `profile-pictures/${user.uid}/profile.jpg`);
          
          // Upload the blob
          await uploadBytes(imageRef, blob);
          
          // Get the download URL
          photoURL = await getDownloadURL(imageRef);
        } else {
          // Fallback for development/testing - use a placeholder
          // In production, Firebase Storage should always be available
          Alert.alert(
            'Storage Not Available',
            'Firebase Storage is not configured. Profile picture cannot be uploaded.',
            [{ text: 'OK' }]
          );
          setUploadingImage(false);
          return;
        }
        
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
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerRow}>
          <Text style={[styles.heading, { color: colors.text }]}>Profile</Text>
          {user && (
            <TouchableOpacity style={styles.editButton} onPress={handleEditProfile}>
              <Ionicons name="pencil" size={18} color={palette.accentDark} />
              <Text style={styles.editButtonText}>Edit</Text>
            </TouchableOpacity>
          )}
        </View>
        
        {/* Profile Avatar */}
        {user && (
          <View style={styles.avatarSection}>
            <TouchableOpacity 
              style={styles.avatarContainer}
              onPress={pickProfileImage}
              onLongPress={profileImage ? removeProfileImage : undefined}
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
                return null;
              })()}
            </View>
            <Text style={[styles.email, { color: colors.muted }]}>{user.email || (user.isAnonymous ? 'Guest account' : 'No email')}</Text>
            
            {/* Hint text */}
            <Text style={styles.photoHint}>
              Tap photo to change • Long press to remove
            </Text>
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
          <Text style={styles.label}>Upgrade account</Text>
          <Text style={styles.value}>Link guest to email/password</Text>
          <TextInput
            style={styles.input}
            placeholder="Display name"
            placeholderTextColor={palette.muted}
            value={upgradeName}
            onChangeText={setUpgradeName}
          />
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={palette.muted}
            autoCapitalize="none"
            keyboardType="email-address"
            value={upgradeEmail}
            onChangeText={setUpgradeEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={palette.muted}
            secureTextEntry
            value={upgradePassword}
            onChangeText={setUpgradePassword}
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
      {user && !user.isAnonymous && user.email && !user.emailVerified && (
        <View style={styles.card}>
          <Text style={styles.label}>Email verification</Text>
          <Text style={styles.value}>Your email is not verified.</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={async () => {
              setVerifying(true);
              try {
                await resendVerification();
                Alert.alert('Verification sent', 'Check your inbox for the verification email.');
              } catch (err: any) {
                Alert.alert('Failed to send', err.message ?? 'Try again.');
              } finally {
                setVerifying(false);
              }
            }}
            disabled={verifying}
          >
            <Text style={styles.buttonText}>{verifying ? 'Sending...' : 'Resend verification'}</Text>
          </TouchableOpacity>
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
              <Ionicons name="bookmark" size={20} color="#f59e0b" />
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
            <Ionicons name="chevron-forward" size={20} color={palette.muted} />
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
            <Ionicons name="chevron-forward" size={20} color={palette.muted} />
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('Achievements')}
          >
            <View style={[styles.menuIcon, { backgroundColor: '#fef3c7' }]}>
              <Ionicons name="trophy" size={20} color="#f59e0b" />
            </View>
            <View style={styles.menuContent}>
              <Text style={styles.menuTitle}>Achievements</Text>
              <Text style={styles.menuSubtitle}>View your badges and progress</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={palette.muted} />
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
            <Ionicons name="chevron-forward" size={20} color={palette.muted} />
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('NotificationsSettings')}
          >
            <View style={[styles.menuIcon, { backgroundColor: '#fef3c7' }]}>
              <Ionicons name="notifications" size={20} color="#f59e0b" />
            </View>
            <View style={styles.menuContent}>
              <Text style={styles.menuTitle}>Notification Settings</Text>
              <Text style={styles.menuSubtitle}>Customize your alerts</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={palette.muted} />
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
            <Ionicons name="chevron-forward" size={20} color={palette.muted} />
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
                <Ionicons name="chevron-forward" size={20} color={palette.muted} />
              </TouchableOpacity>
            </>
          )}

          <View style={styles.menuDivider} />

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('Help')}
          >
            <View style={[styles.menuIcon, { backgroundColor: '#fef3c7' }]}>
              <Ionicons name="help-circle" size={20} color="#f59e0b" />
            </View>
            <View style={styles.menuContent}>
              <Text style={styles.menuTitle}>Help & Tutorial</Text>
              <Text style={styles.menuSubtitle}>Learn how to use Lift</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={palette.muted} />
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
            <Ionicons name="chevron-forward" size={20} color={palette.muted} />
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

      {/* Edit Profile Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Ionicons name="close" size={24} color={palette.muted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Display Name</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Your name"
              placeholderTextColor={palette.muted}
              value={editName}
              onChangeText={setEditName}
              autoFocus
              maxLength={50}
            />

            <TouchableOpacity
              style={[styles.saveButton, !editName.trim() && styles.saveButtonDisabled]}
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  scrollContent: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heading: {
    fontSize: 22,
    fontWeight: '900',
    color: palette.text,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fef3c7',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  editButtonText: {
    fontWeight: '700',
    color: palette.accentDark,
    fontSize: 14,
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
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: palette.accent,
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
    backgroundColor: palette.accentDark,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  nameRowProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  displayName: {
    fontSize: 20,
    fontWeight: '800',
    color: palette.text,
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
    color: palette.muted,
  },
  photoHint: {
    fontSize: 12,
    color: palette.muted,
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
  card: {
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: palette.border,
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
    backgroundColor: palette.border,
    marginVertical: spacing.sm,
  },
  label: {
    fontSize: 11,
    color: palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 15,
    fontWeight: '600',
    color: palette.text,
  },
  input: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: '#f8fafc',
    color: palette.text,
    marginBottom: spacing.sm,
  },
  button: {
    backgroundColor: palette.accent,
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
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.border,
  },
  menuHeading: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.muted,
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
    fontSize: 16,
    fontWeight: '700',
    color: palette.text,
  },
  menuSubtitle: {
    fontSize: 12,
    color: palette.muted,
  },
  menuDivider: {
    height: 1,
    backgroundColor: palette.border,
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
    color: palette.text,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.muted,
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
    color: palette.text,
    borderWidth: 1,
    borderColor: palette.border,
    marginBottom: spacing.lg,
  },
  saveButton: {
    backgroundColor: palette.accent,
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
