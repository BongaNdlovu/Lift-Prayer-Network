import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  onSnapshot,
  Unsubscribe,
  documentId,
} from 'firebase/firestore';
import { db, firebaseEnabled } from './firebase';
import type { PrayerGroup } from '../types';
import { checkAndUnlockAchievements } from './achievements';

type GroupMember = {
  uid: string;
  displayName: string;
  email?: string;
  photoURL?: string | null;
};

export const createGroup = async (
  name: string,
  ownerUid: string,
  description?: string,
  emoji?: string,
  isPrivate: boolean = true
): Promise<string | null> => {
  if (!firebaseEnabled || !db) {
    console.warn('[Groups] Firebase not enabled');
    return null;
  }

  try {
    console.log('[Groups] Creating group:', name, 'for user:', ownerUid);
    
    const groupRef = await addDoc(collection(db, 'groups'), {
      name,
      description: description || '',
      emoji: emoji || '🙏',
      ownerUid,
      memberUids: [ownerUid],
      isPrivate,
      createdAt: serverTimestamp(),
    });

    console.log('[Groups] Group created with ID:', groupRef.id);

    // Add group to user's groupIds
    try {
      const userRef = doc(db, 'users', ownerUid);
      await updateDoc(userRef, {
        groupIds: arrayUnion(groupRef.id),
      });
      await checkAndUnlockAchievements(ownerUid, { hasGroup: true });
      console.log('[Groups] Added group to user profile');
    } catch (userErr) {
      // User profile might not exist yet, that's okay
      console.warn('[Groups] Could not update user groupIds:', userErr);
    }

    return groupRef.id;
  } catch (err: any) {
    console.error('[Groups] Error creating group:', err.code, err.message);
    throw err; // Re-throw to let the UI handle it
  }
};

export const getUserGroups = async (userId: string): Promise<PrayerGroup[]> => {
  if (!firebaseEnabled || !db) return [];

  try {
    const q = query(
      collection(db, 'groups'),
      where('memberUids', 'array-contains', userId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as PrayerGroup[];
  } catch (err) {
    console.warn('Error fetching groups:', err);
    return [];
  }
};

export const subscribeToUserGroups = (
  userId: string,
  callback: (groups: PrayerGroup[]) => void
): Unsubscribe => {
  if (!firebaseEnabled || !db) {
    console.warn('[Groups] Firebase not enabled, returning empty groups');
    callback([]);
    return () => {};
  }

  console.log('[Groups] Subscribing to groups for user:', userId);

  const q = query(
    collection(db, 'groups'),
    where('memberUids', 'array-contains', userId),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const groups = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as PrayerGroup[];
      console.log('[Groups] Received', groups.length, 'groups');
      callback(groups);
    },
    (error) => {
      console.error('[Groups] Subscription error:', error.code, error.message);
      // If index is missing, return empty and log helpful message
      if (error.code === 'failed-precondition') {
        console.error('[Groups] Missing Firestore index. Please create a composite index for groups collection: memberUids (array-contains) + createdAt (desc)');
      }
      callback([]);
    }
  );
};

export const getGroup = async (groupId: string): Promise<PrayerGroup | null> => {
  if (!firebaseEnabled || !db) return null;

  try {
    const docSnap = await getDoc(doc(db, 'groups', groupId));
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() } as PrayerGroup;
  } catch (err) {
    console.warn('Error fetching group:', err);
    return null;
  }
};

export const joinGroup = async (groupId: string, userId: string): Promise<boolean> => {
  if (!firebaseEnabled || !db) return false;

  try {
    const groupRef = doc(db, 'groups', groupId);
    await updateDoc(groupRef, {
      memberUids: arrayUnion(userId),
    });

    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      groupIds: arrayUnion(groupId),
    });

    return true;
  } catch (err) {
    console.warn('Error joining group:', err);
    return false;
  }
};

export const leaveGroup = async (groupId: string, userId: string): Promise<boolean> => {
  if (!firebaseEnabled || !db) return false;

  try {
    const groupRef = doc(db, 'groups', groupId);
    await updateDoc(groupRef, {
      memberUids: arrayRemove(userId),
    });

    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      groupIds: arrayRemove(groupId),
    });

    return true;
  } catch (err) {
    console.warn('Error leaving group:', err);
    return false;
  }
};

export const deleteGroup = async (groupId: string, ownerUid: string): Promise<boolean> => {
  if (!firebaseEnabled || !db) return false;

  try {
    const group = await getGroup(groupId);
    if (!group || group.ownerUid !== ownerUid) return false;

    // Remove group from all members
    for (const memberId of group.memberUids) {
      const userRef = doc(db, 'users', memberId);
      await updateDoc(userRef, {
        groupIds: arrayRemove(groupId),
      });
    }

    await deleteDoc(doc(db, 'groups', groupId));
    return true;
  } catch (err) {
    console.warn('Error deleting group:', err);
    return false;
  }
};

export const updateGroup = async (
  groupId: string,
  updates: Partial<Pick<PrayerGroup, 'name' | 'description' | 'emoji' | 'isPrivate' | 'photoURL'>>
): Promise<boolean> => {
  if (!firebaseEnabled || !db) return false;

  try {
    const groupRef = doc(db, 'groups', groupId);
    await updateDoc(groupRef, updates);
    return true;
  } catch (err) {
    console.warn('Error updating group:', err);
    return false;
  }
};

// Generate a simple invite code from group ID
export const getInviteCode = (groupId: string): string => {
  return groupId.slice(0, 8).toUpperCase();
};

// Find group by invite code
export const findGroupByInviteCode = async (code: string): Promise<PrayerGroup | null> => {
  if (!firebaseEnabled || !db) return null;

  try {
    const q = query(collection(db, 'groups'));
    const snapshot = await getDocs(q);
    
    for (const docSnap of snapshot.docs) {
      if (docSnap.id.slice(0, 8).toUpperCase() === code.toUpperCase()) {
        return { id: docSnap.id, ...docSnap.data() } as PrayerGroup;
      }
    }
    return null;
  } catch (err) {
    console.warn('Error finding group:', err);
    return null;
  }
};

// Get group members with their profiles
export const getGroupMembers = async (groupId: string): Promise<GroupMember[]> => {
  if (!firebaseEnabled || !db) return [];

  try {
    const group = await getGroup(groupId);
    if (!group) return [];

    const members: GroupMember[] = [];
    
    // Fetch each member's profile
    for (const uid of group.memberUids) {
      try {
        const userDoc = await getDoc(doc(db, 'users', uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          members.push({
            uid,
            displayName: userData.displayName || 'Anonymous',
            email: userData.email,
            photoURL: userData.photoURL,
          });
        } else {
          members.push({
            uid,
            displayName: 'Unknown User',
          });
        }
      } catch (err) {
        members.push({
          uid,
          displayName: 'Unknown User',
        });
      }
    }

    // Sort so owner is first
    return members.sort((a, b) => {
      if (a.uid === group.ownerUid) return -1;
      if (b.uid === group.ownerUid) return 1;
      return a.displayName.localeCompare(b.displayName);
    });
  } catch (err) {
    console.warn('Error fetching group members:', err);
    return [];
  }
};

