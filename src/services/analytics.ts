/**
 * Analytics Service
 * 
 * Tracks user engagement and app usage patterns.
 * Uses Firebase Analytics when available.
 */

import { Platform } from 'react-native';

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
const devAnalytics: { events: Array<{ name: string; params?: EventParams; timestamp: Date }> } = {
  events: [],
};

/**
 * Log an analytics event
 */
export const logEvent = async (eventName: EventName, params?: EventParams): Promise<void> => {
  try {
    if (__DEV__) {
      // In development, just log to console
      console.log(`[Analytics] ${eventName}`, params || '');
      devAnalytics.events.push({ name: eventName, params, timestamp: new Date() });
      return;
    }

    // In production, you would use Firebase Analytics
    // For now, we'll just log - Firebase Analytics requires native modules
    // which are set up through google-services.json
    console.log(`[Analytics] ${eventName}`, params || '');
  } catch (error) {
    console.warn('[Analytics] Failed to log event:', error);
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
