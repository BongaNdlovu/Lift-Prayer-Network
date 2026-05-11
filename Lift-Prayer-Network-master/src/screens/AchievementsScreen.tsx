import React, { useEffect, useState } from 'react';
import {
  FlatList,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../contexts/ThemeContext';
import { palette, radius, spacing, fonts, shadows } from '../theme/colors';
import { CinematicBackground, RoundedPage } from '../components/CinematicBackground';
import { GlassIconButton } from '../components/GlassCard';
import {
  Achievement,
  ACHIEVEMENTS,
  getUserAchievements,
  UserAchievements,
} from '../services/achievements';

export const AchievementsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const [userAchievements, setUserAchievements] = useState<UserAchievements>({
    unlockedIds: [],
    unlockedAt: {} as any,
  });
  const [, setLoading] = useState(true);

  useEffect(() => {
    loadAchievements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadAchievements = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    const data = await getUserAchievements(user.uid);
    setUserAchievements(data);
    setLoading(false);
  };

  const unlockedCount = userAchievements.unlockedIds.length;
  const totalCount = ACHIEVEMENTS.length;
  const progress = totalCount > 0 ? (unlockedCount / totalCount) * 100 : 0;

  const renderAchievement = ({ item }: { item: Achievement }) => {
    const isUnlocked = userAchievements.unlockedIds.includes(item.id);

    return (
      <View
        style={[
          styles.achievementCard,
          !isUnlocked && styles.achievementLocked,
        ]}
      >
        <View
          style={[
            styles.achievementIcon,
            { backgroundColor: isUnlocked ? item.color + '20' : '#f1f5f9' },
          ]}
        >
          <Text style={[styles.achievementEmoji, !isUnlocked && styles.emojiLocked]}>
            {item.emoji}
          </Text>
        </View>
        <View style={styles.achievementContent}>
          <Text style={[styles.achievementTitle, !isUnlocked && styles.textLocked]}>
            {item.title}
          </Text>
          <Text style={[styles.achievementDesc, !isUnlocked && styles.textLocked]}>
            {item.description}
          </Text>
          {isUnlocked && (
            <View style={[styles.unlockedBadge, { backgroundColor: item.color + '20' }]}>
              <Text style={[styles.unlockedText, { color: item.color }]}>
                ✓ Unlocked
              </Text>
            </View>
          )}
        </View>
        {!isUnlocked && (
          <View style={styles.lockIcon}>
            <Text style={styles.lockEmoji}>🔒</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <CinematicBackground useOuterBackground>
      <SafeAreaView style={styles.container}>
        {/* === HEADER SECTION === */}
        <View style={styles.headerSection}>
          <GlassIconButton onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color={colors.stone700} />
          </GlassIconButton>
          <View style={styles.headerCenter}>
            <Text style={[styles.kicker, { color: colors.stone500 }]}>YOUR JOURNEY</Text>
            <Text style={styles.heading}>
              Badges<Text style={styles.headingDot}>.</Text>
            </Text>
          </View>
          <View style={{ width: 44 }} />
        </View>

        {/* === MAIN CONTENT === */}
        <RoundedPage style={styles.mainContent}>
        
        <FlatList
          data={ACHIEVEMENTS}
          keyExtractor={(item) => item.id}
          renderItem={renderAchievement}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <>

              {/* Progress Card */}
              <View style={[styles.progressCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.progressHeader}>
                  <Text style={[styles.progressTitle, { color: colors.text }]}>Your Progress</Text>
                  <Text style={[styles.progressCount, { color: colors.accent }]}>
                    {unlockedCount}/{totalCount}
                  </Text>
                </View>
                <View style={[styles.progressBar, { backgroundColor: isDark ? colors.border : '#e5e7eb' }]}>
                  <View
                    style={[styles.progressFill, { width: `${progress}%` }]}
                  />
                </View>
                <Text style={[styles.progressHint, { color: colors.muted }]}>
                  {unlockedCount === 0
                    ? 'Start praying to unlock your first achievement!'
                    : `Keep going! ${totalCount - unlockedCount} more to unlock.`}
                </Text>
              </View>

              {/* Recently Unlocked */}
              {unlockedCount > 0 && (
                <View style={styles.recentSection}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>🎉 Recently Unlocked</Text>
                  <View style={styles.recentBadges}>
                    {userAchievements.unlockedIds.slice(0, 5).map((id) => {
                      const achievement = ACHIEVEMENTS.find((a) => a.id === id);
                      if (!achievement) return null;
                      return (
                        <View
                          key={id}
                          style={[
                            styles.recentBadge,
                            { backgroundColor: achievement.color },
                          ]}
                        >
                          <Text style={styles.recentEmoji}>{achievement.emoji}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}

              <Text style={[styles.sectionTitle, { color: colors.text }]}>All Achievements</Text>
            </>
          }
        />
        </RoundedPage>
      </SafeAreaView>
    </CinematicBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  
  // Header styles
  headerSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    zIndex: 20,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  kicker: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
    opacity: 0.8,
  },
  heading: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontSize: 32,
    fontWeight: '500',
    letterSpacing: -1.5,
    lineHeight: 34,
    color: '#1c1917',
  },
  headingDot: {
    color: '#f59e0b',
  },
  mainContent: {
    flex: 1,
    zIndex: 10,
  },
  
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.text,
  },
  list: {
    padding: spacing.lg,
    paddingTop: 0,
  },
  progressCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.md,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  progressTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: palette.text,
  },
  progressCount: {
    fontFamily: fonts.heading,
    fontSize: 20,
    color: palette.accent,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#f1f5f9',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  progressFill: {
    height: '100%',
    backgroundColor: palette.accent,
    borderRadius: 4,
  },
  progressHint: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: palette.muted,
  },
  recentSection: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: palette.text,
    marginBottom: spacing.md,
  },
  recentBadges: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  recentBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
  },
  recentEmoji: {
    fontSize: 24,
  },
  achievementCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  achievementLocked: {
    backgroundColor: '#f8fafc',
    opacity: 0.7,
  },
  achievementIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  achievementEmoji: {
    fontSize: 28,
  },
  emojiLocked: {
    opacity: 0.3,
  },
  achievementContent: {
    flex: 1,
  },
  achievementTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: palette.text,
  },
  achievementDesc: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: palette.muted,
    marginTop: 2,
  },
  textLocked: {
    color: palette.muted,
  },
  unlockedBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    marginTop: spacing.xs,
  },
  unlockedText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
  },
  lockIcon: {
    marginLeft: spacing.sm,
  },
  lockEmoji: {
    fontSize: 16,
    opacity: 0.5,
  },
});

