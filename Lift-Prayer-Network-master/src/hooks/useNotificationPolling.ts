/**
 * Hook for polling notifications on devices without Google Play Services
 * This is a fallback for Huawei/HMS devices that can't receive FCM push notifications
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { collection, query, where, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';
import { db, firebaseEnabled } from '../services/firebase';
import { needsNotificationPolling } from '../utils/googlePlayServices';
import { NOTIFICATION_TYPES } from '../types/notifications';

// Polling interval in milliseconds (45 seconds)
const POLLING_INTERVAL = 45000;

// Store the last check time to avoid duplicate notifications
let lastCheckTime: Date | null = null;

type NotificationData = {
  id: string;
  type: string;
  title?: string;
  body?: string;
  createdAt: Timestamp;
};

/**
 * Hook that polls for new notifications when the app is in foreground
 * Only activates on devices without Google Play Services
 */
export const useNotificationPolling = (userId: string | undefined) => {
  const [isPolling, setIsPolling] = useState(false);
  const [needsPolling, setNeedsPolling] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // Check if this device needs polling
  useEffect(() => {
    const checkPollingNeeded = async () => {
      const needs = await needsNotificationPolling();
      setNeedsPolling(needs);
      if (needs) {
        console.log('[NotificationPolling] Device needs polling (no GMS detected)');
      }
    };
    checkPollingNeeded();
  }, []);

  // Fetch new notifications from Firestore
  const checkForNewNotifications = useCallback(async () => {
    if (!userId || !firebaseEnabled || !db) return;

    try {
      const checkTime = lastCheckTime || new Date(Date.now() - POLLING_INTERVAL);
      
      // Query for notifications created after last check
      const notifQuery = query(
        collection(db, 'notifications'),
        where('recipientUid', '==', userId),
        where('read', '==', false),
        where('createdAt', '>', Timestamp.fromDate(checkTime)),
        orderBy('createdAt', 'desc'),
        limit(10)
      );

      const snapshot = await getDocs(notifQuery);
      
      if (!snapshot.empty) {
        const newNotifs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as NotificationData[];

        console.log(`[NotificationPolling] Found ${newNotifs.length} new notification(s)`);

        // Show local notifications for each new notification
        for (const notif of newNotifs) {
          await showLocalNotification(notif);
        }
      }

      // Update last check time
      lastCheckTime = new Date();
    } catch (error) {
      // Silently fail - don't spam console with polling errors
      // This can happen if the query requires an index
    }
  }, [userId]);

  // Show a local notification
  const showLocalNotification = async (notif: NotificationData) => {
    if (Platform.OS === 'web') return;

    try {
      const { title, body } = getNotificationContent(notif);
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: true,
          data: { notificationId: notif.id, type: notif.type },
        },
        trigger: null, // Show immediately
      });
    } catch (error) {
      console.warn('[NotificationPolling] Error showing local notification:', error);
    }
  };

  // Generate notification content based on type
  const getNotificationContent = (notif: NotificationData): { title: string; body: string } => {
    const data = notif as any;
    
    switch (notif.type) {
      case NOTIFICATION_TYPES.PRAYER:
        return {
          title: '🙏 Someone prayed for you!',
          body: data.actorName ? `${data.actorName} prayed for your request` : 'Someone lifted you up in prayer',
        };
      case NOTIFICATION_TYPES.COMMENT:
        return {
          title: '💬 New comment',
          body: data.actorName ? `${data.actorName} commented on your post` : 'You have a new comment',
        };
      case NOTIFICATION_TYPES.AMEN:
        return {
          title: 'Amen!',
          body: data.actorName ? `${data.actorName} said Amen to your testimony` : 'Someone said Amen to your testimony',
        };
      case NOTIFICATION_TYPES.GROUP_JOIN:
        return {
          title: '✅ Group request approved!',
          body: data.groupName ? `You've been accepted into "${data.groupName}"` : 'Your group request was approved',
        };
      case NOTIFICATION_TYPES.GROUP_INVITE:
        return {
          title: 'New group activity',
          body: data.groupName ? `There's a new update in "${data.groupName}"` : 'There is a new group update',
        };
      default:
        return {
          title: '🔔 New notification',
          body: 'You have a new update in Lift',
        };
    }
  };

  // Start polling
  const startPolling = useCallback(() => {
    if (intervalRef.current) return; // Already polling
    
    console.log('[NotificationPolling] Starting polling...');
    setIsPolling(true);
    
    // Initial check
    checkForNewNotifications();
    
    // Set up interval
    intervalRef.current = setInterval(() => {
      if (appStateRef.current === 'active') {
        checkForNewNotifications();
      }
    }, POLLING_INTERVAL);
  }, [checkForNewNotifications]);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      console.log('[NotificationPolling] Stopping polling...');
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      setIsPolling(false);
    }
  }, []);

  // Handle app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      appStateRef.current = nextAppState;
      
      if (nextAppState === 'active' && needsPolling && userId) {
        // App came to foreground - do an immediate check
        checkForNewNotifications();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [needsPolling, userId, checkForNewNotifications]);

  // Start/stop polling based on conditions
  useEffect(() => {
    if (needsPolling && userId) {
      startPolling();
    } else {
      stopPolling();
    }

    return () => {
      stopPolling();
    };
  }, [needsPolling, userId, startPolling, stopPolling]);

  return {
    isPolling,
    needsPolling,
    checkNow: checkForNewNotifications,
  };
};
