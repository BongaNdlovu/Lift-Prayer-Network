# PART 2: RESILIENCE

## 2.1 Current State Analysis

### Existing implementations (already in codebase):
- `checkPushReceipts` - Runs every 15 minutes (cloud-functions/index.js:316-400)
- `cleanupDeadTokens` - Runs daily at 3 AM (cloud-functions/index.js:406-450)
- Offline cache with 24-hour TTL (src/services/offlineCache.ts:20)

## 2.2 New Scheduled Cleanup for Stale Offline Queues

**File:** `cloud-functions/index.js`

Add new scheduled function after `cleanupDeadTokens`:

```javascript
/**
 * Clean up stale offline queues from users who haven't synced
 * Runs daily at 4 AM
 */
exports.cleanupStaleOfflineQueues = onSchedule('0 4 * * *', async (event) => {
  console.log('Starting stale offline queue cleanup...');
  
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    let cleanedCount = 0;
    
    // Clean up old pending prayers that were never synced
    const stalePrayersSnapshot = await db.collection('pendingPrayers')
      .where('createdAt', '<', thirtyDaysAgo)
      .limit(500)
      .get();
    
    if (!stalePrayersSnapshot.empty) {
      const batch = db.batch();
      stalePrayersSnapshot.forEach(doc => {
        batch.delete(doc.ref);
        cleanedCount++;
      });
      await batch.commit();
    }
    
    // Clean up old pending requests
    const staleRequestsSnapshot = await db.collection('pendingRequests')
      .where('createdAt', '<', thirtyDaysAgo)
      .limit(500)
      .get();
    
    if (!staleRequestsSnapshot.empty) {
      const batch = db.batch();
      staleRequestsSnapshot.forEach(doc => {
        batch.delete(doc.ref);
        cleanedCount++;
      });
      await batch.commit();
    }
    
    console.log(`Cleaned up ${cleanedCount} stale offline queue items`);
  } catch (error) {
    console.error('Error cleaning stale offline queues:', error);
  }
});
```

## 2.3 Retry Failed Pushes Task

**File:** `cloud-functions/index.js`

Add after the cleanup function:

```javascript
/**
 * Retry failed push notifications
 * Runs every 30 minutes
 */
exports.retryFailedPushes = onSchedule('every 30 minutes', async (event) => {
  console.log('Starting failed push retry...');
  
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
    
    // Get failed tickets from the last 6 hours that haven't been retried recently
    const failedTicketsSnapshot = await db.collection('pushTickets')
      .where('receiptStatus', '==', 'error')
      .where('receiptError', 'in', ['MessageTooBig', 'MessageRateExceeded', 'InvalidCredentials'])
      .where('createdAt', '>', sixHoursAgo)
      .where('lastRetryAt', '<', oneHourAgo)
      .limit(50)
      .get();
    
    if (failedTicketsSnapshot.empty) {
      console.log('No failed pushes to retry');
      return;
    }
    
    let retryCount = 0;
    let successCount = 0;
    
    for (const ticketDoc of failedTicketsSnapshot.docs) {
      const ticketData = ticketDoc.data();
      
      // Skip if already retried 3 times
      if ((ticketData.retryCount || 0) >= 3) {
        continue;
      }
      
      retryCount++;
      
      try {
        // Resend the notification
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: ticketData.token,
            title: ticketData.title,
            body: ticketData.body,
            data: ticketData.data || {},
          }),
        });
        
        const result = await response.json();
        
        if (result.data?.status === 'ok') {
          successCount++;
          // Update ticket with new ticket ID
          await ticketDoc.ref.update({
            retryCount: admin.firestore.FieldValue.increment(1),
            lastRetryAt: admin.firestore.FieldValue.serverTimestamp(),
            retryTicketId: result.data.id,
            retryStatus: 'sent',
          });
        } else {
          await ticketDoc.ref.update({
            retryCount: admin.firestore.FieldValue.increment(1),
            lastRetryAt: admin.firestore.FieldValue.serverTimestamp(),
            retryStatus: 'failed',
            retryError: result.data?.message || 'Unknown error',
          });
        }
      } catch (err) {
        console.error('Error retrying push:', err);
        await ticketDoc.ref.update({
          retryCount: admin.firestore.FieldValue.increment(1),
          lastRetryAt: admin.firestore.FieldValue.serverTimestamp(),
          retryStatus: 'error',
        });
      }
    }
    
    console.log(`Retried ${retryCount} failed pushes, ${successCount} successful`);
  } catch (error) {
    console.error('Error in retry failed pushes:', error);
  }
});
```

