import { Platform } from 'react-native';

// Light theme palette
export const lightPalette = {
  // Core colors
  background: '#F7F3EA',
  surface: '#FFFDF8',
  surfaceSecondary: '#F0E8DA',
  surfaceDeep: '#E8DDCC',
  accent: '#3F5F3B',
  accentDark: '#2F4A2C',
  accentDeep: '#1F3320',
  accentLight: '#E8EFE2',
  text: '#1C1917',
  textSecondary: '#44403C',
  muted: '#78716C',
  border: '#DED6C8',
  danger: '#B42318',
  dangerLight: '#FDECEC',
  success: '#3F5F3B',
  successLight: '#E8EFE2',
  shadow: 'rgba(28,25,23,0.08)',

  // Cinematic Design System - Warm & Glassmorphism
  cinematicBackground: '#F7F3EA',
  cinematicBackgroundOuter: '#F3EDE2',

  // Glass effects
  glassWhite: 'rgba(255,253,248,0.88)',
  glassWhiteLight: 'rgba(255,253,248,0.62)',
  glassWhiteStrong: 'rgba(255,253,248,0.96)',
  glassBorder: 'rgba(63,95,59,0.12)',
  glassBorderLight: 'rgba(63,95,59,0.08)',

  // Stone palette (warm grays)
  stone900: '#1C1917',
  stone800: '#292524',
  stone700: '#44403C',
  stone600: '#57534E',
  stone500: '#78716C',
  stone400: '#A8A29E',
  stone300: '#D6D3D1',
  stone200: '#E7E5E4',
  stone100: '#FAFAF9',

  // Amber palette
  amber700: '#A86924',
  amber600: '#C7782A',
  amber500: '#D98A2B',
  amber400: '#E8A85C',
  amber300: '#F0C28A',
  amber200: '#F4D9B5',
  amber100: '#F8EEE0',

  // Orange palette
  orange600: '#B85F24',
  orange500: '#C7782A',
  orange400: '#E0A05A',
  orange300: '#F0C28A',

  // Rose palette
  rose600: '#A63D40',
  rose500: '#B85A5C',
  rose400: '#CC7A7C',
  rose300: '#E2ABAC',
  rose200: '#F0D4D4',
  rose100: '#F7E8E8',

  // Indigo palette (for badges)
  indigo700: '#3F5F3B',
  indigo100: 'rgba(63,95,59,0.12)',

  // Cinematic glow colors
  warmGlowTop: 'rgba(255,253,248,0.55)',
  warmGlowTopLight: 'rgba(232,239,226,0.35)',
  warmGlowBottom: 'rgba(216,138,43,0.12)',
  warmGlowBottomLight: 'rgba(63,95,59,0.08)',

  // Gradient colors - 3 color
  gradientWarm: ['#F7F3EA', '#F8EEE0', '#FFFDF8'] as const,
  gradientSunrise: ['#FFFDF8', '#F8EEE0', '#F0E8DA'] as const,
  gradientCool: ['#F7F3EA', '#E8EFE2', '#FFFDF8'] as const,
  gradientPurple: ['#F7F3EA', '#F0E8DA', '#FFFDF8'] as const,
  gradientSuccess: ['#E8EFE2', '#DDE8D8', '#F7F3EA'] as const,

  // Background gradients for screens
  screenGradient: ['#F7F3EA', '#FFFDF8', '#F0E8DA'] as const,
  cardGradient: ['#FFFDF8', '#F7F3EA'] as const,

  // Bold diagonal gradients - dramatic aesthetic
  gradientBoldScreen: ['#F7F3EA', '#FFFDF8', '#F0E8DA', '#E8EFE2', '#F7F3EA'] as const,
  gradientBoldCard: ['#FFFDF8', '#F7F3EA', '#F8EEE0', '#FFFDF8'] as const,
  gradientBoldAccent: ['#3F5F3B', '#2F4A2C', '#1F3320', '#3F5F3B'] as const,
  gradientBoldHeader: ['#FFFDF8', '#F7F3EA', '#E8EFE2', '#FFFDF8'] as const,
  gradientBoldButton: ['#3F5F3B', '#2F4A2C', '#1F3320'] as const,

  // Overlay gradients for depth
  gradientOverlay: ['rgba(247,243,234,0.96)', 'rgba(255,253,248,0.9)', 'rgba(232,239,226,0.55)', 'rgba(216,138,43,0.12)'] as const,
  gradientFade: ['rgba(255,253,248,1)', 'rgba(255,253,248,0.82)', 'rgba(255,253,248,0)'] as const,
};

