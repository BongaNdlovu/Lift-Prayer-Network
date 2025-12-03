import {
  collection,
  doc,
  addDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db, firebaseEnabled } from './firebase';
import { checkActionRateLimit, formatRateLimitError } from '../utils/security';

const BLOCKED_USERS_KEY = '@lift_blocked_users';

export type ReportReason = 
  | 'spam'
  | 'inappropriate'
  | 'harassment'
  | 'misinformation'
  | 'other';

export type Report = {
  id: string;
  reporterUid: string;
  targetType: 'user' | 'request' | 'testimony' | 'comment';
  targetId: string;
  targetOwnerUid: string;
  reason: ReportReason;
  details?: string;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  createdAt: any;
};

export type ReportResult = 
  | { success: true }
  | { success: false; error: string };

// Report content or user
export const reportContent = async (
  reporterUid: string,
  targetType: 'user' | 'request' | 'testimony' | 'comment',
  targetId: string,
  targetOwnerUid: string,
  reason: ReportReason,
  details?: string
): Promise<ReportResult> => {
  if (!firebaseEnabled || !db) {
    return { success: false, error: 'Service unavailable' };
  }

  if (!reporterUid) {
    return { success: false, error: 'Authentication required to report content' };
  }

  // Rate limit: max 5 reports per minute per user
  const rateLimit = checkActionRateLimit(reporterUid, 'reports');
  if (!rateLimit.allowed) {
    return { success: false, error: formatRateLimitError('reports', rateLimit.resetInSeconds) };
  }

  try {
    await addDoc(collection(db, 'reports'), {
      actorUid: reporterUid, // Field name must match Firestore rules (actorUid)
      targetType,
      targetId,
      targetOwnerUid,
      reason,
      details: details || '',
      status: 'pending',
      createdAt: serverTimestamp(),
    });
    return { success: true };
  } catch (err) {
    console.warn('Error reporting content:', err);
    return { success: false, error: 'Could not submit report. Please try again.' };
  }
};

// Block a user (stored locally + optionally in Firestore)
export const blockUser = async (userId: string, blockedUserId: string): Promise<boolean> => {
  try {
    // Store locally
    const blocked = await getBlockedUsers();
    if (!blocked.includes(blockedUserId)) {
      blocked.push(blockedUserId);
      await AsyncStorage.setItem(BLOCKED_USERS_KEY, JSON.stringify(blocked));
    }

    // Also store in Firestore for persistence across devices
    if (firebaseEnabled && db) {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        blockedUsers: arrayUnion(blockedUserId),
      });
    }

    return true;
  } catch (err) {
    console.warn('Error blocking user:', err);
    return false;
  }
};

// Unblock a user
export const unblockUser = async (userId: string, blockedUserId: string): Promise<boolean> => {
  try {
    // Remove from local storage
    const blocked = await getBlockedUsers();
    const filtered = blocked.filter((id) => id !== blockedUserId);
    await AsyncStorage.setItem(BLOCKED_USERS_KEY, JSON.stringify(filtered));

    // Remove from Firestore
    if (firebaseEnabled && db) {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        blockedUsers: arrayRemove(blockedUserId),
      });
    }

    return true;
  } catch (err) {
    console.warn('Error unblocking user:', err);
    return false;
  }
};

