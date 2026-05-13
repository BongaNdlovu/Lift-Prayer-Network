import React from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleProp,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { fonts, mediumLayout, radius, shadows } from '../theme/colors';

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
      ) : (
        content
      )}
    </SafeAreaView>
  );
};

export const LiftScrollScreen: React.FC<Omit<ScreenProps, 'scroll'>> = (props) => (
  <LiftScreen {...props} scroll />
);

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
        {onBack ? <LiftIconButton icon="arrow-back" onPress={onBack} /> : null}
        <View style={styles.headerText}>
          {showBrand ? (
            <>
              <Text style={[styles.brand, { color: colors.text }]}>Lift</Text>
              <Text style={[styles.tagline, { color: colors.textSecondary }]}>live network of prayer</Text>
            </>
          ) : (
            <>
              <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
              {subtitle ? <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text> : null}
            </>
          )}
        </View>
        {right ? <View style={styles.headerRight}>{right}</View> : <View style={styles.headerRight} />}
      </View>
    </View>
  );
};

export const LiftTopBar: React.FC<{
  title?: string;
  onBack?: () => void;
  right?: React.ReactNode;
}> = ({ title, onBack, right }) => {
  const { colors } = useTheme();
  return (
    <View style={styles.topBar}>
      <View style={styles.topBarSide}>{onBack ? <LiftIconButton icon="arrow-back" onPress={onBack} /> : null}</View>
      {title ? <Text style={[styles.topBarTitle, { color: colors.text }]} numberOfLines={1}>{title}</Text> : <View style={styles.topBarTitle} />}
      <View style={styles.topBarSide}>{right}</View>
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
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, shadows.md, style]}>
      {children}
    </View>
  );

  return onPress ? <Pressable onPress={onPress}>{body}</Pressable> : body;
};

export const LiftFlatCard: React.FC<CardProps> = ({ children, style, onPress }) => {
  const { colors } = useTheme();
  const body = (
    <View style={[styles.flatCard, { backgroundColor: colors.surface, borderColor: colors.border }, style]}>
      {children}
    </View>
  );
  return onPress ? <Pressable onPress={onPress}>{body}</Pressable> : body;
};

type ButtonProps = {
  children: React.ReactNode;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export const LiftButton: React.FC<ButtonProps> = ({ children, onPress, variant = 'primary', disabled, style }) => {
  const { colors } = useTheme();
  const buttonStyle = [
    styles.button,
    variant === 'primary' && { backgroundColor: colors.accent, borderColor: colors.accent },
    variant === 'secondary' && { backgroundColor: colors.surface, borderColor: colors.border },
    variant === 'outline' && { backgroundColor: 'transparent', borderColor: colors.border },
    variant === 'danger' && { backgroundColor: colors.dangerLight, borderColor: colors.dangerLight },
    disabled && styles.buttonDisabled,
    style,
  ];
  const textStyle = [
    styles.buttonText,
    variant === 'primary' && { color: '#fff' },
    variant === 'secondary' && { color: colors.text },
    variant === 'outline' && { color: colors.text },
    variant === 'danger' && { color: colors.danger },
  ];
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [buttonStyle, pressed && styles.pressed]}>
      <Text style={textStyle}>{children}</Text>
    </Pressable>
  );
};

export const LiftTextButton: React.FC<{ children: React.ReactNode; onPress?: () => void; destructive?: boolean; style?: StyleProp<ViewStyle> }> = ({ children, onPress, destructive, style }) => {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.textButton, style]}>
      <Text style={[styles.textButtonLabel, { color: destructive ? colors.danger : colors.textSecondary }]}>{children}</Text>
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
  inputStyle?: StyleProp<TextStyle>;
  maxLength?: number;
};

