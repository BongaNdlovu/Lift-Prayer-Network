import type { NavigatorScreenParams } from '@react-navigation/native';
import type { FeedItem } from '../types';

export type RootStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  RequestDetail: {
    id: string;
    type: 'REQUEST' | 'TESTIMONY';
    item?: FeedItem;
  };
  CreateRequest: {
    groupId?: string;
    groupName?: string;
  } | undefined;
  CreateTestimony: undefined;
  Groups: undefined;
  GroupDetail: {
    groupId: string;
    groupName: string;
    groupEmoji?: string;
  };
  EditRequest: {
    id: string;
    type: 'REQUEST' | 'TESTIMONY';
    item: FeedItem;
  };
  NotificationsSettings: undefined;
  Reminders: undefined;
  Settings: undefined;
  People: undefined;
  History: undefined;
  Achievements: undefined;
  Help: undefined;
  MyPrayers: undefined;
  Donation: undefined;
  PrivacyPolicy: undefined;
  TermsOfService: undefined;
  AdminReports: undefined;
  AdminDashboard: undefined;
  AdminPinnedRequests: undefined;
  AdminGlobalStats: undefined;
  AdminBannedUsers: undefined;
  NotificationsInbox: undefined;
  AnsweredPrayers: undefined;
  Search: undefined;
  Stats: undefined;
  Calendar: undefined;
  Announcements: undefined;
  Devotions: undefined;
  Following: undefined;
  GuideDetails: {
    guideId: string;
  };
  LessonReader: {
    guideId: string;
    lessonId: string;
    lessonTitle?: string;
  };
};

export type MainTabParamList = {
  Home: undefined;
  Prayers: undefined;
  Create: undefined;
  People: undefined;
  Profile: undefined;
};
