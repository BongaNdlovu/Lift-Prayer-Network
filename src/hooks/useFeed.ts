import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Unsubscribe,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  addDoc,
  updateDoc,
  doc,
  increment,
  getDocs,
} from 'firebase/firestore';
import { db, firebaseEnabled } from '../services/firebase';
import {
  cacheRequests,
  cacheTestimonies,
  getCachedRequests,
  getCachedTestimonies,
} from '../services/offlineCache';
import { incrementUserRequestCount, incrementUserTestimonyCount } from '../services/stats';
import { checkAndUnlockAchievements } from '../services/achievements';
import type { FeedItem, LiftRequest, Testimony } from '../types';

type Mode = 'REQUEST' | 'TESTIMONY';

const LOCATIONS = [
  'SECTOR 07 (NY)',
  'NEO-TOKYO GRID',
  'OLD LONDON',
  'JOHANNESBURG OUTPOST',
  'DUBAI NODE',
  'MUMBAI NET',
  'BERLIN WALL 2',
  'SAO PAULO ZONE',
];
const URGENT_TOPICS = ['Supply Shortage', 'Sickness', 'Protection', 'Guidance', 'Grid Failure', 'Reunification'];
const NAMES = ['User_992', 'Kael', 'Sera_Phim', 'Unit_734', 'Watcher', 'Nomad', 'Echo_Five'];

const generateMockItem = (mode: Mode): FeedItem => {
  const base = {
    id: Math.random().toString(36).slice(2),
    ownerUid: 'mock',
    userDisplayName: NAMES[Math.floor(Math.random() * NAMES.length)],
    location: LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)],
    content:
      mode === 'REQUEST'
        ? `Requesting spiritual cover for ${
            URGENT_TOPICS[Math.floor(Math.random() * URGENT_TOPICS.length)]
          }. The shadows are lengthening here. We need light.`
        : 'The intervention arrived at dawn. Supplies secured. The blockade has lifted. Faith confirmed.',
    createdAt: new Date(),
  };
  if (mode === 'REQUEST') {
    return {
      ...base,
      type: 'REQUEST',
      severity: Math.random() > 0.7 ? 'CRITICAL' : 'HIGH',
      prayers: Math.floor(Math.random() * 50),
      status: 'ACTIVE',
    };
  }
  return {
    ...base,
    type: 'TESTIMONY',
    severity: 'RESOLVED',
    likes: Math.floor(Math.random() * 200),
  };
};

