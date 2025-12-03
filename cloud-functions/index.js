const { onDocumentCreated, onDocumentDeleted } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
// const { onUserDeleted } = require('firebase-functions/v2/identity'); // Requires Identity extension - enable in Firebase Console first
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
  comments: { maxPerHour: 20, maxPerDay: 10 },  // Limited to 10 comments per day
  notifications: { maxPerMinute: 10 },
  groupJoins: { maxPerHour: 5, maxPerDay: 10 },  // Limit group join attempts
  reports: { maxPerHour: 5, maxPerDay: 15 },     // Limit report submissions
};

// ============================================================================
// Content Moderation Configuration
// ============================================================================
const SUSPICIOUS_PATTERNS = [
  /bit\.ly/i, /tinyurl/i, /goo\.gl/i,  // URL shorteners
  /\$\d+/,                              // Money amounts
  /whatsapp|telegram|signal/i,          // Messaging apps (potential scam)
  /send money|wire transfer|western union|bitcoin|crypto/i,
  /click here|act now|limited time/i,
  /\b(viagra|cialis|pharmacy)\b/i,
];

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

/**
 * Check content for profanity and suspicious patterns
 * @param {string} content - Text content to check
 * @returns {{clean: boolean, hasProfanity: boolean, hasSuspiciousLinks: boolean, flags: string[]}}
 */
function moderateContent(content) {
  if (!content || typeof content !== 'string') {
    return { clean: true, hasProfanity: false, hasSuspiciousLinks: false, flags: [] };
  }

  const flags = [];
  
  // Check for profanity
  const hasProfanity = filter.isProfane(content);
  if (hasProfanity) {
    flags.push('profanity');
  }

  // Check for suspicious patterns
  let hasSuspiciousLinks = false;
  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.test(content)) {
      hasSuspiciousLinks = true;
      flags.push('suspicious_content');
      break;
    }
  }

  return {
    clean: !hasProfanity && !hasSuspiciousLinks,
    hasProfanity,
    hasSuspiciousLinks,
    flags,
  };
}

/**
 * Log moderation action for review
 */
async function logModerationAction(contentType, contentId, userId, flags, content) {
  try {
    await db.collection('moderationLogs').add({
      contentType,
      contentId,
      userId,
      flags,
      contentPreview: content?.substring(0, 200) || '',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      reviewed: false,
    });
    console.log(`Content flagged for moderation: ${contentType}/${contentId} - ${flags.join(', ')}`);
  } catch (error) {
    console.error('Failed to log moderation action:', error);
  }
}

