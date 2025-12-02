/**
 * Provider component that enables notification polling for devices without GMS
 * This should be placed inside AuthProvider to access the current user
 */
import React, { useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNotificationPolling } from '../hooks/useNotificationPolling';
import { getDeviceInfo } from '../utils/googlePlayServices';

type Props = {
  children: React.ReactNode;
};

export const NotificationPollingProvider: React.FC<Props> = ({ children }) => {
  const { user } = useAuth();
  const { isPolling, needsPolling } = useNotificationPolling(user?.uid);

  // Log device info on mount for debugging
  useEffect(() => {
    if (needsPolling) {
      const deviceInfo = getDeviceInfo();
      console.log('[NotificationPolling] Device info:', deviceInfo);
      console.log('[NotificationPolling] Polling enabled for this device');
    }
  }, [needsPolling]);

  // Log polling status changes
  useEffect(() => {
    if (isPolling) {
      console.log('[NotificationPolling] Polling active for user:', user?.uid?.slice(0, 8));
    }
  }, [isPolling, user?.uid]);

  return <>{children}</>;
};
