import React, { useState } from 'react';
import {
  Alert,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../hooks/useAuth';
import { palette, radius, spacing } from '../../theme/colors';
import { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'SignIn'>;

export const SignInScreen: React.FC<Props> = ({ navigation }) => {
  const { signIn, signInGuest, resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email || !password) {
      Alert.alert('Missing info', 'Email and password are required.');
      return;
    }
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (err: any) {
      Alert.alert('Sign in failed', err.message ?? 'Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!email) {
      Alert.alert('Enter email', 'Enter the email to reset your password.');
      return;
    }
    try {
      await resetPassword(email);
      Alert.alert('Email sent', 'Check your inbox for reset instructions.');
    } catch (err: any) {
      Alert.alert('Reset failed', err.message ?? 'Could not send reset email.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>LIFT</Text>
        <Text style={styles.tagline}>Live network of prayer</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.title}>Sign In</Text>
        <TextInput
          placeholder="Email"
          placeholderTextColor={palette.muted}
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.input}
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          placeholder="Password"
          placeholderTextColor={palette.muted}
          secureTextEntry
          style={styles.input}
          value={password}
          onChangeText={setPassword}
        />
        <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Signing in...' : 'Sign In'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.link} onPress={() => navigation.navigate('SignUp')}>
          <Text style={styles.linkText}>Create account</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.link} onPress={handleReset}>
          <Text style={styles.linkText}>Forgot password</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={styles.guest} onPress={signInGuest} disabled={loading}>
        <Text style={styles.guestText}>Continue as guest</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  header: {
    marginTop: spacing.lg,
  },
  logo: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 2,
    color: palette.text,
  },
  tagline: {
    color: palette.muted,
    marginTop: 4,
  },
  card: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    shadowColor: palette.shadow,
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 20,
    elevation: 3,
    borderWidth: 1,
    borderColor: palette.border,
    gap: spacing.md,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
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
  link: {
    alignItems: 'center',
  },
  linkText: {
    color: palette.accentDark,
    fontWeight: '700',
  },
  guest: {
    alignItems: 'center',
    padding: spacing.md,
  },
  guestText: {
    color: palette.muted,
  },
});
