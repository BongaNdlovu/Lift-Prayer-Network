/**
 * Standardized Error Types
 * 
 * Provides consistent error classification across the app
 * for better error handling and user feedback.
 */

export type ErrorCategory = 
  | 'auth'
  | 'network'
  | 'permission'
  | 'validation'
  | 'not_found'
  | 'rate_limit'
  | 'server'
  | 'unknown';

export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface AppError {
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string;
  userMessage: string;
  code?: string;
  originalError?: unknown;
  recoverable: boolean;
  action?: ErrorAction;
}

export type ErrorAction = 
  | { type: 'retry'; handler: () => void | Promise<void> }
  | { type: 'sign_in'; screen?: string }
  | { type: 'navigate'; screen: string }
  | { type: 'dismiss' }
  | { type: 'contact_support' };

/**
 * Firebase/Firestore error codes mapped to categories
 */
const ERROR_CODE_MAP: Record<string, ErrorCategory> = {
  // Auth errors
  'auth/user-not-found': 'auth',
  'auth/wrong-password': 'auth',
  'auth/invalid-email': 'validation',
  'auth/email-already-in-use': 'auth',
  'auth/weak-password': 'validation',
  'auth/requires-recent-login': 'auth',
  'auth/invalid-credential': 'auth',
  'auth/account-exists-with-different-credential': 'auth',
  
  // Firestore errors
  'permission-denied': 'permission',
  'not-found': 'not_found',
  'already-exists': 'validation',
  'resource-exhausted': 'rate_limit',
  'failed-precondition': 'validation',
  'unavailable': 'network',
  'deadline-exceeded': 'network',
  'cancelled': 'network',
  'internal': 'server',
  'unknown': 'unknown',
};

/**
 * User-friendly messages for error categories
 */
const USER_MESSAGES: Record<ErrorCategory, string> = {
  auth: 'Please sign in to continue.',
  network: 'Connection issue. Please check your internet and try again.',
  permission: 'You don\'t have permission to do this.',
  validation: 'Please check your input and try again.',
  not_found: 'The requested item was not found.',
  rate_limit: 'Too many requests. Please wait a moment and try again.',
  server: 'Something went wrong on our end. Please try again later.',
  unknown: 'An unexpected error occurred. Please try again.',
};

/**
 * Classify an error into a standardized AppError
 */
export function classifyError(
  error: unknown,
  context?: { defaultMessage?: string; recoverable?: boolean }
): AppError {
  const err = error as { code?: string; message?: string };
  const code = err?.code || '';
  const message = err?.message || 'Unknown error';
  
  // Determine category from error code
  let category: ErrorCategory = 'unknown';
  for (const [errorCode, cat] of Object.entries(ERROR_CODE_MAP)) {
    if (code.includes(errorCode) || message.toLowerCase().includes(errorCode)) {
      category = cat;
      break;
    }
  }
  
  // Check message for network-related keywords
  const lowerMessage = message.toLowerCase();
  if (
    lowerMessage.includes('network') ||
    lowerMessage.includes('offline') ||
    lowerMessage.includes('internet') ||
    lowerMessage.includes('connection') ||
    lowerMessage.includes('timeout')
  ) {
    category = 'network';
  }
  
  // Determine severity
  let severity: ErrorSeverity = 'error';
  if (category === 'network' || category === 'rate_limit') {
    severity = 'warning';
  } else if (category === 'validation') {
    severity = 'info';
  } else if (category === 'server') {
    severity = 'critical';
  }
  
  // Determine if recoverable
  const recoverable = context?.recoverable ?? 
    ['network', 'rate_limit', 'validation'].includes(category);
  
  return {
    category,
    severity,
    message,
    userMessage: context?.defaultMessage || USER_MESSAGES[category],
    code: code || undefined,
    originalError: error,
    recoverable,
  };
}

/**
 * Type guard to check if an error is a Firebase error
 */
export function isFirebaseError(error: unknown): error is { code: string; message: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error
  );
}

/**
 * Extract a safe error message for logging (no PII)
 */
export function getSafeErrorMessage(error: unknown): string {
  if (isFirebaseError(error)) {
    return `[${error.code}] ${error.message}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unknown error';
}
