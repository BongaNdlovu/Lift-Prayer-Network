import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  updateDoc,
  serverTimestamp,
  Timestamp,
  runTransaction,
} from 'firebase/firestore';
import { db, firebaseEnabled } from './firebase';
import type { UserProfile } from '../types';

export type UserStats = {
  prayerCount: number;
  requestCount: number;
  testimonyCount: number;
  streakDays: number;
  longestStreak: number;
  prayersThisWeek: number;
  prayersThisMonth: number;
  peopleSupported: number;
  streakLastDate?: string;
  currentStreakStart?: string;
  streakFreezeUsed?: boolean;
};

const getDateString = (date: Date = new Date()): string => {
  return date.toISOString().split('T')[0];
};

const getWeekStart = (): Date => {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day;
  return new Date(now.getFullYear(), now.getMonth(), diff);
};

const getMonthStart = (): Date => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
};

export const getUserStats = async (userId: string): Promise<UserStats> => {
  const defaultStats: UserStats = {
    prayerCount: 0,
    requestCount: 0,
    testimonyCount: 0,
    streakDays: 0,
    longestStreak: 0,
    prayersThisWeek: 0,
    prayersThisMonth: 0,
    peopleSupported: 0,
    streakLastDate: undefined,
    currentStreakStart: undefined,
    streakFreezeUsed: false,
  };

  if (!firebaseEnabled || !db) return defaultStats;

  try {
    // Get user profile stats
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      const profile = userDoc.data() as UserProfile;
      if (profile.stats) {
        defaultStats.prayerCount = profile.stats.prayerCount || 0;
        defaultStats.requestCount = profile.stats.requestCount || 0;
        defaultStats.testimonyCount = profile.stats.testimonyCount || 0;
        defaultStats.streakDays = profile.stats.streakDays || 0;
        defaultStats.longestStreak = profile.stats.longestStreak || 0;
        defaultStats.streakLastDate = profile.stats.streakLastDate;
        defaultStats.currentStreakStart = profile.stats.currentStreakStart;
        defaultStats.streakFreezeUsed = profile.stats.streakFreezeUsed || false;
      }
    }

    // Count prayers this week
    const weekStart = Timestamp.fromDate(getWeekStart());
    const weekPrayersQuery = query(
      collection(db, 'prayers'),
      where('actorUid', '==', userId),
      where('prayedAt', '>=', weekStart)
    );
    const weekSnapshot = await getDocs(weekPrayersQuery);
    defaultStats.prayersThisWeek = weekSnapshot.size;

    // Count prayers this month
    const monthStart = Timestamp.fromDate(getMonthStart());
    const monthPrayersQuery = query(
      collection(db, 'prayers'),
      where('actorUid', '==', userId),
      where('prayedAt', '>=', monthStart)
    );
    const monthSnapshot = await getDocs(monthPrayersQuery);
    defaultStats.prayersThisMonth = monthSnapshot.size;

    // Count unique people supported
    const peopleQuery = query(
      collection(db, 'userPrayedFor', userId, 'people')
    );
    const peopleSnapshot = await getDocs(peopleQuery);
    defaultStats.peopleSupported = peopleSnapshot.size;

    return defaultStats;
  } catch (err) {
    console.warn('Error fetching stats:', err);
    return defaultStats;
  }
};

export const updateStreak = async (userId: string): Promise<number> => {
  if (!firebaseEnabled || !db) return 0;

  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) return 0;

    const profile = userDoc.data() as UserProfile;
    const today = getDateString();
    const yesterday = getDateString(new Date(Date.now() - 86400000));
    
    let streakDays = profile.stats?.streakDays || 0;
    let longestStreak = profile.stats?.longestStreak || 0;
    const lastDate = profile.stats?.streakLastDate;

    if (lastDate === today) {
      // Already prayed today, no change
      return streakDays;
    } else if (lastDate === yesterday) {
      // Continuing streak
      streakDays += 1;
    } else {
      // Streak broken, start new
      streakDays = 1;
    }

    // Update longest streak if current is higher
    if (streakDays > longestStreak) {
      longestStreak = streakDays;
    }

    await updateDoc(userRef, {
      'stats.streakDays': streakDays,
      'stats.streakLastDate': today,
      'stats.longestStreak': longestStreak,
      lastPrayedAt: serverTimestamp(),
    });

    return streakDays;
  } catch (err) {
    console.warn('Error updating streak:', err);
    return 0;
  }
};

export const incrementUserPrayerCount = async (userId: string): Promise<void> => {
  if (!firebaseEnabled || !db) return;

  try {
    await runTransaction(db, async (txn) => {
      const userRef = doc(db!, 'users', userId);
      const snap = await txn.get(userRef);
      const profile = snap.exists() ? (snap.data() as UserProfile) : null;
      const next = (profile?.stats?.prayerCount || 0) + 1;
      txn.set(
        userRef,
        {
          'stats.prayerCount': next,
          lastPrayedAt: serverTimestamp(),
        },
        { merge: true },
      );
    });
  } catch (err) {
    console.warn('Error incrementing prayer count:', err);
  }
};

export const incrementUserRequestCount = async (userId: string): Promise<number> => {
  if (!firebaseEnabled || !db) return 0;

  try {
    return await runTransaction(db, async (txn) => {
      const userRef = doc(db!, 'users', userId);
      const snap = await txn.get(userRef);
      const profile = snap.exists() ? (snap.data() as UserProfile) : null;
      const next = (profile?.stats?.requestCount || 0) + 1;
      txn.set(userRef, { 'stats.requestCount': next }, { merge: true });
      return next;
    });
  } catch (err) {
    console.warn('Error incrementing request count:', err);
    return 0;
  }
};

export const incrementUserTestimonyCount = async (userId: string): Promise<number> => {
  if (!firebaseEnabled || !db) return 0;

  try {
    return await runTransaction(db, async (txn) => {
      const userRef = doc(db!, 'users', userId);
      const snap = await txn.get(userRef);
      const profile = snap.exists() ? (snap.data() as UserProfile) : null;
      const next = (profile?.stats?.testimonyCount || 0) + 1;
      txn.set(userRef, { 'stats.testimonyCount': next }, { merge: true });
      return next;
    });
  } catch (err) {
    console.warn('Error incrementing testimony count:', err);
    return 0;
  }
};

