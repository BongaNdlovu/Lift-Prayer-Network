import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { SignInScreen } from '../screens/auth/SignInScreen';
import { SignUpScreen } from '../screens/auth/SignUpScreen';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';
import { FeedScreen } from '../screens/home/FeedScreen';
import { HistoryScreen } from '../screens/home/HistoryScreen';
import { PeopleScreen } from '../screens/home/PeopleScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { RequestDetailScreen } from '../screens/home/RequestDetailScreen';
import { useAuth } from '../hooks/useAuth';
import { MainTabParamList, RootStackParamList } from './types';
import { palette } from '../theme/colors';

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
          History: 'time-outline',
          People: 'people-outline',
          Profile: 'person-circle-outline',
        };
        return <Ionicons name={icons[route.name]} size={size} color={color} />;
      },
    })}
  >
    <Tab.Screen name="Feed" component={FeedScreen} />
    <Tab.Screen name="History" component={HistoryScreen} />
    <Tab.Screen name="People" component={PeopleScreen} />
    <Tab.Screen name="Profile" component={ProfileScreen} />
  </Tab.Navigator>
);

export const AppNavigator: React.FC = () => {
  const { user, initializing } = useAuth();

  if (initializing) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={palette.accent} />
      </View>
    );
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
          </>
        ) : (
          <>
            <Stack.Screen name="SignIn" component={SignInScreen} />
            <Stack.Screen name="SignUp" component={SignUpScreen} />
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
