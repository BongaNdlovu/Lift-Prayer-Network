# Security & Performance Fixes

**Document Version:** 1.0  
**Date:** November 30, 2025  
**Status:** Pending Implementation

---

## Executive Summary

This document outlines five security and performance issues identified in the Lift mobile application, along with detailed remediation plans. The issues range from broken object-level authorization (BOLA) vulnerabilities to performance bottlenecks that could impact scalability and cost.

### Issues Overview

| # | Issue | Severity | Location | Status |
|---|-------|----------|----------|--------|
| 1 | Storage BOLA - Profile Pictures | **High** | `storage.rules:25-33` | Pending |
| 2 | User PII Exposure | **High** | `firestore.rules:76-80` | Pending |
| 3 | Unauthenticated Report Flooding | **Medium-High** | `firestore.rules:153`, `requests.ts:49-63` | Pending |
| 4 | O(N) Stats Recalculation | **Medium** | `cloud-functions/index.js:312-330` | Pending |
| 5 | Offline Cache Cross-Account Leakage | **Medium** | `offlineCache.ts:198-207` | Pending |

---

## Issue 1: Storage Rules BOLA Vulnerability

### Description

The backward-compatibility rule for profile pictures at `storage.rules:25-33` allows any signed-in user to write to any `profile-pictures/{fileName}` path without verifying ownership. This enables a malicious user to overwrite or upload arbitrary images into anyone's profile picture path.

### Affected Code

**File:** `storage.rules`  
**Lines:** 25-33

```javascript
// VULNERABLE CODE
match /profile-pictures/{fileName} {
  // Anyone can view profile pictures (they're public)
  allow read: if true;
  
  // Allow authenticated users to upload - we validate ownership in the app
  allow write: if isSignedIn()
    && request.resource.size < 2 * 1024 * 1024
    && request.resource.contentType.matches('image/.*');
}
```

### Attack Vector

1. Attacker authenticates with their own account
2. Attacker uploads a malicious/inappropriate image to `profile-pictures/victimUserId.jpg`
3. Victim's profile picture is replaced without their consent
4. Client-side validation is bypassed entirely

### Remediation

**Option A: Enforce filename matches user UID (Recommended)**

```javascript
// FIXED CODE
match /profile-pictures/{fileName} {
  // Anyone can view profile pictures (they're public)
  allow read: if true;
  
  // Only allow users to upload their own profile picture
  // fileName must start with the user's UID
  allow write: if isSignedIn()
    && fileName.matches(request.auth.uid + '.*')
    && request.resource.size < 2 * 1024 * 1024
    && request.resource.contentType.matches('image/.*');
}
```

**Option B: Remove backward-compatibility rule entirely**

If all clients have migrated to the folder structure (`profile-pictures/{userId}/{fileName}`), this rule can be removed entirely. The secure rule at lines 12-21 already handles the folder pattern correctly.

### Impact Assessment

- **Breaking Changes:** None if using the folder pattern (`profile-pictures/{userId}/profile.jpg`)
- **Migration Required:** Verify all clients use the secure upload path
- **Risk Level:** Low implementation risk

### Verification Steps

1. Deploy updated rules to Firebase
2. Attempt to upload to `profile-pictures/otherUserId.jpg` - should fail
3. Verify legitimate uploads to `profile-pictures/{ownUid}.jpg` still work
4. Verify uploads to `profile-pictures/{ownUid}/profile.jpg` still work

---

## Issue 2: User Document PII Exposure

### Description

The Firestore security rule at `firestore.rules:76-80` allows any signed-in user to read any user document. This exposes sensitive PII including:

- Email addresses
- Blocked users list
- Onboarding answers (personal faith journey, prayer style)
- Notification settings
- Location and timezone
- Activity timestamps

### Affected Code

**File:** `firestore.rules`  
**Lines:** 76-80

