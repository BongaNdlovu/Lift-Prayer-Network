/**
 * Announcements Service
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
  where,
} from 'firebase/firestore';
import { db, firebaseEnabled } from './firebase';

export interface Announcement {
  id: string;
  title: string;
  content: string;
  authorUid: string;
  authorName: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  isActive: boolean;
  priority: 'normal' | 'important' | 'urgent';
  expiresAt?: Timestamp;
}

export type AnnouncementInput = {
  title: string;
  content: string;
  priority?: 'normal' | 'important' | 'urgent';
  expiresAt?: Date;
};

/**
 * Create a new announcement (admin only)
 */
export const createAnnouncement = async (
  authorUid: string,
  authorName: string,
  input: AnnouncementInput
): Promise<{ success: boolean; id?: string; error?: string }> => {
  if (!firebaseEnabled || !db) {
    return { success: false, error: 'Service unavailable' };
  }

  try {
    const docRef = await addDoc(collection(db, 'announcements'), {
      title: input.title.trim(),
      content: input.content.trim(),
      authorUid,
      authorName,
      createdAt: serverTimestamp(),
      isActive: true,
      priority: input.priority || 'normal',
      expiresAt: input.expiresAt ? Timestamp.fromDate(input.expiresAt) : null,
    });
    
    // Note: Push notifications are sent via Cloud Function (onAnnouncementCreated)
    // which broadcasts to all users with push tokens enabled
    
    return { success: true, id: docRef.id };
  } catch (err) {
    console.error('Error creating announcement:', err);
    return { success: false, error: 'Could not create announcement' };
  }
};

/**
 * Update an announcement (admin only)
 */
export const updateAnnouncement = async (
  announcementId: string,
  updates: Partial<AnnouncementInput> & { isActive?: boolean }
): Promise<{ success: boolean; error?: string }> => {
  if (!firebaseEnabled || !db) {
    return { success: false, error: 'Service unavailable' };
  }

  try {
    const docRef = doc(db, 'announcements', announcementId);
    const updateData: any = {
      updatedAt: serverTimestamp(),
    };
    
    if (updates.title !== undefined) updateData.title = updates.title.trim();
    if (updates.content !== undefined) updateData.content = updates.content.trim();
    if (updates.priority !== undefined) updateData.priority = updates.priority;
    if (updates.isActive !== undefined) updateData.isActive = updates.isActive;
    if (updates.expiresAt !== undefined) {
      updateData.expiresAt = updates.expiresAt ? Timestamp.fromDate(updates.expiresAt) : null;
    }

    await updateDoc(docRef, updateData);
    return { success: true };
  } catch (err) {
    console.error('Error updating announcement:', err);
    return { success: false, error: 'Could not update announcement' };
  }
};

/**
 * Delete an announcement (admin only)
 */
export const deleteAnnouncement = async (
  announcementId: string
): Promise<{ success: boolean; error?: string }> => {
  if (!firebaseEnabled || !db) {
    return { success: false, error: 'Service unavailable' };
  }

  try {
    await deleteDoc(doc(db, 'announcements', announcementId));
    return { success: true };
  } catch (err) {
    console.error('Error deleting announcement:', err);
    return { success: false, error: 'Could not delete announcement' };
  }
};

/**
 * Subscribe to active announcements (for all users)
 */
export const subscribeToAnnouncements = (
  callback: (announcements: Announcement[]) => void,
  limitCount: number = 10
): (() => void) => {
  if (!firebaseEnabled || !db) {
    callback([]);
    return () => {};
  }

  const q = query(
    collection(db, 'announcements'),
    where('isActive', '==', true),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const announcements: Announcement[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Announcement[];
      
      // Filter out expired announcements
      const now = new Date();
      const activeAnnouncements = announcements.filter((a) => {
        if (!a.expiresAt) return true;
        return a.expiresAt.toDate() > now;
      });
      
      callback(activeAnnouncements);
    },
    (error) => {
      console.error('Error subscribing to announcements:', error);
      callback([]);
    }
  );
};

/**
 * Subscribe to all announcements (for admin management)
 */
export const subscribeToAllAnnouncements = (
  callback: (announcements: Announcement[]) => void
): (() => void) => {
  if (!firebaseEnabled || !db) {
    callback([]);
    return () => {};
  }

  const q = query(
    collection(db, 'announcements'),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const announcements: Announcement[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Announcement[];
      callback(announcements);
    },
    (error) => {
      console.error('Error subscribing to all announcements:', error);
      callback([]);
    }
  );
};
