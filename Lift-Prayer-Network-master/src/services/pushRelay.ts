import { auth } from './firebase';

type PushRelayPayload = {
  recipientUid: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  settingKey?: string;
  notificationId?: string;
};

const relayUrl = process.env.EXPO_PUBLIC_NOTIFICATION_RELAY_URL;

export const sendPushViaRelay = async (payload: PushRelayPayload): Promise<boolean> => {
  if (!relayUrl) {
    console.log('[PushRelay] EXPO_PUBLIC_NOTIFICATION_RELAY_URL is not configured, skipping push');
    return false;
  }

  const user = auth?.currentUser;
  if (!user) {
    console.log('[PushRelay] No authenticated user, skipping push');
    return false;
  }

  try {
    const idToken = await user.getIdToken();
    const response = await fetch(`${relayUrl.replace(/\/$/, '')}/send-notification`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${idToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      console.warn('[PushRelay] Push relay request failed:', response.status, text);
      return false;
    }

    return true;
  } catch (error) {
    console.warn('[PushRelay] Could not send push via relay:', error);
    return false;
  }
};
