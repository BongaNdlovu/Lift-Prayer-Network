/**
 * Security Utilities
 * 
 * Input validation, sanitization, and content moderation helpers
 * for keeping the Lift app safe and secure.
 */

// Forbidden words and patterns for content moderation
const FORBIDDEN_PATTERNS = [
  // Profanity patterns (basic list - extend as needed)
  /\bf+u+c+k+\w*/gi,
  /\bsh+i+t+\w*/gi,
  /\bb+i+t+c+h+\w*/gi,
  /\bd+a+m+n+\w*/gi,
  /\bh+e+l+l+\w*/gi,
  /\bass\b/gi,
  // Hate speech indicators
  /\b(hate|kill|die|murder)\s+(all|every|those)\b/gi,
  // Spam patterns
  /(.)\1{5,}/gi, // Repeated characters (aaaaaaa)
  /\b(buy now|click here|free money|earn cash|make \$\d+)\b/gi,
  // Suspicious URLs
  /(bit\.ly|tinyurl|t\.co|goo\.gl)/gi,
  // Phone number patterns (prevent sharing personal info)
  /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
];

// Suspicious content patterns
const SUSPICIOUS_PATTERNS = [
  // Potential scams
  /\b(send money|wire transfer|western union|money gram)\b/gi,
  // External contact attempts
  /\b(whatsapp|telegram|signal|snapchat|instagram|facebook)\s*(:|at|@)?\s*\S+/gi,
  // Email patterns
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
];

// Money solicitation patterns - these should be BLOCKED in prayer requests
const MONEY_SOLICITATION_PATTERNS = [
  // GoFundMe and crowdfunding
  /\b(gofundme|go fund me|gofund\.me)\b/gi,
  /\b(kickstarter|indiegogo|patreon|ko-?fi|buymeacoffee|buy me a coffee)\b/gi,
  /\b(crowdfund|crowd[-\s]?fund|fundrais)/gi,
  // Direct money requests
  /\b(donate|donation|donating)\s*(to|at|via|through|money|cash|\$|paypal|venmo|cashapp|zelle)/gi,
  /\b(paypal|venmo|cash\s?app|zelle|mpesa|m-pesa)\.?(me|com)?\/?\s*[@:]?\s*\S*/gi,
  /\b(send|give|transfer|wire)\s*(me|us)?\s*(some)?\s*(money|cash|funds|\$\d+)/gi,
  /\b(need|require|requesting)\s*(financial|money|monetary|cash)\s*(help|support|assistance|aid)/gi,
  /\b(bank\s*account|account\s*number|routing\s*number|swift\s*code)/gi,
  // Cryptocurrency
  /\b(bitcoin|btc|ethereum|eth|crypto)\s*(address|wallet|donation)/gi,
  // Payment links
  /\b(pay\.me|payment\.link|checkout\.link)/gi,
];

export type ValidationResult = {
  isValid: boolean;
  error?: string;
  warnings?: string[];
  sanitized?: string;
  containsMoneySolicitation?: boolean;
  requiresAdminApproval?: boolean;
};

/**
 * Check if content contains money solicitation
 */
export const containsMoneySolicitation = (content: string): boolean => {
  for (const pattern of MONEY_SOLICITATION_PATTERNS) {
    if (pattern.test(content)) {
      pattern.lastIndex = 0;
      return true;
    }
    pattern.lastIndex = 0;
  }
  return false;
};

/**
 * Validate and sanitize text content
 */
