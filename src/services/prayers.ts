import {
  collection,
  doc,
  increment,
  runTransaction,
  serverTimestamp,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  Unsubscribe,
  getDoc,
  getDocs,
  writeBatch,
  limit,
  DocumentReference,
  DocumentData,
  FieldValue,
} from 'firebase/firestore';
import { db, firebaseEnabled } from './firebase';
import { updateStreak } from './stats';
import { checkAndUnlockAchievements } from './achievements';
import type { LiftRequest, Testimony, PrayerCategory, Severity } from '../types';
import { canEditContent, canDeleteContent, hasAdminPermission } from '../config/admins';

// ============================================================================
// Types & Interfaces
// ============================================================================

/** Standard result type for all mutation operations */
export type ServiceResult<T = void> = {
  success: boolean;
  error?: string;
  data?: T;
};

/** Result type for logPrayer with additional flags */
export type LogPrayerResult = ServiceResult & {
  alreadyPrayed?: boolean;
  isSelfPrayer?: boolean;
};

/** Data for editing a prayer request */
export type EditRequestData = {
  content?: string;
  category?: PrayerCategory;
  isUrgent?: boolean;
  isPrivate?: boolean;
};

/** Data for editing a testimony */
export type EditTestimonyData = {
  content?: string;
};

/** Update data for request status progression */
type RequestUpdateData = {
  prayers: FieldValue;
  status?: 'PENDING' | 'ACTIVE' | 'RESOLVED';
  severity?: Severity;
  activatedAt?: FieldValue;
  [key: string]: unknown;
};

/** Update data for request edits */
type RequestEditUpdateData = {
  updatedAt: FieldValue;
  content?: string;
  category?: PrayerCategory;
  isUrgent?: boolean;
  isPrivate?: boolean;
  visibility?: 'PUBLIC' | 'PRIVATE' | 'GROUP';
  severity?: Severity;
  [key: string]: unknown;
};

/** Update data for testimony edits */
type TestimonyEditUpdateData = {
  updatedAt: FieldValue;
  content?: string;
  [key: string]: unknown;
};

// ============================================================================
// Constants
// ============================================================================

/** After this many prayers, status changes from PENDING to ACTIVE */
const PRAYERS_FOR_ACTIVE = 3;

/** Maximum operations per Firestore batch */
const BATCH_SIZE = 500;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generic helper for permission-checked document operations.
 * Reduces boilerplate for edit/delete operations.
 */
async function withPermissionCheck<T>(
  collectionName: string,
  docId: string,
  currentUserUid: string,
  currentUserEmail: string | null | undefined,
  checkFn: (ownerUid: string, userId: string, email?: string | null) => boolean,
  notFoundMessage: string,
  noPermissionMessage: string,
  action: (docRef: DocumentReference<DocumentData>, docData: DocumentData) => Promise<T>
): Promise<ServiceResult<T>> {
  if (!firebaseEnabled || !db) {
    return { success: false, error: 'Firebase not enabled' };
  }

  try {
    const docRef = doc(db, collectionName, docId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return { success: false, error: notFoundMessage };
    }

    const docData = docSnap.data();

    if (!checkFn(docData.ownerUid, currentUserUid, currentUserEmail)) {
      return { success: false, error: noPermissionMessage };
    }

    const result = await action(docRef, docData);
    return { success: true, data: result };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
    console.error(`[Prayers] Error in ${collectionName} operation:`, err);
    return { success: false, error: errorMessage };
  }
}

/**
 * Batch delete documents with proper batch management.
 * Creates new batches after each commit to avoid reusing committed batches.
 */
async function batchDeleteDocuments(
  docs: { ref: DocumentReference<DocumentData> }[]
): Promise<void> {
  if (!db || docs.length === 0) return;

  let batch = writeBatch(db);
  let count = 0;

  for (const docSnap of docs) {
    batch.delete(docSnap.ref);
    count++;

    if (count >= BATCH_SIZE) {
      await batch.commit();
      // Create a NEW batch after commit - this was the bug fix!
      batch = writeBatch(db);
      count = 0;
    }
  }

  // Commit remaining operations
  if (count > 0) {
    await batch.commit();
  }
}

// ============================================================================
// Core Prayer Functions
// ============================================================================

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

// ============================================================================
// Group Functions
// ============================================================================

/**
 * Subscribe to group-specific prayer requests.
 * Returns an unsubscribe function for cleanup.
 */
