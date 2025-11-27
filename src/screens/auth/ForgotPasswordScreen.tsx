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
import { palette, radius, spacing } from '../../theme/colors';
import { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../hooks/useAuth';

type Props = NativeStackScreenProps<RootStackParamList, 'ForgotPassword'>;

export const ForgotPasswordScreen: React.FC<Props> = ({ navigation }) => {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email) {
      Alert.alert('Email required', 'Enter the account email.');
      return;
    }
    setLoading(true);
    try {
      await resetPassword(email);
      Alert.alert('Email sent', 'Check your inbox for reset instructions.');
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Reset failed', err.message ?? 'Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Reset password</Text>
        <TextInput
          placeholder="Email"
          placeholderTextColor={palette.muted}
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.input}
          value={email}
          onChangeText={setEmail}
        />
        <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Sending...' : 'Send reset link'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.link} onPress={() => navigation.goBack()}>
          <Text style={styles.linkText}>Back</Text>
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
    justifyContent: 'center',
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
