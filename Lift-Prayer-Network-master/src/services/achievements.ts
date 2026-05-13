import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { db, firebaseEnabled } from './firebase';

export type AchievementId =
  | 'first_prayer'
  | 'prayer_10'
  | 'prayer_50'
  | 'prayer_100'
  | 'prayer_500'
  | 'streak_3'
  | 'streak_7'
  | 'streak_30'
  | 'streak_100'
  | 'first_testimony'
  | 'testimony_5'
  | 'testimony_10'
  | 'helper'
  | 'encourager'
  | 'faithful'
  | 'early_bird'
  | 'night_owl'
  | 'community_builder';

export type Achievement = {
  id: AchievementId;
  title: string;
  description: string;
  emoji: string;
  category: 'prayer' | 'streak' | 'testimony' | 'community' | 'special';
  requirement: number;
  color: string;
};

export const ACHIEVEMENTS: Achievement[] = [
  // Prayer achievements
  {
    id: 'first_prayer',
    title: 'First Step',
    description: 'Prayed for your first request',
    emoji: '🙏',
    category: 'prayer',
    requirement: 1,
    color: '#22c55e',
  },
  {
    id: 'prayer_10',
    title: 'Prayer Warrior',
    description: 'Prayed 10 times',
    emoji: '🛡️',
    category: 'prayer',
    requirement: 10,
    color: '#3b82f6',
  },
  {
    id: 'prayer_50',
    title: 'Devoted',
    description: 'Prayed 50 times',
    emoji: '🔥',
    category: 'prayer',
    requirement: 50,
    color: '#8b5cf6',
  },
  {
    id: 'prayer_100',
    title: 'Intercessor',
    description: 'Prayed 100 times',
    emoji: '🌟',
    category: 'prayer',
    requirement: 100,
    color: '#4A5D4E',
  },
  {
    id: 'prayer_500',
    title: 'Prayer Legend',
    description: 'Prayed 500 times',
    emoji: '🕊️',
    category: 'prayer',
    requirement: 500,
    color: '#eab308',
  },

  // Streak achievements
  {
    id: 'streak_3',
    title: 'Getting Started',
    description: '3-day prayer streak',
    emoji: '📅',
    category: 'streak',
    requirement: 3,
    color: '#ef4444',
  },
  {
    id: 'streak_7',
    title: 'Week Warrior',
    description: '7-day prayer streak',
    emoji: '📆',
    category: 'streak',
    requirement: 7,
    color: '#f97316',
  },
  {
    id: 'streak_30',
    title: 'Monthly Momentum',
    description: '30-day prayer streak',
    emoji: '🗓️',
    category: 'streak',
    requirement: 30,
    color: '#dc2626',
  },
  {
    id: 'streak_100',
    title: 'Unbreakable',
    description: '100-day prayer streak',
    emoji: '🏆',
    category: 'streak',
    requirement: 100,
    color: '#b91c1c',
  },

  // Testimony achievements
  {
    id: 'first_testimony',
    title: 'First Praise',
    description: 'Shared your first testimony',
    emoji: '🎉',
    category: 'testimony',
    requirement: 1,
    color: '#10b981',
  },
  {
    id: 'testimony_5',
    title: 'Witness',
    description: 'Shared 5 testimonies',
    emoji: '📣',
    category: 'testimony',
    requirement: 5,
    color: '#059669',
  },
  {
    id: 'testimony_10',
    title: 'Beacon of Hope',
    description: 'Shared 10 testimonies',
    emoji: '🌈',
    category: 'testimony',
    requirement: 10,
    color: '#047857',
  },

  // Community achievements
  {
    id: 'helper',
    title: 'Helper',
    description: 'Prayed for 10 different people',
    emoji: '🤝',
    category: 'community',
    requirement: 10,
    color: '#6366f1',
  },
  {
    id: 'encourager',
    title: 'Encourager',
    description: 'Left 20 encouraging comments',
    emoji: '💬',
    category: 'community',
    requirement: 20,
    color: '#8b5cf6',
  },
  {
    id: 'community_builder',
    title: 'Community Builder',
    description: 'Created a prayer group',
    emoji: '🏗️',
    category: 'community',
    requirement: 1,
    color: '#a855f7',
  },

  // Special achievements
  {
    id: 'faithful',
    title: 'Faithful',
    description: 'Active member for 30 days',
    emoji: '🌿',
    category: 'special',
    requirement: 30,
    color: '#eab308',
  },
  {
    id: 'early_bird',
    title: 'Early Bird',
    description: 'Prayed before 6 AM',
    emoji: '🌅',
    category: 'special',
    requirement: 1,
    color: '#fb923c',
  },
  {
    id: 'night_owl',
    title: 'Night Owl',
    description: 'Prayed after 11 PM',
    emoji: '🌙',
    category: 'special',
    requirement: 1,
    color: '#4f46e5',
  },
];

export type UserAchievements = {
  unlockedIds: AchievementId[];
  unlockedAt: Record<AchievementId, any>;
};

export const getUserAchievements = async (userId: string): Promise<UserAchievements> => {
  if (!firebaseEnabled || !db) {
    return { unlockedIds: [], unlockedAt: {} as Record<AchievementId, any> };
  }

  try {
    const userRef = doc(db, 'users', userId);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data();
      return {
        unlockedIds: data.achievements?.unlockedIds || [],
        unlockedAt: data.achievements?.unlockedAt || {},
      };
    }
  } catch (err) {
    console.warn('Error fetching achievements:', err);
  }
  return { unlockedIds: [], unlockedAt: {} as Record<AchievementId, any> };
};

