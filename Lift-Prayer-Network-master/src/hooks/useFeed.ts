import { useEffect, useState, useCallback, useRef } from 'react';
import {
  collection,
  limit,
  orderBy,
  query,
  serverTimestamp,
  addDoc,
  updateDoc,
  doc,
  increment,
  getDocs,
  startAfter,
  where,
  type QueryDocumentSnapshot,
  type DocumentData,
  type QueryConstraint,
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
import { FEED_PAGE_SIZE } from '../config/queryLimits';
import { logFirestoreRead } from '../utils/readBudget';
import { sanitizeForFirestore } from '../utils/security';
import type { FeedItem, LiftRequest, Testimony } from '../types';

type Mode = 'REQUEST' | 'TESTIMONY';

const generateMockItem = (mode: Mode): FeedItem => {
  const base = {
    id: Math.random().toString(36).slice(2),
    ownerUid: 'mock',
    userDisplayName: 'Anonymous',
    location: '',
    content:
      mode === 'REQUEST'
        ? 'Please pray for this request.'
        : 'Thank you for your prayers.',
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

type UserProfileOverride = {
  displayName?: string | null;
  photoURL?: string | null;
};

export const useFeed = (
  mode: Mode,
  viewerUid?: string,
  userGroupIds?: string[],
  followingUids?: string[],
  currentUserProfile?: UserProfileOverride
) => {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<FeedErrorType>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [refreshKey] = useState(0);
  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const isMounted = useRef(true);
  const lastFetchTime = useRef<number>(0);
  
  // Track viewerUid changes to re-filter when user signs in
  const viewerUidRef = useRef(viewerUid);
  viewerUidRef.current = viewerUid;

  // Load blocked users list
  useEffect(() => {
    getBlockedUsers().then(setBlockedUsers);
  }, [viewerUid]);
  
  // Apply current user's profile data to their own posts (for instant profile updates)
  const applyCurrentUserProfile = useCallback((list: FeedItem[]): FeedItem[] => {
    if (!viewerUid || !currentUserProfile) return list;
    
    return list.map((item) => {
      // Only override for current user's non-anonymous posts
      if (item.ownerUid === viewerUid && !(item as any).isAnonymous) {
        return {
          ...item,
          userDisplayName: currentUserProfile.displayName || item.userDisplayName,
          userPhotoURL: currentUserProfile.photoURL ?? (item as any).userPhotoURL,
        };
      }
      return item;
    });
  }, [viewerUid, currentUserProfile]);

  // Sort function to put pinned items first, then followed users, then by date
  const sortWithPriority = useCallback((list: FeedItem[]) => {
    return [...list].sort((a, b) => {
      // 1. Pinned items come first (requests only)
      const aIsPinned = a.type === 'REQUEST' && (a as LiftRequest).isPinned;
      const bIsPinned = b.type === 'REQUEST' && (b as LiftRequest).isPinned;
      
      if (aIsPinned && !bIsPinned) return -1;
      if (!aIsPinned && bIsPinned) return 1;
      
      // If both pinned, sort by pinnedAt
      if (aIsPinned && bIsPinned) {
        const aPinnedAt = (a as any).pinnedAt?.toDate?.() || (a as any).pinnedAt || 0;
        const bPinnedAt = (b as any).pinnedAt?.toDate?.() || (b as any).pinnedAt || 0;
        return new Date(bPinnedAt).getTime() - new Date(aPinnedAt).getTime();
      }
      
      // 2. Followed users' posts come second
      const aIsFollowed = followingUids?.includes(a.ownerUid) ?? false;
      const bIsFollowed = followingUids?.includes(b.ownerUid) ?? false;
      
      if (aIsFollowed && !bIsFollowed) return -1;
      if (!aIsFollowed && bIsFollowed) return 1;
      
      // 3. Within same tier, sort by createdAt desc (newest first)
      const aTime = (a as any).createdAt?.toDate?.() || (a as any).createdAt || 0;
      const bTime = (b as any).createdAt?.toDate?.() || (b as any).createdAt || 0;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });
  }, [followingUids]);

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
      
      // Apply current user's profile data to their own posts
      const withProfileUpdates = applyCurrentUserProfile(filtered);
      
      // Apply priority sorting (pinned first, then followed users, then by date)
      return sortWithPriority(withProfileUpdates);
    },
    [viewerUid, userGroupIds, blockedUsers, sortWithPriority, applyCurrentUserProfile],
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
  const buildFeedQuery = useCallback((startAfterCursor?: QueryDocumentSnapshot<DocumentData>) => {
    if (!db) return null;

    const col = collection(db, mode === 'REQUEST' ? 'requests' : 'testimonies');
    const constraints: QueryConstraint[] = [
      where('visibility', '==', 'PUBLIC'),
      orderBy('createdAt', 'desc'),
    ];

    if (startAfterCursor) {
      constraints.push(startAfter(startAfterCursor));
    }

    constraints.push(limit(FEED_PAGE_SIZE));

    return query(col, ...constraints);
  }, [mode]);

  // Manual fetch function with pagination
  const manualFetch = useCallback(async (append: boolean = false) => {
    if (!firebaseEnabled || !db) return false;

    try {
      const q = buildFeedQuery(append ? cursor ?? undefined : undefined);
      if (!q) return false;

      const snapshot = await getDocs(q);
      logFirestoreRead(`useFeed.${mode}.manualFetch`, snapshot.size);

      const docs = snapshot.docs.map((docSnap) => {
        const data = docSnap.data() as any;
        return {
          ...data,
          id: docSnap.id,
          type: mode,
        } as FeedItem;
      });

      const filtered = applyPrivacyFilter(docs);

      if (isMounted.current) {
        if (append) {
          setItems((prev) => [...prev, ...filtered]);
        } else {
          setItems(filtered);
        }

        setIsOffline(false);
        setError(null);
        setErrorType(null);
        lastFetchTime.current = Date.now();
        setCursor(snapshot.docs[snapshot.docs.length - 1] || null);
        setHasMore(snapshot.size === FEED_PAGE_SIZE);
      }

      if (!append) {
        if (mode === 'REQUEST') {
          cacheRequests(filtered as LiftRequest[]);
        } else {
          cacheTestimonies(filtered as Testimony[]);
        }
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
  }, [mode, buildFeedQuery, applyPrivacyFilter, cursor]);

  // Refresh function to force re-fetch
  const refresh = useCallback(async () => {
    const now = Date.now();
    if (now - lastFetchTime.current < 1000) {
      return;
    }

    setCursor(null);
    setHasMore(true);
    setLoading(true);
    await manualFetch(false);
  }, [manualFetch]);

  // Load more function for pagination
  const loadMore = useCallback(async () => {
    if (!hasMore || loading) return;
    setLoading(true);
    await manualFetch(true);
  }, [hasMore, loading, manualFetch]);

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
      refresh();
    }
  }, [viewerUid, refresh]);

  // Initial data fetch
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await loadCachedData();

      if (!firebaseEnabled || !db) {
        if (__DEV__) {
          setItems(Array.from({ length: 8 }).map(() => generateMockItem(mode)));
        } else {
          setItems([]);
        }
        setLoading(false);
        return;
      }

      await manualFetch(false);
    };

    fetchData();
  }, [mode, refreshKey, manualFetch, loadCachedData]);

  return { items, loading, error, errorType, isOffline, refresh, loadMore, hasMore };
};

