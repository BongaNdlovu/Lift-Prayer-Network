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
import { getBlockedUsers } from '../services/moderation';
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

export type FeedErrorType = 'network' | 'permission' | 'unknown' | null;

// Helper to classify Firestore errors
const classifyError = (err: any): FeedErrorType => {
  const code = err?.code || '';
  const message = (err?.message || '').toLowerCase();
  
  // Permission denied errors
  if (code === 'permission-denied' || message.includes('permission') || message.includes('unauthorized')) {
    return 'permission';
  }
  
  // Network/offline errors
  if (
    code === 'unavailable' ||
    code === 'failed-precondition' ||
    message.includes('network') ||
    message.includes('offline') ||
    message.includes('internet') ||
    message.includes('connection')
  ) {
    return 'network';
  }
  
  return 'unknown';
};

export const useFeed = (mode: Mode, viewerUid?: string, userGroupIds?: string[]) => {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<FeedErrorType>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);
  const isMounted = useRef(true);
  const lastFetchTime = useRef<number>(0);
  
  // Track viewerUid changes to re-filter when user signs in
  const viewerUidRef = useRef(viewerUid);
  viewerUidRef.current = viewerUid;

  // Load blocked users list
  useEffect(() => {
    getBlockedUsers().then(setBlockedUsers);
  }, [viewerUid]);

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
        // Get common privacy fields (both requests and testimonies now support privacy)
        const ownerUid = item.ownerUid;
        const isPrivate = (item as any).isPrivate;
        const visibility = (item as any).visibility;
        const groupIds = (item as any).groupIds;
        
        // Filter out posts from blocked users
        if (blockedUsers.includes(ownerUid)) {
          return false;
        }
        
        // Public items are visible to everyone
        // An item is public if: visibility is PUBLIC, OR visibility is not set AND isPrivate is not true
        if (visibility === 'PUBLIC' || (!visibility && !isPrivate)) {
          return true;
        }
        
        // Owner can always see their own content
        if (viewerUid && ownerUid === viewerUid) {
          return true;
        }
        
        // Private items: only owner can see (handled above)
        if (visibility === 'PRIVATE' || isPrivate) {
          return false;
        }
        
        // Group items: check if user is member of any of the item's groups
        if (visibility === 'GROUP' && groupIds?.length) {
          if (!userGroupIds?.length) return false;
          // Check if any of the item's groups match user's groups
          return groupIds.some((gid: string) => userGroupIds.includes(gid));
        }
        
        // Default: show public content
        return true;
      });
      
      // Apply pinned sorting
      return sortWithPinnedFirst(filtered);
    },
    [viewerUid, userGroupIds, blockedUsers, sortWithPinnedFirst],
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

  // Build queries that match Firestore security rules
  // Strategy: Simple broad query - Firestore rules handle access control
  // Legacy posts without visibility field are treated as PUBLIC by rules
  const buildFeedQueries = useCallback(() => {
    if (!db) return [];
    
    const col = collection(db, mode === 'REQUEST' ? 'requests' : 'testimonies');
    
    // Simple query without visibility filter
    // Firestore rules use: isPublicRequest(data) which returns true if:
    //   visibility == 'PUBLIC' OR (visibility == null AND isPrivate != true)
    // This handles legacy posts correctly
    // 
    // If query fails due to permission on private/group posts, we'll catch it
    // and fall back to cached data
    return [query(col, orderBy('createdAt', 'desc'), limit(50))];
  }, [mode]);

  // Manual fetch function for when onSnapshot doesn't update properly
  const manualFetch = useCallback(async () => {
    if (!firebaseEnabled || !db) return false;

    try {
      const queries = buildFeedQueries();
      if (queries.length === 0) return false;
      
      // Execute all queries in parallel
      const snapshots = await Promise.all(queries.map(q => getDocs(q)));
      
      // Merge results and deduplicate by id
      const seenIds = new Set<string>();
      const allDocs: FeedItem[] = [];
      
      for (const snapshot of snapshots) {
        for (const docSnap of snapshot.docs) {
          if (seenIds.has(docSnap.id)) continue;
          seenIds.add(docSnap.id);
          
          const data = docSnap.data() as any;
          allDocs.push({
            ...data,
            id: docSnap.id,
            type: mode,
          } as FeedItem);
        }
      }
      
      // Sort by createdAt desc and apply privacy filter
      allDocs.sort((a, b) => {
        const aTime = (a as any).createdAt?.toDate?.() || (a as any).createdAt || 0;
        const bTime = (b as any).createdAt?.toDate?.() || (b as any).createdAt || 0;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      });
      
      const filtered = applyPrivacyFilter(allDocs.slice(0, 40));
      
      if (isMounted.current) {
        setItems(filtered);
        setIsOffline(false);
        setError(null);
        setErrorType(null);
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
      const errType = classifyError(err);
      if (isMounted.current) {
        setIsOffline(errType === 'network');
        setError(err.message);
        setErrorType(errType);
      }
      return false;
    }
  }, [mode, buildFeedQueries, applyPrivacyFilter]);

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
    const unsubscribers: Unsubscribe[] = [];
    
    // Track results from multiple queries for merging
    const queryResults = new Map<number, FeedItem[]>();
    let hasReceivedData = false;

    // Merge results from all queries, deduplicate, sort, and update state
    const mergeAndUpdateResults = () => {
      if (!isMounted.current) return;
      
      const seenIds = new Set<string>();
      const allDocs: FeedItem[] = [];
      
      for (const docs of queryResults.values()) {
        for (const doc of docs) {
          if (seenIds.has(doc.id)) continue;
          seenIds.add(doc.id);
          allDocs.push(doc);
        }
      }
      
      // Sort by createdAt desc
      allDocs.sort((a, b) => {
        const aTime = (a as any).createdAt?.toDate?.() || (a as any).createdAt || 0;
        const bTime = (b as any).createdAt?.toDate?.() || (b as any).createdAt || 0;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      });
      
      const filtered = applyPrivacyFilter(allDocs.slice(0, 40));
      setItems(filtered);
      setLoading(false);
      setIsOffline(false);
      setError(null);
      setErrorType(null);
      lastFetchTime.current = Date.now();

      // Cache the data for offline use
      if (mode === 'REQUEST') {
        cacheRequests(filtered as LiftRequest[]);
      } else {
        cacheTestimonies(filtered as Testimony[]);
      }
    };

    // Load cached data immediately
    loadCachedData();

    if (!firebaseEnabled || !db) {
      setItems(Array.from({ length: 8 }).map(() => generateMockItem(mode)));
      setLoading(false);
      return undefined;
    }

    const queries = buildFeedQueries();
    
    // Set up real-time listeners for each query
    queries.forEach((q, index) => {
      const unsub = onSnapshot(
        q,
        (snapshot) => {
          if (!isMounted.current) return;
          
          const docs = snapshot.docs.map((docSnap) => {
            const data = docSnap.data() as any;
            return {
              ...data,
              id: docSnap.id,
              type: mode,
            } as FeedItem;
          });
          
          queryResults.set(index, docs);
          hasReceivedData = true;
          mergeAndUpdateResults();
        },
        (err) => {
          console.warn(`Feed listener ${index} error:`, err);
          const errType = classifyError(err);
          // Only set error state if no query has succeeded yet
          if (!hasReceivedData && isMounted.current) {
            setError(err.message);
            setErrorType(errType);
            setLoading(false);
            setIsOffline(errType === 'network');
          }
          // Data will be served from cache loaded earlier
        },
      );
      unsubscribers.push(unsub);
    });

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [mode, loadCachedData, refreshKey, applyPrivacyFilter, buildFeedQueries]);

  return { items, loading, error, errorType, isOffline, refresh };
};

