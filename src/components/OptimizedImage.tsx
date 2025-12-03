import React, { useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Image, ImageContentFit, ImageSource } from 'expo-image';
import { useTheme } from '../contexts/ThemeContext';

type Props = {
  source: string | ImageSource | null | undefined;
  style?: any;
  contentFit?: ImageContentFit;
  placeholder?: string | null;
  transition?: number;
  cachePolicy?: 'none' | 'disk' | 'memory' | 'memory-disk';
  recyclingKey?: string;
  onLoad?: () => void;
  onError?: () => void;
  accessibilityLabel?: string;
};

// Blurhash placeholder for loading state
const DEFAULT_BLURHASH = 'L6PZfSi_.AyE_3t7t7R**0o#DgR4';

/**
 * Optimized image component using expo-image
 * Features:
 * - Automatic caching (disk + memory)
 * - Blurhash placeholder for smooth loading
 * - Smooth transitions
 * - Error fallback
 * - Web compatibility
 */
export const OptimizedImage: React.FC<Props> = ({
  source,
  style,
  contentFit = 'cover',
  placeholder = DEFAULT_BLURHASH,
  transition = 200,
  cachePolicy = 'memory-disk',
  recyclingKey,
  onLoad,
  onError,
  accessibilityLabel,
}) => {
  const { colors, isDark } = useTheme();
  const [hasError, setHasError] = useState(false);

  // Handle null/undefined source
  if (!source || hasError) {
    return (
      <View style={[styles.fallback, style, { backgroundColor: isDark ? '#334155' : '#e5e7eb' }]} />
    );
  }

  // Normalize source to ImageSource format
  const imageSource: ImageSource = typeof source === 'string' 
    ? { uri: source } 
    : source;

  return (
    <Image
      source={imageSource}
      style={style}
      contentFit={contentFit}
      placeholder={placeholder}
      placeholderContentFit="cover"
      transition={transition}
      cachePolicy={cachePolicy}
      recyclingKey={recyclingKey}
      onLoad={onLoad}
      onError={() => {
        setHasError(true);
        onError?.();
      }}
      accessibilityLabel={accessibilityLabel}
    />
  );
};

/**
 * Avatar-specific optimized image
 * Circular with proper sizing and fallback
 */
type AvatarProps = {
  source: string | null | undefined;
  size?: number;
  fallbackText?: string;
  fallbackColor?: string;
};

export const OptimizedAvatar: React.FC<AvatarProps> = ({
  source,
  size = 44,
  fallbackText = '?',
  fallbackColor,
}) => {
  const { isDark } = useTheme();
  const [hasError, setHasError] = useState(false);

  const avatarStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
  };

  // Generate color from text if not provided
  const getAvatarColor = (text: string): string => {
    const colors = ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444'];
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = text.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const bgColor = fallbackColor || getAvatarColor(fallbackText);

  if (!source || hasError) {
    return (
      <View style={[styles.avatarFallback, avatarStyle, { backgroundColor: bgColor }]}>
        <View style={styles.avatarTextContainer}>
          <View style={[styles.avatarInitials, { width: size, height: size }]}>
            {/* Text would be rendered by parent component */}
          </View>
        </View>
      </View>
    );
  }

  return (
    <Image
      source={{ uri: source }}
      style={avatarStyle}
      contentFit="cover"
      placeholder={DEFAULT_BLURHASH}
      transition={150}
      cachePolicy="memory-disk"
      onError={() => setHasError(true)}
    />
  );
};

/**
 * Thumbnail image for lists with proper sizing
 */
type ThumbnailProps = {
  source: string | null | undefined;
  width?: number;
  height?: number;
  borderRadius?: number;
};

export const OptimizedThumbnail: React.FC<ThumbnailProps> = ({
  source,
  width = 80,
  height = 80,
  borderRadius = 8,
}) => {
  const { isDark } = useTheme();
  const [hasError, setHasError] = useState(false);

  const thumbnailStyle = {
    width,
    height,
    borderRadius,
  };

  if (!source || hasError) {
    return (
      <View 
        style={[
          styles.fallback, 
          thumbnailStyle, 
          { backgroundColor: isDark ? '#334155' : '#e5e7eb' }
        ]} 
      />
    );
  }

  return (
    <Image
      source={{ uri: source }}
      style={thumbnailStyle}
      contentFit="cover"
      placeholder={DEFAULT_BLURHASH}
      transition={200}
      cachePolicy="memory-disk"
      onError={() => setHasError(true)}
    />
  );
};

const styles = StyleSheet.create({
  fallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarFallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarTextContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default OptimizedImage;
