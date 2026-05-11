/**
 * Analytics Service
 * 
 * Tracks user engagement and app usage patterns.
 * Uses Firebase Analytics in production, console logging in development.
 * 
 * Setup Requirements:
 * 1. Add google-services.json (Android) and GoogleService-Info.plist (iOS) to your project
 * 2. Install: npx expo install @react-native-firebase/app @react-native-firebase/analytics
 * 3. For Expo managed workflow, use expo-firebase-analytics or EAS Build
 * 
 * Current Status: Console logging only (Firebase Analytics requires native setup)
 */

import { Platform } from 'react-native';

// Flag to enable/disable analytics (useful for testing)
const ANALYTICS_ENABLED = !__DEV__;

// Analytics event names
export const AnalyticsEvents = {
  // Authentication
  SIGN_UP: 'sign_up',
  SIGN_IN: 'sign_in',
  SIGN_OUT: 'sign_out',
  
  // Prayer actions
  PRAYER_CREATED: 'prayer_created',
  PRAYER_PRAYED: 'prayer_prayed',
  PRAYER_DELETED: 'prayer_deleted',
  
  // Testimony actions
  TESTIMONY_CREATED: 'testimony_created',
  TESTIMONY_LIKED: 'testimony_liked',
  
  // Social actions
  COMMENT_ADDED: 'comment_added',
  USER_BLOCKED: 'user_blocked',
  CONTENT_REPORTED: 'content_reported',
  
  // Group actions
  GROUP_CREATED: 'group_created',
  GROUP_JOINED: 'group_joined',
  GROUP_LEFT: 'group_left',
  
  // Navigation
  SCREEN_VIEW: 'screen_view',
  
  // Engagement
  NOTIFICATION_OPENED: 'notification_opened',
  SHARE_CLICKED: 'share_clicked',
  DONATION_STARTED: 'donation_started',
} as const;

type EventName = typeof AnalyticsEvents[keyof typeof AnalyticsEvents];
type EventParams = Record<string, string | number | boolean | undefined>;

// Simple in-memory analytics for development
const devAnalytics: { events: { name: string; params?: EventParams; timestamp: Date }[] } = {
  events: [],
};

/**
 * Log an analytics event
 * 
 * In production, this would send to Firebase Analytics.
 * Currently logs to console and stores in memory for debugging.
 */
export const logEvent = async (eventName: EventName, params?: EventParams): Promise<void> => {
  if (!ANALYTICS_ENABLED && !__DEV__) return;
  
  try {
    // Store event for debugging/export
    devAnalytics.events.push({ name: eventName, params, timestamp: new Date() });
    
    // Keep only last 100 events in memory
    if (devAnalytics.events.length > 100) {
      devAnalytics.events = devAnalytics.events.slice(-100);
    }

    if (__DEV__) {
      // In development, log to console for debugging
      console.log(`[Analytics] ${eventName}`, params || '');
      return;
    }

    // Production: Firebase Analytics integration
    // TODO: Uncomment when Firebase Analytics is set up with native modules
    // import analytics from '@react-native-firebase/analytics';
    // await analytics().logEvent(eventName, params);
    
    // For now, we store events that could be batch-sent to a backend
    // This allows analytics to work without native Firebase setup
  } catch (error) {
    // Silent fail - analytics should never break the app
    if (__DEV__) {
      console.warn('[Analytics] Failed to log event:', error);
    }
  }
};

/**
 * Log a screen view
 */
export const logScreenView = async (screenName: string, screenClass?: string): Promise<void> => {
  await logEvent(AnalyticsEvents.SCREEN_VIEW, {
    screen_name: screenName,
    screen_class: screenClass || screenName,
  });
};

/**
 * Set user properties for segmentation
 */
export const setUserProperties = async (properties: Record<string, string | null>): Promise<void> => {
  try {
    if (__DEV__) {
      console.log('[Analytics] Set user properties:', properties);
      return;
    }
    
    // In production, set user properties
    console.log('[Analytics] Set user properties:', properties);
  } catch (error) {
    console.warn('[Analytics] Failed to set user properties:', error);
  }
};

/**
 * Set the user ID for analytics
 */
export const setUserId = async (userId: string | null): Promise<void> => {
  try {
    if (__DEV__) {
      console.log('[Analytics] Set user ID:', userId);
      return;
    }
    
    console.log('[Analytics] Set user ID:', userId);
  } catch (error) {
    console.warn('[Analytics] Failed to set user ID:', error);
  }
};

/**
 * Track prayer creation with category
 */
export const trackPrayerCreated = (category: string, isUrgent: boolean, isPrivate: boolean) => {
  logEvent(AnalyticsEvents.PRAYER_CREATED, {
    category,
    is_urgent: isUrgent,
    is_private: isPrivate,
    platform: Platform.OS,
  });
};

/**
 * Track when someone prays for a request
 */
export const trackPrayerPrayed = (requestId: string, isSelfPrayer: boolean) => {
  logEvent(AnalyticsEvents.PRAYER_PRAYED, {
    request_id: requestId,
    is_self_prayer: isSelfPrayer,
  });
};

/**
 * Track testimony creation
 */
export const trackTestimonyCreated = (linkedToRequest: boolean) => {
  logEvent(AnalyticsEvents.TESTIMONY_CREATED, {
    linked_to_request: linkedToRequest,
  });
};

/**
 * Track sign up method
 */
export const trackSignUp = (method: 'email' | 'google' | 'anonymous') => {
  logEvent(AnalyticsEvents.SIGN_UP, { method });
};

/**
 * Track sign in method
 */
export const trackSignIn = (method: 'email' | 'google' | 'anonymous') => {
  logEvent(AnalyticsEvents.SIGN_IN, { method });
};

/**
 * Get development analytics (for debugging)
 */
export const getDevAnalytics = () => {
  if (__DEV__) {
    return devAnalytics.events;
  }
  return [];
};
