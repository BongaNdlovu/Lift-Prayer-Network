import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  collection,
  addDoc,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { Platform } from 'react-native';
import { db, firebaseEnabled } from './firebase';
import type { UserProfile } from '../types';

// Type for onboarding answers
export type OnboardingAnswers = {
  faith_journey?: string;
  prayer_style?: string;
  interests?: string[];
  name?: string;
};

const defaultProfile = (user: User): UserProfile => ({
  displayName: user.displayName || 'Anonymous',
  email: user.email || undefined,
  photoURL: user.photoURL ?? null,
  createdAt: serverTimestamp(),
  lastActiveAt: serverTimestamp(),
  roles: ['user'],
  stats: { prayerCount: 0, testimonyCount: 0, streakDays: 0 },
  settings: { 
    notifications: true, 
    notificationsCritical: false, 
    notificationsPrayers: true,
    notificationsComments: true,
    notificationsTestimonies: true,
    notificationsGroups: true,
    weeklyRecapEnabled: false,
    shareProfile: false 
  },
});

export const ensureUserProfile = async (
  user: User,
  extra: Partial<UserProfile> = {},
) => {
  if (!firebaseEnabled || !db) return;
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    // Use setDoc to create new profile
    await setDoc(ref, { ...defaultProfile(user), ...extra });
  } else if (Object.keys(extra).length > 0) {
    // Only update if there's extra data to add (avoid unnecessary writes)
    // Use setDoc with merge to be idempotent in case of race conditions
    await setDoc(ref, {
      ...extra,
      lastActiveAt: serverTimestamp(),
    }, { merge: true });
  }
};

export const touchUserLastActive = async (user: User) => {
  if (!firebaseEnabled || !db) return;
  const ref = doc(db, 'users', user.uid);
  await updateDoc(ref, { lastActiveAt: serverTimestamp() });
};

export const updateUserSettings = async (user: User, settings: Partial<UserProfile['settings']>) => {
  if (!firebaseEnabled || !db) return;
  const ref = doc(db, 'users', user.uid);
  const flattened: Record<string, any> = {};
  Object.entries(settings || {}).forEach(([key, value]) => {
    flattened[`settings.${key}`] = value;
  });
  await updateDoc(ref, { ...flattened, lastActiveAt: serverTimestamp() });
};

export const updateUserProfile = async (userId: string, updates: Partial<Pick<UserProfile, 'displayName' | 'photoURL' | 'location' | 'timeZone'>>) => {
  if (!firebaseEnabled || !db) return;
  const ref = doc(db, 'users', userId);
  await updateDoc(ref, { ...updates, lastActiveAt: serverTimestamp() });
};

/**
 * Save onboarding answers to the user's profile
 * This allows you to see each user's onboarding responses
 */
export const saveOnboardingAnswersToProfile = async (
  userId: string,
  answers: OnboardingAnswers
): Promise<void> => {
  if (!firebaseEnabled || !db) return;
  
  try {
    const ref = doc(db, 'users', userId);
    await updateDoc(ref, {
      onboarding: {
        answers,
        completedAt: serverTimestamp(),
      },
      lastActiveAt: serverTimestamp(),
    });
    console.log('[UserProfile] Saved onboarding answers to user profile');
  } catch (err) {
    console.error('[UserProfile] Error saving onboarding answers to profile:', err);
  }
};

/**
 * Save onboarding response to analytics collection for aggregate analysis
 * This creates a separate document for each onboarding completion
 * You can query this collection to see trends, popular answers, etc.
 */
export const recordOnboardingAnalytics = async (
  userId: string | null,
  answers: OnboardingAnswers,
  metadata?: {
    isAnonymous?: boolean;
    platform?: string;
  }
): Promise<void> => {
  if (!firebaseEnabled || !db) return;

  try {
    const analyticsRef = collection(db, 'onboarding_analytics');
    await addDoc(analyticsRef, {
      // User info (anonymized option)
      userId: userId || 'anonymous',
      isAnonymous: metadata?.isAnonymous ?? !userId,
      
      // Answers breakdown for easy querying
      faithJourney: answers.faith_journey || null,
      prayerStyle: answers.prayer_style || null,
      interests: answers.interests || [],
      providedName: !!answers.name,
      
      // Full answers object for reference
      rawAnswers: answers,
      
      // Metadata
      platform: metadata?.platform || Platform.OS,
      completedAt: serverTimestamp(),
      
      // App version (you can add this later)
      // appVersion: Constants.expoConfig?.version,
    });
    console.log('[UserProfile] Recorded onboarding analytics');
  } catch (err) {
    console.error('[UserProfile] Error recording onboarding analytics:', err);
    // Don't throw - analytics shouldn't break the app
  }
};

/**
 * Combined function to save onboarding data everywhere
 * Call this when onboarding is complete and user is authenticated
 */
export const syncOnboardingData = async (
  user: User | null,
  answers: OnboardingAnswers
): Promise<void> => {
  // Always record analytics (even for anonymous users)
  await recordOnboardingAnalytics(
    user?.uid || null,
    answers,
    { isAnonymous: user?.isAnonymous ?? true }
  );

  // If user is authenticated, also save to their profile
  if (user?.uid) {
    await saveOnboardingAnswersToProfile(user.uid, answers);
  }
};
