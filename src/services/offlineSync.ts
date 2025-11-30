import NetInfo from '@react-native-community/netinfo';
import type { User } from 'firebase/auth';
import { logPrayer } from './prayers';
import {
  getPendingPrayers,
  getPendingRequests,
  setPendingPrayers,
  setPendingRequests,
} from './offlineCache';
import { submitFeedItem } from '../hooks/useFeed';
import { firebaseEnabled } from './firebase';

const syncRequests = async (user: User) => {
  const pending = await getPendingRequests();
  const retained: typeof pending = [];

  for (const item of pending) {
    if (item.ownerUid !== user.uid) {
      retained.push(item);
      continue;
    }

    try {
      await submitFeedItem('REQUEST', item.content, user.uid, item.displayName || user.displayName || 'Anonymous', {
        category: item.category,
        isUrgent: item.isUrgent,
        isPrivate: item.isPrivate,
      });
    } catch (err) {
      console.warn('[OfflineSync] Could not sync request', err);
      retained.push(item);
    }
  }

  await setPendingRequests(retained);
};

const syncPrayers = async (user: User) => {
  const pending = await getPendingPrayers();
  const retained: typeof pending = [];

  for (const item of pending) {
    if (item.actorUid !== user.uid) {
      retained.push(item);
      continue;
    }

    try {
      const result = await logPrayer(item.actorUid, item.requestId, item.targetOwnerUid, item.targetSummary, item.actorDisplayName);
      
      // Check if the prayer was logged successfully
      if (!result.success) {
        // Don't retry if user already prayed - that's not a temporary failure
        if (result.alreadyPrayed) {
          console.log('[OfflineSync] Prayer already recorded, removing from queue:', item.requestId);
          // Don't add to retained - remove from queue
        } else {
          console.warn('[OfflineSync] Could not sync prayer:', result.error);
          retained.push(item);
        }
      } else {
        console.log('[OfflineSync] Successfully synced prayer for request:', item.requestId);
      }
    } catch (err) {
      console.warn('[OfflineSync] Could not sync prayer', err);
      retained.push(item);
    }
  }

  await setPendingPrayers(retained);
};

export const syncPendingOfflineActions = async (user: User | null) => {
  if (!user || !firebaseEnabled) return;
  await syncRequests(user);
  await syncPrayers(user);
};

export const startOfflineSyncListener = (user: User | null) => {
  if (!user || !firebaseEnabled) {
    return () => {};
  }

  // Initial drain
  syncPendingOfflineActions(user);

  const unsubscribe = NetInfo.addEventListener((state) => {
    if (state.isConnected) {
      syncPendingOfflineActions(user);
    }
  });

  return unsubscribe;
};
