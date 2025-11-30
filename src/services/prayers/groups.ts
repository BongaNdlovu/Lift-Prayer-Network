import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Unsubscribe,
} from 'firebase/firestore';
import { db, firebaseEnabled } from '../firebase';
import type { LiftRequest } from '../../types';
import { ServiceResult } from './types';

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