export const validateContent = (
  content: string,
  options: {
    minLength?: number;
    maxLength?: number;
    allowUrls?: boolean;
    checkProfanity?: boolean;
    checkSuspicious?: boolean;
    checkMoneySolicitation?: boolean;
    contentType?: 'REQUEST' | 'TESTIMONY';
  } = {}
): ValidationResult => {
  const {
    minLength = 1,
    maxLength = 2000,
    allowUrls = false,
    checkProfanity = true,
    checkSuspicious = true,
    checkMoneySolicitation = true,
    contentType = 'REQUEST',
  } = options;

  const warnings: string[] = [];

  // Basic validation
  if (!content || typeof content !== 'string') {
    return { isValid: false, error: 'Content is required' };
  }

  const trimmed = content.trim();

  if (trimmed.length < minLength) {
    return { isValid: false, error: `Content must be at least ${minLength} characters` };
  }

  if (trimmed.length > maxLength) {
    return { isValid: false, error: `Content must be less than ${maxLength} characters` };
  }

  // Check for forbidden content
  if (checkProfanity) {
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.test(trimmed)) {
        return { 
          isValid: false, 
          error: 'Content contains inappropriate language or patterns. Please revise your message.' 
        };
      }
      pattern.lastIndex = 0; // Reset regex state
    }
  }

  // Check for suspicious patterns
  if (checkSuspicious) {
    for (const pattern of SUSPICIOUS_PATTERNS) {
      if (pattern.test(trimmed)) {
        warnings.push('Your content may contain personal information. Please be careful about sharing contact details.');
      }
      pattern.lastIndex = 0;
    }
  }

  // URL check
  if (!allowUrls) {
    const urlPattern = /https?:\/\/[^\s]+/gi;
    if (urlPattern.test(trimmed)) {
      warnings.push('URLs are discouraged in prayer content. Consider removing links.');
    }
  }

  // Money solicitation check - BLOCK for requests, ALLOW (with warning) for testimonies
  let hasMoneySolicitation = false;
  let requiresAdminApproval = false;
  
  if (checkMoneySolicitation) {
    hasMoneySolicitation = containsMoneySolicitation(trimmed);
    
    if (hasMoneySolicitation) {
      if (contentType === 'REQUEST') {
        // Block money solicitation in prayer requests
        return {
          isValid: false,
          error: 'Prayer requests cannot contain money solicitation, crowdfunding links, or payment requests. If you have a financial need, please describe it without including payment links. GoFundMe links are only allowed in testimonies.',
          containsMoneySolicitation: true,
          requiresAdminApproval: true,
        };
      } else {
        // Allow in testimonies with a warning
        warnings.push('Your testimony contains a funding link. This is allowed in testimonies only.');
      }
    }
  }

  // Sanitize: remove potential XSS vectors (though React Native is generally safe)
  let sanitized = trimmed
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '');

  return {
    isValid: true,
    sanitized,
    warnings: warnings.length > 0 ? warnings : undefined,
    containsMoneySolicitation: hasMoneySolicitation,
    requiresAdminApproval,
  };
};

/**
 * Validate display name
 */
export const validateDisplayName = (name: string): ValidationResult => {
  if (!name || typeof name !== 'string') {
    return { isValid: false, error: 'Display name is required' };
  }

  const trimmed = name.trim();

  if (trimmed.length < 2) {
    return { isValid: false, error: 'Display name must be at least 2 characters' };
  }

  if (trimmed.length > 50) {
    return { isValid: false, error: 'Display name must be less than 50 characters' };
  }

  // Only allow letters, numbers, spaces, and some special characters
  const validNamePattern = /^[a-zA-Z0-9\s\-_'.]+$/;
  if (!validNamePattern.test(trimmed)) {
    return { isValid: false, error: 'Display name contains invalid characters' };
  }

  // Check for impersonation attempts
  const impersonationPatterns = [
    /^admin$/i,
    /^moderator$/i,
    /^support$/i,
    /^official$/i,
    /^system$/i,
    /^lift\s*(team|app|official)?$/i,
  ];

  for (const pattern of impersonationPatterns) {
    if (pattern.test(trimmed)) {
      return { isValid: false, error: 'This display name is reserved' };
    }
  }

  return { isValid: true, sanitized: trimmed };
};

/**
 * Validate email format
 */
export const validateEmail = (email: string): ValidationResult => {
  if (!email || typeof email !== 'string') {
    return { isValid: false, error: 'Email is required' };
  }

  const trimmed = email.trim().toLowerCase();
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailPattern.test(trimmed)) {
    return { isValid: false, error: 'Please enter a valid email address' };
  }

  // Block disposable email domains (basic list)
  const disposableDomains = [
    'tempmail.com',
    'throwaway.email',
    'mailinator.com',
    'guerrillamail.com',
    '10minutemail.com',
  ];

  const domain = trimmed.split('@')[1];
  if (disposableDomains.includes(domain)) {
    return { isValid: false, error: 'Please use a permanent email address' };
  }

  return { isValid: true, sanitized: trimmed };
};

