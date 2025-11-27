const { onDocumentCreated, onDocumentWritten } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');
const Filter = require('bad-words');

admin.initializeApp();
const db = admin.firestore();
const filter = new Filter();

exports.onPrayerCreated = onDocumentCreated('prayers/{prayerId}', async (event) => {
  const snap = event.data;
    const data = snap.data();
    const { actorUid, targetRequestId, targetOwnerUid, targetSummary } = data;
    const requestRef = db.doc(`requests/${targetRequestId}`);
    const actorRef = db.doc(`users/${actorUid}`);
    const aggregateRef = db.doc(`userPrayedFor/${actorUid}/people/${targetOwnerUid || 'anon'}`);

    await db.runTransaction(async (tx) => {
      const requestSnap = await tx.get(requestRef);
      if (requestSnap.exists) {
        tx.update(requestRef, { prayers: admin.firestore.FieldValue.increment(1) });
      }
      tx.set(
        aggregateRef,
        {
          targetOwnerUid: targetOwnerUid || 'anon',
          targetName: targetSummary?.slice(0, 40) || 'Unknown',
          count: admin.firestore.FieldValue.increment(1),
          lastPrayedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      tx.set(
        actorRef,
        { stats: { prayerCount: admin.firestore.FieldValue.increment(1) } },
        { merge: true },
      );
    });
});

exports.onRequestWrite = onDocumentWritten('requests/{requestId}', async (event) => {
    const snapshot = await db.collection('requests').get();
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

exports.moderateRequest = onDocumentCreated('requests/{requestId}', async (event) => {
  const snap = event.data;
    const data = snap.data();
    const content = data.content || '';
    if (filter.isProfane(content)) {
      await snap.ref.update({
        status: 'REVIEW',
        moderatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
});

// Subscribe new push tokens (native FCM/APNs if present) to the "critical" topic for high-severity alerts.
exports.onPushTokenCreated = onDocumentCreated('users/{uid}/pushTokens/{token}', async (event) => {
  const snap = event.data;
    const data = snap.data();
    const token = data.nativeToken || data.token;
    if (!token) return;
    try {
      await admin.messaging().subscribeToTopic(token, 'critical');
      await snap.ref.update({
        subscribedCritical: true,
        subscribedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (err) {
      console.error('Topic subscription failed', err);
      await snap.ref.update({
        subscribedCritical: false,
        error: err.message,
      });
    }
  });
