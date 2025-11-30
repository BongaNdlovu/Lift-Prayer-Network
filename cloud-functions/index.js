const { onDocumentCreated, onDocumentDeleted } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');
const Filter = require('bad-words');

admin.initializeApp();
const db = admin.firestore();
const filter = new Filter();

// ============================================================================
// Rate Limiting Configuration
// ============================================================================
const RATE_LIMITS = {
  prayers: { maxPerHour: 100, maxPerDay: 500 },
  requests: { maxPerHour: 10, maxPerDay: 30 },
  testimonies: { maxPerHour: 10, maxPerDay: 20 },
  comments: { maxPerHour: 50, maxPerDay: 200 },
  notifications: { maxPerMinute: 10 },
};

/**
 * Check if user has exceeded rate limit
 * @param {string} userId - User ID
 * @param {string} action - Action type (prayers, requests, etc.)
 * @param {string} timeWindow - 'hour' or 'day'
 * @returns {Promise<{allowed: boolean, count: number, limit: number}>}
 */
async function checkRateLimit(userId, action, timeWindow = 'hour') {
  if (!userId || !RATE_LIMITS[action]) {
    return { allowed: true, count: 0, limit: 999 };
  }

  const now = new Date();
  let startTime;
  let limit;

  if (timeWindow === 'minute') {
    startTime = new Date(now.getTime() - 60 * 1000);
    limit = RATE_LIMITS[action].maxPerMinute || 60;
  } else if (timeWindow === 'hour') {
    startTime = new Date(now.getTime() - 60 * 60 * 1000);
    limit = RATE_LIMITS[action].maxPerHour || 100;
  } else {
    startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    limit = RATE_LIMITS[action].maxPerDay || 500;
  }

  try {
    const rateLimitRef = db.collection('rateLimits').doc(`${userId}_${action}`);
    const doc = await rateLimitRef.get();

    if (!doc.exists) {
      // First action, create record
      await rateLimitRef.set({
        count: 1,
        windowStart: admin.firestore.FieldValue.serverTimestamp(),
        lastAction: admin.firestore.FieldValue.serverTimestamp(),
      });
      return { allowed: true, count: 1, limit };
    }

    const data = doc.data();
    const windowStart = data.windowStart?.toDate() || new Date(0);

    if (windowStart < startTime) {
      // Window expired, reset
      await rateLimitRef.set({
        count: 1,
        windowStart: admin.firestore.FieldValue.serverTimestamp(),
        lastAction: admin.firestore.FieldValue.serverTimestamp(),
      });
      return { allowed: true, count: 1, limit };
    }

    const currentCount = data.count || 0;
    if (currentCount >= limit) {
      return { allowed: false, count: currentCount, limit };
    }

    // Increment count
    await rateLimitRef.update({
      count: admin.firestore.FieldValue.increment(1),
      lastAction: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { allowed: true, count: currentCount + 1, limit };
  } catch (error) {
    console.error('Rate limit check failed:', error);
    // Fail open - allow the action if rate limiting fails
    return { allowed: true, count: 0, limit };
  }
}

/**
 * Log rate limit violation for monitoring
 */
async function logRateLimitViolation(userId, action, count, limit) {
  try {
    await db.collection('rateLimitViolations').add({
      userId,
      action,
      count,
      limit,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.warn(`Rate limit exceeded: ${userId} - ${action} (${count}/${limit})`);
  } catch (error) {
    console.error('Failed to log rate limit violation:', error);
  }
}

// Helper function to send push notification via Expo
async function sendExpoPushNotification(expoPushTokens, title, body, data = {}) {
  if (!expoPushTokens || expoPushTokens.length === 0) return;

  const messages = expoPushTokens.map(token => ({
    to: token,
    sound: 'default',
    title,
    body,
    data,
  }));

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });
    const result = await response.json();
    console.log('Expo push result:', JSON.stringify(result));
    return result;
  } catch (error) {
    console.error('Error sending Expo push notification:', error);
    throw error;
  }
}

// Helper function to get user's push tokens
async function getUserPushTokens(userId) {
  if (!userId) return [];
  
  try {
    const tokensSnapshot = await db.collection('users').doc(userId).collection('pushTokens').get();
    const tokens = [];
    
    tokensSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.token) {
        tokens.push(data.token);
      }
    });
    
    return tokens;
  } catch (error) {
    console.error('Error getting push tokens for user:', userId, error);
    return [];
  }
}

