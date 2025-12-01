# Lift Mobile App - Improvement Plan

**Document Version:** 1.0  
**Date:** November 30, 2025  
**Status:** Ready for Implementation

---

## Executive Summary

This document outlines improvements to existing features in the Lift mobile application, focusing on security hardening, data integrity, moderation completeness, and developer experience. These changes build upon the security fixes documented in `SECURITY_FIXES.md`.

### Improvement Categories

| # | Category | Priority | Effort | Impact |
|---|----------|----------|--------|--------|
| 1 | Ownership & Data Integrity | **High** | Medium | Security, Data Consistency |
| 2 | Content Validation | **High** | Low | Security, UX |
| 3 | Moderation & Reporting | **Medium-High** | Medium | Trust & Safety |
| 4 | Groups & Media | **Medium** | Medium-High | Performance, Cost |
| 5 | Offline & Sync | **Medium** | Low-Medium | UX, Reliability |
| 6 | Notifications | **Low-Medium** | Medium | UX, Privacy |
| 7 | Testing | **Medium** | Medium | Reliability, Maintainability |

---

## Category 1: Ownership & Data Integrity

### Issue 1.1: Anonymous ownerUid Pattern

#### Description

Content creation currently falls back to `'anonymous'` as the `ownerUid` when no user ID is provided. This breaks edit/delete permissions and creates inconsistent data.

#### Affected Code

**File:** `src/hooks/useFeed.ts`  
**Line:** 328

```typescript
// CURRENT (PROBLEMATIC)
const baseDoc: any = {
  ownerUid: ownerUid || 'anonymous',  // <-- Breaks ownership
  userDisplayName: displayName || 'Anonymous',
  // ...
};
```

#### Impact

- Users cannot edit/delete their own content if created without proper UID
- Firestore rules fail ownership checks
- Inconsistent data model

#### Remediation

**File:** `src/hooks/useFeed.ts`

```typescript
// FIXED
export const submitFeedItem = async (
  mode: Mode,
  content: string,
  ownerUid: string,  // Required - no longer optional
  displayName: string | undefined,
  options?: {
    // ... existing options
    isAnonymous?: boolean;  // Use this for display, not fake UID
  }
) => {
  if (!ownerUid) {
    throw new Error('Authentication required to create content');
  }

  const baseDoc: any = {
    ownerUid,  // Always real UID
    userDisplayName: options?.isAnonymous ? 'Anonymous' : (displayName || 'Anonymous'),
    isAnonymous: options?.isAnonymous || false,  // Flag for display purposes
    // ...
  };
};
```

**Update callers** in:
- `src/screens/CreateRequestScreen.tsx`
- `src/screens/CreateTestimonyScreen.tsx`
- `src/services/offlineSync.ts`

#### Verification

1. Create content while signed in - verify `ownerUid` matches `user.uid`
2. Create anonymous content - verify `ownerUid` is real UID, `isAnonymous: true`
3. Verify edit/delete still works for own content

---

### Issue 1.2: Incomplete Account Deletion

#### Description

The `deleteAccount` function only deletes the Firebase Auth user, leaving orphaned data in Firestore (prayers, requests, testimonies, comments, reports, group memberships).

#### Affected Code

**File:** `src/hooks/useAuth.tsx`  
**Lines:** 294-314

```typescript
// CURRENT (INCOMPLETE)
const deleteAccount = useCallback(async (password?: string): Promise<void> => {
  // ... re-authentication logic
  await deleteUser(currentUser);  // Only deletes Auth user
  // Missing: Firestore cleanup
}, []);
```

#### Remediation

**Option A: Cloud Function (Recommended)**

**File:** `cloud-functions/index.js`

