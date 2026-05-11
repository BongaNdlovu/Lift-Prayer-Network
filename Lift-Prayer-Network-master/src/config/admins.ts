/**
 * Admin and Verified User Configuration
 * 
 * This file contains the list of verified/admin users who get special badges
 * and elevated permissions throughout the app.
 */

// List of email addresses that are verified admins/app owners
export const VERIFIED_ADMIN_EMAILS: string[] = [
  'fanelesibonge50@gmail.com',
];

// List of user UIDs that are verified (alternative to email check)
export const VERIFIED_ADMIN_UIDS: string[] = [];

// Badge types for different verification levels
export type BadgeType = 'admin' | 'verified' | 'moderator' | 'emailVerified';

// Permission levels
export type PermissionLevel = 'user' | 'moderator' | 'admin';

export interface VerifiedUser {
  email?: string;
  uid?: string;
  badgeType: BadgeType;
  badgeLabel: string;
  permissionLevel: PermissionLevel;
}

// Detailed verified users list with custom badge types
export const VERIFIED_USERS: VerifiedUser[] = [
  {
    email: 'fanelesibonge50@gmail.com',
    badgeType: 'admin',
    badgeLabel: 'App Creator',
    permissionLevel: 'admin',
  },
  {
    email: 'kellyconning@gmail.com',
    badgeType: 'moderator',
    badgeLabel: 'Moderator',
    permissionLevel: 'moderator',
  },
];

/**
 * Check if a user email is a verified admin
 */
export const isVerifiedAdmin = (email?: string | null): boolean => {
  if (!email) return false;
  return VERIFIED_ADMIN_EMAILS.includes(email.toLowerCase());
};

/**
 * Check if a user UID is a verified admin
 */
export const isVerifiedAdminByUid = (uid?: string | null): boolean => {
  if (!uid) return false;
  return VERIFIED_ADMIN_UIDS.includes(uid);
};

/**
 * Get the badge info for a verified user
 */
export const getVerifiedBadge = (email?: string | null, uid?: string | null): VerifiedUser | null => {
  if (!email && !uid) return null;
  
  const user = VERIFIED_USERS.find(
    (v) => 
      (email && v.email?.toLowerCase() === email.toLowerCase()) ||
      (uid && v.uid === uid)
  );
  
  return user || null;
};

/**
 * Get user's permission level
 */
export const getUserPermissionLevel = (email?: string | null, uid?: string | null): PermissionLevel => {
  const verifiedUser = getVerifiedBadge(email, uid);
  return verifiedUser?.permissionLevel || 'user';
};

/**
 * Check if user has admin permission level
 */
export const hasAdminPermission = (email?: string | null, uid?: string | null): boolean => {
  return getUserPermissionLevel(email, uid) === 'admin';
};

/**
 * Check if user has moderator or higher permission level
 */
export const hasModeratorPermission = (email?: string | null, uid?: string | null): boolean => {
  const level = getUserPermissionLevel(email, uid);
  return level === 'admin' || level === 'moderator';
};

/**
 * Permission check utilities for content management
 */
export const canEditContent = (
  contentOwnerUid: string,
  currentUserUid?: string | null,
  currentUserEmail?: string | null
): boolean => {
  if (!currentUserUid) return false;
  
  // Admins can edit anything
  if (hasAdminPermission(currentUserEmail)) return true;
  
  // Users can only edit their own content
  return contentOwnerUid === currentUserUid;
};

export const canDeleteContent = (
  contentOwnerUid: string,
  currentUserUid?: string | null,
  currentUserEmail?: string | null
): boolean => {
  if (!currentUserUid) return false;
  
  // Admins and Moderators can delete any content
  if (hasModeratorPermission(currentUserEmail)) return true;
  
  // Users can only delete their own content
  return contentOwnerUid === currentUserUid;
};

export const canModerateContent = (
  currentUserEmail?: string | null,
  currentUserUid?: string | null
): boolean => {
  return hasModeratorPermission(currentUserEmail, currentUserUid);
};

/**
 * Badge styling config
 */
export const BADGE_STYLES = {
  admin: {
    backgroundColor: '#3b82f6',
    textColor: '#ffffff',
    icon: 'checkmark-circle',
    emoji: '✓',
  },
  verified: {
    backgroundColor: '#22c55e',
    textColor: '#ffffff',
    icon: 'shield-checkmark',
    emoji: '✓',
  },
  moderator: {
    backgroundColor: '#8b5cf6',
    textColor: '#ffffff',
    icon: 'shield',
    emoji: '🛡️',
  },
  emailVerified: {
    backgroundColor: 'transparent',
    textColor: '#16a34a',
    icon: 'checkmark-circle',
    emoji: '✓',
    showLabelOnly: false, // Only show icon, no text
  },
} as const;

/**
 * Email verified badge info (for users who verified their email)
 */
export const EMAIL_VERIFIED_BADGE: VerifiedUser = {
  badgeType: 'emailVerified',
  badgeLabel: '', // No label, just icon
  permissionLevel: 'user',
};
