import React, { useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../contexts/ThemeContext';
import { fonts, radius } from '../../theme/colors';
import { LiftScreen, LiftLogo, LiftCard, LiftButton } from '../../components/LiftLayout';
import { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'SignIn'>;

export const SignInScreen: React.FC<Props> = ({ navigation }) => {
  const { signIn, signInGuest } = useAuth();
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
            { text: 'Forgot Password', onPress: () => navigation.navigate('ForgotPassword') },
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

  return (
    <LiftScreen scroll contentStyle={styles.screenContent}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        <View style={styles.header}>
          <LiftLogo />
          <Text style={[styles.tagline, { color: colors.muted }]}>live network of prayer</Text>
        </View>

        <LiftCard style={styles.card}>
          <Text style={[styles.title, { color: colors.text }]}>Sign In</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>Simple, familiar, and trustworthy sign-in.</Text>

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
              placeholder="Enter your password"
              placeholderTextColor={colors.muted}
              secureTextEntry={!showPassword}
              textContentType="password"
              autoComplete="password"
              style={[styles.input, styles.passwordInput, { color: colors.text }]}
              value={password}
              onChangeText={setPassword}
              editable={!loading}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton} disabled={loading}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.muted} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')} disabled={loading}>
            <Text style={[styles.forgotText, { color: colors.accentDark }]}>Forgot password?</Text>
          </TouchableOpacity>

          <LiftButton onPress={handleSignIn} disabled={loading}>{loading ? 'Signing in...' : 'Sign In'}</LiftButton>
          <LiftButton onPress={handleGuestSignIn} variant="secondary" disabled={loading}>Continue as guest</LiftButton>

          <View style={styles.signUpContainer}>
            <Text style={[styles.signUpText, { color: colors.muted }]}>Don&apos;t have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('SignUp')} disabled={loading}>
              <Text style={[styles.signUpLink, { color: colors.accentDark }]}>Sign up</Text>
            </TouchableOpacity>
          </View>
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
  forgotText: {
    fontFamily: fonts.bodyMedium,
    fontWeight: '600',
    textAlign: 'right',
    marginBottom: 24,
    fontSize: 14,
  },
  signUpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  signUpText: {
    fontFamily: fonts.body,
    fontSize: 14,
  },
  signUpLink: {
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
    fontSize: 14,
  },
});
