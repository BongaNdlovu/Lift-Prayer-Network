/**
 * Following Service
 * 
 * Handles follow/unfollow functionality for users.
 * Users can follow other users to see their prayer requests first in the feed.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  serverTimestamp,
  onSnapshot,
  query,
  orderBy,
  limit,
  addDoc,
  Unsubscribe,
} from 'firebase/firestore';
import { db, firebaseEnabled } from './firebase';
import type { FollowRecord } from '../types';
import { NOTIFICATION_TYPES } from '../types/notifications';
import { sendPushViaRelay } from './pushRelay';
import { validateDisplayName } from '../utils/security';
import { FOLLOWING_UID_PAGE_SIZE } from '../config/queryLimits';

const sanitizeActorName = (name?: string | null): string => {
  if (!name) return 'Someone';
  const result = validateDisplayName(name);
  return result.isValid ? (result.sanitized || name) : 'Someone';
};

export type FollowResult = {
  success: boolean;
  error?: string;
};

/**
 * Follow a user
 */
export const followUser = async (
  actorUid: string,
  targetUid: string,
  targetDisplayName: string,
  targetPhotoURL?: string | null,
  actorDisplayName?: string,
  actorPhotoURL?: string | null
): Promise<FollowResult> => {
  if (!firebaseEnabled || !db) {
    return { success: false, error: 'Firebase not enabled' };
  }

  if (!actorUid || !targetUid) {
    return { success: false, error: 'Invalid user IDs' };
  }

  // Prevent following yourself
  if (actorUid === targetUid) {
    return { success: false, error: 'You cannot follow yourself' };
  }

  try {
    const followRef = doc(db, 'following', actorUid, 'users', targetUid);
    
    await setDoc(followRef, {
      targetUid,
      targetDisplayName: targetDisplayName || 'Anonymous',
      targetPhotoURL: targetPhotoURL || null,
      followedAt: serverTimestamp(),
    });

    // Create a notification for the target user
    try {
      const notificationRef = await addDoc(collection(db, 'notifications'), {
        type: NOTIFICATION_TYPES.FOLLOW,
        recipientUid: targetUid,
        actorUid,
        actorDisplayName: sanitizeActorName(actorDisplayName),
        actorPhotoURL: actorPhotoURL || null,
        createdAt: serverTimestamp(),
        read: false,
      });
      console.log('[Following] Created follow notification for:', targetUid);

      await sendPushViaRelay({
        recipientUid: targetUid,
        title: 'New follower',
        body: `${sanitizeActorName(actorDisplayName)} followed you`,
        settingKey: 'notifications',
        notificationId: notificationRef.id,
        data: {
          type: NOTIFICATION_TYPES.FOLLOW,
          actorUid,
          notificationId: notificationRef.id,
        },
      });
    } catch (notifErr) {
      // Non-critical - don't fail the follow if notification fails
      console.warn('[Following] Could not create notification:', notifErr);
    }

    console.log('[Following] Successfully followed user:', targetUid);
    return { success: true };
  } catch (err: any) {
    console.error('[Following] Error following user:', err);
    return { success: false, error: err.message || 'Failed to follow user' };
  }
};

/**
 * Unfollow a user
 */
export const unfollowUser = async (
  actorUid: string,
  targetUid: string
): Promise<FollowResult> => {
  if (!firebaseEnabled || !db) {
    return { success: false, error: 'Firebase not enabled' };
  }

  if (!actorUid || !targetUid) {
    return { success: false, error: 'Invalid user IDs' };
  }

  try {
    const followRef = doc(db, 'following', actorUid, 'users', targetUid);
    await deleteDoc(followRef);

    console.log('[Following] Successfully unfollowed user:', targetUid);
    return { success: true };
  } catch (err: any) {
    console.error('[Following] Error unfollowing user:', err);
    return { success: false, error: err.message || 'Failed to unfollow user' };
  }
};

/**
 * Check if user is following another user
 */
export const isFollowingUser = async (
  actorUid: string,
  targetUid: string
): Promise<boolean> => {
  if (!firebaseEnabled || !db) return false;
  if (!actorUid || !targetUid) return false;

  try {
    const followRef = doc(db, 'following', actorUid, 'users', targetUid);
    const snap = await getDoc(followRef);
    return snap.exists();
  } catch (err) {
    console.error('[Following] Error checking follow status:', err);
    return false;
  }
};

/**
 * Get list of users the current user is following (one-time fetch)
 */
export const getFollowing = async (uid: string): Promise<FollowRecord[]> => {
  if (!firebaseEnabled || !db) return [];
  if (!uid) return [];

  try {
    const followingRef = collection(db, 'following', uid, 'users');
    const q = query(followingRef, orderBy('followedAt', 'desc'));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as FollowRecord[];
  } catch (err) {
    console.error('[Following] Error getting following list:', err);
    return [];
  }
};

/**
 * Get list of user IDs the current user is following (for feed filtering)
 */
export const getFollowingUids = async (uid: string): Promise<string[]> => {
  if (!firebaseEnabled || !db) return [];
  if (!uid) return [];

  try {
    const followingRef = collection(db, 'following', uid, 'users');
    const q = query(followingRef, orderBy('followedAt', 'desc'), limit(FOLLOWING_UID_PAGE_SIZE));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => docSnap.id);
  } catch (err) {
    console.error('[Following] Error getting following UIDs:', err);
    return [];
  }
};

/**
 * Subscribe to following list changes (real-time)
 */
export const subscribeToFollowing = (
  uid: string,
  callback: (following: FollowRecord[]) => void
): Unsubscribe => {
  if (!firebaseEnabled || !db || !uid) {
    callback([]);
    return () => {};
  }

  const followingRef = collection(db, 'following', uid, 'users');
  const q = query(followingRef, orderBy('followedAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const following = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as FollowRecord[];
      callback(following);
    },
    (err) => {
      console.error('[Following] Subscription error:', err);
      callback([]);
    }
  );
};

/**
 * Subscribe to following UIDs only (for feed filtering - lighter weight)
 */
export const subscribeToFollowingUids = (
  uid: string,
  callback: (uids: string[]) => void
): Unsubscribe => {
  if (!firebaseEnabled || !db || !uid) {
    callback([]);
    return () => {};
  }

  const followingRef = collection(db, 'following', uid, 'users');
  const q = query(followingRef, orderBy('followedAt', 'desc'), limit(FOLLOWING_UID_PAGE_SIZE));

  return onSnapshot(
    q,
    (snapshot) => {
      const uids = snapshot.docs.map((docSnap) => docSnap.id);
      callback(uids);
    },
    (err) => {
      console.error('[Following] UIDs subscription error:', err);
      callback([]);
    }
  );
};
