import React, { useEffect, useState } from 'react';
import {
  FlatList,
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
import { palette, radius, spacing, fonts, shadows } from '../theme/colors';
import {
  Achievement,
  ACHIEVEMENTS,
  getUserAchievements,
  UserAchievements,
} from '../services/achievements';

export const AchievementsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [userAchievements, setUserAchievements] = useState<UserAchievements>({
    unlockedIds: [],
    unlockedAt: {} as any,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAchievements();
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

  const categories = ['prayer', 'streak', 'testimony', 'community', 'special'] as const;

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={palette.screenGradient} style={styles.gradient}>
        {/* Header with Back Button */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={palette.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Achievements</Text>
          <View style={{ width: 40 }} />
        </View>
        
        <FlatList
          data={ACHIEVEMENTS}
          keyExtractor={(item) => item.id}
          renderItem={renderAchievement}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <>

              {/* Progress Card */}
              <View style={styles.progressCard}>
                <View style={styles.progressHeader}>
                  <Text style={styles.progressTitle}>Your Progress</Text>
                  <Text style={styles.progressCount}>
                    {unlockedCount}/{totalCount}
                  </Text>
                </View>
                <View style={styles.progressBar}>
                  <View
                    style={[styles.progressFill, { width: `${progress}%` }]}
                  />
                </View>
                <Text style={styles.progressHint}>
                  {unlockedCount === 0
                    ? 'Start praying to unlock your first achievement!'
                    : `Keep going! ${totalCount - unlockedCount} more to unlock.`}
                </Text>
              </View>

              {/* Recently Unlocked */}
              {unlockedCount > 0 && (
                <View style={styles.recentSection}>
                  <Text style={styles.sectionTitle}>🎉 Recently Unlocked</Text>
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

              <Text style={styles.sectionTitle}>All Achievements</Text>
            </>
          }
        />
      </LinearGradient>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
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
  heading: {
    fontFamily: fonts.heading,
    fontSize: 28,
    color: palette.text,
    marginBottom: spacing.lg,
    display: 'none', // Hidden since we have headerTitle
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

