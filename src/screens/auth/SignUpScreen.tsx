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

type Props = NativeStackScreenProps<RootStackParamList, 'SignUp'>;

export const SignUpScreen: React.FC<Props> = ({ navigation }) => {
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!name || !email || !password || !confirm) {
      Alert.alert('Missing info', 'All fields are required.');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Password mismatch', 'Passwords must match.');
      return;
    }
    setLoading(true);
    try {
      await signUp(name, email, password);
    } catch (err: any) {
      Alert.alert('Sign up failed', err.message ?? 'Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>LIFT</Text>
        <Text style={styles.tagline}>Create your account</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.title}>Sign Up</Text>
        <TextInput
          placeholder="Display name"
          placeholderTextColor={palette.muted}
          style={styles.input}
          value={name}
          onChangeText={setName}
        />
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
        <TextInput
          placeholder="Confirm password"
          placeholderTextColor={palette.muted}
          secureTextEntry
          style={styles.input}
          value={confirm}
          onChangeText={setConfirm}
        />
        <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Creating...' : 'Create account'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.link} onPress={() => navigation.navigate('SignIn')}>
          <Text style={styles.linkText}>Back to sign in</Text>
        </TouchableOpacity>
      </View>
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
});
