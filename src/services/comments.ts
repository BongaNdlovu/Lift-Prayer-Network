import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  updateDoc,
  increment,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db, firebaseEnabled } from './firebase';
import type { Comment } from '../types';

export const addComment = async (
  parentId: string,
  parentType: 'REQUEST' | 'TESTIMONY',
  authorUid: string,
  authorName: string,
  content: string
): Promise<string | null> => {
  if (!firebaseEnabled || !db) return null;

  try {
    const commentRef = await addDoc(collection(db, 'comments'), {
      parentId,
      parentType,
      authorUid,
      authorName,
      content,
      createdAt: serverTimestamp(),
    });

    // Increment comment count on parent
    const parentCollection = parentType === 'REQUEST' ? 'requests' : 'testimonies';
    const parentRef = doc(db, parentCollection, parentId);
    await updateDoc(parentRef, {
      commentCount: increment(1),
    });

    return commentRef.id;
  } catch (err) {
    console.warn('Error adding comment:', err);
    return null;
  }
};

export const getComments = async (
  parentId: string,
  parentType: 'REQUEST' | 'TESTIMONY',
  maxResults: number = 50
): Promise<Comment[]> => {
  if (!firebaseEnabled || !db) return [];

  try {
    const q = query(
      collection(db, 'comments'),
      where('parentId', '==', parentId),
      where('parentType', '==', parentType),
      orderBy('createdAt', 'asc'),
      limit(maxResults)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as Comment[];
  } catch (err) {
    console.warn('Error fetching comments:', err);
    return [];
  }
};

export const subscribeToComments = (
  parentId: string,
  parentType: 'REQUEST' | 'TESTIMONY',
  callback: (comments: Comment[]) => void
): Unsubscribe => {
  if (!firebaseEnabled || !db) {
    callback([]);
    return () => {};
  }

  const q = query(
    collection(db, 'comments'),
    where('parentId', '==', parentId),
    where('parentType', '==', parentType),
    orderBy('createdAt', 'asc'),
    limit(100)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const comments = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as Comment[];
      callback(comments);
    },
    (error) => {
      console.warn('Error in comments subscription:', error);
      callback([]);
    }
  );
};

export const deleteComment = async (
  commentId: string,
  parentId: string,
  parentType: 'REQUEST' | 'TESTIMONY'
): Promise<boolean> => {
  if (!firebaseEnabled || !db) return false;

  try {
    await deleteDoc(doc(db, 'comments', commentId));

    // Decrement comment count on parent
    const parentCollection = parentType === 'REQUEST' ? 'requests' : 'testimonies';
    const parentRef = doc(db, parentCollection, parentId);
    await updateDoc(parentRef, {
      commentCount: increment(-1),
    });

    return true;
  } catch (err) {
    console.warn('Error deleting comment:', err);
    return false;
  }
};

export const updateComment = async (
  commentId: string,
  newContent: string
): Promise<boolean> => {
  if (!firebaseEnabled || !db) return false;

  try {
    const commentRef = doc(db, 'comments', commentId);
    await updateDoc(commentRef, {
      content: newContent,
      editedAt: serverTimestamp(),
    });
    return true;
  } catch (err) {
    console.warn('Error updating comment:', err);
    return false;
  }
};