// Dark theme palette
export const darkPalette = {
  // Core colors
  background: '#0f172a',
  surface: '#1e293b',
  surfaceSecondary: '#334155',
  surfaceDeep: '#0c1222',
  accent: '#fbbf24',
  accentDark: '#f59e0b',
  accentDeep: '#78350f',
  accentLight: '#422006',
  text: '#f8fafc',
  textSecondary: '#e2e8f0',
  muted: '#94a3b8',
  border: '#334155',
  danger: '#f87171',
  dangerLight: '#450a0a',
  success: '#34d399',
  successLight: '#052e16',
  shadow: 'rgba(0,0,0,0.3)',

  // Cinematic Design System - Dark Mode
  cinematicBackground: '#0f172a',
  cinematicBackgroundOuter: '#0a0f1a',
  
  // Glass effects (dark mode)
  glassWhite: 'rgba(30,41,59,0.8)',
  glassWhiteLight: 'rgba(30,41,59,0.5)',
  glassWhiteStrong: 'rgba(30,41,59,0.9)',
  glassBorder: 'rgba(51,65,85,0.6)',
  glassBorderLight: 'rgba(51,65,85,0.4)',
  
  // Stone palette (dark mode - inverted)
  stone900: '#fafaf9',
  stone800: '#f5f5f4',
  stone700: '#e7e5e4',
  stone600: '#d6d3d1',
  stone500: '#a8a29e',
  stone400: '#78716c',
  stone300: '#57534e',
  stone200: '#44403c',
  stone100: '#292524',
  
  // Amber palette (same in dark)
  amber700: '#b45309',
  amber600: '#d97706',
  amber500: '#f59e0b',
  amber400: '#fbbf24',
  amber300: '#fcd34d',
  amber200: '#fde68a',
  amber100: '#422006',
  
  // Orange palette
  orange600: '#ea580c',
  orange500: '#f97316',
  orange400: '#fb923c',
  orange300: '#fdba74',
  
  // Rose palette
  rose500: '#f43f5e',
  rose400: '#fb7185',
  rose300: '#fda4af',
  rose200: '#fecdd3',
  rose100: '#ffd7e0',
  rose600: '#e11d48',
  
  // Indigo palette (for badges)
  indigo700: '#818cf8',
  indigo100: 'rgba(99,102,241,0.3)',
  
  // Cinematic glow colors (dark mode)
  warmGlowTop: 'rgba(120,53,15,0.4)',
  warmGlowTopLight: 'rgba(146,64,14,0.3)',
  warmGlowBottom: 'rgba(120,53,15,0.3)',
  warmGlowBottomLight: 'rgba(146,64,14,0.2)',

  // Gradient colors - 3 color
  gradientWarm: ['#422006', '#451a03', '#431407'] as const,
  gradientSunrise: ['#1c1917', '#292524', '#44403c'] as const,
  gradientCool: ['#0c4a6e', '#075985', '#0369a1'] as const,
  gradientPurple: ['#2e1065', '#3b0764', '#4c1d95'] as const,
  gradientSuccess: ['#052e16', '#064e3b', '#065f46'] as const,
  
  // Background gradients for screens
  screenGradient: ['#0f172a', '#1e293b', '#1e1b4b'] as const,
  cardGradient: ['#1e293b', '#334155'] as const,

  // Bold diagonal gradients - dramatic aesthetic
  gradientBoldScreen: ['#0f172a', '#1e293b', '#422006', '#78350f', '#92400e'] as const,
  gradientBoldCard: ['#1e293b', '#334155', '#422006', '#78350f'] as const,
  gradientBoldAccent: ['#fbbf24', '#f59e0b', '#d97706', '#b45309'] as const,
  gradientBoldHeader: ['#1e293b', '#422006', '#78350f', '#92400e'] as const,
  gradientBoldButton: ['#fbbf24', '#f59e0b', '#d97706'] as const,
  
  // Overlay gradients for depth
  gradientOverlay: ['rgba(15,23,42,0.95)', 'rgba(30,41,59,0.8)', 'rgba(66,32,6,0.6)', 'rgba(120,53,15,0.4)'] as const,
  gradientFade: ['rgba(15,23,42,1)', 'rgba(15,23,42,0.8)', 'rgba(15,23,42,0)'] as const,
};

