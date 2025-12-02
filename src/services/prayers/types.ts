import type { FieldValue } from 'firebase/firestore';
import type { PrayerCategory, Severity } from '../../types';

// ============================================================================
// Types & Interfaces
// ============================================================================

/** Standard result type for all mutation operations */
export type ServiceResult<T = void> = {
  success: boolean;
  error?: string;
  data?: T;
};

/** Result type for logPrayer with additional flags */
export type LogPrayerResult = ServiceResult & {
  alreadyPrayed?: boolean;
  isSelfPrayer?: boolean;
};

/** Data for editing a prayer request */
export type EditRequestData = {
  content?: string;
  category?: PrayerCategory;
  isUrgent?: boolean;
  isPrivate?: boolean;
};

/** Data for editing a testimony */
export type EditTestimonyData = {
  content?: string;
};

/** Update data for request status progression */
export type RequestUpdateData = {
  prayers: FieldValue;
  status?: 'PENDING' | 'ACTIVE' | 'RESOLVED';
  severity?: Severity;
  activatedAt?: FieldValue;
  [key: string]: unknown;
};

/** Update data for request edits */
export type RequestEditUpdateData = {
  updatedAt: FieldValue;
  content?: string;
  category?: PrayerCategory;
  isUrgent?: boolean;
  isPrivate?: boolean;
  visibility?: 'PUBLIC' | 'PRIVATE' | 'GROUP';
  severity?: Severity;
  [key: string]: unknown;
};

/** Update data for testimony edits */
export type TestimonyEditUpdateData = {
  updatedAt: FieldValue;
  content?: string;
  [key: string]: unknown;
};

// ============================================================================
// Constants
// ============================================================================

/** After this many prayers, status changes from PENDING to ACTIVE */
export const PRAYERS_FOR_ACTIVE = 1;

/** Maximum operations per Firestore batch */
export const BATCH_SIZE = 500;
