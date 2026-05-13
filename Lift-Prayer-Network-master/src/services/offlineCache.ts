import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LiftRequest, Testimony } from '../types';
import { getSafeErrorMessage } from '../types/errors';

export const CACHE_KEYS = {
  REQUESTS: '@lift_cache_requests',
  TESTIMONIES: '@lift_cache_testimonies',
  PENDING_PRAYERS: '@lift_pending_prayers',
  PENDING_REQUESTS: '@lift_pending_requests',
  PENDING_COMMENTS: '@lift_pending_comments',
  PENDING_REACTIONS: '@lift_pending_reactions',
  PENDING_PROMISES: '@lift_pending_promises',
  LAST_SYNC: '@lift_last_sync',
  CURRENT_USER: '@lift_current_user',
  ANALYTICS_QUEUE: '@lift_analytics_queue',
  ONBOARDING_ANSWERS: '@lift_onboarding_answers',
  HAS_EVER_SIGNED_IN: '@lift_has_ever_signed_in',
};

// Cache duration in milliseconds (1 hour)
const CACHE_DURATION = 60 * 60 * 1000;

// TTL for pending actions (24 hours) - actions older than this are discarded
const PENDING_ACTION_TTL = 24 * 60 * 60 * 1000;

export type PendingPrayer = {
  id: string;
  requestId: string;
  actorUid: string;
  actorDisplayName?: string;
  targetOwnerUid: string;
  targetSummary: string;
  timestamp: number;
};

export type PendingRequest = {
  id: string;
  content: string;
  ownerUid: string;
  displayName: string;
  isAnonymous?: boolean;
  category: string;
  isUrgent: boolean;
  isPrivate: boolean;
  timestamp: number;
};

export type PendingComment = {
  id: string;
  targetId: string;
  targetType: 'REQUEST' | 'TESTIMONY';
  authorUid: string;
  authorDisplayName: string;
  content: string;
  timestamp: number;
};

export type PendingReaction = {
  id: string;
  targetId: string;
  targetType: 'REQUEST' | 'TESTIMONY';
  actorUid: string;
  reactionType: string;
  timestamp: number;
};

export type PendingPrayerPromise = {
  id: string;
  userId: string;
  requestId: string;
  requestOwnerUid: string;
  requestSummary: string;
  reminderFrequency: 'once' | 'daily' | 'weekly' | 'none';
  timestamp: number;
};

export type PendingActionCounts = {
  prayers: number;
  requests: number;
  comments: number;
  reactions: number;
  promises: number;
  total: number;
};

// Save requests to cache
export const cacheRequests = async (requests: LiftRequest[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(CACHE_KEYS.REQUESTS, JSON.stringify(requests));
    await AsyncStorage.setItem(CACHE_KEYS.LAST_SYNC, Date.now().toString());
  } catch (error) {
    console.error('[OfflineCache] Error caching requests:', getSafeErrorMessage(error));
  }
};

// Save testimonies to cache
export const cacheTestimonies = async (testimonies: Testimony[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(CACHE_KEYS.TESTIMONIES, JSON.stringify(testimonies));
    await AsyncStorage.setItem(CACHE_KEYS.LAST_SYNC, Date.now().toString());
  } catch (error) {
    console.error('[OfflineCache] Error caching testimonies:', getSafeErrorMessage(error));
  }
};