export const unlockAchievement = async (
  userId: string,
  achievementId: AchievementId
): Promise<boolean> => {
  if (!firebaseEnabled || !db) return false;

  try {
    const userRef = doc(db, 'users', userId);
    const snap = await getDoc(userRef);

    if (snap.exists()) {
      const data = snap.data();
      const currentIds = data.achievements?.unlockedIds || [];

      if (currentIds.includes(achievementId)) {
        return false;
      }

      await updateDoc(userRef, {
        'achievements.unlockedIds': [...currentIds, achievementId],
        [`achievements.unlockedAt.${achievementId}`]: serverTimestamp(),
      });

      // Send local push notification for achievement
      const achievement = getAchievementById(achievementId);
      const userSettings = data.settings || {};
      const notificationsEnabled = userSettings.notifications ?? false;
      const achievementNotificationsEnabled = userSettings.notificationsAchievements ?? true;

      if (achievement && notificationsEnabled && achievementNotificationsEnabled && Platform.OS !== 'web') {
        try {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: `${achievement.emoji} Achievement Unlocked!`,
              body: `${achievement.title}: ${achievement.description}`,
              sound: true,
              data: { type: 'achievement', achievementId },
            },
            trigger: null, // Send immediately
          });
        } catch (notifErr) {
          console.warn('[Achievements] Could not send notification:', notifErr);
        }
      }

      return true;
    }
  } catch (err) {
    console.warn('Error unlocking achievement:', err);
  }
  return false;
};

export const checkAndUnlockAchievements = async (
  userId: string,
  stats: {
    prayerCount?: number;
    streakDays?: number;
    testimonyCount?: number;
    peopleCount?: number;
    commentCount?: number;
    hasGroup?: boolean;
    hour?: number;
  }
): Promise<AchievementId[]> => {
  const newAchievements: AchievementId[] = [];
  const userAchievements = await getUserAchievements(userId);

  if (stats.prayerCount !== undefined) {
    if (stats.prayerCount >= 1 && !userAchievements.unlockedIds.includes('first_prayer')) {
      if (await unlockAchievement(userId, 'first_prayer')) newAchievements.push('first_prayer');
    }
    if (stats.prayerCount >= 10 && !userAchievements.unlockedIds.includes('prayer_10')) {
      if (await unlockAchievement(userId, 'prayer_10')) newAchievements.push('prayer_10');
    }
    if (stats.prayerCount >= 50 && !userAchievements.unlockedIds.includes('prayer_50')) {
      if (await unlockAchievement(userId, 'prayer_50')) newAchievements.push('prayer_50');
    }
    if (stats.prayerCount >= 100 && !userAchievements.unlockedIds.includes('prayer_100')) {
      if (await unlockAchievement(userId, 'prayer_100')) newAchievements.push('prayer_100');
    }
    if (stats.prayerCount >= 500 && !userAchievements.unlockedIds.includes('prayer_500')) {
      if (await unlockAchievement(userId, 'prayer_500')) newAchievements.push('prayer_500');
    }
  }

  if (stats.streakDays !== undefined) {
    if (stats.streakDays >= 3 && !userAchievements.unlockedIds.includes('streak_3')) {
      if (await unlockAchievement(userId, 'streak_3')) newAchievements.push('streak_3');
    }
    if (stats.streakDays >= 7 && !userAchievements.unlockedIds.includes('streak_7')) {
      if (await unlockAchievement(userId, 'streak_7')) newAchievements.push('streak_7');
    }
    if (stats.streakDays >= 30 && !userAchievements.unlockedIds.includes('streak_30')) {
      if (await unlockAchievement(userId, 'streak_30')) newAchievements.push('streak_30');
    }
    if (stats.streakDays >= 100 && !userAchievements.unlockedIds.includes('streak_100')) {
      if (await unlockAchievement(userId, 'streak_100')) newAchievements.push('streak_100');
    }
  }

  if (stats.testimonyCount !== undefined) {
    if (stats.testimonyCount >= 1 && !userAchievements.unlockedIds.includes('first_testimony')) {
      if (await unlockAchievement(userId, 'first_testimony')) newAchievements.push('first_testimony');
    }
    if (stats.testimonyCount >= 5 && !userAchievements.unlockedIds.includes('testimony_5')) {
      if (await unlockAchievement(userId, 'testimony_5')) newAchievements.push('testimony_5');
    }
    if (stats.testimonyCount >= 10 && !userAchievements.unlockedIds.includes('testimony_10')) {
      if (await unlockAchievement(userId, 'testimony_10')) newAchievements.push('testimony_10');
    }
  }

  if (stats.hour !== undefined) {
    if (stats.hour < 6 && !userAchievements.unlockedIds.includes('early_bird')) {
      if (await unlockAchievement(userId, 'early_bird')) newAchievements.push('early_bird');
    }
    if (stats.hour >= 23 && !userAchievements.unlockedIds.includes('night_owl')) {
      if (await unlockAchievement(userId, 'night_owl')) newAchievements.push('night_owl');
    }
  }

  if (stats.hasGroup && !userAchievements.unlockedIds.includes('community_builder')) {
    if (await unlockAchievement(userId, 'community_builder')) newAchievements.push('community_builder');
  }

  return newAchievements;
};

export const getAchievementById = (id: AchievementId): Achievement | undefined => {
  return ACHIEVEMENTS.find((a) => a.id === id);
};