// Get blocked users from local storage
export const getBlockedUsers = async (): Promise<string[]> => {
  try {
    const data = await AsyncStorage.getItem(BLOCKED_USERS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

// Sync blocked users from Firestore to local storage
export const syncBlockedUsers = async (userId: string): Promise<string[]> => {
  if (!firebaseEnabled || !db) return [];

  try {
    const userRef = doc(db, 'users', userId);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const blockedUsers = snap.data()?.blockedUsers || [];
      await AsyncStorage.setItem(BLOCKED_USERS_KEY, JSON.stringify(blockedUsers));
      return blockedUsers;
    }
    return [];
  } catch (err) {
    console.warn('Error syncing blocked users:', err);
    return [];
  }
};

// Check if a user is blocked
export const isUserBlocked = async (userId: string): Promise<boolean> => {
  const blocked = await getBlockedUsers();
  return blocked.includes(userId);
};

// Report reasons for UI
export const REPORT_REASONS: { id: ReportReason; label: string; emoji: string }[] = [
  { id: 'spam', label: 'Spam or advertising', emoji: '🚫' },
  { id: 'inappropriate', label: 'Inappropriate content', emoji: '⚠️' },
  { id: 'harassment', label: 'Harassment or bullying', emoji: '😔' },
  { id: 'misinformation', label: 'False information', emoji: '❌' },
  { id: 'other', label: 'Other concern', emoji: '📝' },
];

// ============================================================================
// Admin Ban Feature - Global app-wide ban
// ============================================================================

export type BanResult = 
  | { success: true }
  | { success: false; error: string };

/**
 * Admin: Ban a user from the app entirely
 * Sets isBanned=true on the user's document
 */
export const banUser = async (
  targetUserId: string,
  reason?: string
): Promise<BanResult> => {
  if (!firebaseEnabled || !db) {
    return { success: false, error: 'Service unavailable' };
  }

  try {
    const userRef = doc(db, 'users', targetUserId);
    await updateDoc(userRef, {
      isBanned: true,
      bannedAt: serverTimestamp(),
      banReason: reason || 'Violation of community guidelines',
    });
    return { success: true };
  } catch (err) {
    console.error('Error banning user:', err);
    return { success: false, error: 'Could not ban user. Please try again.' };
  }
};

/**
 * Admin: Unban a user
 */
export const unbanUser = async (targetUserId: string): Promise<BanResult> => {
  if (!firebaseEnabled || !db) {
    return { success: false, error: 'Service unavailable' };
  }

  try {
    const userRef = doc(db, 'users', targetUserId);
    await updateDoc(userRef, {
      isBanned: false,
      unbannedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (err) {
    console.error('Error unbanning user:', err);
    return { success: false, error: 'Could not unban user. Please try again.' };
  }
};

/**
 * Admin/Moderator: Block a user from posting (soft restriction)
 * User can still view content but cannot create new posts
 */
export const blockUserFromPosting = async (
  targetUserId: string,
  reason?: string
): Promise<BanResult> => {
  if (!firebaseEnabled || !db) {
    return { success: false, error: 'Service unavailable' };
  }

  try {
    const userRef = doc(db, 'users', targetUserId);
    await updateDoc(userRef, {
      isBlockedFromPosting: true,
      blockedFromPostingAt: serverTimestamp(),
      blockFromPostingReason: reason || 'Posting privileges suspended by moderator',
    });
    return { success: true };
  } catch (err) {
    console.error('Error blocking user from posting:', err);
    return { success: false, error: 'Could not block user. Please try again.' };
  }
};

/**
 * Admin/Moderator: Unblock a user from posting
 */
export const unblockUserFromPosting = async (targetUserId: string): Promise<BanResult> => {
  if (!firebaseEnabled || !db) {
    return { success: false, error: 'Service unavailable' };
  }

  try {
    const userRef = doc(db, 'users', targetUserId);
    await updateDoc(userRef, {
      isBlockedFromPosting: false,
      unblockedFromPostingAt: serverTimestamp(),
    });
    return { success: true };
  } catch (err) {
    console.error('Error unblocking user from posting:', err);
    return { success: false, error: 'Could not unblock user. Please try again.' };
  }
};

/**
 * Check if a user is blocked from posting
 */
export const checkUserBlockedFromPosting = async (userId: string): Promise<{ isBlocked: boolean; reason?: string }> => {
  if (!firebaseEnabled || !db || !userId) {
    return { isBlocked: false };
  }

  try {
    const userRef = doc(db, 'users', userId);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data();
      return {
        isBlocked: data?.isBlockedFromPosting === true,
        reason: data?.blockFromPostingReason,
      };
    }
    return { isBlocked: false };
  } catch (err) {
    console.error('Error checking posting block status:', err);
    return { isBlocked: false };
  }
};

/**
 * Check if a user is banned (fetches from Firestore)
 */
export const checkUserBanned = async (userId: string): Promise<{ isBanned: boolean; reason?: string }> => {
  if (!firebaseEnabled || !db || !userId) {
    return { isBanned: false };
  }

  try {
    const userRef = doc(db, 'users', userId);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data();
      return {
        isBanned: data?.isBanned === true,
        reason: data?.banReason,
      };
    }
    return { isBanned: false };
  } catch (err) {
    console.error('Error checking ban status:', err);
    return { isBanned: false };
  }
};

