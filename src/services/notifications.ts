import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db, firebaseEnabled } from './firebase';

// Get the project ID from app config
const getProjectId = (): string => {
  // Try to get from Constants.expoConfig first (newer Expo versions)
  const projectId = Constants.expoConfig?.extra?.eas?.projectId 
    || Constants.manifest?.extra?.eas?.projectId
    || Constants.manifest2?.extra?.expoClient?.extra?.eas?.projectId;
  
  if (!projectId) {
    console.warn('[Notifications] No projectId found in app config. Push notifications may not work correctly.');
    // Fallback to the known project ID
    return '122737a1-4d4a-4986-9807-12dbdb314dca';
  }
  
  return projectId;
};

type RegisterResult = {
  status: Notifications.PermissionStatus;
  expoPushToken?: string;
  devicePushToken?: string;
  error?: string;
};

export const registerForPushNotifications = async (): Promise<RegisterResult> => {
  // Check if we're on a physical device (push notifications don't work on simulators)
  if (Platform.OS === 'android' && !Constants.isDevice) {
    console.warn('[Notifications] Push notifications require a physical device on Android');
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    console.log('[Notifications] Permission not granted:', finalStatus);
    return { status: finalStatus };
  }

  // Get Expo push token with projectId (REQUIRED for push notifications to work)
  const projectId = getProjectId();
  console.log('[Notifications] Using projectId:', projectId);
  
  let expoPushToken: string | undefined;
  let tokenError: string | undefined;
  
  try {
    const expoTokenResponse = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    expoPushToken = expoTokenResponse.data;
    console.log('[Notifications] Expo push token:', expoPushToken);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Notifications] Failed to get Expo push token:', errorMessage);
    tokenError = errorMessage;
  }

  // Get native device token (for FCM on Android, APNs on iOS)
  let devicePushToken: string | undefined;
  if (expoPushToken) {
    try {
      const deviceTokenResponse = await Notifications.getDevicePushTokenAsync();
      devicePushToken = deviceTokenResponse.data;
      console.log('[Notifications] Device push token:', devicePushToken);
    } catch (err) {
      console.warn('[Notifications] Failed to fetch device push token:', err);
    }
  }

  // Set up Android notification channel (required for Android 8+)
  if (Platform.OS === 'android') {
    await setupAndroidNotificationChannels();
  }

  return {
    status: finalStatus,
    expoPushToken,
    devicePushToken,
    error: tokenError,
  };
};

// Set up Android notification channels
const setupAndroidNotificationChannels = async () => {
  // Default channel for regular notifications
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#f59e0b',
    sound: 'default',
  });

  // Critical channel for urgent prayer requests
  await Notifications.setNotificationChannelAsync('critical', {
    name: 'Critical Prayers',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 500, 250, 500],
    lightColor: '#ef4444',
    sound: 'default',
    bypassDnd: true,
  });

  // Prayer updates channel
  await Notifications.setNotificationChannelAsync('prayers', {
    name: 'Prayer Updates',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250],
    lightColor: '#f59e0b',
  });

  console.log('[Notifications] Android notification channels configured');
};

export const storePushToken = async (
  userUid: string,
  expoPushToken: string,
  devicePushToken?: string,
) => {
  if (!firebaseEnabled || !db) {
    console.log('[Notifications] Firebase not enabled, skipping token storage');
    return;
  }
  
  // Use a sanitized version of the token as the document ID
  // Expo tokens look like: ExponentPushToken[xxx]
  const id = expoPushToken.replace(/[^a-zA-Z0-9]/g, '_');
  const ref = doc(db, 'users', userUid, 'pushTokens', id);
  
  console.log(`[Notifications] Storing push token for user ${userUid}`);
  console.log(`[Notifications] Token: ${expoPushToken.substring(0, 30)}...`);
  
  try {
    await setDoc(
      ref,
      {
        token: expoPushToken,
        nativeToken: devicePushToken || null,
        platform: Platform.OS,
        subscribedCritical: !!devicePushToken,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      },
      { merge: true },
    );
    console.log('[Notifications] Push token stored successfully');
  } catch (error) {
    console.error('[Notifications] Error storing push token:', error);
    throw error;
  }
};

export const setupNotificationHandler = () => {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      console.log('[Notifications] Received notification:', notification.request.content.title);
      return {
        shouldShowAlert: true,
        shouldPlaySound: true,  // Enable sound for better visibility
        shouldSetBadge: true,   // Enable badge count
        shouldShowBanner: true,
        shouldShowList: true,
      };
    },
  });
  console.log('[Notifications] Notification handler configured');
};

/**
 * Send a test local notification to verify notifications are working
 * This bypasses the server and sends directly to the device
 */
export const sendTestNotification = async (): Promise<boolean> => {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      console.log('[Notifications] Permission not granted for test notification');
      return false;
    }
    
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🧪 Test Notification',
        body: 'If you see this, local notifications are working!',
        data: { type: 'TEST' },
        sound: 'default',
      },
      trigger: null, // Send immediately
    });
    
    console.log('[Notifications] Test notification sent');
    return true;
  } catch (error) {
    console.error('[Notifications] Error sending test notification:', error);
    return false;
  }
};

/**
 * Get the current push token status for debugging
 */
export const getPushTokenStatus = async (): Promise<{
  permissionStatus: string;
  expoPushToken: string | null;
  error: string | null;
}> => {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    
    if (status !== 'granted') {
      return {
        permissionStatus: status,
        expoPushToken: null,
        error: 'Permission not granted',
      };
    }
    
    const projectId = getProjectId();
    const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
    
    return {
      permissionStatus: status,
      expoPushToken: tokenResponse.data,
      error: null,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Provide helpful guidance for common errors
    let friendlyError = errorMessage;
    if (errorMessage.includes('MISSING_INSTANCEID_SERVICE')) {
      friendlyError = 'Fetching the token failed: ' + errorMessage + 
        '\n\nThis usually means:\n' +
        '1. Google Play Services needs to be updated\n' +
        '2. The google-services.json may have incorrect package name\n' +
        '3. Try updating Google Play Services in the Play Store';
    } else if (errorMessage.includes('SERVICE_NOT_AVAILABLE')) {
      friendlyError = errorMessage + '\n\nGoogle Play Services is temporarily unavailable. Please try again later.';
    }
    
    return {
      permissionStatus: 'unknown',
      expoPushToken: null,
      error: friendlyError,
    };
  }
};
