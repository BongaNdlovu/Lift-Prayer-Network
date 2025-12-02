import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { enableScreens } from 'react-native-screens';
import { AppNavigator } from './src/navigation/AppNavigator';
import { AuthProvider } from './src/hooks/useAuth';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import { BootScreen } from './src/screens/BootScreen';
import { setupNotificationHandler } from './src/services/notifications';
import { useAppFonts } from './src/hooks/useFonts';
import { initSentry, withErrorBoundary } from './src/services/sentry';
import { ToastProvider } from './src/contexts/ToastContext';

enableScreens();

// Initialize Sentry for crash reporting
initSentry();

function App() {
  const [booting, setBooting] = useState(true);
  const { fontsLoaded } = useAppFonts();

  useEffect(() => {
    // Wait for fonts to load before hiding boot screen
    if (fontsLoaded) {
      const timer = setTimeout(() => setBooting(false), 1600);
      return () => clearTimeout(timer);
    }
  }, [fontsLoaded]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setupNotificationHandler();
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  // Show boot screen while fonts are loading
  if (!fontsLoaded || booting) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <ThemeProvider>
            <StatusBar style="light" />
            <BootScreen />
          </ThemeProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <ThemedApp />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// Separate component to use theme context
function ThemedApp() {
  const { isDark } = useTheme();
  
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AuthProvider>
        <ToastProvider>
          <AppNavigator />
        </ToastProvider>
      </AuthProvider>
    </>
  );
}

// Wrap with Sentry error boundary for crash reporting
export default withErrorBoundary(App);