export const submitFeedItem = async (
  mode: Mode,
  content: string,
  ownerUid: string,
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
  if (!ownerUid) {
    throw new Error('Authentication required to create content');
  }
  if (!firebaseEnabled || !db) return;
  const col = collection(db, mode === 'REQUEST' ? 'requests' : 'testimonies');
  
  const baseDoc: any = {
    ownerUid,
    userDisplayName: options?.isAnonymous ? 'Anonymous' : (displayName || 'Anonymous'),
    userEmail: options?.isAnonymous ? null : (options?.userEmail || null),
    userPhotoURL: options?.isAnonymous ? null : (options?.userPhotoURL || null),
    isAnonymous: options?.isAnonymous || false,
    // Store real info for admin visibility on anonymous posts
    ...(options?.isAnonymous && {
      _realDisplayName: displayName || 'Unknown',
      _realEmail: options?.userEmail || null,
    }),
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
    // Testimonies now support privacy options
    baseDoc.isPrivate = options?.isPrivate || false;
    baseDoc.visibility = options?.visibility || (options?.isPrivate ? 'PRIVATE' : 'PUBLIC');
    if (options?.groupIds?.length) {
      baseDoc.groupIds = options.groupIds;
      baseDoc.visibility = options.visibility || 'GROUP';
    }
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
  if (mode === 'REQUEST') {
    await incrementUserRequestCount(ownerUid);
  } else {
    const testimonyCount = await incrementUserTestimonyCount(ownerUid);
    await checkAndUnlockAchievements(ownerUid, { testimonyCount });
  }

  return docRef.id;
};

export const incrementPrayerCount = async (requestId: string) => {
  if (!firebaseEnabled || !db) return;
  const ref = doc(db, 'requests', requestId);
  await updateDoc(ref, { prayers: increment(1) });
};
