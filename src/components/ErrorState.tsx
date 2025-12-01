import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette, radius, spacing } from '../theme/colors';

type Props = {
  title?: string;
  message?: string;
  onRetry?: () => void;
};

export const ErrorState: React.FC<Props> = ({ title = 'Something went wrong', message, onRetry }) => {
  return (
    <View style={styles.container}>
      <Ionicons name="alert-circle-outline" size={40} color={palette.muted} />
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {onRetry && (
        <TouchableOpacity style={styles.button} onPress={onRetry}>
          <Text style={styles.buttonText}>Try Again</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: palette.background,
  },
  title: {
    marginTop: spacing.sm,
    fontSize: 18,
    fontWeight: '700',
    color: palette.text,
    textAlign: 'center',
  },
  message: {
    marginTop: spacing.xs,
    fontSize: 14,
    color: palette.muted,
    textAlign: 'center',
  },
  button: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: palette.accent,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
});