// Get cached requests
export const getCachedRequests = async (): Promise<LiftRequest[]> => {
  try {
    if (!(await isCacheFresh())) return [];
    const cached = await AsyncStorage.getItem(CACHE_KEYS.REQUESTS);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (error) {
    console.error('[OfflineCache] Error reading cached requests:', getSafeErrorMessage(error));
  }
  return [];
};

// Get cached testimonies
export const getCachedTestimonies = async (): Promise<Testimony[]> => {
  try {
    if (!(await isCacheFresh())) return [];
    const cached = await AsyncStorage.getItem(CACHE_KEYS.TESTIMONIES);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (error) {
    console.error('[OfflineCache] Error reading cached testimonies:', getSafeErrorMessage(error));
  }
  return [];
};

// Check if cache is fresh
export const isCacheFresh = async (): Promise<boolean> => {
  try {
    const lastSync = await AsyncStorage.getItem(CACHE_KEYS.LAST_SYNC);
    if (lastSync) {
      const syncTime = parseInt(lastSync, 10);
      return Date.now() - syncTime < CACHE_DURATION;
    }
  } catch (error) {
    console.error('[OfflineCache] Error checking cache freshness:', getSafeErrorMessage(error));
  }
  return false;
};

// Queue a prayer for when back online
export const queuePendingPrayer = async (prayer: Omit<PendingPrayer, 'id' | 'timestamp'>): Promise<void> => {
  try {
    const existing = await AsyncStorage.getItem(CACHE_KEYS.PENDING_PRAYERS);
    const prayers: PendingPrayer[] = existing ? JSON.parse(existing) : [];
    
    prayers.push({
      ...prayer,
      id: `pending_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      timestamp: Date.now(),
    });
    
    await AsyncStorage.setItem(CACHE_KEYS.PENDING_PRAYERS, JSON.stringify(prayers));
    console.log('[OfflineCache] Prayer queued for sync');
  } catch (error) {
    console.error('[OfflineCache] Error queuing prayer:', getSafeErrorMessage(error));
  }
};

// Queue a request for when back online
export const queuePendingRequest = async (request: Omit<PendingRequest, 'id' | 'timestamp'>): Promise<void> => {
  try {
    const existing = await AsyncStorage.getItem(CACHE_KEYS.PENDING_REQUESTS);
    const requests: PendingRequest[] = existing ? JSON.parse(existing) : [];
    
    requests.push({
      ...request,
      id: `pending_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      timestamp: Date.now(),
    });
    
    await AsyncStorage.setItem(CACHE_KEYS.PENDING_REQUESTS, JSON.stringify(requests));
    console.log('[OfflineCache] Request queued for sync');
  } catch (error) {
    console.error('[OfflineCache] Error queuing request:', getSafeErrorMessage(error));
  }
};

// Get pending prayers to sync
export const getPendingPrayers = async (): Promise<PendingPrayer[]> => {
  try {
    const pending = await AsyncStorage.getItem(CACHE_KEYS.PENDING_PRAYERS);
    if (pending) {
      return JSON.parse(pending);
    }
  } catch (error) {
    console.error('[OfflineCache] Error reading pending prayers:', getSafeErrorMessage(error));
  }
  return [];
};

// Get pending requests to sync
export const getPendingRequests = async (): Promise<PendingRequest[]> => {
  try {
    const pending = await AsyncStorage.getItem(CACHE_KEYS.PENDING_REQUESTS);
    if (pending) {
      return JSON.parse(pending);
    }
  } catch (error) {
    console.error('[OfflineCache] Error reading pending requests:', getSafeErrorMessage(error));
  }
  return [];
};

// Clear pending prayers after sync
export const clearPendingPrayers = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(CACHE_KEYS.PENDING_PRAYERS);
  } catch (error) {
    console.error('[OfflineCache] Error clearing pending prayers:', getSafeErrorMessage(error));
  }
};

// Clear pending requests after sync
export const clearPendingRequests = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(CACHE_KEYS.PENDING_REQUESTS);
  } catch (error) {
    console.error('[OfflineCache] Error clearing pending requests:', getSafeErrorMessage(error));
  }
};

const persistList = async <T>(key: string, list: T[]): Promise<void> => {
  await AsyncStorage.setItem(key, JSON.stringify(list));
};

export const setPendingPrayers = async (prayers: PendingPrayer[]): Promise<void> => {
  try {
    await persistList(CACHE_KEYS.PENDING_PRAYERS, prayers);
  } catch (error) {
    console.error('[OfflineCache] Error saving pending prayers:', getSafeErrorMessage(error));
  }
};

export const setPendingRequests = async (requests: PendingRequest[]): Promise<void> => {
  try {
    await persistList(CACHE_KEYS.PENDING_REQUESTS, requests);
  } catch (error) {
    console.error('[OfflineCache] Error saving pending requests:', getSafeErrorMessage(error));
  }
};

// Clear all cache
export const clearAllCache = async (): Promise<void> => {
  try {
    await AsyncStorage.multiRemove(Object.values(CACHE_KEYS));
  } catch (error) {
    console.error('[OfflineCache] Error clearing cache:', getSafeErrorMessage(error));
  }
};

export const clearLaunchState = async (): Promise<void> => {
  try {
    await AsyncStorage.multiRemove([
      CACHE_KEYS.ONBOARDING_ANSWERS,
      CACHE_KEYS.HAS_EVER_SIGNED_IN,
    ]);
  } catch (error) {
    console.error('[OfflineCache] Error clearing launch state:', getSafeErrorMessage(error));
  }
};

