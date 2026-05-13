import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  queuePendingPrayer,
  clearAllCache,
  getCacheStats,
} from '../../services/offlineCache';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
  multiRemove: jest.fn(),
}));

describe('offlineCache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('queuePendingPrayer', () => {
    it('should add prayer to queue', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      
      await queuePendingPrayer({
        requestId: 'req123',
        actorUid: 'user456',
        targetOwnerUid: 'owner789',
        targetSummary: 'Test prayer',
      });

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@lift_pending_prayers',
        expect.stringContaining('req123')
      );
    });
  });

  describe('clearAllCache', () => {
    it('should clear all cache keys including pending queues', async () => {
      await clearAllCache();

      expect(AsyncStorage.multiRemove).toHaveBeenCalledWith([
        '@lift_cache_requests',
        '@lift_cache_testimonies',
        '@lift_pending_prayers',
        '@lift_pending_requests',
        '@lift_pending_comments',
        '@lift_pending_reactions',
        '@lift_pending_promises',
        '@lift_last_sync',
        '@lift_current_user',
        '@lift_analytics_queue',
        '@lift_onboarding_answers',
        '@lift_has_ever_signed_in',
      ]);
    });
  });

  describe('getCacheStats', () => {
    it('returns zero counts when storage empty', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      const stats = await getCacheStats();
      expect(stats.pendingPrayers).toBe(0);
      expect(stats.pendingRequests).toBe(0);
    });
  });
});
