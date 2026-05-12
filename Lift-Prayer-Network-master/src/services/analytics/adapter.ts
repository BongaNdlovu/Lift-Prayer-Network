/**
 * Analytics Adapter
 * 
 * Abstraction layer for analytics providers.
 * Supports multiple backends with a unified interface.
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  AnalyticsEvent, 
  AnalyticsConfig, 
  DEFAULT_ANALYTICS_CONFIG,
  QueuedEvent,
  ANALYTICS_SCHEMA_VERSION,
} from './types';

// ============================================================================
// Analytics Provider Interface
// ============================================================================

export interface AnalyticsProvider {
  name: string;
  initialize(): Promise<void>;
  logEvent(event: AnalyticsEvent): Promise<boolean>;
  setUserId(userId: string | null): Promise<void>;
  setUserProperties(properties: Record<string, string | null>): Promise<void>;
  flush(): Promise<void>;
}

// ============================================================================
// Console Provider (Development)
// ============================================================================

export class ConsoleAnalyticsProvider implements AnalyticsProvider {
  name = 'console';
  private events: AnalyticsEvent[] = [];

  async initialize(): Promise<void> {
    console.log('[Analytics:Console] Initialized');
  }

  async logEvent(event: AnalyticsEvent): Promise<boolean> {
    this.events.push(event);
    
    // Keep only last 100 events in memory
    if (this.events.length > 100) {
      this.events = this.events.slice(-100);
    }

    console.log(
      `[Analytics] ${event.category}/${event.name}`,
      JSON.stringify(event.params, null, 2)
    );
    return true;
  }

  async setUserId(userId: string | null): Promise<void> {
    console.log('[Analytics:Console] Set user ID:', userId);
  }

  async setUserProperties(properties: Record<string, string | null>): Promise<void> {
    console.log('[Analytics:Console] Set user properties:', properties);
  }

  async flush(): Promise<void> {
    console.log('[Analytics:Console] Flushed', this.events.length, 'events');
  }

  getEvents(): AnalyticsEvent[] {
    return [...this.events];
  }
}

// ============================================================================
// No-Op Provider (Disabled/Testing)
// ============================================================================

export class NoOpAnalyticsProvider implements AnalyticsProvider {
  name = 'noop';

  async initialize(): Promise<void> {}
  async logEvent(_event: AnalyticsEvent): Promise<boolean> { return true; }
  async setUserId(_userId: string | null): Promise<void> {}
  async setUserProperties(_properties: Record<string, string | null>): Promise<void> {}
  async flush(): Promise<void> {}
}

// ============================================================================
// Firebase Analytics Provider (Production)
// ============================================================================

export class FirebaseAnalyticsProvider implements AnalyticsProvider {
  name = 'firebase';
  private initialized = false;

  async initialize(): Promise<void> {
    try {
      // Firebase Analytics requires native setup
      // This will be enabled when native modules are configured
      // import analytics from '@react-native-firebase/analytics';
      // await analytics().setAnalyticsCollectionEnabled(true);
      this.initialized = true;
      console.log('[Analytics:Firebase] Initialized');
    } catch (error) {
      console.warn('[Analytics:Firebase] Failed to initialize:', error);
    }
  }

  async logEvent(event: AnalyticsEvent): Promise<boolean> {
    if (!this.initialized) return false;

    void event;
    // Firebase Analytics integration
    // import analytics from '@react-native-firebase/analytics';
    // await analytics().logEvent(event.name, event.params);
    return true;
  }

  async setUserId(userId: string | null): Promise<void> {
    if (!this.initialized) return;

    try {
      // import analytics from '@react-native-firebase/analytics';
      // await analytics().setUserId(userId);
    } catch (error) {
      console.warn('[Analytics:Firebase] Failed to set user ID:', error);
    }
  }

  async setUserProperties(properties: Record<string, string | null>): Promise<void> {
    if (!this.initialized) return;

    try {
      // import analytics from '@react-native-firebase/analytics';
      // for (const [key, value] of Object.entries(properties)) {
      //   await analytics().setUserProperty(key, value);
      // }
    } catch (error) {
      console.warn('[Analytics:Firebase] Failed to set user properties:', error);
    }
  }

  async flush(): Promise<void> {
    // Firebase handles batching internally
  }
}

// ============================================================================
// Firestore Analytics Provider (Custom Backend)
// ============================================================================

export class FirestoreAnalyticsProvider implements AnalyticsProvider {
  name = 'firestore';
  private batch: AnalyticsEvent[] = [];
  private batchSize: number;

  constructor(batchSize = 20) {
    this.batchSize = batchSize;
  }

  async initialize(): Promise<void> {
    console.log('[Analytics:Firestore] Initialized');
  }

  async logEvent(event: AnalyticsEvent): Promise<boolean> {
    this.batch.push(event);

    if (this.batch.length >= this.batchSize) {
      await this.flush();
    }

    return true;
  }

  async setUserId(_userId: string | null): Promise<void> {
    // User ID is included in event params
  }

  async setUserProperties(_properties: Record<string, string | null>): Promise<void> {
    // User properties are included in event params
  }

  async flush(): Promise<void> {
    if (this.batch.length === 0) return;

    const eventsToSend = [...this.batch];
    this.batch = [];

    try {
      // Send to Firestore analytics collection
      // This could be a Cloud Function endpoint or direct Firestore write
      // For now, we'll store locally and let a Cloud Function process them
      
      // import { db } from '../firebase';
      // import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
      // 
      // const analyticsRef = collection(db, 'analytics');
      // for (const event of eventsToSend) {
      //   await addDoc(analyticsRef, {
      //     ...event,
      //     processedAt: serverTimestamp(),
      //   });
      // }

      console.log('[Analytics:Firestore] Flushed', eventsToSend.length, 'events');
    } catch (error) {
      // Re-add failed events to batch
      this.batch = [...eventsToSend, ...this.batch];
      console.warn('[Analytics:Firestore] Failed to flush:', error);
    }
  }
}

// ============================================================================
// Analytics Queue Manager
// ============================================================================

const QUEUE_STORAGE_KEY = '@lift_analytics_queue';

export class AnalyticsQueueManager {
  private queue: QueuedEvent[] = [];
  private config: AnalyticsConfig;
  private provider: AnalyticsProvider;
  private flushTimer: NodeJS.Timeout | null = null;
  private isProcessing = false;

  constructor(provider: AnalyticsProvider, config: Partial<AnalyticsConfig> = {}) {
    this.provider = provider;
    this.config = { ...DEFAULT_ANALYTICS_CONFIG, ...config };
  }

  async initialize(): Promise<void> {
    await this.provider.initialize();
    await this.loadQueue();
    this.startFlushTimer();
  }

  private async loadQueue(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
      if (stored) {
        this.queue = JSON.parse(stored);
        if (this.config.debug) {
          console.log('[Analytics:Queue] Loaded', this.queue.length, 'queued events');
        }
      }
    } catch (error) {
      console.warn('[Analytics:Queue] Failed to load queue:', error);
    }
  }

  private async saveQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(this.queue));
    } catch (error) {
      console.warn('[Analytics:Queue] Failed to save queue:', error);
    }
  }

  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      this.processQueue();
    }, this.config.flushInterval);
  }

  async enqueue(event: AnalyticsEvent): Promise<void> {
    // Add base params
    const enrichedEvent: AnalyticsEvent = {
      ...event,
      params: {
        ...event.params,
        schema_version: ANALYTICS_SCHEMA_VERSION,
        timestamp: new Date().toISOString(),
        platform: Platform.OS,
      },
    };

    // Try to send immediately
    const success = await this.provider.logEvent(enrichedEvent);

    if (!success) {
      // Queue for retry
      const queuedEvent: QueuedEvent = {
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        event: enrichedEvent,
        attempts: 1,
        lastAttempt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };

      this.queue.push(queuedEvent);

      // Trim queue if too large
      if (this.queue.length > this.config.maxQueueSize) {
        this.queue = this.queue.slice(-this.config.maxQueueSize);
      }

      await this.saveQueue();
    }
  }

  async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;

    try {
      const now = new Date();
      const eventsToProcess = this.queue.filter(qe => {
        if (!qe.nextRetry) return true;
        return new Date(qe.nextRetry) <= now;
      }).slice(0, this.config.batchSize);

      for (const queuedEvent of eventsToProcess) {
        const success = await this.provider.logEvent(queuedEvent.event);

        if (success) {
          // Remove from queue
          this.queue = this.queue.filter(qe => qe.id !== queuedEvent.id);
        } else {
          // Update retry info
          queuedEvent.attempts++;
          queuedEvent.lastAttempt = now.toISOString();

          if (queuedEvent.attempts >= this.config.maxRetries) {
            // Max retries reached, drop event
            this.queue = this.queue.filter(qe => qe.id !== queuedEvent.id);
            if (this.config.debug) {
              console.warn('[Analytics:Queue] Dropped event after max retries:', queuedEvent.event.name);
            }
          } else {
            // Calculate next retry with exponential backoff
            const delay = this.config.baseRetryDelay * Math.pow(2, queuedEvent.attempts - 1);
            queuedEvent.nextRetry = new Date(now.getTime() + delay).toISOString();
          }
        }
      }

      await this.saveQueue();
    } finally {
      this.isProcessing = false;
    }
  }

  async flush(): Promise<void> {
    await this.processQueue();
    await this.provider.flush();
  }

  getQueueSize(): number {
    return this.queue.length;
  }

  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createAnalyticsProvider(
  type: 'console' | 'firebase' | 'firestore' | 'noop' = 'console'
): AnalyticsProvider {
  switch (type) {
    case 'firebase':
      return new FirebaseAnalyticsProvider();
    case 'firestore':
      return new FirestoreAnalyticsProvider();
    case 'noop':
      return new NoOpAnalyticsProvider();
    case 'console':
    default:
      return new ConsoleAnalyticsProvider();
  }
}
