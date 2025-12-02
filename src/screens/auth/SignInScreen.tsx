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
import { useTheme } from '../../contexts/ThemeContext';
import { palette, radius, spacing } from '../../theme/colors';
import { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'SignIn'>;

export const SignInScreen: React.FC<Props> = ({ navigation }) => {
  const { signIn, signInGuest, resetPassword } = useAuth();
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    if (!email.trim()) {
      Alert.alert('Email Required', 'Please enter your email address.');
      return;
    }
    if (!password) {
      Alert.alert('Password Required', 'Please enter your password.');
      return;
    }

    setLoading(true);
    try {
      await signIn(email, password);
      // Navigation happens automatically via auth state change
    } catch (error: any) {
      const errorMessage = error.message || 'Please check your credentials and try again.';
      
      // Check if it's a "user not found" or "invalid credentials" error and offer to create account
      // Firebase returns "invalid-credential" when the user doesn't exist or password is wrong
      if (errorMessage.toLowerCase().includes('no account found') || 
          errorMessage.toLowerCase().includes('user not found') ||
          errorMessage.toLowerCase().includes('sign up first') ||
          errorMessage.toLowerCase().includes('invalid email or password') ||
          errorMessage.toLowerCase().includes('invalid credential')) {
        Alert.alert(
          'Sign In Failed',
          "We couldn't sign you in. This could be because:\n\n• No account exists with this email\n• The password is incorrect\n\nWould you like to create a new account or try again?",
          [
            { text: 'Try Again', style: 'cancel' },
            { text: 'Forgot Password', onPress: handleForgotPassword },
            { 
              text: 'Create Account', 
              onPress: () => navigation.navigate('SignUp')
            }
          ]
        );
      } else {
        Alert.alert('Sign In Failed', errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert(
        'Email Required',
        'Please enter your email address first, then tap "Forgot password".'
      );
      return;
    }

    Alert.alert(
      'Reset Password',
      `Send password reset email to ${email.trim()}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: async () => {
            try {
              await resetPassword(email);
              Alert.alert(
                'Email Sent',
                'Check your inbox for password reset instructions. Don\'t forget to check your spam folder.'
              );
            } catch (error: any) {
              Alert.alert('Reset Failed', error.message || 'Could not send reset email.');
            }
          },
        },
      ]
    );
  };

  const handleGuestSignIn = async () => {
    setLoading(true);
    try {
      await signInGuest();
      // Navigation happens automatically via auth state change
    } catch (error: any) {
      Alert.alert('Guest Sign-In Failed', error.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const isLoading = loading;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
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
            <Text style={[styles.logo, { color: colors.text }]}>LIFT</Text>
            <Text style={[styles.tagline, { color: colors.muted }]}>Live network of prayer</Text>
          </View>

          {/* Sign In Card */}
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <Text style={[styles.title, { color: colors.text }]}>Welcome Back</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>Sign in to continue</Text>

            {/* Email Input */}
            <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="mail-outline" size={20} color={colors.muted} style={styles.inputIcon} />
              <TextInput
                placeholder="Email address"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                autoComplete="email"
                style={[styles.input, { color: colors.text }]}
                value={email}
                onChangeText={setEmail}
                editable={!isLoading}
              />
            </View>

            {/* Password Input */}
            <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.muted} style={styles.inputIcon} />
              <TextInput
                placeholder="Password"
                placeholderTextColor={colors.muted}
                secureTextEntry={!showPassword}
                textContentType="password"
                autoComplete="password"
                style={[styles.input, styles.passwordInput, { color: colors.text }]}
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
                  color={colors.muted}
                />
              </TouchableOpacity>
            </View>

            {/* Forgot Password */}
            <TouchableOpacity onPress={handleForgotPassword} disabled={isLoading}>
              <Text style={[styles.forgotText, { color: colors.muted }]}>Forgot password?</Text>
            </TouchableOpacity>

            {/* Sign In Button */}
            <TouchableOpacity
              style={[
                styles.button, 
                styles.primaryButton, 
                { backgroundColor: colors.accent },
                isLoading && [styles.buttonDisabled, { backgroundColor: colors.muted, opacity: 0.5 }]
              ]}
              onPress={handleSignIn}
              disabled={isLoading}
            >
              {loading ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <Text style={[styles.primaryButtonText, { color: colors.text }]}>Sign In</Text>
              )}
            </TouchableOpacity>

            {/* Sign Up Link */}
            <View style={styles.signUpContainer}>
              <Text style={[styles.signUpText, { color: colors.muted }]}>Don&apos;t have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('SignUp')} disabled={isLoading}>
                <Text style={[styles.signUpLink, { color: colors.accent }]}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Guest Sign In */}
          <TouchableOpacity
            style={styles.guestButton}
            onPress={handleGuestSignIn}
            disabled={isLoading}
          >
            <Text style={[styles.guestText, { color: colors.muted }]}>Continue as guest</Text>
          </TouchableOpacity>
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
    marginBottom: spacing.xl,
  },
  logo: {
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 3,
  },
  tagline: {
    marginTop: 4,
    fontSize: 14,
  },
  card: {
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
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: spacing.lg,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  inputIcon: {
    paddingLeft: spacing.md,
  },
  input: {
    flex: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
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
  forgotText: {
    fontWeight: '600',
    textAlign: 'right',
    marginBottom: spacing.lg,
    fontSize: 14,
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
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    fontWeight: '800',
    fontSize: 17,
  },
  signUpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  signUpText: {
    fontSize: 14,
  },
  signUpLink: {
    fontWeight: '700',
    fontSize: 14,
  },
  guestButton: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.lg,
    borderRadius: radius.md,
  },
  guestText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
