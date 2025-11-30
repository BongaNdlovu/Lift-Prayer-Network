import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { SignInScreen } from '../screens/auth/SignInScreen';
import { SignUpScreen } from '../screens/auth/SignUpScreen';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';
import { FeedScreen } from '../screens/home/FeedScreen';
import { HistoryScreen } from '../screens/home/HistoryScreen';
import { PeopleScreen } from '../screens/home/PeopleScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { StatsScreen } from '../screens/StatsScreen';
import { RequestDetailScreen } from '../screens/home/RequestDetailScreen';
import { CreateRequestScreen } from '../screens/CreateRequestScreen';
import { CreateTestimonyScreen } from '../screens/CreateTestimonyScreen';
import { GroupsScreen } from '../screens/GroupsScreen';
import { GroupDetailScreen } from '../screens/GroupDetailScreen';
import { EditRequestScreen } from '../screens/EditRequestScreen';
import { NotificationsSettingsScreen } from '../screens/NotificationsSettingsScreen';
import { RemindersScreen } from '../screens/RemindersScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { CalendarScreen } from '../screens/CalendarScreen';
import { AchievementsScreen } from '../screens/AchievementsScreen';
import { HelpScreen } from '../screens/HelpScreen';
import { MyPrayersScreen } from '../screens/MyPrayersScreen';
import DonationScreen from '../screens/DonationScreen';
import { OnboardingScreen, checkOnboardingComplete } from '../screens/OnboardingScreen';
import { PrivacyPolicyScreen } from '../screens/PrivacyPolicyScreen';
import { TermsOfServiceScreen } from '../screens/TermsOfServiceScreen';
import { useAuth } from '../hooks/useAuth';
import { MainTabParamList, RootStackParamList } from './types';
import { palette } from '../theme/colors';
import { startOfflineSyncListener } from '../services/offlineSync';
import { validateAndRepairCache } from '../services/offlineCache';

const HAS_EVER_SIGNED_IN_KEY = '@lift_has_ever_signed_in';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

const MainTabs = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      headerShown: false,
      tabBarActiveTintColor: palette.accentDark,
      tabBarInactiveTintColor: palette.muted,
      tabBarStyle: { paddingVertical: 6, height: 64 },
      tabBarIcon: ({ color, size }) => {
        const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
          Feed: 'radio-outline',
          Groups: 'people-circle-outline',
          Calendar: 'calendar-outline',
          Stats: 'stats-chart-outline',
          Profile: 'person-circle-outline',
        };
        return <Ionicons name={icons[route.name]} size={size} color={color} />;
      },
    })}
  >
    <Tab.Screen name="Feed" component={FeedScreen} />
    <Tab.Screen name="Groups" component={GroupsScreen} />
    <Tab.Screen name="Calendar" component={CalendarScreen} />
    <Tab.Screen name="Stats" component={StatsScreen} />
    <Tab.Screen name="Profile" component={ProfileScreen} />
  </Tab.Navigator>
);

export const AppNavigator: React.FC = () => {
  const { user, initializing } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);
  const [hasEverSignedIn, setHasEverSignedIn] = useState<boolean | null>(null);

  // Check onboarding status and sign-in history
  useEffect(() => {
    const checkInitialState = async () => {
      try {
        // Validate and repair any corrupted cache data first
        await validateAndRepairCache();
        
        const [onboardingComplete, signedInBefore] = await Promise.all([
          checkOnboardingComplete(),
          AsyncStorage.getItem(HAS_EVER_SIGNED_IN_KEY),
        ]);
        setShowOnboarding(!onboardingComplete);
        setHasEverSignedIn(signedInBefore === 'true');
      } catch (err) {
        console.error('[AppNavigator] Error checking initial state:', err);
        setShowOnboarding(false);
        setHasEverSignedIn(false);
      }
    };
    checkInitialState();
  }, []);

  // Track when user signs in for the first time
  useEffect(() => {
    if (user && !hasEverSignedIn) {
      AsyncStorage.setItem(HAS_EVER_SIGNED_IN_KEY, 'true');
      setHasEverSignedIn(true);
    }
  }, [user, hasEverSignedIn]);

  useEffect(() => {
    const stopSync = startOfflineSyncListener(user);
    return () => {
      stopSync?.();
    };
  }, [user]);

  // Show loading while initializing
  if (initializing || showOnboarding === null || hasEverSignedIn === null) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.background }}>
        <ActivityIndicator size="large" color={palette.accent} />
      </View>
    );
  }

  if (showOnboarding) {
    return <OnboardingScreen onComplete={() => setShowOnboarding(false)} />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <Stack.Screen name="MainTabs" component={MainTabs} />
            <Stack.Screen
              name="RequestDetail"
              component={RequestDetailScreen}
              options={{ headerShown: true, title: 'Detail' }}
            />
            <Stack.Screen
              name="CreateRequest"
              component={CreateRequestScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="CreateTestimony"
              component={CreateTestimonyScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Groups"
              component={GroupsScreen}
              options={{ headerShown: true, title: 'Prayer Groups' }}
            />
            <Stack.Screen
              name="GroupDetail"
              component={GroupDetailScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="EditRequest"
              component={EditRequestScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="NotificationsSettings"
              component={NotificationsSettingsScreen}
              options={{ headerShown: true, title: 'Notification Settings' }}
            />
            <Stack.Screen
              name="Reminders"
              component={RemindersScreen}
              options={{ headerShown: true, title: 'Prayer Reminders' }}
            />
            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
              options={{ headerShown: true, title: 'Settings' }}
            />
            <Stack.Screen
              name="People"
              component={PeopleScreen}
              options={{ headerShown: true, title: 'People I Prayed For' }}
            />
            <Stack.Screen
              name="History"
              component={HistoryScreen}
              options={{ headerShown: true, title: 'Prayer History' }}
            />
            <Stack.Screen
              name="Achievements"
              component={AchievementsScreen}
              options={{ headerShown: true, title: 'Achievements' }}
            />
            <Stack.Screen
              name="Help"
              component={HelpScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="MyPrayers"
              component={MyPrayersScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Donation"
              component={DonationScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="PrivacyPolicy"
              component={PrivacyPolicyScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="TermsOfService"
              component={TermsOfServiceScreen}
              options={{ headerShown: false }}
            />
          </>
        ) : (
          <>
            {/* Show SignUp first for new users, SignIn for returning users */}
            {hasEverSignedIn ? (
              <>
                <Stack.Screen name="SignIn" component={SignInScreen} />
                <Stack.Screen name="SignUp" component={SignUpScreen} />
              </>
            ) : (
              <>
                <Stack.Screen name="SignUp" component={SignUpScreen} />
                <Stack.Screen name="SignIn" component={SignInScreen} />
              </>
            )}
            <Stack.Screen
              name="ForgotPassword"
              component={ForgotPasswordScreen}
              options={{ headerShown: true, title: 'Reset Password' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};