```javascript
const { onUserDeleted } = require('firebase-functions/v2/identity');

exports.onUserDeleted = onUserDeleted(async (event) => {
  const uid = event.uid;
  const batch = db.batch();
  
  console.log(`Cleaning up data for deleted user: ${uid}`);
  
  try {
    // 1. Delete or anonymize prayers
    const prayers = await db.collection('prayers')
      .where('actorUid', '==', uid)
      .get();
    prayers.forEach(doc => batch.delete(doc.ref));
    
    // 2. Anonymize requests (preserve for prayer history)
    const requests = await db.collection('requests')
      .where('ownerUid', '==', uid)
      .get();
    requests.forEach(doc => {
      batch.update(doc.ref, {
        ownerUid: 'deleted_user',
        userDisplayName: 'Deleted User',
        userEmail: null,
        userPhotoURL: null,
      });
    });
    
    // 3. Anonymize testimonies
    const testimonies = await db.collection('testimonies')
      .where('ownerUid', '==', uid)
      .get();
    testimonies.forEach(doc => {
      batch.update(doc.ref, {
        ownerUid: 'deleted_user',
        userDisplayName: 'Deleted User',
        userEmail: null,
        userPhotoURL: null,
      });
    });
    
    // 4. Delete comments
    const comments = await db.collection('comments')
      .where('authorUid', '==', uid)
      .get();
    comments.forEach(doc => batch.delete(doc.ref));
    
    // 5. Delete reports by user
    const reports = await db.collection('reports')
      .where('actorUid', '==', uid)
      .get();
    reports.forEach(doc => batch.delete(doc.ref));
    
    // 6. Remove from groups
    const groups = await db.collection('groups')
      .where('memberUids', 'array-contains', uid)
      .get();
    groups.forEach(doc => {
      const memberUids = doc.data().memberUids.filter(id => id !== uid);
      batch.update(doc.ref, { memberUids });
    });
    
    // 7. Delete user document
    batch.delete(db.doc(`users/${uid}`));
    
    // 8. Delete push tokens
    const tokens = await db.collection(`users/${uid}/pushTokens`).get();
    tokens.forEach(doc => batch.delete(doc.ref));
    
    // 9. Delete notifications
    const notifications = await db.collection('notifications')
      .where('recipientUid', '==', uid)
      .get();
    notifications.forEach(doc => batch.delete(doc.ref));
    
    await batch.commit();
    console.log(`Successfully cleaned up data for user: ${uid}`);
  } catch (error) {
    console.error(`Error cleaning up user data for ${uid}:`, error);
    // Log to error collection for manual review
    await db.collection('deletionErrors').add({
      uid,
      error: error.message,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
});
```

**Option B: Client-Side Pre-Deletion**

If Cloud Function triggers are unreliable, call a cleanup function before `deleteUser()`:

**File:** `src/services/userCleanup.ts` (new file)

```typescript
export const cleanupUserData = async (uid: string): Promise<void> => {
  // Call a callable Cloud Function that performs cleanup
  const cleanupFn = httpsCallable(functions, 'cleanupUserData');
  await cleanupFn({ uid });
};
```

---

## Category 2: Content Validation

### Issue 2.1: Comments Missing Validation

#### Description

The `addComment` function accepts raw content without profanity/spam checks, while `validateContent` exists but isn't used.

#### Affected Code

**File:** `src/services/comments.ts`  
**Lines:** 20-51

```typescript
// CURRENT (NO VALIDATION)
export const addComment = async (
  parentId: string,
  parentType: 'REQUEST' | 'TESTIMONY',
  authorUid: string,
  authorName: string,
  content: string  // <-- Raw, unvalidated
): Promise<string | null> => {
  // ... directly writes to Firestore
};
```

#### Remediation

**File:** `src/services/comments.ts`

```typescript
import { validateContent } from '../utils/security';

export const addComment = async (
  parentId: string,
  parentType: 'REQUEST' | 'TESTIMONY',
  authorUid: string,
  authorName: string,
  content: string
): Promise<string | null> => {
  if (!firebaseEnabled || !db) return null;

  // Validate content
  const validation = validateContent(content, {
    minLength: 1,
    maxLength: 500,
    checkProfanity: true,
    checkSuspicious: true,
    checkMoneySolicitation: true,
    contentType: 'REQUEST',  // Use strict validation for comments
  });

  if (!validation.isValid) {
    throw new Error(validation.error || 'Invalid comment content');
  }

  try {
    const commentRef = await addDoc(collection(db, 'comments'), {
      parentId,
      parentType,
      authorUid,
      authorName,
      content: validation.sanitized || content.trim(),
      createdAt: serverTimestamp(),
    });
    // ... rest of function
  }
};
```

**Update UI** in `src/screens/home/RequestDetailScreen.tsx` to catch and display validation errors.

