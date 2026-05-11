import {
  validateContent,
  validateDisplayName,
  validateEmail,
  containsMoneySolicitation,
  checkRateLimit,
  checkRateLimitWithInfo,
  checkActionRateLimit,
  formatRateLimitError,
  resetRateLimit,
  getRateLimitCooldown,
  RATE_LIMIT_CONFIG,
} from '../../utils/security';

describe('validateContent', () => {
  describe('profanity detection', () => {
    it('should reject content with profanity', () => {
      const result = validateContent('This is fucking bad');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('inappropriate');
    });

    it('should accept clean content', () => {
      const result = validateContent('Please pray for my family');
      expect(result.isValid).toBe(true);
    });
  });

  describe('money solicitation', () => {
    it('should block GoFundMe links in requests', () => {
      const result = validateContent('Please help: gofundme.com/my-campaign', {
        contentType: 'REQUEST',
      });
      expect(result.isValid).toBe(false);
      expect(result.containsMoneySolicitation).toBe(true);
    });

    it('should allow GoFundMe links in testimonies', () => {
      const result = validateContent('God provided through gofundme.com/my-campaign', {
        contentType: 'TESTIMONY',
      });
      expect(result.isValid).toBe(true);
      expect(result.warnings).toBeDefined();
    });

    it('should block PayPal/Venmo requests', () => {
      const result = validateContent('Send money to paypal.me/user');
      expect(result.isValid).toBe(false);
    });
  });

  describe('length validation', () => {
    it('should reject content below minimum length', () => {
      const result = validateContent('Hi', { minLength: 10 });
      expect(result.isValid).toBe(false);
    });

    it('should reject content above maximum length', () => {
      const result = validateContent('a'.repeat(3000), { maxLength: 2000 });
      expect(result.isValid).toBe(false);
    });
  });
});

describe('validateDisplayName', () => {
  it('should reject reserved names', () => {
    expect(validateDisplayName('Admin').isValid).toBe(false);
    expect(validateDisplayName('Moderator').isValid).toBe(false);
    expect(validateDisplayName('Lift Team').isValid).toBe(false);
  });

  it('should accept valid names', () => {
    expect(validateDisplayName('John Doe').isValid).toBe(true);
    expect(validateDisplayName("Mary O'Brien").isValid).toBe(true);
  });
});

describe('validateEmail', () => {
  it('rejects disposable domains', () => {
    const result = validateEmail('user@mailinator.com');
    expect(result.isValid).toBe(false);
  });

  it('accepts valid email', () => {
    const result = validateEmail('user@example.com');
    expect(result.isValid).toBe(true);
    expect(result.sanitized).toBe('user@example.com');
  });
});

describe('containsMoneySolicitation', () => {
  it('detects payment link', () => {
    expect(containsMoneySolicitation('paypal.me/test')).toBe(true);
  });

  it('ignores normal text', () => {
    expect(containsMoneySolicitation('Please pray for me')).toBe(false);
  });
});

describe('checkRateLimit', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // Reset rate limits between tests using unique keys
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should allow requests within limit', () => {
    const key = `test_user_${Date.now()}_1`;
    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit(key, 3, 60000)).toBe(true);
    }
  });

  it('should block requests exceeding limit', () => {
    const key = `test_user_${Date.now()}_2`;
    for (let i = 0; i < 4; i++) {
      checkRateLimit(key, 4, 60000);
    }
    expect(checkRateLimit(key, 4, 60000)).toBe(false);
  });

  it('should reset after window expires', () => {
    const key = `test_user_${Date.now()}_3`;
    // Use up all requests
    for (let i = 0; i < 3; i++) {
      checkRateLimit(key, 3, 60000);
    }
    expect(checkRateLimit(key, 3, 60000)).toBe(false);
    
    // Advance time past the window
    jest.advanceTimersByTime(61000);
    
    // Should be allowed again
    expect(checkRateLimit(key, 3, 60000)).toBe(true);
  });
});

describe('checkRateLimitWithInfo', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should return detailed rate limit info', () => {
    const key = `info_test_${Date.now()}_1`;
    const result = checkRateLimitWithInfo(key, 5, 60000);
    
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4); // 5 - 1 = 4 remaining
    expect(result.resetInMs).toBe(60000);
    expect(result.resetInSeconds).toBe(60);
  });

  it('should track remaining requests accurately', () => {
    const key = `info_test_${Date.now()}_2`;
    
    // First request
    let result = checkRateLimitWithInfo(key, 3, 60000);
    expect(result.remaining).toBe(2);
    
    // Second request
    result = checkRateLimitWithInfo(key, 3, 60000);
    expect(result.remaining).toBe(1);
    
    // Third request (last allowed)
    result = checkRateLimitWithInfo(key, 3, 60000);
    expect(result.remaining).toBe(0);
    expect(result.allowed).toBe(true);
    
    // Fourth request (blocked)
    result = checkRateLimitWithInfo(key, 3, 60000);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('should provide accurate cooldown time', () => {
    const key = `info_test_${Date.now()}_3`;
    
    // Use up all requests
    for (let i = 0; i < 3; i++) {
      checkRateLimitWithInfo(key, 3, 60000);
    }
    
    // Advance time by 30 seconds
    jest.advanceTimersByTime(30000);
    
    const result = checkRateLimitWithInfo(key, 3, 60000);
    expect(result.allowed).toBe(false);
    expect(result.resetInMs).toBeLessThanOrEqual(30000);
    expect(result.resetInSeconds).toBeLessThanOrEqual(30);
  });
});

