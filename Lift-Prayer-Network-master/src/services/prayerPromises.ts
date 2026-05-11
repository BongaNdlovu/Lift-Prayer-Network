import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  startAfter,
  updateDoc,
  where,
  type QueryDocumentSnapshot,
  type DocumentData,
} from 'firebase/firestore';
import { db, firebaseEnabled } from './firebase';
import { TODAY_PROMISE_LIMIT } from '../config/queryLimits';
import { logFirestoreRead } from '../utils/readBudget';
import type { PrayerCategory, PrayerPromise } from '../types';

export type ReminderFrequency = PrayerPromise['reminderFrequency'];

export type CreateOrUpdatePrayerPromiseArgs = {
  userId: string;
  requestId: string;
  requestOwnerUid: string;
  requestSummary: string;
  requestCategory?: PrayerCategory;
  requestIsUrgent?: boolean;
  reminderFrequency?: ReminderFrequency;
  nextReminderAt?: Date | Timestamp | null;
};

const getPromiseId = (userId: string, requestId: string) => `${userId}_${requestId}`;

const toTimestampOrNull = (value?: Date | Timestamp | null) => {
  if (!value) return null;
  if (value instanceof Timestamp) return value;
  return Timestamp.fromDate(value);
};

export const createOrUpdatePrayerPromise = async (args: CreateOrUpdatePrayerPromiseArgs): Promise<PrayerPromise | null> => {
  if (!firebaseEnabled || !db) return null;
  if (!args.userId || !args.requestId) throw new Error('Missing user or request id');

  const promiseId = getPromiseId(args.userId, args.requestId);
  const promiseRef = doc(db, 'prayerPromises', promiseId);
  const requestRef = doc(db, 'requests', args.requestId);
  const nextReminderAt = toTimestampOrNull(args.nextReminderAt);

  await runTransaction(db, async (txn) => {
    const promiseSnap = await txn.get(promiseRef);
    const exists = promiseSnap.exists();

    const baseData = {
      id: promiseId,
      userId: args.userId,
      requestId: args.requestId,
      requestOwnerUid: args.requestOwnerUid,
      requestSummary: args.requestSummary,
      requestCategory: args.requestCategory || null,
      requestIsUrgent: !!args.requestIsUrgent,
      reminderFrequency: args.reminderFrequency || 'none',
      status: 'ACTIVE',
      updatedAt: serverTimestamp(),
      ...(nextReminderAt ? { nextReminderAt } : {}),
    };

    if (exists) {
      txn.set(promiseRef, baseData, { merge: true });
    } else {
      txn.set(promiseRef, {
        ...baseData,
        createdAt: serverTimestamp(),
        prayedCount: 0,
      });
      txn.update(requestRef, { prayers: increment(1) });
    }
  });

  const snap = await getDoc(promiseRef);
  logFirestoreRead('prayerPromises.createOrUpdatePrayerPromise', snap.exists() ? 1 : 0);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as PrayerPromise;
};

export const getTodayPrayerPromises = async (userId: string): Promise<PrayerPromise[]> => {
  if (!firebaseEnabled || !db || !userId) return [];

  const q = query(
    collection(db, 'prayerPromises'),
    where('userId', '==', userId),
    where('status', 'in', ['ACTIVE', 'PRAYED_TODAY']),
    orderBy('nextReminderAt', 'asc'),
    limit(TODAY_PROMISE_LIMIT)
  );

  const snapshot = await getDocs(q);
  logFirestoreRead('prayerPromises.getTodayPrayerPromises', snapshot.size);
  return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as PrayerPromise);
};

export const getPrayerPromisesPage = async (
  userId: string,
  pageSize: number,
  cursor?: QueryDocumentSnapshot<DocumentData>
): Promise<{ items: PrayerPromise[]; cursor?: QueryDocumentSnapshot<DocumentData>; hasMore: boolean }> => {
  if (!firebaseEnabled || !db || !userId) return { items: [], hasMore: false };

  const constraints = [
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(pageSize),
  ];

  const q = cursor
    ? query(collection(db, 'prayerPromises'), ...constraints, startAfter(cursor))
    : query(collection(db, 'prayerPromises'), ...constraints);

  const snapshot = await getDocs(q);
  logFirestoreRead('prayerPromises.getPrayerPromisesPage', snapshot.size);

  return {
    items: snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as PrayerPromise),
    cursor: snapshot.docs[snapshot.docs.length - 1],
    hasMore: snapshot.size === pageSize,
  };
};

export const markPromisePrayed = async (promiseId: string, userId: string): Promise<void> => {
  if (!firebaseEnabled || !db) return;
  const ref = doc(db, 'prayerPromises', promiseId);
  const snap = await getDoc(ref);
  logFirestoreRead('prayerPromises.markPromisePrayed', snap.exists() ? 1 : 0);
  if (!snap.exists() || snap.data().userId !== userId) throw new Error('Prayer promise not found');

  await updateDoc(ref, {
    status: 'PRAYED_TODAY',
    lastPrayedAt: serverTimestamp(),
    prayedCount: increment(1),
    updatedAt: serverTimestamp(),
  });
};

export const markPromiseAnswered = async (promiseId: string, userId: string): Promise<void> => {
  if (!firebaseEnabled || !db) return;
  const ref = doc(db, 'prayerPromises', promiseId);
  const snap = await getDoc(ref);
  logFirestoreRead('prayerPromises.markPromiseAnswered', snap.exists() ? 1 : 0);
  if (!snap.exists() || snap.data().userId !== userId) throw new Error('Prayer promise not found');

  await updateDoc(ref, {
    status: 'ANSWERED',
    updatedAt: serverTimestamp(),
  });
};

export const archivePrayerPromise = async (promiseId: string, userId: string): Promise<void> => {
  if (!firebaseEnabled || !db) return;
  const ref = doc(db, 'prayerPromises', promiseId);
  const snap = await getDoc(ref);
  logFirestoreRead('prayerPromises.archivePrayerPromise', snap.exists() ? 1 : 0);
  if (!snap.exists() || snap.data().userId !== userId) throw new Error('Prayer promise not found');

  await updateDoc(ref, {
    status: 'ARCHIVED',
    updatedAt: serverTimestamp(),
  });
};
