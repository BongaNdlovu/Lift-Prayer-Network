/**
 * Reusable gradient background components for bold diagonal aesthetics
 * Supports both light and dark modes with dramatic color transitions
 */
import React from 'react';
import { StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../contexts/ThemeContext';

type GradientType = 
  | 'screen'      // Full screen background
  | 'card'        // Card/container background
  | 'header'      // Header sections
  | 'button'      // Button backgrounds
  | 'accent'      // Accent highlights
  | 'overlay'     // Semi-transparent overlay
  | 'fade';       // Fade to transparent

type DiagonalDirection = 
  | 'topLeftToBottomRight'
  | 'topRightToBottomLeft'
  | 'bottomLeftToTopRight'
  | 'bottomRightToTopLeft';

interface GradientBackgroundProps {
  type?: GradientType;
  direction?: DiagonalDirection;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  intensity?: 'subtle' | 'normal' | 'bold';
  customColors?: readonly string[];
}

// Direction coordinates for diagonal gradients
const directionCoords: Record<DiagonalDirection, { start: { x: number; y: number }; end: { x: number; y: number } }> = {
  topLeftToBottomRight: { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } },
  topRightToBottomLeft: { start: { x: 1, y: 0 }, end: { x: 0, y: 1 } },
  bottomLeftToTopRight: { start: { x: 0, y: 1 }, end: { x: 1, y: 0 } },
  bottomRightToTopLeft: { start: { x: 1, y: 1 }, end: { x: 0, y: 0 } },
};

/**
 * Main gradient background component with diagonal support
 */
export const GradientBackground: React.FC<GradientBackgroundProps> = ({
  type = 'screen',
  direction = 'topLeftToBottomRight',
  style,
  children,
  intensity = 'normal',
  customColors,
}) => {
  const { colors } = useTheme();
  
  // Get gradient colors based on type
  const getGradientColors = (): readonly string[] => {
    if (customColors) return customColors;
    
    switch (type) {
      case 'screen':
        return intensity === 'bold' ? colors.gradientBoldScreen : colors.screenGradient;
      case 'card':
        return intensity === 'bold' ? colors.gradientBoldCard : colors.cardGradient;
      case 'header':
        return colors.gradientBoldHeader;
      case 'button':
        return colors.gradientBoldButton;
      case 'accent':
        return colors.gradientBoldAccent;
      case 'overlay':
        return colors.gradientOverlay;
      case 'fade':
        return colors.gradientFade;
      default:
        return colors.gradientBoldScreen;
    }
  };

  const gradientColors = getGradientColors();
  const coords = directionCoords[direction];

  // Ensure we have at least 2 colors for LinearGradient
  const safeColors = gradientColors.length >= 2 
    ? [...gradientColors] as [string, string, ...string[]]
    : [gradientColors[0] || colors.background, gradientColors[0] || colors.surface] as [string, string];

  return (
    <LinearGradient
      colors={safeColors}
      start={coords.start}
      end={coords.end}
      style={[styles.gradient, style]}
    >
      {children}
    </LinearGradient>
  );
};

/**
 * Screen-level gradient wrapper
 */
export const ScreenGradient: React.FC<{
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  bold?: boolean;
}> = ({ children, style, bold = true }) => (
  <GradientBackground
    type="screen"
    intensity={bold ? 'bold' : 'normal'}
    direction="topLeftToBottomRight"
    style={[styles.fullScreen, style]}
  >
    {children}
  </GradientBackground>
);

/**
 * Card gradient wrapper
 */
export const CardGradient: React.FC<{
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  direction?: DiagonalDirection;
}> = ({ children, style, direction = 'topLeftToBottomRight' }) => (
  <GradientBackground
    type="card"
    intensity="bold"
    direction={direction}
    style={style}
  >
    {children}
  </GradientBackground>
);

/**
 * Header gradient wrapper
 */
export const HeaderGradient: React.FC<{
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}> = ({ children, style }) => (
  <GradientBackground
    type="header"
    direction="topLeftToBottomRight"
    style={style}
  >
    {children}
  </GradientBackground>
);

/**
 * Button gradient wrapper
 */
export const ButtonGradient: React.FC<{
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}> = ({ children, style }) => (
  <GradientBackground
    type="button"
    direction="topLeftToBottomRight"
    style={style}
  >
    {children}
  </GradientBackground>
);

/**
 * Accent highlight gradient
 */
export const AccentGradient: React.FC<{
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  direction?: DiagonalDirection;
}> = ({ children, style, direction = 'topLeftToBottomRight' }) => (
  <GradientBackground
    type="accent"
    direction={direction}
    style={style}
  >
    {children}
  </GradientBackground>
);

/**
 * Overlay gradient for depth effects
 */
export const OverlayGradient: React.FC<{
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  direction?: DiagonalDirection;
}> = ({ children, style, direction = 'bottomLeftToTopRight' }) => (
  <GradientBackground
    type="overlay"
    direction={direction}
    style={[styles.overlay, style]}
  >
    {children}
  </GradientBackground>
);

/**
 * Fade gradient (e.g., for scroll fade effects)
 */
export const FadeGradient: React.FC<{
  style?: StyleProp<ViewStyle>;
  direction?: DiagonalDirection;
}> = ({ style, direction = 'bottomLeftToTopRight' }) => (
  <GradientBackground
    type="fade"
    direction={direction}
    style={[styles.fade, style]}
  />
);

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  fullScreen: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  fade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 100,
  },
});
