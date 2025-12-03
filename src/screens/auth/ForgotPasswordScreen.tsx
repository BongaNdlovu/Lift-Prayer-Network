import React, { useState, useMemo } from 'react';
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
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../contexts/ThemeContext';
import { palette, radius, spacing } from '../../theme/colors';
import { CinematicBackground } from '../../components/CinematicBackground';
import { GlassIconButton } from '../../components/GlassCard';
import { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ForgotPassword'>;

export const ForgotPasswordScreen: React.FC<Props> = ({ navigation }) => {
  const { resetPassword } = useAuth();
  const { colors } = useTheme();
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

  // Memoize gradient colors for stability on fresh install
  const gradientColors = useMemo(
    () => [...colors.gradientBoldScreen] as [string, string, ...string[]],
    [colors.gradientBoldScreen]
  );

  if (emailSent) {
    return (
      <CinematicBackground useOuterBackground>
        <SafeAreaView style={styles.container}>
          <View style={styles.content}>
            <View style={[styles.successCard, { backgroundColor: colors.surface }]}>
            <View style={[styles.iconContainer, { backgroundColor: colors.surface }]}>
              <Ionicons name="mail" size={48} color={colors.accent} />
            </View>
            <Text style={[styles.successTitle, { color: colors.text }]}>Check Your Email</Text>
            <Text style={[styles.successText, { color: colors.muted }]}>
              We&apos;ve sent password reset instructions to:
            </Text>
            <Text style={[styles.emailText, { color: colors.text }]}>{email.trim()}</Text>
            <Text style={[styles.successHint, { color: colors.muted }]}>
              Don&apos;t forget to check your spam folder if you don&apos;t see the email.
            </Text>
            <TouchableOpacity
              style={[styles.button, styles.primaryButton, { backgroundColor: colors.accent }]}
              onPress={() => navigation.navigate('SignIn')}
            >
              <Text style={[styles.primaryButtonText, { color: colors.text }]}>Back to Sign In</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.resendButton}
              onPress={() => setEmailSent(false)}
            >
              <Text style={[styles.resendText, { color: colors.muted }]}>Didn&apos;t receive it? Try again</Text>
            </TouchableOpacity>
          </View>
        </View>
        </SafeAreaView>
      </CinematicBackground>
    );
  }

  return (
    <CinematicBackground useOuterBackground>
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <View style={styles.content}>
            {/* Back Button */}
            <GlassIconButton
              onPress={() => navigation.goBack()}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={22} color={colors.stone700} />
            </GlassIconButton>

            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.logo}>LIFT</Text>
              <Text style={[styles.tagline, { color: colors.stone500 }]}>Reset your password</Text>
            </View>

          {/* Reset Card */}
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <Text style={[styles.title, { color: colors.text }]}>Forgot Password?</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>
              Enter your email address and we&apos;ll send you instructions to reset your password.
            </Text>

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
                editable={!loading}
                autoFocus
              />
            </View>

            {/* Reset Button */}
            <TouchableOpacity
              style={[
                styles.button, 
                styles.primaryButton, 
                { backgroundColor: colors.accent },
                loading && [styles.buttonDisabled, { backgroundColor: colors.muted, opacity: 0.5 }]
              ]}
              onPress={handleResetPassword}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <Text style={[styles.primaryButtonText, { color: colors.text }]}>Send Reset Email</Text>
              )}
            </TouchableOpacity>

            {/* Back to Sign In */}
            <TouchableOpacity
              style={styles.backToSignIn}
              onPress={() => navigation.navigate('SignIn')}
              disabled={loading}
            >
              <Ionicons name="arrow-back" size={16} color={colors.accent} />
              <Text style={[styles.backToSignInText, { color: colors.accent }]}>Back to Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </CinematicBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontSize: 48,
    fontWeight: '500',
    letterSpacing: -1,
    color: '#1c1917',
  },
  tagline: {
    marginTop: 4,
    fontSize: 14,
  },
  card: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    
    
    
    
    elevation: 4,
    borderWidth: 1,
    borderColor: palette.border,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
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
  },
  primaryButtonText: {
    fontWeight: '700',
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
    fontWeight: '600',
    fontSize: 14,
  },
  // Success state styles
  successCard: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    
    
    
    
    elevation: 4,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  successText: {
    fontSize: 14,
    textAlign: 'center',
  },
  emailText: {
    fontSize: 16,
    fontWeight: '600',
    marginVertical: spacing.sm,
  },
  successHint: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  resendButton: {
    marginTop: spacing.md,
  },
  resendText: {
    fontWeight: '600',
    fontSize: 14,
  },
});
