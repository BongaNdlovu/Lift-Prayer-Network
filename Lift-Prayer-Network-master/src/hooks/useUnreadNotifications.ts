import { useEffect, useState, useCallback } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db, firebaseEnabled } from '../services/firebase';
import { useAuth } from './useAuth';

/**
 * Hook to track unread notification count in real-time
 * Returns the count and a refresh function
 */
export const useUnreadNotifications = () => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !firebaseEnabled || !db) {
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    // Real-time listener for unread notifications
    const notificationsRef = collection(db, 'notifications');
    const q = query(
      notificationsRef,
      where('recipientUid', '==', user.uid),
      where('read', '==', false)
    );

    const unsubscribe: Unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setUnreadCount(snapshot.size);
        setLoading(false);
      },
      (error) => {
        console.error('[useUnreadNotifications] Error:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const refresh = useCallback(() => {
    // The real-time listener handles updates automatically
    // This is here for manual refresh if needed
  }, []);

  return { unreadCount, loading, refresh };
};

export default useUnreadNotifications;
