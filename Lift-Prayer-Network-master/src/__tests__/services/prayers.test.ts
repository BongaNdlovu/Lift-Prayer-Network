import { logPrayer } from '../../services/prayers/core';

// Mock Firebase
jest.mock('../../services/firebase', () => ({
  db: {},
  firebaseEnabled: true,
}));

describe('logPrayer', () => {
  it('should reject invalid user ID', async () => {
    const result = await logPrayer('', 'request123', 'owner456', 'Test prayer');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid user ID');
  });

  it('should reject invalid request ID', async () => {
    const result = await logPrayer('user123', '', 'owner456', 'Test prayer');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid request ID');
  });
});