## 2.4 Update pushTickets Schema

When saving tickets in `sendExpoPushNotification` (around line 230), store additional data for retry:

```javascript
// Store ticket for receipt checking AND retry capability
await db.collection('pushTickets').doc(ticketId).set({
  token: token,
  title: title,        // ADD: Store for retry
  body: body,          // ADD: Store for retry
  data: data || {},    // ADD: Store for retry
  createdAt: admin.firestore.FieldValue.serverTimestamp(),
  checked: false,
  retryCount: 0,       // ADD: Track retries
  lastRetryAt: null,   // ADD: Track last retry time
});
```

# PART 3: ENGAGEMENT

## 3.1 Prayer Streak Widget

### 3.1.1 Update UserProfile Type

**File:** `src/types.ts`

Add to `stats` object (around line 160):

```typescript
stats?: {
  prayerCount: number;
  testimonyCount?: number;
  requestCount?: number;
  streakDays?: number;
  streakLastDate?: string;
  longestStreak?: number;
  prayersThisWeek?: number;
  prayersThisMonth?: number;
  currentStreakStart?: string;  // ADD: When current streak started
  streakFreezeUsed?: boolean;   // ADD: If user used streak freeze today
};
```

### 3.1.2 Create PrayerStreakWidget Component

**File:** `src/components/PrayerStreakWidget.tsx` (NEW FILE)

```typescript
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { radius, spacing } from '../theme/colors';

type Props = {
  currentStreak: number;
  longestStreak: number;
  lastPrayedDate?: string;
  onPress?: () => void;
};

export const PrayerStreakWidget: React.FC<Props> = ({
  currentStreak,
  longestStreak,
  lastPrayedDate,
  onPress,
}) => {
  const { colors, isDark } = useTheme();
  const flameAnim = useRef(new Animated.Value(1)).current;
  
  // Check if streak is active (prayed today or yesterday)
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const isStreakActive = lastPrayedDate === today || lastPrayedDate === yesterday;
  const prayedToday = lastPrayedDate === today;
  
  // Animate flame when streak is active
  useEffect(() => {
    if (isStreakActive && currentStreak > 0) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(flameAnim, {
            toValue: 1.1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(flameAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [isStreakActive, currentStreak]);
  
  const getStreakColor = () => {
    if (!isStreakActive) return colors.muted;
    if (currentStreak >= 30) return '#ef4444'; // Red hot
    if (currentStreak >= 14) return '#f97316'; // Orange
    if (currentStreak >= 7) return '#eab308';  // Yellow
    return '#fbbf24'; // Light yellow
  };
  
  const getStreakEmoji = () => {
    if (!isStreakActive) return '❄️';
    if (currentStreak >= 30) return '🔥';
    if (currentStreak >= 14) return '🔥';
    if (currentStreak >= 7) return '✨';
    return '🙏';
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        { 
          backgroundColor: isDark ? colors.surface : '#fff',
          borderColor: colors.border,
        }
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Animated.View style={[styles.iconContainer, { transform: [{ scale: flameAnim }] }]}>
        <Text style={styles.emoji}>{getStreakEmoji()}</Text>
      </Animated.View>
      
      <View style={styles.content}>
        <View style={styles.streakRow}>
          <Text style={[styles.streakNumber, { color: getStreakColor() }]}>
            {currentStreak}
          </Text>
          <Text style={[styles.streakLabel, { color: colors.text }]}>
            day{currentStreak !== 1 ? 's' : ''}
          </Text>
        </View>
        
        <Text style={[styles.subtitle, { color: colors.muted }]}>
          {prayedToday 
            ? '✓ Prayed today' 
            : isStreakActive 
              ? 'Pray today to continue!' 
              : 'Start a new streak'}
        </Text>
        
        {longestStreak > currentStreak && (
          <Text style={[styles.record, { color: colors.muted }]}>
            Record: {longestStreak} days
          </Text>
        )}
      </View>
      
      <Ionicons name="chevron-forward" size={20} color={colors.muted} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  iconContainer: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  emoji: {
    fontSize: 32,
  },
  content: {
    flex: 1,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  streakNumber: {
    fontSize: 28,
    fontWeight: '900',
  },
  streakLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  record: {
    fontSize: 11,
    marginTop: 4,
  },
});
```

### 3.1.3 Add Widget to ProfileScreen

**File:** `src/screens/ProfileScreen.tsx`

Import the widget:
```typescript
import { PrayerStreakWidget } from '../components/PrayerStreakWidget';
```