/**
 * Validate password strength
 */
export const validatePassword = (password: string): ValidationResult => {
  if (!password || typeof password !== 'string') {
    return { isValid: false, error: 'Password is required' };
  }

  if (password.length < 8) {
    return { isValid: false, error: 'Password must be at least 8 characters' };
  }

  if (password.length > 128) {
    return { isValid: false, error: 'Password is too long' };
  }

  const warnings: string[] = [];

  // Check for weak patterns
  if (!/[A-Z]/.test(password)) {
    warnings.push('Consider adding uppercase letters for stronger security');
  }
  if (!/[a-z]/.test(password)) {
    warnings.push('Consider adding lowercase letters for stronger security');
  }
  if (!/[0-9]/.test(password)) {
    warnings.push('Consider adding numbers for stronger security');
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    warnings.push('Consider adding special characters for stronger security');
  }

  // Check for common passwords
  const commonPasswords = [
    'password', '12345678', 'qwerty123', 'letmein', 'welcome',
    'admin123', 'password1', 'iloveyou', 'princess', 'sunshine',
  ];

  if (commonPasswords.includes(password.toLowerCase())) {
    return { isValid: false, error: 'This password is too common. Please choose a stronger password.' };
  }

  return { 
    isValid: true, 
    warnings: warnings.length > 0 ? warnings : undefined 
  };
};

/**
 * Rate limiting helper (client-side tracking)
 */
const rateLimitCache: Map<string, { count: number; resetTime: number }> = new Map();

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetInMs: number;
  resetInSeconds: number;
};

/**
 * Check rate limit with detailed result
 */
export const checkRateLimitWithInfo = (
  key: string,
  maxRequests: number = 10,
  windowMs: number = 60000 // 1 minute
): RateLimitResult => {
  const now = Date.now();
  const cached = rateLimitCache.get(key);

  if (!cached || now > cached.resetTime) {
    rateLimitCache.set(key, { count: 1, resetTime: now + windowMs });
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetInMs: windowMs,
      resetInSeconds: Math.ceil(windowMs / 1000),
    };
  }

  const resetInMs = Math.max(0, cached.resetTime - now);
  const resetInSeconds = Math.ceil(resetInMs / 1000);

  if (cached.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetInMs,
      resetInSeconds,
    };
  }

  cached.count++;
  return {
    allowed: true,
    remaining: maxRequests - cached.count,
    resetInMs,
    resetInSeconds,
  };
};

/**
 * Simple rate limit check (backward compatible)
 */
export const checkRateLimit = (
  key: string,
  maxRequests: number = 10,
  windowMs: number = 60000 // 1 minute
): boolean => {
  return checkRateLimitWithInfo(key, maxRequests, windowMs).allowed;
};

/**
 * Reset rate limit for a specific key (useful after successful cooldown)
 */
export const resetRateLimit = (key: string): void => {
  rateLimitCache.delete(key);
};

/**
 * Get remaining time until rate limit resets
 */
export const getRateLimitCooldown = (key: string): number => {
  const cached = rateLimitCache.get(key);
  if (!cached) return 0;
  
  const now = Date.now();
  return Math.max(0, cached.resetTime - now);
};

/**
 * Daily rate limiting helper for content creation
 * Prevents spam by limiting how many items a user can create per day
 */
const dailyLimitCache: Map<string, { count: number; resetDate: string }> = new Map();

export const checkDailyLimit = (
  key: string,
  maxPerDay: number = 10
): { allowed: boolean; remaining: number; resetTime: string } => {
  const now = new Date();
  const today = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const cached = dailyLimitCache.get(key);

  // Reset if it's a new day
  if (!cached || cached.resetDate !== today) {
    dailyLimitCache.set(key, { count: 1, resetDate: today });
    return { allowed: true, remaining: maxPerDay - 1, resetTime: 'tomorrow' };
  }

  if (cached.count >= maxPerDay) {
    return { allowed: false, remaining: 0, resetTime: 'tomorrow' };
  }

  cached.count++;
  return { allowed: true, remaining: maxPerDay - cached.count, resetTime: 'tomorrow' };
};

/**
 * Content creation limits
 */
