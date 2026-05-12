/**
 * GlassTabBar - Floating glassmorphism bottom navigation
 * Creates a modern, translucent tab bar with soft shadows and animations
 */
import React from 'react';
import { View, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { shadows } from '../theme/colors';
import { selectionFeedback } from '../utils/haptics';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

// Icon mapping for tab routes
const TAB_ICONS: Record<string, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
  Home: { active: 'home', inactive: 'home-outline' },
  Prayers: { active: 'heart', inactive: 'heart-outline' },
  Calendar: { active: 'calendar', inactive: 'calendar-outline' },
  Community: { active: 'people', inactive: 'people-outline' },
  Profile: { active: 'person', inactive: 'person-outline' },
};

export const GlassTabBar: React.FC<BottomTabBarProps> = ({
  state,
  descriptors,
  navigation,
}) => {
  const { colors, isDark } = useTheme();

  return (
    <View style={styles.container}>
      {Platform.OS === 'ios' ? (
        <BlurView
          intensity={80}
          tint={isDark ? 'dark' : 'light'}
          style={styles.blurContainer}
        >
          <View style={[
            styles.tabBarInner,
            { backgroundColor: isDark ? 'rgba(30,41,59,0.6)' : 'rgba(255,255,255,0.6)' }
          ]}>
            <TabBarContent
              state={state}
              descriptors={descriptors}
              navigation={navigation}
              colors={colors}
              isDark={isDark}
            />
          </View>
        </BlurView>
      ) : (
        // Android fallback - no blur, just translucent background
        <View style={[
          styles.tabBar,
          {
            backgroundColor: isDark ? 'rgba(30,41,59,0.95)' : 'rgba(255,255,255,0.95)',
            borderColor: isDark ? colors.glassBorder : 'rgba(255,255,255,0.5)',
          }
        ]}>
          <TabBarContent
            state={state}
            descriptors={descriptors}
            navigation={navigation}
            colors={colors}
            isDark={isDark}
          />
        </View>
      )}
    </View>
  );
};

// Separate component for tab bar content to avoid duplication
const TabBarContent: React.FC<{
  state: BottomTabBarProps['state'];
  descriptors: BottomTabBarProps['descriptors'];
  navigation: BottomTabBarProps['navigation'];
  colors: any;
  isDark: boolean;
}> = ({ state, descriptors, navigation, colors, isDark }) => {
  return (
    <View style={styles.tabsContainer}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;

        const onPress = () => {
          selectionFeedback(); // Haptic feedback on tab switch
          
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        const onLongPress = () => {
          navigation.emit({
            type: 'tabLongPress',
            target: route.key,
          });
        };

        const icons = TAB_ICONS[route.name] || { active: 'ellipse', inactive: 'ellipse-outline' };
        const iconName = isFocused ? icons.active : icons.inactive;
        const iconColor = isFocused ? colors.accentDark : colors.muted;

        return (
          <TouchableOpacity
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            onPress={onPress}
            onLongPress={onLongPress}
            style={styles.tabButton}
            activeOpacity={0.7}
          >
            <View style={[
              styles.iconContainer,
              isFocused && styles.iconContainerActive,
            ]}>
              <Ionicons
                name={iconName}
                size={24}
                color={iconColor}
              />
            </View>
            {isFocused && (
              <View style={[styles.activeIndicator, { backgroundColor: colors.accentDark }]} />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    right: 24,
    zIndex: 50,
  },
  blurContainer: {
    borderRadius: 28,
    overflow: 'hidden',
    ...shadows.glassNav,
  },
  tabBarInner: {
    flex: 1,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(63,95,59,0.12)',
  },
  tabBar: {
    height: 64,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(63,95,59,0.12)',
    ...shadows.glassNav,
  },
  tabsContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    height: 64,
  },
  tabButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    position: 'relative',
  },
  iconContainer: {
    padding: 4,
    borderRadius: 12,
  },
  iconContainerActive: {
    transform: [{ scale: 1.1 }],
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 0,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});

export default GlassTabBar;
