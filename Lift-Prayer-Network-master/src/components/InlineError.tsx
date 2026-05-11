import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, spacing } from '../theme/colors';

type Props = {
  message: string;
  onDismiss?: () => void;
};

export const InlineError: React.FC<Props> = ({ message, onDismiss }) => {
  return (
    <View style={styles.container}>
      <Ionicons name="warning-outline" size={16} color="#b91c1c" />
      <Text style={styles.text} numberOfLines={3}>
        {message}
      </Text>
      {onDismiss && (
        <TouchableOpacity onPress={onDismiss}>
          <Ionicons name="close" size={16} color="#b91c1c" />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fecaca',
    gap: spacing.sm,
  },
  text: {
    flex: 1,
    fontSize: 13,
    color: '#b91c1c',
  },
});

