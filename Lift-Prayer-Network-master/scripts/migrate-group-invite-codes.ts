/**
 * Migration script to add inviteCode field to existing groups
 * 
 * Run with: npx ts-node scripts/migrate-group-invite-codes.ts
 * 
 * This script:
 * 1. Fetches all groups from Firestore
 * 2. Adds inviteCode field (first 8 chars of ID, uppercase) to groups that don't have it
 * 3. Reports progress and any errors
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load service account from environment or file
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || 
  path.join(__dirname, '..', 'service-account.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ Service account file not found at:', serviceAccountPath);
  console.error('   Set GOOGLE_APPLICATION_CREDENTIALS env var or place service-account.json in project root');
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

async function migrateGroups() {
  console.log('🚀 Starting group invite code migration...\n');

  const groupsRef = db.collection('groups');
  const snapshot = await groupsRef.get();

  console.log(`📊 Found ${snapshot.size} groups to check\n`);

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const groupId = doc.id;
    const groupName = data.name || 'Unnamed';

    // Skip if already has inviteCode
    if (data.inviteCode) {
      console.log(`⏭️  Skipping "${groupName}" (${groupId}) - already has inviteCode`);
      skipped++;
      continue;
    }

    // Generate invite code from ID
    const inviteCode = groupId.slice(0, 8).toUpperCase();

    try {
      await doc.ref.update({ inviteCode });
      console.log(`✅ Migrated "${groupName}" (${groupId}) -> inviteCode: ${inviteCode}`);
      migrated++;
    } catch (err) {
      console.error(`❌ Error migrating "${groupName}" (${groupId}):`, err);
      errors++;
    }
  }

  console.log('\n📈 Migration Summary:');
  console.log(`   ✅ Migrated: ${migrated}`);
  console.log(`   ⏭️  Skipped:  ${skipped}`);
  console.log(`   ❌ Errors:   ${errors}`);
  console.log(`   📊 Total:    ${snapshot.size}`);
}

migrateGroups()
  .then(() => {
    console.log('\n✨ Migration complete!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n💥 Migration failed:', err);
    process.exit(1);
  });
