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
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { palette, radius, spacing } from '../../theme/colors';
import { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ForgotPassword'>;

export const ForgotPasswordScreen: React.FC<Props> = ({ navigation }) => {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleResetPassword = async () => {
    if (!email.trim()) {
      Alert.alert('Email Required', 'Please enter your email address.');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      await resetPassword(email);
      setEmailSent(true);
    } catch (error: any) {
      Alert.alert('Reset Failed', error.message || 'Could not send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (emailSent) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.successCard}>
            <View style={styles.iconContainer}>
              <Ionicons name="mail" size={48} color={palette.accent} />
            </View>
            <Text style={styles.successTitle}>Check Your Email</Text>
            <Text style={styles.successText}>
              We&apos;ve sent password reset instructions to:
            </Text>
            <Text style={styles.emailText}>{email.trim()}</Text>
            <Text style={styles.successHint}>
              Don&apos;t forget to check your spam folder if you don&apos;t see the email.
            </Text>
            <TouchableOpacity
              style={[styles.button, styles.primaryButton]}
              onPress={() => navigation.navigate('SignIn')}
            >
              <Text style={styles.primaryButtonText}>Back to Sign In</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.resendButton}
              onPress={() => setEmailSent(false)}
            >
              <Text style={styles.resendText}>Didn&apos;t receive it? Try again</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          {/* Back Button */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={palette.text} />
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.logo}>LIFT</Text>
            <Text style={styles.tagline}>Reset your password</Text>
          </View>

          {/* Reset Card */}
          <View style={styles.card}>
            <Text style={styles.title}>Forgot Password?</Text>
            <Text style={styles.subtitle}>
              Enter your email address and we&apos;ll send you instructions to reset your password.
            </Text>

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
                editable={!loading}
                autoFocus
              />
            </View>

            {/* Reset Button */}
            <TouchableOpacity
              style={[styles.button, styles.primaryButton, loading && styles.buttonDisabled]}
              onPress={handleResetPassword}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#1f2937" />
              ) : (
                <Text style={styles.primaryButtonText}>Send Reset Email</Text>
              )}
            </TouchableOpacity>

            {/* Back to Sign In */}
            <TouchableOpacity
              style={styles.backToSignIn}
              onPress={() => navigation.navigate('SignIn')}
              disabled={loading}
            >
              <Ionicons name="arrow-back" size={16} color={palette.accentDark} />
              <Text style={styles.backToSignInText}>Back to Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>
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
  content: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  backButton: {
    position: 'absolute',
    top: spacing.lg,
    left: spacing.lg,
    padding: spacing.sm,
    zIndex: 1,
  },
  header: {
    marginBottom: spacing.xl,
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
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: palette.muted,
    marginBottom: spacing.lg,
    lineHeight: 20,
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
  button: {
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    minHeight: 48,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButton: {
    backgroundColor: palette.accent,
  },
  primaryButtonText: {
    fontWeight: '700',
    color: '#1f2937',
    fontSize: 16,
  },
  backToSignIn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    gap: 4,
  },
  backToSignInText: {
    color: palette.accentDark,
    fontWeight: '600',
    fontSize: 14,
  },
  // Success state styles
  successCard: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    shadowColor: palette.shadow,
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 4,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: `${palette.accent}20`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: palette.text,
    marginBottom: spacing.sm,
  },
  successText: {
    fontSize: 14,
    color: palette.muted,
    textAlign: 'center',
  },
  emailText: {
    fontSize: 16,
    fontWeight: '600',
    color: palette.text,
    marginVertical: spacing.sm,
  },
  successHint: {
    fontSize: 12,
    color: palette.muted,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  resendButton: {
    marginTop: spacing.md,
  },
  resendText: {
    color: palette.accentDark,
    fontWeight: '600',
    fontSize: 14,
  },
});
