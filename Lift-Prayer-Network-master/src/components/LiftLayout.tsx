import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { brand, fonts, mediumLayout, radius, spacing } from '../theme/colors';

type ScreenProps = {
  children: React.ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
};

export const LiftScreen: React.FC<ScreenProps> = ({ children, scroll = false, contentStyle }) => {
  const { colors } = useTheme();
  const content = <View style={[styles.content, contentStyle]}>{children}</View>;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      {scroll ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {content}
        </ScrollView>
      ) : content}
    </SafeAreaView>
  );
};

type HeaderProps = {
  title?: string;
  subtitle?: string;
  showBrand?: boolean;
  right?: React.ReactNode;
  onBack?: () => void;
};

export const LiftHeader: React.FC<HeaderProps> = ({ title, subtitle, showBrand = false, right, onBack }) => {
  const { colors } = useTheme();

  return (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        {onBack ? (
          <Pressable onPress={onBack} style={[styles.iconButton, { borderColor: colors.border }]}>
            <Ionicons name="arrow-back" size={20} color={colors.text} />
          </Pressable>
        ) : null}
        {showBrand ? (
          <View style={styles.brandBlock}>
            <Text style={[styles.brand, { color: colors.accentDark }]}>{brand.appName}</Text>
            <Text style={[styles.tagline, { color: colors.muted }]}>{brand.tagline}</Text>
          </View>
        ) : (
          <View style={styles.titleBlock}>
            {title ? <Text style={[styles.title, { color: colors.text }]}>{title}</Text> : null}
            {subtitle ? <Text style={[styles.subtitle, { color: colors.muted }]}>{subtitle}</Text> : null}
          </View>
        )}
        {right ? <View style={styles.right}>{right}</View> : <View style={styles.rightPlaceholder} />}
      </View>
    </View>
  );
};

type CardProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
};

export const LiftCard: React.FC<CardProps> = ({ children, style, onPress }) => {
  const { colors } = useTheme();
  const body = <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, style]}>{children}</View>;
  return onPress ? <Pressable onPress={onPress}>{body}</Pressable> : body;
};

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

export const LiftButton: React.FC<ButtonProps> = ({ title, onPress, variant = 'primary', disabled, loading, style }) => {
  const { colors } = useTheme();
  const backgroundColor = variant === 'primary' ? colors.accentDark : variant === 'danger' ? colors.dangerLight : colors.surface;
  const borderColor = variant === 'primary' ? colors.accentDark : variant === 'danger' ? colors.danger : colors.border;
  const color = variant === 'primary' ? '#FFFDF8' : variant === 'danger' ? colors.danger : colors.text;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={[styles.button, { backgroundColor, borderColor, opacity: disabled ? 0.5 : 1 }, style]}
    >
      {loading ? <ActivityIndicator color={color} /> : <Text style={[styles.buttonText, { color }]}>{title}</Text>}
    </Pressable>
  );
};

export const LiftLogo: React.FC<{ size?: 'sm' | 'lg'; style?: StyleProp<TextStyle> }> = ({ size = 'lg', style }) => {
  const { colors } = useTheme();
  return <Text style={[size === 'lg' ? styles.logoLarge : styles.logoSmall, { color: colors.accentDark }, style]}>Lift</Text>;
};

type IconButtonProps = {
  children: React.ReactNode;
  onPress: () => void;
  badge?: number;
  style?: StyleProp<ViewStyle>;
};

export const LiftIconButton: React.FC<IconButtonProps> = ({ children, onPress, badge, style }) => {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.liftIconButton, { backgroundColor: colors.surface, borderColor: colors.border }, style]}>
      {children}
      {badge ? (
        <View style={[styles.badge, { backgroundColor: colors.danger }]}>
          <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
};

type ChipProps = {
  label: string;
  active?: boolean;
  onPress: () => void;
  icon?: React.ReactNode;
};

export const LiftChip: React.FC<ChipProps> = ({ label, active, onPress, icon }) => {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        { backgroundColor: active ? colors.accentDark : colors.surface, borderColor: active ? colors.accentDark : colors.border },
      ]}
    >
      {icon}
      <Text style={[styles.chipText, { color: active ? '#FFFDF8' : colors.text }]}>{label}</Text>
    </Pressable>
  );
};

type StatProps = {
  value: string | number;
  label: string;
};

export const LiftStat: React.FC<StatProps> = ({ value, label }) => {
  const { colors } = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.muted }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flex: 1, paddingHorizontal: mediumLayout.screenPadding },
  scrollContent: { flexGrow: 1 },
  header: { paddingTop: mediumLayout.headerTopPadding, paddingBottom: spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandBlock: { flex: 1 },
  titleBlock: { flex: 1 },
  brand: { fontFamily: fonts.heading, fontSize: 34, lineHeight: 38, fontWeight: '500' },
  tagline: { fontFamily: fonts.body, fontSize: 12, marginTop: 0 },
  title: { fontFamily: fonts.heading, fontSize: 30, lineHeight: 36, fontWeight: '500' },
  subtitle: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, marginTop: 4 },
  right: { minWidth: 44, alignItems: 'flex-end' },
  rightPlaceholder: { width: 44 },
  iconButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, marginRight: spacing.sm },
  card: { borderWidth: 1, borderRadius: mediumLayout.cardRadius, padding: spacing.lg },
  button: { minHeight: 50, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
  buttonText: { fontFamily: fonts.bodyBold, fontSize: 15 },
  logoLarge: { fontFamily: fonts.heading, fontSize: 42, lineHeight: 48, fontWeight: '500' },
  logoSmall: { fontFamily: fonts.heading, fontSize: 28, lineHeight: 32, fontWeight: '500' },
  liftIconButton: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { color: '#FFFDF8', fontSize: 10, fontFamily: fonts.bodyBold },
  chip: { minHeight: 38, borderRadius: 19, borderWidth: 1, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: 14 },
  stat: { flex: 1, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md },
  statValue: { fontFamily: fonts.heading, fontSize: 22, fontWeight: '500' },
  statLabel: { fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
});