---

### Issue 2.2: Profile Validation Not Wired

#### Description

`validateDisplayName` and `validateEmail` helpers exist in `security.ts` but aren't used in profile editing UI.

#### Affected Files

- `src/screens/ProfileScreen.tsx`
- `src/screens/SettingsScreen.tsx`
- `src/screens/OnboardingScreen.tsx`

#### Remediation

**Example for ProfileScreen.tsx:**

```typescript
import { validateDisplayName } from '../utils/security';

const handleSaveProfile = async () => {
  // Validate display name
  const nameValidation = validateDisplayName(displayName);
  if (!nameValidation.isValid) {
    Alert.alert('Invalid Name', nameValidation.error);
    return;
  }

  // Use sanitized value
  await updateProfile(user, { 
    displayName: nameValidation.sanitized 
  });
};
```

---

## Category 3: Moderation & Reporting

### Issue 3.1: Comments Cannot Be Reported

#### Description

`flagContent` only supports `'REQUEST' | 'TESTIMONY'` types. Comments have no report mechanism.

#### Remediation

**File:** `src/services/requests.ts`

```typescript
// UPDATED
export const flagContent = async (
  actorUid: string,
  targetId: string,
  targetType: 'REQUEST' | 'TESTIMONY' | 'COMMENT',  // Added COMMENT
  reason: string,
): Promise<void> => {
  if (!firebaseEnabled || !db) return;

  if (!actorUid) {
    throw new Error('Authentication required to report content');
  }

  // Rate limiting
  if (!checkRateLimit(`report_${actorUid}`, 5, 60000)) {
    throw new Error('Too many reports. Please wait a minute before reporting again.');
  }

  await addDoc(collection(db, 'reports'), {
    actorUid,
    targetId,
    targetType,
    reason,
    status: 'PENDING',
    createdAt: Timestamp.now(),
  });
};
```

**Update Firestore Rules** (if needed for COMMENT type validation).

**Add UI** in `RequestDetailScreen.tsx` comment section:

```typescript
const handleReportComment = (commentId: string) => {
  Alert.prompt(
    'Report Comment',
    'Why are you reporting this comment?',
    async (reason) => {
      if (reason?.trim()) {
        await flagContent(user.uid, commentId, 'COMMENT', reason.trim());
        Alert.alert('Reported', 'Thank you for helping keep our community safe.');
      }
    }
  );
};
```

---

### Issue 3.2: No Client Rate Limiting for Reports

#### Description

While Firestore rules now require auth, there's no client-side throttling to prevent rapid report submission.

#### Remediation

Already shown above - add `checkRateLimit` call in `flagContent`.

---

### Issue 3.3: No Admin Reports View

#### Description

Admins must use Firebase Console to review reports. No in-app moderation interface exists.

#### Remediation

**New File:** `src/screens/admin/ReportsScreen.tsx`

