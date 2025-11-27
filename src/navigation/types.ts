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
};

export type MainTabParamList = {
  Feed: undefined;
  History: undefined;
  People: undefined;
  Profile: undefined;
};
