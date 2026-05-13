import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightPalette, darkPalette, setPalette, type ThemePalette, spacing, radius } from '../theme/colors';

const THEME_KEY = '@lift_theme_preference';

type ThemeMode = 'light' | 'system';

type ThemeContextValue = {
  isDark: boolean;
  themeMode: ThemeMode;
  colors: ThemePalette;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  // Common dynamic styles for quick use
  styles: ReturnType<typeof createDynamicStyles>;
};

// Create dynamic styles that respond to theme changes
const createDynamicStyles = (colors: ThemePalette, isDark: boolean) => StyleSheet.create({
  // Containers
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  surface: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  surfaceSecondary: {
    backgroundColor: colors.surfaceSecondary,
  },
  // Text
  text: {
    color: colors.text,
  },
  textSecondary: {
    color: colors.textSecondary,
  },
  textMuted: {
    color: colors.muted,
  },
  textAccent: {
    color: colors.accent,
  },
  textDanger: {
    color: colors.danger,
  },
  textSuccess: {
    color: colors.success,
  },
  // Headers
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  // Cards
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  // Buttons
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Inputs
  input: {
    backgroundColor: colors.surface,
    color: colors.text,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  // Section styles
  section: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.md,
  },
  // Divider
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  // Info/Warning boxes
  infoBox: {
    backgroundColor: colors.accentLight,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  dangerBox: {
    backgroundColor: colors.dangerLight,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  successBox: {
    backgroundColor: colors.successLight,
    borderRadius: radius.md,
    padding: spacing.md,
  },
});

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>('light');
  // Force light mode for consistent brand during overhaul
  const isDark = false;

  const colors = isDark ? darkPalette : lightPalette;

  // Update global palette when theme changes
  useEffect(() => {
    setPalette(isDark);
  }, [isDark]);

  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    setThemeModeState(mode);
    try {
      await AsyncStorage.setItem(THEME_KEY, mode);
    } catch (err) {
      console.warn('Error saving theme preference:', err);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeMode('light');
  }, [setThemeMode]);

  // Create dynamic styles that update when theme changes
  const styles = useMemo(() => createDynamicStyles(colors, isDark), [colors, isDark]);

  // Always render immediately with system theme as default
  // This prevents the blank flash on fresh install
  return (
    <ThemeContext.Provider value={{ isDark, themeMode, colors, setThemeMode, toggleTheme, styles }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
};