// When someone prays for a request - notify the request owner
// NOTE: Counting is done client-side in logPrayer() to avoid double-counting
// This function ONLY handles notifications
exports.onPrayerCreated = onDocumentCreated('prayers/{prayerId}', async (event) => {
  const snap = event.data;
  const data = snap.data();
  const { actorUid, targetRequestId, targetOwnerUid, targetSummary, actorDisplayName, isSelfPrayer } = data;
  
  // Rate limit check for notifications
  const rateCheck = await checkRateLimit(targetOwnerUid, 'notifications', 'minute');
  if (!rateCheck.allowed) {
    console.log(`Rate limit exceeded for notifications to ${targetOwnerUid}`);
    await logRateLimitViolation(targetOwnerUid, 'notifications', rateCheck.count, rateCheck.limit);
    return;
  }
  
  // Skip notification for self-prayers (handled client-side)
  if (isSelfPrayer) {
    console.log('Skipping notification for self-prayer');
    return;
  }

  // Send notification to request owner (if not praying for own request)
  if (targetOwnerUid && targetOwnerUid !== actorUid && targetOwnerUid !== 'anonymous' && targetOwnerUid !== 'anon') {
    try {
      // Check if user has notifications enabled
      const ownerDoc = await db.doc(`users/${targetOwnerUid}`).get();
      const ownerData = ownerDoc.data();
      
      if (ownerData?.settings?.notifications !== false) {
        const tokens = await getUserPushTokens(targetOwnerUid);
        
        if (tokens.length > 0) {
          const prayerName = actorDisplayName || 'Someone';
          const contentPreview = targetSummary?.slice(0, 50) || 'your prayer request';
          
          await sendExpoPushNotification(
            tokens,
            '🙏 Prayer Support',
            `${prayerName} is praying for ${contentPreview}...`,
            { type: 'PRAYER', requestId: targetRequestId }
          );
          console.log(`Prayer notification sent to ${targetOwnerUid}`);
        }
      }
    } catch (err) {
      console.error('Error sending prayer notification:', err);
    }
  }

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
});

