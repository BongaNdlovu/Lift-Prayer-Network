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
  Timestamp,
} from 'firebase/firestore';
import { db, firebaseEnabled } from './firebase';
import type { Comment } from '../types';
import { 
  validateContent, 
  checkDailyLimit, 
  checkActionRateLimit, 
  formatRateLimitError,
  sanitizeForFirestore
} from '../utils/security';

// Daily comment limit per user
const DAILY_COMMENT_LIMIT = 10;

/**
 * Check how many comments a user has made today
 */
const getUserDailyCommentCount = async (authorUid: string): Promise<number> => {
  if (!firebaseEnabled || !db) return 0;

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startTimestamp = Timestamp.fromDate(startOfDay);

  try {
    const q = query(
      collection(db, 'comments'),
      where('authorUid', '==', authorUid),
      where('createdAt', '>=', startTimestamp)
    );
    const snapshot = await getDocs(q);
    return snapshot.size;
  } catch (err) {
    console.warn('Error checking daily comment count:', err);
    return 0;
  }
};

export const addComment = async (
  parentId: string,
  parentType: 'REQUEST' | 'TESTIMONY',
  authorUid: string,
  authorName: string,
  content: string
): Promise<string | null> => {
  if (!firebaseEnabled || !db) return null;

  // Client-side rate limiting for comments (per-hour check)
  const rateLimit = checkActionRateLimit(authorUid, 'comments');
  if (!rateLimit.allowed) {
    throw new Error(formatRateLimitError('comments', rateLimit.resetInSeconds));
  }

  // Check daily limit (client-side)
  const dailyCheck = checkDailyLimit(`comments_${authorUid}`, DAILY_COMMENT_LIMIT);
  if (!dailyCheck.allowed) {
    throw new Error(`You've reached your daily limit of ${DAILY_COMMENT_LIMIT} comments. Please try again tomorrow.`);
  }

  // Also verify against Firestore (more accurate)
  const todayCount = await getUserDailyCommentCount(authorUid);
  if (todayCount >= DAILY_COMMENT_LIMIT) {
    throw new Error(`You've reached your daily limit of ${DAILY_COMMENT_LIMIT} comments. Please try again tomorrow.`);
  }

  const validation = validateContent(content, {
    minLength: 1,
    maxLength: 300,
    checkProfanity: true,
    checkSuspicious: true,
    checkMoneySolicitation: true,
    contentType: parentType,
  });

  if (!validation.isValid) {
    throw new Error(validation.error || 'Invalid comment content');
  }

  const sanitizedContent = validation.sanitized || content.trim();

  try {
    const sanitizedData = sanitizeForFirestore({
      parentId,
      parentType,
      authorUid,
      authorName,
      content: sanitizedContent,
      hiddenByOwner: false,
      createdAt: serverTimestamp(),
    });
    const commentRef = await addDoc(collection(db, 'comments'), sanitizedData);

    // Increment comment count on parent
    const parentCollection = parentType === 'REQUEST' ? 'requests' : 'testimonies';
    const parentRef = doc(db, parentCollection, parentId);
    await updateDoc(parentRef, {
      commentCount: increment(1),
    });

    return commentRef.id;
  } catch (err) {
    console.warn('Error adding comment:', err);
    throw err;
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
    return snapshot.docs
      .map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }))
      .filter((comment) => !(comment as Comment).hiddenByOwner) as Comment[];
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
      const comments = snapshot.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }))
        .filter((comment) => !(comment as Comment).hiddenByOwner) as Comment[];
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
  newContent: string,
  parentType: 'REQUEST' | 'TESTIMONY' = 'REQUEST'
): Promise<boolean> => {
  if (!firebaseEnabled || !db) return false;

  try {
    const validation = validateContent(newContent, {
      minLength: 1,
      maxLength: 300,
      checkProfanity: true,
      checkSuspicious: true,
      checkMoneySolicitation: true,
      contentType: parentType,
    });

    if (!validation.isValid) {
      throw new Error(validation.error || 'Invalid comment content');
    }

    const commentRef = doc(db, 'comments', commentId);
    await updateDoc(commentRef, {
      content: validation.sanitized || newContent.trim(),
      editedAt: serverTimestamp(),
    });
    return true;
  } catch (err) {
    console.warn('Error updating comment:', err);
    return false;
  }
};

export const hideCommentByOwner = async (commentId: string): Promise<boolean> => {
  if (!firebaseEnabled || !db) return false;

  try {
    await updateDoc(doc(db, 'comments', commentId), {
      hiddenByOwner: true,
      hiddenAt: serverTimestamp(),
    });
    return true;
  } catch (err) {
    console.warn('Error hiding comment:', err);
    return false;
  }
};
