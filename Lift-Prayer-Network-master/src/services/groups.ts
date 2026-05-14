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
  writeBatch,
  runTransaction,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, firebaseEnabled, storage } from './firebase';
import type { PrayerGroup } from '../types';
import { checkAndUnlockAchievements } from './achievements';
import { classifyError, type AppError } from '../types/errors';
import { checkActionRateLimit, formatRateLimitError } from '../utils/security';
import { NOTIFICATION_TYPES } from '../types/notifications';

export type GroupResult<T> = 
  | { success: true; data: T }
  | { success: false; error: AppError };

export type GroupMember = {
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

    // Store invite code for efficient lookup (first 8 chars of ID, uppercase)
    const inviteCode = groupRef.id.slice(0, 8).toUpperCase();
    await updateDoc(groupRef, { inviteCode });

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
  } catch (err) {
    const appError = classifyError(err, { defaultMessage: 'Could not create group. Please try again.' });
    console.error('[Groups] Error creating group:', appError.message);
    throw appError;
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
    const appError = classifyError(err);
    console.warn('[Groups] Error fetching groups:', appError.message);
    return [];
  }
};

/**
 * Get public groups that the user is NOT a member of (for discovery)
 */
export const getPublicGroups = async (userId: string, limitCount: number = 10): Promise<PrayerGroup[]> => {
  if (!firebaseEnabled || !db) return [];

  try {
    // Get public groups
    const q = query(
      collection(db, 'groups'),
      where('isPrivate', '==', false),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    
    // Filter out groups user is already a member of or has pending request
    const publicGroups = snapshot.docs
      .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as PrayerGroup))
      .filter((group) => 
        !group.memberUids.includes(userId) && 
        !group.pendingRequests?.includes(userId)
      )
      .slice(0, limitCount);
    
    return publicGroups;
  } catch (err) {
    const appError = classifyError(err);
    console.warn('[Groups] Error fetching public groups:', appError.message);
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
    const appError = classifyError(err);
    console.warn('[Groups] Error fetching group:', appError.message);
    return null;
  }
};

export type JoinGroupResult = 
  | { success: true; status: 'joined' }
  | { success: true; status: 'pending' }
  | { success: false; error: string };

/**
 * Join a group or request to join.
 * - Public groups: User is added directly to memberUids
 * - Private groups: User is added to pendingRequests for owner approval
 */
export const joinGroup = async (groupId: string, userId: string): Promise<JoinGroupResult> => {
  if (!firebaseEnabled || !db) {
    return { success: false, error: 'Firebase not enabled' };
  }

  // Rate limit group joins (5 per hour)
  const rateLimit = checkActionRateLimit(userId, 'groupJoins');
  if (!rateLimit.allowed) {
    return { success: false, error: formatRateLimitError('group join attempts', rateLimit.resetInSeconds) };
  }

  try {
    return await runTransaction(db, async (txn) => {
      const groupRef = doc(db!, 'groups', groupId);
      const userRef = doc(db!, 'users', userId);
      const groupSnap = await txn.get(groupRef);

      if (!groupSnap.exists()) {
        return { success: false, error: 'Group not found' } as JoinGroupResult;
      }

      const group = { id: groupSnap.id, ...groupSnap.data() } as PrayerGroup;
      if (group.memberUids.includes(userId)) {
        return { success: false, error: 'Already a member' } as JoinGroupResult;
      }

      if (group.isPrivate) {
        if (group.pendingRequests?.includes(userId)) {
          return { success: false, error: 'Join request already pending' } as JoinGroupResult;
        }

        txn.update(groupRef, {
          pendingRequests: arrayUnion(userId),
        });

        return { success: true, status: 'pending' } as JoinGroupResult;
      }

      txn.update(groupRef, {
        memberUids: arrayUnion(userId),
      });
      txn.set(
        userRef,
        {
          groupIds: arrayUnion(groupId),
        },
        { merge: true },
      );

      return { success: true, status: 'joined' } as JoinGroupResult;
    });
  } catch (err) {
    const appError = classifyError(err);
    console.warn('[Groups] Error joining group:', appError.message);
    return { success: false, error: appError.message };
  }
};

