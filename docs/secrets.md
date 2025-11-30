# Secrets & Configuration

- Firebase client config must come from environment variables: set `EXPO_PUBLIC_FIREBASE_API_KEY`, `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`, `EXPO_PUBLIC_FIREBASE_PROJECT_ID`, `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`, `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, and `EXPO_PUBLIC_FIREBASE_APP_ID` in Expo/EAS.
- Keep platform service files (`google-services.json`, `GoogleService-Info.plist`, OAuth client secrets) out of git; provide them via your CI/CD secrets store or local tooling only.
- Rotate any keys that were previously committed and rewrite history with `git filter-repo`/BFG before shipping.
- Document required local files in onboarding notes so teammates can request them securely instead of committing them.
