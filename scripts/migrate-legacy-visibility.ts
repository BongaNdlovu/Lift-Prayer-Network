/**
 * Migration script to add visibility field to legacy requests/testimonies
 * 
 * Run with: npx ts-node scripts/migrate-legacy-visibility.ts
 * 
 * Requires: firebase-admin and a service account key
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Initialize Firebase Admin
// You'll need to download your service account key from Firebase Console
// and place it in the project root as 'service-account.json'
const serviceAccount = require('../service-account.json');

if (getApps().length === 0) {
  initializeApp({
    credential: cert(serviceAccount),
  });
}

const db = getFirestore();

async function migrateRequests() {
  console.log('Migrating requests...');
  
  const requestsRef = db.collection('requests');
  const snapshot = await requestsRef.get();
  
  let updated = 0;
  let skipped = 0;
  
  const batch = db.batch();
  let batchCount = 0;
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    
    // Skip if visibility is already set
    if (data.visibility) {
      skipped++;
      continue;
    }
    
    // Determine visibility based on existing data
    let visibility = 'PUBLIC';
    if (data.isPrivate === true) {
      visibility = 'PRIVATE';
    } else if (data.groupIds && data.groupIds.length > 0) {
      visibility = 'GROUP';
    }
    
    batch.update(doc.ref, { visibility });
    updated++;
    batchCount++;
    
    // Firestore batches have a limit of 500 operations
    if (batchCount >= 500) {
      await batch.commit();
      console.log(`  Committed batch of ${batchCount} updates`);
      batchCount = 0;
    }
  }
  
  // Commit any remaining updates
  if (batchCount > 0) {
    await batch.commit();
  }
  
  console.log(`Requests: Updated ${updated}, Skipped ${skipped} (already had visibility)`);
}

async function migrateTestimonies() {
  console.log('Migrating testimonies...');
  
  const testimoniesRef = db.collection('testimonies');
  const snapshot = await testimoniesRef.get();
  
  let updated = 0;
  let skipped = 0;
  
  const batch = db.batch();
  let batchCount = 0;
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    
    // Skip if visibility is already set
    if (data.visibility) {
      skipped++;
      continue;
    }
    
    // Determine visibility based on existing data
    let visibility = 'PUBLIC';
    if (data.isPrivate === true) {
      visibility = 'PRIVATE';
    } else if (data.groupIds && data.groupIds.length > 0) {
      visibility = 'GROUP';
    }
    
    batch.update(doc.ref, { visibility });
    updated++;
    batchCount++;
    
    // Firestore batches have a limit of 500 operations
    if (batchCount >= 500) {
      await batch.commit();
      console.log(`  Committed batch of ${batchCount} updates`);
      batchCount = 0;
    }
  }
  
  // Commit any remaining updates
  if (batchCount > 0) {
    await batch.commit();
  }
  
  console.log(`Testimonies: Updated ${updated}, Skipped ${skipped} (already had visibility)`);
}

async function main() {
  console.log('=== Legacy Visibility Migration ===\n');
  console.log('This script adds visibility field to existing requests/testimonies');
  console.log('that were created before the privacy feature was added.\n');
  
  try {
    await migrateRequests();
    await migrateTestimonies();
    
    console.log('\n✅ Migration complete!');
    console.log('Users should now see all public posts in their feed.');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

main();
