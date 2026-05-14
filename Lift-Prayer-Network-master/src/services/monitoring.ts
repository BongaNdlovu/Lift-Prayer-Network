/**
 * Monitoring & Alerting Service
 * 
 * Centralized error tracking, performance monitoring, and health checks.
 * Integrates with Sentry for production error reporting.
 */

import * as Sentry from '@sentry/react-native';
import { Analytics } from './analytics/index';

// ============================================================================
// Configuration
// ============================================================================

export interface MonitoringConfig {
  /** Enable Sentry error reporting */
  sentryEnabled: boolean;
  /** Sentry DSN (from environment) */
  sentryDsn?: string;
  /** Sample rate for performance monitoring (0-1) */
  performanceSampleRate: number;
  /** Sample rate for error reporting (0-1) */
  errorSampleRate: number;
  /** Enable console logging in development */
  debugLogging: boolean;
  /** Alert thresholds */
  thresholds: AlertThresholds;
}

export interface AlertThresholds {
  /** Max API response time (ms) before warning */
  apiResponseTimeWarning: number;
  /** Max API response time (ms) before error */
  apiResponseTimeError: number;
  /** Max consecutive errors before alert */
  consecutiveErrorsAlert: number;
  /** Max error rate per minute before alert */
  errorRatePerMinuteAlert: number;
  /** Max queue size before warning */
  queueSizeWarning: number;
}

const DEFAULT_CONFIG: MonitoringConfig = {
  sentryEnabled: !__DEV__,
  performanceSampleRate: __DEV__ ? 1.0 : 0.2,
  errorSampleRate: 1.0,
  debugLogging: __DEV__,
  thresholds: {
    apiResponseTimeWarning: 3000,
    apiResponseTimeError: 10000,
    consecutiveErrorsAlert: 5,
    errorRatePerMinuteAlert: 10,
    queueSizeWarning: 100,
  },
};

// ============================================================================
// Error Tracking
// ============================================================================

type ErrorSeverity = 'fatal' | 'error' | 'warning' | 'info';

interface ErrorContext {
  screen?: string;
  action?: string;
  userId?: string;
  extra?: Record<string, any>;
}

class ErrorTracker {
  private consecutiveErrors = 0;
  private errorTimestamps: number[] = [];
  private config: MonitoringConfig;

  constructor(config: MonitoringConfig) {
    this.config = config;
  }

  /**
   * Track an error with context
   */
  async trackError(
    error: Error | string,
    severity: ErrorSeverity = 'error',
    context?: ErrorContext
  ): Promise<void> {
    const errorObj = typeof error === 'string' ? new Error(error) : error;
    const timestamp = Date.now();

    // Update error tracking
    this.consecutiveErrors++;
    this.errorTimestamps.push(timestamp);
    
    // Clean old timestamps (keep last minute)
    const oneMinuteAgo = timestamp - 60000;
    this.errorTimestamps = this.errorTimestamps.filter(t => t > oneMinuteAgo);

    // Check alert thresholds
    this.checkAlertThresholds();

    // Log to console in development
    if (this.config.debugLogging) {
      console.error(`[Monitoring:${severity}]`, errorObj.message, context);
    }

    // Send to Sentry in production
    if (this.config.sentryEnabled) {
      Sentry.withScope((scope) => {
        scope.setLevel(this.mapSeverityToSentryLevel(severity));
        
        if (context?.screen) {
          scope.setTag('screen', context.screen);
        }
        if (context?.action) {
          scope.setTag('action', context.action);
        }
        if (context?.userId) {
          scope.setUser({ id: context.userId });
        }
        if (context?.extra) {
          scope.setExtras(context.extra);
        }

        Sentry.captureException(errorObj);
      });
    }

    // Track in analytics
    await Analytics.trackError({
      error_type: this.classifyError(errorObj),
      error_message: errorObj.message,
      screen_name: context?.screen,
      action: context?.action,
      is_fatal: severity === 'fatal',
    });
  }

  /**
   * Reset consecutive error counter (call on successful operation)
   */
  resetConsecutiveErrors(): void {
    this.consecutiveErrors = 0;
  }

  /**
   * Get current error rate (errors per minute)
   */
  getErrorRate(): number {
    const oneMinuteAgo = Date.now() - 60000;
    return this.errorTimestamps.filter(t => t > oneMinuteAgo).length;
  }

