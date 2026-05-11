# Secrets & Configuration

This document describes all secrets and sensitive configuration required to run the Lift Prayer Network app.

---

## Quick Start

1. Copy `.env.example` to `.env`
2. Fill in your Firebase and Sentry credentials
3. Download `google-services.json` from Firebase Console (for Android builds)
4. Download `GoogleService-Info.plist` from Firebase Console (for iOS builds)

---

## Environment Variables

### Required: Firebase Configuration

Get these from [Firebase Console](https://console.firebase.google.com) → Project Settings → Your Apps → Config

| Variable | Description |
|----------|-------------|
| `EXPO_PUBLIC_FIREBASE_API_KEY` | Firebase Web API Key |
| `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase Auth Domain (e.g., `your-project.firebaseapp.com`) |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID` | Firebase Project ID |
| `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase Storage Bucket (e.g., `your-project.appspot.com`) |
| `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase Cloud Messaging Sender ID |
| `EXPO_PUBLIC_FIREBASE_APP_ID` | Firebase App ID |

### Optional: Sentry Error Tracking

| Variable | Description |
|----------|-------------|
| `EXPO_PUBLIC_SENTRY_DSN` | Sentry DSN for crash reporting. Get from Sentry → Project Settings → Client Keys |

---

## Platform-Specific Files

These files are **required for native builds** but must **never be committed to git**.

### Android: `google-services.json`

1. Go to Firebase Console → Project Settings → Your Apps
2. Select your Android app (or add one)
3. Download `google-services.json`
4. Place in project root (for EAS Build) or `android/app/` (for local builds)

### iOS: `GoogleService-Info.plist`

1. Go to Firebase Console → Project Settings → Your Apps
2. Select your iOS app (or add one)
3. Download `GoogleService-Info.plist`
4. Place in project root (for EAS Build) or `ios/YourApp/` (for local builds)

### OAuth Client Secret (if using Google Sign-In)

1. Go to [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials
2. Download OAuth 2.0 Client ID JSON
3. Store securely - **do not commit to git**
4. For EAS Build, upload via `eas secret:create`

---

## EAS Build Secrets

For production builds with EAS, set secrets via CLI:

```bash
# Set environment variables
eas secret:create --name EXPO_PUBLIC_FIREBASE_API_KEY --value "your-api-key"
eas secret:create --name EXPO_PUBLIC_SENTRY_DSN --value "your-sentry-dsn"

# Upload service files
eas secret:create --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json
```

---

## GitHub Actions Secrets

If using CI/CD, add these secrets in GitHub → Settings → Secrets:

| Secret Name | Description |
|-------------|-------------|
| `EXPO_TOKEN` | Expo access token for EAS builds |
| `FIREBASE_TOKEN` | Firebase CI token (from `firebase login:ci`) |
| All `EXPO_PUBLIC_*` vars | Environment variables for builds |

---

## Security Best Practices

1. **Never commit secrets** - All `.env` files and service JSONs are in `.gitignore`
2. **Rotate compromised keys** - If a key was ever committed, rotate it immediately
3. **Use environment-specific keys** - Different Firebase projects for dev/staging/prod
4. **Limit API key restrictions** - In Google Cloud Console, restrict keys by app/domain
5. **Review git history** - Use `git log -p -- "*.json"` to check for leaked secrets

---

## Troubleshooting

### "Firebase not configured" error
- Ensure `.env` file exists with all `EXPO_PUBLIC_FIREBASE_*` variables
- Restart Metro bundler after changing `.env`: `npx expo start -c`

### "Sentry not initialized" warning
- This is normal if `EXPO_PUBLIC_SENTRY_DSN` is not set
- Sentry is optional for development

### EAS Build fails with missing secrets
- Verify secrets are set: `eas secret:list`
- Check build logs for specific missing variables
