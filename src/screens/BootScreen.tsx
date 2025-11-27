import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { palette } from '../theme/colors';

export const BootScreen: React.FC = () => {
  return (
    <LinearGradient
      colors={['#0a0a0a', '#111827']}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <View style={styles.logoBox}>
        <View style={styles.crossVertical} />
        <View style={styles.crossHorizontal} />
      </View>
      <Text style={styles.title}>LIFT</Text>
      <Text style={styles.subtitle}>System Initialization</Text>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  logoBox: {
    width: 96,
    height: 96,
    borderColor: palette.accent,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  crossVertical: {
    position: 'absolute',
    width: 6,
    height: 68,
    backgroundColor: palette.accent,
  },
  crossHorizontal: {
    position: 'absolute',
    height: 6,
    width: 68,
    backgroundColor: palette.accent,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: '#f9fafb',
    letterSpacing: 4,
  },
  subtitle: {
    fontSize: 12,
    color: '#eab308',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
});