// Helper function to send push notification via Expo with ticket tracking
async function sendExpoPushNotification(expoPushTokens, title, body, data = {}, options = {}) {
  if (!expoPushTokens || expoPushTokens.length === 0) {
    console.log('[sendExpoPushNotification] No tokens provided, skipping');
    return;
  }
  
  console.log(`[sendExpoPushNotification] Sending to ${expoPushTokens.length} tokens: "${title}"`);

  const messages = expoPushTokens.map(token => ({
    to: token,
    sound: 'default',
    title,
    body,
    data,
    // Android-specific settings
    channelId: options.channelId || 'default',
    priority: options.priority || 'high',
    // iOS-specific settings  
    _contentAvailable: true,
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
    
    // Process tickets and handle errors
    if (result.data) {
      const ticketsToStore = [];
      
      for (let i = 0; i < result.data.length; i++) {
        const item = result.data[i];
        const token = expoPushTokens[i];
        
        if (item.status === 'error') {
          console.error(`Push notification error for token ${token}:`, item.message, item.details);
          
          // Mark token as potentially dead if it's a device-not-registered error
          if (item.details?.error === 'DeviceNotRegistered') {
            await markTokenAsDead(token, 'DeviceNotRegistered');
          }
        } else if (item.id) {
          // Store ticket for later receipt checking and retry capability
          ticketsToStore.push({
            ticketId: item.id,
            token,
            title,
            body,
            data: data || {},
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            checked: false,
            retryCount: 0,
            lastRetryAt: null,
          });
        }
      }
      
      // Store tickets in batches for later receipt checking
      if (ticketsToStore.length > 0) {
        const batch = db.batch();
        for (const ticket of ticketsToStore) {
          const ticketRef = db.collection('pushTickets').doc(ticket.ticketId);
          batch.set(ticketRef, ticket);
        }
        await batch.commit();
      }
    }
    
    return result;
  } catch (error) {
    console.error('Error sending Expo push notification:', error);
    throw error;
  }
}

/**
 * Mark a push token as dead/invalid
 */
async function markTokenAsDead(token, reason) {
  try {
    // Find and update the token across all users
    const usersSnapshot = await db.collectionGroup('pushTokens')
      .where('token', '==', token)
      .get();
    
    const batch = db.batch();
    usersSnapshot.forEach(doc => {
      batch.update(doc.ref, {
        isDead: true,
        deadReason: reason,
        markedDeadAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
    
    if (!usersSnapshot.empty) {
      await batch.commit();
      console.log(`Marked token as dead: ${token.substring(0, 20)}... (${reason})`);
    }
  } catch (error) {
    console.error('Error marking token as dead:', error);
  }
}

// Helper function to get user's push tokens (excludes dead tokens)
async function getUserPushTokens(userId) {
  if (!userId) {
    console.log('[getUserPushTokens] No userId provided');
    return [];
  }
  
  try {
    const tokensSnapshot = await db.collection('users').doc(userId).collection('pushTokens').get();
    const tokens = [];
    
    console.log(`[getUserPushTokens] Found ${tokensSnapshot.size} token documents for user ${userId}`);
    
    tokensSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`[getUserPushTokens] Token doc ${doc.id}: isDead=${data.isDead}, hasToken=${!!data.token}`);
      // Skip dead tokens
      if (data.token && !data.isDead) {
        tokens.push(data.token);
      }
    });
    
    console.log(`[getUserPushTokens] Returning ${tokens.length} active tokens for user ${userId}`);
    return tokens;
  } catch (error) {
    console.error('[getUserPushTokens] Error getting push tokens for user:', userId, error);
    return [];
  }
}

// ============================================================================
// SCHEDULED JOBS
// ============================================================================

/**
 * Check Expo push receipts and clean up dead tokens
 * Runs every 15 minutes
 */
exports.checkPushReceipts = onSchedule('every 15 minutes', async (event) => {
  console.log('Starting push receipt check...');
  
  try {
    // Get unchecked tickets from the last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const ticketsSnapshot = await db.collection('pushTickets')
      .where('checked', '==', false)
      .where('createdAt', '>', oneDayAgo)
      .limit(100)
      .get();
    
    if (ticketsSnapshot.empty) {
      console.log('No unchecked tickets found');
      return;
    }
    
    const ticketIds = [];
    const ticketDocs = [];
    
    ticketsSnapshot.forEach(doc => {
      ticketIds.push(doc.id);
      ticketDocs.push({ id: doc.id, ...doc.data() });
    });
    
    console.log(`Checking ${ticketIds.length} push receipts...`);
    
    // Fetch receipts from Expo
    const response = await fetch('https://exp.host/--/api/v2/push/getReceipts', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ids: ticketIds }),
    });
    
    const result = await response.json();
    
    if (result.data) {
      const batch = db.batch();
      const tokensToMark = [];
      
      for (const ticketDoc of ticketDocs) {
        const receipt = result.data[ticketDoc.id];
        const ticketRef = db.collection('pushTickets').doc(ticketDoc.id);
        
        if (receipt) {
          if (receipt.status === 'error') {
            console.log(`Receipt error for ${ticketDoc.id}:`, receipt.message, receipt.details);
            
            // Mark token as dead if device not registered
            if (receipt.details?.error === 'DeviceNotRegistered') {
              tokensToMark.push({ token: ticketDoc.token, reason: 'DeviceNotRegistered' });
            }
          }
          
          // Mark ticket as checked
          batch.update(ticketRef, { 
            checked: true, 
            receiptStatus: receipt.status,
            receiptError: receipt.details?.error || null,
            checkedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        } else {
          // Receipt not ready yet, will check again later
          batch.update(ticketRef, { 
            lastCheckAttempt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      }
      
      await batch.commit();
      
      // Mark dead tokens
      for (const { token, reason } of tokensToMark) {
        await markTokenAsDead(token, reason);
      }
      
      console.log(`Processed ${ticketIds.length} receipts, marked ${tokensToMark.length} tokens as dead`);
    }
  } catch (error) {
    console.error('Error checking push receipts:', error);
  }
});

/**
 * Clean up dead push tokens and old tickets
 * Runs daily at 3 AM
 */
exports.cleanupDeadTokens = onSchedule('0 3 * * *', async (event) => {
  console.log('Starting dead token cleanup...');
  
  try {
    let deletedTokens = 0;
    let deletedTickets = 0;
    
    // Delete tokens marked as dead more than 7 days ago
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const deadTokensSnapshot = await db.collectionGroup('pushTokens')
      .where('isDead', '==', true)
      .where('markedDeadAt', '<', sevenDaysAgo)
      .limit(500)
      .get();
    
    if (!deadTokensSnapshot.empty) {
      const batch = db.batch();
      deadTokensSnapshot.forEach(doc => {
        batch.delete(doc.ref);
        deletedTokens++;
      });
      await batch.commit();
    }
    
    // Delete old checked tickets (older than 7 days)
    const oldTicketsSnapshot = await db.collection('pushTickets')
      .where('checked', '==', true)
      .where('createdAt', '<', sevenDaysAgo)
      .limit(500)
      .get();
    
    if (!oldTicketsSnapshot.empty) {
      const batch = db.batch();
      oldTicketsSnapshot.forEach(doc => {
        batch.delete(doc.ref);
        deletedTickets++;
      });
      await batch.commit();
    }
    
    console.log(`Cleanup complete: deleted ${deletedTokens} dead tokens, ${deletedTickets} old tickets`);
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
});

/**
 * Clean up stale offline queues from users who haven't synced
 * Runs daily at 4 AM
 */
exports.cleanupStaleOfflineQueues = onSchedule('0 4 * * *', async (event) => {
  console.log('Starting stale offline queue cleanup...');
  
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    let cleanedCount = 0;
    const threshold = admin.firestore.Timestamp.fromDate(thirtyDaysAgo);
    
    // Clean up old pending prayers that were never synced
    const stalePrayersSnapshot = await db.collection('pendingPrayers')
      .where('createdAt', '<', threshold)
      .limit(500)
      .get();
    
    if (!stalePrayersSnapshot.empty) {
      const batch = db.batch();
      stalePrayersSnapshot.forEach(doc => {
        batch.delete(doc.ref);
        cleanedCount++;
      });
      await batch.commit();
    }
    
    // Clean up old pending requests
    const staleRequestsSnapshot = await db.collection('pendingRequests')
      .where('createdAt', '<', threshold)
      .limit(500)
      .get();
    
    if (!staleRequestsSnapshot.empty) {
      const batch = db.batch();
      staleRequestsSnapshot.forEach(doc => {
        batch.delete(doc.ref);
        cleanedCount++;
      });
      await batch.commit();
    }
    
    console.log(`Cleaned up ${cleanedCount} stale offline queue items`);
  } catch (error) {
    console.error('Error cleaning stale offline queues:', error);
  }
});

/**
 * Retry failed push notifications
 * Runs every 30 minutes
 */
exports.retryFailedPushes = onSchedule('every 30 minutes', async (event) => {
  console.log('Starting failed push retry...');
  
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
    const sixHoursTimestamp = admin.firestore.Timestamp.fromDate(sixHoursAgo);
    
    // Get failed tickets from the last 6 hours
    const failedTicketsSnapshot = await db.collection('pushTickets')
      .where('receiptStatus', '==', 'error')
      .where('receiptError', 'in', ['MessageTooBig', 'MessageRateExceeded', 'InvalidCredentials'])
      .where('createdAt', '>', sixHoursTimestamp)
      .limit(50)
      .get();
    
    if (failedTicketsSnapshot.empty) {
      console.log('No failed pushes to retry');
      return;
    }
    
    let retryCount = 0;
    let successCount = 0;
    
    for (const ticketDoc of failedTicketsSnapshot.docs) {
      const ticketData = ticketDoc.data();
      const lastRetryAt = ticketData.lastRetryAt?.toDate?.() || null;
      
      // Skip if retried recently or already exceeded retry limit
      if ((ticketData.retryCount || 0) >= 3) {
        continue;
      }
      if (lastRetryAt && lastRetryAt > oneHourAgo) {
        continue;
      }
      
      retryCount++;
      
      try {
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: ticketData.token,
            title: ticketData.title,
            body: ticketData.body,
            data: ticketData.data || {},
          }),
        });
        
        const result = await response.json();
        
        if (result.data?.status === 'ok') {
          successCount++;
          await ticketDoc.ref.update({
            retryCount: admin.firestore.FieldValue.increment(1),
            lastRetryAt: admin.firestore.FieldValue.serverTimestamp(),
            retryTicketId: result.data.id,
            retryStatus: 'sent',
          });
        } else {
          await ticketDoc.ref.update({
            retryCount: admin.firestore.FieldValue.increment(1),
            lastRetryAt: admin.firestore.FieldValue.serverTimestamp(),
            retryStatus: 'failed',
            retryError: result.data?.message || 'Unknown error',
          });
        }
      } catch (err) {
        console.error('Error retrying push:', err);
        await ticketDoc.ref.update({
          retryCount: admin.firestore.FieldValue.increment(1),
          lastRetryAt: admin.firestore.FieldValue.serverTimestamp(),
          retryStatus: 'error',
        });
      }
    }
    
    console.log(`Retried ${retryCount} failed pushes, ${successCount} successful`);
  } catch (error) {
    console.error('Error in retry failed pushes:', error);
  }
});

