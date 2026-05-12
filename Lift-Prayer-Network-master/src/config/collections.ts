export const COLLECTIONS = {
  users: 'users',
  requests: 'requests',
  testimonies: 'testimonies',
  reactions: 'reactions',
  prayers: 'prayers',
  userPrayedFor: 'userPrayedFor',
  groups: 'groups',
  comments: 'comments',
  reports: 'reports',
  prayerRequestUpdates: 'prayerRequestUpdates',
  stats: 'stats',
  onboardingAnalytics: 'onboarding_analytics',
  notifications: 'notifications',
  announcements: 'announcements',
  devotions: 'devotions',
  following: 'following',
  studyGuides: 'studyGuides',
  userStudyStats: 'userStudyStats',
  prayerPromises: 'prayerPromises',
  userProgress: 'userProgress',
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];
