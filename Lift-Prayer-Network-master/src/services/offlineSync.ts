import NetInfo from '@react-native-community/netinfo';
import type { User } from 'firebase/auth';
import { logPrayer, logReaction } from './prayers';
import {
  getPendingPrayers,
  getPendingRequests,
  getPendingPrayerPromises,
  getPendingComments,
  getPendingReactions,
  setPendingPrayers,
  setPendingRequests,
  setPendingPrayerPromises,
  setPendingComments,
  setPendingReactions,
  type PendingRequest,
} from './offlineCache';
import { submitFeedItem } from '../hooks/useFeed';
import { createOrUpdatePrayerPromise } from './prayerPromises';
import { firebaseEnabled } from './firebase';
import { normalizePrivacyFields } from '../utils/contentPrivacy';
import { addComment } from './comments';

const BACKOFF_DELAYS = [1000, 5000, 15000, 30000, 60000];
const MAX_RETRIES = 5;

export type SyncResult = {
  success: boolean;
  synced: {
    prayers: number;
    requests: number;
    comments: number;
    reactions: number;
    promises: number;
  };
  failed: {
    prayers: number;
    requests: number;
    comments: number;
    reactions: number;
    promises: number;
  };
  errors: string[];
};

const createSyncResult = (): SyncResult => ({
  success: true,
  synced: { prayers: 0, requests: 0, comments: 0, reactions: 0, promises: 0 },
  failed: { prayers: 0, requests: 0, comments: 0, reactions: 0, promises: 0 },
  errors: [],
});

type SyncErrorClass = 'retryable' | 'permanent' | 'permission' | 'auth' | 'blocked' | 'malformed';

const classifyOfflineSyncError = (err: unknown): SyncErrorClass => {
  const code = (err as { code?: string } | undefined)?.code || '';
  const message = ((err as { message?: string } | undefined)?.message || '').toLowerCase();

  if (code === 'unavailable' || code === 'deadline-exceeded' || code === 'aborted') return 'retryable';
  if (message.includes('network') || message.includes('offline') || message.includes('internet') || message.includes('connection') || message.includes('timeout')) return 'retryable';

  if (code === 'permission-denied') return 'permission';
  if (code === 'unauthenticated' || message.includes('unauthenticated')) return 'auth';
  if (message.includes('banned') || message.includes('blocked') || message.includes('posting restricted')) return 'blocked';
  if (message.includes('invalid') || message.includes('malformed') || message.includes('required')) return 'malformed';

  return 'retryable';
};

const retainFailed = (item: PendingRequest, err: unknown, classification: SyncErrorClass): PendingRequest => {
  const isRetryable = classification === 'retryable';
  return {
    ...item,
    syncStatus: isRetryable ? 'pending' : 'failed',
    syncError: isRetryable ? undefined : ((err as { message?: string } | undefined)?.message || 'Sync failed'),
    lastAttemptAt: Date.now(),
    attemptCount: (item.attemptCount || 0) + 1,
  };
};

const syncRequests = async (user: User): Promise<boolean> => {
  const pending = await getPendingRequests();
  const retained: typeof pending = [];
  let hadError = false;

  for (const item of pending) {
    if (item.ownerUid !== user.uid) {
      retained.push(item);
      continue;
    }

    if (item.syncStatus === 'failed') {
      retained.push(item);
      continue;
    }

    try {
      const displayName = item.isAnonymous ? 'Anonymous' : (item.displayName || user.displayName || 'Anonymous');

      const privacy = normalizePrivacyFields({
        visibility: item.visibility,
        isPrivate: item.isPrivate,
        groupIds: item.groupIds,
      });

      if (privacy.visibility === 'GROUP' && (!privacy.groupIds || privacy.groupIds.length === 0)) {
        retained.push(retainFailed(item, new Error('Group visibility requires groupIds'), 'malformed'));
        hadError = true;
        continue;
      }

      await submitFeedItem('REQUEST', item.content, user.uid, displayName, {
        category: item.category,
        title: item.title || item.content.slice(0, 80),
        isUrgent: item.isUrgent,
        isPrivate: privacy.isPrivate,
        isAnonymous: !!item.isAnonymous,
        visibility: privacy.visibility,
        groupIds: privacy.visibility === 'GROUP' ? privacy.groupIds : undefined,
        supportPreference: item.supportPreference || 'ENCOURAGEMENT_WELCOME',
        isShareable: item.isShareable !== false,
        userEmail: item.isAnonymous ? undefined : (item.userEmail || user.email || undefined),
        userPhotoURL: item.isAnonymous ? null : ((item.userPhotoURL ?? user.photoURL) || null),
        isEmailVerified: item.isAnonymous ? false : (item.isEmailVerified ?? user.emailVerified),
      });
    } catch (err) {
      console.warn('[OfflineSync] Could not sync request', err);
      const classification = classifyOfflineSyncError(err);
      retained.push(retainFailed(item, err, classification));
      hadError = true;
    }
  }

  await setPendingRequests(retained);
  return !hadError;
};

const syncPrayers = async (user: User): Promise<boolean> => {
  const pending = await getPendingPrayers();
  const retained: typeof pending = [];
  let hadError = false;

  for (const item of pending) {
    if (item.actorUid !== user.uid) {
      retained.push(item);
      continue;
    }

    try {
      const result = await logPrayer(item.actorUid, item.requestId, item.targetOwnerUid, item.targetSummary, item.actorDisplayName);

      if (!result.success) {
        if (result.alreadyPrayed) {
          console.log('[OfflineSync] Prayer already recorded, removing from queue:', item.requestId);
        } else {
          console.warn('[OfflineSync] Could not sync prayer:', result.error);
          retained.push(item);
          hadError = true;
        }
      } else {
        console.log('[OfflineSync] Successfully synced prayer for request:', item.requestId);
      }
    } catch (err) {
      console.warn('[OfflineSync] Could not sync prayer', err);
      retained.push(item);
      hadError = true;
    }
  }

  await setPendingPrayers(retained);
  return !hadError;
};