// When a new request is created - send critical alerts if urgent, notify group members
exports.onRequestCreated = onDocumentCreated('requests/{requestId}', async (event) => {
  const snap = event.data;
  const data = snap.data();
  const requestId = event.params.requestId;
  
  // Check for profanity and moderate
  const content = data.content || '';
  if (filter.isProfane(content)) {
    await snap.ref.update({
      status: 'REVIEW',
      moderatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return; // Don't send notifications for moderated content
  }

  // If this is a GROUP request, notify all group members
  if (data.visibility === 'GROUP' && data.groupIds && data.groupIds.length > 0) {
    try {
      for (const groupId of data.groupIds) {
        // Get the group to find its members
        const groupDoc = await db.doc(`groups/${groupId}`).get();
        if (!groupDoc.exists) continue;
        
        const groupData = groupDoc.data();
        const memberUids = groupData.memberUids || [];
        
        // Notify each member except the request owner
        for (const memberId of memberUids) {
          if (memberId === data.ownerUid) continue; // Skip the owner
          
          const memberDoc = await db.doc(`users/${memberId}`).get();
          const memberData = memberDoc.data();
          
          // Check if member has notifications enabled
          if (memberData?.settings?.notifications !== false) {
            const tokens = await getUserPushTokens(memberId);
            
            if (tokens.length > 0) {
              const groupName = groupData.name || 'your group';
              const requesterName = data.userDisplayName || 'Someone';
              
              await sendExpoPushNotification(
                tokens,
                `🙏 New Prayer in ${groupName}`,
                `${requesterName}: ${content.slice(0, 80)}...`,
                { type: 'GROUP_REQUEST', requestId, groupId }
              );
            }
          }
        }
        console.log(`Sent group notifications for request in group ${groupId}`);
      }
    } catch (err) {
      console.error('Error sending group notifications:', err);
    }
  }

  // Send critical alert if request is urgent
  if (data.isUrgent || data.severity === 'CRITICAL') {
    try {
      // Send to all users subscribed to critical topic via FCM
      const message = {
        topic: 'critical',
        notification: {
          title: '🚨 Critical Prayer Request',
          body: `${data.userDisplayName || 'Someone'}: ${content.slice(0, 100)}...`,
        },
        data: {
          type: 'CRITICAL_REQUEST',
          requestId: requestId,
        },
        android: {
          priority: 'high',
          notification: {
            channelId: 'critical',
            priority: 'high',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      };
      
      await admin.messaging().send(message);
      console.log('Critical alert sent successfully');
    } catch (err) {
      console.error('Error sending critical alert:', err);
    }
  }

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
});

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

// When a testimony is created - notify those who prayed
exports.onTestimonyCreated = onDocumentCreated('testimonies/{testimonyId}', async (event) => {
  const snap = event.data;
  const data = snap.data();
  const { ownerUid, userDisplayName, linkedRequestId, content } = data;
  
  // If linked to a request, notify people who prayed for it
  if (linkedRequestId) {
    try {
      // Get all prayers for this request
      const prayersSnapshot = await db.collection('prayers')
        .where('targetRequestId', '==', linkedRequestId)
        .get();
      
      // Collect unique user IDs who prayed (excluding the owner)
      const prayerUserIds = new Set();
      prayersSnapshot.forEach(doc => {
        const prayerData = doc.data();
        if (prayerData.actorUid && prayerData.actorUid !== ownerUid) {
          prayerUserIds.add(prayerData.actorUid);
        }
      });
      
      // Send notifications to each person who prayed
      for (const userId of prayerUserIds) {
        const userDoc = await db.doc(`users/${userId}`).get();
        const userData = userDoc.data();
        
        if (userData?.settings?.notifications !== false) {
          const tokens = await getUserPushTokens(userId);
          
          if (tokens.length > 0) {
            await sendExpoPushNotification(
              tokens,
              '✨ Prayer Answered!',
              `${userDisplayName || 'Someone'} shared a testimony: ${(content || '').slice(0, 80)}...`,
              { type: 'TESTIMONY', testimonyId: event.params.testimonyId, linkedRequestId }
            );
          }
        }
      }
      
      console.log(`Sent testimony notifications to ${prayerUserIds.size} users`);
    } catch (err) {
      console.error('Error sending testimony notifications:', err);
    }
  }
});

// When a comment is added - notify the request/testimony owner
exports.onCommentCreated = onDocumentCreated('comments/{commentId}', async (event) => {
  const snap = event.data;
  const data = snap.data();
  const { authorUid, authorName, parentId, parentType, content } = data;
  
  try {
    // Get the parent document (request or testimony)
    const collectionName = parentType === 'REQUEST' ? 'requests' : 'testimonies';
    const parentDoc = await db.doc(`${collectionName}/${parentId}`).get();
    
    if (!parentDoc.exists) return;
    
    const parentData = parentDoc.data();
    const ownerId = parentData.ownerUid;
    
    // Don't notify if commenting on own post
    if (ownerId === authorUid || !ownerId || ownerId === 'anonymous') return;
    
    // Check if owner has notifications enabled
    const ownerDoc = await db.doc(`users/${ownerId}`).get();
    const ownerData = ownerDoc.data();
    
    if (ownerData?.settings?.notifications !== false) {
      const tokens = await getUserPushTokens(ownerId);
      
      if (tokens.length > 0) {
        const commenterName = authorName || 'Someone';
        const contentPreview = (content || '').slice(0, 60);
        
        await sendExpoPushNotification(
          tokens,
          '💬 New Comment',
          `${commenterName}: ${contentPreview}...`,
          { type: 'COMMENT', parentId, parentType }
        );
      }
    }
  } catch (err) {
    console.error('Error sending comment notification:', err);
  }
});

// Subscribe new push tokens to the "critical" topic for high-severity alerts
exports.onPushTokenCreated = onDocumentCreated('users/{uid}/pushTokens/{token}', async (event) => {
  const snap = event.data;
  const data = snap.data();
  const token = data.nativeToken || data.token;
  
  if (!token) return;
  
  // Only subscribe native tokens to FCM topics (Expo tokens use Expo's push service)
  if (data.nativeToken) {
    try {
      await admin.messaging().subscribeToTopic(data.nativeToken, 'critical');
      await snap.ref.update({
        subscribedCritical: true,
        subscribedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log('Subscribed token to critical topic');
    } catch (err) {
      console.error('Topic subscription failed', err);
      await snap.ref.update({
        subscribedCritical: false,
        error: err.message,
      });
    }
  }
});
