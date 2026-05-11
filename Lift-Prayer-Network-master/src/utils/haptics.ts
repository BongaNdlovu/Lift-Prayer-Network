/**
 * Haptic Feedback Utilities
 * 
 * Centralized haptic feedback for consistent UX across the app.
 * Automatically handles platform differences and gracefully fails
 * on devices without haptic support.
 */

import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

// Flag to track if haptics are available
let hapticsAvailable = true;

/**
 * Check if haptics are available on this device
 */
export const isHapticsAvailable = (): boolean => {
  return Platform.OS !== 'web' && hapticsAvailable;
};

/**
 * Light impact - for subtle interactions like button taps, selections
 */
export const lightImpact = async (): Promise<void> => {
  if (!isHapticsAvailable()) return;
  
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    hapticsAvailable = false;
  }
};

/**
 * Medium impact - for standard interactions like confirming actions
 */
export const mediumImpact = async (): Promise<void> => {
  if (!isHapticsAvailable()) return;
  
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {
    hapticsAvailable = false;
  }
};

/**
 * Heavy impact - for significant actions like completing a task
 */
export const heavyImpact = async (): Promise<void> => {
  if (!isHapticsAvailable()) return;
  
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  } catch {
    hapticsAvailable = false;
  }
};

/**
 * Selection feedback - for picker/selection changes
 */
export const selectionFeedback = async (): Promise<void> => {
  if (!isHapticsAvailable()) return;
  
  try {
    await Haptics.selectionAsync();
  } catch {
    hapticsAvailable = false;
  }
};

/**
 * Success notification - for successful operations
 */
export const successNotification = async (): Promise<void> => {
  if (!isHapticsAvailable()) return;
  
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    hapticsAvailable = false;
  }
};

/**
 * Warning notification - for warnings or cautions
 */
export const warningNotification = async (): Promise<void> => {
  if (!isHapticsAvailable()) return;
  
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  } catch {
    hapticsAvailable = false;
  }
};

/**
 * Error notification - for errors or failures
 */
export const errorNotification = async (): Promise<void> => {
  if (!isHapticsAvailable()) return;
  
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  } catch {
    hapticsAvailable = false;
  }
};

// Preset haptic patterns for common actions
export const HapticPatterns = {
  /** Light tap for button press */
  buttonPress: lightImpact,
  
  /** Selection change in picker/list */
  selection: selectionFeedback,
  
  /** Prayer action - medium impact */
  pray: mediumImpact,
  
  /** Amen/Like action - success notification */
  amen: successNotification,
  
  /** Pull to refresh */
  pullToRefresh: mediumImpact,
  
  /** Submit form successfully */
  submitSuccess: successNotification,
  
  /** Error occurred */
  error: errorNotification,
  
  /** Delete action */
  delete: warningNotification,
  
  /** Celebrate/confetti moment */
  celebrate: heavyImpact,
  
  /** Tab switch */
  tabSwitch: lightImpact,
  
  /** Long press menu open */
  longPress: mediumImpact,
  
  /** Swipe action */
  swipe: lightImpact,
};

export default HapticPatterns;
