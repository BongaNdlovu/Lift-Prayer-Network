import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { fonts, shadows } from '../theme/colors';
import { LiftBottomSheet } from './LiftLayout';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

const TAB_ICONS: Record<string, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
  Home: { active: 'home', inactive: 'home-outline' },
  Prayers: { active: 'book', inactive: 'book-outline' },
  Create: { active: 'add-circle', inactive: 'add-circle-outline' },
  People: { active: 'people', inactive: 'people-outline' },
  Profile: { active: 'person', inactive: 'person-outline' },
};

const CREATE_ACTIONS: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route?: string;
}[] = [
  { label: 'Create Request', icon: 'create-outline', route: 'CreateRequest' },
  { label: 'Share Testimony', icon: 'sparkles-outline', route: 'CreateTestimony' },
  { label: 'Devotional', icon: 'book-outline', route: 'Devotions' },
  { label: 'Invite Friends', icon: 'people-outline', route: 'People' },
];

export const GlassTabBar: React.FC<BottomTabBarProps> = ({ state, descriptors, navigation }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [showCreate, setShowCreate] = useState(false);
  const bottomInset = Math.max(insets.bottom, 8);

  const navigateFromSheet = (route?: string) => {
    setShowCreate(false);
    if (route) {
      navigation.navigate(route as never);
    }
  };

  return (
    <>
      <View
        pointerEvents="box-none"
        style={[
          styles.container,
          shadows.glassNav,
          {
            height: 70 + bottomInset,
            paddingBottom: bottomInset,
            backgroundColor: colors.surface,
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
            if (route.name === 'Create') {
              setShowCreate(true);
              return;
            }

            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const displayLabel = typeof label === 'string' ? label : route.name;

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel || displayLabel}
              testID={options.tabBarButtonTestID}
              hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
              onPress={onPress}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
              style={({ pressed }) => [styles.tabButton, pressed && styles.pressed]}
            >
              {isFocused ? <View style={[styles.activeBar, { backgroundColor: colors.accent }]} /> : null}
              <Ionicons
                name={isFocused ? icons.active : icons.inactive}
                size={route.name === 'Create' ? 25 : 21}
                color={isFocused || route.name === 'Create' ? colors.accent : colors.muted}
              />
              <Text style={[styles.label, { color: isFocused || route.name === 'Create' ? colors.accent : colors.muted }]}>
                {displayLabel}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <LiftBottomSheet visible={showCreate} onClose={() => setShowCreate(false)}>
        <Text style={[styles.sheetTitle, { color: colors.text }]}>Create</Text>
        <Text style={[styles.sheetSubtitle, { color: colors.textSecondary }]}>Start with what is on your heart.</Text>
        <View style={styles.sheetActions}>
          {CREATE_ACTIONS.map((action) => (
            <Pressable
              key={action.label}
              onPress={() => navigateFromSheet(action.route)}
              style={({ pressed }) => [styles.sheetAction, { backgroundColor: colors.surfaceSecondary }, pressed && styles.pressed]}
            >
              <View style={[styles.sheetIcon, { backgroundColor: colors.surface }]}>
                <Ionicons name={action.icon} size={20} color={colors.accent} />
              </View>
              <Text style={[styles.sheetActionText, { color: colors.text }]}>{action.label}</Text>
              <Ionicons name="arrow-forward" size={18} color={colors.muted} />
            </Pressable>
          ))}
        </View>
      </LiftBottomSheet>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    paddingTop: 8,
    paddingHorizontal: 8,
  },
  tabButton: {
    flex: 1,
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  pressed: {
    opacity: 0.76,
    transform: [{ scale: 0.97 }],
  },
  activeBar: {
    position: 'absolute',
    top: 0,
    width: 22,
    height: 3,
    borderRadius: 2,
  },
  label: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
  },
  sheetTitle: {
    fontFamily: fonts.heading,
    fontSize: 28,
    letterSpacing: 0,
  },
  sheetSubtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    marginTop: 2,
    marginBottom: 18,
  },
  sheetActions: {
    gap: 10,
    marginTop: 4,
    paddingBottom: 12,
  },
  sheetAction: {
    minHeight: 58,
    borderRadius: 16,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sheetIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetActionText: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
  },
});

export default GlassTabBar;

