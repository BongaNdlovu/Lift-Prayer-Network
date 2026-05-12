/**
 * useFollowing Hook
 * 
 * Provides real-time following state and actions for the current user.
 * Used to prioritize followed users' posts in the feed.
 */

import { useEffect, useState, useCallback } from 'react';
import {
  subscribeToFollowing,
  subscribeToFollowingUids,
  followUser,
  unfollowUser,
} from '../services/following';
import type { FollowRecord } from '../types';

type UseFollowingOptions = {
  displayName?: string;
  photoURL?: string | null;
};

type UseFollowingResult = {
  /** List of followed users with full details */
  following: FollowRecord[];
  /** List of followed user IDs (for feed filtering) */
  followingUids: string[];
  /** Whether the data is still loading */
  loading: boolean;
  /** Follow a user */
  follow: (targetUid: string, displayName: string, photoURL?: string | null) => Promise<boolean>;
  /** Unfollow a user */
  unfollow: (targetUid: string) => Promise<boolean>;
  /** Check if following a specific user */
  isFollowing: (targetUid: string) => boolean;
  /** Refresh the following list */
  refresh: () => void;
};

export const useFollowing = (uid: string | undefined, options?: UseFollowingOptions): UseFollowingResult => {
  const [following, setFollowing] = useState<FollowRecord[]>([]);
  const [followingUids, setFollowingUids] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // Subscribe to following list
  useEffect(() => {
    if (!uid) {
      setFollowing([]);
      setFollowingUids([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Subscribe to full following list
    const unsubFollowing = subscribeToFollowing(uid, (list) => {
      setFollowing(list);
      setLoading(false);
    });

    // Subscribe to UIDs only (lighter weight for feed filtering)
    const unsubUids = subscribeToFollowingUids(uid, (uids) => {
      setFollowingUids(uids);
    });

    return () => {
      unsubFollowing();
      unsubUids();
    };
  }, [uid, refreshKey]);

  const follow = useCallback(
    async (targetUid: string, displayName: string, photoURL?: string | null): Promise<boolean> => {
      if (!uid) return false;
      const result = await followUser(
        uid, 
        targetUid, 
        displayName, 
        photoURL,
        options?.displayName,
        options?.photoURL
      );
      return result.success;
    },
    [uid, options?.displayName, options?.photoURL]
  );

  const unfollow = useCallback(
    async (targetUid: string): Promise<boolean> => {
      if (!uid) return false;
      const result = await unfollowUser(uid, targetUid);
      return result.success;
    },
    [uid]
  );

  const isFollowing = useCallback(
    (targetUid: string): boolean => {
      return followingUids.includes(targetUid);
    },
    [followingUids]
  );

  const refresh = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  return {
    following,
    followingUids,
    loading,
    follow,
    unfollow,
    isFollowing,
    refresh,
  };
};

/**
 * Lightweight hook that only provides following UIDs for feed filtering
 */
export const useFollowingUids = (uid: string | undefined): string[] => {
  const [followingUids, setFollowingUids] = useState<string[]>([]);

  useEffect(() => {
    if (!uid) {
      setFollowingUids([]);
      return;
    }

    const unsub = subscribeToFollowingUids(uid, setFollowingUids);
    return () => unsub();
  }, [uid]);

  return followingUids;
};