export const CONTENT_LIMITS = {
  PRAYER_REQUESTS_PER_DAY: 5,
  TESTIMONIES_PER_DAY: 3,
  COMMENTS_PER_HOUR: 20,
  COMMENTS_PER_DAY: 10,  // Limited to 10 comments per day
  PRAYERS_PER_MINUTE: 10,
  PRAYERS_PER_HOUR: 100,
};

/**
 * Rate limit configurations for high-frequency actions
 * Matches server-side RATE_LIMITS in cloud-functions/index.js
 */
export const RATE_LIMIT_CONFIG = {
  prayers: { 
    maxPerMinute: 10, 
    maxPerHour: 100,
    windowMs: 60 * 1000, // 1 minute window for quick check
  },
  requests: { 
    maxPerHour: 10, 
    maxPerDay: 30,
    windowMs: 60 * 60 * 1000, // 1 hour window
  },
  testimonies: { 
    maxPerHour: 10, 
    maxPerDay: 20,
    windowMs: 60 * 60 * 1000,
  },
  comments: {
    maxPerHour: 5,
    maxPerDay: 10,
    windowMs: 60 * 60 * 1000,
  },
  groupJoins: { 
    maxPerHour: 5, 
    maxPerDay: 10,
    windowMs: 60 * 60 * 1000,
  },
  reports: { 
    maxPerMinute: 5,
    maxPerHour: 15,
    windowMs: 60 * 1000,
  },
  reactions: {
    maxPerMinute: 30,
    windowMs: 60 * 1000,
  },
} as const;

export type RateLimitAction = keyof typeof RATE_LIMIT_CONFIG;

/**
 * Check rate limit for a specific action type
 * Returns detailed info about the rate limit status.
 * Enforces all configured windows (per-minute, per-hour, per-day).
 */
export const checkActionRateLimit = (
  userId: string,
  action: RateLimitAction
): RateLimitResult => {
  const config = RATE_LIMIT_CONFIG[action];

  if ('maxPerMinute' in config) {
    const key = `${action}_${userId}_minute`;
    const minuteResult = checkRateLimitWithInfo(key, config.maxPerMinute, 60 * 1000);
    if (!minuteResult.allowed) return minuteResult;
  }

  if ('maxPerHour' in config) {
    const key = `${action}_${userId}_hour`;
    const hourResult = checkRateLimitWithInfo(key, config.maxPerHour, 60 * 60 * 1000);
    if (!hourResult.allowed) return hourResult;
  }

  if ('maxPerDay' in config) {
    const key = `${action}_${userId}_day`;
    const dayResult = checkRateLimitWithInfo(key, config.maxPerDay, 24 * 60 * 60 * 1000);
    if (!dayResult.allowed) return dayResult;
  }

  return { allowed: true, remaining: 1, resetInMs: 0, resetInSeconds: 0 };
};

/**
 * Format rate limit error message for user display
 */
export const formatRateLimitError = (
  action: string,
  resetInSeconds: number
): string => {
  if (resetInSeconds <= 60) {
    return `Too many ${action}. Please wait ${resetInSeconds} seconds.`;
  }
  const minutes = Math.ceil(resetInSeconds / 60);
  return `Too many ${action}. Please wait ${minutes} minute${minutes > 1 ? 's' : ''}.`;
};

/**
 * Sanitize object for Firestore (remove undefined, functions, etc.)
 */
export const sanitizeForFirestore = <T extends Record<string, any>>(obj: T): Partial<T> => {
  const result: Partial<T> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || typeof value === 'function') {
      continue;
    }
    if (value === null) {
      result[key as keyof T] = value;
      continue;
    }
    if (typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      result[key as keyof T] = sanitizeForFirestore(value) as T[keyof T];
      continue;
    }
    result[key as keyof T] = value;
  }
  
  return result;
};

/**
 * Escape special characters for display (prevent injection in text rendering)
 */
export const escapeForDisplay = (text: string): string => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

/**
 * Generate a secure random ID (for client-side use)
 */
export const generateSecureId = (length: number = 16): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const randomValues = new Uint32Array(length);
  
  // Use crypto if available, otherwise fall back to Math.random
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(randomValues);
    for (let i = 0; i < length; i++) {
      result += chars[randomValues[i] % chars.length];
    }
  } else {
    for (let i = 0; i < length; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
  }
  
  return result;
};

