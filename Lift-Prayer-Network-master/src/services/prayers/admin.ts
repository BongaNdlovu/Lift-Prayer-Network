import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, firebaseEnabled } from '../firebase';
import { hasAdminPermission } from '../../config/admins';
import { ServiceResult } from './types';

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