export const LiftInput: React.FC<InputProps> = ({ value, onChangeText, placeholder, secureTextEntry, multiline = false, right, style, inputStyle, maxLength }) => {
  const { colors } = useTheme();
  return (
    <View style={[styles.inputWrap, { backgroundColor: colors.surface, borderColor: colors.border }, shadows.sm, style]}>
      <TextInput
        style={[styles.input, { color: colors.text }, multiline && styles.inputMultiline, inputStyle]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        secureTextEntry={secureTextEntry}
        multiline={multiline}
        maxLength={maxLength}
      />
      {right ? <View style={styles.inputRight}>{right}</View> : null}
    </View>
  );
};

export const LiftTextArea: React.FC<InputProps & { counter?: string }> = ({ counter, ...props }) => {
  const { colors } = useTheme();
  return (
    <View>
      <LiftInput {...props} multiline style={[styles.textAreaWrap, props.style]} inputStyle={[styles.textAreaInput, props.inputStyle]} />
      {counter ? <Text style={[styles.counter, { color: colors.muted }]}>{counter}</Text> : null}
    </View>
  );
};

export const LiftSwitchRow: React.FC<{ title: string; subtitle?: string; value: boolean; onValueChange: (value: boolean) => void }> = ({ title, subtitle, value, onValueChange }) => {
  const { colors } = useTheme();
  return (
    <View style={styles.switchRow}>
      <View style={styles.switchText}>
        <Text style={[styles.switchTitle, { color: colors.text }]}>{title}</Text>
        {subtitle ? <Text style={[styles.switchSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ false: colors.border, true: colors.accent }} thumbColor="#fff" />
    </View>
  );
};

export const LiftListGroup: React.FC<{ children: React.ReactNode; style?: StyleProp<ViewStyle> }> = ({ children, style }) => {
  const { colors } = useTheme();
  return <View style={[styles.listGroup, { backgroundColor: colors.surface }, shadows.sm, style]}>{children}</View>;
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
    <Pressable onPress={onPress} style={({ pressed }) => [styles.listItem, pressed && { backgroundColor: colors.surfaceSecondary }]}>
      {icon ? <View style={[styles.listIcon, { backgroundColor: colors.surfaceSecondary }]}>{icon}</View> : null}
      <View style={styles.listText}>
        <Text style={[styles.listTitle, { color: destructive ? colors.danger : colors.text }]}>{title}</Text>
        {subtitle ? <Text style={[styles.listSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text> : null}
      </View>
      {right ?? <Ionicons name="chevron-forward" size={18} color={colors.muted} />}
    </Pressable>
  );
};

export const LiftListRow = LiftListItem;

export const LiftTabs: React.FC<{ tabs: { value: string; label: string }[]; active: string; onChange: (value: string) => void }> = ({ tabs, active, onChange }) => {
  const { colors } = useTheme();
  return (
    <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
      {tabs.map((tab) => {
        const selected = tab.value === active;
        return (
          <Pressable key={tab.value} onPress={() => onChange(tab.value)} style={styles.tab}>
            <Text style={[styles.tabLabel, { color: selected ? colors.text : colors.muted }]}>{tab.label}</Text>
            {selected ? <View style={[styles.tabLine, { backgroundColor: colors.text }]} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
};

export const LiftSegmentedTabs = LiftTabs;

export const LiftChips: React.FC<{ chips: { value: string; label: string }[]; active?: string; onChange?: (value: string) => void }> = ({ chips, active, onChange }) => {
  const { colors } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
      {chips.map((chip) => {
        const selected = chip.value === active;
        return (
          <Pressable
            key={chip.value}
            onPress={() => onChange?.(chip.value)}
            style={[styles.chip, { backgroundColor: selected ? colors.accent : colors.surface, borderColor: selected ? colors.accent : colors.border }]}
          >
            <Text style={[styles.chipText, { color: selected ? '#fff' : colors.textSecondary }]}>{chip.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
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
  const initials = name ? name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) : '?';
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.surfaceSecondary, borderColor: colors.surface }, style]}>
      {photoURL ? <Image source={{ uri: photoURL }} style={styles.avatarImage} resizeMode="cover" /> : <Text style={[styles.avatarInitials, { color: colors.textSecondary, fontSize: size * 0.4 }]}>{initials}</Text>}
    </View>
  );
};

export const LiftAvatarRow: React.FC<{ users: { id?: string; name?: string; photoURL?: string | null }[]; max?: number }> = ({ users, max = 4 }) => {
  const visible = users.slice(0, max);
  const remaining = users.length - visible.length;
  const { colors } = useTheme();
  return (
    <View style={styles.avatarRow}>
      {visible.map((user, index) => (
        <LiftAvatar key={user.id || index} name={user.name} photoURL={user.photoURL} size={34} style={{ marginLeft: index === 0 ? 0 : -10 }} />
      ))}
      {remaining > 0 ? (
        <View style={[styles.avatarMore, { backgroundColor: colors.border, borderColor: colors.surface }]}>
          <Text style={[styles.avatarMoreText, { color: colors.textSecondary }]}>+{remaining}</Text>
        </View>
      ) : null}
    </View>
  );
};

export const LiftBottomSheet: React.FC<{ visible: boolean; onClose: () => void; children: React.ReactNode }> = ({ visible, onClose, children }) => {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetOverlay} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.surface }, shadows.lg]}>
          <Pressable onPress={onClose} style={[styles.sheetClose, { backgroundColor: colors.surfaceSecondary }]}>
            <Ionicons name="close" size={20} color={colors.text} />
          </Pressable>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

export const LiftEmptyState: React.FC<{ title: string; message?: string; icon?: keyof typeof Ionicons.glyphMap; action?: React.ReactNode }> = ({ title, message, icon = 'leaf-outline', action }) => {
  const { colors } = useTheme();
  return (
    <View style={styles.stateWrap}>
      <View style={[styles.stateIcon, { backgroundColor: colors.surfaceSecondary }]}>
        <Ionicons name={icon} size={28} color={colors.accent} />
      </View>
      <Text style={[styles.stateTitle, { color: colors.text }]}>{title}</Text>
      {message ? <Text style={[styles.stateMessage, { color: colors.textSecondary }]}>{message}</Text> : null}
      {action}
    </View>
  );
};

export const LiftLoadingState: React.FC<{ label?: string }> = ({ label = 'Loading...' }) => {
  const { colors } = useTheme();
  return (
    <View style={styles.stateWrap}>
      <ActivityIndicator color={colors.accent} />
      <Text style={[styles.stateMessage, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
};

export const LiftErrorState: React.FC<{ title: string; message?: string; onRetry?: () => void }> = ({ title, message, onRetry }) => (
  <LiftEmptyState title={title} message={message} icon="alert-circle-outline" action={onRetry ? <LiftButton onPress={onRetry} style={{ marginTop: 16 }}>Try Again</LiftButton> : null} />
);

export const LiftSectionLabel: React.FC<{ title: string; style?: StyleProp<TextStyle> }> = ({ title, style }) => {
  const { colors } = useTheme();
  return <Text style={[styles.sectionTitle, { color: colors.muted }, style]}>{title}</Text>;
};

export const LiftSectionTitle = LiftSectionLabel;

export const LiftLogo: React.FC<{ style?: StyleProp<TextStyle> }> = ({ style }) => {
  const { colors } = useTheme();
  return <Text style={[styles.logoLarge, { color: colors.text }, style]}>Lift</Text>;
};

type IconButtonProps = {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
};

export const LiftIconButton: React.FC<IconButtonProps> = ({ icon, onPress, size = 22, color, style }) => {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.liftIconButton, { backgroundColor: colors.surface, borderColor: colors.border }, shadows.sm, pressed && styles.pressed, style]}>
      <Ionicons name={icon} size={size} color={color || colors.text} />
    </Pressable>
  );
};

export const LiftBadge: React.FC<{ label: string; tone?: 'neutral' | 'success' | 'danger' | 'accent' | 'warning' }> = ({ label, tone = 'neutral' }) => {
  const { colors } = useTheme();
  const bg =
    tone === 'success' ? colors.successLight :
    tone === 'danger' ? colors.dangerLight :
    tone === 'warning' ? (colors as any).warningLight || colors.amber100 :
    tone === 'accent' ? colors.accentLight :
    colors.surfaceSecondary;
  const fg =
    tone === 'success' ? colors.success :
    tone === 'danger' ? colors.danger :
    tone === 'warning' ? (colors as any).warning || colors.amber700 :
    tone === 'accent' ? colors.accent :
    colors.textSecondary;
  return (
    <View style={[styles.badgePill, { backgroundColor: bg }]}>
      <Text style={[styles.badgePillText, { color: fg }]}>{label}</Text>
    </View>
  );
};

export const LiftPrayerWallHeader: React.FC<{
  title?: string;
  subtitle?: string;
  unreadCount?: number;
  onNotifications?: () => void;
  onSearch?: () => void;
}> = ({ title = 'Lift', subtitle, unreadCount = 0, onNotifications, onSearch }) => {
  const { colors } = useTheme();
  return (
    <View style={styles.wallHeader}>
      <View style={styles.wallHeaderText}>
        <Text style={[styles.wallTitle, { color: colors.text }]}>{title}</Text>
        {subtitle ? <Text style={[styles.wallSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text> : null}
      </View>
      <View style={styles.wallActions}>
        {onNotifications ? (
          <View>
            <LiftIconButton icon="notifications-outline" onPress={onNotifications} color={colors.textSecondary} />
            {unreadCount > 0 ? <View style={[styles.unreadDot, { backgroundColor: colors.danger }]} /> : null}
          </View>
        ) : null}
        {onSearch ? <LiftIconButton icon="search-outline" onPress={onSearch} color={colors.textSecondary} /> : null}
      </View>
    </View>
  );
};

export const LiftStatsRow: React.FC<{ stats: { label: string; value: string | number }[]; style?: StyleProp<ViewStyle> }> = ({ stats, style }) => {
  const { colors } = useTheme();
  return (
    <View style={[styles.statsRow, style]}>
      {stats.slice(0, 3).map((stat) => (
        <View key={stat.label} style={[styles.statCol, { backgroundColor: colors.surface }]}>
          <Text style={[styles.statNum, { color: colors.text }]}>{stat.value}</Text>
          <Text style={[styles.statName, { color: colors.textSecondary }]}>{stat.label}</Text>
        </View>
      ))}
    </View>
  );
};

export const LiftVerseCard: React.FC<{ label?: string; text: string; reference?: string; style?: StyleProp<ViewStyle> }> = ({ label = 'Verse of the Day', text, reference, style }) => {
  const { colors } = useTheme();
  return (
    <LiftFlatCard style={[styles.verseCard, { borderLeftColor: colors.accent }, style]}>
      <Text style={[styles.verseLabel, { color: colors.accent }]}>{label}</Text>
      <Text style={[styles.verseText, { color: colors.text }]}>{text}</Text>
      {reference ? <Text style={[styles.verseRef, { color: colors.textSecondary }]}>{reference}</Text> : null}
    </LiftFlatCard>
  );
};

export const LiftJourneyList: React.FC<{
  items: {
    title: string;
    subtitle?: string;
    icon: keyof typeof Ionicons.glyphMap;
    onPress?: () => void;
    destructive?: boolean;
  }[];
  style?: StyleProp<ViewStyle>;
}> = ({ items, style }) => {
  const { colors } = useTheme();
  return (
    <LiftListGroup style={style}>
      {items.map((item) => (
        <LiftListItem
          key={item.title}
          title={item.title}
          subtitle={item.subtitle}
          destructive={item.destructive}
          onPress={item.onPress}
          icon={<Ionicons name={item.icon} size={20} color={item.destructive ? colors.danger : colors.accent} />}
        />
      ))}
    </LiftListGroup>
  );
};

export const LiftAvatarPrayerRow: React.FC<{
  label?: string;
  users: { id?: string; name?: string; photoURL?: string | null }[];
  totalCount?: number;
  style?: StyleProp<ViewStyle>;
}> = ({ label = 'Praying for you', users, totalCount, style }) => {
  const { colors } = useTheme();
  const count = totalCount ?? users.length;
  return (
    <View style={[styles.prayerRow, style]}>
      <Text style={[styles.prayerRowLabel, { color: colors.text }]}>{label}</Text>
      <View style={styles.prayerRowBody}>
        <LiftAvatarRow users={users} max={5} />
        <Text style={[styles.prayerRowCount, { color: colors.textSecondary }]}>
          {count > 0 ? `${count} ${count === 1 ? 'person' : 'people'} praying` : 'Be the first to pray'}
        </Text>
      </View>
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
  brand: { fontFamily: fonts.heading, fontSize: 34, lineHeight: 38, letterSpacing: 0 },
  tagline: { fontFamily: fonts.body, fontSize: 12, marginTop: 0 },
  title: { fontFamily: fonts.heading, fontSize: 30, lineHeight: 36, letterSpacing: 0 },
  subtitle: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, marginTop: 4 },
  topBar: { flexDirection: 'row', alignItems: 'center', minHeight: 58, paddingVertical: 8 },
  topBarSide: { width: 54, minHeight: 44, justifyContent: 'center' },
  topBarTitle: { flex: 1, textAlign: 'center', fontFamily: fonts.heading, fontSize: 20, letterSpacing: 0 },
  card: { borderWidth: 0, borderRadius: mediumLayout.cardRadius, padding: 16 },
  flatCard: { borderWidth: 1, borderRadius: mediumLayout.cardRadius, padding: 16 },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.92 },
  button: { minHeight: 52, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, flexDirection: 'row', gap: 8 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { fontFamily: fonts.bodyMedium, fontSize: 16, letterSpacing: 0 },
  textButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  textButtonLabel: { fontFamily: fonts.bodyMedium, fontSize: 14 },
  inputWrap: { minHeight: 50, borderWidth: 0, borderRadius: radius.md, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, fontFamily: fonts.body, fontSize: 15, paddingVertical: 12 },
  inputMultiline: { minHeight: 132, textAlignVertical: 'top' },
  textAreaWrap: { alignItems: 'flex-start', paddingTop: 4 },
  textAreaInput: { minHeight: 150, textAlignVertical: 'top' },
  inputRight: { marginLeft: 8 },
  counter: { alignSelf: 'flex-end', fontFamily: fonts.body, fontSize: 12, marginTop: 6 },
  switchRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  switchText: { flex: 1 },
  switchTitle: { fontFamily: fonts.bodyMedium, fontSize: 15 },
  switchSubtitle: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, marginTop: 2 },
  listGroup: { borderRadius: radius.lg, overflow: 'hidden' },
  listItem: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 14 },
  listIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  listText: { flex: 1 },
  listTitle: { fontFamily: fonts.bodyMedium, fontSize: 15 },
  listSubtitle: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, marginTop: 2 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1 },
  tab: { minHeight: 42, marginRight: 24, justifyContent: 'center' },
  tabLabel: { fontFamily: fonts.bodyMedium, fontSize: 14 },
  tabLine: { height: 2, borderRadius: 1, marginTop: 10 },
  chips: { gap: 8, paddingVertical: 4 },
  chip: { minHeight: 38, borderRadius: radius.xl, borderWidth: 1, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: 14 },
  avatar: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  avatarImage: { width: '100%', height: '100%' },
  avatarInitials: { fontFamily: fonts.bodyMedium },
  avatarRow: { flexDirection: 'row', alignItems: 'center' },
  avatarMore: { width: 34, height: 34, borderRadius: 17, marginLeft: -10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  avatarMoreText: { fontFamily: fonts.bodyMedium, fontSize: 11 },
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(44,51,46,0.4)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingTop: 24 },
  sheetClose: { position: 'absolute', top: 12, right: 12, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  stateWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 36, paddingHorizontal: 20, gap: 10 },
  stateIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  stateTitle: { fontFamily: fonts.heading, fontSize: 24, textAlign: 'center', letterSpacing: 0 },
  stateMessage: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  sectionTitle: { fontFamily: fonts.bodyMedium, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 24, marginBottom: 12 },
  logoLarge: { fontFamily: fonts.heading, fontSize: 42, lineHeight: 48, fontWeight: '500', letterSpacing: 0 },
  liftIconButton: { width: 44, height: 44, borderRadius: 22, borderWidth: 0, alignItems: 'center', justifyContent: 'center' },
  badgePill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start' },
  badgePillText: { fontFamily: fonts.bodyMedium, fontSize: 11 },
  wallHeader: { paddingTop: mediumLayout.headerTopPadding, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 16 },
  wallHeaderText: { flex: 1 },
  wallTitle: { fontFamily: fonts.heading, fontSize: 34, lineHeight: 38, fontWeight: '500', letterSpacing: 0 },
  wallSubtitle: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, marginTop: 2 },
  wallActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  unreadDot: { position: 'absolute', top: 6, right: 6, width: 9, height: 9, borderRadius: 5, borderWidth: 1.5, borderColor: '#fff' },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCol: { flex: 1, borderRadius: radius.lg, paddingVertical: 14, paddingHorizontal: 8, alignItems: 'center', ...shadows.sm },
  statNum: { fontFamily: fonts.heading, fontSize: 24, lineHeight: 28, fontWeight: '600' },
  statName: { fontFamily: fonts.bodyMedium, fontSize: 11, lineHeight: 15, textAlign: 'center', marginTop: 3 },
  verseCard: { borderLeftWidth: 3 },
  verseLabel: { fontFamily: fonts.bodyMedium, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  verseText: { fontFamily: fonts.heading, fontSize: 17, lineHeight: 25, fontWeight: '500' },
  verseRef: { fontFamily: fonts.body, fontSize: 13, marginTop: 8 },
  prayerRow: { gap: 10 },
  prayerRowLabel: { fontFamily: fonts.bodyMedium, fontSize: 13 },
  prayerRowBody: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  prayerRowCount: { flex: 1, fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
});