```javascript
// VULNERABLE CODE
match /users/{uid} {
  // Only allow reading certain fields publicly, full profile to self
  allow read: if isSignedIn();  // <-- Comment contradicts implementation
  allow write: if isSignedIn() && request.auth.uid == uid;
}
```

### Attack Vector

1. Attacker authenticates with their own account
2. Attacker queries `firestore.collection('users').get()` or specific user docs
3. Attacker harvests email addresses, blocked user relationships, personal data
4. Data can be used for phishing, harassment, or sold

### Remediation

```javascript
// FIXED CODE
match /users/{uid} {
  // Only the owner can read their full profile
  // Public profile data (displayName, photoURL) is denormalized onto content documents
  allow read: if isSignedIn() && request.auth.uid == uid;
  allow write: if isSignedIn() && request.auth.uid == uid;
}
```

### Impact Assessment

**Codebase Analysis Results:**

The application stores `userDisplayName` and `userPhotoURL` directly on content documents (requests, testimonies, comments). This means:

- Feed display does NOT require reading user documents
- Profile pictures are fetched from the content document, not user doc
- Cloud Functions run with admin privileges (bypass rules)

**Affected Functionality:** None identified. All public-facing features use denormalized data.

### Alternative: Public Profile Projection

If future features require reading other users' public data, create a separate collection:

```javascript
// Optional: Add public profiles collection
match /publicProfiles/{uid} {
  allow read: if isSignedIn();
  allow write: if false; // Only writable via Cloud Functions
}
```

Cloud Function to sync public data:

```javascript
exports.syncPublicProfile = onDocumentWritten('users/{uid}', async (event) => {
  const data = event.data.after.data();
  if (!data) return; // Deleted
  
  await db.doc(`publicProfiles/${event.params.uid}`).set({
    displayName: data.displayName,
    photoURL: data.photoURL,
    // Only include non-sensitive fields
  });
});
```

### Verification Steps

1. Deploy updated rules
2. Attempt to read another user's document - should fail with permission denied
3. Verify own profile read/write still works
4. Verify feed display still shows usernames and photos correctly

---

## Issue 3: Unauthenticated Report Flooding

### Description

The reports collection allows unauthenticated writes (`allow create: if true`), and the client-side code accepts undefined `actorUid`, defaulting to "anonymous". This enables:

- Denial-of-service via report flooding
- Firestore cost abuse
- Spam reports to overwhelm moderation

### Affected Code

**File:** `firestore.rules`  
**Lines:** 153-160

```javascript
// VULNERABLE CODE
match /reports/{reportId} {
  allow create: if true;  // <-- No authentication required
  allow read: if isAdmin();
  allow update: if isAdmin();
  allow delete: if isAdmin();
}
```

**File:** `src/services/requests.ts`  
**Lines:** 49-63

```typescript
// VULNERABLE CODE
export const flagContent = async (
  actorUid: string | undefined,  // <-- Optional, allows anonymous
  targetId: string,
  targetType: 'REQUEST' | 'TESTIMONY',
  reason: string,
) => {
  if (!firebaseEnabled || !db) return;
  await addDoc(collection(db, 'reports'), {
    actorUid: actorUid || 'anonymous',  // <-- Falls back to anonymous
    targetId,
    targetType,
    reason,
    createdAt: Timestamp.now(),
  });
};
```

### Attack Vector

1. Attacker creates a script (no authentication needed)
2. Script floods the reports collection with fake reports
3. Firestore read/write costs increase dramatically
4. Legitimate reports are buried in noise
5. Admin moderation becomes impossible

### Remediation

#### Part A: Firestore Rules

```javascript
// FIXED CODE
match /reports/{reportId} {
  // Require authentication and validate actorUid matches the authenticated user
  allow create: if isSignedIn() 
    && request.resource.data.actorUid == request.auth.uid;
  // Only admins can read reports for moderation
  allow read: if isAdmin();
  // Admins can update reports (mark as reviewed, resolved, etc.)
  allow update: if isAdmin();
  allow delete: if isAdmin();
}
```

