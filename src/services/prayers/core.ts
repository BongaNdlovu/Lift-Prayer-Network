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
import { LogPrayerResult, RequestUpdateData, PRAYERS_FOR_ACTIVE } from './types';

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

  // Check if user has already prayed on this request
  const alreadyPrayed = await hasUserPrayed(actorUid, targetRequestId);
  if (alreadyPrayed) {
    return {
      success: false,
      error: 'You have already prayed for this request',
      alreadyPrayed: true,
    };
  }

  const prayerRef = doc(collection(db, 'prayers'));
  const requestRef = doc(db, 'requests', targetRequestId);
  const userRef = doc(db, 'users', actorUid);
  const safeTargetOwnerUid = targetOwnerUid || 'anon';
  const peopleRef = doc(db, 'userPrayedFor', actorUid, 'people', safeTargetOwnerUid);

  // Check if this is a self-prayer (user praying on their own request)
  const isSelfPrayer = actorUid === safeTargetOwnerUid;

  let prayerCount = 0;

  try {
    await runTransaction(db, async (txn) => {
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
      const currentPrayers = (requestData?.prayers as number) ?? 0;
      const newPrayerCount = currentPrayers + 1;
      const currentStatus = (requestData?.status as string) || 'PENDING';

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

      if (currentStatus === 'PENDING' && newPrayerCount >= PRAYERS_FOR_ACTIVE) {
        updateData.status = 'ACTIVE';
        updateData.severity = requestData?.isUrgent ? 'CRITICAL' : 'HIGH';
        updateData.activatedAt = serverTimestamp();
      }

      txn.update(requestRef, updateData);

      // Update people prayed for - use set with merge to create if not exists
      txn.set(
        peopleRef,
        {
          count: increment(1),
          targetOwnerUid: safeTargetOwnerUid,
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
    console.error('[Prayers] Error logging prayer:', err);
    const errorMessage = err instanceof Error ? err.message : 'Could not log prayer. Please try again.';
    return { success: false, error: errorMessage };
  }
};
