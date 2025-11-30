export const palette = {
  // Core colors
  background: '#faf9f7',
  surface: '#ffffff',
  accent: '#eab308',
  accentDark: '#b45309',
  accentLight: '#fef3c7',
  text: '#0f172a',
  muted: '#64748b',
  border: '#e5e7eb',
  danger: '#ef4444',
  success: '#10b981',
  shadow: 'rgba(0,0,0,0.08)',

  // Gradient colors
  gradientWarm: ['#fef3c7', '#fde68a', '#fcd34d'] as const,
  gradientSunrise: ['#fff7ed', '#fed7aa', '#fdba74'] as const,
  gradientCool: ['#f0f9ff', '#e0f2fe', '#bae6fd'] as const,
  gradientPurple: ['#faf5ff', '#f3e8ff', '#e9d5ff'] as const,
  gradientSuccess: ['#f0fdf4', '#dcfce7', '#bbf7d0'] as const,
  
  // Background gradients for screens
  screenGradient: ['#faf9f7', '#fef3c7', '#fff7ed'] as const,
  cardGradient: ['#ffffff', '#fefbf3'] as const,
};

export const spacing = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  xxl: 40,
};

export const radius = {
  sm: 8,
  md: 14,
  lg: 24,
  xl: 32,
  full: 9999,
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
  body: 'Nunito_400Regular',
  bodyMedium: 'Nunito_600SemiBold',
  bodyBold: 'Nunito_700Bold',
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

// Shadow presets
export const shadows = {
  sm: {
    shadowColor: 'rgb(15, 23, 42)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: 'rgb(15, 23, 42)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  lg: {
    shadowColor: 'rgb(15, 23, 42)',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 10,
  },
  glow: {
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
};