#### Part B: Client Service

**File:** `src/services/requests.ts`

```typescript
// FIXED CODE
export const flagContent = async (
  actorUid: string,  // Required - no longer optional
  targetId: string,
  targetType: 'REQUEST' | 'TESTIMONY',
  reason: string,
): Promise<void> => {
  if (!firebaseEnabled || !db) return;
  
  // Validate authentication
  if (!actorUid) {
    throw new Error('Authentication required to report content');
  }
  
  await addDoc(collection(db, 'reports'), {
    actorUid,
    targetId,
    targetType,
    reason,
    createdAt: Timestamp.now(),
  });
};
```

#### Part C: UI Guard

**File:** `src/screens/home/RequestDetailScreen.tsx`

Update the `handleFlag` function (around line 236):

```typescript
// FIXED CODE
const handleFlag = async () => {
  // Require authentication
  if (!user) {
    Alert.alert('Sign In Required', 'Please sign in to report content.');
    return;
  }
  
  if (!flagText.trim()) {
    Alert.alert('Add context', 'Please add a brief reason.');
    return;
  }
  
  setBusyAction(true);
  try {
    await flagContent(user.uid, id, type, flagText.trim());
    setFlagText('');
    Alert.alert('Flag submitted', 'Thank you for keeping the space healthy.');
  } catch (err: any) {
    Alert.alert('Flag failed', err.message ?? 'Try again.');
  } finally {
    setBusyAction(false);
  }
};
```

### Impact Assessment

- **Breaking Change:** Anonymous users can no longer submit reports
- **Mitigation:** This is acceptable - accountability for reports is a feature, not a bug
- **User Experience:** Users will be prompted to sign in before reporting

### Verification Steps

1. Deploy all three changes
2. Attempt to create a report without authentication - should fail
3. Attempt to create a report with mismatched actorUid - should fail
4. Verify authenticated users can still submit reports
5. Verify admin can still read/manage reports

---

## Issue 4: O(N) Stats Recalculation

### Description

The `onRequestWrite` Cloud Function at `cloud-functions/index.js:312-330` performs a full collection scan on every request write to recalculate global statistics. This is:

- **O(N) per write** - gets slower as collection grows
- **Expensive** - reads entire collection on every write
- **Timeout risk** - will fail when collection exceeds ~10K documents
- **Throttling risk** - may hit Firestore rate limits

### Affected Code

**File:** `cloud-functions/index.js`  
**Lines:** 312-330

```javascript
// PROBLEMATIC CODE
exports.onRequestWrite = onDocumentWritten('requests/{requestId}', async (event) => {
  const snapshot = await db.collection('requests').get();  // <-- Full scan
  let totalPrayers = 0;
  let totalRequests = 0;
  snapshot.forEach((doc) => {
    const data = doc.data();
    totalRequests += 1;
    totalPrayers += data.prayers || 0;
  });
  await db.doc('stats/global').set(
    {
      totalPrayers,
      totalRequests,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
});
```

### Performance Impact

| Collection Size | Reads per Write | Estimated Latency | Monthly Cost (1K writes/day) |
|-----------------|-----------------|-------------------|------------------------------|
| 1,000 docs | 1,000 | ~500ms | ~$1.80 |
| 10,000 docs | 10,000 | ~5s | ~$18.00 |
| 100,000 docs | 100,000 | Timeout | ~$180.00 |

### Remediation

Replace the full-scan approach with incremental counters using `FieldValue.increment()`.

#### Step 1: Add import for onDocumentDeleted

**File:** `cloud-functions/index.js`  
**Line:** 1

```javascript
// UPDATED IMPORT
const { onDocumentCreated, onDocumentWritten, onDocumentDeleted } = require('firebase-functions/v2/firestore');
```

