import { FirebaseApp, FirebaseOptions, getApp, getApps, initializeApp } from 'firebase/app';
// Type declaration in src/types/firebase-auth.d.ts
import { Auth, getAuth, initializeAuth, browserLocalPersistence, getReactNativePersistence } from 'firebase/auth';
import { Firestore, getFirestore } from 'firebase/firestore';
import { FirebaseStorage, getStorage } from 'firebase/storage';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const missingKeys = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);

export const firebaseEnabled = missingKeys.length === 0;

if (!firebaseEnabled) {
  console.warn(
    `Firebase config is incomplete. Missing keys: ${missingKeys.join(
      ', ',
    )}. Add EXPO_PUBLIC_FIREBASE_* values to run against Firebase.`,
  );
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;

if (firebaseEnabled) {
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);

  // Initialize auth with proper persistence
  // Check if auth is already initialized to avoid warnings
  try {
    auth = getAuth(app);
  } catch {
    // Auth not yet initialized, initialize it
    try {
      if (Platform.OS === 'web') {
        auth = initializeAuth(app, {
          persistence: browserLocalPersistence,
        });
      } else {
        auth = initializeAuth(app, {
          persistence: getReactNativePersistence(AsyncStorage),
        });
      }
    } catch (error) {
      const firebaseError = error as { code?: string };
      if (firebaseError.code !== 'auth/already-initialized') {
        console.warn('[Firebase] Auth initialization error:', error);
      }
      auth = getAuth(app);
    }
  }

  db = getFirestore(app);
  storage = getStorage(app);
}

export { app, auth, db, storage };