Add state for streak data (after line 55):
```typescript
const [streakData, setStreakData] = useState({
  currentStreak: 0,
  longestStreak: 0,
  lastPrayedDate: undefined as string | undefined,
});
```

Load streak data in useEffect:
```typescript
useEffect(() => {
  if (!user?.uid || !db) return;
  
  const loadStreakData = async () => {
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (userDoc.exists()) {
      const data = userDoc.data();
      setStreakData({
        currentStreak: data.stats?.streakDays || 0,
        longestStreak: data.stats?.longestStreak || 0,
        lastPrayedDate: data.stats?.streakLastDate,
      });
    }
  };
  
  loadStreakData();
}, [user?.uid]);
```

Add widget in render (after profile header, before menu items):
```tsx
<PrayerStreakWidget
  currentStreak={streakData.currentStreak}
  longestStreak={streakData.longestStreak}
  lastPrayedDate={streakData.lastPrayedDate}
  onPress={() => navigation.navigate('Stats')}
/>
```

### 3.1.4 Add Widget to StatsScreen

**File:** `src/screens/StatsScreen.tsx`

Add the same widget at the top of the stats display.

## 3.2 Weekly Recap Email/Push (Opt-in)

### 3.2.1 Add User Settings for Weekly Recap

**File:** `src/types.ts`

Add to `settings` object (around line 170):

```typescript
settings?: {
  // ... existing settings
  weeklyRecapEnabled?: boolean;  // ADD
  weeklyRecapDay?: number;       // ADD: 0-6 (Sunday-Saturday)
  weeklyRecapTime?: string;      // ADD: HH:mm format
};
```

### 3.2.2 Add Toggle in NotificationsSettingsScreen

**File:** `src/screens/NotificationsSettingsScreen.tsx`

Add new section after existing notification toggles:
```tsx
{/* Weekly Recap Section */}
<View style={[styles.section, dynamicStyles.section]}>
  <Text style={[styles.sectionTitle, dynamicStyles.sectionTitle]}>Weekly Recap</Text>
  
  <View style={styles.settingRow}>
    <View style={styles.settingInfo}>
      <Ionicons name="calendar-outline" size={22} color={colors.text} />
      <View style={styles.settingText}>
        <Text style={[styles.settingLabel, dynamicStyles.settingLabel]}>Weekly Summary</Text>
        <Text style={[styles.settingDesc, dynamicStyles.settingDesc]}>
          Receive a weekly summary of your prayer activity
        </Text>
      </View>
    </View>
    <Switch
      value={weeklyRecapEnabled}
      onValueChange={handleWeeklyRecapToggle}
      trackColor={{ false: '#e5e7eb', true: '#fde68a' }}
      thumbColor={weeklyRecapEnabled ? '#f59e0b' : '#9ca3af'}
    />
  </View>
</View>
```

### 3.2.3 Cloud Function for Weekly Recap

**File:** `cloud-functions/index.js`

Add new scheduled function:
```javascript
/**
 * Send weekly recap notifications
 * Runs every Sunday at 9 AM
 */
exports.sendWeeklyRecap = onSchedule('0 9 * * 0', async (event) => {
  console.log('Starting weekly recap notifications...');
  
  try {
    // Get users with weekly recap enabled
    const usersSnapshot = await db.collection('users')
      .where('settings.weeklyRecapEnabled', '==', true)
      .limit(500)
      .get();
    
    if (usersSnapshot.empty) {
      console.log('No users with weekly recap enabled');
      return;
    }
    
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    let sentCount = 0;
    
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      const userData = userDoc.data();
      
      try {
        // Get user's weekly stats
        const prayersQuery = query(
          collection(db, 'prayers'),
          where('actorUid', '==', userId),
          where('prayedAt', '>=', Timestamp.fromDate(oneWeekAgo))
        );
        const prayersSnapshot = await getDocs(prayersQuery);
        const prayerCount = prayersSnapshot.size;
        
        const requestsQuery = query(
          collection(db, 'requests'),
          where('ownerUid', '==', userId),
          where('createdAt', '>=', Timestamp.fromDate(oneWeekAgo))
        );
        const requestsSnapshot = await getDocs(requestsQuery);
        const requestCount = requestsSnapshot.size;
        
        // Get unique people prayed for
        const uniquePeople = new Set();
        prayersSnapshot.forEach(doc => {
          const data = doc.data();
          if (data.targetOwnerUid) {
            uniquePeople.add(data.targetOwnerUid);
          }
        });
        
        // Build recap message
        const streakDays = userData.stats?.streakDays || 0;
        let message = `This week: ${prayerCount} prayers`;
        if (uniquePeople.size > 0) {
          message += ` for ${uniquePeople.size} people`;
        }
        if (streakDays > 0) {
          message += `. ${streakDays}-day streak! 🔥`;
        }
        
        // Send notification
        const tokens = await getUserPushTokens(userId);
        for (const token of tokens) {
          await sendExpoPushNotification(
            token,
            '📊 Your Weekly Prayer Recap',
            message,
            { type: 'weekly_recap', userId }
          );
        }
        
        sentCount++;
      } catch (err) {
        console.error(`Error sending recap to user ${userId}:`, err);
      }
    }
    
    console.log(`Sent weekly recap to ${sentCount} users`);
  } catch (error) {
    console.error('Error in weekly recap:', error);
  }
});
```

