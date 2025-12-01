/**
 * Type declarations for Firebase Auth React Native persistence
 * 
 * The getReactNativePersistence function exists in the firebase/auth bundle
 * but isn't properly exported in the TypeScript definitions.
 */

import { Persistence } from 'firebase/auth';
import { ReactNativeAsyncStorage } from '@react-native-async-storage/async-storage';

declare module 'firebase/auth' {
  /**
   * Returns a persistence object that stores auth state in React Native AsyncStorage.
   * This keeps users logged in even after closing the app.
   * 
   * @param storage - AsyncStorage instance from @react-native-async-storage/async-storage
   * @returns A Persistence object for use with initializeAuth
   */
  export function getReactNativePersistence(
    storage: typeof ReactNativeAsyncStorage
  ): Persistence;
}