/**
 * Approve a pending join request (owner only)
 */
export const approveJoinRequest = async (
  groupId: string,
  userId: string,
  ownerUid: string
): Promise<boolean> => {
  if (!firebaseEnabled || !db) return false;

  try {
    const group = await getGroup(groupId);
    if (!group || group.ownerUid !== ownerUid) {
      console.warn('[Groups] Not authorized to approve requests');
      return false;
    }

    if (!group.pendingRequests?.includes(userId)) {
      console.warn('[Groups] User not in pending requests');
      return false;
    }

    const groupRef = doc(db, 'groups', groupId);
    await updateDoc(groupRef, {
      memberUids: arrayUnion(userId),
      pendingRequests: arrayRemove(userId),
    });

    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      groupIds: arrayUnion(groupId),
    });

    // Create notification for the user whose request was approved
    try {
      await addDoc(collection(db, 'notifications'), {
        type: NOTIFICATION_TYPES.GROUP_JOIN,
        recipientUid: userId,
        actorUid: ownerUid,
        groupId,
        groupName: group.name,
        groupEmoji: group.emoji || '🙏',
        createdAt: serverTimestamp(),
        read: false,
      });
    } catch (notifErr) {
      // Non-critical: log but don't fail the approval
      console.warn('[Groups] Could not create approval notification:', notifErr);
    }

    return true;
  } catch (err) {
    const appError = classifyError(err);
    console.warn('[Groups] Error approving join request:', appError.message);
    return false;
  }
};

/**
 * Reject a pending join request (owner only)
 */
export const rejectJoinRequest = async (
  groupId: string,
  userId: string,
  ownerUid: string
): Promise<boolean> => {
  if (!firebaseEnabled || !db) return false;

  try {
    const group = await getGroup(groupId);
    if (!group || group.ownerUid !== ownerUid) {
      console.warn('[Groups] Not authorized to reject requests');
      return false;
    }

    const groupRef = doc(db, 'groups', groupId);
    await updateDoc(groupRef, {
      pendingRequests: arrayRemove(userId),
    });

    return true;
  } catch (err) {
    const appError = classifyError(err);
    console.warn('[Groups] Error rejecting join request:', appError.message);
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
    const appError = classifyError(err);
    console.warn('[Groups] Error leaving group:', appError.message);
    return false;
  }
};

export const deleteGroup = async (groupId: string, ownerUid: string): Promise<boolean> => {
  if (!firebaseEnabled || !db) return false;

  try {
    const group = await getGroup(groupId);
    if (!group || group.ownerUid !== ownerUid) return false;

    // Resume in-progress deletion
    if ((group as any).deleting) {
      return finishGroupDeletion(group as any);
    }

    // Mark group as deleting before starting member cleanup
    const groupRef = doc(db, 'groups', groupId);
    await updateDoc(groupRef, {
      deleting: true,
      deleteStartedAt: serverTimestamp(),
      deleteOwnerUid: ownerUid,
    });

    return finishGroupDeletion({ ...group, deleting: true, deleteOwnerUid: ownerUid });
  } catch (err) {
    const appError = classifyError(err);
    console.warn('[Groups] Error deleting group:', appError.message);
    return false;
  }
};

const finishGroupDeletion = async (group: PrayerGroup & { deleting: true; deleteOwnerUid?: string; deleteError?: string }): Promise<boolean> => {
  if (!db) return false;

  const groupRef = doc(db, 'groups', group.id);

  try {
    // Batch remove group from all members (Firestore batch limit is 500)
    const FIRESTORE_BATCH_LIMIT = 500;
    for (let i = 0; i < group.memberUids.length; i += FIRESTORE_BATCH_LIMIT) {
      const batch = writeBatch(db);
      const chunk = group.memberUids.slice(i, i + FIRESTORE_BATCH_LIMIT);

      for (const memberId of chunk) {
        const userRef = doc(db, 'users', memberId);
        batch.update(userRef, {
          groupIds: arrayRemove(group.id),
        });
      }

      try {
        await batch.commit();
      } catch (batchErr) {
        // Record error and stop — can resume later
        await updateDoc(groupRef, { deleteError: (batchErr as Error)?.message || 'Batch commit failed' }).catch(() => {});
        return false;
      }
    }

    // All members cleaned up — delete group document
    await deleteDoc(groupRef);
    return true;
  } catch (err) {
    const appError = classifyError(err);
    console.warn('[Groups] Error during group deletion:', appError.message);
    await updateDoc(groupRef, { deleteError: appError.message }).catch(() => {});
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
    const appError = classifyError(err);
    console.warn('[Groups] Error updating group:', appError.message);
    return false;
  }
};

