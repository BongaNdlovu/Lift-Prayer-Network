export type RootStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
  MainTabs: undefined;
  RequestDetail: {
    id: string;
    type: 'REQUEST' | 'TESTIMONY';
    item?: any;
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
    item: any;
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
  Announcements: undefined;
  Devotions: undefined;
  Following: undefined;
};

export type MainTabParamList = {
  Feed: undefined;
  Groups: undefined;
  Calendar: undefined;
  Stats: undefined;
  Donate: undefined;
  Profile: undefined;
};