#### Step 2: Remove onRequestWrite function

Delete lines 312-330 entirely.

#### Step 3: Update onRequestCreated to increment stats

**File:** `cloud-functions/index.js`

Add to the existing `onRequestCreated` function (after the notification logic, before the closing brace):

```javascript
// Add at the end of onRequestCreated function (before the closing });)

  // Increment global request count
  try {
    await db.doc('stats/global').set(
      {
        totalRequests: admin.firestore.FieldValue.increment(1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    console.error('Error updating global stats:', err);
  }
```

#### Step 4: Add onRequestDeleted function

**File:** `cloud-functions/index.js`

Add new function after `onRequestCreated`:

```javascript
// When a request is deleted - decrement stats
exports.onRequestDeleted = onDocumentDeleted('requests/{requestId}', async (event) => {
  const deletedData = event.data.data();
  const prayerCount = deletedData?.prayers || 0;
  
  try {
    await db.doc('stats/global').set(
      {
        totalRequests: admin.firestore.FieldValue.increment(-1),
        totalPrayers: admin.firestore.FieldValue.increment(-prayerCount),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    console.log('Decremented stats for deleted request');
  } catch (err) {
    console.error('Error updating stats on delete:', err);
  }
});
```

#### Step 5: Track prayer count increments

The client already increments the `prayers` field on individual requests. To track global prayer count, add to the existing `onPrayerCreated` function:

```javascript
// Add at the end of onPrayerCreated function (before the closing });)

  // Increment global prayer count
  try {
    await db.doc('stats/global').set(
      {
        totalPrayers: admin.firestore.FieldValue.increment(1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    console.error('Error updating global prayer stats:', err);
  }
```

### Migration: One-Time Stats Reconciliation

After deploying the incremental approach, run a one-time reconciliation to ensure accuracy:

```javascript
// Run once via Firebase console or a temporary HTTP function
async function reconcileStats() {
  const snapshot = await db.collection('requests').get();
  let totalPrayers = 0;
  let totalRequests = 0;
  
  snapshot.forEach((doc) => {
    totalRequests += 1;
    totalPrayers += doc.data().prayers || 0;
  });
  
  await db.doc('stats/global').set({
    totalPrayers,
    totalRequests,
    reconciledAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  
  console.log(`Reconciled: ${totalRequests} requests, ${totalPrayers} prayers`);
}
```

### Performance After Fix

| Operation | Reads | Writes | Latency |
|-----------|-------|--------|---------|
| Create request | 0 | 1 | ~50ms |
| Delete request | 0 | 1 | ~50ms |
| Log prayer | 0 | 1 | ~50ms |

### Verification Steps

1. Deploy updated Cloud Functions
2. Create a new request - verify `stats/global.totalRequests` increments by 1
3. Delete a request - verify `stats/global.totalRequests` decrements by 1
4. Log a prayer - verify `stats/global.totalPrayers` increments by 1
5. Monitor Cloud Functions logs for any errors

---

## Issue 5: Offline Cache Cross-Account Data Leakage

### Description

The `clearAllCache` function in `offlineCache.ts` does not clear pending prayers and pending requests when called during logout. This means:

- User A's pending prayers/requests remain on device after logout
- User B logs in on the same device
- User B cannot sync User A's pending items (different UID)
- User A's content (prayer text, target IDs) remains accessible on disk

### Affected Code

**File:** `src/services/offlineCache.ts`  
**Lines:** 197-208

```typescript
// VULNERABLE CODE
export const clearAllCache = async (): Promise<void> => {
  try {
    await AsyncStorage.multiRemove([
      CACHE_KEYS.REQUESTS,
      CACHE_KEYS.TESTIMONIES,
      CACHE_KEYS.LAST_SYNC,
      // MISSING: CACHE_KEYS.PENDING_PRAYERS
      // MISSING: CACHE_KEYS.PENDING_REQUESTS
    ]);
  } catch (error) {
    console.error('[OfflineCache] Error clearing cache:', error);
  }
};
```

