/**
 * Prayers Service
 * 
 * This module handles all prayer-related operations including:
 * - Logging prayers and tracking streaks
 * - Group prayer requests
 * - CRUD operations for requests and testimonies
 * - Admin functions (pin/unpin)
 * 
 * Re-exports all functions for backward compatibility.
 */

// Types
export type {
  ServiceResult,
  LogPrayerResult,
  EditRequestData,
  EditTestimonyData,
} from './types';

// Core prayer functions
export { hasUserPrayed, logPrayer, logReaction, likeTestimony } from './core';
export type { ReactionType } from './core';

// Group functions
export { subscribeToGroupRequests, submitGroupRequest } from './groups';

// CRUD operations
export {
  editPrayerRequest,
  editTestimony,
  deletePrayerRequest,
  deleteTestimony,
  getPrayerRequest,
  getTestimony,
  deletePrayerHistory,
} from './crud';

// Admin functions
export { pinRequest, unpinRequest } from './admin';
