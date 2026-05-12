/**
 * GlassCard - Glassmorphism card component for the cinematic design system
 * Features translucent backgrounds, subtle borders, and soft shadows
 */
import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp, Pressable, Animated } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { radius, fonts, fontSizes, spacing } from '../theme/colors';
import { lightImpact, selectionFeedback } from '../utils/haptics';

interface GlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Press handler - makes the card pressable */
  onPress?: () => void;
  /** Long press handler */
  onLongPress?: () => void;
  /** Card variant */
  variant?: 'default' | 'elevated' | 'flat' | 'urgent';
  /** Border radius size */
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
  /** Padding size */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** Whether to show hover/press animation */
  animated?: boolean;
  /** Disabled state */
  disabled?: boolean;
}

const PADDING_MAP = {
  none: 0,
  sm: 12,
  md: 16,
  lg: 24,
};

const RADIUS_MAP = {
  sm: radius.sm,
  md: radius.md,
  lg: radius.lg,
  xl: radius.xl,
  xxl: radius.xxl,
};

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  style,
  onPress,
  onLongPress,
  variant = 'default',
  rounded = 'xxl',
  padding = 'lg',
  animated = true,
  disabled = false,
}) => {
  const { colors, isDark } = useTheme();
  const scaleAnim = React.useRef(new Animated.Value(1)).current;
  
  const getBackgroundColor = () => {
    switch (variant) {
      case 'elevated':
        return isDark ? colors.glassWhiteStrong : 'rgba(255,255,255,0.8)';
      case 'flat':
        return isDark ? colors.glassWhiteLight : 'rgba(255,255,255,0.5)';
      case 'urgent':
        return isDark ? 'rgba(127,29,29,0.8)' : 'rgba(254,242,242,0.9)';
      default:
        return isDark ? colors.glassWhite : 'rgba(255,255,255,0.7)';
    }
  };
  
  const getBorderColor = () => {
    switch (variant) {
      case 'urgent':
        return isDark ? 'rgba(248,113,113,0.3)' : 'rgba(239,68,68,0.2)';
      default:
        return colors.glassBorder;
    }
  };
  
  const getShadow = () => {
    // Clean look - minimal shadows
    return {};
  };
  
  const handlePressIn = () => {
    if (!animated || disabled) return;
    lightImpact(); // Haptic feedback on press
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      useNativeDriver: true,
      friction: 8,
    }).start();
  };
  
  const handlePressOut = () => {
    if (!animated || disabled) return;
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 8,
    }).start();
  };
  
  const cardStyle: ViewStyle = {
    backgroundColor: getBackgroundColor(),
    borderRadius: RADIUS_MAP[rounded],
    borderWidth: 1,
    borderColor: getBorderColor(),
    padding: PADDING_MAP[padding],
    ...getShadow(),
  };
  
  const content = (
    <View style={[styles.cardInner, cardStyle, style]}>
      {children}
    </View>
  );
  
  if (onPress || onLongPress) {
    return (
      <Pressable
        onPress={disabled ? undefined : onPress}
        onLongPress={disabled ? undefined : onLongPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
      >
        <Animated.View style={{ transform: [{ scale: scaleAnim }], opacity: disabled ? 0.6 : 1 }}>
          {content}
        </Animated.View>
      </Pressable>
    );
  }
  
  return content;
};

/**
 * Glass stat card for displaying metrics
 */
interface GlassStatCardProps {
  value: string | number;
  label: string;
  style?: StyleProp<ViewStyle>;
  accent?: boolean;
}