### Data at Risk

The pending queues contain:

```typescript
type PendingPrayer = {
  id: string;
  requestId: string;
  actorUid: string;           // User's ID
  actorDisplayName?: string;  // User's name
  targetOwnerUid: string;     // Another user's ID
  targetSummary: string;      // Prayer request content (PII)
  timestamp: number;
};

type PendingRequest = {
  id: string;
  content: string;            // User's prayer content (PII)
  ownerUid: string;           // User's ID
  displayName: string;        // User's name
  category: string;
  isUrgent: boolean;
  isPrivate: boolean;         // Privacy flag
  timestamp: number;
};
```

### Remediation

**File:** `src/services/offlineCache.ts`

```typescript
// FIXED CODE
// Clear all cache (including pending queues to prevent cross-account data leakage)
export const clearAllCache = async (): Promise<void> => {
  try {
    await AsyncStorage.multiRemove([
      CACHE_KEYS.REQUESTS,
      CACHE_KEYS.TESTIMONIES,
      CACHE_KEYS.LAST_SYNC,
      CACHE_KEYS.PENDING_PRAYERS,
      CACHE_KEYS.PENDING_REQUESTS,
    ]);
    console.log('[OfflineCache] All cache cleared including pending queues');
  } catch (error) {
    console.error('[OfflineCache] Error clearing cache:', error);
  }
};
```

### Impact Assessment

- **Data Loss:** Pending items that weren't synced before logout will be lost
- **Acceptable Trade-off:** Security > convenience for unsynced data
- **User Communication:** Consider showing a warning if pending items exist before logout

### Optional Enhancement: Warn Before Logout

**File:** `src/hooks/useAuth.tsx`

```typescript
// Enhanced signOut with pending data warning
const signOut = useCallback(async (): Promise<void> => {
  if (!auth) return;

  try {
    // Check for pending data
    const stats = await getCacheStats();
    if (stats.pendingPrayers > 0 || stats.pendingRequests > 0) {
      console.warn(`[Auth] Clearing ${stats.pendingPrayers} pending prayers and ${stats.pendingRequests} pending requests on logout`);
    }
    
    console.log('[Auth] Signing out');
    
    // Clear cached feed data to prevent privacy leaks
    await clearAllCache();
    console.log('[Auth] Cleared offline cache');
    
    await firebaseSignOut(auth);
    console.log('[Auth] Sign out successful');
  } catch (error) {
    console.error('[Auth] Sign out error:', error);
    throw new Error('Failed to sign out. Please try again.');
  }
}, []);
```

### Verification Steps

1. Log in as User A
2. Go offline (airplane mode)
3. Create a prayer request (will be queued)
4. Log a prayer for someone (will be queued)
5. Go back online but immediately log out
6. Verify AsyncStorage no longer contains `@lift_pending_prayers` or `@lift_pending_requests`
7. Log in as User B
8. Verify no residual data from User A

---

## Implementation Checklist

### Pre-Deployment

- [ ] Review all code changes with team
- [ ] Test in development environment
- [ ] Update any affected unit tests
- [ ] Document breaking changes for release notes

### Deployment Order

1. **Issue 5 (Offline Cache)** - Client-only, no backend dependency
2. **Issue 3 (Reports)** - Deploy rules first, then client update
3. **Issue 2 (User PII)** - Rules only, verify no client impact
4. **Issue 1 (Storage BOLA)** - Rules only, verify upload paths
5. **Issue 4 (O(N) Stats)** - Deploy functions, run reconciliation

### Post-Deployment

- [ ] Monitor Cloud Functions logs for errors
- [ ] Verify stats accuracy after 24 hours
- [ ] Check for any user-reported issues
- [ ] Run security scan to verify fixes

---

## Appendix A: Complete Fixed Files

