# 🚨 SECURITY ACTION REQUIRED

## Compromised Secrets - Immediate Rotation Needed

The following secrets were previously committed to the repository and **must be rotated immediately**:

### 1. Firebase Service Account Key
- **File**: `service-account.json`
- **Action Required**:
  1. Go to [Firebase Console](https://console.firebase.google.com/) → Project Settings → Service Accounts
  2. Click "Generate new private key"
  3. Download the new key and replace `service-account.json` locally
  4. Delete the old key from Firebase Console
  5. Redeploy Cloud Functions with the new key

### 2. Android Keystore Credentials
- **File**: `credentials.json`
- **Action Required**:
  1. Generate a new Android keystore: `keytool -genkey -v -keystore new-keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias your-alias`
  2. Update `credentials.json` with new passwords
  3. Update EAS Build configuration
  4. **Note**: If the app is already published, you'll need to use Play App Signing to rotate keys

### 3. OAuth Client Secret
- **File**: `secrets/client_secret_*.json`
- **Status**: ✅ **NOT COMPROMISED** - This file was already gitignored and never committed to the repository. No action required.

## Files Now Gitignored

The following patterns have been added to `.gitignore`:
- `service-account.json`
- `service-account*.json`
- `credentials.json`
- `secrets/` (already was)

## Removing from Git History (Optional but Recommended)

If this repo is public or shared, consider removing secrets from git history:

```bash
# Install BFG Repo-Cleaner
# Then run:
bfg --delete-files service-account.json
bfg --delete-files credentials.json
git reflog expire --expire=now --all && git gc --prune=now --aggressive
git push --force
```

## Verification Checklist

- [x] Rotated Firebase service account key ✅ (Dec 4, 2025)
- [x] Rotated Android keystore ✅ (Dec 4, 2025)
- [x] OAuth client secret ✅ (Was never committed - no action needed)
- [ ] Verified new secrets work locally
- [x] Redeployed Cloud Functions ✅ (Dec 4, 2025)
- [ ] Removed secrets from git history (if needed)

---
*Generated on: December 4, 2025*
