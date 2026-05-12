/**
 * Typography Components
 * Modern font styling using Playfair Display (headings) and Nunito (body)
 */

import React from 'react';
import { Text, TextStyle, StyleSheet } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { fonts } from '../theme/colors';

interface TypographyProps {
  children: React.ReactNode;
  style?: TextStyle | TextStyle[];
  numberOfLines?: number;
  color?: string;
}

/**
 * Heading 1 - Large titles (32px Playfair Display Bold)
 */
export const H1: React.FC<TypographyProps> = ({ children, style, numberOfLines, color }) => {
  const { colors } = useTheme();
  return (
    <Text
      style={[styles.h1, { color: color || colors.text }, style]}
      numberOfLines={numberOfLines}
    >
      {children}
    </Text>
  );
};

/**
 * Heading 2 - Section titles (24px Playfair Display Bold)
 */
export const H2: React.FC<TypographyProps> = ({ children, style, numberOfLines, color }) => {
  const { colors } = useTheme();
  return (
    <Text
      style={[styles.h2, { color: color || colors.text }, style]}
      numberOfLines={numberOfLines}
    >
      {children}
    </Text>
  );
};

/**
 * Heading 3 - Subsection titles (20px Playfair Display Bold)
 */
export const H3: React.FC<TypographyProps> = ({ children, style, numberOfLines, color }) => {
  const { colors } = useTheme();
  return (
    <Text
      style={[styles.h3, { color: color || colors.text }, style]}
      numberOfLines={numberOfLines}
    >
      {children}
    </Text>
  );
};

/**
 * Body text - Regular paragraphs (16px Nunito Regular)
 */
export const Body: React.FC<TypographyProps> = ({ children, style, numberOfLines, color }) => {
  const { colors } = useTheme();
  return (
    <Text
      style={[styles.body, { color: color || colors.text }, style]}
      numberOfLines={numberOfLines}
    >
      {children}
    </Text>
  );
};

/**
 * Body Medium - Semi-bold body text (16px Nunito SemiBold)
 */
export const BodyMedium: React.FC<TypographyProps> = ({ children, style, numberOfLines, color }) => {
  const { colors } = useTheme();
  return (
    <Text
      style={[styles.bodyMedium, { color: color || colors.text }, style]}
      numberOfLines={numberOfLines}
    >
      {children}
    </Text>
  );
};

/**
 * Body Bold - Bold body text (16px Nunito Bold)
 */
export const BodyBold: React.FC<TypographyProps> = ({ children, style, numberOfLines, color }) => {
  const { colors } = useTheme();
  return (
    <Text
      style={[styles.bodyBold, { color: color || colors.text }, style]}
      numberOfLines={numberOfLines}
    >
      {children}
    </Text>
  );
};

/**
 * Small text - Captions and secondary text (14px Nunito Regular)
 */
export const Small: React.FC<TypographyProps> = ({ children, style, numberOfLines, color }) => {
  const { colors } = useTheme();
  return (
    <Text
      style={[styles.small, { color: color || colors.muted }, style]}
      numberOfLines={numberOfLines}
    >
      {children}
    </Text>
  );
};

/**
 * Label - Uppercase labels (12px Nunito SemiBold)
 */
export const Label: React.FC<TypographyProps> = ({ children, style, numberOfLines, color }) => {
  const { colors } = useTheme();
  return (
    <Text
      style={[styles.label, { color: color || colors.muted }, style]}
      numberOfLines={numberOfLines}
    >
      {children}
    </Text>
  );
};

/**
 * Quote - Italic heading for quotes (20px Playfair Display Bold Italic)
 */
export const Quote: React.FC<TypographyProps> = ({ children, style, numberOfLines, color }) => {
  const { colors } = useTheme();
  return (
    <Text
      style={[styles.quote, { color: color || colors.text }, style]}
      numberOfLines={numberOfLines}
    >
      {children}
    </Text>
  );
};

const styles = StyleSheet.create({
  h1: { fontFamily: fonts.heading, fontSize: 34, lineHeight: 42, fontWeight: '500' },
  h2: { fontFamily: fonts.heading, fontSize: 26, lineHeight: 34, fontWeight: '500' },
  h3: { fontFamily: fonts.heading, fontSize: 21, lineHeight: 28, fontWeight: '500' },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24 },
  bodyMedium: { fontFamily: fonts.bodyMedium, fontSize: 16, lineHeight: 24 },
  bodyBold: { fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 24 },
  small: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
  label: { fontFamily: fonts.bodyMedium, fontSize: 11, lineHeight: 15, textTransform: 'uppercase', letterSpacing: 0.8 },
  quote: { fontFamily: fonts.headingItalic, fontSize: 21, lineHeight: 30, fontStyle: 'italic' },
});
