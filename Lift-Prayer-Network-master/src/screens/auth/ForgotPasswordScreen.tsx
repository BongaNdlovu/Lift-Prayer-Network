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
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../contexts/ThemeContext';
import { fonts, radius } from '../../theme/colors';
import { LiftScreen, LiftCard, LiftButton, LiftHeader } from '../../components/LiftLayout';
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

  if (emailSent) {
    return (
      <LiftScreen contentStyle={styles.content}>
        <LiftCard style={styles.successCard}>
          <View style={styles.iconContainer}>
            <Ionicons name="mail" size={48} color={colors.accentDark} />
          </View>
          <Text style={[styles.successTitle, { color: colors.text }]}>Check Your Email</Text>
          <Text style={[styles.successText, { color: colors.muted }]}>
            We&apos;ve sent password reset instructions to:
          </Text>
          <Text style={[styles.emailText, { color: colors.text }]}>{email.trim()}</Text>
          <Text style={[styles.successHint, { color: colors.muted }]}>
            Don&apos;t forget to check your spam folder if you don&apos;t see the email.
          </Text>
          <LiftButton title="Back to Sign In" onPress={() => navigation.navigate('SignIn')} />
          <TouchableOpacity style={styles.resendButton} onPress={() => setEmailSent(false)}>
            <Text style={[styles.resendText, { color: colors.muted }]}>Didn&apos;t receive it? Try again</Text>
          </TouchableOpacity>
        </LiftCard>
      </LiftScreen>
    );
  }

  return (
    <LiftScreen scroll contentStyle={styles.screenContent}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        <LiftHeader title="Reset Password" onBack={() => navigation.goBack()} />

        <LiftCard style={styles.card}>
          <Text style={[styles.title, { color: colors.text }]}>Forgot Password?</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            Enter your email and we&apos;ll send you instructions to reset your password.
          </Text>

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
              autoFocus
            />
          </View>

          <LiftButton title="Send Reset Email" onPress={handleResetPassword} loading={loading} disabled={loading} />

          <TouchableOpacity style={styles.backToSignIn} onPress={() => navigation.navigate('SignIn')} disabled={loading}>
            <Ionicons name="arrow-back" size={16} color={colors.accentDark} />
            <Text style={[styles.backToSignInText, { color: colors.accentDark }]}>Back to Sign In</Text>
          </TouchableOpacity>
        </LiftCard>
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
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  card: {
    marginTop: 16,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 30,
    fontWeight: '500',
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    marginBottom: 24,
    lineHeight: 20,
  },
  inputContainer: {
    borderWidth: 1,
    borderRadius: radius.md,
    marginBottom: 24,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  input: {
    fontFamily: fonts.body,
    fontSize: 16,
  },
  backToSignIn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    gap: 4,
  },
  backToSignInText: {
    fontFamily: fonts.bodyMedium,
    fontWeight: '600',
    fontSize: 14,
  },
  successCard: {
    marginTop: 16,
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontFamily: fonts.heading,
    fontSize: 30,
    fontWeight: '500',
    marginBottom: 8,
  },
  successText: {
    fontFamily: fonts.body,
    fontSize: 14,
    textAlign: 'center',
  },
  emailText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
    fontWeight: '600',
    marginVertical: 12,
  },
  successHint: {
    fontFamily: fonts.body,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 24,
  },
  resendButton: {
    marginTop: 16,
  },
  resendText: {
    fontFamily: fonts.bodyMedium,
    fontWeight: '600',
    fontSize: 14,
  },
});
