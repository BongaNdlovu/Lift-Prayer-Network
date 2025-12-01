import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import {
  User,
  UserCredential,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  sendEmailVerification,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  EmailAuthProvider,
  linkWithCredential,
  reload,
  deleteUser,
  reauthenticateWithCredential,
  AuthError,
} from 'firebase/auth';
import { collection, getDocs, deleteDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, firebaseEnabled, db } from '../services/firebase';
import { ensureUserProfile, syncOnboardingData, type OnboardingAnswers } from '../services/userProfile';
import { clearAllCache, getCacheStats } from '../services/offlineCache';
import { cleanupUserData } from '../services/userCleanup';

const ONBOARDING_ANSWERS_KEY = '@lift_onboarding_answers';

export const checkPendingData = async (): Promise<{
  hasPending: boolean;
  pendingPrayers: number;
  pendingRequests: number;
}> => {
  const stats = await getCacheStats();
  return {
    hasPending: stats.pendingPrayers > 0 || stats.pendingRequests > 0,
    pendingPrayers: stats.pendingPrayers,
    pendingRequests: stats.pendingRequests,
  };
};

const cleanupPushTokens = async (uid: string): Promise<void> => {
  if (!db) return;

  try {
    const tokensRef = collection(db, `users/${uid}/pushTokens`);
    const snapshot = await getDocs(tokensRef);
    const deletions = snapshot.docs.map((docSnap) => deleteDoc(docSnap.ref));
    await Promise.all(deletions);
    console.log(`[Auth] Deleted ${snapshot.size} push tokens`);
  } catch (err) {
    console.warn('[Auth] Could not cleanup push tokens:', err);
  }
};

// Firebase error code to user-friendly message mapping
const getAuthErrorMessage = (error: AuthError): string => {
  const errorMessages: Record<string, string> = {
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/user-disabled': 'This account has been disabled. Please contact support.',
    'auth/user-not-found': 'No account found with this email. Please sign up first.',
    'auth/wrong-password': 'Incorrect password. Please try again.',
    'auth/invalid-credential': 'Invalid email or password. Please check your credentials and try again.',
    'auth/email-already-in-use': 'An account with this email already exists. Please sign in instead.',
    'auth/weak-password': 'Password is too weak. Please use at least 6 characters.',
    'auth/operation-not-allowed': 'This sign-in method is not enabled. Please contact support.',
    'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
    'auth/network-request-failed': 'Network error. Please check your internet connection.',
    'auth/popup-closed-by-user': 'Sign-in was cancelled.',
    'auth/cancelled-popup-request': 'Sign-in was cancelled.',
    'auth/requires-recent-login': 'Please sign in again to complete this action.',
  };

  return errorMessages[error.code] || error.message || 'An unexpected error occurred. Please try again.';
};