// Generate a simple invite code from group ID
export const getInviteCode = (groupId: string): string => {
  return groupId.slice(0, 8).toUpperCase();
};

// Find group by invite code
// Uses indexed inviteCode field for efficient lookup instead of fetching all groups
export const findGroupByInviteCode = async (code: string): Promise<PrayerGroup | null> => {
  if (!firebaseEnabled || !db) return null;

  try {
    const normalizedCode = code.toUpperCase();
    
    // First try efficient query using inviteCode field (for newer groups)
    const q = query(
      collection(db, 'groups'),
      where('inviteCode', '==', normalizedCode)
    );
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      const docSnap = snapshot.docs[0];
      return { id: docSnap.id, ...docSnap.data() } as PrayerGroup;
    }
    
    // Fallback: Try to find by document ID prefix (for legacy groups without inviteCode field)
    // This is less efficient but handles groups created before the inviteCode field was added
    const allGroupsQuery = query(collection(db, 'groups'));
    const allSnapshot = await getDocs(allGroupsQuery);
    
    for (const docSnap of allSnapshot.docs) {
      if (docSnap.id.slice(0, 8).toUpperCase() === normalizedCode) {
        // Migrate: add inviteCode field for future lookups
        try {
          await updateDoc(doc(db, 'groups', docSnap.id), { inviteCode: normalizedCode });
        } catch {
          // Ignore migration errors (user might not have permission)
        }
        return { id: docSnap.id, ...docSnap.data() } as PrayerGroup;
      }
    }
    
    return null;
  } catch (err) {
    const appError = classifyError(err);
    console.warn('[Groups] Error finding group:', appError.message);
    return null;
  }
};

export const uploadGroupPhoto = async (
  groupId: string,
  imageUri: string,
  currentUserUid: string,
): Promise<string> => {
  if (!storage || !db) {
    throw new Error('Storage not initialized');
  }

  // Verify user is the group owner before uploading
  const group = await getGroup(groupId);
  if (!group) {
    throw new Error('Group not found');
  }
  if (group.ownerUid !== currentUserUid) {
    throw new Error('Only the group owner can upload a group photo');
  }

  const response = await fetch(imageUri);
  const blob = await response.blob();

  const storageRef = ref(storage, `group-images/${groupId}/photo.jpg`);
  await uploadBytes(storageRef, blob, {
    contentType: 'image/jpeg',
  });

  return getDownloadURL(storageRef);
};

export const deleteGroupPhoto = async (
  groupId: string,
  currentUserUid: string,
): Promise<void> => {
  if (!storage || !db) return;

  // Verify user is the group owner before deleting
  const group = await getGroup(groupId);
  if (!group) {
    throw new Error('Group not found');
  }
  if (group.ownerUid !== currentUserUid) {
    throw new Error('Only the group owner can delete the group photo');
  }

  try {
    const storageRef = ref(storage, `group-images/${groupId}/photo.jpg`);
    await deleteObject(storageRef);
  } catch (err) {
    const appError = classifyError(err);
    console.warn('[Groups] Could not delete group photo:', appError.message);
  }
};

/**
 * Remove a member from the group (owner only)
 */
