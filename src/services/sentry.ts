import * as Sentry from '@sentry/react-native';

// Sentry DSN for Lift Prayer Network
const SENTRY_DSN = 'https://65d0f726b7bd84fb1707b38e8162a46d@o4510454341828608.ingest.us.sentry.io/4510454361686016';

// Initialize Sentry for crash reporting and performance monitoring
// Note: Using runtime-only mode without native plugin to avoid build issues
export const initSentry = () => {
  try {
    Sentry.init({
      dsn: SENTRY_DSN,
      // Performance monitoring sample rate
      tracesSampleRate: 0.1,
      // Enable automatic session tracking
      enableAutoSessionTracking: true,
      // Attach stack traces to messages
      attachStacktrace: true,
      // Debug mode (disable in production)
      debug: false,
      // Environment
      environment: __DEV__ ? 'development' : 'production',
      // Disable native features that require the gradle plugin
      enableNative: false,
      enableNativeCrashHandling: false,
      // Before sending event, you can modify or filter it
      beforeSend(event) {
        // Don't send events in development
        if (__DEV__) {
          console.log('[Sentry] Event captured (not sent in dev):', event.message || event.exception);
          return null;
        }
        return event;
      },
    });

    console.log('[Sentry] Initialized successfully (JS-only mode)');
  } catch (error) {
    console.warn('[Sentry] Failed to initialize:', error);
  }
};

// Capture a custom error
export const captureError = (error: Error, context?: Record<string, any>) => {
  if (context) {
    Sentry.setContext('additional', context);
  }
  Sentry.captureException(error);
};

// Capture a message
export const captureMessage = (message: string, level: Sentry.SeverityLevel = 'info') => {
  Sentry.captureMessage(message, level);
};

// Set user information for error tracking
export const setUser = (user: { id: string; email?: string; username?: string } | null) => {
  if (user) {
    Sentry.setUser({
      id: user.id,
      email: user.email,
      username: user.username,
    });
  } else {
    Sentry.setUser(null);
  }
};

// Add breadcrumb for debugging
export const addBreadcrumb = (
  message: string,
  category: string = 'app',
  level: Sentry.SeverityLevel = 'info',
  data?: Record<string, any>
) => {
  Sentry.addBreadcrumb({
    message,
    category,
    level,
    data,
  });
};

// Wrap a component with Sentry error boundary
export const withErrorBoundary = Sentry.wrap;

export default Sentry;
