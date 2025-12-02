import React from 'react';
import { View, ViewStyle, StyleProp, Platform, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../contexts/ThemeContext';
import { radius } from '../theme/colors';

interface GlassViewProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  tint?: 'light' | 'dark' | 'default';
  gradient?: readonly string[];
}

export const GlassView: React.FC<GlassViewProps> = ({
  children,
  style,
  intensity = 20,
  tint,
  gradient,
}) => {
  const { isDark } = useTheme();
  
  const blurTint = tint || (isDark ? 'dark' : 'light');
  
  // Web fallback or customized gradient overlay
  const gradientColors = gradient || (isDark 
    ? ['rgba(30, 41, 59, 0.7)', 'rgba(15, 23, 42, 0.6)'] 
    : ['rgba(255, 255, 255, 0.7)', 'rgba(255, 255, 255, 0.4)']);

  const content = (
    <LinearGradient
      colors={gradientColors as any}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.gradient, style]}
    >
      <View style={[styles.border, { borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.4)' }]} />
      {children}
    </LinearGradient>
  );

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.container, style, { backdropFilter: `blur(${intensity}px)` } as any]}>
        {content}
      </View>
    );
  }

  return (
    <BlurView intensity={intensity} tint={blurTint} style={[styles.container, style]}>
      {content}
    </BlurView>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  gradient: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  border: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderRadius: radius.lg,
  },
});