// When someone prays for a request - notify the request owner
// NOTE: Counting is done client-side in logPrayer() to avoid double-counting
// This function ONLY handles notifications
exports.onPrayerCreated = onDocumentCreated('prayers/{prayerId}', async (event) => {
  const snap = event.data;
  const data = snap.data();
  const { actorUid, targetRequestId, targetOwnerUid, targetSummary, actorDisplayName, isSelfPrayer } = data;
  
  console.log(`[onPrayerCreated] Prayer created: actor=${actorUid}, target=${targetOwnerUid}, requestId=${targetRequestId}`);
  
  // Skip notification for self-prayers (handled client-side)
  if (isSelfPrayer) {
    console.log('[onPrayerCreated] Skipping notification for self-prayer');
    return;
  }

  // Send notification to request owner (if not praying for own request)
  if (targetOwnerUid && targetOwnerUid !== actorUid && targetOwnerUid !== 'anonymous' && targetOwnerUid !== 'anon') {
    try {
      // Check if user has notifications enabled
      const ownerDoc = await db.doc(`users/${targetOwnerUid}`).get();
      
      if (!ownerDoc.exists) {
        console.log(`[onPrayerCreated] Owner document not found for ${targetOwnerUid}`);
        return;
      }
      
      const ownerData = ownerDoc.data();
      console.log(`[onPrayerCreated] Owner settings:`, JSON.stringify(ownerData?.settings || {}));
      
      // Check notification settings - default to true if not explicitly set to false
      const notificationsEnabled = ownerData?.settings?.notifications !== false;
      const prayerNotificationsEnabled = ownerData?.settings?.notificationsPrayers !== false;
      
      if (!notificationsEnabled) {
        console.log(`[onPrayerCreated] Notifications disabled for user ${targetOwnerUid}`);
        return;
      }
      
      if (!prayerNotificationsEnabled) {
        console.log(`[onPrayerCreated] Prayer notifications disabled for user ${targetOwnerUid}`);
        return;
      }
      
      const tokens = await getUserPushTokens(targetOwnerUid);
      console.log(`[onPrayerCreated] Found ${tokens.length} push tokens for ${targetOwnerUid}`);
      
      if (tokens.length > 0) {
        const prayerName = actorDisplayName || 'Someone';
        const contentPreview = targetSummary?.slice(0, 50) || 'your prayer request';
        
        await sendExpoPushNotification(
          tokens,
          '🙏 Prayer Support',
          `${prayerName} is praying for ${contentPreview}...`,
          { type: 'PRAYER', requestId: targetRequestId },
          { channelId: 'prayers', priority: 'high' }
        );
        console.log(`[onPrayerCreated] Prayer notification sent to ${targetOwnerUid}`);
      } else {
        console.log(`[onPrayerCreated] No push tokens found for ${targetOwnerUid}`);
      }
    } catch (err) {
      console.error('[onPrayerCreated] Error sending prayer notification:', err);
    }
  } else {
    console.log(`[onPrayerCreated] Skipping notification: targetOwnerUid=${targetOwnerUid}, actorUid=${actorUid}`);
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
          if (memberData?.settings?.notifications !== false && memberData?.settings?.notificationsGroups !== false) {
            const tokens = await getUserPushTokens(memberId);
            
            if (tokens.length > 0) {
              const groupName = groupData.name || 'your group';
              const requesterName = data.userDisplayName || 'Someone';
              
              await sendExpoPushNotification(
                tokens,
                `🙏 New Prayer in ${groupName}`,
                `${requesterName}: ${content.slice(0, 80)}...`,
                { type: 'GROUP_REQUEST', requestId, groupId },
                { channelId: 'prayers', priority: 'high' }
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

// When a testimony is created - content moderation + notify those who prayed
exports.onTestimonyCreated = onDocumentCreated('testimonies/{testimonyId}', async (event) => {
  const snap = event.data;
  const data = snap.data();
  const { ownerUid, userDisplayName, linkedRequestId, content } = data;

  console.log(`[onTestimonyCreated] Testimony created: owner=${ownerUid}, linkedRequest=${linkedRequestId}`);

  // Server-side content moderation for testimonies
  const moderation = moderateContent(content);
  if (!moderation.clean) {
    await logModerationAction('testimony', event.params.testimonyId, ownerUid, moderation.flags, content);
    
    // Flag the testimony for review
    try {
      await snap.ref.update({
        flagged: true,
        flaggedReasons: moderation.flags,
        flaggedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`[onTestimonyCreated] Flagged testimony ${event.params.testimonyId} for moderation: ${moderation.flags.join(', ')}`);
    } catch (flagErr) {
      console.error('[onTestimonyCreated] Error flagging testimony:', flagErr);
    }
  }
  
  // If linked to a request, notify people who prayed for it
  if (linkedRequestId) {
    try {
      console.log(`[onTestimonyCreated] Looking for prayers on request ${linkedRequestId}`);
      
      // Get all prayers for this request
      const prayersSnapshot = await db.collection('prayers')
        .where('targetRequestId', '==', linkedRequestId)
        .get();
      
      console.log(`[onTestimonyCreated] Found ${prayersSnapshot.size} prayers for this request`);
      
      // Collect unique user IDs who prayed (excluding the owner)
      const prayerUserIds = new Set();
      prayersSnapshot.forEach(doc => {
        const prayerData = doc.data();
        if (prayerData.actorUid && prayerData.actorUid !== ownerUid) {
          prayerUserIds.add(prayerData.actorUid);
        }
      });
      
      console.log(`[onTestimonyCreated] Unique users who prayed: ${prayerUserIds.size}`);
      
      // Send notifications to each person who prayed
      let sentCount = 0;
      for (const userId of prayerUserIds) {
        const userDoc = await db.doc(`users/${userId}`).get();
        
        if (!userDoc.exists) {
          console.log(`[onTestimonyCreated] User ${userId} not found, skipping`);
          continue;
        }
        
        const userData = userDoc.data();
        
        // Check notification settings - default to true if not explicitly set to false
        const notificationsEnabled = userData?.settings?.notifications !== false;
        const testimonyNotificationsEnabled = userData?.settings?.notificationsTestimonies !== false;
        
        if (!notificationsEnabled || !testimonyNotificationsEnabled) {
          console.log(`[onTestimonyCreated] Notifications disabled for user ${userId}`);
          continue;
        }
        
        const tokens = await getUserPushTokens(userId);
        console.log(`[onTestimonyCreated] Found ${tokens.length} tokens for user ${userId}`);
        
        if (tokens.length > 0) {
          await sendExpoPushNotification(
            tokens,
            '✨ Prayer Answered!',
            `${userDisplayName || 'Someone'} shared a testimony: ${(content || '').slice(0, 80)}...`,
            { type: 'TESTIMONY', testimonyId: event.params.testimonyId, linkedRequestId },
            { channelId: 'default', priority: 'high' }
          );
          sentCount++;
        }
      }
      
      console.log(`[onTestimonyCreated] Sent testimony notifications to ${sentCount}/${prayerUserIds.size} users`);
    } catch (err) {
      console.error('[onTestimonyCreated] Error sending testimony notifications:', err);
    }
  } else {
    console.log('[onTestimonyCreated] No linkedRequestId, skipping notifications');
  }
});

// When a comment is added - rate limit check + content moderation + notify the request/testimony owner
exports.onCommentCreated = onDocumentCreated('comments/{commentId}', async (event) => {
  const snap = event.data;
  const data = snap.data();
  const { authorUid, authorName, parentId, parentType, content } = data;
  
  // Server-side rate limiting for comments (10 per day)
  const dailyRateCheck = await checkRateLimit(authorUid, 'comments', 'day');
  if (!dailyRateCheck.allowed) {
    console.warn(`Comment rate limit exceeded for user ${authorUid} (${dailyRateCheck.count}/${dailyRateCheck.limit} daily)`);
    await logRateLimitViolation(authorUid, 'comments', dailyRateCheck.count, dailyRateCheck.limit);
    
    // Delete the comment that exceeded the limit
    try {
      await snap.ref.delete();
      console.log(`Deleted rate-limited comment ${event.params.commentId}`);
      
      // Decrement the parent's comment count since we're removing this one
      const collectionName = parentType === 'REQUEST' ? 'requests' : 'testimonies';
      await db.doc(`${collectionName}/${parentId}`).update({
        commentCount: admin.firestore.FieldValue.increment(-1),
      });
    } catch (deleteErr) {
      console.error('Error deleting rate-limited comment:', deleteErr);
    }
    return;
  }

  // Server-side content moderation for comments
  const moderation = moderateContent(content);
  if (!moderation.clean) {
    await logModerationAction('comment', event.params.commentId, authorUid, moderation.flags, content);
    
    // Flag the comment for review but don't delete (let admins decide)
    try {
      await snap.ref.update({
        flagged: true,
        flaggedReasons: moderation.flags,
        flaggedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`Flagged comment ${event.params.commentId} for moderation: ${moderation.flags.join(', ')}`);
    } catch (flagErr) {
      console.error('Error flagging comment:', flagErr);
    }
  }
  
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
    
    if (ownerData?.settings?.notifications !== false && ownerData?.settings?.notificationsComments !== false) {
      const tokens = await getUserPushTokens(ownerId);
      
      if (tokens.length > 0) {
        const commenterName = authorName || 'Someone';
        const contentPreview = (content || '').slice(0, 60);
        
        await sendExpoPushNotification(
          tokens,
          '💬 New Comment',
          `${commenterName}: ${contentPreview}...`,
          { type: 'COMMENT', parentId, parentType },
          { channelId: 'default', priority: 'default' }
        );
      }
    }
  } catch (err) {
    console.error('Error sending comment notification:', err);
  }
});

// ============================================================================
// Announcement Notifications - Broadcast to all users
// ============================================================================

/**
 * When a new announcement is created, send push notifications to all users
 */
exports.onAnnouncementCreated = onDocumentCreated('announcements/{announcementId}', async (event) => {
  const snap = event.data;
  const data = snap.data();
  const { title, content, priority, isActive, authorUid } = data;
  
  // Only send notifications for active announcements
  if (!isActive) {
    console.log('[onAnnouncementCreated] Announcement is not active, skipping notification');
    return;
  }
  
  console.log(`[onAnnouncementCreated] Broadcasting announcement: "${title}" (priority: ${priority})`);
  
  try {
    // Get all users with push tokens
    const usersSnapshot = await db.collection('users').get();
    let notificationsSent = 0;
    let usersProcessed = 0;
    
    // Priority emoji for notification title
    const priorityEmoji = priority === 'urgent' ? '🚨' : priority === 'important' ? '📢' : '📣';
    const notificationTitle = `${priorityEmoji} ${title}`;
    const notificationBody = content.length > 150 ? content.substring(0, 150) + '...' : content;
    
    // Process users in batches to avoid overwhelming the push service
    const batchSize = 50;
    const userDocs = usersSnapshot.docs;
    
    for (let i = 0; i < userDocs.length; i += batchSize) {
      const batch = userDocs.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (userDoc) => {
        const userId = userDoc.id;
        const userData = userDoc.data();
        
        // Skip the author (they created it, they know about it)
        if (userId === authorUid) {
          return;
        }
        
        // Check if user has notifications enabled
        if (userData?.settings?.notifications === false) {
          return;
        }
        
        usersProcessed++;
        
        const tokens = await getUserPushTokens(userId);
        if (tokens.length > 0) {
          await sendExpoPushNotification(
            tokens,
            notificationTitle,
            notificationBody,
            { 
              type: 'ANNOUNCEMENT', 
              announcementId: event.params.announcementId,
              priority 
            },
            { 
              channelId: 'announcements', 
              priority: priority === 'urgent' ? 'high' : 'default' 
            }
          );
          notificationsSent++;
        }
      });
      
      await Promise.all(batchPromises);
      
      // Small delay between batches to avoid rate limiting
      if (i + batchSize < userDocs.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log(`[onAnnouncementCreated] Broadcast complete: ${notificationsSent} notifications sent to ${usersProcessed} users`);
    
    // Update announcement with notification stats
    await snap.ref.update({
      notificationsSent,
      notificationsSentAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    
  } catch (err) {
    console.error('[onAnnouncementCreated] Error broadcasting announcement:', err);
  }
});

/**
 * When a new devotion is published, send push notifications to all users
 */
exports.onDevotionCreated = onDocumentCreated('devotions/{devotionId}', async (event) => {
  const snap = event.data;
  const data = snap.data();
  const { title, bibleVerse, bibleReference, isPublished, authorUid } = data;
  
  // Only send notifications for published devotions
  if (!isPublished) {
    console.log('[onDevotionCreated] Devotion is not published, skipping notification');
    return;
  }
  
  console.log(`[onDevotionCreated] Broadcasting devotion: "${title}"`);
  
  try {
    // Get all users with push tokens
    const usersSnapshot = await db.collection('users').get();
    let notificationsSent = 0;
    
    const notificationTitle = `✝️ ${title}`;
    const notificationBody = `${bibleReference}: "${bibleVerse.substring(0, 100)}${bibleVerse.length > 100 ? '...' : ''}"`;
    
    // Process users in batches
    const batchSize = 50;
    const userDocs = usersSnapshot.docs;
    
    for (let i = 0; i < userDocs.length; i += batchSize) {
      const batch = userDocs.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (userDoc) => {
        const userId = userDoc.id;
        const userData = userDoc.data();
        
        // Skip the author
        if (userId === authorUid) {
          return;
        }
        
        // Check if user has notifications enabled
        if (userData?.settings?.notifications === false) {
          return;
        }
        
        const tokens = await getUserPushTokens(userId);
        if (tokens.length > 0) {
          await sendExpoPushNotification(
            tokens,
            notificationTitle,
            notificationBody,
            { 
              type: 'DEVOTION', 
              devotionId: event.params.devotionId 
            },
            { channelId: 'devotions', priority: 'default' }
          );
          notificationsSent++;
        }
      });
      
      await Promise.all(batchPromises);
      
      if (i + batchSize < userDocs.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log(`[onDevotionCreated] Broadcast complete: ${notificationsSent} notifications sent`);
    
    // Update devotion with notification stats
    await snap.ref.update({
      notificationsSent,
      notificationsSentAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    
  } catch (err) {
    console.error('[onDevotionCreated] Error broadcasting devotion:', err);
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

// When someone amens/reacts to a testimony - notify the owner
exports.onReactionCreated = onDocumentCreated('reactions/{reactionId}', async (event) => {
  const snap = event.data;
  const data = snap.data();
  const { actorUid, targetId, targetType, reactionType } = data;
  
  // Only send notifications for amen reactions on testimonies
  if (targetType !== 'TESTIMONY' || reactionType !== 'amen') {
    return;
  }
  
  try {
    // Get the testimony to find the owner
    const testimonyDoc = await db.doc(`testimonies/${targetId}`).get();
    if (!testimonyDoc.exists) {
      console.log('Testimony not found for reaction notification');
      return;
    }
    
    const testimonyData = testimonyDoc.data();
    const ownerId = testimonyData.ownerUid;
    
    // Don't notify if user is amening their own testimony
    if (ownerId === actorUid || !ownerId || ownerId === 'anonymous') {
      return;
    }
    
    // Check if owner has notifications enabled
    const ownerDoc = await db.doc(`users/${ownerId}`).get();
    const ownerData = ownerDoc.data();
    
    if (ownerData?.settings?.notifications !== false && ownerData?.settings?.notificationsTestimonies !== false) {
      const tokens = await getUserPushTokens(ownerId);
      
      if (tokens.length > 0) {
        // Get actor's display name
        let actorName = 'Someone';
        try {
          const actorDoc = await db.doc(`users/${actorUid}`).get();
          if (actorDoc.exists) {
            actorName = actorDoc.data()?.displayName || 'Someone';
          }
        } catch (err) {
          console.warn('Could not fetch actor name:', err);
        }
        
        const contentPreview = (testimonyData.content || '').slice(0, 50);
        
        await sendExpoPushNotification(
          tokens,
          '🙏 Amen!',
          `${actorName} said amen to your testimony: ${contentPreview}...`,
          { type: 'AMEN', testimonyId: targetId },
          { channelId: 'default', priority: 'default' }
        );
        
        console.log(`Amen notification sent to ${ownerId}`);
      }
    }
  } catch (err) {
    console.error('Error sending amen notification:', err);
  }
});

/**
 * Send weekly recap notifications
 * Runs every Sunday at 9 AM
 */
exports.sendWeeklyRecap = onSchedule('0 9 * * 0', async (event) => {
  console.log('Starting weekly recap notifications...');
  
  try {
    const usersSnapshot = await db.collection('users')
      .where('settings.weeklyRecapEnabled', '==', true)
      .limit(500)
      .get();
    
    if (usersSnapshot.empty) {
      console.log('No users with weekly recap enabled');
      return;
    }
    
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const weekTimestamp = admin.firestore.Timestamp.fromDate(oneWeekAgo);
    let sentCount = 0;
    
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      const userData = userDoc.data();
      
      try {
        // Get user's weekly stats
        const prayersSnapshot = await db.collection('prayers')
          .where('actorUid', '==', userId)
          .where('prayedAt', '>=', weekTimestamp)
          .get();
        const prayerCount = prayersSnapshot.size;
        
        const requestsSnapshot = await db.collection('requests')
          .where('ownerUid', '==', userId)
          .where('createdAt', '>=', weekTimestamp)
          .get();
        const requestCount = requestsSnapshot.size;
        
        // Unique people prayed for
        const uniquePeople = new Set();
        prayersSnapshot.forEach(doc => {
          const data = doc.data();
          if (data.targetOwnerUid) {
            uniquePeople.add(data.targetOwnerUid);
          }
        });
        
        const streakDays = userData.stats?.streakDays || 0;
        let message = `This week: ${prayerCount} prayers`;
        if (uniquePeople.size > 0) {
          message += ` for ${uniquePeople.size} people`;
        }
        if (requestCount > 0) {
          message += ` • ${requestCount} new requests`;
        }
        if (streakDays > 0) {
          message += `. ${streakDays}-day streak! 🙏`;
        }
        
        const tokens = await getUserPushTokens(userId);
        if (tokens.length > 0) {
          await sendExpoPushNotification(
            tokens,
            '🙏 Your Weekly Prayer Recap',
            message,
            { type: 'WEEKLY_RECAP', userId },
            { channelId: 'default', priority: 'high' }
          );
          sentCount++;
        }
      } catch (err) {
        console.error(`Error sending recap to user ${userId}:`, err);
      }
    }
    
    console.log(`Sent weekly recap to ${sentCount} users`);
  } catch (error) {
    console.error('Error in weekly recap:', error);
  }
});

// ============================================================================
// USER DELETION CLEANUP (DISABLED - Requires Identity Extension)
// ============================================================================
// 
// STATUS: COMMENTED OUT - Requires Firebase Identity Platform
// 
// To enable this function:
// 1. Go to Firebase Console > Authentication > Settings
// 2. Click "Upgrade" to enable Identity Platform (may incur costs)
// 3. Once enabled, uncomment the import at the top of this file:
//    const { onUserDeleted } = require('firebase-functions/v2/identity');
// 4. Uncomment the function below
// 5. Deploy: firebase deploy --only functions
//
// What this function does:
// - Deletes user's prayer records
// - Anonymizes their requests and testimonies (preserves content)
// - Removes them from all groups
// - Deletes their comments, reports, notifications, and push tokens
// - Deletes their user document
//
// Alternative: Manual cleanup via Admin SDK or scheduled function
// ============================================================================
/*
exports.onUserDeleted = onUserDeleted(async (event) => {
  const uid = event?.data?.uid || event.uid;
  if (!uid) {
    console.warn('onUserDeleted fired without uid');
    return;
  }

  console.log(`Cleaning up data for deleted user: ${uid}`);

  const writeOps = [];

  // Helper to chunk commits to stay under Firestore limits
  const commitWrites = async (ops) => {
    let batch = db.batch();
    let count = 0;
    const commits = [];

    for (const op of ops) {
      if (count >= 450) {
        commits.push(batch.commit());
        batch = db.batch();
        count = 0;
      }

      if (op.type === 'delete') {
        batch.delete(op.ref);
      } else if (op.type === 'update') {
        batch.update(op.ref, op.data);
      }
      count += 1;
    }

    if (count > 0) {
      commits.push(batch.commit());
    }

    await Promise.all(commits);
  };

  try {
    // 1. Delete prayers by the user
    const prayers = await db.collection('prayers')
      .where('actorUid', '==', uid)
      .get();
    prayers.forEach((doc) => writeOps.push({ type: 'delete', ref: doc.ref }));

    // 2. Anonymize requests
    const requests = await db.collection('requests')
      .where('ownerUid', '==', uid)
      .get();
    requests.forEach((doc) => writeOps.push({
      type: 'update',
      ref: doc.ref,
      data: {
        ownerUid: 'deleted_user',
        userDisplayName: 'Deleted User',
        userEmail: null,
        userPhotoURL: null,
      },
    }));

    // 3. Anonymize testimonies
    const testimonies = await db.collection('testimonies')
      .where('ownerUid', '==', uid)
      .get();
    testimonies.forEach((doc) => writeOps.push({
      type: 'update',
      ref: doc.ref,
      data: {
        ownerUid: 'deleted_user',
        userDisplayName: 'Deleted User',
        userEmail: null,
        userPhotoURL: null,
      },
    }));

    // 4. Delete comments authored by user
    const comments = await db.collection('comments')
      .where('authorUid', '==', uid)
      .get();
    comments.forEach((doc) => writeOps.push({ type: 'delete', ref: doc.ref }));

    // 5. Delete reports filed by the user
    const reports = await db.collection('reports')
      .where('actorUid', '==', uid)
      .get();
    reports.forEach((doc) => writeOps.push({ type: 'delete', ref: doc.ref }));

    // 6. Remove from groups
    const groups = await db.collection('groups')
      .where('memberUids', 'array-contains', uid)
      .get();
    groups.forEach((doc) => {
      const memberUids = (doc.data().memberUids || []).filter((id) => id !== uid);
      writeOps.push({
        type: 'update',
        ref: doc.ref,
        data: { memberUids },
      });
    });

    // 7. Delete user document
    writeOps.push({ type: 'delete', ref: db.doc(`users/${uid}`) });

    // 8. Delete push tokens
    const tokens = await db.collection(`users/${uid}/pushTokens`).get();
    tokens.forEach((doc) => writeOps.push({ type: 'delete', ref: doc.ref }));

    // 9. Delete notifications for user
    const notifications = await db.collection('notifications')
      .where('recipientUid', '==', uid)
      .get();
    notifications.forEach((doc) => writeOps.push({ type: 'delete', ref: doc.ref }));

    await commitWrites(writeOps);
    console.log(`Successfully cleaned up data for user: ${uid} (operations: ${writeOps.length})`);
  } catch (error) {
    console.error(`Error cleaning up user data for ${uid}:`, error);
    await db.collection('deletionErrors').add({
      uid,
      error: error.message,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
});
*/
