import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db, firebaseEnabled } from './firebase';

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

// Report content or user
export const reportContent = async (
  reporterUid: string,
  targetType: 'user' | 'request' | 'testimony' | 'comment',
  targetId: string,
  targetOwnerUid: string,
  reason: ReportReason,
  details?: string
): Promise<boolean> => {
  if (!firebaseEnabled || !db) return false;

  try {
    await addDoc(collection(db, 'reports'), {
      reporterUid,
      targetType,
      targetId,
      targetOwnerUid,
      reason,
      details: details || '',
      status: 'pending',
      createdAt: serverTimestamp(),
    });
    return true;
  } catch (err) {
    console.warn('Error reporting content:', err);
    return false;
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

