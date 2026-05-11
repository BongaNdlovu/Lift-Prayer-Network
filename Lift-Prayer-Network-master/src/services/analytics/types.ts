/**
 * Analytics Types & Event Schema
 * 
 * Versioned event definitions for consistent analytics tracking.
 * All events follow a strict schema for data quality.
 */

// Schema version - increment when making breaking changes
export const ANALYTICS_SCHEMA_VERSION = '1.0.0';

// ============================================================================
// Event Categories
// ============================================================================

export type EventCategory = 
  | 'auth'
  | 'prayer'
  | 'testimony'
  | 'social'
  | 'group'
  | 'navigation'
  | 'engagement'
  | 'error'
  | 'performance';

// ============================================================================
// Base Event Types
// ============================================================================

export interface BaseEventParams {
  /** Schema version for backwards compatibility */
  schema_version: string;
  /** Event timestamp (ISO string) */
  timestamp: string;
  /** Platform (ios/android/web) */
  platform: string;
  /** App version */
  app_version?: string;
  /** User ID (if authenticated) */
  user_id?: string;
  /** Session ID for grouping events */
  session_id?: string;
}

export interface AnalyticsEvent<T extends Record<string, any> = Record<string, any>> {
  name: string;
  category: EventCategory;
  params: T & Partial<BaseEventParams>;
}

// ============================================================================
// Authentication Events
// ============================================================================

export interface SignUpEventParams {
  method: 'email' | 'google' | 'apple' | 'anonymous';
  has_display_name: boolean;
}

export interface SignInEventParams {
  method: 'email' | 'google' | 'apple' | 'anonymous';
  is_returning_user: boolean;
}

export interface SignOutEventParams {
  session_duration_seconds?: number;
}

// ============================================================================
// Prayer Events
// ============================================================================

export interface PrayerCreatedEventParams {
  category: string;
  is_urgent: boolean;
  is_private: boolean;
  is_anonymous: boolean;
  content_length: number;
  has_group: boolean;
  group_id?: string;
}

export interface PrayerPrayedEventParams {
  request_id: string;
  request_owner_id: string;
  is_first_prayer: boolean;
  prayer_count_before: number;
}

export interface PrayerReactionEventParams {
  request_id: string;
  reaction_type: 'heart' | 'fire' | 'strong';
  is_adding: boolean;
}

export interface PrayerDeletedEventParams {
  request_id: string;
  prayer_count: number;
  age_hours: number;
  deleted_by: 'owner' | 'admin' | 'moderator';
}

// ============================================================================
// Testimony Events
// ============================================================================

export interface TestimonyCreatedEventParams {
  linked_request_id?: string;
  has_linked_request: boolean;
  content_length: number;
  is_anonymous: boolean;
}

export interface TestimonyLikedEventParams {
  testimony_id: string;
  is_adding: boolean;
  like_count_before: number;
}

// ============================================================================
// Social Events
// ============================================================================

export interface CommentAddedEventParams {
  parent_type: 'REQUEST' | 'TESTIMONY';
  parent_id: string;
  content_length: number;
  comment_count_before: number;
}

export interface ContentReportedEventParams {
  target_type: 'user' | 'request' | 'testimony' | 'comment';
  target_id: string;
  reason: string;
}

export interface UserBlockedEventParams {
  blocked_user_id: string;
  block_type: 'personal' | 'posting' | 'app_ban';
}

// ============================================================================
// Group Events
// ============================================================================

export interface GroupCreatedEventParams {
  is_private: boolean;
  has_description: boolean;
}

export interface GroupJoinedEventParams {
  group_id: string;
  join_method: 'invite_code' | 'direct' | 'search';
  is_private: boolean;
  member_count_before: number;
}

export interface GroupLeftEventParams {
  group_id: string;
  membership_duration_days: number;
}

// ============================================================================
// Navigation Events
// ============================================================================

export interface ScreenViewEventParams {
  screen_name: string;
  screen_class: string;
  previous_screen?: string;
  time_on_previous_screen_ms?: number;
}

// ============================================================================
// Engagement Events
// ============================================================================

export interface NotificationOpenedEventParams {
  notification_type: string;
  notification_id?: string;
  time_to_open_seconds?: number;
}

export interface ShareClickedEventParams {
  content_type: 'request' | 'testimony' | 'app';
  content_id?: string;
  share_method?: string;
}

export interface DonationStartedEventParams {
  source_screen: string;
}

// ============================================================================
// Error Events
// ============================================================================

export interface ErrorEventParams {
  error_type: 'network' | 'auth' | 'permission' | 'validation' | 'unknown';
  error_message: string;
  error_code?: string;
  screen_name?: string;
  action?: string;
  is_fatal: boolean;
}

// ============================================================================
// Performance Events
// ============================================================================

export interface PerformanceEventParams {
  metric_name: string;
  value_ms: number;
  screen_name?: string;
  success: boolean;
}

export interface AppStartEventParams {
  cold_start: boolean;
  time_to_interactive_ms: number;
  time_to_first_content_ms?: number;
}

// ============================================================================
// Event Names (Type-safe)
// ============================================================================

export const AnalyticsEventNames = {
  // Auth
  SIGN_UP: 'sign_up',
  SIGN_IN: 'sign_in',
  SIGN_OUT: 'sign_out',
  
  // Prayer
  PRAYER_CREATED: 'prayer_created',
  PRAYER_PRAYED: 'prayer_prayed',
  PRAYER_REACTION: 'prayer_reaction',
  PRAYER_DELETED: 'prayer_deleted',
  
  // Testimony
  TESTIMONY_CREATED: 'testimony_created',
  TESTIMONY_LIKED: 'testimony_liked',
  
  // Social
  COMMENT_ADDED: 'comment_added',
  CONTENT_REPORTED: 'content_reported',
  USER_BLOCKED: 'user_blocked',
  
  // Group
  GROUP_CREATED: 'group_created',
  GROUP_JOINED: 'group_joined',
  GROUP_LEFT: 'group_left',
  
  // Navigation
  SCREEN_VIEW: 'screen_view',
  
  // Engagement
  NOTIFICATION_OPENED: 'notification_opened',
  SHARE_CLICKED: 'share_clicked',
  DONATION_STARTED: 'donation_started',
  
  // Error
  ERROR: 'error',
  
  // Performance
  PERFORMANCE: 'performance',
  APP_START: 'app_start',
} as const;

export type AnalyticsEventName = typeof AnalyticsEventNames[keyof typeof AnalyticsEventNames];

// ============================================================================
// Event Queue Types
// ============================================================================

export interface QueuedEvent {
  id: string;
  event: AnalyticsEvent;
  attempts: number;
  lastAttempt?: string;
  nextRetry?: string;
  createdAt: string;
}

export interface AnalyticsConfig {
  /** Enable/disable analytics */
  enabled: boolean;
  /** Enable debug logging */
  debug: boolean;
  /** Max events to queue before dropping oldest */
  maxQueueSize: number;
  /** Max retry attempts for failed events */
  maxRetries: number;
  /** Base delay for exponential backoff (ms) */
  baseRetryDelay: number;
  /** Batch size for sending events */
  batchSize: number;
  /** Flush interval (ms) */
  flushInterval: number;
}

export const DEFAULT_ANALYTICS_CONFIG: AnalyticsConfig = {
  enabled: true,
  debug: __DEV__,
  maxQueueSize: 500,
  maxRetries: 3,
  baseRetryDelay: 1000,
  batchSize: 20,
  flushInterval: 30000, // 30 seconds
};
