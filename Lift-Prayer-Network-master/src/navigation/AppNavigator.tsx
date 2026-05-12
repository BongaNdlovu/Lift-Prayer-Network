import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, Text } from 'react-native';
import { NavigationContainer, DefaultTheme, Theme } from '@react-navigation/native';
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
import { NotificationsInboxScreen } from '../screens/NotificationsInboxScreen';
import { SearchScreen } from '../screens/SearchScreen';
import { AnsweredPrayersScreen } from '../screens/AnsweredPrayersScreen';
import { AnnouncementsScreen } from '../screens/AnnouncementsScreen';
import { DevotionsScreen } from '../screens/DevotionsScreen';
import { GuideDetailsScreen } from '../screens/GuideDetailsScreen';
import { LessonReaderScreen } from '../screens/LessonReaderScreen';
import { FollowingScreen } from '../screens/FollowingScreen';
import { useAuth } from '../hooks/useAuth';
import { MainTabParamList, RootStackParamList } from './types';
import { useTheme } from '../contexts/ThemeContext';
import { startOfflineSyncListener } from '../services/offlineSync';
import { validateAndRepairCache } from '../services/offlineCache';
import { LazyScreen } from '../components/LazyScreen';
import { GlassTabBar } from '../components/GlassTabBar';

const HAS_EVER_SIGNED_IN_KEY = '@lift_has_ever_signed_in';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

const MainTabs = () => {
  const { colors } = useTheme();
  
  return (
    <Tab.Navigator
      tabBar={(props) => <GlassTabBar {...props} />}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.accentDark,
        tabBarInactiveTintColor: colors.muted,
        // Hide default tab bar styling since we use custom GlassTabBar
        tabBarStyle: { 
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
          height: 0,
        },
        tabBarIcon: ({ color, size }) => {
          const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
            Home: 'home-outline',
            Prayers: 'heart-outline',
            Calendar: 'calendar-outline',
            Community: 'people-outline',
            Profile: 'person-outline',
          };
          return <Ionicons name={icons[route.name]} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={FeedScreen} />
      <Tab.Screen name="Prayers" component={MyPrayersScreen} />
      <Tab.Screen name="Calendar" component={CalendarScreen} />
      <Tab.Screen name="Community" component={GroupsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

export const AppNavigator: React.FC = () => {
  const { user, initializing, bannedReason } = useAuth();
  const { colors, isDark } = useTheme();
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);
  const [hasEverSignedIn, setHasEverSignedIn] = useState<boolean | null>(null);
  const [isReady, setIsReady] = useState(false);
  
  // Create navigation theme based on current theme
  const navigationTheme: Theme = {
    dark: isDark,
    colors: {
      primary: colors.accent,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      notification: colors.accent,
    },
    fonts: DefaultTheme.fonts,
  };

  // Check onboarding status and sign-in history - do this ONCE at startup
  useEffect(() => {
    let isMounted = true;
    
    const checkInitialState = async () => {
      try {
        // Validate and repair any corrupted cache data first
        await validateAndRepairCache();
        
        const [onboardingComplete, signedInBefore] = await Promise.all([
          checkOnboardingComplete(),
          AsyncStorage.getItem(HAS_EVER_SIGNED_IN_KEY),
        ]);
        
        if (isMounted) {
          setShowOnboarding(!onboardingComplete);
          setHasEverSignedIn(signedInBefore === 'true');
          // Set ready immediately - React batch updates these state changes
          setIsReady(true);
        }
      } catch (err) {
        console.error('[AppNavigator] Error checking initial state:', err);
        if (isMounted) {
          setShowOnboarding(false);
          setHasEverSignedIn(false);
          setIsReady(true);
        }
      }
    };
    checkInitialState();
    
    return () => { isMounted = false; };
  }, []);

  // Track when user signs in for the first time
  useEffect(() => {
    if (user && hasEverSignedIn === false) {
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

  // Show loading while initializing - wait for all states to be ready
  if (initializing || showOnboarding === null || hasEverSignedIn === null || !isReady) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (showOnboarding) {
    return <OnboardingScreen onComplete={() => setShowOnboarding(false)} />;
  }

  // Show banned screen if user was banned
  if (bannedReason) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, padding: 24 }}>
        <Ionicons name="ban-outline" size={64} color="#dc2626" />
        <Text style={{ fontSize: 24, fontWeight: '700', color: colors.text, marginTop: 16, textAlign: 'center' }}>
          Account Suspended
        </Text>
        <Text style={{ fontSize: 16, color: colors.muted, marginTop: 12, textAlign: 'center', lineHeight: 24 }}>
          {bannedReason}
        </Text>
        <Text style={{ fontSize: 14, color: colors.muted, marginTop: 24, textAlign: 'center' }}>
          If you believe this is a mistake, please contact support.
        </Text>
      </View>
    );
  }

  return (
    <NavigationContainer theme={navigationTheme}>
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
              options={{ headerShown: false }}
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
              name="AdminDashboard"
              options={{ headerShown: false }}
            >
              {(props) => (
                <LazyScreen
                  factory={() =>
                    import('../screens/admin/AdminDashboardScreen').then((m) => ({
                      default: m.AdminDashboardScreen,
                    }))
                  }
                  componentProps={props}
                />
              )}
            </Stack.Screen>
            <Stack.Screen
              name="AdminReports"
              options={{ headerShown: true, title: 'Reports' }}
            >
              {(props) => (
                <LazyScreen
                  factory={() =>
                    import('../screens/admin/ReportsScreen').then((m) => ({
                      default: m.ReportsScreen,
                    }))
                  }
                  componentProps={props}
                />
              )}
            </Stack.Screen>
            <Stack.Screen
              name="AdminPinnedRequests"
              options={{ headerShown: true, title: 'Pinned Requests' }}
            >
              {(props) => (
                <LazyScreen
                  factory={() =>
                    import('../screens/admin/PinnedRequestsScreen').then((m) => ({
                      default: m.PinnedRequestsScreen,
                    }))
                  }
                  componentProps={props}
                />
              )}
            </Stack.Screen>
            <Stack.Screen
              name="AdminGlobalStats"
              options={{ headerShown: true, title: 'Global Stats' }}
            >
              {(props) => (
                <LazyScreen
                  factory={() =>
                    import('../screens/admin/GlobalStatsScreen').then((m) => ({
                      default: m.GlobalStatsScreen,
                    }))
                  }
                  componentProps={props}
                />
              )}
            </Stack.Screen>
            <Stack.Screen
              name="AdminBannedUsers"
              options={{ headerShown: false }}
            >
              {(props) => (
                <LazyScreen
                  factory={() =>
                    import('../screens/admin/BannedUsersScreen').then((m) => ({
                      default: m.BannedUsersScreen,
                    }))
                  }
                  componentProps={props}
                />
              )}
            </Stack.Screen>
            <Stack.Screen
              name="NotificationsInbox"
              component={NotificationsInboxScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Search"
              component={SearchScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="AnsweredPrayers"
              component={AnsweredPrayersScreen}
              options={{ headerShown: false }}
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
            <Stack.Screen
              name="Announcements"
              component={AnnouncementsScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Devotions"
              component={DevotionsScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="GuideDetails"
              component={GuideDetailsScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="LessonReader"
              component={LessonReaderScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Following"
              component={FollowingScreen}
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
