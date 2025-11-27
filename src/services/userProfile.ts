import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db, firebaseEnabled } from './firebase';
import type { UserProfile } from '../types';

const defaultProfile = (user: User): UserProfile => ({
  displayName: user.displayName || 'Anonymous',
  email: user.email || undefined,
  photoURL: user.photoURL ?? null,
  createdAt: serverTimestamp(),
  lastActiveAt: serverTimestamp(),
  roles: ['user'],
  stats: { prayerCount: 0, testimonyCount: 0, streakDays: 0 },
  settings: { notifications: true, notificationsCritical: false, shareProfile: false },
});

export const ensureUserProfile = async (
  user: User,
  extra: Partial<UserProfile> = {},
) => {
  if (!firebaseEnabled || !db) return;
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, { ...defaultProfile(user), ...extra });
  } else if (Object.keys(extra).length > 0) {
    await updateDoc(ref, {
      ...extra,
      lastActiveAt: serverTimestamp(),
    });
  }
};

export const touchUserLastActive = async (user: User) => {
  if (!firebaseEnabled || !db) return;
  const ref = doc(db, 'users', user.uid);
  await updateDoc(ref, { lastActiveAt: serverTimestamp() });
};

export const updateUserSettings = async (user: User, settings: Partial<UserProfile['settings']>) => {
  if (!firebaseEnabled || !db) return;
  const ref = doc(db, 'users', user.uid);
  const flattened: Record<string, any> = {};
  Object.entries(settings || {}).forEach(([key, value]) => {
    flattened[`settings.${key}`] = value;
  });
  await updateDoc(ref, { ...flattened, lastActiveAt: serverTimestamp() });
};
