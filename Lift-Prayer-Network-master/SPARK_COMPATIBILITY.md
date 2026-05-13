# Spark Compatibility

This project is configured to run on the Firebase Spark plan.

## What Deploys On Spark

- Firestore rules and indexes
- Storage rules
- Client-side Firebase Auth, Firestore, and Storage usage
- Local/manual admin scripts when Firebase Admin credentials are provided

## What Is Optional

Firebase Cloud Functions are kept in `cloud-functions/` for a future Blaze upgrade, but they are no longer part of `firebase.json` and are not required for normal Spark deploys.

Use this only as an optional syntax check:

```bash
npm run check:functions:optional
```

## Notifications

On Spark, Firestore records are still created for app activity, but automatic server-side push broadcasts do not run through Firebase Functions.

For push notifications without Blaze, use the Cloudflare Worker relay in `worker/` and set:

```bash
EXPO_PUBLIC_NOTIFICATION_RELAY_URL=https://your-worker.workers.dev
```

If no relay URL is configured, the app skips push delivery gracefully.

## Admin Cleanup

Use the manual reset scripts when you need to clear data:

```bash
npm run reset:data:dry
npm run reset:data
```

These scripts require Firebase Admin credentials such as `GOOGLE_APPLICATION_CREDENTIALS`.
