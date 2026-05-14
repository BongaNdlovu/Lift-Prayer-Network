/* eslint-disable no-console */
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const emailArg = process.argv.find((arg) => arg.startsWith('--email='));
const uidArg = process.argv.find((arg) => arg.startsWith('--uid='));
const adminFlag = process.argv.includes('--admin');
const moderatorFlag = process.argv.includes('--moderator');
const clearFlag = process.argv.includes('--clear');

function readProjectId() {
  if (process.env.GOOGLE_CLOUD_PROJECT) return process.env.GOOGLE_CLOUD_PROJECT;
  if (process.env.GCLOUD_PROJECT) return process.env.GCLOUD_PROJECT;
  if (process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID) return process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;

  const firebaseRcPath = path.join(__dirname, '..', '.firebaserc');
  if (fs.existsSync(firebaseRcPath)) {
    const firebaseRc = JSON.parse(fs.readFileSync(firebaseRcPath, 'utf8'));
    if (firebaseRc?.projects?.default) return firebaseRc.projects.default;
  }

  return undefined;
}

async function main() {
  if (!emailArg && !uidArg) {
    throw new Error('Usage: node scripts/set-custom-claims.js --email=user@example.com --admin [--moderator] [--clear]');
  }

  if (admin.apps.length === 0) {
    const projectId = readProjectId();
    admin.initializeApp(projectId ? { projectId } : undefined);
  }

  const auth = admin.auth();
  const user = uidArg
    ? await auth.getUser(uidArg.split('=').slice(1).join('=').trim())
    : await auth.getUserByEmail(emailArg.split('=').slice(1).join('=').trim().toLowerCase());

  const existingClaims = user.customClaims || {};
  const nextClaims = clearFlag
    ? {}
    : {
        ...existingClaims,
        ...(adminFlag ? { admin: true } : {}),
        ...(moderatorFlag ? { moderator: true } : {}),
      };

  await auth.setCustomUserClaims(user.uid, nextClaims);
  console.log(`[Claims] Updated ${user.email || user.uid}:`, nextClaims);
  console.log('[Claims] The user must sign out and sign in again for token claims to refresh.');
}

main().catch((error) => {
  console.error('[Claims] Failed:', error);
  process.exitCode = 1;
});
