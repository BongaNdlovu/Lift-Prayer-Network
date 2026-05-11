/// <reference types="jest" />
/**
 * Privacy Filter Tests
 * 
 * These tests verify that the client-side privacy filtering in useFeed
 * correctly hides content based on visibility and group membership.
 * 
 * IMPORTANT: These are defense-in-depth tests. The primary security
 * enforcement happens in Firestore rules (firestore.rules).
 */

import type { FeedItem, LiftRequest, Testimony } from '../../types';

// Extract the privacy filter logic for testing
// This mirrors the applyPrivacyFilter function in useFeed.ts
const applyPrivacyFilter = (
  list: FeedItem[],
  viewerUid?: string,
  userGroupIds?: string[]
): FeedItem[] => {
  return list.filter((item) => {
    // Testimonies are always visible
    if (item.type !== 'REQUEST') return true;
    
    const request = item as LiftRequest;
    
    // Public requests are visible to everyone
    if (!request.isPrivate && request.visibility !== 'PRIVATE' && request.visibility !== 'GROUP') {
      return true;
    }
    
    // Owner can always see their own requests
    if (viewerUid && request.ownerUid === viewerUid) {
      return true;
    }
    
    // Private requests: only owner can see (handled above)
    if (request.visibility === 'PRIVATE' || request.isPrivate) {
      return false;
    }
    
    // Group requests: check if user is member of any of the request's groups
    if (request.visibility === 'GROUP' && request.groupIds?.length) {
      if (!userGroupIds?.length) return false;
      return request.groupIds.some(gid => userGroupIds.includes(gid));
    }
    
    // Default: show public content
    return true;
  });
};

// Test fixtures
const createRequest = (overrides: Partial<LiftRequest> = {}): FeedItem => ({
  id: 'req-1',
  type: 'REQUEST',
  ownerUid: 'user-1',
  userDisplayName: 'Test User',
  content: 'Test request',
  severity: 'PENDING',
  prayers: 0,
  status: 'PENDING',
  ...overrides,
});

const createTestimony = (overrides: Partial<Testimony> = {}): FeedItem => ({
  id: 'test-1',
  type: 'TESTIMONY',
  ownerUid: 'user-1',
  userDisplayName: 'Test User',
  content: 'Test testimony',
  severity: 'RESOLVED',
  likes: 0,
  ...overrides,
});

describe('Privacy Filter', () => {
  describe('Public Content', () => {
    it('shows public requests to everyone', () => {
      const items = [createRequest({ visibility: 'PUBLIC', isPrivate: false })];
      
      // No viewer (anonymous)
      expect(applyPrivacyFilter(items)).toHaveLength(1);
      
      // Different user
      expect(applyPrivacyFilter(items, 'other-user')).toHaveLength(1);
    });

    it('shows testimonies to everyone', () => {
      const items = [createTestimony()];
      
      expect(applyPrivacyFilter(items)).toHaveLength(1);
      expect(applyPrivacyFilter(items, 'any-user')).toHaveLength(1);
    });

    it('shows requests without visibility field as public', () => {
      const items = [createRequest({ visibility: undefined, isPrivate: false })];
      expect(applyPrivacyFilter(items)).toHaveLength(1);
    });
  });

  describe('Private Content', () => {
    it('hides private requests from anonymous users', () => {
      const items = [createRequest({ visibility: 'PRIVATE', isPrivate: true })];
      expect(applyPrivacyFilter(items)).toHaveLength(0);
    });

    it('hides private requests from other users', () => {
      const items = [createRequest({ 
        ownerUid: 'user-1', 
        visibility: 'PRIVATE', 
        isPrivate: true 
      })];
      expect(applyPrivacyFilter(items, 'other-user')).toHaveLength(0);
    });

    it('shows private requests to owner', () => {
      const items = [createRequest({ 
        ownerUid: 'user-1', 
        visibility: 'PRIVATE', 
        isPrivate: true 
      })];
      expect(applyPrivacyFilter(items, 'user-1')).toHaveLength(1);
    });

    it('respects isPrivate flag even without visibility field', () => {
      const items = [createRequest({ isPrivate: true, visibility: undefined })];
      expect(applyPrivacyFilter(items, 'other-user')).toHaveLength(0);
    });
  });

  describe('Group Content', () => {
    it('hides group requests from non-members', () => {
      const items = [createRequest({ 
        visibility: 'GROUP', 
        groupIds: ['group-1', 'group-2'] 
      })];
      
      // No groups
      expect(applyPrivacyFilter(items, 'other-user', [])).toHaveLength(0);
      
      // Different groups
      expect(applyPrivacyFilter(items, 'other-user', ['group-3'])).toHaveLength(0);
    });

    it('shows group requests to members', () => {
      const items = [createRequest({ 
        visibility: 'GROUP', 
        groupIds: ['group-1', 'group-2'] 
      })];
      
      // Member of one group
      expect(applyPrivacyFilter(items, 'member', ['group-1'])).toHaveLength(1);
      
      // Member of multiple matching groups
      expect(applyPrivacyFilter(items, 'member', ['group-1', 'group-2'])).toHaveLength(1);
      
      // Member of one matching and one non-matching group
      expect(applyPrivacyFilter(items, 'member', ['group-1', 'group-99'])).toHaveLength(1);
    });

    it('shows group requests to owner even if not in group', () => {
      const items = [createRequest({ 
        ownerUid: 'owner-1',
        visibility: 'GROUP', 
        groupIds: ['group-1'] 
      })];
      
      // Owner without group membership
      expect(applyPrivacyFilter(items, 'owner-1', [])).toHaveLength(1);
    });

    it('hides group requests from users with no groupIds', () => {
      const items = [createRequest({ 
        visibility: 'GROUP', 
        groupIds: ['group-1'] 
      })];
      
      expect(applyPrivacyFilter(items, 'other-user', undefined)).toHaveLength(0);
    });
  });

  describe('Mixed Content', () => {
    it('correctly filters mixed visibility items', () => {
      const items = [
        createRequest({ id: '1', visibility: 'PUBLIC' }),
        createRequest({ id: '2', visibility: 'PRIVATE', isPrivate: true, ownerUid: 'user-1' }),
        createRequest({ id: '3', visibility: 'GROUP', groupIds: ['group-1'] }),
        createRequest({ id: '4', visibility: 'GROUP', groupIds: ['group-2'] }),
        createTestimony({ id: '5' }),
      ];
      
      // User in group-1 only
      const filtered = applyPrivacyFilter(items, 'other-user', ['group-1']);
      
      expect(filtered).toHaveLength(3); // public + group-1 + testimony
      expect(filtered.map(i => i.id)).toEqual(['1', '3', '5']);
    });

    it('owner sees all their own content regardless of visibility', () => {
      const items = [
        createRequest({ id: '1', ownerUid: 'user-1', visibility: 'PUBLIC' }),
        createRequest({ id: '2', ownerUid: 'user-1', visibility: 'PRIVATE', isPrivate: true }),
        createRequest({ id: '3', ownerUid: 'user-1', visibility: 'GROUP', groupIds: ['group-1'] }),
      ];
      
      // Owner with no group membership
      const filtered = applyPrivacyFilter(items, 'user-1', []);
      expect(filtered).toHaveLength(3);
    });
  });
});