// Get cache stats
export const getCacheStats = async (): Promise<{
  requestCount: number;
  testimonyCount: number;
  pendingPrayers: number;
  pendingRequests: number;
  lastSync: Date | null;
}> => {
  try {
    const [requests, testimonies, pendingPrayers, pendingRequests, lastSync] = await Promise.all([
      getCachedRequests(),
      getCachedTestimonies(),
      getPendingPrayers(),
      getPendingRequests(),
      AsyncStorage.getItem(CACHE_KEYS.LAST_SYNC),
    ]);

    return {
      requestCount: requests.length,
      testimonyCount: testimonies.length,
      pendingPrayers: pendingPrayers.length,
      pendingRequests: pendingRequests.length,
      lastSync: lastSync ? new Date(parseInt(lastSync, 10)) : null,
    };
  } catch (error) {
    console.error('[OfflineCache] Error getting cache stats:', getSafeErrorMessage(error));
    return {
      requestCount: 0,
      testimonyCount: 0,
      pendingPrayers: 0,
      pendingRequests: 0,
      lastSync: null,
    };
  }
};

// Validate and repair corrupted cache data
export const validateAndRepairCache = async (): Promise<boolean> => {
  try {
    // Try to read each cache key and clear if corrupted
    const keysToCheck = [
      CACHE_KEYS.REQUESTS,
      CACHE_KEYS.TESTIMONIES,
      CACHE_KEYS.PENDING_PRAYERS,
      CACHE_KEYS.PENDING_REQUESTS,
      CACHE_KEYS.PENDING_COMMENTS,
      CACHE_KEYS.PENDING_REACTIONS,
      CACHE_KEYS.PENDING_PROMISES,
    ];

    for (const key of keysToCheck) {
      try {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          // Try to parse - if it fails, the data is corrupted
          JSON.parse(data);
        }
      } catch {
        console.warn(`[OfflineCache] Corrupted data in ${key}, clearing...`);
        await AsyncStorage.removeItem(key);
      }
    }

    return true;
  } catch (error) {
    console.error('[OfflineCache] Error validating cache:', getSafeErrorMessage(error));
    // If validation fails completely, clear all cache
    await clearAllCache();
    return false;
  }
};

// ============================================================================
// Per-User Pending Actions with TTL
// ============================================================================

/**
 * Set the current user ID for scoping pending actions
 */
export const setCurrentUser = async (userId: string | null): Promise<void> => {
  try {
    if (userId) {
      await AsyncStorage.setItem(CACHE_KEYS.CURRENT_USER, userId);
    } else {
      await AsyncStorage.removeItem(CACHE_KEYS.CURRENT_USER);
    }
  } catch (error) {
    console.error('[OfflineCache] Error setting current user:', getSafeErrorMessage(error));
  }
};

/**
 * Get the current user ID
 */
export const getCurrentUser = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(CACHE_KEYS.CURRENT_USER);
  } catch (error) {
    console.error('[OfflineCache] Error getting current user:', getSafeErrorMessage(error));
    return null;
  }
};

/**
 * Filter out expired pending actions (older than TTL)
 */
function filterExpiredActions<T extends { timestamp: number }>(actions: T[]): T[] {
  const now = Date.now();
  return actions.filter(action => now - action.timestamp < PENDING_ACTION_TTL);
}

/**
 * Filter pending actions to only include those for the current user
 */
function filterByUser<T extends { actorUid?: string; authorUid?: string; ownerUid?: string; userId?: string }>(
  actions: T[],
  userId: string
): T[] {
  return actions.filter(action => 
    action.actorUid === userId || 
    action.authorUid === userId || 
    action.ownerUid === userId ||
    action.userId === userId
  );
}

/**
 * Clean up expired and orphaned pending actions
 * Call this on app start and when user signs out
 */
