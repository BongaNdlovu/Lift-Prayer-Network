import type { FieldValue, Timestamp } from 'firebase/firestore';

type TimeLike = Timestamp | FieldValue | Date | null;

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'RESOLVED' | 'PENDING';

export type LiftRequest = {
  id: string;
  ownerUid: string;
  userDisplayName: string;
  location: string;
  content: string;
  severity: Severity;
  prayers: number;
  status: 'PENDING' | 'ACTIVE' | 'RESOLVED';
  createdAt?: TimeLike;
};

export type Testimony = {
  id: string;
  ownerUid: string;
  userDisplayName: string;
  location: string;
  content: string;
  severity: 'RESOLVED';
  likes: number;
  createdAt?: TimeLike;
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
  roles?: string[];
  stats?: {
    prayerCount: number;
    testimonyCount?: number;
    streakDays?: number;
  };
  settings?: {
    notifications?: boolean;
    notificationsCritical?: boolean;
    shareProfile?: boolean;
  };
};
