import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const PROJECT_ID = 'lift-rules-test';

let testEnv: RulesTestEnvironment;

const authedDb = (uid: string, token: Record<string, unknown> = {}) =>
  testEnv.authenticatedContext(uid, token).firestore();

const verifiedDb = (uid: string, token: Record<string, unknown> = {}) =>
  authedDb(uid, { email_verified: true, ...token });

const anonDb = () => testEnv.unauthenticatedContext().firestore();

const seedDoc = async (path: string, data: Record<string, unknown>) => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), path), data);
  });
};

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(resolve(__dirname, '../../firestore.rules'), 'utf8'),
    },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

afterAll(async () => {
  await testEnv?.cleanup();
});

describe('Firestore request privacy rules', () => {
  it('allows valid private requests and denies private requests with groupIds', async () => {
    const db = verifiedDb('owner');

    await assertSucceeds(
      setDoc(doc(db, 'requests/private-valid'), {
        ownerUid: 'owner',
        visibility: 'PRIVATE',
        isPrivate: true,
        content: 'Please pray privately',
      })
    );

    await assertFails(
      setDoc(doc(db, 'requests/private-invalid'), {
        ownerUid: 'owner',
        visibility: 'PRIVATE',
        isPrivate: true,
        groupIds: ['group-a'],
        content: 'This should not target a group',
      })
    );
  });

  it('limits private request reads to owner or admin', async () => {
    await seedDoc('requests/private-request', {
      ownerUid: 'owner',
      visibility: 'PRIVATE',
      isPrivate: true,
      content: 'Private request',
    });

    await assertSucceeds(getDoc(doc(authedDb('owner'), 'requests/private-request')));
    await assertSucceeds(
      getDoc(doc(authedDb('admin', { admin: true }), 'requests/private-request'))
    );
    await assertFails(getDoc(doc(authedDb('other'), 'requests/private-request')));
  });

  it('allows group content reads only for users with matching groupIds', async () => {
    await seedDoc('users/member', { groupIds: ['group-a'] });
    await seedDoc('users/outsider', { groupIds: ['group-b'] });
    await seedDoc('requests/group-request', {
      ownerUid: 'owner',
      visibility: 'GROUP',
      groupIds: ['group-a'],
      content: 'Group prayer',
    });

    await assertSucceeds(getDoc(doc(authedDb('member'), 'requests/group-request')));
    await assertFails(getDoc(doc(authedDb('outsider'), 'requests/group-request')));
  });

  it('requires custom admin claim instead of admin email', async () => {
    await seedDoc('requests/private-request', {
      ownerUid: 'owner',
      visibility: 'PRIVATE',
      isPrivate: true,
      content: 'Private request',
    });

    await assertFails(
      getDoc(doc(authedDb('email-admin', { email: 'fanelesibonge50@gmail.com' }), 'requests/private-request'))
    );
    await assertSucceeds(getDoc(doc(authedDb('claim-admin', { admin: true }), 'requests/private-request')));
  });

  it('blocks banned users and posting-blocked users from creating content', async () => {
    await seedDoc('users/banned', { isBanned: true });
    await seedDoc('users/post-blocked', { isBlockedFromPosting: true });

    await assertFails(
      setDoc(doc(verifiedDb('banned'), 'requests/banned-request'), {
        ownerUid: 'banned',
        visibility: 'PUBLIC',
        isPrivate: false,
        content: 'Should not be allowed',
      })
    );

    await assertFails(
      setDoc(doc(verifiedDb('post-blocked'), 'testimonies/blocked-testimony'), {
        ownerUid: 'post-blocked',
        visibility: 'PUBLIC',
        isPrivate: false,
        content: 'Should not be allowed',
      })
    );
  });

  it('requires verified email for request creation', async () => {
    await assertFails(
      setDoc(doc(authedDb('owner'), 'requests/unverified'), {
        ownerUid: 'owner',
        visibility: 'PUBLIC',
        isPrivate: false,
        content: 'Unverified users cannot create requests',
      })
    );
  });
});

describe('Firestore notification rules', () => {
  const validNotification = {
    type: 'PRAYER',
    recipientUid: 'recipient',
    actorUid: 'actor',
    createdAt: new Date(),
    read: false,
  };

  it('allows uppercase notification types and rejects stale lowercase types', async () => {
    await assertSucceeds(setDoc(doc(authedDb('actor'), 'notifications/valid'), validNotification));

    await assertFails(
      setDoc(doc(authedDb('actor'), 'notifications/lowercase'), {
        ...validNotification,
        type: 'prayer_received',
      })
    );
  });

  it('rejects actor spoofing and self notifications', async () => {
    await assertFails(
      setDoc(doc(authedDb('actor'), 'notifications/spoof'), {
        ...validNotification,
        actorUid: 'someone-else',
      })
    );

    await assertFails(
      setDoc(doc(authedDb('actor'), 'notifications/self'), {
        ...validNotification,
        recipientUid: 'actor',
      })
    );
  });

  it('limits notification reads and updates to the recipient', async () => {
    await seedDoc('notifications/existing', validNotification);

    await assertSucceeds(getDoc(doc(authedDb('recipient'), 'notifications/existing')));
    await assertFails(getDoc(doc(authedDb('actor'), 'notifications/existing')));

    await assertSucceeds(updateDoc(doc(authedDb('recipient'), 'notifications/existing'), { read: true }));
    await assertFails(updateDoc(doc(authedDb('actor'), 'notifications/existing'), { read: true }));
  });
});

describe('Firestore onboarding analytics rules', () => {
  it('rejects anonymous writes and requires matching user id', async () => {
    await assertFails(
      setDoc(doc(anonDb(), 'onboarding_analytics/anon'), {
        userId: 'anonymous',
        completedAt: new Date(),
      })
    );

    await assertFails(
      setDoc(doc(authedDb('user-a'), 'onboarding_analytics/spoof'), {
        userId: 'user-b',
        completedAt: new Date(),
      })
    );

    await assertSucceeds(
      setDoc(doc(authedDb('user-a'), 'onboarding_analytics/own'), {
        userId: 'user-a',
        completedAt: new Date(),
      })
    );
  });
});

describe('Firestore group membership rules', () => {
  it('protects private groups from non-members', async () => {
    await seedDoc('groups/private-group', {
      ownerUid: 'owner',
      memberUids: ['owner', 'member'],
      isPrivate: true,
      name: 'Private group',
    });

    await assertSucceeds(getDoc(doc(authedDb('owner'), 'groups/private-group')));
    await assertSucceeds(getDoc(doc(authedDb('member'), 'groups/private-group')));
    await assertFails(getDoc(doc(authedDb('outsider'), 'groups/private-group')));
    await assertFails(getDoc(doc(anonDb(), 'groups/private-group')));
  });
});