export const cleanupPendingActions = async (currentUserId?: string): Promise<void> => {
  try {
    const [prayers, requests, comments, reactions, promises] = await Promise.all([
      getPendingPrayers(),
      getPendingRequests(),
      getPendingComments(),
      getPendingReactions(),
      getPendingPrayerPromises(),
    ]);

    const validPrayers = filterExpiredActions(prayers);
    const validRequests = filterExpiredActions(requests);
    const validComments = filterExpiredActions(comments);
    const validReactions = filterExpiredActions(reactions);
    const validPromises = filterExpiredActions(promises);

    const finalPrayers = currentUserId ? filterByUser(validPrayers, currentUserId) : validPrayers;
    const finalRequests = currentUserId ? filterByUser(validRequests, currentUserId) : validRequests;
    const finalComments = currentUserId ? filterByUser(validComments, currentUserId) : validComments;
    const finalReactions = currentUserId ? filterByUser(validReactions, currentUserId) : validReactions;
    const finalPromises = currentUserId ? filterByUser(validPromises, currentUserId) : validPromises;

    await Promise.all([
      setPendingPrayers(finalPrayers),
      setPendingRequests(finalRequests),
      setPendingComments(finalComments),
      setPendingReactions(finalReactions),
      setPendingPrayerPromises(finalPromises),
    ]);

    const removed =
      (prayers.length - finalPrayers.length) +
      (requests.length - finalRequests.length) +
      (comments.length - finalComments.length) +
      (reactions.length - finalReactions.length) +
      (promises.length - finalPromises.length);

    if (removed > 0) {
      console.log(`[OfflineCache] Cleaned up ${removed} expired/orphaned pending actions`);
    }
  } catch (error) {
    console.error('[OfflineCache] Error cleaning up pending actions:', getSafeErrorMessage(error));
  }
};

/**
 * Clear all pending actions for a specific user (call on sign out)
 */
export const clearUserPendingActions = async (userId: string): Promise<void> => {
  try {
    const [prayers, requests, comments, reactions, promises] = await Promise.all([
      getPendingPrayers(),
      getPendingRequests(),
      getPendingComments(),
      getPendingReactions(),
      getPendingPrayerPromises(),
    ]);

    const otherPrayers = prayers.filter(p => p.actorUid !== userId);
    const otherRequests = requests.filter(r => r.ownerUid !== userId);
    const otherComments = comments.filter(c => c.authorUid !== userId);
    const otherReactions = reactions.filter(r => r.actorUid !== userId);
    const otherPromises = promises.filter(p => p.userId !== userId);

    await Promise.all([
      setPendingPrayers(otherPrayers),
      setPendingRequests(otherRequests),
      setPendingComments(otherComments),
      setPendingReactions(otherReactions),
      setPendingPrayerPromises(otherPromises),
    ]);

    console.log(`[OfflineCache] Cleared pending actions for user ${userId}`);
  } catch (error) {
    console.error('[OfflineCache] Error clearing user pending actions:', getSafeErrorMessage(error));
  }
};

// ============================================================================
// Pending Comments
// ============================================================================

export const queuePendingComment = async (comment: Omit<PendingComment, 'id' | 'timestamp'>): Promise<void> => {
  try {
    const existing = await AsyncStorage.getItem(CACHE_KEYS.PENDING_COMMENTS);
    const comments: PendingComment[] = existing ? JSON.parse(existing) : [];
    
    comments.push({
      ...comment,
      id: `pending_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      timestamp: Date.now(),
    });
    
    await AsyncStorage.setItem(CACHE_KEYS.PENDING_COMMENTS, JSON.stringify(comments));
    console.log('[OfflineCache] Comment queued for sync');
  } catch (error) {
    console.error('[OfflineCache] Error queuing comment:', getSafeErrorMessage(error));
  }
};

export const getPendingComments = async (): Promise<PendingComment[]> => {
  try {
    const pending = await AsyncStorage.getItem(CACHE_KEYS.PENDING_COMMENTS);
    if (pending) {
      return JSON.parse(pending);
    }
  } catch (error) {
    console.error('[OfflineCache] Error reading pending comments:', getSafeErrorMessage(error));
  }
  return [];
};

export const setPendingComments = async (comments: PendingComment[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(CACHE_KEYS.PENDING_COMMENTS, JSON.stringify(comments));
  } catch (error) {
    console.error('[OfflineCache] Error saving pending comments:', getSafeErrorMessage(error));
  }
};

export const clearPendingComments = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(CACHE_KEYS.PENDING_COMMENTS);
  } catch (error) {
    console.error('[OfflineCache] Error clearing pending comments:', getSafeErrorMessage(error));
  }
};

// ============================================================================
// Pending Reactions
// ============================================================================

export const queuePendingReaction = async (reaction: Omit<PendingReaction, 'id' | 'timestamp'>): Promise<void> => {
  try {
    const existing = await AsyncStorage.getItem(CACHE_KEYS.PENDING_REACTIONS);
    const reactions: PendingReaction[] = existing ? JSON.parse(existing) : [];
    
    reactions.push({
      ...reaction,
      id: `pending_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      timestamp: Date.now(),
    });
    
    await AsyncStorage.setItem(CACHE_KEYS.PENDING_REACTIONS, JSON.stringify(reactions));
    console.log('[OfflineCache] Reaction queued for sync');
  } catch (error) {
    console.error('[OfflineCache] Error queuing reaction:', getSafeErrorMessage(error));
  }
};