describe('checkActionRateLimit', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should use correct limits for prayers action', () => {
    const userId = `user_prayers_${Date.now()}`;
    const config = RATE_LIMIT_CONFIG.prayers;
    
    // Should allow up to maxPerMinute prayers
    for (let i = 0; i < config.maxPerMinute; i++) {
      const result = checkActionRateLimit(userId, 'prayers');
      expect(result.allowed).toBe(true);
    }
    
    // Next one should be blocked
    const blocked = checkActionRateLimit(userId, 'prayers');
    expect(blocked.allowed).toBe(false);
  });

  it('should use correct limits for reports action', () => {
    const userId = `user_reports_${Date.now()}`;
    const config = RATE_LIMIT_CONFIG.reports;
    
    // Should allow up to maxPerMinute reports
    for (let i = 0; i < config.maxPerMinute; i++) {
      const result = checkActionRateLimit(userId, 'reports');
      expect(result.allowed).toBe(true);
    }
    
    // Next one should be blocked
    const blocked = checkActionRateLimit(userId, 'reports');
    expect(blocked.allowed).toBe(false);
  });

  it('should use correct limits for groupJoins action', () => {
    const userId = `user_groups_${Date.now()}`;
    const config = RATE_LIMIT_CONFIG.groupJoins;
    
    // Should allow up to maxPerHour group joins
    for (let i = 0; i < config.maxPerHour; i++) {
      const result = checkActionRateLimit(userId, 'groupJoins');
      expect(result.allowed).toBe(true);
    }
    
    // Next one should be blocked
    const blocked = checkActionRateLimit(userId, 'groupJoins');
    expect(blocked.allowed).toBe(false);
  });

  it('should use correct limits for reactions action', () => {
    const userId = `user_reactions_${Date.now()}`;
    const config = RATE_LIMIT_CONFIG.reactions;
    
    // Should allow up to maxPerMinute reactions
    for (let i = 0; i < config.maxPerMinute; i++) {
      const result = checkActionRateLimit(userId, 'reactions');
      expect(result.allowed).toBe(true);
    }
    
    // Next one should be blocked
    const blocked = checkActionRateLimit(userId, 'reactions');
    expect(blocked.allowed).toBe(false);
  });
});

describe('formatRateLimitError', () => {
  it('should format seconds correctly', () => {
    const error = formatRateLimitError('prayers', 45);
    expect(error).toBe('Too many prayers. Please wait 45 seconds.');
  });

  it('should format minutes correctly for longer waits', () => {
    const error = formatRateLimitError('comments', 120);
    expect(error).toBe('Too many comments. Please wait 2 minutes.');
  });

  it('should handle singular minute', () => {
    const error = formatRateLimitError('reports', 90);
    expect(error).toBe('Too many reports. Please wait 2 minutes.');
  });

  it('should use seconds for short waits', () => {
    const error = formatRateLimitError('reactions', 30);
    expect(error).toBe('Too many reactions. Please wait 30 seconds.');
  });
});

describe('resetRateLimit', () => {
  it('should reset rate limit for a key', () => {
    const key = `reset_test_${Date.now()}`;
    
    // Use up all requests
    for (let i = 0; i < 3; i++) {
      checkRateLimit(key, 3, 60000);
    }
    expect(checkRateLimit(key, 3, 60000)).toBe(false);
    
    // Reset the limit
    resetRateLimit(key);
    
    // Should be allowed again
    expect(checkRateLimit(key, 3, 60000)).toBe(true);
  });
});

describe('getRateLimitCooldown', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should return 0 for non-existent key', () => {
    const cooldown = getRateLimitCooldown(`nonexistent_${Date.now()}`);
    expect(cooldown).toBe(0);
  });

  it('should return remaining cooldown time', () => {
    const key = `cooldown_test_${Date.now()}`;
    
    // Make a request to start the window
    checkRateLimit(key, 3, 60000);
    
    // Advance time by 20 seconds
    jest.advanceTimersByTime(20000);
    
    const cooldown = getRateLimitCooldown(key);
    expect(cooldown).toBeLessThanOrEqual(40000);
    expect(cooldown).toBeGreaterThan(0);
  });
});
