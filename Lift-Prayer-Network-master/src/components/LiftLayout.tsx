import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { fonts, mediumLayout, radius, spacing } from '../theme/colors';

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
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {content}
        </ScrollView>
      ) : (
        content
      )}
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
          <Pressable onPress={onBack} style={styles.headerIcon}>
            <Ionicons name="arrow-back" size={20} color={colors.text} />
          </Pressable>
        ) : null}

        <View style={styles.headerText}>
          {showBrand ? (
            <>
              <Text style={[styles.brand, { color: colors.accentDark }]}>Lift.</Text>
              <Text style={[styles.tagline, { color: colors.textSecondary }]}>
                live network of prayer
              </Text>
            </>
          ) : (
            <>
              <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
              {subtitle ? (
                <Text style={[styles.subtitle, { color: colors.muted }]}>{subtitle}</Text>
              ) : null}
            </>
          )}
        </View>

        {right ? <View style={styles.headerRight}>{right}</View> : <View style={styles.headerRight} />}
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
  const body = (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, style]}>
      {children}
    </View>
  );

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

type InputProps = {
  value?: string;
  onChangeText?: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: any;
  multiline?: boolean;
  right?: React.ReactNode;
};

export const LiftInput: React.FC<InputProps> = ({
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  multiline,
  right,
}) => {
  const { colors } = useTheme();

  return (
    <View style={[styles.inputWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        multiline={multiline}
        style={[styles.input, multiline && styles.inputMultiline, { color: colors.text }]}
      />
      {right ? <View style={styles.inputRight}>{right}</View> : null}
    </View>
  );
};

type ListItemProps = {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  destructive?: boolean;
};

export const LiftListItem: React.FC<ListItemProps> = ({
  icon,
  title,
  subtitle,
  right,
  onPress,
  destructive = false,
}) => {
  const { colors } = useTheme();

  return (
    <Pressable onPress={onPress} style={styles.listItem}>
      {icon ? (
        <View style={[styles.listIcon, { backgroundColor: colors.accentLight }]}>{icon}</View>
      ) : null}
      <View style={styles.listText}>
        <Text style={[styles.listTitle, { color: destructive ? colors.danger : colors.text }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.listSubtitle, { color: colors.muted }]}>{subtitle}</Text>
        ) : null}
      </View>
      {right ?? <Ionicons name="chevron-forward" size={18} color={colors.muted} />}
    </Pressable>
  );
};

type SegmentedTabsProps = {
  tabs: { value: string; label: string }[];
  active: string;
  onChange: (value: string) => void;
};

export const LiftSegmentedTabs: React.FC<SegmentedTabsProps> = ({ tabs, active, onChange }) => {
  const { colors } = useTheme();

  return (
    <View style={[styles.segmentRow, { borderBottomColor: colors.border }]}>
      {tabs.map((tab) => {
        const selected = tab.value === active;
        return (
          <Pressable key={tab.value} onPress={() => onChange(tab.value)} style={styles.segmentButton}>
            <Text style={[styles.segmentText, { color: selected ? colors.text : colors.muted }]}>
              {tab.label}
            </Text>
            {selected ? (
              <View style={[styles.segmentLine, { backgroundColor: colors.accentDark }]} />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
};

type BadgeProps = {
  label: string;
  tone?: 'neutral' | 'success' | 'danger' | 'accent';
};

export const LiftBadge: React.FC<BadgeProps> = ({ label, tone = 'neutral' }) => {
  const { colors } = useTheme();
  const bg =
    tone === 'success'
      ? colors.successLight
      : tone === 'danger'
      ? colors.dangerLight
      : tone === 'accent'
      ? colors.accentLight
      : colors.surfaceSecondary;

  const fg =
    tone === 'success'
      ? colors.success
      : tone === 'danger'
      ? colors.danger
      : tone === 'accent'
      ? colors.accentDark
      : colors.textSecondary;

  return (
    <View style={[styles.badgePill, { backgroundColor: bg }]}>
      <Text style={[styles.badgePillText, { color: fg }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flex: 1, paddingHorizontal: mediumLayout.screenPadding },
  scrollContent: { flexGrow: 1, paddingBottom: 112 },

  header: { paddingTop: mediumLayout.headerTopPadding, paddingBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerText: { flex: 1 },
  headerRight: { minWidth: 44, alignItems: 'flex-end' },
  headerIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },

  brand: { fontFamily: fonts.heading, fontSize: 34, lineHeight: 38 },
  tagline: { fontFamily: fonts.body, fontSize: 12, marginTop: 0 },
  title: { fontFamily: fonts.heading, fontSize: 28, lineHeight: 34 },
  subtitle: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, marginTop: 4 },

  card: { borderWidth: 1, borderRadius: mediumLayout.cardRadius, padding: 16 },
  button: { minHeight: 50, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  buttonText: { fontFamily: fonts.bodyBold, fontSize: 15 },

  inputWrap: { minHeight: 48, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, fontFamily: fonts.body, fontSize: 15, paddingVertical: 12 },
  inputMultiline: { minHeight: 132, textAlignVertical: 'top' },
  inputRight: { marginLeft: 8 },

  listItem: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  listIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  listText: { flex: 1 },
  listTitle: { fontFamily: fonts.bodyMedium, fontSize: 15 },
  listSubtitle: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, marginTop: 2 },

  segmentRow: { flexDirection: 'row', borderBottomWidth: 1 },
  segmentButton: { minHeight: 42, marginRight: 24, justifyContent: 'center' },
  segmentText: { fontFamily: fonts.bodyMedium, fontSize: 14 },
  segmentLine: { height: 2, borderRadius: 1, marginTop: 10 },

  badgePill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start' },
  badgePillText: { fontFamily: fonts.bodyMedium, fontSize: 11 },

  // Legacy components
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
