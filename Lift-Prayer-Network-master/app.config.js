/** @type {import('@expo/config').ExpoConfig} */
module.exports = ({ config }) => {
  const googleServicesPath =
    process.env.GOOGLE_SERVICES_JSON || './google-services.json';

  return {
    ...config,
    name: 'Lift',
    slug: 'lift-prayer-network',
    owner: 'shakhi',
    scheme: 'lift',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './Lift.png',
    userInterfaceStyle: 'light',
    newArchEnabled: false,
    splash: {
      image: './Lift.png',
      resizeMode: 'contain',
      backgroundColor: '#fef3c7',
    },
    // Push notification configuration
    notification: {
      icon: './Lift.png',
      color: '#f59e0b',
      androidMode: 'default',
      androidCollapsedTitle: 'Lift Prayer',
    },
    ios: {
      supportsTablet: true,
      icon: './Lift.png',
      bundleIdentifier: 'com.lift.prayer',
      googleServicesFile: './GoogleService-Info.plist',
      infoPlist: {
        UIBackgroundModes: ['remote-notification'],
      },
    },
    android: {
      package: 'com.lift.prayer',
      googleServicesFile: googleServicesPath,
      adaptiveIcon: {
        foregroundImage: './Lift.png',
        backgroundColor: '#fef3c7',
      },
      edgeToEdgeEnabled: false,
      predictiveBackGestureEnabled: false,
      permissions: [
        'android.permission.RECEIVE_BOOT_COMPLETED',
        'android.permission.VIBRATE',
      ],
      intentFilters: [
        {
          action: 'VIEW',
          data: [{ scheme: 'lift' }],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
    },
    plugins: [
      [
        'expo-notifications',
        {
          icon: './Lift.png',
          color: '#f59e0b',
          sounds: [],
          defaultChannel: 'default',
        },
      ],
    ],
    web: {
      favicon: './assets/favicon.png',
    },
    extra: {
      eas: {
        projectId: '611c7af2-23bb-453b-9036-4aff6edb88bb',
      },
    },
  };
};
