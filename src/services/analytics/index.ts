/**
 * Analytics Service
 * 
 * Unified analytics interface with:
 * - Versioned event schema
 * - Multiple provider support (Console, Firebase, Firestore)
 * - Offline queue with exponential backoff
 * - Type-safe event tracking
 * 
 * Usage:
 * ```ts
 * import { Analytics } from '@/services/analytics';
 * 
 * // Track events
 * Analytics.trackPrayerCreated({ category: 'health', isUrgent: true, ... });
 * Analytics.trackScreenView('FeedScreen');
 * 
 * // Set user context
 * Analytics.setUserId('user123');
 * Analytics.setUserProperties({ subscription: 'premium' });
 * ```
 */

import { Platform } from 'react-native';
import {
  AnalyticsEvent,
  AnalyticsEventNames,
  AnalyticsEventName,
  EventCategory,
  ANALYTICS_SCHEMA_VERSION,
  // Event param types
  SignUpEventParams,
  SignInEventParams,
  SignOutEventParams,
  PrayerCreatedEventParams,
  PrayerPrayedEventParams,
  PrayerReactionEventParams,
  PrayerDeletedEventParams,
  TestimonyCreatedEventParams,
  TestimonyLikedEventParams,
  CommentAddedEventParams,
  ContentReportedEventParams,
  UserBlockedEventParams,
  GroupCreatedEventParams,
  GroupJoinedEventParams,
  GroupLeftEventParams,
  ScreenViewEventParams,
  NotificationOpenedEventParams,
  ShareClickedEventParams,
  DonationStartedEventParams,
  ErrorEventParams,
  PerformanceEventParams,
  AppStartEventParams,
  DEFAULT_ANALYTICS_CONFIG,
} from './types';

import {
  AnalyticsProvider,
  AnalyticsQueueManager,
  ConsoleAnalyticsProvider,
  NoOpAnalyticsProvider,
  createAnalyticsProvider,
} from './adapter';

// ============================================================================
// Analytics Manager
// ============================================================================

class AnalyticsManager {
  private queueManager: AnalyticsQueueManager | null = null;
  private userId: string | null = null;
  private sessionId: string;
  private userProperties: Record<string, string | null> = {};
  private initialized = false;
  private config = DEFAULT_ANALYTICS_CONFIG;
  private currentScreen: string | null = null;
  private screenStartTime: number | null = null;

