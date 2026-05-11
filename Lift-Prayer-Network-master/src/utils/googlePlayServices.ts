/**
 * Utility to detect Google Play Services availability
 * Used to determine if FCM push notifications will work
 */
import { Platform } from 'react-native';
import * as Device from 'expo-device';

// Cache the result to avoid repeated checks
let cachedHasGMS: boolean | null = null;

/**
 * Check if Google Play Services is available on the device
 * Returns true for iOS (uses APNs), web, and Android devices with GMS
 * Returns false for Huawei/HMS-only devices
 */
export const hasGooglePlayServices = async (): Promise<boolean> => {
  // Return cached result if available
  if (cachedHasGMS !== null) {
    return cachedHasGMS;
  }

  // iOS uses APNs, not FCM directly - always works
  if (Platform.OS === 'ios') {
    cachedHasGMS = true;
    return true;
  }

  // Web doesn't use mobile push
  if (Platform.OS === 'web') {
    cachedHasGMS = false;
    return false;
  }

  // Android - check for Google Play Services
  if (Platform.OS === 'android') {
    try {
      // Check device manufacturer
      const manufacturer = Device.manufacturer?.toLowerCase() || '';
      const brand = Device.brand?.toLowerCase() || '';
      
      // Huawei devices manufactured after 2019 typically don't have GMS
      // This is a heuristic - not 100% accurate but covers most cases
      const isHuawei = manufacturer.includes('huawei') || brand.includes('huawei');
      const isHonor = manufacturer.includes('honor') || brand.includes('honor');
      
      if (isHuawei || isHonor) {
        // Try to detect if this Huawei has GMS (older models do)
        // For now, assume newer Huawei/Honor devices don't have GMS
        console.log('[GMS] Huawei/Honor device detected, assuming no GMS');
        cachedHasGMS = false;
        return false;
      }

      // For other Android devices, assume GMS is available
      cachedHasGMS = true;
      return true;
    } catch (error) {
      console.warn('[GMS] Error checking device info:', error);
      // Default to true for unknown devices
      cachedHasGMS = true;
      return true;
    }
  }

  // Default fallback
  cachedHasGMS = true;
  return true;
};

/**
 * Check if the device needs polling for notifications
 * (i.e., doesn't have Google Play Services)
 */
export const needsNotificationPolling = async (): Promise<boolean> => {
  const hasGMS = await hasGooglePlayServices();
  return !hasGMS && Platform.OS === 'android';
};

/**
 * Get device info for debugging
 */
export const getDeviceInfo = () => {
  return {
    platform: Platform.OS,
    manufacturer: Device.manufacturer,
    brand: Device.brand,
    modelName: Device.modelName,
    osVersion: Device.osVersion,
  };
};