```typescript
import React, { useEffect, useState } from 'react';
import { View, FlatList, Text, TouchableOpacity, Alert } from 'react-native';
import { collection, query, where, orderBy, onSnapshot, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { hasAdminPermission } from '../../config/admins';
import { useAuth } from '../../hooks/useAuth';

type Report = {
  id: string;
  actorUid: string;
  targetId: string;
  targetType: 'REQUEST' | 'TESTIMONY' | 'COMMENT';
  reason: string;
  status: 'PENDING' | 'REVIEWED' | 'RESOLVED' | 'DISMISSED';
  createdAt: any;
};

export const ReportsScreen: React.FC = () => {
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  // Check admin access
  if (!hasAdminPermission(user?.email)) {
    return <Text>Access Denied</Text>;
  }

  useEffect(() => {
    const q = query(
      collection(db, 'reports'),
      where('status', '==', 'PENDING'),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Report[];
      setReports(data);
      setLoading(false);
    });

    return unsub;
  }, []);

  const handleAction = async (reportId: string, action: 'dismiss' | 'hide' | 'delete') => {
    const report = reports.find(r => r.id === reportId);
    if (!report) return;

    try {
      if (action === 'dismiss') {
        await updateDoc(doc(db, 'reports', reportId), { status: 'DISMISSED' });
      } else if (action === 'hide') {
        // Hide the content
        const collectionName = report.targetType === 'COMMENT' ? 'comments' 
          : report.targetType === 'REQUEST' ? 'requests' : 'testimonies';
        await updateDoc(doc(db, collectionName, report.targetId), { 
          hidden: true,
          hiddenAt: new Date(),
          hiddenReason: report.reason,
        });
        await updateDoc(doc(db, 'reports', reportId), { status: 'RESOLVED' });
      } else if (action === 'delete') {
        const collectionName = report.targetType === 'COMMENT' ? 'comments' 
          : report.targetType === 'REQUEST' ? 'requests' : 'testimonies';
        await deleteDoc(doc(db, collectionName, report.targetId));
        await updateDoc(doc(db, 'reports', reportId), { status: 'RESOLVED' });
      }
      Alert.alert('Done', `Report ${action}ed successfully`);
    } catch (err) {
      Alert.alert('Error', 'Could not process report');
    }
  };

  return (
    <FlatList
      data={reports}
      keyExtractor={item => item.id}
      renderItem={({ item }) => (
        <View style={{ padding: 16, borderBottomWidth: 1 }}>
          <Text>Type: {item.targetType}</Text>
          <Text>Reason: {item.reason}</Text>
          <View style={{ flexDirection: 'row', marginTop: 8 }}>
            <TouchableOpacity onPress={() => handleAction(item.id, 'dismiss')}>
              <Text>Dismiss</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleAction(item.id, 'hide')}>
              <Text>Hide Content</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleAction(item.id, 'delete')}>
              <Text>Delete Content</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    />
  );
};
```

**Add to navigation** in `src/navigation/types.ts` and admin settings.

---

## Category 4: Groups & Media

### Issue 4.1: Group Photos Stored as Base64

#### Description

Group photos are stored as base64 data URLs directly in Firestore documents, causing:
- Document size bloat (base64 is ~33% larger than binary)
- Slow reads/writes
- Potential 1MB document limit issues
- Higher Firestore costs

#### Affected Code

**File:** `src/screens/GroupDetailScreen.tsx`  
**Lines:** 140-148

```typescript
// CURRENT (PROBLEMATIC)
if (asset.base64) {
  const dataUrl = `data:image/jpeg;base64,${asset.base64}`;
  setEditPhotoURL(dataUrl);  // Stored directly in Firestore
}
```

#### Remediation

**Step 1: Add Storage Upload Function**

**File:** `src/services/groups.ts`

```typescript
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

export const uploadGroupPhoto = async (
  groupId: string, 
  imageUri: string
): Promise<string> => {
  if (!storage) throw new Error('Storage not initialized');

  // Fetch the image as blob
  const response = await fetch(imageUri);
  const blob = await response.blob();

  // Upload to Storage
  const storageRef = ref(storage, `group-images/${groupId}/photo.jpg`);
  await uploadBytes(storageRef, blob, {
    contentType: 'image/jpeg',
  });

  // Return download URL
  return getDownloadURL(storageRef);
};

export const deleteGroupPhoto = async (groupId: string): Promise<void> => {
  if (!storage) return;
  
  try {
    const storageRef = ref(storage, `group-images/${groupId}/photo.jpg`);
    await deleteObject(storageRef);
  } catch (err) {
    // Ignore if file doesn't exist
    console.warn('Could not delete group photo:', err);
  }
};
```

**Step 2: Update GroupDetailScreen**

**File:** `src/screens/GroupDetailScreen.tsx`

```typescript
import { uploadGroupPhoto } from '../services/groups';

const pickGroupImage = async () => {
  // ... existing permission and picker code ...

  if (!result.canceled && result.assets[0]) {
    const asset = result.assets[0];
    
    // Show local preview immediately
    setEditPhotoURL(asset.uri);
    setPhotoNeedsUpload(true);  // New state to track pending upload
  }
};

const handleEditGroup = async () => {
  if (!editName.trim()) {
    Alert.alert('Error', 'Group name is required');
    return;
  }

  setSaving(true);
  try {
    let finalPhotoURL = editPhotoURL;

    // Upload photo if changed
    if (photoNeedsUpload && editPhotoURL && !editPhotoURL.startsWith('http')) {
      finalPhotoURL = await uploadGroupPhoto(groupId, editPhotoURL);
    }

    await updateGroup(groupId, {
      name: editName.trim(),
      description: editDesc.trim(),
      photoURL: finalPhotoURL,
    });
    
    setPhotoNeedsUpload(false);
    // ... rest of success handling
  } catch (err) {
    Alert.alert('Error', 'Could not update group');
  } finally {
    setSaving(false);
  }
};
```

