/**
 * GlassTabBar - Simple bottom navigation (Medium-style)
 * Replaces glassmorphism with clean, bordered design
 */
import React from 'react';
import { View, StyleSheet, Pressable, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { fonts } from '../theme/colors';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

// Icon mapping for tab routes
const TAB_ICONS: Record<string, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
  Home: { active: 'home', inactive: 'home-outline' },
  Prayers: { active: 'heart', inactive: 'heart-outline' },
  Calendar: { active: 'calendar', inactive: 'calendar-outline' },
  Community: { active: 'people', inactive: 'people-outline' },
  Profile: { active: 'person', inactive: 'person-outline' },
};

export const GlassTabBar: React.FC<BottomTabBarProps> = ({ state, descriptors, navigation }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 8);

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.container,
        {
          height: 64 + bottomInset,
          paddingBottom: bottomInset,
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const isFocused = state.index === index;
        const { options } = descriptors[route.key];
        const icons = TAB_ICONS[route.name] || { active: 'ellipse', inactive: 'ellipse-outline' };
        const label =
          options.tabBarLabel !== undefined
            ? options.tabBarLabel
            : options.title !== undefined
            ? options.title
            : route.name;

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        const onLongPress = () => {
          navigation.emit({ type: 'tabLongPress', target: route.key });
        };

        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            testID={options.tabBarButtonTestID}
            hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
            onPress={onPress}
            onLongPress={onLongPress}
            style={({ pressed }) => [styles.tabButton, pressed && styles.tabButtonPressed]}
          >
            <Ionicons
              name={isFocused ? icons.active : icons.inactive}
              size={20}
              color={isFocused ? colors.accentDark : colors.muted}
            />
            <Text style={[styles.label, { color: isFocused ? colors.accentDark : colors.muted }]}>
              {typeof label === 'string' ? label : route.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    flexDirection: 'row',
    paddingTop: 6,
    paddingHorizontal: 10,
  },
  tabButton: {
    flex: 1,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  tabButtonPressed: {
    opacity: 0.72,
  },
  label: {
    fontFamily: fonts.body,
    fontSize: 11,
  },
});

export default GlassTabBar;
