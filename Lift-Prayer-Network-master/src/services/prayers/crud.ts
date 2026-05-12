import {
  collection,
  doc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db, firebaseEnabled } from '../firebase';
import { canEditContent, canDeleteContent } from '../../config/admins';
import type { LiftRequest, Testimony } from '../../types';
import {
  ServiceResult,
  EditRequestData,
  EditTestimonyData,
  RequestEditUpdateData,
  TestimonyEditUpdateData,
} from './types';
import { withPermissionCheck, batchDeleteDocuments } from './helpers';
import { normalizePrivacyFields } from '../../utils/contentPrivacy';

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
      
      // Handle privacy fields using the normalized helper if any privacy field is being updated
      const hasPrivacyUpdate = updates.isPrivate !== undefined || updates.visibility !== undefined || updates.groupIds !== undefined;
      if (hasPrivacyUpdate) {
        const privacy = normalizePrivacyFields({
          visibility: updates.visibility || docData.visibility,
          isPrivate: updates.isPrivate !== undefined ? updates.isPrivate : docData.isPrivate,
          groupIds: updates.groupIds !== undefined ? updates.groupIds : docData.groupIds,
        });
        updateData.isPrivate = privacy.isPrivate;
        updateData.visibility = privacy.visibility;
        updateData.groupIds = privacy.groupIds;
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
