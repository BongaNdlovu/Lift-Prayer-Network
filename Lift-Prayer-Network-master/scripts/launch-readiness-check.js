const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');

const checks = [];

const addCheck = (name, ok, message, level = 'error') => {
  checks.push({ name, ok, message, level });
};

const readJson = (relativePath) => {
  const fullPath = path.join(root, relativePath);
  return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
};

const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));

const findJava = () => {
  const direct = spawnSync('java', ['-version'], { encoding: 'utf8' });
  if (!direct.error && direct.status === 0) return 'java';

  const candidates = [
    process.env.JAVA_HOME && path.join(process.env.JAVA_HOME, 'bin', 'java.exe'),
    'C:\\Program Files\\Java\\jdk-26.0.1\\bin\\java.exe',
  ].filter(Boolean);

  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
};

const hasValidSyntax = (relativePath) => {
  try {
    // Wrap like CommonJS so top-level return/exports patterns parse consistently.
    // eslint-disable-next-line no-new-func
    new Function('exports', 'require', 'module', '__filename', '__dirname', fs.readFileSync(path.join(root, relativePath), 'utf8'));
    return true;
  } catch {
    return false;
  }
};

const appJson = readJson('app.json').expo;
const googleServices = readJson('google-services.json');
const packageJson = readJson('package.json');
const iosGoogleServicesText = exists('GoogleService-Info.plist')
  ? fs.readFileSync(path.join(root, 'GoogleService-Info.plist'), 'utf8')
  : '';
const envPath = path.join(root, '.env');
const envText = exists('.env') ? fs.readFileSync(envPath, 'utf8') : '';
const envValues = Object.fromEntries(
  envText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const index = line.indexOf('=');
      return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
    })
);

const androidPackage = appJson.android && appJson.android.package;
const iosBundleId = appJson.ios && appJson.ios.bundleIdentifier;
const googlePackages = new Set(
  (googleServices.client || [])
    .map((client) => client.client_info && client.client_info.android_client_info)
    .filter(Boolean)
    .map((info) => info.package_name)
);

addCheck(
  'Android package matches google-services.json',
  googlePackages.has(androidPackage),
  `app.json uses "${androidPackage}", google-services.json has ${Array.from(googlePackages).join(', ') || 'none'}`
);

addCheck(
  'Android package uses lowercase reverse-domain convention',
  /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(androidPackage || ''),
  `Current Android package is "${androidPackage}". Prefer something like "com.lift.prayer" before Play Store release.`,
  'warn'
);

addCheck(
  'iOS bundle identifier present',
  /^[A-Za-z][A-Za-z0-9-]*(\.[A-Za-z][A-Za-z0-9-]*)+$/.test(iosBundleId || ''),
  `Current iOS bundle identifier is "${iosBundleId || 'missing'}".`
);

addCheck(
  'iOS bundle identifier matches GoogleService-Info.plist',
  iosGoogleServicesText.includes(`<string>${iosBundleId}</string>`),
  exists('GoogleService-Info.plist')
    ? `GoogleService-Info.plist should contain bundle ID "${iosBundleId}".`
    : 'GoogleService-Info.plist is missing.'
);

addCheck(
  'EAS project id present',
  Boolean(appJson.extra && appJson.extra.eas && appJson.extra.eas.projectId),
  appJson.extra && appJson.extra.eas && appJson.extra.eas.projectId
    ? `Found ${appJson.extra.eas.projectId}.`
    : 'Missing expo.extra.eas.projectId.'
);

addCheck(
  'Sentry env example present',
  fs.readFileSync(path.join(root, '.env.example'), 'utf8').includes('EXPO_PUBLIC_SENTRY_DSN'),
  '.env.example documents EXPO_PUBLIC_SENTRY_DSN.'
);

const requiredFirebaseEnv = [
  'EXPO_PUBLIC_FIREBASE_API_KEY',
  'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
  'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'EXPO_PUBLIC_FIREBASE_APP_ID',
];

const missingFirebaseEnv = requiredFirebaseEnv.filter((key) => !envValues[key]);
addCheck(
  'Firebase environment values present locally',
  exists('.env') && missingFirebaseEnv.length === 0,
  missingFirebaseEnv.length === 0
    ? 'All EXPO_PUBLIC_FIREBASE_* values are present in .env.'
    : `Missing ${missingFirebaseEnv.join(', ')} in .env.`
);

addCheck(
  'Sentry DSN configured locally',
  Boolean(envValues.EXPO_PUBLIC_SENTRY_DSN),
  'EXPO_PUBLIC_SENTRY_DSN is missing or empty in .env.',
  'warn'
);

addCheck(
  'No root service account key present',
  !exists('service-account.json') && !fs.readdirSync(root).some((name) => /^service-account.*\.json$/i.test(name)),
  'No service-account*.json file found in the repo root.'
);

addCheck(
  'No root credentials.json present',
  !exists('credentials.json'),
  'No credentials.json file found in the repo root.'
);

addCheck(
  'Cloud Functions syntax check (optional on Spark)',
  !exists('cloud-functions/index.js') || hasValidSyntax('cloud-functions/index.js'),
  'cloud-functions/index.js parses successfully. Firebase Functions are not required for Spark deploys.',
  'warn'
);

const javaPath = findJava();
addCheck(
  'Java available for Firebase emulator',
  Boolean(javaPath),
  javaPath
    ? `Found Java at ${javaPath}.`
    : 'Install Java or add its bin directory to PATH before running npm run test:rules.'
);

addCheck(
  'Rules test script present',
  Boolean(packageJson.scripts && packageJson.scripts['test:rules']),
  packageJson.scripts && packageJson.scripts['test:rules']
    ? 'npm run test:rules is configured.'
    : 'Missing npm run test:rules.'
);

const errors = checks.filter((check) => !check.ok && check.level === 'error');

for (const check of checks) {
  const symbol = check.ok ? 'PASS' : check.level === 'warn' ? 'WARN' : 'FAIL';
  console.log(`[${symbol}] ${check.name}: ${check.message}`);
}

if (errors.length > 0) {
  process.exitCode = 1;
}
