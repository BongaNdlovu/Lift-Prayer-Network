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
};

export type MainTabParamList = {
  Feed: undefined;
  Groups: undefined;
  Calendar: undefined;
  Stats: undefined;
  Profile: undefined;
};
