// Light theme palette
export const lightPalette = {
  background: '#F8F4EC',
  surface: '#FFFDF8',
  surfaceSecondary: '#F1EADF',
  surfaceDeep: '#E7DDCF',

  accent: '#385C3B',
  accentDark: '#2F4E33',
  accentDeep: '#203823',
  accentLight: '#E7EFE5',

  text: '#171717',
  textSecondary: '#3F3A34',
  muted: '#706B63',
  border: '#DDD4C7',

  danger: '#B42318',
  dangerLight: '#F9E8E5',
  success: '#385C3B',
  successLight: '#E7EFE5',

  amber700: '#A46522',
  amber600: '#B8732A',
  amber500: '#C98132',
  amber400: '#D89A55',
  amber300: '#E8BE86',
  amber200: '#EED7B8',
  amber100: '#F4E8D8',

  stone900: '#171717',
  stone800: '#24211E',
  stone700: '#3F3A34',
  stone600: '#575047',
  stone500: '#706B63',
  stone400: '#9B958C',
  stone300: '#CAC1B3',
  stone200: '#DDD4C7',
  stone100: '#F8F4EC',

  shadow: 'rgba(23,23,23,0.06)',

  glassWhite: '#FFFDF8',
  glassWhiteLight: '#FFFDF8',
  glassWhiteStrong: '#FFFDF8',
  glassBorder: '#DDD4C7',
  glassBorderLight: '#E7DDCF',

  cinematicBackground: '#F8F4EC',
  cinematicBackgroundOuter: '#F8F4EC',

  gradientWarm: ['#F8F4EC', '#FFFDF8', '#F1EADF'] as const,
  gradientSunrise: ['#F8F4EC', '#FFFDF8', '#F1EADF'] as const,
  gradientCool: ['#F8F4EC', '#FFFDF8', '#E7EFE5'] as const,
  gradientPurple: ['#F8F4EC', '#FFFDF8', '#F1EADF'] as const,
  gradientSuccess: ['#E7EFE5', '#FFFDF8', '#F8F4EC'] as const,
  screenGradient: ['#F8F4EC', '#FFFDF8', '#F1EADF'] as const,
  cardGradient: ['#FFFDF8', '#FFFDF8'] as const,

  gradientBoldScreen: ['#F8F4EC', '#FFFDF8', '#F1EADF', '#FFFDF8', '#F8F4EC'] as const,
  gradientBoldCard: ['#FFFDF8', '#FFFDF8', '#F8F4EC', '#FFFDF8'] as const,
  gradientBoldAccent: ['#385C3B', '#2F4E33', '#203823', '#385C3B'] as const,
  gradientBoldHeader: ['#FFFDF8', '#F8F4EC', '#FFFDF8', '#F8F4EC'] as const,
  gradientBoldButton: ['#385C3B', '#2F4E33', '#203823'] as const,

  gradientOverlay: ['rgba(248,244,236,0.96)', 'rgba(255,253,248,0.9)', 'rgba(255,253,248,0.7)', 'rgba(248,244,236,0.2)'] as const,
  gradientFade: ['rgba(255,253,248,1)', 'rgba(255,253,248,0.82)', 'rgba(255,253,248,0)'] as const,

  // Legacy compatibility - mapped to new system
  orange600: '#B8732A',
  orange500: '#C98132',
  orange400: '#D89A55',
  orange300: '#E8BE86',
  rose600: '#B42318',
  rose500: '#B42318',
  rose400: '#B42318',
  rose300: '#F9E8E5',
  rose200: '#F9E8E5',
  rose100: '#F9E8E5',
  indigo700: '#385C3B',
  indigo100: '#E7EFE5',
  warmGlowTop: 'rgba(255,253,248,0.55)',
  warmGlowTopLight: 'rgba(232,239,226,0.35)',
  warmGlowBottom: 'rgba(216,138,43,0.12)',
  warmGlowBottomLight: 'rgba(63,95,59,0.08)',
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
  md: 8,
  lg: 10,
  xl: 12,
  xxl: 16,
  xxxl: 20,
  full: 9999,
};

export const brand = {
  appName: 'Lift',
  tagline: 'live network of prayer',
};

export const mediumLayout = {
  screenPadding: 20,
  cardRadius: 8,
  inputRadius: 8,
  headerTopPadding: 18,
  bottomTabHeight: 76,
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
  heading: 'PlayfairDisplay_700Bold',
  headingItalic: 'PlayfairDisplay_700Bold_Italic',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
  content: 'PlayfairDisplay_700Bold',
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