**Step 3: Update Storage Rules**

**File:** `storage.rules`

```javascript
// Group images - members can upload, anyone can read
match /group-images/{groupId}/{fileName} {
  allow read: if true;
  allow write: if isSignedIn()
    && request.resource.size < 2 * 1024 * 1024
    && request.resource.contentType.matches('image/.*');
}
```

**Migration:** Existing base64 photos will continue to work. New uploads use Storage. Consider a one-time migration script for existing groups.

---

## Category 5: Offline & Sync

### Issue 5.1: No Warning Before Losing Pending Data

#### Description

`clearAllCache` now correctly clears pending queues on logout, but users aren't warned about losing unsynced data.

#### Remediation

**File:** `src/hooks/useAuth.tsx`

```typescript
import { getCacheStats, clearAllCache } from '../services/offlineCache';

// Add new function to check pending data
export const checkPendingData = async (): Promise<{
  hasPending: boolean;
  pendingPrayers: number;
  pendingRequests: number;
}> => {
  const stats = await getCacheStats();
  return {
    hasPending: stats.pendingPrayers > 0 || stats.pendingRequests > 0,
    pendingPrayers: stats.pendingPrayers,
    pendingRequests: stats.pendingRequests,
  };
};

// Update signOut to return pending info (let UI handle confirmation)
const signOut = useCallback(async (force: boolean = false): Promise<void> => {
  if (!auth) return;

  // Check for pending data unless forced
  if (!force) {
    const pending = await checkPendingData();
    if (pending.hasPending) {
      // Throw special error for UI to catch and show confirmation
      const error = new Error('PENDING_DATA');
      (error as any).pendingPrayers = pending.pendingPrayers;
      (error as any).pendingRequests = pending.pendingRequests;
      throw error;
    }
  }

  await clearAllCache();
  await firebaseSignOut(auth);
}, []);
```

**Update SettingsScreen.tsx:**

```typescript
const handleSignOut = async () => {
  try {
    await signOut();
  } catch (err: any) {
    if (err.message === 'PENDING_DATA') {
      Alert.alert(
        'Unsaved Data',
        `You have ${err.pendingPrayers} prayers and ${err.pendingRequests} requests that haven't been synced. Sign out anyway?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign Out', style: 'destructive', onPress: () => signOut(true) },
        ]
      );
    } else {
      Alert.alert('Error', 'Could not sign out');
    }
  }
};
```

---

### Issue 5.2: No Backoff/Retry in offlineSync

#### Description

`offlineSync.ts` retries failed syncs immediately on every network change, potentially hammering Firestore on flaky connections.

#### Remediation

**File:** `src/services/offlineSync.ts`

```typescript
import NetInfo from '@react-native-community/netinfo';
import type { User } from 'firebase/auth';

// Backoff configuration
const BACKOFF_DELAYS = [1000, 5000, 15000, 30000, 60000]; // ms
const MAX_RETRIES = 5;

let retryCount = 0;
let retryTimeout: NodeJS.Timeout | null = null;
let isSyncing = false;

const syncWithBackoff = async (user: User): Promise<void> => {
  if (isSyncing) {
    console.log('[OfflineSync] Sync already in progress, skipping');
    return;
  }

  isSyncing = true;

  try {
    await syncRequests(user);
    await syncPrayers(user);
    
    // Success - reset retry count
    retryCount = 0;
    console.log('[OfflineSync] Sync completed successfully');
  } catch (err) {
    console.warn('[OfflineSync] Sync failed:', err);
    
    if (retryCount < MAX_RETRIES) {
      const delay = BACKOFF_DELAYS[Math.min(retryCount, BACKOFF_DELAYS.length - 1)];
      retryCount++;
      
      console.log(`[OfflineSync] Retrying in ${delay}ms (attempt ${retryCount}/${MAX_RETRIES})`);
      
      retryTimeout = setTimeout(() => {
        syncWithBackoff(user);
      }, delay);
    } else {
      console.error('[OfflineSync] Max retries exceeded, giving up until next connection change');
      retryCount = 0;
    }
  } finally {
    isSyncing = false;
  }
};

