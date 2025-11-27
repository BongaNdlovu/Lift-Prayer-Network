import {
  addDoc,
  collection,
  doc,
  increment,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db, firebaseEnabled } from './firebase';

export const logPrayer = async (
  actorUid: string,
  targetRequestId: string,
  targetOwnerUid: string,
  targetSummary: string,
) => {
  if (!firebaseEnabled || !db) return;
  await addDoc(collection(db, 'prayers'), {
    actorUid,
    targetRequestId,
    targetOwnerUid,
    targetSummary,
    prayedAt: serverTimestamp(),
    status: 'PRAYED',
  });
  await updateDoc(doc(db, 'requests', targetRequestId), {
    prayers: increment(1),
  });
  await setDoc(
    doc(db, 'userPrayedFor', actorUid, 'people', targetOwnerUid || 'anon'),
    { count: increment(1), targetOwnerUid: targetOwnerUid || 'anon', lastPrayedAt: serverTimestamp() },
    { merge: true },
  );
  await updateDoc(doc(db, 'users', actorUid), {
    'stats.prayerCount': increment(1),
  });
};
