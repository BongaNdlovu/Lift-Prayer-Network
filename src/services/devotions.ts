/**
 * Devotions Service
 * Admin-only creation/editing, viewable by all users
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  getDoc,
  where,
} from 'firebase/firestore';
import { db, firebaseEnabled } from './firebase';

export interface Devotion {
  id: string;
  title: string;
  content: string;
  bibleVerse: string;
  bibleReference: string;
  reflection?: string;
  prayer?: string;
  authorUid: string;
  authorName: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  publishDate: Timestamp;
  isPublished: boolean;
  imageUrl?: string;
}

export type DevotionInput = {
  title: string;
  content: string;
  bibleVerse: string;
  bibleReference: string;
  reflection?: string;
  prayer?: string;
  publishDate?: Date;
  imageUrl?: string;
};

/**
 * Create a new devotion (admin only)
 */
export const createDevotion = async (
  authorUid: string,
  authorName: string,
  input: DevotionInput
): Promise<{ success: boolean; id?: string; error?: string }> => {
  if (!firebaseEnabled || !db) {
    return { success: false, error: 'Service unavailable' };
  }

  try {
    const docRef = await addDoc(collection(db, 'devotions'), {
      title: input.title.trim(),
      content: input.content.trim(),
      bibleVerse: input.bibleVerse.trim(),
      bibleReference: input.bibleReference.trim(),
      reflection: input.reflection?.trim() || null,
      prayer: input.prayer?.trim() || null,
      authorUid,
      authorName,
      createdAt: serverTimestamp(),
      publishDate: input.publishDate ? Timestamp.fromDate(input.publishDate) : serverTimestamp(),
      isPublished: true,
      imageUrl: input.imageUrl || null,
    });
    return { success: true, id: docRef.id };
  } catch (err) {
    console.error('Error creating devotion:', err);
    return { success: false, error: 'Could not create devotion' };
  }
};

/**
 * Update a devotion (admin only)
 */
export const updateDevotion = async (
  devotionId: string,
  updates: Partial<DevotionInput> & { isPublished?: boolean }
): Promise<{ success: boolean; error?: string }> => {
  if (!firebaseEnabled || !db) {
    return { success: false, error: 'Service unavailable' };
  }

  try {
    const docRef = doc(db, 'devotions', devotionId);
    const updateData: any = {
      updatedAt: serverTimestamp(),
    };
    
    if (updates.title !== undefined) updateData.title = updates.title.trim();
    if (updates.content !== undefined) updateData.content = updates.content.trim();
    if (updates.bibleVerse !== undefined) updateData.bibleVerse = updates.bibleVerse.trim();
    if (updates.bibleReference !== undefined) updateData.bibleReference = updates.bibleReference.trim();
    if (updates.reflection !== undefined) updateData.reflection = updates.reflection?.trim() || null;
    if (updates.prayer !== undefined) updateData.prayer = updates.prayer?.trim() || null;
    if (updates.isPublished !== undefined) updateData.isPublished = updates.isPublished;
    if (updates.publishDate !== undefined) {
      updateData.publishDate = Timestamp.fromDate(updates.publishDate);
    }
    if (updates.imageUrl !== undefined) updateData.imageUrl = updates.imageUrl || null;

    await updateDoc(docRef, updateData);
    return { success: true };
  } catch (err) {
    console.error('Error updating devotion:', err);
    return { success: false, error: 'Could not update devotion' };
  }
};

/**
 * Delete a devotion (admin only)
 */
export const deleteDevotion = async (
  devotionId: string
): Promise<{ success: boolean; error?: string }> => {
  if (!firebaseEnabled || !db) {
    return { success: false, error: 'Service unavailable' };
  }

  try {
    await deleteDoc(doc(db, 'devotions', devotionId));
    return { success: true };
  } catch (err) {
    console.error('Error deleting devotion:', err);
    return { success: false, error: 'Could not delete devotion' };
  }
};

/**
 * Get a single devotion by ID
 */
export const getDevotion = async (
  devotionId: string
): Promise<Devotion | null> => {
  if (!firebaseEnabled || !db) {
    return null;
  }

  try {
    const docRef = doc(db, 'devotions', devotionId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as Devotion;
    }
    return null;
  } catch (err) {
    console.error('Error getting devotion:', err);
    return null;
  }
};

/**
 * Subscribe to published devotions (for all users)
 */
export const subscribeToDevotions = (
  callback: (devotions: Devotion[]) => void,
  limitCount: number = 30
): (() => void) => {
  if (!firebaseEnabled || !db) {
    callback([]);
    return () => {};
  }

  const q = query(
    collection(db, 'devotions'),
    where('isPublished', '==', true),
    orderBy('publishDate', 'desc'),
    limit(limitCount)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const devotions: Devotion[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Devotion[];
      callback(devotions);
    },
    (error) => {
      console.error('Error subscribing to devotions:', error);
      callback([]);
    }
  );
};

/**
 * Subscribe to all devotions (for admin management)
 */
export const subscribeToAllDevotions = (
  callback: (devotions: Devotion[]) => void
): (() => void) => {
  if (!firebaseEnabled || !db) {
    callback([]);
    return () => {};
  }

  const q = query(
    collection(db, 'devotions'),
    orderBy('publishDate', 'desc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const devotions: Devotion[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Devotion[];
      callback(devotions);
    },
    (error) => {
      console.error('Error subscribing to all devotions:', error);
      callback([]);
    }
  );
};

/**
 * Get today's devotion (most recent published devotion)
 */
export const getTodaysDevotion = async (): Promise<Devotion | null> => {
  if (!firebaseEnabled || !db) {
    return null;
  }

  try {
    const q = query(
      collection(db, 'devotions'),
      where('isPublished', '==', true),
      orderBy('publishDate', 'desc'),
      limit(1)
    );
    
    const snapshot = await import('firebase/firestore').then(m => m.getDocs(q));
    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      return { id: doc.id, ...doc.data() } as Devotion;
    }
    return null;
  } catch (err) {
    console.error('Error getting today\'s devotion:', err);
    return null;
  }
};