export const startOfflineSyncListener = (user: User | null) => {
  if (!user || !firebaseEnabled) {
    return () => {};
  }

  // Clear any pending retry
  if (retryTimeout) {
    clearTimeout(retryTimeout);
    retryTimeout = null;
  }
  retryCount = 0;

  // Initial sync
  syncWithBackoff(user);

  // Listen for connection changes
  const unsubscribe = NetInfo.addEventListener((state) => {
    if (state.isConnected && state.isInternetReachable) {
      // Reset retry count on fresh connection
      retryCount = 0;
      syncWithBackoff(user);
    }
  });

  return () => {
    unsubscribe();
    if (retryTimeout) {
      clearTimeout(retryTimeout);
    }
  };
};
```

---

## Category 6: Notifications

### Issue 6.1: No Granular Notification Toggles

#### Description

Users can only toggle all notifications on/off. No per-type control (prayers, comments, testimonies, critical alerts).

#### Remediation

**Step 1: Update User Profile Type**

**File:** `src/types.ts`

```typescript
export type NotificationSettings = {
  enabled: boolean;
  prayers: boolean;      // Someone prayed for your request
  comments: boolean;     // Someone commented on your content
  testimonies: boolean;  // Testimony linked to your prayer
  critical: boolean;     // Critical/urgent prayer requests
  groups: boolean;       // Group activity
};
```

**Step 2: Update Settings UI**

**File:** `src/screens/SettingsScreen.tsx`

Add toggle switches for each notification type.

**Step 3: Update Cloud Functions**

Check specific settings before sending each notification type.

---

### Issue 6.2: Push Tokens Not Cleaned on Logout

#### Description

Push tokens remain active after logout, potentially sending notifications to devices no longer associated with the user.

#### Remediation

**File:** `src/hooks/useAuth.tsx`

```typescript
import { collection, getDocs, deleteDoc } from 'firebase/firestore';

const cleanupPushTokens = async (uid: string): Promise<void> => {
  if (!db) return;
  
  try {
    const tokensRef = collection(db, `users/${uid}/pushTokens`);
    const snapshot = await getDocs(tokensRef);
    
    const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
    
    console.log(`[Auth] Deleted ${snapshot.size} push tokens`);
  } catch (err) {
    console.warn('[Auth] Could not cleanup push tokens:', err);
  }
};

const signOut = useCallback(async (force: boolean = false): Promise<void> => {
  if (!auth) return;

  const currentUser = auth.currentUser;

  // ... pending data check ...

  // Cleanup push tokens before signing out
  if (currentUser) {
    await cleanupPushTokens(currentUser.uid);
  }

  await clearAllCache();
  await firebaseSignOut(auth);
}, []);
```

---

## Category 7: Testing

### Issue 7.1: Limited Test Coverage

#### Description

Only `useFeed.test.ts` exists. Critical functions lack test coverage.

#### Recommended Test Files

### 7.1.1 Security Validation Tests

**New File:** `src/__tests__/utils/security.test.ts`

```typescript
import { 
  validateContent, 
  validateDisplayName, 
  validateEmail,
  containsMoneySolicitation,
  checkRateLimit,
} from '../../utils/security';

describe('validateContent', () => {
  describe('profanity detection', () => {
    it('should reject content with profanity', () => {
      const result = validateContent('This is f**king bad');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('inappropriate');
    });

    it('should accept clean content', () => {
      const result = validateContent('Please pray for my family');
      expect(result.isValid).toBe(true);
    });
  });

  describe('money solicitation', () => {
    it('should block GoFundMe links in requests', () => {
      const result = validateContent(
        'Please help: gofundme.com/my-campaign',
        { contentType: 'REQUEST' }
      );
      expect(result.isValid).toBe(false);
      expect(result.containsMoneySolicitation).toBe(true);
    });

    it('should allow GoFundMe links in testimonies', () => {
      const result = validateContent(
        'God provided through gofundme.com/my-campaign',
        { contentType: 'TESTIMONY' }
      );
      expect(result.isValid).toBe(true);
      expect(result.warnings).toBeDefined();
    });

    it('should block PayPal/Venmo requests', () => {
      const result = validateContent('Send money to paypal.me/user');
      expect(result.isValid).toBe(false);
    });
  });

  describe('length validation', () => {
    it('should reject content below minimum length', () => {
      const result = validateContent('Hi', { minLength: 10 });
      expect(result.isValid).toBe(false);
    });

    it('should reject content above maximum length', () => {
      const result = validateContent('a'.repeat(3000), { maxLength: 2000 });
      expect(result.isValid).toBe(false);
    });
  });
});

