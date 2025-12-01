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
  Platform,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { doc, getDoc } from 'firebase/firestore';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../hooks/useAuth';
import { palette, radius, spacing } from '../theme/colors';
import { db, firebaseEnabled } from '../services/firebase';
import { registerForPushNotifications, storePushToken } from '../services/notifications';
import { updateUserSettings } from '../services/userProfile';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'NotificationsSettings'>;

type NotificationSettings = {
  enabled: boolean;
  prayers: boolean;
  comments: boolean;
  testimonies: boolean;
  critical: boolean;
  groups: boolean;
  dailyReminder: boolean;
  reminderTime: string; // HH:MM format
};

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: false,
  prayers: true,
  comments: true,
  testimonies: true,
  critical: false,
  groups: true,
  dailyReminder: false,
  reminderTime: '09:00',
};

export const NotificationsSettingsScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);
  const [, setLoading] = useState(true);
  const [permissionStatus, setPermissionStatus] = useState<string>('unknown');

  // Load current settings
  useEffect(() => {
    const loadSettings = async () => {
      // Check notification permission status
      const { status } = await Notifications.getPermissionsAsync();
      setPermissionStatus(status);

      if (!user || !firebaseEnabled || !db) {
        setLoading(false);
        return;
      }

      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) {
          const data = snap.data();
          const userSettings = data.settings || {};
          setSettings({
            enabled: userSettings.notifications ?? false,
            prayers: userSettings.notificationsPrayers ?? true,
            comments: userSettings.notificationsComments ?? true,
            testimonies: userSettings.notificationsTestimonies ?? true,
            critical: userSettings.notificationsCritical ?? false,
            groups: userSettings.notificationsGroups ?? true,
            dailyReminder: userSettings.dailyReminder ?? false,
            reminderTime: userSettings.reminderTime ?? '09:00',
          });
        }
      } catch (err) {
        console.error('[Notifications] Error loading settings:', err);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [user]);

  const requestPermission = async () => {
    try {
      const registration = await registerForPushNotifications();
      setPermissionStatus(registration.status);

      if (registration.status === 'granted' && user && registration.expoPushToken) {
        await storePushToken(user.uid, registration.expoPushToken, registration.devicePushToken);
        await updateSetting('enabled', true);
        
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        
        Alert.alert('Success', 'Push notifications enabled!');
      } else if (registration.status === 'denied') {
        Alert.alert(
          'Permission Denied',
          'Please enable notifications in your device settings to receive prayer alerts.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
      }
    } catch (err) {
      console.error('[Notifications] Error requesting permission:', err);
      Alert.alert('Error', 'Could not enable notifications. Please try again.');
    }
  };

  const updateSetting = async (key: keyof NotificationSettings, value: boolean | string) => {
    if (!user) return;

    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }

    // Update local state immediately for responsive UI
    setSettings(prev => ({ ...prev, [key]: value }));

    // Map to Firestore field names
    const fieldMap: Record<string, string> = {
      enabled: 'notifications',
      prayers: 'notificationsPrayers',
      comments: 'notificationsComments',
      testimonies: 'notificationsTestimonies',
      critical: 'notificationsCritical',
      groups: 'notificationsGroups',
      dailyReminder: 'dailyReminder',
      reminderTime: 'reminderTime',
    };

    try {
      await updateUserSettings(user, { [fieldMap[key]]: value });
    } catch (err) {
      console.error('[Notifications] Error updating setting:', err);
      // Revert on error
      setSettings(prev => ({ ...prev, [key]: !value }));
      Alert.alert('Error', 'Could not update setting. Please try again.');
    }
  };

  const handleToggle = (key: keyof NotificationSettings) => {
    const currentValue = settings[key];
    
    // Special handling for push notifications
    if (key === 'enabled' && !currentValue) {
      if (permissionStatus !== 'granted') {
        requestPermission();
        return;
      }
    }

    updateSetting(key, !currentValue);
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <Ionicons name="notifications-off" size={64} color={palette.muted} />
          <Text style={styles.emptyTitle}>Sign in Required</Text>
          <Text style={styles.emptySubtitle}>
            Please sign in to manage your notification preferences.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with Back Button */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={palette.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 40 }} />
      </View>
      
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Permission Status Banner */}
        {permissionStatus !== 'granted' && (
          <TouchableOpacity style={styles.permissionBanner} onPress={requestPermission}>
            <Ionicons name="alert-circle" size={24} color="#f59e0b" />
            <View style={styles.permissionBannerContent}>
              <Text style={styles.permissionBannerTitle}>Notifications Disabled</Text>
              <Text style={styles.permissionBannerText}>
                Tap to enable push notifications
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={palette.muted} />
          </TouchableOpacity>
        )}

        {/* Push Notifications Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Push Notifications</Text>
          
          <View style={styles.settingCard}>
            <SettingRow
              icon="notifications"
              iconColor="#3b82f6"
              title="Enable Notifications"
              subtitle="Receive push notifications"
              value={settings.enabled && permissionStatus === 'granted'}
              onToggle={() => handleToggle('enabled')}
              disabled={permissionStatus !== 'granted'}
            />
            
            <View style={styles.divider} />
            
            <SettingRow
              icon="alert-circle"
              iconColor="#ef4444"
              title="Critical Prayer Alerts"
              subtitle="Urgent prayer requests from the community"
              value={settings.critical}
              onToggle={() => handleToggle('critical')}
              disabled={!settings.enabled || permissionStatus !== 'granted'}
            />
          </View>
        </View>

        {/* Prayer Notifications Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Prayer & Content Activity</Text>
          
          <View style={styles.settingCard}>
            <SettingRow
              icon="heart"
              iconColor="#ec4899"
              title="Prayers on Your Requests"
              subtitle="When someone prays for your request"
              value={settings.prayers}
              onToggle={() => handleToggle('prayers')}
              disabled={!settings.enabled || permissionStatus !== 'granted'}
            />
            
            <View style={styles.divider} />
            
            <SettingRow
              icon="checkmark-circle"
              iconColor="#22c55e"
              title="Linked Testimonies"
              subtitle="When your request is marked answered"
              value={settings.testimonies}
              onToggle={() => handleToggle('testimonies')}
              disabled={!settings.enabled || permissionStatus !== 'granted'}
            />
            
            <View style={styles.divider} />
            
            <SettingRow
              icon="people"
              iconColor="#8b5cf6"
              title="Comments on Your Content"
              subtitle="When someone comments on your requests or testimonies"
              value={settings.comments}
              onToggle={() => handleToggle('comments')}
              disabled={!settings.enabled || permissionStatus !== 'granted'}
            />
          </View>
        </View>

        {/* Group Activity Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Group Activity</Text>
          
          <View style={styles.settingCard}>
            <SettingRow
              icon="people"
              iconColor="#0ea5e9"
              title="Group Updates"
              subtitle="New prayer requests in your groups"
              value={settings.groups}
              onToggle={() => handleToggle('groups')}
              disabled={!settings.enabled || permissionStatus !== 'granted'}
            />
          </View>
        </View>

        {/* Reminders Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Daily Reminders</Text>
          
          <View style={styles.settingCard}>
            <SettingRow
              icon="alarm"
              iconColor="#0ea5e9"
              title="Daily Prayer Reminder"
              subtitle="Get a daily reminder to pray"
              value={settings.dailyReminder}
              onToggle={() => handleToggle('dailyReminder')}
            />
            
            {settings.dailyReminder && (
              <>
                <View style={styles.divider} />
                <TouchableOpacity 
                  style={styles.timeRow}
                  onPress={() => navigation.navigate('Reminders')}
                >
                  <View style={styles.timeRowLeft}>
                    <View style={[styles.iconContainer, { backgroundColor: '#e0f2fe' }]}>
                      <Ionicons name="time" size={20} color="#0ea5e9" />
                    </View>
                    <View>
                      <Text style={styles.settingTitle}>Reminder Time</Text>
                      <Text style={styles.settingSubtitle}>Configure in Reminders</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={palette.muted} />
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={20} color="#3b82f6" />
          <Text style={styles.infoText}>
            You can customize which notifications you receive. Disabled settings will not send any notifications for that category.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// Reusable setting row component
type SettingRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  title: string;
  subtitle: string;
  value: boolean;
  onToggle: () => void;
  disabled?: boolean;
};

const SettingRow: React.FC<SettingRowProps> = ({
  icon,
  iconColor,
  title,
  subtitle,
  value,
  onToggle,
  disabled,
}) => (
  <View style={[styles.settingRow, disabled && styles.settingRowDisabled]}>
    <View style={[styles.iconContainer, { backgroundColor: `${iconColor}20` }]}>
      <Ionicons name={icon} size={20} color={iconColor} />
    </View>
    <View style={styles.settingInfo}>
      <Text style={[styles.settingTitle, disabled && styles.settingTitleDisabled]}>
        {title}
      </Text>
      <Text style={styles.settingSubtitle}>{subtitle}</Text>
    </View>
    <Switch
      value={value}
      onValueChange={onToggle}
      disabled={disabled}
      trackColor={{ false: '#e2e8f0', true: '#fcd34d' }}
      thumbColor={value ? '#f59e0b' : '#f4f4f5'}
    />
  </View>
);

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
  content: {
    padding: spacing.lg,
    paddingBottom: 40,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: palette.text,
    marginTop: spacing.md,
  },
  emptySubtitle: {
    fontSize: 14,
    color: palette.muted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  permissionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: '#fcd34d',
  },
  permissionBannerContent: {
    flex: 1,
  },
  permissionBannerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#92400e',
  },
  permissionBannerText: {
    fontSize: 13,
    color: '#b45309',
    marginTop: 2,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    marginLeft: spacing.sm,
  },
  settingCard: {
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  settingRowDisabled: {
    opacity: 0.5,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingInfo: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: palette.text,
  },
  settingTitleDisabled: {
    color: palette.muted,
  },
  settingSubtitle: {
    fontSize: 12,
    color: palette.muted,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: palette.border,
    marginLeft: 68,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  timeRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#eff6ff',
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#3b82f6',
    lineHeight: 18,
  },
});

