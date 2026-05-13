import React, { useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../contexts/ThemeContext';
import { fonts, radius } from '../../theme/colors';
import { LiftScreen, LiftLogo, LiftCard, LiftButton } from '../../components/LiftLayout';
import { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'SignUp'>;

export const SignUpScreen: React.FC<Props> = ({ navigation }) => {
  const { signUp } = useAuth();
  const { colors } = useTheme();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const validateForm = (): string | null => {
    if (!displayName.trim()) {
      return 'Please enter your display name.';
    }
    if (displayName.trim().length < 2) {
      return 'Display name must be at least 2 characters.';
    }
    if (!email.trim()) {
      return 'Please enter your email address.';
    }
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return 'Please enter a valid email address.';
    }
    if (!password) {
      return 'Please enter a password.';
    }
    if (password.length < 6) {
      return 'Password must be at least 6 characters long.';
    }
    if (password !== confirmPassword) {
      return 'Passwords do not match.';
    }
    return null;
  };

  const handleSignUp = async () => {
    const validationError = validateForm();
    if (validationError) {
      Alert.alert('Validation Error', validationError);
      return;
    }

    setLoading(true);
    try {
      await signUp(displayName, email, password);
      Alert.alert(
        'Account Created!',
        'A verification email has been sent to your inbox. Please verify your email to access all features.',
        [{ text: 'OK' }]
      );
      // Navigation happens automatically via auth state change
    } catch (error: any) {
      Alert.alert('Sign Up Failed', error.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LiftScreen scroll contentStyle={styles.screenContent}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        <View style={styles.header}>
          <LiftLogo />
          <Text style={[styles.tagline, { color: colors.muted }]}>Join the prayer community</Text>
        </View>

        <LiftCard style={styles.card}>
          <Text style={[styles.title, { color: colors.text }]}>Create Account</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>Simple sign-up to start praying together.</Text>

          <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TextInput
              placeholder="Display name"
              placeholderTextColor={colors.muted}
              autoCapitalize="words"
              autoCorrect={false}
              textContentType="name"
              autoComplete="name"
              style={[styles.input, { color: colors.text }]}
              value={displayName}
              onChangeText={setDisplayName}
              editable={!loading}
            />
          </View>

          <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TextInput
              placeholder="you@example.com"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              style={[styles.input, { color: colors.text }]}
              value={email}
              onChangeText={setEmail}
              editable={!loading}
            />
          </View>

          <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TextInput
              placeholder="Password (min 6 characters)"
              placeholderTextColor={colors.muted}
              secureTextEntry={!showPassword}
              textContentType="newPassword"
              autoComplete="password-new"
              style={[styles.input, styles.passwordInput, { color: colors.text }]}
              value={password}
              onChangeText={setPassword}
              editable={!loading}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton} disabled={loading}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.muted} />
            </TouchableOpacity>
          </View>

          <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TextInput
              placeholder="Confirm password"
              placeholderTextColor={colors.muted}
              secureTextEntry={!showConfirmPassword}
              textContentType="newPassword"
              style={[styles.input, styles.passwordInput, { color: colors.text }]}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              editable={!loading}
            />
            <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeButton} disabled={loading}>
              <Ionicons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.muted} />
            </TouchableOpacity>
          </View>

          <View style={styles.requirements}>
            <Text style={[styles.requirement, { color: colors.muted }, password.length >= 6 && styles.requirementMet]}>
              <Ionicons name={password.length >= 6 ? 'checkmark-circle' : 'ellipse-outline'} size={14} color={password.length >= 6 ? colors.success : colors.muted} />{' '}
              At least 6 characters
            </Text>
            <Text style={[styles.requirement, { color: colors.muted }, password === confirmPassword && password.length > 0 && styles.requirementMet]}>
              <Ionicons name={password === confirmPassword && password.length > 0 ? 'checkmark-circle' : 'ellipse-outline'} size={14} color={password === confirmPassword && password.length > 0 ? colors.success : colors.muted} />{' '}
              Passwords match
            </Text>
          </View>

          <LiftButton onPress={handleSignUp} disabled={loading}>{loading ? 'Creating account...' : 'Create Account'}</LiftButton>

          <View style={styles.signInContainer}>
            <Text style={[styles.signInText, { color: colors.muted }]}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('SignIn')} disabled={loading}>
              <Text style={[styles.signInLink, { color: colors.accentDark }]}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </LiftCard>

        <Text style={[styles.terms, { color: colors.muted }]}>
          By creating an account, you agree to our Terms of Service and Privacy Policy.
        </Text>
      </KeyboardAvoidingView>
    </LiftScreen>
  );
};

const styles = StyleSheet.create({
  screenContent: {
    paddingTop: 40,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    marginBottom: 32,
    alignItems: 'center',
  },
  tagline: {
    fontFamily: fonts.body,
    marginTop: 4,
    fontSize: 12,
  },
  card: {
    marginTop: 16,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 30,
    fontWeight: '500',
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    marginBottom: 24,
  },
  inputContainer: {
    borderWidth: 1,
    borderRadius: radius.md,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  input: {
    fontFamily: fonts.body,
    fontSize: 16,
  },
  passwordInput: {
    paddingRight: 44,
  },
  eyeButton: {
    position: 'absolute',
    right: 16,
    padding: 4,
  },
  requirements: {
    marginBottom: 24,
    gap: 4,
  },
  requirement: {
    fontFamily: fonts.body,
    fontSize: 12,
  },
  requirementMet: {
    fontFamily: fonts.bodyMedium,
    fontWeight: '600',
  },
  signInContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  signInText: {
    fontFamily: fonts.body,
    fontSize: 14,
  },
  signInLink: {
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
    fontSize: 14,
  },
  terms: {
    fontFamily: fonts.body,
    textAlign: 'center',
    fontSize: 12,
    marginTop: 24,
    paddingHorizontal: 16,
  },
});
