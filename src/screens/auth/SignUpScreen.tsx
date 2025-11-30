import React, { useState } from 'react';
import {
  Alert,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { palette, radius, spacing } from '../../theme/colors';
import { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'SignUp'>;

export const SignUpScreen: React.FC<Props> = ({ navigation }) => {
  const { signUp } = useAuth();
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

  const isLoading = loading;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.logo}>LIFT</Text>
            <Text style={styles.tagline}>Join the prayer community</Text>
          </View>

          {/* Sign Up Card */}
          <View style={styles.card}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Sign up to get started</Text>

            {/* Display Name Input */}
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color={palette.muted} style={styles.inputIcon} />
              <TextInput
                placeholder="Display name"
                placeholderTextColor={palette.muted}
                autoCapitalize="words"
                autoCorrect={false}
                textContentType="name"
                autoComplete="name"
                style={styles.input}
                value={displayName}
                onChangeText={setDisplayName}
                editable={!isLoading}
              />
            </View>

            {/* Email Input */}
            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={20} color={palette.muted} style={styles.inputIcon} />
              <TextInput
                placeholder="Email address"
                placeholderTextColor={palette.muted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                autoComplete="email"
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                editable={!isLoading}
              />
            </View>

            {/* Password Input */}
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color={palette.muted} style={styles.inputIcon} />
              <TextInput
                placeholder="Password (min 6 characters)"
                placeholderTextColor={palette.muted}
                secureTextEntry={!showPassword}
                textContentType="newPassword"
                autoComplete="password-new"
                style={[styles.input, styles.passwordInput]}
                value={password}
                onChangeText={setPassword}
                editable={!isLoading}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
                disabled={isLoading}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={palette.muted}
                />
              </TouchableOpacity>
            </View>

            {/* Confirm Password Input */}
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color={palette.muted} style={styles.inputIcon} />
              <TextInput
                placeholder="Confirm password"
                placeholderTextColor={palette.muted}
                secureTextEntry={!showConfirmPassword}
                textContentType="newPassword"
                style={[styles.input, styles.passwordInput]}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                editable={!isLoading}
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                style={styles.eyeButton}
                disabled={isLoading}
              >
                <Ionicons
                  name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={palette.muted}
                />
              </TouchableOpacity>
            </View>

            {/* Password Requirements */}
            <View style={styles.requirements}>
              <Text style={[styles.requirement, password.length >= 6 && styles.requirementMet]}>
                <Ionicons
                  name={password.length >= 6 ? 'checkmark-circle' : 'ellipse-outline'}
                  size={14}
                  color={password.length >= 6 ? '#22c55e' : palette.muted}
                />{' '}
                At least 6 characters
              </Text>
              <Text style={[styles.requirement, password === confirmPassword && password.length > 0 && styles.requirementMet]}>
                <Ionicons
                  name={password === confirmPassword && password.length > 0 ? 'checkmark-circle' : 'ellipse-outline'}
                  size={14}
                  color={password === confirmPassword && password.length > 0 ? '#22c55e' : palette.muted}
                />{' '}
                Passwords match
              </Text>
            </View>

            {/* Sign Up Button */}
            <TouchableOpacity
              style={[styles.button, styles.primaryButton, isLoading && styles.buttonDisabled]}
              onPress={handleSignUp}
              disabled={isLoading}
            >
              {loading ? (
                <ActivityIndicator color="#1f2937" />
              ) : (
                <Text style={styles.primaryButtonText}>Create Account</Text>
              )}
            </TouchableOpacity>

            {/* Sign In Link */}
            <View style={styles.signInContainer}>
              <Text style={styles.signInText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('SignIn')} disabled={isLoading}>
                <Text style={styles.signInLink}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Terms */}
          <Text style={styles.terms}>
            By creating an account, you agree to our Terms of Service and Privacy Policy.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  header: {
    marginBottom: spacing.lg,
  },
  logo: {
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 3,
    color: palette.text,
  },
  tagline: {
    color: palette.muted,
    marginTop: 4,
    fontSize: 14,
  },
  card: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    shadowColor: palette.shadow,
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 4,
    borderWidth: 1,
    borderColor: palette.border,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: palette.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: palette.muted,
    marginBottom: spacing.lg,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    backgroundColor: '#f8fafc',
    marginBottom: spacing.lg,
  },
  inputIcon: {
    paddingLeft: spacing.md,
  },
  input: {
    flex: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
    color: palette.text,
    fontSize: 16,
  },
  passwordInput: {
    paddingRight: 44,
  },
  eyeButton: {
    position: 'absolute',
    right: spacing.md,
    padding: 4,
  },
  requirements: {
    marginBottom: spacing.lg,
    gap: 4,
  },
  requirement: {
    fontSize: 12,
    color: palette.muted,
  },
  requirementMet: {
    color: '#22c55e',
  },
  button: {
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    minHeight: 52,
    marginBottom: spacing.md,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButton: {
    backgroundColor: palette.accent,
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    fontWeight: '800',
    color: '#1f2937',
    fontSize: 17,
  },
  signInContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  signInText: {
    color: palette.muted,
    fontSize: 14,
  },
  signInLink: {
    color: palette.accentDark,
    fontWeight: '700',
    fontSize: 14,
  },
  terms: {
    textAlign: 'center',
    color: palette.muted,
    fontSize: 12,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
});
