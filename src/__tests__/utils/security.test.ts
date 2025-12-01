import {
  validateContent,
  validateDisplayName,
  validateEmail,
  containsMoneySolicitation,
  checkRateLimit,
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
  });

  it('should allow requests within limit', () => {
    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit('test_user', 3, 60000)).toBe(true);
    }
  });

  it('should block requests exceeding limit', () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit('test_user_2', 4, 60000);
    }
    expect(checkRateLimit('test_user_2', 4, 60000)).toBe(false);
  });
});
