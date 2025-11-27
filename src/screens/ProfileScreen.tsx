import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
  Alert,
  TextInput,
} from 'react-native';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { palette, radius, spacing } from '../theme/colors';
import { db, firebaseEnabled } from '../services/firebase';
import { registerForPushNotifications, setupNotificationHandler, storePushToken } from '../services/notifications';
import { updateUserSettings } from '../services/userProfile';

export const ProfileScreen: React.FC = () => {
  const { user, signOut, resendVerification, linkGuestToEmail } = useAuth();
  const [pushEnabled, setPushEnabled] = useState(false);
  const [upgradeName, setUpgradeName] = useState('');
  const [upgradeEmail, setUpgradeEmail] = useState('');
  const [upgradePassword, setUpgradePassword] = useState('');
  const [busyUpgrade, setBusyUpgrade] = useState(false);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    setupNotificationHandler();
  }, []);

  useEffect(() => {
    const loadSettings = async () => {
      if (!user || !firebaseEnabled || !db) return;
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (snap.exists()) {
        const settings = (snap.data() as any).settings;
        if (settings?.notificationsCritical !== undefined) {
          setPushEnabled(!!settings.notificationsCritical);
        }
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

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.heading}>Profile</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Name</Text>
        <Text style={styles.value}>{user?.displayName || 'Guest'}</Text>
        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{user?.email || 'Not set'}</Text>
        <Text style={styles.label}>UID</Text>
        <Text style={styles.value} selectable>
          {user?.uid || 'N/A'}
        </Text>
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
              setBusyUpgrade(true);
              try {
                await linkGuestToEmail(upgradeName, upgradeEmail, upgradePassword);
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
      {user && (
        <TouchableOpacity style={styles.button} onPress={signOut}>
          <Text style={styles.buttonText}>Sign out</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
    padding: spacing.lg,
    gap: spacing.md,
  },
  heading: {
    fontSize: 22,
    fontWeight: '900',
    color: palette.text,
  },
  card: {
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.border,
    gap: spacing.sm,
  },
  label: {
    fontSize: 12,
    color: palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.text,
  },
  input: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: '#f8fafc',
    color: palette.text,
  },
  button: {
    backgroundColor: palette.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
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
});
