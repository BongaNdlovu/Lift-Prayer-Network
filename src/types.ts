import type { FieldValue, Timestamp } from 'firebase/firestore';

type TimeLike = Timestamp | FieldValue | Date | null;

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'RESOLVED' | 'PENDING';

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
  content: string;
  severity: Severity;
  prayers: number;
  status: 'PENDING' | 'ACTIVE' | 'RESOLVED';
  category?: PrayerCategory;
  isUrgent?: boolean;
  isPrivate?: boolean;
  isAnonymous?: boolean;
  groupIds?: string[];
  visibility?: 'PUBLIC' | 'PRIVATE' | 'GROUP';
  location?: string;
  createdAt?: TimeLike;
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
};

export type PrayerReminder = {
  id: string;
  userId: string;
  time: string;
  days: number[];
  enabled: boolean;
  message?: string;
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