# PART 4: PERFORMANCE

## 4.1 List Virtualization

### 4.1.1 Screens Needing Virtualization Props

The following screens use `FlatList` but lack optimization props:

| Screen | File | Current State |
|--------|------|---------------|
| FeedScreen | src/screens/home/FeedScreen.tsx | ✅ Has virtualization (lines 463-467) |
| GroupsScreen | src/screens/GroupsScreen.tsx | ❌ Missing |
| GroupDetailScreen | src/screens/GroupDetailScreen.tsx | ❌ Missing |
| SearchScreen | src/screens/SearchScreen.tsx | ❌ Missing |
| MyPrayersScreen | src/screens/MyPrayersScreen.tsx | ❌ Missing |
| AnsweredPrayersScreen | src/screens/AnsweredPrayersScreen.tsx | ❌ Missing |
| NotificationsInboxScreen | src/screens/NotificationsInboxScreen.tsx | Uses ScrollView (convert to FlatList) |

### 4.1.2 Standard Virtualization Props to Add

Add these props to all FlatList components:

```tsx
<FlatList
  // ... existing props
  initialNumToRender={10}
  windowSize={5}
  maxToRenderPerBatch={10}
  updateCellsBatchingPeriod={50}
  removeClippedSubviews={Platform.OS !== 'web'}
  getItemLayout={(_, index) => ({
    length: ITEM_HEIGHT, // Define based on card height
    offset: ITEM_HEIGHT * index,
    index,
  })}
/>
```

### 4.1.3 GroupsScreen.tsx Virtualization

**File:** `src/screens/GroupsScreen.tsx`

Find the FlatList (around line 431) and add:

```tsx
<FlatList
  data={groups}
  keyExtractor={(item) => item.id}
  renderItem={renderGroup}
  contentContainerStyle={styles.list}
  showsVerticalScrollIndicator={false}
  // ADD THESE:
  initialNumToRender={8}
  windowSize={5}
  maxToRenderPerBatch={8}
  updateCellsBatchingPeriod={50}
  removeClippedSubviews={Platform.OS !== 'web'}
  // ... rest of props
/>
```

### 4.1.4 Convert NotificationsInboxScreen to FlatList

**File:** `src/screens/NotificationsInboxScreen.tsx`

Current: Uses `ScrollView` with `.map()` (line 239-257)

Change to:

```tsx
<FlatList
  data={notifications}
  keyExtractor={(item) => item.id}
  renderItem={({ item }) => {
    const icon = getNotificationIcon(item.type);
    const message = getNotificationMessage(item);
    return (
      <TouchableOpacity
        style={[styles.notificationCard, !item.read && styles.notificationUnread]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.7}
      >
        {/* ... existing notification card content */}
      </TouchableOpacity>
    );
  }}
  refreshControl={
    <RefreshControl
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        loadNotifications();
      }}
    />
  }
  ListHeaderComponent={
    unreadCount > 0 ? (
      <View style={styles.unreadBadge}>
        <Text style={styles.unreadBadgeText}>{unreadCount} new</Text>
      </View>
    ) : null
  }
  initialNumToRender={10}
  windowSize={5}
  maxToRenderPerBatch={10}
  removeClippedSubviews={Platform.OS !== 'web'}
/>
```

## 4.2 Avatar/Media Prefetching

### 4.2.1 Create Image Prefetch Utility

**File:** `src/utils/imagePrefetch.ts` (NEW FILE)

