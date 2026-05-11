import NetInfo from '@react-native-community/netinfo';
import type { User } from 'firebase/auth';
import { logPrayer } from './prayers';
import {
  getPendingPrayers,
  getPendingRequests,
  getPendingPrayerPromises,
  setPendingPrayers,
  setPendingRequests,
  setPendingPrayerPromises,
} from './offlineCache';
import { submitFeedItem } from '../hooks/useFeed';
import { createOrUpdatePrayerPromise } from './prayerPromises';
import { firebaseEnabled } from './firebase';

const BACKOFF_DELAYS = [1000, 5000, 15000, 30000, 60000];
const MAX_RETRIES = 5;

let retryCount = 0;
let retryTimeout: ReturnType<typeof setTimeout> | null = null;
let isSyncing = false;

const syncRequests = async (user: User): Promise<boolean> => {
  const pending = await getPendingRequests();
  const retained: typeof pending = [];
  let hadError = false;

  for (const item of pending) {
    if (item.ownerUid !== user.uid) {
      retained.push(item);
      continue;
    }

    try {
      const displayName = item.isAnonymous ? 'Anonymous' : (item.displayName || user.displayName || 'Anonymous');
      await submitFeedItem('REQUEST', item.content, user.uid, displayName, {
        category: item.category,
        isUrgent: item.isUrgent,
        isPrivate: item.isPrivate,
        isAnonymous: !!item.isAnonymous,
      });
    } catch (err) {
      console.warn('[OfflineSync] Could not sync request', err);
      retained.push(item);
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

export const syncPendingOfflineActions = async (user: User | null): Promise<boolean> => {
  if (!user || !firebaseEnabled) return true;
  const requestsOk = await syncRequests(user);
  const prayersOk = await syncPrayers(user);
  const promisesOk = await syncPrayerPromises(user);
  return requestsOk && prayersOk && promisesOk;
};

const syncWithBackoff = async (user: User): Promise<void> => {
  if (isSyncing) {
    console.log('[OfflineSync] Sync already in progress, skipping');
    return;
  }

  isSyncing = true;

  try {
    const success = await syncPendingOfflineActions(user);

    if (success) {
      retryCount = 0;
      console.log('[OfflineSync] Sync completed successfully');
    } else {
      throw new Error('Offline sync incomplete');
    }
  } catch (err) {
    console.warn('[OfflineSync] Sync failed:', err);

    if (retryCount < MAX_RETRIES) {
      const delay = BACKOFF_DELAYS[Math.min(retryCount, BACKOFF_DELAYS.length - 1)];
      retryCount++;

      console.log(`[OfflineSync] Retrying in ${delay}ms (attempt ${retryCount}/${MAX_RETRIES})`);

      retryTimeout = setTimeout(() => {
        syncWithBackoff(user);
      }, delay);
    } else {
      console.error('[OfflineSync] Max retries exceeded, giving up until next connection change');
      retryCount = 0;
    }
  } finally {
    isSyncing = false;
  }
};

export const startOfflineSyncListener = (user: User | null) => {
  if (!user || !firebaseEnabled) {
    return () => {};
  }

  if (retryTimeout) {
    clearTimeout(retryTimeout);
    retryTimeout = null;
  }
  retryCount = 0;

  // Initial drain
  syncWithBackoff(user);

  const unsubscribe = NetInfo.addEventListener((state) => {
    if (state.isConnected && state.isInternetReachable) {
      // Reset retries on a fresh connection
      retryCount = 0;
      syncWithBackoff(user);
    }
  });

  return () => {
    unsubscribe();
    if (retryTimeout) {
      clearTimeout(retryTimeout);
    }
  };
};
