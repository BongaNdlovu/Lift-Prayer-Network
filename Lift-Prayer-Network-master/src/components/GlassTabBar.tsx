/**
 * GlassTabBar - Simple bottom navigation (Medium-style)
 * Replaces glassmorphism with clean, bordered design
 */
import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { fonts } from '../theme/colors';
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

export const GlassTabBar: React.FC<BottomTabBarProps> = ({ state, descriptors, navigation }) => {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
      {state.routes.map((route, index) => {
        const isFocused = state.index === index;
        const icons = TAB_ICONS[route.name] || { active: 'ellipse', inactive: 'ellipse-outline' };

        const onPress = () => {
          selectionFeedback();
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
        };

        return (
          <TouchableOpacity key={route.key} onPress={onPress} style={styles.tabButton}>
            <Ionicons
              name={isFocused ? icons.active : icons.inactive}
              size={20}
              color={isFocused ? colors.accentDark : colors.muted}
            />
            <Text style={[styles.label, { color: isFocused ? colors.accentDark : colors.muted }]}>
              {route.name}
            </Text>
          </TouchableOpacity>
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
    height: 76,
    borderTopWidth: 1,
    flexDirection: 'row',
    paddingBottom: 8,
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
  label: {
    fontFamily: fonts.body,
    fontSize: 11,
  },
});

export default GlassTabBar;
