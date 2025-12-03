/**
 * CinematicBackground - Warm glassmorphism background with ambient glow effects
 * Creates a film-like aesthetic with warm orange/amber gradients and soft glows
 */
import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useTheme } from '../contexts/ThemeContext';

interface CinematicBackgroundProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Show the warm glow effects */
  showGlow?: boolean;
  /** Intensity of the glow (0-1) */
  glowIntensity?: number;
  /** Use the outer (darker) background color */
  useOuterBackground?: boolean;
}

/**
 * Main cinematic background with warm ambient glows
 */
export const CinematicBackground: React.FC<CinematicBackgroundProps> = ({
  children,
  style,
  showGlow = true,
  glowIntensity = 1,
  useOuterBackground = false,
}) => {
  const { colors, isDark } = useTheme();
  
  const backgroundColor = useOuterBackground 
    ? colors.cinematicBackgroundOuter 
    : colors.cinematicBackground;

  return (
    <View style={[styles.container, { backgroundColor }, style]}>
      {/* Top-left warm glow */}
      {showGlow && (
        <LinearGradient
          colors={[
            colors.warmGlowTop,
            colors.warmGlowTopLight,
            'transparent',
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.glowTopLeft,
            { opacity: glowIntensity },
          ]}
        />
      )}
      
      {/* Bottom-right rose/warm glow */}
      {showGlow && (
        <LinearGradient
          colors={[
            colors.warmGlowBottom,
            colors.warmGlowBottomLight,
            'transparent',
          ]}
          start={{ x: 1, y: 1 }}
          end={{ x: 0, y: 0 }}
          style={[
            styles.glowBottomRight,
            { opacity: glowIntensity },
          ]}
        />
      )}
      
      {/* Content */}
      {children}
    </View>
  );
};

/**
 * Glass panel component for cards and containers
 */
interface GlassPanelProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: 'light' | 'medium' | 'strong';
  borderRadius?: number;
}

export const GlassPanel: React.FC<GlassPanelProps> = ({
  children,
  style,
  intensity = 'medium',
  borderRadius = 32,
}) => {
  const { colors, isDark } = useTheme();
  
  const getBackgroundColor = () => {
    switch (intensity) {
      case 'light': return colors.glassWhiteLight;
      case 'strong': return colors.glassWhiteStrong;
      default: return colors.glassWhite;
    }
  };
  
  const blurIntensity = Platform.OS === 'ios' 
    ? (intensity === 'strong' ? 80 : intensity === 'light' ? 30 : 50)
    : 0; // BlurView doesn't work well on Android

  // On Android, use a semi-transparent background instead
  if (Platform.OS === 'android') {
    return (
      <View
        style={[
          styles.glassPanel,
          {
            backgroundColor: getBackgroundColor(),
            borderRadius,
            borderColor: colors.glassBorder,
          },
          style,
        ]}
      >
        {children}
      </View>
    );
  }

  return (
    <BlurView
      intensity={blurIntensity}
      tint={isDark ? 'dark' : 'light'}
      style={[
        styles.glassPanel,
        {
          borderRadius,
          borderColor: colors.glassBorder,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <View style={[styles.glassPanelInner, { backgroundColor: getBackgroundColor() }]}>
        {children}
      </View>
    </BlurView>
  );
};

/**
 * Glass button component
 */
interface GlassButtonProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  active?: boolean;
}

export const GlassButton: React.FC<GlassButtonProps> = ({
  children,
  style,
  active = false,
}) => {
  const { colors } = useTheme();
  
  return (
    <View
      style={[
        styles.glassButton,
        {
          backgroundColor: active ? colors.glassWhiteStrong : colors.glassWhiteLight,
          borderColor: colors.glassBorderLight,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
};

/**
 * Rounded page container (the main content area with rounded top)
 */
interface RoundedPageProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export const RoundedPage: React.FC<RoundedPageProps> = ({
  children,
  style,
}) => {
  const { colors, isDark } = useTheme();
  
  return (
    <View
      style={[
        styles.roundedPage,
        {
          backgroundColor: isDark ? colors.glassWhite : 'rgba(255,255,255,0.6)',
          borderTopColor: colors.glassBorder,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
};

/**
 * Sticky header with glass effect
 */
interface GlassHeaderProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export const GlassHeader: React.FC<GlassHeaderProps> = ({
  children,
  style,
}) => {
  const { colors, isDark } = useTheme();
  
  return (
    <View
      style={[
        styles.glassHeader,
        {
          backgroundColor: isDark ? colors.glassWhiteStrong : 'rgba(255,255,255,0.8)',
          borderBottomColor: colors.glassBorderLight,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  glowTopLeft: {
    position: 'absolute',
    top: '-10%',
    left: '-20%',
    width: '120%',
    height: '60%',
    zIndex: 0,
  },
  glowBottomRight: {
    position: 'absolute',
    bottom: '-10%',
    right: '-20%',
    width: '100%',
    height: '50%',
    zIndex: 0,
  },
  glassPanel: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  glassPanelInner: {
    flex: 1,
  },
  glassButton: {
    borderWidth: 1,
    borderRadius: 9999,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundedPage: {
    flex: 1,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    borderTopWidth: 1,
    marginTop: -1,
    // Shadow for depth
    
    
    
    
    elevation: 10,
  },
  glassHeader: {
    borderBottomWidth: 0.5,
    paddingTop: 24,
    paddingBottom: 8,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
  },
});

export default CinematicBackground;