```typescript
import { Image } from 'react-native';

const prefetchedUrls = new Set<string>();

/**
 * Prefetch an image URL
 */
export const prefetchImage = async (url: string | null | undefined): Promise<void> => {
  if (!url || prefetchedUrls.has(url)) return;
  
  try {
    await Image.prefetch(url);
    prefetchedUrls.add(url);
  } catch (error) {
    // Silently fail - image will load normally when displayed
    console.debug('[ImagePrefetch] Failed to prefetch:', url);
  }
};

/**
 * Prefetch multiple images
 */
export const prefetchImages = async (urls: (string | null | undefined)[]): Promise<void> => {
  const validUrls = urls.filter((url): url is string => !!url && !prefetchedUrls.has(url));
  await Promise.allSettled(validUrls.map(prefetchImage));
};

/**
 * Prefetch avatars from feed items
 */
export const prefetchFeedAvatars = async (items: Array<{ userPhotoURL?: string | null }>): Promise<void> => {
  const urls = items
    .slice(0, 20) // Only prefetch first 20
    .map(item => item.userPhotoURL)
    .filter((url): url is string => !!url);
  
  await prefetchImages(urls);
};

/**
 * Clear prefetch cache (call on logout)
 */
export const clearPrefetchCache = (): void => {
  prefetchedUrls.clear();
};
```

### 4.2.2 Use Prefetching in FeedScreen

**File:** `src/screens/home/FeedScreen.tsx`

Import:
```typescript
import { prefetchFeedAvatars } from '../../utils/imagePrefetch';
```

Add useEffect to prefetch avatars when items load:
```typescript
useEffect(() => {
  if (items.length > 0) {
    prefetchFeedAvatars(items);
  }
}, [items]);
```

## 4.3 Lazy Load Admin Screens

### 4.3.1 Create Lazy Loading Wrapper

**File:** `src/components/LazyScreen.tsx` (NEW FILE)

```typescript
import React, { Suspense, lazy, ComponentType } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

type LazyScreenProps = {
  factory: () => Promise<{ default: ComponentType<any> }>;
  fallback?: React.ReactNode;
};

export const LazyScreen: React.FC<LazyScreenProps> = ({ factory, fallback }) => {
  const { colors } = useTheme();
  const LazyComponent = lazy(factory);
  
  const defaultFallback = (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={colors.accent} />
    </View>
  );
  
  return (
    <Suspense fallback={fallback || defaultFallback}>
      <LazyComponent />
    </Suspense>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
```

### 4.3.2 Update AppNavigator for Lazy Admin Screens

**File:** `src/navigation/AppNavigator.tsx`

Replace direct imports with lazy imports for admin screens:

```typescript
// Change from:
import { AdminDashboardScreen } from '../screens/admin/AdminDashboardScreen';
import { ReportsScreen } from '../screens/admin/ReportsScreen';
// etc.

// To lazy imports:
const AdminDashboardScreen = React.lazy(() => 
  import('../screens/admin/AdminDashboardScreen').then(m => ({ default: m.AdminDashboardScreen }))
);
const ReportsScreen = React.lazy(() => 
  import('../screens/admin/ReportsScreen').then(m => ({ default: m.ReportsScreen }))
);
const PinnedRequestsScreen = React.lazy(() => 
  import('../screens/admin/PinnedRequestsScreen').then(m => ({ default: m.PinnedRequestsScreen }))
);
const BannedUsersScreen = React.lazy(() => 
  import('../screens/admin/BannedUsersScreen').then(m => ({ default: m.BannedUsersScreen }))
);
const GlobalStatsScreen = React.lazy(() => 
  import('../screens/admin/GlobalStatsScreen').then(m => ({ default: m.GlobalStatsScreen }))
);
```

Wrap admin screen components in Suspense:

```tsx
<Stack.Screen 
  name="AdminDashboard" 
  options={{ headerShown: false }}
>
  {(props) => (
    <Suspense fallback={<LoadingScreen />}>
      <AdminDashboardScreen {...props} />
    </Suspense>
  )}
</Stack.Screen>
```

## 4.4 Startup Optimization

### 4.4.1 Analyze Bundle Size

Add to `package.json` scripts:

```json
{
  "scripts": {
    "analyze": "npx expo-bundle-analyzer"
  }
}
```

### 4.4.2 Defer Non-Critical Imports

**File:** `src/App.tsx` or entry point

Pattern for deferred loading:

```typescript
// Instead of importing everything at startup:
import { setupNotificationHandler } from './services/notifications';

// Defer non-critical setup:
useEffect(() => {
  // Defer notification setup slightly
  const timer = setTimeout(() => {
    setupNotificationHandler();
  }, 1000);
  
  return () => clearTimeout(timer);
}, []);
```

### 4.4.3 Optimize Firebase Imports

**File:** `src/services/firebase.ts`

Use modular imports (already done, but verify):

```typescript
// Good - modular imports
import { getFirestore, doc, getDoc } from 'firebase/firestore';

// Bad - full imports (avoid)
import firebase from 'firebase/app';
```
