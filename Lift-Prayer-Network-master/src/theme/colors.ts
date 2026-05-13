// Light theme palette - Lift prototype production system
export const lightPalette = {
  background: '#F5F1EB',
  surface: '#FFFFFF',
  surfaceSecondary: '#FAF8F5',
  surfaceDeep: '#EDE8E0',

  accent: '#4A5D4E',
  accentDark: '#3A4A3E',
  accentDeep: '#2C332E',
  accentLight: '#EEF3EF',

  text: '#2C332E',
  textSecondary: '#6B756E',
  muted: '#9BA49E',
  border: '#E8E4DE',

  danger: '#C25B5B',
  dangerLight: '#F8EAEA',
  success: '#5A7D5F',
  successLight: '#EEF5EF',
  warning: '#B8956B',
  warningLight: '#F5EBDD',
  info: '#6B8E9E',
  infoLight: '#EAF1F4',
  backgroundWarm: '#EDE8E0',
  card: '#FFFFFF',
  divider: '#F0EDE7',
  primary: '#4A5D4E',
  primaryDark: '#3A4A3E',
  primaryLight: '#5C7361',
  textLight: '#6B756E',
  textMuted: '#9BA49E',

  amber700: '#8B6D45',
  amber600: '#A98A61',
  amber500: '#C4A882',
  amber400: '#D4C4A8',
  amber300: '#E2D5BF',
  amber200: '#ECE3D5',
  amber100: '#F7F1E8',

  stone900: '#171717',
  stone800: '#242424',
  stone700: '#404040',
  stone600: '#525252',
  stone500: '#737373',
  stone400: '#A3A3A3',
  stone300: '#D4D4D4',
  stone200: '#E5E5E5',
  stone100: '#F5F5F5',

  shadow: 'rgba(44,51,46,0.08)',

  glassWhite: '#FFFFFF',
  glassWhiteLight: '#FAF8F5',
  glassWhiteStrong: '#FFFFFF',
  glassBorder: '#E8E4DE',
  glassBorderLight: '#F0EDE7',

  cinematicBackground: '#F5F1EB',
  cinematicBackgroundOuter: '#D4CFC7',

  gradientWarm: ['#F5F1EB', '#FAF8F5', '#EDE8E0'] as const,
  gradientSunrise: ['#F5F1EB', '#FFFFFF', '#EDE8E0'] as const,
  gradientCool: ['#F5F1EB', '#FAF8F5', '#EEF3EF'] as const,
  gradientPurple: ['#F5F1EB', '#FAF8F5', '#EDE8E0'] as const,
  gradientSuccess: ['#EEF5EF', '#FFFFFF', '#F5F1EB'] as const,
  screenGradient: ['#F5F1EB', '#FAF8F5', '#EDE8E0'] as const,
  cardGradient: ['#FFFFFF', '#FAF8F5'] as const,

  gradientBoldScreen: ['#F5F1EB', '#FFFFFF', '#EEF3EF', '#EDE8E0', '#F5F1EB'] as const,
  gradientBoldCard: ['#FFFFFF', '#FAF8F5', '#EDE8E0', '#FFFFFF'] as const,
  gradientBoldAccent: ['#5C7361', '#4A5D4E', '#3A4A3E', '#4A5D4E'] as const,
  gradientBoldHeader: ['#F5F1EB', '#FFFFFF', '#EEF3EF', '#FAF8F5'] as const,
  gradientBoldButton: ['#5C7361', '#4A5D4E', '#3A4A3E'] as const,

  gradientOverlay: ['rgba(255,255,255,0.96)', 'rgba(255,255,255,0.9)', 'rgba(255,255,255,0.7)', 'rgba(255,255,255,0.2)'] as const,
  gradientFade: ['rgba(255,255,255,1)', 'rgba(255,255,255,0.82)', 'rgba(255,255,255,0)'] as const,

  // Legacy compatibility - mapped to new system
  orange600: '#A98A61',
  orange500: '#C4A882',
  orange400: '#D4C4A8',
  orange300: '#E2D5BF',
  rose600: '#C25B5B',
  rose500: '#C25B5B',
  rose400: '#D27C7C',
  rose300: '#F8EAEA',
  rose200: '#F8EAEA',
  rose100: '#F8EAEA',
  indigo700: '#4A5D4E',
  indigo100: '#EEF3EF',
  warmGlowTop: 'rgba(255,255,255,0.55)',
  warmGlowTopLight: 'rgba(230,244,230,0.35)',
  warmGlowBottom: 'rgba(245,158,11,0.08)',
  warmGlowBottomLight: 'rgba(26,137,23,0.05)',
};

// Dark theme palette - Medium.com style
export const darkPalette = {
  // Core colors
  background: '#191919',
  surface: '#242424',
  surfaceSecondary: '#2A2A2A',
  surfaceDeep: '#1A1A1A',
  accent: '#1A8917',
  accentDark: '#156D14',
  accentDeep: '#0D4A0C',
  accentLight: '#0D4A0C',
  text: '#F3F3F3',
  textSecondary: '#B3B3B3',
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
  amber700: '#B8956B',
  amber600: '#B8956B',
  amber500: '#4A5D4E',
  amber400: '#C4A882',
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
  gradientBoldAccent: ['#C4A882', '#4A5D4E', '#B8956B', '#B8956B'] as const,
  gradientBoldHeader: ['#1e293b', '#422006', '#78350f', '#92400e'] as const,
  gradientBoldButton: ['#C4A882', '#4A5D4E', '#B8956B'] as const,
  
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
  warning?: string;
  warningLight?: string;
  info?: string;
  infoLight?: string;
  backgroundWarm?: string;
  card?: string;
  divider?: string;
  primary?: string;
  primaryDark?: string;
  primaryLight?: string;
  textLight?: string;
  textMuted?: string;
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
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 28,
  full: 9999,
};

export const brand = {
  appName: 'Lift',
  tagline: 'live network of prayer',
};

export const mediumLayout = {
  screenPadding: 20,
  cardRadius: 16,
  inputRadius: 12,
  headerTopPadding: 18,
  bottomTabHeight: 82,
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
  lightAccent: '#B8956B',         // 5.2:1 contrast (passes AA)
  
  // Dark mode - all pass WCAG AA against #0f172a background
  darkText: '#f8fafc',            // 15.8:1 contrast
  darkMuted: '#94a3b8',           // 5.4:1 contrast (passes AA)
  darkAccent: '#C4A882',          // 8.2:1 contrast (passes AA)
};

// Shadow presets - Clean minimal look (shadows removed for classy appearance)
export const shadows = {
  sm: {
    shadowColor: '#2C332E',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  md: {
    shadowColor: '#2C332E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  lg: {
    shadowColor: '#2C332E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 32,
    elevation: 8,
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
    shadowColor: '#2C332E',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 12,
  },
  fabGlow: {
    // Subtle glow for FAB only
    shadowColor: '#4A5D4E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
};