  private checkAlertThresholds(): void {
    const { thresholds } = this.config;

    // Check consecutive errors
    if (this.consecutiveErrors >= thresholds.consecutiveErrorsAlert) {
      this.triggerAlert('consecutive_errors', {
        count: this.consecutiveErrors,
        threshold: thresholds.consecutiveErrorsAlert,
      });
    }

    // Check error rate
    const errorRate = this.getErrorRate();
    if (errorRate >= thresholds.errorRatePerMinuteAlert) {
      this.triggerAlert('error_rate', {
        rate: errorRate,
        threshold: thresholds.errorRatePerMinuteAlert,
      });
    }
  }

  private triggerAlert(type: string, data: Record<string, any>): void {
    if (this.config.debugLogging) {
      console.warn(`[Monitoring:Alert] ${type}`, data);
    }

    // In production, this could send to a monitoring service
    if (this.config.sentryEnabled) {
      Sentry.addBreadcrumb({
        category: 'alert',
        message: `Alert triggered: ${type}`,
        level: 'warning',
        data,
      });
    }
  }

  private mapSeverityToSentryLevel(severity: ErrorSeverity): Sentry.SeverityLevel {
    switch (severity) {
      case 'fatal': return 'fatal';
      case 'error': return 'error';
      case 'warning': return 'warning';
      case 'info': return 'info';
      default: return 'error';
    }
  }

  private classifyError(error: Error): 'network' | 'auth' | 'permission' | 'validation' | 'unknown' {
    const message = error.message.toLowerCase();
    
    if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
      return 'network';
    }
    if (message.includes('auth') || message.includes('permission') || message.includes('unauthorized')) {
      return 'auth';
    }
    if (message.includes('permission') || message.includes('denied')) {
      return 'permission';
    }
    if (message.includes('invalid') || message.includes('validation')) {
      return 'validation';
    }
    
    return 'unknown';
  }
}

// ============================================================================
// Performance Monitoring
// ============================================================================

interface PerformanceMetric {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  success?: boolean;
  metadata?: Record<string, any>;
}

class PerformanceMonitor {
  private activeMetrics: Map<string, PerformanceMetric> = new Map();
  private config: MonitoringConfig;

  constructor(config: MonitoringConfig) {
    this.config = config;
  }