const syncPrayerPromises = async (user: User): Promise<boolean> => {
  const pending = await getPendingPrayerPromises();
  const retained: typeof pending = [];
  let hadError = false;

  for (const item of pending) {
    if (item.userId !== user.uid) {
      retained.push(item);
      continue;
    }

    try {
      await createOrUpdatePrayerPromise({
        userId: item.userId,
        requestId: item.requestId,
        requestOwnerUid: item.requestOwnerUid,
        requestSummary: item.requestSummary,
        reminderFrequency: item.reminderFrequency,
      });
      console.log('[OfflineSync] Successfully synced prayer promise for request:', item.requestId);
    } catch (err) {
      console.warn('[OfflineSync] Could not sync prayer promise', err);
      retained.push(item);
      hadError = true;
    }
  }

  await setPendingPrayerPromises(retained);
  return !hadError;
};

const syncComments = async (user: User): Promise<boolean> => {
  const pending = await getPendingComments();
  const retained: typeof pending = [];
  let hadError = false;

  for (const item of pending) {
    if (item.authorUid !== user.uid) {
      retained.push(item);
      continue;
    }

    try {
      await addComment(item.targetId, item.targetType, item.authorUid, item.authorDisplayName, item.content);
      console.log('[OfflineSync] Successfully synced comment for target:', item.targetId);
    } catch (err) {
      console.warn('[OfflineSync] Could not sync comment', err);
      retained.push(item);
      hadError = true;
    }
  }

  await setPendingComments(retained);
  return !hadError;
};

const syncReactions = async (user: User): Promise<boolean> => {
  const pending = await getPendingReactions();
  const retained: typeof pending = [];
  let hadError = false;

  for (const item of pending) {
    if (item.actorUid !== user.uid) {
      retained.push(item);
      continue;
    }

    try {
      await logReaction(item.actorUid, item.targetId, item.targetType, item.reactionType as any);
      console.log('[OfflineSync] Successfully synced reaction for target:', item.targetId);
    } catch (err) {
      console.warn('[OfflineSync] Could not sync reaction', err);
      retained.push(item);
      hadError = true;
    }
  }

  await setPendingReactions(retained);
  return !hadError;
};

export const syncPendingActions = async (user: User | null): Promise<SyncResult> => {
  const result = createSyncResult();

  if (!user || !firebaseEnabled) return result;

  const before = await Promise.all([
    getPendingPrayers(),
    getPendingRequests(),
    getPendingComments(),
    getPendingReactions(),
    getPendingPrayerPromises(),
  ]);

  const ok = await syncPendingOfflineActions(user);

  const after = await Promise.all([
    getPendingPrayers(),
    getPendingRequests(),
    getPendingComments(),
    getPendingReactions(),
    getPendingPrayerPromises(),
  ]);

  const keys = ['prayers', 'requests', 'comments', 'reactions', 'promises'] as const;
  keys.forEach((key, index) => {
    const beforeForUser = before[index].filter((item: any) =>
      item.actorUid === user.uid ||
      item.ownerUid === user.uid ||
      item.authorUid === user.uid ||
      item.userId === user.uid
    ).length;
    const afterForUser = after[index].filter((item: any) =>
      item.actorUid === user.uid ||
      item.ownerUid === user.uid ||
      item.authorUid === user.uid ||
      item.userId === user.uid
    ).length;
    result.synced[key] = Math.max(0, beforeForUser - afterForUser);
    result.failed[key] = ok ? 0 : afterForUser;
  });

  result.success = ok;
  if (!ok) result.errors.push('Some pending actions could not be synced and were retained.');
  return result;
};

export const syncPendingOfflineActions = async (user: User | null): Promise<boolean> => {
  if (!user || !firebaseEnabled) return true;
  const requestsOk = await syncRequests(user);
  const prayersOk = await syncPrayers(user);
  const promisesOk = await syncPrayerPromises(user);
  const commentsOk = await syncComments(user);
  const reactionsOk = await syncReactions(user);
  return requestsOk && prayersOk && promisesOk && commentsOk && reactionsOk;
};

export const startOfflineSyncListener = (user: User | null) => {
  if (!user || !firebaseEnabled) {
    return () => {};
  }

  // Per-listener state to prevent interference between multiple listeners
  let retryCount = 0;
  let retryTimeout: ReturnType<typeof setTimeout> | null = null;
  let isSyncing = false;
  let disposed = false;

  const syncWithBackoff = async (user: User): Promise<void> => {
    if (disposed || isSyncing) return;

    isSyncing = true;

    try {
      const success = await syncPendingOfflineActions(user);
      if (success) retryCount = 0;
      else throw new Error('Offline sync incomplete');
    } catch {
      if (!disposed && retryCount < MAX_RETRIES) {
        const delay = BACKOFF_DELAYS[Math.min(retryCount, BACKOFF_DELAYS.length - 1)];
        retryCount++;
        retryTimeout = setTimeout(() => syncWithBackoff(user), delay);
      } else {
        retryCount = 0;
      }
    } finally {
      isSyncing = false;
    }
  };

  // Initial drain
  syncWithBackoff(user);

  const unsubscribe = NetInfo.addEventListener((state) => {
    if (state.isConnected && state.isInternetReachable) {
      retryCount = 0;
      syncWithBackoff(user);
    }
  });

  return () => {
    disposed = true;
    unsubscribe();
    if (retryTimeout) clearTimeout(retryTimeout);
  };
};
