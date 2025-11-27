import {
  Timestamp,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
  collection,
  addDoc,
} from 'firebase/firestore';
import { db, firebaseEnabled } from './firebase';

export const fetchRequestOrTestimony = async (type: 'REQUEST' | 'TESTIMONY', id: string) => {
  if (!firebaseEnabled || !db) return null;
  const ref = doc(db, type === 'REQUEST' ? 'requests' : 'testimonies', id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as any;
};

export const updateRequestContent = async (id: string, content: string) => {
  if (!firebaseEnabled || !db) return;
  const ref = doc(db, 'requests', id);
  await updateDoc(ref, {
    content,
    updatedAt: serverTimestamp(),
  });
};

export const deleteRequest = async (id: string) => {
  if (!firebaseEnabled || !db) return;
  await deleteDoc(doc(db, 'requests', id));
};

export const updateTestimonyContent = async (id: string, content: string) => {
  if (!firebaseEnabled || !db) return;
  const ref = doc(db, 'testimonies', id);
  await updateDoc(ref, {
    content,
    updatedAt: serverTimestamp(),
  });
};

export const deleteTestimony = async (id: string) => {
  if (!firebaseEnabled || !db) return;
  await deleteDoc(doc(db, 'testimonies', id));
};

export const flagContent = async (
  actorUid: string | undefined,
  targetId: string,
  targetType: 'REQUEST' | 'TESTIMONY',
  reason: string,
) => {
  if (!firebaseEnabled || !db) return;
  await addDoc(collection(db, 'reports'), {
    actorUid: actorUid || 'anonymous',
    targetId,
    targetType,
    reason,
    createdAt: Timestamp.now(),
  });
};
