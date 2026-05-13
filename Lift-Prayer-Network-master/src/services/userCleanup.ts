import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, firebaseEnabled } from './firebase';
import { deletePrayerHistory } from './prayers';
import { deleteProfilePhoto } from './profilePhotos';

const BATCH_SIZE = 300;

const deleteQueryBatch = async (collectionPath: string, field: string, userId: string): Promise<void> => {
  if (!firebaseEnabled || !db) return;

  const colRef = collection(db!, collectionPath);
  const q = query(colRef, where(field, '==', userId));
  const snapshot = await getDocs(q);

  if (snapshot.empty) return;

  let batch = writeBatch(db!);
  let count = 0;

  snapshot.docs.forEach((docSnap) => {
    batch.delete(docSnap.ref);
    count += 1;

    if (count >= BATCH_SIZE) {
      batch.commit();
      batch = writeBatch(db!);
      count = 0;
    }
  });

  if (count > 0) {
    await batch.commit();
  }
};

const anonymizeUserContent = async (userId: string): Promise<void> => {
  if (!firebaseEnabled || !db) return;

  const applyAnonymization = async (collectionPath: string) => {
    const colRef = collection(db!, collectionPath);
    const q = query(colRef, where('ownerUid', '==', userId));
    const snapshot = await getDocs(q);

    if (snapshot.empty) return;

    let batch = writeBatch(db!);
    let count = 0;

    snapshot.docs.forEach((docSnap) => {
      batch.update(docSnap.ref, {
        ownerUid: 'deleted_user',
        userDisplayName: 'Deleted User',
        userEmail: null,
        userPhotoURL: null,
      });
      count += 1;

      if (count >= BATCH_SIZE) {
        batch.commit();
        batch = writeBatch(db!);
        count = 0;
      }
    });

    if (count > 0) {
      await batch.commit();
    }
  };

  await applyAnonymization('requests');
  await applyAnonymization('testimonies');
};

const deleteUserPushTokens = async (userId: string): Promise<void> => {
  if (!firebaseEnabled || !db) return;

  const tokensRef = collection(db!, 'users', userId, 'pushTokens');
  const snapshot = await getDocs(tokensRef);
  if (snapshot.empty) return;

  let batch = writeBatch(db!);
  let count = 0;

  snapshot.docs.forEach((docSnap) => {
    batch.delete(docSnap.ref);
    count += 1;

    if (count >= BATCH_SIZE) {
      batch.commit();
      batch = writeBatch(db!);
      count = 0;
    }
  });

  if (count > 0) {
    await batch.commit();
  }
};

const deleteUserProfile = async (userId: string): Promise<void> => {
  if (!firebaseEnabled || !db) return;
  await deleteDoc(doc(db!, 'users', userId));
};

export const cleanupUserData = async (userId: string): Promise<void> => {
  if (!firebaseEnabled || !db) return;

  await deleteProfilePhoto(userId);

  // Delete prayer history and related aggregates
  await deletePrayerHistory(userId);

  // Delete comments authored by the user
  await deleteQueryBatch('comments', 'authorUid', userId);

  // Delete reports filed by the user
  await deleteQueryBatch('reports', 'actorUid', userId);

  // Anonymize requests and testimonies
  await anonymizeUserContent(userId);

  // Delete push tokens and profile document
  await deleteUserPushTokens(userId);
  await deleteUserProfile(userId);
};