export const getPendingReactions = async (): Promise<PendingReaction[]> => {
  try {
    const pending = await AsyncStorage.getItem(CACHE_KEYS.PENDING_REACTIONS);
    if (pending) {
      return JSON.parse(pending);
    }
  } catch (error) {
    console.error('[OfflineCache] Error reading pending reactions:', getSafeErrorMessage(error));
  }
  return [];
};

export const setPendingReactions = async (reactions: PendingReaction[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(CACHE_KEYS.PENDING_REACTIONS, JSON.stringify(reactions));
  } catch (error) {
    console.error('[OfflineCache] Error saving pending reactions:', getSafeErrorMessage(error));
  }
};

export const clearPendingReactions = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(CACHE_KEYS.PENDING_REACTIONS);
  } catch (error) {
    console.error('[OfflineCache] Error clearing pending reactions:', getSafeErrorMessage(error));
  }
};

// ============================================================================
// Pending Prayer Promises
// ============================================================================

export const queuePendingPrayerPromise = async (promise: Omit<PendingPrayerPromise, 'id' | 'timestamp'>): Promise<void> => {
  try {
    const existing = await AsyncStorage.getItem(CACHE_KEYS.PENDING_PROMISES);
    const promises: PendingPrayerPromise[] = existing ? JSON.parse(existing) : [];
    const duplicate = promises.some((item) => item.userId === promise.userId && item.requestId === promise.requestId);

    if (!duplicate) {
      promises.push({
        ...promise,
        id: `pending_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        timestamp: Date.now(),
      });
    }

    await AsyncStorage.setItem(CACHE_KEYS.PENDING_PROMISES, JSON.stringify(promises));
    console.log('[OfflineCache] Prayer promise queued for sync');
  } catch (error) {
    console.error('[OfflineCache] Error queuing prayer promise:', getSafeErrorMessage(error));
  }
};

export const getPendingPrayerPromises = async (): Promise<PendingPrayerPromise[]> => {
  try {
    const pending = await AsyncStorage.getItem(CACHE_KEYS.PENDING_PROMISES);
    if (pending) return JSON.parse(pending);
  } catch (error) {
    console.error('[OfflineCache] Error reading pending prayer promises:', getSafeErrorMessage(error));
  }
  return [];
};

export const setPendingPrayerPromises = async (promises: PendingPrayerPromise[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(CACHE_KEYS.PENDING_PROMISES, JSON.stringify(promises));
  } catch (error) {
    console.error('[OfflineCache] Error saving pending prayer promises:', getSafeErrorMessage(error));
  }
};

export const clearPendingPrayerPromises = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(CACHE_KEYS.PENDING_PROMISES);
  } catch (error) {
    console.error('[OfflineCache] Error clearing pending prayer promises:', getSafeErrorMessage(error));
  }
};

// ============================================================================
// Pending Action Counts (for UI display)
// ============================================================================

export const getPendingActionCounts = async (): Promise<PendingActionCounts> => {
  try {
    const [prayers, requests, comments, reactions, promises] = await Promise.all([
      getPendingPrayers(),
      getPendingRequests(),
      getPendingComments(),
      getPendingReactions(),
      getPendingPrayerPromises(),
    ]);

    const counts = {
      prayers: prayers.length,
      requests: requests.length,
      comments: comments.length,
      reactions: reactions.length,
      promises: promises.length,
      total: prayers.length + requests.length + comments.length + reactions.length + promises.length,
    };

    return counts;
  } catch (error) {
    console.error('[OfflineCache] Error getting pending action counts:', getSafeErrorMessage(error));
    return { prayers: 0, requests: 0, comments: 0, reactions: 0, promises: 0, total: 0 };
  }
};