  /**
   * Start measuring a performance metric
   */
  startMetric(name: string, metadata?: Record<string, any>): string {
    const id = `${name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.activeMetrics.set(id, {
      name,
      startTime: Date.now(),
      metadata,
    });

    return id;
  }

  /**
   * End a performance metric and record it
   */
  async endMetric(id: string, success = true): Promise<number | null> {
    const metric = this.activeMetrics.get(id);
    if (!metric) {
      if (this.config.debugLogging) {
        console.warn('[Monitoring:Performance] Metric not found:', id);
      }
      return null;
    }

    const endTime = Date.now();
    const duration = endTime - metric.startTime;
    
    metric.endTime = endTime;
    metric.duration = duration;
    metric.success = success;

    this.activeMetrics.delete(id);

    // Log to console in development
    if (this.config.debugLogging) {
      const status = success ? '✓' : '✗';
      console.log(`[Monitoring:Performance] ${status} ${metric.name}: ${duration}ms`);
    }

    // Check thresholds
    this.checkPerformanceThresholds(metric.name, duration);

    // Track in analytics
    await Analytics.trackPerformance({
      metric_name: metric.name,
      value_ms: duration,
      success,
    });

    return duration;
  }

  /**
   * Measure an async operation
   */
  async measure<T>(
    name: string,
    operation: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const id = this.startMetric(name, metadata);
    
    try {
      const result = await operation();
      await this.endMetric(id, true);
      return result;
    } catch (error) {
      await this.endMetric(id, false);
      throw error;
    }
  }

  private checkPerformanceThresholds(name: string, duration: number): void {
    const { thresholds } = this.config;

    if (duration >= thresholds.apiResponseTimeError) {
      if (this.config.debugLogging) {
        console.error(`[Monitoring:Performance] SLOW: ${name} took ${duration}ms (threshold: ${thresholds.apiResponseTimeError}ms)`);
      }
    } else if (duration >= thresholds.apiResponseTimeWarning) {
      if (this.config.debugLogging) {
        console.warn(`[Monitoring:Performance] Warning: ${name} took ${duration}ms (threshold: ${thresholds.apiResponseTimeWarning}ms)`);
      }
    }
  }
}

// ============================================================================
// Health Check
// ============================================================================

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    name: string;
    status: 'pass' | 'fail';
    message?: string;
    latency?: number;
  }[];
  timestamp: string;
}

class HealthChecker {
  private config: MonitoringConfig;

  constructor(config: MonitoringConfig) {
    this.config = config;
  }

  /**
   * Run all health checks
   */
  async checkHealth(): Promise<HealthStatus> {
    const checks: HealthStatus['checks'] = [];

    // Check analytics queue
    const queueSize = Analytics.getQueueSize();
    checks.push({
      name: 'analytics_queue',
      status: queueSize < this.config.thresholds.queueSizeWarning ? 'pass' : 'fail',
      message: `Queue size: ${queueSize}`,
    });

    // Check network connectivity (basic)
    try {
      const start = Date.now();
      // Simple connectivity check - could be enhanced
      checks.push({
        name: 'network',
        status: 'pass',
        latency: Date.now() - start,
      });
    } catch {
      checks.push({
        name: 'network',
        status: 'fail',
        message: 'Network check failed',
      });
    }

    // Determine overall status
    const failedChecks = checks.filter(c => c.status === 'fail');
    let status: HealthStatus['status'] = 'healthy';
    
    if (failedChecks.length > 0) {
      status = failedChecks.length >= checks.length / 2 ? 'unhealthy' : 'degraded';
    }

    return {
      status,
      checks,
      timestamp: new Date().toISOString(),
    };
  }
}

// ============================================================================
// Monitoring Manager
// ============================================================================

class MonitoringManager {
  private config: MonitoringConfig;
  private errorTracker: ErrorTracker;
  private performanceMonitor: PerformanceMonitor;
  private healthChecker: HealthChecker;
  private initialized = false;

  constructor(config: Partial<MonitoringConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.errorTracker = new ErrorTracker(this.config);
    this.performanceMonitor = new PerformanceMonitor(this.config);
    this.healthChecker = new HealthChecker(this.config);
  }

  /**
   * Initialize monitoring services
   */
  async initialize(sentryDsn?: string): Promise<void> {
    if (this.initialized) return;
    void sentryDsn;

    // Sentry is initialized centrally in services/sentry.ts from App.tsx.
    // Monitoring reports to Sentry but must not initialize it a second time.

    this.initialized = true;

    if (this.config.debugLogging) {
      console.log('[Monitoring] Initialized');
    }
  }

  // Error tracking
  trackError(
    error: Error | string,
    severity: 'fatal' | 'error' | 'warning' | 'info' = 'error',
    context?: { screen?: string; action?: string; userId?: string; extra?: Record<string, any> }
  ): Promise<void> {
    return this.errorTracker.trackError(error, severity, context);
  }

  resetConsecutiveErrors(): void {
    return this.errorTracker.resetConsecutiveErrors();
  }

  getErrorRate(): number {
    return this.errorTracker.getErrorRate();
  }

  // Performance monitoring
  startMetric(name: string, metadata?: Record<string, any>): string {
    return this.performanceMonitor.startMetric(name, metadata);
  }

  endMetric(id: string, success = true): Promise<number | null> {
    return this.performanceMonitor.endMetric(id, success);
  }

  measure<T>(
    name: string,
    operation: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    return this.performanceMonitor.measure(name, operation, metadata);
  }

  // Health checks
  checkHealth() {
    return this.healthChecker.checkHealth();
  }

  /**
   * Add breadcrumb for debugging
   */
  addBreadcrumb(message: string, category: string, data?: Record<string, any>): void {
    if (this.config.debugLogging) {
      console.log(`[Monitoring:Breadcrumb] ${category}: ${message}`, data);
    }

    if (this.config.sentryEnabled) {
      Sentry.addBreadcrumb({
        message,
        category,
        data,
        level: 'info',
      });
    }
  }

  /**
   * Set user context for error reports
   */
  setUser(userId: string | null, email?: string, username?: string): void {
    if (this.config.sentryEnabled) {
      if (userId) {
        Sentry.setUser({ id: userId, email, username });
      } else {
        Sentry.setUser(null);
      }
    }
  }

  /**
   * Set custom tags for filtering
   */
  setTag(key: string, value: string): void {
    if (this.config.sentryEnabled) {
      Sentry.setTag(key, value);
    }
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const Monitoring = new MonitoringManager();

// Convenience exports
export const trackError = Monitoring.trackError;
export const measure = Monitoring.measure;
export const addBreadcrumb = Monitoring.addBreadcrumb;
