import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { enableScreens } from 'react-native-screens';
import { AppNavigator } from './src/navigation/AppNavigator';
import { AuthProvider } from './src/hooks/useAuth';
import { BootScreen } from './src/screens/BootScreen';
import { setupNotificationHandler } from './src/services/notifications';

enableScreens();

export default function App() {
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setBooting(false), 1600);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    setupNotificationHandler();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style={booting ? 'light' : 'dark'} />
        {booting ? (
          <BootScreen />
        ) : (
          <AuthProvider>
            <AppNavigator />
          </AuthProvider>
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