  constructor() {
    // Generate session ID
    this.sessionId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Initialize analytics with the specified provider
   */
  async initialize(providerType: 'console' | 'firebase' | 'firestore' | 'noop' = 'console'): Promise<void> {
    if (this.initialized) return;

    // Use no-op in development unless explicitly enabled
    const effectiveProvider = __DEV__ && providerType !== 'console' 
      ? 'console' 
      : providerType;

    const provider = createAnalyticsProvider(effectiveProvider);
    
    this.queueManager = new AnalyticsQueueManager(provider, {
      debug: __DEV__,
      enabled: this.config.enabled,
    });

    await this.queueManager.initialize();
    this.initialized = true;

    if (__DEV__) {
      console.log('[Analytics] Initialized with provider:', effectiveProvider);
    }
  }

  /**
   * Set the current user ID
   */
  async setUserId(userId: string | null): Promise<void> {
    this.userId = userId;
    
    if (this.queueManager) {
      // Log user identification event
      if (userId) {
        await this.logEvent('user_identified', 'auth', { user_id: userId });
      }
    }
  }

  /**
   * Set user properties for segmentation
   */
  async setUserProperties(properties: Record<string, string | null>): Promise<void> {
    this.userProperties = { ...this.userProperties, ...properties };
  }

  /**
   * Core event logging method
   */
  private async logEvent(
    name: string,
    category: EventCategory,
    params: Record<string, any> = {}
  ): Promise<void> {
    if (!this.initialized || !this.queueManager) {
      if (__DEV__) {
        console.warn('[Analytics] Not initialized. Call Analytics.initialize() first.');
      }
      return;
    }

    const event: AnalyticsEvent = {
      name,
      category,
      params: {
        ...params,
        schema_version: ANALYTICS_SCHEMA_VERSION,
        timestamp: new Date().toISOString(),
        platform: Platform.OS,
        user_id: this.userId || undefined,
        session_id: this.sessionId,
      },
    };

    await this.queueManager.enqueue(event);
  }

  // ==========================================================================
  // Authentication Events
  // ==========================================================================

  async trackSignUp(params: SignUpEventParams): Promise<void> {
    await this.logEvent(AnalyticsEventNames.SIGN_UP, 'auth', params);
  }

  async trackSignIn(params: SignInEventParams): Promise<void> {
    await this.logEvent(AnalyticsEventNames.SIGN_IN, 'auth', params);
  }

  async trackSignOut(params?: SignOutEventParams): Promise<void> {
    await this.logEvent(AnalyticsEventNames.SIGN_OUT, 'auth', params || {});
  }

  // ==========================================================================
  // Prayer Events
  // ==========================================================================

  async trackPrayerCreated(params: PrayerCreatedEventParams): Promise<void> {
    await this.logEvent(AnalyticsEventNames.PRAYER_CREATED, 'prayer', params);
  }

  async trackPrayerPrayed(params: PrayerPrayedEventParams): Promise<void> {
    await this.logEvent(AnalyticsEventNames.PRAYER_PRAYED, 'prayer', params);
  }

  async trackPrayerReaction(params: PrayerReactionEventParams): Promise<void> {
    await this.logEvent(AnalyticsEventNames.PRAYER_REACTION, 'prayer', params);
  }

  async trackPrayerDeleted(params: PrayerDeletedEventParams): Promise<void> {
    await this.logEvent(AnalyticsEventNames.PRAYER_DELETED, 'prayer', params);
  }

  // ==========================================================================
  // Testimony Events
  // ==========================================================================

  async trackTestimonyCreated(params: TestimonyCreatedEventParams): Promise<void> {
    await this.logEvent(AnalyticsEventNames.TESTIMONY_CREATED, 'testimony', params);
  }

  async trackTestimonyLiked(params: TestimonyLikedEventParams): Promise<void> {
    await this.logEvent(AnalyticsEventNames.TESTIMONY_LIKED, 'testimony', params);
  }

  // ==========================================================================
  // Social Events
  // ==========================================================================

  async trackCommentAdded(params: CommentAddedEventParams): Promise<void> {
    await this.logEvent(AnalyticsEventNames.COMMENT_ADDED, 'social', params);
  }

  async trackContentReported(params: ContentReportedEventParams): Promise<void> {
    await this.logEvent(AnalyticsEventNames.CONTENT_REPORTED, 'social', params);
  }

  async trackUserBlocked(params: UserBlockedEventParams): Promise<void> {
    await this.logEvent(AnalyticsEventNames.USER_BLOCKED, 'social', params);
  }

  // ==========================================================================
  // Group Events
  // ==========================================================================

  async trackGroupCreated(params: GroupCreatedEventParams): Promise<void> {
    await this.logEvent(AnalyticsEventNames.GROUP_CREATED, 'group', params);
  }

  async trackGroupJoined(params: GroupJoinedEventParams): Promise<void> {
    await this.logEvent(AnalyticsEventNames.GROUP_JOINED, 'group', params);
  }

  async trackGroupLeft(params: GroupLeftEventParams): Promise<void> {
    await this.logEvent(AnalyticsEventNames.GROUP_LEFT, 'group', params);
  }

  // ==========================================================================
  // Navigation Events
  // ==========================================================================

  async trackScreenView(screenName: string, screenClass?: string): Promise<void> {
    const now = Date.now();
    const params: ScreenViewEventParams = {
      screen_name: screenName,
      screen_class: screenClass || screenName,
    };

    // Calculate time on previous screen
    if (this.currentScreen && this.screenStartTime) {
      params.previous_screen = this.currentScreen;
      params.time_on_previous_screen_ms = now - this.screenStartTime;
    }

    this.currentScreen = screenName;
    this.screenStartTime = now;

    await this.logEvent(AnalyticsEventNames.SCREEN_VIEW, 'navigation', params);
  }

  // ==========================================================================
  // Engagement Events
  // ==========================================================================

  async trackNotificationOpened(params: NotificationOpenedEventParams): Promise<void> {
    await this.logEvent(AnalyticsEventNames.NOTIFICATION_OPENED, 'engagement', params);
  }

  async trackShareClicked(params: ShareClickedEventParams): Promise<void> {
    await this.logEvent(AnalyticsEventNames.SHARE_CLICKED, 'engagement', params);
  }

  async trackDonationStarted(params: DonationStartedEventParams): Promise<void> {
    await this.logEvent(AnalyticsEventNames.DONATION_STARTED, 'engagement', params);
  }

  // ==========================================================================
  // Error Events
  // ==========================================================================

  async trackError(params: ErrorEventParams): Promise<void> {
    await this.logEvent(AnalyticsEventNames.ERROR, 'error', params);
  }

  // ==========================================================================
  // Performance Events
  // ==========================================================================

  async trackPerformance(params: PerformanceEventParams): Promise<void> {
    await this.logEvent(AnalyticsEventNames.PERFORMANCE, 'performance', params);
  }

  async trackAppStart(params: AppStartEventParams): Promise<void> {
    await this.logEvent(AnalyticsEventNames.APP_START, 'performance', params);
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Flush all pending events
   */
  async flush(): Promise<void> {
    if (this.queueManager) {
      await this.queueManager.flush();
    }
  }

  /**
   * Get the current queue size (for monitoring)
   */
  getQueueSize(): number {
    return this.queueManager?.getQueueSize() ?? 0;
  }

  /**
   * Get the current session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Check if analytics is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.queueManager) {
      this.queueManager.destroy();
      this.queueManager = null;
    }
    this.initialized = false;
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const Analytics = new AnalyticsManager();

// Re-export types
export * from './types';
export { createAnalyticsProvider } from './adapter';