type AuthContextValue = {
  user: User | null;
  initializing: boolean;
  signIn: (email: string, password: string) => Promise<UserCredential>;
  signUp: (displayName: string, email: string, password: string) => Promise<UserCredential>;
  signInGuest: () => Promise<UserCredential>;
  signOut: (force?: boolean) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  resendVerification: () => Promise<void>;
  linkGuestToEmail: (displayName: string, email: string, password: string) => Promise<UserCredential>;
  deleteAccount: (password?: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  // Sync onboarding data to user profile
  const syncOnboardingToProfile = useCallback(async (user: User) => {
    try {
      const answersJson = await AsyncStorage.getItem(ONBOARDING_ANSWERS_KEY);
      if (answersJson) {
        const answers = JSON.parse(answersJson) as OnboardingAnswers;
        await syncOnboardingData(user, answers);
        console.log('[Auth] Synced onboarding data to user profile');
      }
    } catch (err) {
      console.warn('[Auth] Could not sync onboarding data:', err);
    }
  }, []);

  // Listen for auth state changes
  useEffect(() => {
    if (!auth || !firebaseEnabled) {
      console.log('[Auth] Firebase not enabled, skipping auth listener');
      setInitializing(false);
      return;
    }

    console.log('[Auth] Setting up auth state listener');
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      console.log('[Auth] Auth state changed:', nextUser?.email || 'No user');
      setUser(nextUser);
      if (nextUser) {
        try {
          await ensureUserProfile(nextUser);
          // Sync onboarding data to user profile (if they completed onboarding before signing in)
          await syncOnboardingToProfile(nextUser);
        } catch (err) {
          console.error('[Auth] Error ensuring user profile:', err);
        }
      }
      setInitializing(false);
    });

    return unsubscribe;
  }, [syncOnboardingToProfile]);

  const signIn = useCallback(async (email: string, password: string): Promise<UserCredential> => {
    if (!auth) {
      throw new Error('Firebase is not initialized. Please try again later.');
    }

    const trimmedEmail = email.trim().toLowerCase();
    
    if (!trimmedEmail) {
      throw new Error('Please enter your email address.');
    }
    if (!password) {
      throw new Error('Please enter your password.');
    }

    try {
      console.log('[Auth] Attempting sign in for:', trimmedEmail);
      const credential = await signInWithEmailAndPassword(auth, trimmedEmail, password);
      console.log('[Auth] Sign in successful');
      return credential;
    } catch (error) {
      console.error('[Auth] Sign in error:', error);
      throw new Error(getAuthErrorMessage(error as AuthError));
    }
  }, []);

  const signUp = useCallback(async (displayName: string, email: string, password: string): Promise<UserCredential> => {
    if (!auth) {
      throw new Error('Firebase is not initialized. Please try again later.');
    }

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = displayName.trim();

    if (!trimmedName) {
      throw new Error('Please enter your display name.');
    }
    if (!trimmedEmail) {
      throw new Error('Please enter your email address.');
    }
    if (!password) {
      throw new Error('Please enter a password.');
    }
    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters long.');
    }

    try {
      console.log('[Auth] Attempting sign up for:', trimmedEmail);
      const credential = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
      
      // Update display name
      await updateProfile(credential.user, { displayName: trimmedName });
      
      // Create user profile in Firestore
      await ensureUserProfile(credential.user, { displayName: trimmedName });
      
      // Send verification email
      try {
        await sendEmailVerification(credential.user);
        console.log('[Auth] Verification email sent');
      } catch (emailError) {
        console.warn('[Auth] Could not send verification email:', emailError);
      }

      console.log('[Auth] Sign up successful');
      return credential;
    } catch (error) {
      console.error('[Auth] Sign up error:', error);
      throw new Error(getAuthErrorMessage(error as AuthError));
    }
  }, []);

  const signInGuest = useCallback(async (): Promise<UserCredential> => {
    if (!auth) {
      throw new Error('Firebase is not initialized. Please try again later.');
    }

    try {
      console.log('[Auth] Attempting guest sign in');
      const credential = await signInAnonymously(auth);
      console.log('[Auth] Guest sign in successful');
      return credential;
    } catch (error) {
      console.error('[Auth] Guest sign in error:', error);
      throw new Error(getAuthErrorMessage(error as AuthError));
    }
  }, []);

  const signOut = useCallback(async (force: boolean = false): Promise<void> => {
    if (!auth) return;

    const currentUser = auth.currentUser;

    try {
      console.log('[Auth] Signing out');

      if (!force) {
        const pending = await checkPendingData();
        if (pending.hasPending) {
          const error: any = new Error('PENDING_DATA');
          error.pendingPrayers = pending.pendingPrayers;
          error.pendingRequests = pending.pendingRequests;
          throw error;
        }
      }
      
      if (currentUser) {
        await cleanupPushTokens(currentUser.uid);
      }
      
      // Clear cached feed data to prevent privacy leaks
      // This ensures private/group content isn't visible after logout
      await clearAllCache();
      console.log('[Auth] Cleared offline cache');
      
      await firebaseSignOut(auth);
      console.log('[Auth] Sign out successful');
    } catch (error: any) {
      console.error('[Auth] Sign out error:', error);
      if (error?.message === 'PENDING_DATA') {
        throw error;
      }
      throw new Error(error?.message || 'Failed to sign out. Please try again.');
    }
  }, []);

  const resetPassword = useCallback(async (email: string): Promise<void> => {
    if (!auth) {
      throw new Error('Firebase is not initialized. Please try again later.');
    }

    const trimmedEmail = email.trim().toLowerCase();
    
    if (!trimmedEmail) {
      throw new Error('Please enter your email address.');
    }

    try {
      console.log('[Auth] Sending password reset email to:', trimmedEmail);
      await sendPasswordResetEmail(auth, trimmedEmail);
      console.log('[Auth] Password reset email sent');
    } catch (error) {
      console.error('[Auth] Password reset error:', error);
      throw new Error(getAuthErrorMessage(error as AuthError));
    }
  }, []);

  const resendVerification = useCallback(async (): Promise<void> => {
    if (!auth?.currentUser) {
      throw new Error('No user is currently signed in.');
    }

    try {
      await sendEmailVerification(auth.currentUser);
      await reload(auth.currentUser);
      console.log('[Auth] Verification email resent');
    } catch (error) {
      console.error('[Auth] Resend verification error:', error);
      throw new Error(getAuthErrorMessage(error as AuthError));
    }
  }, []);

  const linkGuestToEmail = useCallback(async (
    displayName: string,
    email: string,
    password: string
  ): Promise<UserCredential> => {
    if (!auth?.currentUser) {
      throw new Error('No user is currently signed in.');
    }

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = displayName.trim();

    if (!trimmedName) {
      throw new Error('Please enter your display name.');
    }
    if (!trimmedEmail) {
      throw new Error('Please enter your email address.');
    }
    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters long.');
    }

    try {
      const credential = EmailAuthProvider.credential(trimmedEmail, password);
      const result = await linkWithCredential(auth.currentUser, credential);
      
      await updateProfile(result.user, { displayName: trimmedName });
      await ensureUserProfile(result.user, { displayName: trimmedName });
      
      try {
        await sendEmailVerification(result.user);
      } catch (emailError) {
        console.warn('[Auth] Could not send verification email:', emailError);
      }

      console.log('[Auth] Guest account linked successfully');
      return result;
    } catch (error) {
      console.error('[Auth] Link guest account error:', error);
      throw new Error(getAuthErrorMessage(error as AuthError));
    }
  }, []);

  const deleteAccount = useCallback(async (password?: string): Promise<void> => {
    if (!auth?.currentUser) {
      throw new Error('No user is currently signed in.');
    }

    const currentUser = auth.currentUser;

    try {
      // Re-authenticate if password provided (for email/password users)
      if (password && currentUser.email) {
        const credential = EmailAuthProvider.credential(currentUser.email, password);
        await reauthenticateWithCredential(currentUser, credential);
      }

      if (currentUser.uid) {
        await cleanupUserData(currentUser.uid);
      }

      await deleteUser(currentUser);
      console.log('[Auth] Account deleted successfully');
    } catch (error) {
      console.error('[Auth] Delete account error:', error);
      throw new Error(getAuthErrorMessage(error as AuthError));
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      initializing,
      signIn,
      signUp,
      signInGuest,
      signOut,
      resetPassword,
      resendVerification,
      linkGuestToEmail,
      deleteAccount,
    }),
    [user, initializing, signIn, signUp, signInGuest, signOut, resetPassword, resendVerification, linkGuestToEmail, deleteAccount]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
};
