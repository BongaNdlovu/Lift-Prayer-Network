import React from 'react';
import {  Image,
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
  children: React.ReactNode;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export const LiftButton: React.FC<ButtonProps> = ({ children, onPress, variant = 'primary', disabled, style }) => {
  const { colors } = useTheme();
  
  const buttonStyle = [
    styles.button,
    variant === 'primary' && { backgroundColor: colors.accent, borderColor: colors.accent },
    variant === 'secondary' && { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
    variant === 'outline' && { backgroundColor: 'transparent', borderColor: colors.border },
    disabled && styles.buttonDisabled,
    style,
  ];

  const textStyle = [
    styles.buttonText,
    variant === 'primary' && { color: '#fff' },
    variant === 'secondary' && { color: colors.text },
    variant === 'outline' && { color: colors.text },
  ];

  return (
    <Pressable onPress={onPress} disabled={disabled} style={buttonStyle}>
      <Text style={textStyle}>{children}</Text>
    </Pressable>
  );
};

type InputProps = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  multiline?: boolean;
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export const LiftInput: React.FC<InputProps> = ({
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  multiline = false,
  right,
  style,
}) => {
  const { colors } = useTheme();

  return (
    <View style={[styles.inputWrap, { borderColor: colors.border }, style]}>
      <TextInput
        style={[styles.input, { color: colors.text }, multiline && styles.inputMultiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        secureTextEntry={secureTextEntry}
        multiline={multiline}
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

export const LiftListItem: React.FC<ListItemProps> = ({ icon, title, subtitle, right, onPress, destructive }) => {
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

type AvatarProps = {
  photoURL?: string | null;
  name?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

export const LiftAvatar: React.FC<AvatarProps> = ({ photoURL, name, size = 40, style }) => {
  const { colors } = useTheme();
  const initials = name
    ? name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?';

  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.surfaceSecondary },
        style,
      ]}
    >
      {photoURL ? (
        <Image source={{ uri: photoURL }} style={styles.avatarImage} resizeMode="cover" />
      ) : (
        <Text style={[styles.avatarInitials, { color: colors.textSecondary, fontSize: size * 0.4 }]}>
          {initials}
        </Text>
      )}
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

type SectionTitleProps = {
  title: string;
  style?: StyleProp<TextStyle>;
};

export const LiftSectionTitle: React.FC<SectionTitleProps> = ({ title, style }) => {
  const { colors } = useTheme();
  return (
    <Text style={[styles.sectionTitle, { color: colors.muted }, style]}>{title}</Text>
  );
};

type ListRowProps = {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export const LiftListRow: React.FC<ListRowProps> = ({ icon, title, subtitle, right, onPress, style }) => {
  const { colors } = useTheme();

  return (
    <Pressable onPress={onPress} style={[styles.listRow, style]}>
      {icon ? <View style={styles.listRowIcon}>{icon}</View> : null}
      <View style={styles.listRowContent}>
        <Text style={[styles.listRowTitle, { color: colors.text }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.listRowSubtitle, { color: colors.muted }]}>{subtitle}</Text>
        ) : null}
      </View>
      {right ?? <Ionicons name="chevron-forward" size={18} color={colors.muted} />}
    </Pressable>
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
  buttonDisabled: { opacity: 0.5 },
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

  sectionTitle: { fontFamily: fonts.bodyMedium, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 24, marginBottom: 12 },

  listRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  listRowIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  listRowContent: { flex: 1 },
  listRowTitle: { fontFamily: fonts.bodyMedium, fontSize: 15 },
  listRowSubtitle: { fontFamily: fonts.body, fontSize: 13, marginTop: 2 },

  // Avatar styles
  avatar: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: '100%', height: '100%' },
  avatarInitials: { fontFamily: fonts.bodyMedium },

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

  // TopBar styles
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: mediumLayout.screenPadding, paddingTop: 12, paddingBottom: 8, minHeight: 56 },
  topBarLeft: { minWidth: 44 },
  topBarRight: { minWidth: 44, alignItems: 'flex-end' },
  topBarIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  topBarIconPlaceholder: { width: 44 },
  topBarTitle: { fontFamily: fonts.heading, fontSize: 18, flex: 1, textAlign: 'center', marginHorizontal: 44 },
  topBarSpacer: { flex: 1, marginHorizontal: 44 },
});

export const LiftLogo: React.FC<{ style?: StyleProp<TextStyle> }> = ({ style }) => {
  const { colors } = useTheme();
  return (
    <Text style={[styles.logoLarge, { color: colors.accentDark }, style]}>Lift.</Text>
  );
};

type IconButtonProps = {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
};

export const LiftIconButton: React.FC<IconButtonProps> = ({ icon, onPress, size = 24, color, style }) => {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.liftIconButton, { borderColor: colors.border }, style]}>
      <Ionicons name={icon} size={size} color={color || colors.text} />
    </Pressable>
  );
};