export const submitFeedItem = async (
  mode: Mode,
  content: string,
  ownerUid: string,
  displayName: string | undefined,
  options?: {
    category?: string;
    title?: string;
    supportPreference?: string;
    isUrgent?: boolean;
    linkedRequestId?: string; // For testimonies - link to original prayer request
    isPrivate?: boolean;
    groupIds?: string[];
    visibility?: 'PUBLIC' | 'PRIVATE' | 'GROUP';
    userEmail?: string; // For verified badge display
    userPhotoURL?: string | null; // Profile photo URL
    isAnonymous?: boolean; // For anonymous prayer requests
    isShareable?: boolean; // Allow sharing outside the app
    isEmailVerified?: boolean; // User's email verification status
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
    isEmailVerified: options?.isAnonymous ? false : (options?.isEmailVerified || false),
    content,
    severity: mode === 'REQUEST' ? 'PENDING' : 'RESOLVED',
    status: mode === 'REQUEST' ? 'PENDING' : 'RESOLVED',
    createdAt: serverTimestamp(),
    commentCount: 0,
  };

  if (mode === 'REQUEST') {
    baseDoc.prayers = 0;
    baseDoc.title = options?.title || content.slice(0, 80);
    baseDoc.category = options?.category || 'other';
    baseDoc.supportPreference = options?.supportPreference || 'ENCOURAGEMENT_WELCOME';
    baseDoc.isUrgent = options?.isUrgent || false;
    baseDoc.isPrivate = options?.isPrivate || false;
    baseDoc.isAnonymous = options?.isAnonymous || false;
    baseDoc.isShareable = options?.isShareable !== false; // Default to true
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

  const sanitizedDoc = sanitizeForFirestore(baseDoc);
  const docRef = await addDoc(col, sanitizedDoc);

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
