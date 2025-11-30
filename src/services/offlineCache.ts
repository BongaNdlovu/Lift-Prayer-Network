import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FeedItem, LiftRequest, Testimony } from '../types';

const CACHE_KEYS = {
  REQUESTS: '@lift_cache_requests',
  TESTIMONIES: '@lift_cache_testimonies',
  PENDING_PRAYERS: '@lift_pending_prayers',
  PENDING_REQUESTS: '@lift_pending_requests',
  LAST_SYNC: '@lift_last_sync',
};

// Cache duration in milliseconds (1 hour)
const CACHE_DURATION = 60 * 60 * 1000;

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
  category: string;
  isUrgent: boolean;
  isPrivate: boolean;
  timestamp: number;
};

// Save requests to cache
export const cacheRequests = async (requests: LiftRequest[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(CACHE_KEYS.REQUESTS, JSON.stringify(requests));
    await AsyncStorage.setItem(CACHE_KEYS.LAST_SYNC, Date.now().toString());
  } catch (error) {
    console.error('[OfflineCache] Error caching requests:', error);
  }
};

// Save testimonies to cache
export const cacheTestimonies = async (testimonies: Testimony[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(CACHE_KEYS.TESTIMONIES, JSON.stringify(testimonies));
  } catch (error) {
    console.error('[OfflineCache] Error caching testimonies:', error);
  }
};

// Get cached requests
export const getCachedRequests = async (): Promise<LiftRequest[]> => {
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEYS.REQUESTS);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (error) {
    console.error('[OfflineCache] Error reading cached requests:', error);
  }
  return [];
};

// Get cached testimonies
export const getCachedTestimonies = async (): Promise<Testimony[]> => {
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEYS.TESTIMONIES);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (error) {
    console.error('[OfflineCache] Error reading cached testimonies:', error);
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
    console.error('[OfflineCache] Error checking cache freshness:', error);
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
    console.error('[OfflineCache] Error queuing prayer:', error);
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
    console.error('[OfflineCache] Error queuing request:', error);
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
    console.error('[OfflineCache] Error reading pending prayers:', error);
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
    console.error('[OfflineCache] Error reading pending requests:', error);
  }
  return [];
};

// Clear pending prayers after sync
export const clearPendingPrayers = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(CACHE_KEYS.PENDING_PRAYERS);
  } catch (error) {
    console.error('[OfflineCache] Error clearing pending prayers:', error);
  }
};

// Clear pending requests after sync
export const clearPendingRequests = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(CACHE_KEYS.PENDING_REQUESTS);
  } catch (error) {
    console.error('[OfflineCache] Error clearing pending requests:', error);
  }
};

const persistList = async <T>(key: string, list: T[]): Promise<void> => {
  await AsyncStorage.setItem(key, JSON.stringify(list));
};

export const setPendingPrayers = async (prayers: PendingPrayer[]): Promise<void> => {
  try {
    await persistList(CACHE_KEYS.PENDING_PRAYERS, prayers);
  } catch (error) {
    console.error('[OfflineCache] Error saving pending prayers:', error);
  }
};

export const setPendingRequests = async (requests: PendingRequest[]): Promise<void> => {
  try {
    await persistList(CACHE_KEYS.PENDING_REQUESTS, requests);
  } catch (error) {
    console.error('[OfflineCache] Error saving pending requests:', error);
  }
};

// Clear all cache
export const clearAllCache = async (): Promise<void> => {
  try {
    await AsyncStorage.multiRemove([
      CACHE_KEYS.REQUESTS,
      CACHE_KEYS.TESTIMONIES,
      CACHE_KEYS.LAST_SYNC,
      CACHE_KEYS.PENDING_PRAYERS,
      CACHE_KEYS.PENDING_REQUESTS,
    ]);
  } catch (error) {
    console.error('[OfflineCache] Error clearing cache:', error);
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
    console.error('[OfflineCache] Error getting cache stats:', error);
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
    ];

    for (const key of keysToCheck) {
      try {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          // Try to parse - if it fails, the data is corrupted
          JSON.parse(data);
        }
      } catch (parseError) {
        console.warn(`[OfflineCache] Corrupted data in ${key}, clearing...`);
        await AsyncStorage.removeItem(key);
      }
    }

    return true;
  } catch (error) {
    console.error('[OfflineCache] Error validating cache:', error);
    // If validation fails completely, clear all cache
    await clearAllCache();
    return false;
  }
};

