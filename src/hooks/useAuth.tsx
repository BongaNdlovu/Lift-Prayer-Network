import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
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
} from 'firebase/auth';
import { auth, firebaseEnabled } from '../services/firebase';
import { ensureUserProfile } from '../services/userProfile';

type AuthContextValue = {
  user: User | null;
  initializing: boolean;
  signIn: (email: string, password: string) => Promise<UserCredential | void>;
  signUp: (
    displayName: string,
    email: string,
    password: string,
  ) => Promise<UserCredential | void>;
  signInGuest: () => Promise<UserCredential | void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  resendVerification: () => Promise<void>;
  linkGuestToEmail: (
    displayName: string,
    email: string,
    password: string,
  ) => Promise<UserCredential | void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    if (!auth || !firebaseEnabled) {
      setInitializing(false);
      return;
    }
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (nextUser) {
        await ensureUserProfile(nextUser);
      }
      setInitializing(false);
    });
    return unsub;
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!auth) return;
    return signInWithEmailAndPassword(auth, email.trim(), password);
  };

  const signUp = async (displayName: string, email: string, password: string) => {
    if (!auth) return;
    const credential = await createUserWithEmailAndPassword(
      auth,
      email.trim(),
      password,
    );
    if (displayName) {
      await updateProfile(credential.user, { displayName });
    }
    await ensureUserProfile(credential.user, { displayName });
    await sendEmailVerification(credential.user);
    return credential;
  };

  const signInGuest = async () => {
    if (!auth) return;
    return signInAnonymously(auth);
  };

  const signOut = async () => {
    if (!auth) return;
    await firebaseSignOut(auth);
  };

  const resetPassword = async (email: string) => {
    if (!auth) return;
    await sendPasswordResetEmail(auth, email.trim());
  };

  const resendVerification = async () => {
    if (!auth || !auth.currentUser) return;
    await sendEmailVerification(auth.currentUser);
    await reload(auth.currentUser);
  };

  const linkGuestToEmail = async (
    displayName: string,
    email: string,
    password: string,
  ) => {
    if (!auth || !auth.currentUser) return;
    const credential = EmailAuthProvider.credential(email.trim(), password);
    const result = await linkWithCredential(auth.currentUser, credential);
    if (displayName) {
      await updateProfile(result.user, { displayName });
    }
    await ensureUserProfile(result.user, { displayName });
    await sendEmailVerification(result.user);
    return result;
  };

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
    }),
    [user, initializing],
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
