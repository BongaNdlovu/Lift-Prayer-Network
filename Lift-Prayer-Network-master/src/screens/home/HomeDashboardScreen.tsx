import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../hooks/useAuth';
import { useFeed } from '../../hooks/useFeed';
import { RootStackParamList } from '../../navigation/types';
import {
  LiftAvatarRow,
  LiftButton,
  LiftCard,
  LiftEmptyState,
  LiftHeader,
  LiftIconButton,
  LiftScreen,
  LiftSectionLabel,
} from '../../components/LiftLayout';
import { fonts, shadows, spacing } from '../../theme/colors';
import { formatRelativeTime } from '../../components/FeedCard';

export const HomeDashboardScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { items, loading } = useFeed('REQUEST', user?.uid);

  const activeRequest = useMemo(() => items.find((item) => item.type === 'REQUEST') || items[0], [items]);
  const displayName = user?.displayName?.split(' ')[0] || 'friend';
  const prayingUsers = [
    { id: '1', name: 'Lift Community' },
    { id: '2', name: user?.displayName || 'You', photoURL: user?.photoURL },
    { id: '3', name: 'Prayer Partner' },
    { id: '4', name: 'Faith Circle' },
    { id: '5', name: 'Support Team' },
  ];

  return (
    <LiftScreen scroll>
      <LiftHeader
        showBrand
        subtitle={`Welcome back, ${displayName}`}
        right={
          <View style={styles.headerActions}>
            <LiftIconButton icon="notifications-outline" onPress={() => navigation.navigate('NotificationsInbox')} />
            <LiftIconButton icon="search-outline" onPress={() => navigation.navigate('Search')} />
          </View>
        }
      />

      <LiftCard style={styles.streakCard}>
        <View style={styles.streakHeader}>
          <View style={[styles.streakIcon, { backgroundColor: colors.amber100 }]}>
            <Ionicons name="flame-outline" size={22} color={colors.amber700} />
          </View>
          <View style={styles.streakCopy}>
            <Text style={[styles.streakTitle, { color: colors.text }]}>You are showing up in prayer</Text>
            <Text style={[styles.streakSub, { color: colors.textSecondary }]}>Keep your rhythm gentle and steady.</Text>
          </View>
        </View>
        <View style={styles.daysRow}>
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => {
            const done = index < 5;
            const today = index === 6;
            return (
              <View key={`${day}-${index}`} style={styles.dayCol}>
                <Text style={[styles.dayLabel, { color: colors.muted }]}>{day}</Text>
                <View style={[styles.dayDot, { backgroundColor: done || today ? colors.accent : colors.border }]}>
                  <Text style={[styles.dayDotText, { color: done || today ? '#fff' : colors.textSecondary }]}>
                    {done ? '✓' : today ? '7' : '·'}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </LiftCard>

      <LiftSectionLabel title="Active Request" />
      {activeRequest ? (
        <Pressable
          onPress={() => navigation.navigate('RequestDetail', { id: activeRequest.id, type: activeRequest.type, item: activeRequest })}
          style={({ pressed }) => [pressed && styles.pressed]}
        >
          <LiftCard>
            <View style={styles.requestRow}>
              <View style={styles.requestCopy}>
                <Text style={[styles.requestTitle, { color: colors.text }]} numberOfLines={2}>
                  {(activeRequest as any).title || activeRequest.content}
                </Text>
                <Text style={[styles.requestMeta, { color: colors.textSecondary }]}>
                  {formatRelativeTime((activeRequest as any).createdAt)} · <Text style={{ color: colors.amber700 }}>{(activeRequest as any).prayerCount || 0} praying</Text>
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.muted} />
            </View>
          </LiftCard>
        </Pressable>
      ) : loading ? (
        <LiftCard>
          <Text style={[styles.requestMeta, { color: colors.textSecondary }]}>Loading today’s prayers...</Text>
        </LiftCard>
      ) : (
        <LiftEmptyState title="No active requests yet" message="When prayers are shared, they will appear here." />
      )}

      <LiftCard style={styles.verseCard}>
        <View style={styles.verseRow}>
          <View style={styles.verseCopy}>
            <Text style={[styles.verseText, { color: colors.text }]}>Pray without ceasing.</Text>
            <Text style={[styles.verseRef, { color: colors.muted }]}>1 Thessalonians 5:17</Text>
          </View>
          <View style={[styles.sunIcon, { backgroundColor: colors.amber100 }]}>
            <Ionicons name="sunny-outline" size={20} color={colors.amber700} />
          </View>
        </View>
      </LiftCard>

      <LiftSectionLabel title="Praying Together" />
      <LiftCard>
        <View style={styles.communityRow}>
          <LiftAvatarRow users={prayingUsers} max={4} />
          <Text style={[styles.communityText, { color: colors.textSecondary }]}>Your community is lifting needs in prayer today.</Text>
        </View>
      </LiftCard>

      <LiftButton onPress={() => navigation.navigate('CreateRequest')} style={styles.cta}>
        Share a Prayer Request
      </LiftButton>
    </LiftScreen>
  );
};

const styles = StyleSheet.create({
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  streakCard: {
    marginTop: 6,
  },
  streakHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  streakIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakCopy: {
    flex: 1,
  },
  streakTitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
  },
  streakSub: {
    fontFamily: fonts.body,
    fontSize: 13,
    marginTop: 2,
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 18,
  },
  dayCol: {
    alignItems: 'center',
    gap: 6,
  },
  dayLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
  },
  dayDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayDotText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.99 }],
  },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  requestCopy: {
    flex: 1,
  },
  requestTitle: {
    fontFamily: fonts.heading,
    fontSize: 19,
    lineHeight: 26,
    letterSpacing: 0,
  },
  requestMeta: {
    fontFamily: fonts.body,
    fontSize: 13,
    marginTop: 8,
  },
  verseCard: {
    marginTop: spacing.lg,
  },
  verseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  verseCopy: {
    flex: 1,
  },
  verseText: {
    fontFamily: fonts.headingItalic,
    fontSize: 18,
    letterSpacing: 0,
  },
  verseRef: {
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: 4,
  },
  sunIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  communityRow: {
    gap: 12,
  },
  communityText: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
  },
  cta: {
    marginTop: spacing.lg,
    marginBottom: 18,
    ...shadows.md,
  },
});

export default HomeDashboardScreen;