describe('validateDisplayName', () => {
  it('should reject reserved names', () => {
    expect(validateDisplayName('Admin').isValid).toBe(false);
    expect(validateDisplayName('Moderator').isValid).toBe(false);
    expect(validateDisplayName('Lift Team').isValid).toBe(false);
  });

  it('should accept valid names', () => {
    expect(validateDisplayName('John Doe').isValid).toBe(true);
    expect(validateDisplayName("Mary O'Brien").isValid).toBe(true);
  });
});

describe('checkRateLimit', () => {
  beforeEach(() => {
    // Reset rate limit cache between tests
    jest.useFakeTimers();
  });

  it('should allow requests within limit', () => {
    for (let i = 0; i < 10; i++) {
      expect(checkRateLimit('test_user', 10, 60000)).toBe(true);
    }
  });

  it('should block requests exceeding limit', () => {
    for (let i = 0; i < 10; i++) {
      checkRateLimit('test_user_2', 10, 60000);
    }
    expect(checkRateLimit('test_user_2', 10, 60000)).toBe(false);
  });
});
```

### 7.1.2 Prayer Logging Tests

**New File:** `src/__tests__/services/prayers.test.ts`

```typescript
// Mock Firebase
jest.mock('../../services/firebase', () => ({
  db: {},
  firebaseEnabled: true,
}));

import { logPrayer, hasUserPrayed } from '../../services/prayers/core';

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

  // Additional tests require Firebase emulator or mocking
});
```

### 7.1.3 Offline Cache Tests

**New File:** `src/__tests__/services/offlineCache.test.ts`

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  queuePendingPrayer,
  getPendingPrayers,
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
        '@lift_last_sync',
        '@lift_pending_prayers',
        '@lift_pending_requests',
      ]);
    });
  });
});
```

---

## Implementation Checklist

### Phase 1: High Priority (Week 1-2)

- [ ] **1.1** Fix anonymous ownerUid pattern
- [ ] **2.1** Wire validateContent to comments
- [x] **2.2** Wire validateDisplayName to profile UI
- [ ] **3.1** Extend flagContent to comments
- [ ] **3.2** Add rate limiting to flagContent

### Phase 2: Medium Priority (Week 3-4)

- [ ] **4.1** Migrate group photos to Firebase Storage
- [x] **5.1** Add logout warning for pending data
- [x] **5.2** Add backoff/retry to offlineSync
- [x] **6.2** Clean up push tokens on logout

### Phase 3: Lower Priority (Week 5+)

- [x] **1.2** Add deleteAccount backend cleanup
- [ ] **3.3** Build admin reports view
- [x] **6.1** Add granular notification toggles
- [x] **7.x** Add comprehensive tests

---

## Deployment Notes

### Order of Operations

1. Deploy client-side changes first (validation, rate limiting)
2. Deploy Firestore rules updates
3. Deploy Cloud Functions
4. Deploy Storage rules (for group photos)
5. Run any migration scripts

### Breaking Changes

| Change | Breaking? | Migration |
|--------|-----------|-----------|
| ownerUid required | Yes | Update all content creation screens |
| validateContent in comments | No | Graceful error handling |
| Group photo Storage | No | Existing base64 continues to work |
| Push token cleanup | No | Transparent to users |

### Rollback Plan

Each change should be deployable independently. If issues arise:
1. Revert specific client code
2. Revert Firestore/Storage rules via Firebase Console
3. Disable Cloud Functions via Firebase Console

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Nov 30, 2025 | Development Team | Initial document |