export const subscribeToGroupRequests = (
  groupId: string,
  callback: (requests: LiftRequest[]) => void
): Unsubscribe => {
  if (!firebaseEnabled || !db) {
    callback([]);
    return () => {};
  }

  const q = query(
    collection(db, 'requests'),
    where('groupIds', 'array-contains', groupId),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const requests = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as LiftRequest[];
      callback(requests);
    },
    (error) => {
      console.error('[Prayers] Group requests subscription error:', error);
      callback([]);
    }
  );
};

/**
 * Submit a prayer request to a specific group.
 */
export const submitGroupRequest = async (
  groupId: string,
  content: string,
  ownerUid: string,
  displayName: string,
  userEmail?: string,
  isUrgent: boolean = false
): Promise<ServiceResult<string>> => {
  if (!firebaseEnabled || !db) {
    return { success: false, error: 'Firebase not enabled' };
  }

  try {
    const docRef = await addDoc(collection(db, 'requests'), {
      ownerUid,
      userDisplayName: displayName,
      userEmail: userEmail || null,
      content,
      severity: isUrgent ? 'CRITICAL' : 'PENDING',
      status: 'PENDING',
      prayers: 0,
      isUrgent,
      isPrivate: true,
      visibility: 'GROUP',
      groupIds: [groupId],
      createdAt: serverTimestamp(),
      commentCount: 0,
    });

    return { success: true, data: docRef.id };
  } catch (err: unknown) {
    console.error('[Prayers] Error submitting group request:', err);
    const errorMessage = err instanceof Error ? err.message : 'Could not submit request';
    return { success: false, error: errorMessage };
  }
};

// ============================================================================
// Edit Functions
// ============================================================================

/**
 * Edit a prayer request (with permission check).
 * Note: Status is NOT editable by users - it changes automatically based on engagement.
 */
export const editPrayerRequest = async (
  requestId: string,
  updates: EditRequestData,
  currentUserUid: string,
  currentUserEmail?: string | null
): Promise<ServiceResult> => {
  return withPermissionCheck(
    'requests',
    requestId,
    currentUserUid,
    currentUserEmail,
    canEditContent,
    'Prayer request not found',
    'You do not have permission to edit this prayer',
    async (docRef, docData) => {
      const updateData: RequestEditUpdateData = {
        updatedAt: serverTimestamp(),
      };

      if (updates.content !== undefined) {
        updateData.content = updates.content;
      }
      if (updates.category !== undefined) {
        updateData.category = updates.category;
      }
      if (updates.isUrgent !== undefined) {
        updateData.isUrgent = updates.isUrgent;
        // Update severity based on urgency, but only if not resolved
        if (docData.status !== 'RESOLVED') {
          if (updates.isUrgent) {
            updateData.severity = 'CRITICAL';
          } else if (docData.severity === 'CRITICAL' && !docData.isUrgent) {
            // Revert to status-based severity
            updateData.severity = docData.status === 'ACTIVE' ? 'HIGH' : 'PENDING';
          }
        }
      }
      if (updates.isPrivate !== undefined) {
        updateData.isPrivate = updates.isPrivate;
        updateData.visibility = updates.isPrivate ? 'PRIVATE' : 'PUBLIC';
      }

      await updateDoc(docRef, updateData);
    }
  );
};

/**
 * Edit a testimony (with permission check).
 */
export const editTestimony = async (
  testimonyId: string,
  updates: EditTestimonyData,
  currentUserUid: string,
  currentUserEmail?: string | null
): Promise<ServiceResult> => {
  return withPermissionCheck(
    'testimonies',
    testimonyId,
    currentUserUid,
    currentUserEmail,
    canEditContent,
    'Testimony not found',
    'You do not have permission to edit this testimony',
    async (docRef) => {
      const updateData: TestimonyEditUpdateData = {
        updatedAt: serverTimestamp(),
      };

      if (updates.content !== undefined) {
        updateData.content = updates.content;
      }

      await updateDoc(docRef, updateData);
    }
  );
};

// ============================================================================
// Delete Functions
// ============================================================================

/**
 * Delete a prayer request (with permission check).
 */
export const deletePrayerRequest = async (
  requestId: string,
  currentUserUid: string,
  currentUserEmail?: string | null
): Promise<ServiceResult> => {
  return withPermissionCheck(
    'requests',
    requestId,
    currentUserUid,
    currentUserEmail,
    canDeleteContent,
    'Prayer request not found',
    'You do not have permission to delete this prayer',
    async (docRef) => {
      await deleteDoc(docRef);
    }
  );
};

/**
 * Delete a testimony (with permission check).
 */