export const useFeed = (mode: Mode, viewerUid?: string, userGroupIds?: string[]) => {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const isMounted = useRef(true);
  const lastFetchTime = useRef<number>(0);
  
  // Track viewerUid changes to re-filter when user signs in
  const viewerUidRef = useRef(viewerUid);
  viewerUidRef.current = viewerUid;

  // Sort function to put pinned items first
  const sortWithPinnedFirst = useCallback((list: FeedItem[]) => {
    return [...list].sort((a, b) => {
      // Pinned items come first
      const aIsPinned = a.type === 'REQUEST' && (a as LiftRequest).isPinned;
      const bIsPinned = b.type === 'REQUEST' && (b as LiftRequest).isPinned;
      
      if (aIsPinned && !bIsPinned) return -1;
      if (!aIsPinned && bIsPinned) return 1;
      
      // If both pinned or both not pinned, sort by pinnedAt or createdAt
      if (aIsPinned && bIsPinned) {
        const aPinnedAt = (a as any).pinnedAt?.toDate?.() || (a as any).pinnedAt || 0;
        const bPinnedAt = (b as any).pinnedAt?.toDate?.() || (b as any).pinnedAt || 0;
        return new Date(bPinnedAt).getTime() - new Date(aPinnedAt).getTime();
      }
      
      // For non-pinned items, maintain original order (by createdAt desc)
      return 0;
    });
  }, []);

  const applyPrivacyFilter = useCallback(
    (list: FeedItem[]) => {
      const filtered = list.filter((item) => {
        // Testimonies are always visible
        if (item.type !== 'REQUEST') return true;
        
        const request = item as LiftRequest;
        
        // Public requests are visible to everyone
        if (!request.isPrivate && request.visibility !== 'PRIVATE' && request.visibility !== 'GROUP') {
          return true;
        }
        
        // Owner can always see their own requests
        if (viewerUid && request.ownerUid === viewerUid) {
          return true;
        }
        
        // Private requests: only owner can see (handled above)
        if (request.visibility === 'PRIVATE' || request.isPrivate) {
          return false;
        }
        
        // Group requests: check if user is member of any of the request's groups
        if (request.visibility === 'GROUP' && request.groupIds?.length) {
          if (!userGroupIds?.length) return false;
          // Check if any of the request's groups match user's groups
          return request.groupIds.some(gid => userGroupIds.includes(gid));
        }
        
        // Default: show public content
        return true;
      });
      
      // Apply pinned sorting
      return sortWithPinnedFirst(filtered);
    },
    [viewerUid, userGroupIds, sortWithPinnedFirst],
  );

  // Load cached data first for instant display
  const loadCachedData = useCallback(async () => {
    try {
      if (mode === 'REQUEST') {
        const cached = await getCachedRequests();
        if (cached.length > 0 && isMounted.current) {
          const hydrated = cached.map(item => ({ ...item, type: 'REQUEST' })) as FeedItem[];
          setItems(applyPrivacyFilter(hydrated));
        }
      } else {
        const cached = await getCachedTestimonies();
        if (cached.length > 0 && isMounted.current) {
          const hydrated = cached.map(item => ({ ...item, type: 'TESTIMONY' })) as FeedItem[];
          setItems(applyPrivacyFilter(hydrated));
        }
      }
    } catch (err) {
      console.warn('[useFeed] Error loading cached data:', err);
    }
  }, [mode, applyPrivacyFilter]);

  // Manual fetch function for when onSnapshot doesn't update properly
  const manualFetch = useCallback(async () => {
    if (!firebaseEnabled || !db) return false;

    try {
      const col = collection(db, mode === 'REQUEST' ? 'requests' : 'testimonies');
      const q = query(col, orderBy('createdAt', 'desc'), limit(40));
      const snapshot = await getDocs(q);
      
      const next = snapshot.docs.map((docSnap) => {
        const data = docSnap.data() as any;
        return {
          ...data,
          id: docSnap.id,
          type: mode,
        } as FeedItem;
      });
      
      const filtered = applyPrivacyFilter(next);
      
      if (isMounted.current) {
        setItems(filtered);
        setIsOffline(false);
        setError(null);
        lastFetchTime.current = Date.now();
      }

      // Cache the data for offline use
      if (mode === 'REQUEST') {
        cacheRequests(filtered as LiftRequest[]);
      } else {
        cacheTestimonies(filtered as Testimony[]);
      }
      
      return true;
    } catch (err: any) {
      console.warn('[useFeed] Manual fetch error:', err);
      if (isMounted.current) {
        setIsOffline(true);
        setError(err.message);
      }
      return false;
    }
  }, [mode, applyPrivacyFilter]);

  // Refresh function to force re-fetch - now does both listener restart AND manual fetch
  const refresh = useCallback(async () => {
    // Debounce: prevent rapid refreshes within 1 second
    const now = Date.now();
    if (now - lastFetchTime.current < 1000) {
      return;
    }
    
    // First, try a manual fetch which is more reliable on problematic devices
    const success = await manualFetch();
    
    // If manual fetch failed, try restarting the listener
    if (!success) {
      setRefreshKey(prev => prev + 1);
    }
  }, [manualFetch]);

  // Track mounted state
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Re-fetch when viewerUid changes (user signs in/out)
  useEffect(() => {
    if (viewerUid !== undefined) {
      // User state changed, trigger a refresh to re-apply privacy filter
      setRefreshKey(prev => prev + 1);
    }
  }, [viewerUid]);

  useEffect(() => {
    let unsub: Unsubscribe | null = null;

    // Load cached data immediately
    loadCachedData();

    if (!firebaseEnabled || !db) {
      setItems(Array.from({ length: 8 }).map(() => generateMockItem(mode)));
      setLoading(false);
      return undefined;
    }

    const col = collection(db, mode === 'REQUEST' ? 'requests' : 'testimonies');
    const q = query(col, orderBy('createdAt', 'desc'), limit(40));
    
    // Set up real-time listener
    unsub = onSnapshot(
      q,
      (snapshot) => {
        if (!isMounted.current) return;
        
        const next = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as any;
          return {
            ...data,
            id: docSnap.id,
            type: mode,
          } as FeedItem;
        });
        const filtered = applyPrivacyFilter(next);
        setItems(filtered);
        setLoading(false);
        setIsOffline(false);
        setError(null);
        lastFetchTime.current = Date.now();

        // Cache the data for offline use
        if (mode === 'REQUEST') {
          cacheRequests(filtered as LiftRequest[]);
        } else {
          cacheTestimonies(filtered as Testimony[]);
        }
      },
      (err) => {
        console.warn('Feed listener error', err);
        if (isMounted.current) {
          setError(err.message);
          setLoading(false);
          setIsOffline(true);
        }
        // Data will be served from cache loaded earlier
      },
    );

    return () => unsub?.();
  }, [mode, loadCachedData, refreshKey, applyPrivacyFilter]);

  return { items, loading, error, isOffline, refresh };
};

