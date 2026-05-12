import {
  collection,
  doc,
  increment,
  runTransaction,
  serverTimestamp,
  query,
  where,
  getDocs,
  limit,
} from 'firebase/firestore';
import { db, firebaseEnabled } from '../firebase';
import { updateStreak } from '../stats';
import { checkAndUnlockAchievements } from '../achievements';
import { LogPrayerResult, RequestUpdateData } from './types';
import { checkActionRateLimit, formatRateLimitError } from '../../utils/security';

/**
 * Check if user has already prayed on a specific request.
 * Used to prevent duplicate prayers.
 */
export const hasUserPrayed = async (
  actorUid: string,
  targetRequestId: string
): Promise<boolean> => {
  if (!firebaseEnabled || !db) return false;

  try {
    const q = query(
      collection(db, 'prayers'),
      where('actorUid', '==', actorUid),
      where('targetRequestId', '==', targetRequestId),
      limit(1)
    );
    const snapshot = await getDocs(q);
    return !snapshot.empty;
  } catch (err) {
    console.error('[Prayers] Error checking if user prayed:', err);
    return false;
  }
};

/**
 * Log a prayer for a specific prayer request.
 * Handles transaction safety, streak updates, and notifications.
 */
export const logPrayer = async (
  actorUid: string,
  targetRequestId: string,
  targetOwnerUid: string,
  targetSummary: string,
  actorDisplayName?: string
): Promise<LogPrayerResult> => {
  if (!firebaseEnabled || !db) {
    return { success: false, error: 'Firebase not enabled' };
  }

  // Validate inputs to prevent crashes
  if (!actorUid || typeof actorUid !== 'string') {
    return { success: false, error: 'Invalid user ID' };
  }
  if (!targetRequestId || typeof targetRequestId !== 'string') {
    return { success: false, error: 'Invalid request ID' };
  }

  // Client-side rate limiting for prayers
  const rateLimit = checkActionRateLimit(actorUid, 'prayers');
  if (!rateLimit.allowed) {
    return {
      success: false,
      error: formatRateLimitError('prayers', rateLimit.resetInSeconds),
      rateLimited: true,
    };
  }

  // Prevent users from praying on their own requests
  if (actorUid === targetOwnerUid) {
    return { 
      success: false, 
      error: 'You cannot pray on your own request. Share it with others to receive prayers!',
      isSelfPrayer: true,
    };
  }

  const prayerRef = doc(db, 'prayers', `${actorUid}_${targetRequestId}`);
  const requestRef = doc(db, 'requests', targetRequestId);
  const userRef = doc(db, 'users', actorUid);
  const safeTargetOwnerUid = targetOwnerUid || 'anon';
  const peopleRef = doc(db, 'userPrayedFor', actorUid, 'people', safeTargetOwnerUid);

  // Check if this is a self-prayer (user praying on their own request)
  const isSelfPrayer = actorUid === safeTargetOwnerUid;

  let prayerCount = 0;

  try {
    await runTransaction(db, async (txn) => {
      const prayerSnap = await txn.get(prayerRef);
      if (prayerSnap.exists()) {
        throw new Error('ALREADY_PRAYED');
      }

      // First, try to get the request
      let requestSnap;
      try {
        requestSnap = await txn.get(requestRef);
      } catch (err) {
        console.error('[Prayers] Error fetching request in transaction:', err);
        throw new Error('Could not access prayer request');
      }

      if (!requestSnap.exists()) {
        throw new Error('Prayer request not found');
      }

      const requestData = requestSnap.data();
      // Try to get user data, but don't fail if it doesn't exist
      let currentCount = 0;
      try {
        const userSnap = await txn.get(userRef);
        if (userSnap.exists()) {
          const userData = userSnap.data();
          currentCount = (userData?.stats?.prayerCount as number) ?? 0;
        }
      } catch (err) {
        console.warn('[Prayers] Could not fetch user data, starting count from 0:', err);
      }
      prayerCount = currentCount + 1;

      // Create prayer record
      txn.set(prayerRef, {
        actorUid,
        actorDisplayName: actorDisplayName || 'Anonymous',
        targetRequestId,
        targetOwnerUid: safeTargetOwnerUid,
        targetSummary: targetSummary || '',
        prayedAt: serverTimestamp(),
        status: 'PRAYED',
        isSelfPrayer,
      });

      // Auto-status progression: PENDING → ACTIVE after threshold
      const updateData: RequestUpdateData = {
        prayers: increment(1),
      };

      txn.update(requestRef, updateData);

      // Update people prayed for - use set with merge to create if not exists
      // Get the request owner's display name for the "People I Prayed For" list
      const targetName = requestData?.userDisplayName || 'Anonymous';
      txn.set(
        peopleRef,
        {
          count: increment(1),
          targetOwnerUid: safeTargetOwnerUid,
          targetName,
          lastPrayedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // Update user stats - use set with merge to create if not exists
      txn.set(
        userRef,
        {
          stats: {
            prayerCount: prayerCount,
          },
          lastPrayedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // Create a notification document for the request owner
      if (!isSelfPrayer && safeTargetOwnerUid !== 'anon' && db) {
        const notificationRef = doc(collection(db, 'notifications'));
        txn.set(notificationRef, {
          type: 'prayer_received',
          recipientUid: safeTargetOwnerUid,
          actorUid,
          actorDisplayName: actorDisplayName || 'Someone',
          targetRequestId,
          targetSummary: targetSummary?.slice(0, 100) || '',
          createdAt: serverTimestamp(),
          read: false,
        });
      }
    });

    // Update streak and achievements (non-critical, wrapped in try-catch)
    try {
      const streakDays = await updateStreak(actorUid);
      await checkAndUnlockAchievements(actorUid, {
        prayerCount,
        streakDays,
      });
    } catch (err) {
      console.warn('[Prayers] Non-critical: Could not update streak/achievements:', err);
    }

    return { success: true, isSelfPrayer };
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'ALREADY_PRAYED') {
      return {
        success: false,
        error: 'You have already prayed for this request',
        alreadyPrayed: true,
      };
    }
    console.error('[Prayers] Error logging prayer:', err);
    const errorMessage = err instanceof Error ? err.message : 'Could not log prayer. Please try again.';
    return { success: false, error: errorMessage };
  }
};

/**
 * Log a reaction (heart, fire, strong) on a prayer request or testimony.
 */
export type ReactionType = 'heart' | 'fire' | 'strong';

export const logReaction = async (
  actorUid: string,
  targetId: string,
  targetType: 'REQUEST' | 'TESTIMONY',
  reactionType: ReactionType
): Promise<{ success: boolean; error?: string; rateLimited?: boolean }> => {
  if (!firebaseEnabled || !db) {
    return { success: false, error: 'Firebase not enabled' };
  }

  if (!actorUid || !targetId) {
    return { success: false, error: 'Invalid parameters' };
  }

  // Client-side rate limiting for reactions
  const rateLimit = checkActionRateLimit(actorUid, 'reactions');
  if (!rateLimit.allowed) {
    return {
      success: false,
      error: formatRateLimitError('reactions', rateLimit.resetInSeconds),
      rateLimited: true,
    };
  }

  // Map reaction type to field name
  const fieldMap: Record<ReactionType, string> = {
    heart: 'heartCount',
    fire: 'fireCount',
    strong: 'strongCount',
  };

  const fieldName = fieldMap[reactionType];
  if (!fieldName) {
    return { success: false, error: 'Invalid reaction type' };
  }

  const collectionName = targetType === 'REQUEST' ? 'requests' : 'testimonies';
  const targetRef = doc(db, collectionName, targetId);

  try {
    // Check if user already reacted with this type
    const reactionId = `${actorUid}_${targetId}_${reactionType}`;
    const reactionRef = doc(db, 'reactions', reactionId);

    await runTransaction(db, async (txn) => {
      const reactionSnap = await txn.get(reactionRef);
      
      if (reactionSnap.exists()) {
        // User already reacted - this is a toggle off (decrement)
        txn.delete(reactionRef);
        txn.update(targetRef, {
          [fieldName]: increment(-1),
        });
      } else {
        // New reaction - increment
        txn.set(reactionRef, {
          actorUid,
          targetId,
          targetType,
          reactionType,
          createdAt: serverTimestamp(),
        });
        txn.update(targetRef, {
          [fieldName]: increment(1),
        });
      }
    });

    return { success: true };
  } catch (err: unknown) {
    console.error('[Reactions] Error logging reaction:', err);
    const errorMessage = err instanceof Error ? err.message : 'Could not log reaction';
    return { success: false, error: errorMessage };
  }
};

/**
 * Like/Amen a testimony (toggle).
 * Increments or decrements the likes count.
 */
export const likeTestimony = async (
  actorUid: string,
  testimonyId: string,
  testimonyOwnerUid?: string,
): Promise<{ success: boolean; error?: string; liked?: boolean; isOwnTestimony?: boolean; rateLimited?: boolean }> => {
  if (!firebaseEnabled || !db) {
    return { success: false, error: 'Firebase not initialized' };
  }

  if (!actorUid || !testimonyId) {
    return { success: false, error: 'Invalid parameters' };
  }

  // Client-side rate limiting for reactions (amen is a type of reaction)
  const rateLimit = checkActionRateLimit(actorUid, 'reactions');
  if (!rateLimit.allowed) {
    return {
      success: false,
      error: formatRateLimitError('reactions', rateLimit.resetInSeconds),
      rateLimited: true,
    };
  }

  const testimonyRef = doc(db, 'testimonies', testimonyId);
  const likeId = `${actorUid}_${testimonyId}_amen`;
  const likeRef = doc(db, 'reactions', likeId);

  try {
    let liked = false;
    
    await runTransaction(db, async (txn) => {
      // First check if this is the user's own testimony
      const testimonySnap = await txn.get(testimonyRef);
      if (!testimonySnap.exists()) {
        throw new Error('Testimony not found');
      }
      
      const testimonyData = testimonySnap.data();
      const ownerUid = testimonyOwnerUid || testimonyData?.ownerUid;
      
      // Prevent users from liking their own testimony
      if (actorUid === ownerUid) {
        throw new Error('SELF_AMEN');
      }
      
      const likeSnap = await txn.get(likeRef);
      
      if (likeSnap.exists()) {
        // User already liked - toggle off (decrement)
        txn.delete(likeRef);
        txn.update(testimonyRef, {
          likes: increment(-1),
        });
        liked = false;
      } else {
        // New like - increment
        txn.set(likeRef, {
          actorUid,
          targetId: testimonyId,
          targetType: 'TESTIMONY',
          reactionType: 'amen',
          createdAt: serverTimestamp(),
        });
        txn.update(testimonyRef, {
          likes: increment(1),
        });
        liked = true;
        
        // Create notification for testimony owner
        if (ownerUid && ownerUid !== 'anon' && db) {
          const notificationRef = doc(collection(db, 'notifications'));
          txn.set(notificationRef, {
            type: 'amen_received',
            recipientUid: ownerUid,
            actorUid,
            targetTestimonyId: testimonyId,
            targetSummary: (testimonyData?.content as string)?.slice(0, 100) || 'your testimony',
            createdAt: serverTimestamp(),
            read: false,
          });
        }
      }
    });

    return { success: true, liked };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Could not like testimony';
    
    // Handle self-amen error specifically
    if (errorMessage === 'SELF_AMEN') {
      return { 
        success: false, 
        error: 'You cannot amen your own testimony',
        isOwnTestimony: true,
      };
    }
    
    console.error('[Testimonies] Error liking testimony:', err);
    return { success: false, error: errorMessage };
  }
};
