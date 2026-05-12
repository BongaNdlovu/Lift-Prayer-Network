import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db, firebaseEnabled } from './firebase';
import { validateContent } from '../utils/security';
import type { PrayerRequestUpdate, PrayerRequestUpdateType, RequestVisibility } from '../types';

export type MarkAnsweredArgs = {
  requestId: string;
  ownerUid: string;
  reflection?: string;
  visibility: RequestVisibility;
  shareAsTestimony: boolean;
  userDisplayName: string;
  userEmail?: string | null;
  userPhotoURL?: string | null;
  isAnonymous?: boolean;
};

export const addPrayerRequestUpdate = async (
  requestId: string,
  ownerUid: string,
  text: string,
  updateType: PrayerRequestUpdateType = 'CONTINUE_PRAYING',
): Promise<string | null> => {
  if (!firebaseEnabled || !db) return null;

  const validation = validateContent(text, {
    minLength: 3,
    maxLength: 700,
    checkProfanity: true,
    checkSuspicious: true,
    checkMoneySolicitation: true,
    contentType: 'REQUEST',
  });

  if (!validation.isValid) {
    throw new Error(validation.error || 'Please revise this update.');
  }

  const sanitized = validation.sanitized || text.trim();
  const updateRef = await addDoc(collection(db, 'prayerRequestUpdates'), {
    requestId,
    ownerUid,
    text: sanitized,
    updateType,
    createdAt: serverTimestamp(),
  });

  await updateDoc(doc(db, 'requests', requestId), {
    updatedAt: serverTimestamp(),
  });

  return updateRef.id;
};

export const getPrayerRequestUpdates = async (
  requestId: string,
): Promise<PrayerRequestUpdate[]> => {
  if (!firebaseEnabled || !db) return [];

  const q = query(
    collection(db, 'prayerRequestUpdates'),
    where('requestId', '==', requestId),
    orderBy('createdAt', 'asc'),
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  })) as PrayerRequestUpdate[];
};

export const markPrayerRequestAnswered = async (args: MarkAnsweredArgs): Promise<string | null> => {
  if (!firebaseEnabled || !db) return null;

  const trimmedReflection = args.reflection?.trim() || '';
  if (trimmedReflection) {
    const validation = validateContent(trimmedReflection, {
      minLength: 3,
      maxLength: 1500,
      checkProfanity: true,
      checkSuspicious: true,
      checkMoneySolicitation: true,
      contentType: 'TESTIMONY',
    });

    if (!validation.isValid) {
      throw new Error(validation.error || 'Please revise your answered prayer reflection.');
    }
  }

  const requestRef = doc(db, 'requests', args.requestId);
  const testimonyRef = args.shareAsTestimony ? doc(collection(db, 'testimonies')) : null;
  const updateRef = doc(collection(db, 'prayerRequestUpdates'));
  let testimonyId: string | null = testimonyRef?.id || null;

  await runTransaction(db, async (txn) => {
    const requestSnap = await txn.get(requestRef);
    if (!requestSnap.exists()) {
      throw new Error('Prayer request not found');
    }

    const requestData = requestSnap.data();
    if (requestData.ownerUid !== args.ownerUid) {
      throw new Error('Only the request owner can mark this prayer answered');
    }

    if (testimonyRef && trimmedReflection) {
      txn.set(testimonyRef, {
        ownerUid: args.ownerUid,
        userDisplayName: args.isAnonymous ? 'Anonymous' : args.userDisplayName,
        userEmail: args.isAnonymous ? null : args.userEmail || null,
        userPhotoURL: args.isAnonymous ? null : args.userPhotoURL || null,
        isAnonymous: !!args.isAnonymous,
        content: trimmedReflection,
        severity: 'RESOLVED',
        status: 'RESOLVED',
        likes: 0,
        linkedRequestId: args.requestId,
        linkedRequestCategory: requestData.category || null,
        visibility: args.visibility,
        isPrivate: args.visibility === 'PRIVATE',
        groupIds: args.visibility === 'GROUP' ? requestData.groupIds || [] : [],
        createdAt: serverTimestamp(),
        commentCount: 0,
      });
    } else {
      testimonyId = null;
    }

    txn.update(requestRef, {
      status: 'ANSWERED',
      severity: 'RESOLVED',
      answeredAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      answerReflection: trimmedReflection || null,
      answerVisibility: args.visibility,
      linkedTestimonyId: testimonyId,
    });

    txn.set(updateRef, {
      requestId: args.requestId,
      ownerUid: args.ownerUid,
      text: trimmedReflection || 'Marked this prayer request as answered.',
      updateType: 'ANSWERED',
      createdAt: serverTimestamp(),
    });
  });

  return testimonyId;
};
