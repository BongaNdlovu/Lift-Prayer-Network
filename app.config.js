/** @type {import('@expo/config').ExpoConfig} */
module.exports = ({ config }) => {
  const googleServicesPath =
    process.env.GOOGLE_SERVICES_JSON || './google-services.json';

  return {
    ...config,
    name: 'Lift',
    slug: 'lift',
    owner: 'bonga_10',
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
    ios: {
      supportsTablet: true,
      icon: './Lift.png',
    },
    android: {
      package: 'Lift.Prayer.App',
      googleServicesFile: googleServicesPath,
      adaptiveIcon: {
        foregroundImage: './Lift.png',
        backgroundColor: '#fef3c7',
      },
      edgeToEdgeEnabled: false,
      predictiveBackGestureEnabled: false,
      intentFilters: [
        {
          action: 'VIEW',
          data: [{ scheme: 'lift' }],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
    },
    web: {
      favicon: './assets/favicon.png',
    },
    extra: {
      eas: {
        projectId: '122737a1-4d4a-4986-9807-12dbdb314dca',
      },
    },
  };
};