export const submitFeedItem = async (
  mode: Mode,
  content: string,
  ownerUid: string | undefined,
  displayName: string | undefined,
  options?: {
    category?: string;
    isUrgent?: boolean;
    linkedRequestId?: string; // For testimonies - link to original prayer request
    isPrivate?: boolean;
    groupIds?: string[];
    visibility?: 'PUBLIC' | 'PRIVATE' | 'GROUP';
    userEmail?: string; // For verified badge display
    userPhotoURL?: string | null; // Profile photo URL
    isAnonymous?: boolean; // For anonymous prayer requests
  }
) => {
  if (!firebaseEnabled || !db) return;
  const col = collection(db, mode === 'REQUEST' ? 'requests' : 'testimonies');
  
  const baseDoc: any = {
    ownerUid: ownerUid || 'anonymous',
    userDisplayName: displayName || 'Anonymous',
    userEmail: options?.userEmail || null,
    userPhotoURL: options?.userPhotoURL || null,
    content,
    severity: mode === 'REQUEST' ? 'PENDING' : 'RESOLVED',
    status: mode === 'REQUEST' ? 'PENDING' : 'RESOLVED',
    createdAt: serverTimestamp(),
    commentCount: 0,
  };

  if (mode === 'REQUEST') {
    baseDoc.prayers = 0;
    baseDoc.category = options?.category || 'other';
    baseDoc.isUrgent = options?.isUrgent || false;
    baseDoc.isPrivate = options?.isPrivate || false;
    baseDoc.isAnonymous = options?.isAnonymous || false;
    baseDoc.visibility = options?.visibility || (options?.isPrivate ? 'PRIVATE' : 'PUBLIC');
    if (options?.groupIds?.length) {
      baseDoc.groupIds = options.groupIds;
      baseDoc.visibility = options.visibility || 'GROUP';
    }
  } else {
    baseDoc.likes = 0;
    if (options?.linkedRequestId) {
      baseDoc.linkedRequestId = options.linkedRequestId;
      // Mark the original request as resolved
      const requestRef = doc(db, 'requests', options.linkedRequestId);
      await updateDoc(requestRef, { 
        status: 'RESOLVED',
        resolvedAt: serverTimestamp(),
      });
    }
  }

  const docRef = await addDoc(col, baseDoc);

  // Update user stats and achievements
  if (ownerUid) {
    if (mode === 'REQUEST') {
      await incrementUserRequestCount(ownerUid);
    } else {
      const testimonyCount = await incrementUserTestimonyCount(ownerUid);
      await checkAndUnlockAchievements(ownerUid, { testimonyCount });
    }
  }

  return docRef.id;
};

export const incrementPrayerCount = async (requestId: string) => {
  if (!firebaseEnabled || !db) return;
  const ref = doc(db, 'requests', requestId);
  await updateDoc(ref, { prayers: increment(1) });
};