### storage.rules (Complete)

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Helper function to check if user is authenticated
    function isSignedIn() {
      return request.auth != null;
    }

    // Profile pictures - users can only upload/modify their own
    // Files are stored as profile-pictures/{userId}/{fileName}
    match /profile-pictures/{userId}/{fileName} {
      // Anyone can view profile pictures (they're public)
      allow read: if true;
      
      // Only the owner can upload their picture
      allow write: if isSignedIn()
        && request.auth.uid == userId
        && request.resource.size < 2 * 1024 * 1024
        && request.resource.contentType.matches('image/.*');
    }
    
    // Backward compatibility for flat file structure
    // fileName must start with the user's UID for ownership verification
    match /profile-pictures/{fileName} {
      // Anyone can view profile pictures (they're public)
      allow read: if true;
      
      // Only allow users to upload their own profile picture
      allow write: if isSignedIn()
        && fileName.matches(request.auth.uid + '.*')
        && request.resource.size < 2 * 1024 * 1024
        && request.resource.contentType.matches('image/.*');
    }

    // Group images
    match /group-images/{groupId} {
      allow read: if true;
      allow write: if isSignedIn()
        && request.resource.size < 2 * 1024 * 1024
        && request.resource.contentType.matches('image/.*');
    }

    // Request/Testimony attachments
    match /attachments/{userId}/{allPaths=**} {
      allow read: if true;
      allow write: if isSignedIn() 
        && request.auth.uid == userId
        && request.resource.size < 5 * 1024 * 1024
        && request.resource.contentType.matches('image/.*');
    }
  }
}
```

### firestore.rules (Relevant Sections)

```javascript
// Users collection - owner-only access
match /users/{uid} {
  // Only the owner can read their full profile
  allow read: if isSignedIn() && request.auth.uid == uid;
  allow write: if isSignedIn() && request.auth.uid == uid;
}

// Reports collection - authenticated users only
match /reports/{reportId} {
  // Require authentication and validate actorUid matches the authenticated user
  allow create: if isSignedIn() 
    && request.resource.data.actorUid == request.auth.uid;
  // Only admins can read reports for moderation
  allow read: if isAdmin();
  // Admins can update reports (mark as reviewed, resolved, etc.)
  allow update: if isAdmin();
  allow delete: if isAdmin();
}
```

---

## Appendix B: Testing Scripts

### Test Storage Rules

```javascript
// Firebase Rules Unit Test
const { assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');

describe('Profile Pictures Storage Rules', () => {
  it('should allow user to upload their own profile picture', async () => {
    const storage = getStorage({ uid: 'user123' });
    await assertSucceeds(
      storage.ref('profile-pictures/user123.jpg').put(imageBlob)
    );
  });

  it('should deny user from uploading to another users path', async () => {
    const storage = getStorage({ uid: 'user123' });
    await assertFails(
      storage.ref('profile-pictures/otherUser.jpg').put(imageBlob)
    );
  });
});
```

### Test Firestore Rules

```javascript
describe('User Document Rules', () => {
  it('should allow user to read their own document', async () => {
    const db = getFirestore({ uid: 'user123' });
    await assertSucceeds(db.collection('users').doc('user123').get());
  });

  it('should deny user from reading another users document', async () => {
    const db = getFirestore({ uid: 'user123' });
    await assertFails(db.collection('users').doc('otherUser').get());
  });
});

describe('Reports Collection Rules', () => {
  it('should deny unauthenticated report creation', async () => {
    const db = getFirestore(null);
    await assertFails(db.collection('reports').add({ reason: 'test' }));
  });

  it('should deny report with mismatched actorUid', async () => {
    const db = getFirestore({ uid: 'user123' });
    await assertFails(
      db.collection('reports').add({ actorUid: 'otherUser', reason: 'test' })
    );
  });
});
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Nov 30, 2025 | Security Audit | Initial document |
