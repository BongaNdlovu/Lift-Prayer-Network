/* eslint-disable no-console */
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const KEEP_EMAIL = 'fanelesibonge50@gmail.com';
const CONFIRM_FLAG = '--confirm';
const DRY_RUN = !process.argv.includes(CONFIRM_FLAG);

function readProjectId() {
  if (process.env.GOOGLE_CLOUD_PROJECT) return process.env.GOOGLE_CLOUD_PROJECT;
  if (process.env.GCLOUD_PROJECT) return process.env.GCLOUD_PROJECT;
  if (process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID) return process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;

  const googleServicesPath = path.join(__dirname, '..', 'google-services.json');
  if (fs.existsSync(googleServicesPath)) {
    const googleServices = JSON.parse(fs.readFileSync(googleServicesPath, 'utf8'));
    if (googleServices?.project_info?.project_id) {
      return googleServices.project_info.project_id;
    }
  }

  const firebaseRcPath = path.join(__dirname, '..', '.firebaserc');
  if (fs.existsSync(firebaseRcPath)) {
    const firebaseRc = JSON.parse(fs.readFileSync(firebaseRcPath, 'utf8'));
    if (firebaseRc?.projects?.default) {
      return firebaseRc.projects.default;
    }
  }

  return undefined;
}

async function initAdmin() {
  if (admin.apps.length === 0) {
    const projectId = readProjectId();
    admin.initializeApp(projectId ? { projectId } : undefined);
  }
  return {
    auth: admin.auth(),
    db: admin.firestore(),
  };
}

async function findKeepUser(auth) {
  try {
    return await auth.getUserByEmail(KEEP_EMAIL);
  } catch (error) {
    throw new Error(`Could not find Auth user for ${KEEP_EMAIL}: ${error.message}`);
  }
}

async function listAllAuthUsers(auth) {
  const users = [];
  let pageToken;

  do {
    const page = await auth.listUsers(1000, pageToken);
    users.push(...page.users);
    pageToken = page.pageToken;
  } while (pageToken);

  return users;
}

async function deleteOtherAuthUsers(auth, keepUid) {
  const users = await listAllAuthUsers(auth);
  const deleteUids = users
    .filter((user) => user.uid !== keepUid)
    .map((user) => user.uid);

  console.log(`[Auth] Users found: ${users.length}`);
  console.log(`[Auth] Users to delete: ${deleteUids.length}`);

  if (DRY_RUN || deleteUids.length === 0) return;

  for (let index = 0; index < deleteUids.length; index += 1000) {
    const chunk = deleteUids.slice(index, index + 1000);
    const result = await auth.deleteUsers(chunk);
    console.log(`[Auth] Deleted ${result.successCount}; failed ${result.failureCount}`);
    for (const error of result.errors) {
      console.warn(`[Auth] Failed to delete ${chunk[error.index]}: ${error.error.message}`);
    }
  }
}

async function deleteDocumentRecursive(db, docRef) {
  if (DRY_RUN) return;
  await db.recursiveDelete(docRef);
}

async function clearFirestore(db, keepUid) {
  const collections = await db.listCollections();
  let totalDocs = 0;
  let docsToDelete = 0;

  for (const collectionRef of collections) {
    const snapshot = await collectionRef.get();
    totalDocs += snapshot.size;

    for (const docSnap of snapshot.docs) {
      const shouldKeepUserProfile = collectionRef.id === 'users' && docSnap.id === keepUid;
      if (shouldKeepUserProfile) {
        const subcollections = await docSnap.ref.listCollections();
        for (const subcollection of subcollections) {
          const subSnapshot = await subcollection.get();
          docsToDelete += subSnapshot.size;
          console.log(`[Firestore] ${DRY_RUN ? 'Would delete' : 'Deleting'} users/${keepUid}/${subcollection.id} (${subSnapshot.size} docs)`);
          if (!DRY_RUN) {
            for (const subDoc of subSnapshot.docs) {
              await deleteDocumentRecursive(db, subDoc.ref);
            }
          }
        }
        console.log(`[Firestore] Keeping users/${keepUid}`);
        continue;
      }

      docsToDelete += 1;
      console.log(`[Firestore] ${DRY_RUN ? 'Would delete' : 'Deleting'} ${collectionRef.id}/${docSnap.id}`);
      await deleteDocumentRecursive(db, docSnap.ref);
    }
  }

  console.log(`[Firestore] Top-level docs found: ${totalDocs}`);
  console.log(`[Firestore] Docs queued for deletion: ${docsToDelete}`);
}

async function main() {
  console.log(DRY_RUN ? '[Reset] Dry run only. Re-run with --confirm to delete.' : '[Reset] CONFIRMED destructive reset.');
  const { auth, db } = await initAdmin();
  const keepUser = await findKeepUser(auth);
  console.log(`[Reset] Keeping ${KEEP_EMAIL} (${keepUser.uid})`);

  await clearFirestore(db, keepUser.uid);
  await deleteOtherAuthUsers(auth, keepUser.uid);

  console.log(DRY_RUN ? '[Reset] Dry run complete. No data deleted.' : '[Reset] Reset complete.');
}

main().catch((error) => {
  console.error('[Reset] Failed:', error);
  process.exitCode = 1;
});