// Theme palette type
export type ThemePalette = {
  background: string;
  surface: string;
  surfaceSecondary: string;
  surfaceDeep: string;
  accent: string;
  accentDark: string;
  accentDeep: string;
  accentLight: string;
  text: string;
  textSecondary: string;
  muted: string;
  border: string;
  danger: string;
  dangerLight: string;
  success: string;
  successLight: string;
  shadow: string;
  // Cinematic colors
  cinematicBackground: string;
  cinematicBackgroundOuter: string;
  glassWhite: string;
  glassWhiteLight: string;
  glassWhiteStrong: string;
  glassBorder: string;
  glassBorderLight: string;
  // Stone palette
  stone900: string;
  stone800: string;
  stone700: string;
  stone600: string;
  stone500: string;
  stone400: string;
  stone300: string;
  stone200: string;
  stone100: string;
  // Amber palette
  amber700: string;
  amber600: string;
  amber500: string;
  amber400: string;
  amber300: string;
  amber200: string;
  amber100: string;
  // Orange palette
  orange600: string;
  orange500: string;
  orange400: string;
  orange300: string;
  // Rose palette
  rose600: string;
  rose500: string;
  rose400: string;
  rose300: string;
  rose200: string;
  rose100: string;
  // Indigo palette
  indigo700: string;
  indigo100: string;
  // Glow colors
  warmGlowTop: string;
  warmGlowTopLight: string;
  warmGlowBottom: string;
  warmGlowBottomLight: string;
  // 3-color gradients
  gradientWarm: readonly [string, string, string];
  gradientSunrise: readonly [string, string, string];
  gradientCool: readonly [string, string, string];
  gradientPurple: readonly [string, string, string];
  gradientSuccess: readonly [string, string, string];
  screenGradient: readonly [string, string, string];
  cardGradient: readonly [string, string];
  // Bold diagonal gradients
  gradientBoldScreen: readonly [string, string, string, string, string];
  gradientBoldCard: readonly [string, string, string, string];
  gradientBoldAccent: readonly [string, string, string, string];
  gradientBoldHeader: readonly [string, string, string, string];
  gradientBoldButton: readonly [string, string, string];
  // Overlay gradients
  gradientOverlay: readonly [string, string, string, string];
  gradientFade: readonly [string, string, string];
};

// Default export for backward compatibility (will be overridden by ThemeContext)
export let palette: ThemePalette = lightPalette;

// Function to update palette (called by ThemeContext)
export const setPalette = (isDark: boolean) => {
  palette = isDark ? darkPalette : lightPalette;
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  full: 9999,
};

export const brand = {
  appName: 'Lift',
  tagline: 'live network of prayer',
};

export const mediumLayout = {
  screenPadding: 20,
  cardRadius: 18,
  inputRadius: 10,
  headerTopPadding: 16,
  bottomTabHeight: 72,
};

// Glassmorphism styles
export const glass = {
  light: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    backdropFilter: 'blur(10px)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  dark: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    backdropFilter: 'blur(10px)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
};