export const deleteTestimony = async (
  testimonyId: string,
  currentUserUid: string,
  currentUserEmail?: string | null
): Promise<ServiceResult> => {
  return withPermissionCheck(
    'testimonies',
    testimonyId,
    currentUserUid,
    currentUserEmail,
    canDeleteContent,
    'Testimony not found',
    'You do not have permission to delete this testimony',
    async (docRef) => {
      await deleteDoc(docRef);
    }
  );
};

// ============================================================================
// Read Functions
// ============================================================================

/**
 * Get a single prayer request by ID.
 */
export const getPrayerRequest = async (requestId: string): Promise<LiftRequest | null> => {
  if (!firebaseEnabled || !db) return null;

  try {
    const requestRef = doc(db, 'requests', requestId);
    const requestSnap = await getDoc(requestRef);

    if (!requestSnap.exists()) return null;

    return { id: requestSnap.id, ...requestSnap.data() } as LiftRequest;
  } catch (err) {
    console.error('[Prayers] Error fetching request:', err);
    return null;
  }
};

/**
 * Get a single testimony by ID.
 */
export const getTestimony = async (testimonyId: string): Promise<Testimony | null> => {
  if (!firebaseEnabled || !db) return null;

  try {
    const testimonyRef = doc(db, 'testimonies', testimonyId);
    const testimonySnap = await getDoc(testimonyRef);

    if (!testimonySnap.exists()) return null;

    return { id: testimonySnap.id, ...testimonySnap.data() } as Testimony;
  } catch (err) {
    console.error('[Prayers] Error fetching testimony:', err);
    return null;
  }
};

// ============================================================================
// Bulk Operations
// ============================================================================

/**
 * Delete all prayer history for a user.
 * Properly handles batch operations with new batch creation after commits.
 */
export const deletePrayerHistory = async (userId: string): Promise<void> => {
  if (!firebaseEnabled || !db) {
    throw new Error('Firebase not enabled');
  }

  try {
    // Query all prayers by this user
    const prayersQuery = query(
      collection(db, 'prayers'),
      where('actorUid', '==', userId)
    );

    const prayersSnapshot = await getDocs(prayersQuery);

    if (!prayersSnapshot.empty) {
      await batchDeleteDocuments(prayersSnapshot.docs);
    }

    // Also clear the userPrayedFor subcollection
    const peopleQuery = collection(db, 'userPrayedFor', userId, 'people');
    const peopleSnapshot = await getDocs(peopleQuery);

    if (!peopleSnapshot.empty) {
      await batchDeleteDocuments(peopleSnapshot.docs);
    }

    console.log('[Prayers] Deleted prayer history for user:', userId);
  } catch (err) {
    console.error('[Prayers] Error deleting prayer history:', err);
    throw err;
  }
};

// ============================================================================
// Admin Functions
// ============================================================================

/**
 * Pin a prayer request to the top of the feed (admin only).
 */
export const pinRequest = async (
  requestId: string,
  adminUid: string,
  adminEmail?: string | null
): Promise<ServiceResult> => {
  if (!firebaseEnabled || !db) {
    return { success: false, error: 'Firebase not enabled' };
  }

  if (!hasAdminPermission(adminEmail, adminUid)) {
    return { success: false, error: 'Only admins can pin requests' };
  }

  try {
    const requestRef = doc(db, 'requests', requestId);
    await updateDoc(requestRef, {
      isPinned: true,
      pinnedAt: serverTimestamp(),
      pinnedBy: adminUid,
    });

    console.log('[Prayers] Request pinned:', requestId);
    return { success: true };
  } catch (err: unknown) {
    console.error('[Prayers] Error pinning request:', err);
    const errorMessage = err instanceof Error ? err.message : 'Failed to pin request';
    return { success: false, error: errorMessage };
  }
};

/**
 * Unpin a prayer request (admin only).
 */
export const unpinRequest = async (
  requestId: string,
  adminUid: string,
  adminEmail?: string | null
): Promise<ServiceResult> => {
  if (!firebaseEnabled || !db) {
    return { success: false, error: 'Firebase not enabled' };
  }

  if (!hasAdminPermission(adminEmail, adminUid)) {
    return { success: false, error: 'Only admins can unpin requests' };
  }

  try {
    const requestRef = doc(db, 'requests', requestId);
    await updateDoc(requestRef, {
      isPinned: false,
      pinnedAt: null,
      pinnedBy: null,
    });

    console.log('[Prayers] Request unpinned:', requestId);
    return { success: true };
  } catch (err: unknown) {
    console.error('[Prayers] Error unpinning request:', err);
    const errorMessage = err instanceof Error ? err.message : 'Failed to unpin request';
    return { success: false, error: errorMessage };
  }
};