export const removeMemberFromGroup = async (
  groupId: string,
  memberUid: string,
  ownerUid: string
): Promise<{ success: boolean; error?: string }> => {
  if (!firebaseEnabled || !db) {
    return { success: false, error: 'Service unavailable' };
  }

  try {
    const group = await getGroup(groupId);
    if (!group) {
      return { success: false, error: 'Group not found' };
    }

    if (group.ownerUid !== ownerUid) {
      return { success: false, error: 'Only the group owner can remove members' };
    }

    if (memberUid === ownerUid) {
      return { success: false, error: 'Cannot remove yourself. Delete the group instead.' };
    }

    if (!group.memberUids.includes(memberUid)) {
      return { success: false, error: 'User is not a member of this group' };
    }

    // Remove from group
    const groupRef = doc(db, 'groups', groupId);
    await updateDoc(groupRef, {
      memberUids: arrayRemove(memberUid),
    });

    // Remove group from user's profile
    const userRef = doc(db, 'users', memberUid);
    await updateDoc(userRef, {
      groupIds: arrayRemove(groupId),
    });

    return { success: true };
  } catch (err) {
    const appError = classifyError(err);
    console.warn('[Groups] Error removing member:', appError.message);
    return { success: false, error: appError.message };
  }
};

/**
 * Block a user from posting in a specific group (owner only)
 */
export const blockUserFromGroupPosting = async (
  groupId: string,
  userUid: string,
  ownerUid: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> => {
  if (!firebaseEnabled || !db) {
    return { success: false, error: 'Service unavailable' };
  }

  try {
    const group = await getGroup(groupId);
    if (!group) {
      return { success: false, error: 'Group not found' };
    }

    if (group.ownerUid !== ownerUid) {
      return { success: false, error: 'Only the group owner can block users' };
    }

    if (userUid === ownerUid) {
      return { success: false, error: 'Cannot block yourself' };
    }

    const groupRef = doc(db, 'groups', groupId);
    await updateDoc(groupRef, {
      blockedFromPosting: arrayUnion(userUid),
    });

    return { success: true };
  } catch (err) {
    const appError = classifyError(err);
    console.warn('[Groups] Error blocking user from posting:', appError.message);
    return { success: false, error: appError.message };
  }
};

/**
 * Unblock a user from posting in a specific group (owner only)
 */
export const unblockUserFromGroupPosting = async (
  groupId: string,
  userUid: string,
  ownerUid: string
): Promise<{ success: boolean; error?: string }> => {
  if (!firebaseEnabled || !db) {
    return { success: false, error: 'Service unavailable' };
  }

  try {
    const group = await getGroup(groupId);
    if (!group) {
      return { success: false, error: 'Group not found' };
    }

    if (group.ownerUid !== ownerUid) {
      return { success: false, error: 'Only the group owner can unblock users' };
    }

    const groupRef = doc(db, 'groups', groupId);
    await updateDoc(groupRef, {
      blockedFromPosting: arrayRemove(userUid),
    });

    return { success: true };
  } catch (err) {
    const appError = classifyError(err);
    console.warn('[Groups] Error unblocking user from posting:', appError.message);
    return { success: false, error: appError.message };
  }
};

/**
 * Check if a user is blocked from posting in a group
 */
export const isUserBlockedFromGroupPosting = async (
  groupId: string,
  userUid: string
): Promise<boolean> => {
  if (!firebaseEnabled || !db) return false;

  try {
    const group = await getGroup(groupId);
    if (!group) return false;
    return group.blockedFromPosting?.includes(userUid) ?? false;
  } catch {
    return false;
  }
};

/**
 * Delete a prayer request from a group (owner only)
 */
export const deleteGroupPrayer = async (
  groupId: string,
  prayerId: string,
  ownerUid: string
): Promise<{ success: boolean; error?: string }> => {
  if (!firebaseEnabled || !db) {
    return { success: false, error: 'Service unavailable' };
  }

  try {
    const group = await getGroup(groupId);
    if (!group) {
      return { success: false, error: 'Group not found' };
    }

    if (group.ownerUid !== ownerUid) {
      return { success: false, error: 'Only the group owner can delete prayers' };
    }

    // Delete the prayer request
    await deleteDoc(doc(db, 'requests', prayerId));

    return { success: true };
  } catch (err) {
    const appError = classifyError(err);
    console.warn('[Groups] Error deleting group prayer:', appError.message);
    return { success: false, error: appError.message };
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
      } catch {
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
    const appError = classifyError(err);
    console.warn('[Groups] Error fetching group members:', appError.message);
    return [];
  }
};