// Typography
export const fonts = {
  heading: Platform.select({ ios: 'Georgia', android: 'serif' }) as string,
  headingItalic: Platform.select({ ios: 'Georgia-Italic', android: 'serif' }) as string,
  body: 'Nunito_400Regular',
  bodyMedium: 'Nunito_600SemiBold',
  bodyBold: 'Nunito_700Bold',
  // Cinematic content font (serif)
  content: Platform.select({ ios: 'Georgia', android: 'serif' }) as string,
};

export const typography = {
  h1: {
    fontFamily: fonts.heading,
    fontSize: 32,
    lineHeight: 40,
    color: palette.text,
  },
  h2: {
    fontFamily: fonts.heading,
    fontSize: 24,
    lineHeight: 32,
    color: palette.text,
  },
  h3: {
    fontFamily: fonts.heading,
    fontSize: 20,
    lineHeight: 28,
    color: palette.text,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 24,
    color: palette.text,
  },
  bodySmall: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: palette.muted,
  },
  label: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    lineHeight: 16,
    color: palette.muted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
};

// ============================================================================
// Accessibility Constants (WCAG AA Compliant)
// ============================================================================

// Minimum tap target size (44x44 points per Apple HIG / WCAG 2.1)
export const MIN_TAP_TARGET = 44;

// Minimum font sizes for readability
export const fontSizes = {
  xs: 12,    // Minimum readable size
  sm: 14,    // Small text, captions
  md: 16,    // Body text (default)
  lg: 18,    // Large body text
  xl: 20,    // Subheadings
  xxl: 24,   // Headings
  xxxl: 32,  // Large headings
};

// Line heights for readability (1.4-1.6x font size recommended)
export const lineHeights = {
  tight: 1.2,
  normal: 1.5,
  relaxed: 1.75,
};

// Dynamic type scaling multipliers (for accessibility settings)
export const typeScale = {
  xSmall: 0.85,
  small: 0.925,
  medium: 1.0,      // Default
  large: 1.1,
  xLarge: 1.2,
  xxLarge: 1.35,
  xxxLarge: 1.5,
};

// Helper to get scaled font size
export const getScaledFontSize = (baseSize: number, scale: keyof typeof typeScale = 'medium'): number => {
  return Math.round(baseSize * typeScale[scale]);
};

// Contrast ratios (WCAG AA requires 4.5:1 for normal text, 3:1 for large text)
// These colors have been verified for contrast compliance
export const accessibleColors = {
  // Light mode - all pass WCAG AA against #faf9f7 background
  lightText: '#0f172a',           // 15.8:1 contrast
  lightMuted: '#475569',          // 6.1:1 contrast (passes AA)
  lightAccent: '#b45309',         // 5.2:1 contrast (passes AA)
  
  // Dark mode - all pass WCAG AA against #0f172a background
  darkText: '#f8fafc',            // 15.8:1 contrast
  darkMuted: '#94a3b8',           // 5.4:1 contrast (passes AA)
  darkAccent: '#fbbf24',          // 8.2:1 contrast (passes AA)
};

// Shadow presets - Clean minimal look (shadows removed for classy appearance)
export const shadows = {
  sm: {
    // Clean look - no shadow
    elevation: 0,
  },
  md: {
    // Clean look - no shadow
    elevation: 0,
  },
  lg: {
    // Clean look - no shadow
    elevation: 0,
  },
  glow: {
    // Clean look - no shadow
    elevation: 0,
  },
  glowStrong: {
    // Clean look - no shadow
    elevation: 0,
  },
  cinematicCard: {
    // Clean look - no shadow
    elevation: 0,
  },
  cinematicCardHover: {
    // Clean look - no shadow
    elevation: 0,
  },
  glassNav: {
    // Clean look - no shadow
    elevation: 0,
  },
  fabGlow: {
    // Subtle glow for FAB only
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
};
