import type { FieldValue, Timestamp } from 'firebase/firestore';

type TimeLike = Timestamp | FieldValue | Date | null;

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'RESOLVED' | 'PENDING';
export type RequestVisibility = 'PUBLIC' | 'PRIVATE' | 'GROUP';
export type SupportPreference = 'PRAYER_ONLY' | 'ENCOURAGEMENT_WELCOME' | 'FOLLOW_UP_WELCOME';
export type PrayerRequestUpdateType =
  | 'CONTINUE_PRAYING'
  | 'IMPROVED'
  | 'STILL_WAITING'
  | 'ANSWERED'
  | 'NO_LONGER_NEEDED';

export type PrayerCategory =
  | 'health'
  | 'family'
  | 'work'
  | 'finances'
  | 'relationships'
  | 'spiritual'
  | 'guidance'
  | 'protection'
  | 'gratitude'
  | 'other';

export const PRAYER_CATEGORIES: { id: PrayerCategory; label: string; emoji: string }[] = [
  { id: 'health', label: 'Health', emoji: '🩺' },
  { id: 'family', label: 'Family', emoji: '👨‍👩‍👧‍👦' },
  { id: 'work', label: 'Work', emoji: '💼' },
  { id: 'finances', label: 'Finances', emoji: '💰' },
  { id: 'relationships', label: 'Relationships', emoji: '🤝' },
  { id: 'spiritual', label: 'Spiritual', emoji: '🙏' },
  { id: 'guidance', label: 'Guidance', emoji: '🧭' },
  { id: 'protection', label: 'Protection', emoji: '🛡️' },
  { id: 'gratitude', label: 'Gratitude', emoji: '🙌' },
  { id: 'other', label: 'Other', emoji: '📝' },
];

export type NotificationSettings = {
  enabled: boolean;
  prayers: boolean;
  comments: boolean;
  testimonies: boolean;
  critical: boolean;
  groups: boolean;
};

export type LiftRequest = {
  id: string;
  ownerUid: string;
  userDisplayName: string;
  userEmail?: string;
  userPhotoURL?: string | null;
  title?: string;
  content: string;
  severity: Severity;
  prayers: number;
  status: 'PENDING' | 'ACTIVE' | 'RESOLVED' | 'ANSWERED' | 'ARCHIVED';
  category?: PrayerCategory;
  isUrgent?: boolean;
  isPrivate?: boolean;
  isAnonymous?: boolean;
  groupIds?: string[];
  visibility?: RequestVisibility;
  supportPreference?: SupportPreference;
  location?: string;
  createdAt?: TimeLike;
  updatedAt?: TimeLike;
  answeredAt?: TimeLike;
  answerReflection?: string;
  answerVisibility?: RequestVisibility;
  linkedTestimonyId?: string;
  commentCount?: number;
  // Reaction counts
  heartCount?: number;
  fireCount?: number;
  strongCount?: number;
  // Pinned feature - only admin can pin
  isPinned?: boolean;
  pinnedAt?: TimeLike;
  pinnedBy?: string;
};

export type Testimony = {
  id: string;
  ownerUid: string;
  userDisplayName: string;
  userEmail?: string;
  userPhotoURL?: string | null;
  content: string;
  severity: 'RESOLVED';
  likes: number;
  linkedRequestId?: string;
  location?: string;
  createdAt?: TimeLike;
  commentCount?: number;
  // Reaction counts
  heartCount?: number;
  fireCount?: number;
  // Privacy options (default: PUBLIC for backward compatibility)
  isPrivate?: boolean;
  visibility?: 'PUBLIC' | 'PRIVATE' | 'GROUP';
  groupIds?: string[];
};

export type Comment = {
  id: string;
  parentId: string;
  parentType: 'REQUEST' | 'TESTIMONY';
  authorUid: string;
  authorName: string;
  content: string;
  hiddenByOwner?: boolean;
  createdAt?: TimeLike;
};

export type PrayerRequestUpdate = {
  id: string;
  requestId: string;
  ownerUid: string;
  text: string;
  updateType: PrayerRequestUpdateType;
  createdAt?: TimeLike;
};

export type PrayerGroup = {
  id: string;
  name: string;
  description?: string;
  emoji?: string;
  photoURL?: string | null;
  ownerUid: string;
  memberUids: string[];
  isPrivate: boolean;
  createdAt?: TimeLike;
  // Indexed invite code for efficient lookups
  inviteCode?: string;
  // Pending join requests (for private groups)
  pendingRequests?: string[];
  // Users blocked from posting in this group
  blockedFromPosting?: string[];
};

export type PrayerReminder = {
  id: string;
  userId: string;
  time: string;
  days: number[];
  enabled: boolean;
  message?: string;
};

export type PrayerPromise = {
  id: string;
  userId: string;
  requestId: string;
  requestOwnerUid: string;
  requestSummary: string;
  requestCategory?: PrayerCategory;
  requestIsUrgent?: boolean;
  createdAt?: TimeLike;
  lastPrayedAt?: TimeLike;
  nextReminderAt?: TimeLike;
  reminderFrequency: 'once' | 'daily' | 'weekly' | 'none';
  status: 'ACTIVE' | 'PRAYED_TODAY' | 'ANSWERED' | 'ARCHIVED';
  prayedCount: number;
};

export type FeedItem =
  | (LiftRequest & { type: 'REQUEST' })
  | (Testimony & { type: 'TESTIMONY' });

export type PrayerRecord = {
  id: string;
  actorUid: string;
  targetRequestId: string;
  targetOwnerUid: string;
  targetSummary: string;
  prayedAt?: TimeLike;
  note?: string;
  status: 'PRAYED';
};

export type PeopleStat = {
  id: string;
  targetOwnerUid: string;
  targetName?: string;
  count: number;
  lastPrayedAt?: TimeLike;
};

export type FollowRecord = {
  id: string;
  targetUid: string;
  targetDisplayName: string;
  targetPhotoURL?: string | null;
  followedAt?: TimeLike;
};

export type UserProfile = {
  displayName: string;
  email?: string;
  photoURL?: string | null;
  location?: string;
  timeZone?: string;
  createdAt?: TimeLike;
  lastActiveAt?: TimeLike;
  lastPrayedAt?: TimeLike;
  roles?: string[];
  stats?: {
    prayerCount: number;
    testimonyCount?: number;
    requestCount?: number;
    streakDays?: number;
    streakLastDate?: string;
    longestStreak?: number;
    prayersThisWeek?: number;
    prayersThisMonth?: number;
    currentStreakStart?: string;
    streakFreezeUsed?: boolean;
  };
  settings?: {
    notifications?: boolean;
    notificationsCritical?: boolean;
    notificationsPrayers?: boolean;
    notificationsComments?: boolean;
    notificationsTestimonies?: boolean;
    notificationsGroups?: boolean;
    weeklyRecapEnabled?: boolean;
    weeklyRecapDay?: number;
    weeklyRecapTime?: string;
    shareProfile?: boolean;
    reminderTime?: string;
    reminderDays?: number[];
    notificationSettings?: NotificationSettings;
  };
  groupIds?: string[];
};