export const GlassStatCard: React.FC<GlassStatCardProps> = ({
  value,
  label,
  style,
  accent = false,
}) => {
  const { colors, isDark } = useTheme();
  
  const backgroundColor = accent
    ? isDark 
      ? 'rgba(120,53,15,0.5)' 
      : 'rgba(251,191,36,0.15)'
    : isDark 
      ? colors.glassWhiteLight 
      : 'rgba(255,255,255,0.3)';
  
  return (
    <View
      style={[
        styles.statCard,
        {
          backgroundColor,
          borderColor: accent 
            ? isDark ? colors.amber600 : 'rgba(251,191,36,0.3)'
            : colors.glassBorderLight,
        },
        style,
      ]}
    >
      {/* Decorative glow for accent cards */}
      {accent && (
        <View style={styles.statCardGlow} />
      )}
      <View style={styles.statCardContent}>
        <Animated.Text style={[styles.statValue, { color: colors.stone900 }]}>
          {value}
        </Animated.Text>
        <Animated.Text style={[styles.statLabel, { color: colors.stone500 }]}>
          {label}
        </Animated.Text>
      </View>
    </View>
  );
};

/**
 * Glass chip/pill component for filters and categories
 */
interface GlassChipProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  active?: boolean;
  onPress?: () => void;
  icon?: React.ReactNode;
}

export const GlassChip: React.FC<GlassChipProps> = ({
  children,
  style,
  active = false,
  onPress,
  icon,
}) => {
  const { colors, isDark } = useTheme();
  
  const backgroundColor = active
    ? isDark ? colors.stone100 : colors.stone900
    : isDark ? colors.glassWhiteLight : 'rgba(255,255,255,0.5)';
  
  const borderColor = active
    ? isDark ? colors.stone100 : colors.stone900
    : 'transparent';
  
  const content = (
    <View
      style={[
        styles.chip,
        {
          backgroundColor,
          borderColor,
        },
        active && styles.chipActive,
        style,
      ]}
    >
      {icon && <View style={styles.chipIcon}>{icon}</View>}
      {children}
    </View>
  );
  
  if (onPress) {
    return (
      <Pressable 
        onPress={() => {
          selectionFeedback(); // Haptic feedback on chip tap
          onPress();
        }}
      >
        {content}
      </Pressable>
    );
  }
  
  return content;
};

/**
 * Glass icon button
 */
interface GlassIconButtonProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  size?: 'sm' | 'md' | 'lg';
  badge?: number;
}

export const GlassIconButton: React.FC<GlassIconButtonProps> = ({
  children,
  style,
  onPress,
  size = 'md',
  badge,
}) => {
  const { colors } = useTheme();
  
  const sizeMap = {
    sm: 36,
    md: 44,
    lg: 52,
  };
  
  const buttonSize = sizeMap[size];
  
  const handlePress = () => {
    lightImpact(); // Haptic feedback on icon button tap
    onPress?.();
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.iconButton,
        {
          width: buttonSize,
          height: buttonSize,
          borderRadius: buttonSize / 2,
          backgroundColor: pressed 
            ? colors.glassWhiteStrong 
            : colors.glassWhiteLight,
          borderColor: colors.glassBorderLight,
        },
        style,
      ]}
    >
      {children}
      {badge !== undefined && badge > 0 && (
        <View style={styles.badge}>
          <Animated.Text style={styles.badgeText}>
            {badge > 99 ? '99+' : badge}
          </Animated.Text>
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  cardInner: {
    overflow: 'hidden',
  },
  statCard: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  statCardGlow: {
    position: 'absolute',
    top: -12,
    right: -12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.4)',
    transform: [{ scale: 2 }],
  },
  statCardContent: {
    alignItems: 'center',
    zIndex: 1,
  },
  statValue: {
    fontSize: fontSizes.lg,
    fontFamily: fonts.heading,
    fontWeight: '600',
  },
  statLabel: {
    fontSize: fontSizes.xs - 3,
    fontWeight: '600',
    fontFamily: fonts.bodyMedium,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  chipActive: {
    // Clean look - no shadow
  },
  chipIcon: {
    marginRight: spacing.xs,
  },
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: '#f43f5e',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  badgeText: {
    color: '#fff',
    fontSize: fontSizes.xs - 3,
    fontWeight: '700',
    fontFamily: fonts.bodyBold,
  },
});

export default GlassCard;
