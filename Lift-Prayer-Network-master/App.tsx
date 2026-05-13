import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
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
import { NotificationPollingProvider } from './src/components/NotificationPollingProvider';

enableScreens();

// Initialize Sentry for crash reporting
initSentry();

// Separate component for boot status bar to access theme context
function BootStatusBar() {
  const { isDark } = useTheme();
  return <StatusBar style={isDark ? 'light' : 'dark'} />;
}

function App() {
  const { fontsLoaded } = useAppFonts();

  useEffect(() => {
    setupNotificationHandler();
  }, []);

  // Show boot screen while fonts are loading
  if (!fontsLoaded) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <ThemeProvider>
            <BootStatusBar />
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
        <NotificationPollingProvider>
          <ToastProvider>
            <AppNavigator />
          </ToastProvider>
        </NotificationPollingProvider>
      </AuthProvider>
    </>
  );
}

// Wrap with Sentry error boundary for crash reporting
export default withErrorBoundary(App);
