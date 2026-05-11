import {
  doc,
  getDoc,
  writeBatch,
  DocumentReference,
  DocumentData,
} from 'firebase/firestore';
import { db, firebaseEnabled } from '../firebase';
import { ServiceResult, BATCH_SIZE } from './types';

/**
 * Generic helper for permission-checked document operations.
 * Reduces boilerplate for edit/delete operations.
 */
export async function withPermissionCheck<T>(
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
export async function batchDeleteDocuments(
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
      // Create a NEW batch after commit
      batch = writeBatch(db);
      count = 0;
    }
  }

  // Commit remaining operations
  if (count > 0) {
    await batch.commit();
  }
}
