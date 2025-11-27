import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db, firebaseEnabled } from './firebase';

type RegisterResult = {
  status: Notifications.PermissionStatus;
  expoPushToken?: string;
  devicePushToken?: string;
};

export const registerForPushNotifications = async (): Promise<RegisterResult> => {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    return { status: finalStatus };
  }

  const expoTokenResponse = await Notifications.getExpoPushTokenAsync();
  let devicePushToken: string | undefined;
  try {
    const deviceTokenResponse = await Notifications.getDevicePushTokenAsync();
    devicePushToken = deviceTokenResponse.data;
  } catch (err) {
    console.warn('Failed to fetch device push token', err);
  }

  return {
    status: finalStatus,
    expoPushToken: expoTokenResponse.data,
    devicePushToken,
  };
};

export const storePushToken = async (
  userUid: string,
  expoPushToken: string,
  devicePushToken?: string,
) => {
  if (!firebaseEnabled || !db) return;
  const id = devicePushToken || expoPushToken;
  const ref = doc(db, 'users', userUid, 'pushTokens', id);
  await setDoc(
    ref,
    {
      token: expoPushToken,
      nativeToken: devicePushToken,
      platform: Platform.OS,
      subscribedCritical: !!devicePushToken,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
};

export const setupNotificationHandler = () => {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
};
