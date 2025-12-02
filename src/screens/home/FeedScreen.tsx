import React, { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Platform, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useNetInfo } from '@react-native-community/netinfo';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import { useFeed } from '../../hooks/useFeed';
import { logPrayer, logReaction, likeTestimony, pinRequest, unpinRequest } from '../../services/prayers';
import type { ReactionType } from '../../services/prayers';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../contexts/ThemeContext';
import { FeedCard } from '../../components/FeedCard';
import { SkeletonCard } from '../../components/SkeletonCard';
import { Confetti } from '../../components/Confetti';
import { queuePendingPrayer } from '../../services/offlineCache';
import { subscribeToUserGroups } from '../../services/groups';
import { prefetchFeedAvatars } from '../../utils/imagePrefetch';
import { radius, spacing } from '../../theme/colors';
import type { FeedItem, PrayerCategory } from '../../types';
import { PRAYER_CATEGORIES } from '../../types';
import type { RootStackParamList } from '../../navigation/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

export const FeedScreen: React.FC = () => {
  const [mode, setMode] = useState<'REQUEST' | 'TESTIMONY'>('REQUEST');
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const [userGroupIds, setUserGroupIds] = useState<string[]>([]);
  
  // Subscribe to user's groups for proper feed filtering
  useEffect(() => {
    if (!user?.uid) {
      setUserGroupIds([]);
      return;
    }
    
    const unsubscribe = subscribeToUserGroups(user.uid, (groups) => {
      setUserGroupIds(groups.map(g => g.id));
    });
    
    return () => unsubscribe();
  }, [user?.uid]);
  
  const { items, loading, error, errorType, isOffline, refresh } = useFeed(mode, user?.uid, userGroupIds);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<PrayerCategory | 'all'>('all');
  const [showUrgentOnly, setShowUrgentOnly] = useState(false);
  const netInfo = useNetInfo();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  useEffect(() => {
    if (items.length > 0) {
      prefetchFeedAvatars(items as any);
    }
  }, [items]);

  // Filter items based on search, category, and urgent filter
  const filteredItems = useMemo(() => {
    let result = items;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (item) =>
          item.content.toLowerCase().includes(query) ||
          item.userDisplayName.toLowerCase().includes(query)
      );
    }

    // Category filter
    if (selectedCategory !== 'all') {
      result = result.filter((item) => (item as any).category === selectedCategory);
    }

    // Urgent filter (for requests only)
    if (showUrgentOnly && mode === 'REQUEST') {
      result = result.filter(
        (item) => item.type === 'REQUEST' && (item.severity === 'CRITICAL' || (item as any).isUrgent)
      );
    }

    return result;
  }, [items, searchQuery, selectedCategory, showUrgentOnly, mode]);

  const headerCounts = useMemo(() => {
    const totalPrayers = filteredItems.reduce((sum, item) => sum + (item.type === 'REQUEST' ? item.prayers ?? 0 : 0), 0);
    const urgentCount = items.filter(
      (item) => item.type === 'REQUEST' && (item.severity === 'CRITICAL' || (item as any).isUrgent)
    ).length;
    return {
      items: filteredItems.length,
      totalPrayers,
      urgentCount,
    };
  }, [filteredItems, items]);

  const offline = netInfo.isConnected === false;

  const handlePray = async (id: string) => {
    if (!user) {
      Alert.alert('Sign in required', 'Create an account or continue as guest to log prayers.');
      return;
    }
    const target = items.find((i) => i.id === id) as FeedItem | undefined;
    if (!target) {
      Alert.alert('Error', 'Could not find the prayer request. Please refresh and try again.');
      return;
    }

    if (offline) {
      await queuePendingPrayer({
        requestId: id,
        actorUid: user.uid,
        actorDisplayName: user.displayName || undefined,
        targetOwnerUid: target.ownerUid,
        targetSummary: target.content?.slice(0, 120) || '',
      });
      Alert.alert('Saved offline', 'We will log this prayer when you reconnect.');
      return;
    }

    setBusyIds((prev) => new Set(prev).add(id));
    try {
      const result = await logPrayer(
        user.uid, 
        id, 
        target.ownerUid, 
        target.content?.slice(0, 120) || '', 
        user.displayName || undefined
      );
      
      if (!result.success) {
        if (result.alreadyPrayed) {
          Alert.alert('Already Prayed', 'You have already prayed for this request. Thank you for your prayer! 🙏');
        } else if (result.isSelfPrayer) {
          Alert.alert('Your Request', 'You cannot pray on your own request. Share it with others to receive prayers!');
        } else {
          Alert.alert('Unable to pray', result.error || 'Please try again.');
        }
      } else {
        // Success! Provide haptic feedback
        if (Platform.OS !== 'web') {
          try {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch { /* ignore */ }
        }
        // Refresh the feed to show updated prayer count and status
        refresh();
      }
    } catch (err: any) {
      console.error('[FeedScreen] Prayer error:', err);
      Alert.alert('Unable to pray', err.message ?? 'An unexpected error occurred. Please try again.');
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleLike = async (id: string) => {
    if (!user) {
      Alert.alert('Sign in required', 'Create an account or continue as guest to react.');
      return;
    }
    
    setBusyIds((prev) => new Set(prev).add(id));
    try {
      const result = await likeTestimony(user.uid, id);
      
      if (!result.success) {
        Alert.alert('Unable to react', result.error || 'Please try again.');
      } else {
        // Success! Provide haptic feedback
        if (Platform.OS !== 'web') {
          try {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch { /* ignore */ }
        }
        // Refresh to show updated count
        refresh();
      }
    } catch (err: any) {
      console.error('[FeedScreen] Like error:', err);
      Alert.alert('Unable to react', err.message ?? 'An unexpected error occurred. Please try again.');
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleOpen = (feedItem: FeedItem) => {
    navigation.navigate('RequestDetail', { id: feedItem.id, type: feedItem.type, item: feedItem });
  };

  const handleEdit = (feedItem: FeedItem) => {
    navigation.navigate('EditRequest', { id: feedItem.id, type: feedItem.type, item: feedItem });
  };

  const handleDelete = (_feedItem: FeedItem) => {
    // Refresh the feed after delete
    refresh();
  };

  const handlePin = async (id: string, shouldPin: boolean) => {
    if (!user) return;
    
    try {
      let result;
      if (shouldPin) {
        result = await pinRequest(id, user.uid, user.email);
      } else {
        result = await unpinRequest(id, user.uid, user.email);
      }
      
      if (result.success) {
        if (Platform.OS !== 'web') {
          try {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch { /* ignore */ }
        }
        Alert.alert(
          shouldPin ? '📌 Pinned' : '📌 Unpinned',
          shouldPin 
            ? 'This prayer request will now appear at the top of everyone\'s feed.'
            : 'This prayer request has been unpinned.'
        );
        refresh();
      } else {
        Alert.alert('Error', result.error || 'Could not update pin status.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not update pin status.');
    }
  };

  const handleReact = async (id: string, reactionType: ReactionType) => {
    if (!user) {
      Alert.alert('Sign in required', 'Create an account to react to prayers.');
      return;
    }
    
    const target = items.find((i) => i.id === id);
    if (!target) return;

    try {
      const result = await logReaction(
        user.uid,
        id,
        target.type,
        reactionType
      );
      
      if (result.success) {
        // Refresh to show updated counts
        refresh();
      } else {
        console.error('[FeedScreen] Reaction failed:', result.error);
        Alert.alert('Error', result.error || 'Could not save reaction');
      }
    } catch (err: any) {
      console.error('[FeedScreen] Reaction error:', err);
      Alert.alert('Error', 'Could not save reaction. Please try again.');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    
    // Refresh the data
    refresh();
    
    // Add a small delay for UX feedback
    setTimeout(() => setRefreshing(false), 800);
  };

  const navigateToCreate = () => {
    if (mode === 'REQUEST') {
      navigation.navigate('CreateRequest');
    } else {
      navigation.navigate('CreateTestimony');
    }
  };

  // Dynamic gradient colors based on theme
  const gradientColors = isDark 
    ? (colors.screenGradient as unknown as [string, string, string])
    : ['#fefce8', '#f4f4f5', '#ffffff'] as [string, string, string];

  return (
    <LinearGradient colors={gradientColors} style={{ flex: 1 }}>
      <Confetti active={showConfetti} onComplete={() => setShowConfetti(false)} />
      <SafeAreaView style={[styles.container, { backgroundColor: 'transparent' }]}>
        {offline && (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineText}>Offline — viewing cached data</Text>
          </View>
        )}
        <View style={styles.topRow}>
          <View style={styles.topRowLeft}>
            <Text style={[styles.kicker, { color: colors.muted }]}>Live Network</Text>
            <View style={styles.headingRow}>
              <Text style={[styles.heading, { color: colors.text }]}>Lift</Text>
              {/* Notification Bell */}
              <TouchableOpacity
                style={[styles.notificationBell, { backgroundColor: isDark ? colors.surface : '#f1f5f9' }]}
                onPress={() => navigation.navigate('NotificationsInbox')}
              >
                <Ionicons name="notifications-outline" size={22} color={colors.text} />
              </TouchableOpacity>
              {/* Search Button */}
              <TouchableOpacity
                style={[styles.searchButton, { backgroundColor: isDark ? colors.surface : '#f1f5f9' }]}
                onPress={() => navigation.navigate('Search')}
              >
                <Ionicons name="search-outline" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.topRowRight}>
          {mode === 'REQUEST' && headerCounts.urgentCount > 0 && (
            <TouchableOpacity
              style={[styles.urgentPill, showUrgentOnly && styles.urgentPillActive]}
              onPress={() => setShowUrgentOnly(!showUrgentOnly)}
            >
              <Text style={styles.urgentEmoji}>🚨</Text>
              <Text style={[styles.urgentText, showUrgentOnly && styles.urgentTextActive]}>
                {headerCounts.urgentCount}
              </Text>
            </TouchableOpacity>
          )}
          <View style={styles.statPill}>
            <Text style={styles.statNumber}>{headerCounts.items}</Text>
            <Text style={styles.statLabel}>{mode === 'REQUEST' ? 'Requests' : 'Testimonies'}</Text>
          </View>
          <View style={styles.statPill}>
            <Text style={styles.statNumber}>{headerCounts.totalPrayers}</Text>
            <Text style={styles.statLabel}>Prayers</Text>
            </View>
          </View>
        </View>

        <View style={[styles.modeSwitch, { backgroundColor: colors.surfaceSecondary }]}>
          {(['REQUEST', 'TESTIMONY'] as const).map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.modeButton, mode === m && [styles.modeButtonActive, { backgroundColor: colors.surface }]]}
              onPress={() => setMode(m)}
            >
              <Text style={[styles.modeText, { color: colors.muted }, mode === m && { color: colors.text }]}>
                {m === 'REQUEST' ? 'Prayer Requests' : 'Answered Prayers'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Category Filter */}
        {mode === 'REQUEST' && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryScroll}
            contentContainerStyle={styles.categoryContainer}
          >
            <TouchableOpacity
              style={[styles.categoryChip, { backgroundColor: colors.surface, borderColor: colors.border }, selectedCategory === 'all' && styles.categoryChipActive]}
              onPress={() => setSelectedCategory('all')}
            >
              <Text style={[styles.categoryText, { color: colors.muted }, selectedCategory === 'all' && styles.categoryTextActive]}>
                All
              </Text>
            </TouchableOpacity>
            {PRAYER_CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[styles.categoryChip, { backgroundColor: colors.surface, borderColor: colors.border }, selectedCategory === cat.id && styles.categoryChipActive]}
                onPress={() => setSelectedCategory(selectedCategory === cat.id ? 'all' : cat.id)}
              >
                <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
                <Text style={[styles.categoryText, { color: colors.muted }, selectedCategory === cat.id && styles.categoryTextActive]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Error/Offline Banner */}
        {(error || isOffline) && !loading && (
          <View style={[
            styles.errorBanner,
            errorType === 'permission' && styles.errorBannerPermission
          ]}>
            <Ionicons 
              name={isOffline ? "cloud-offline" : errorType === 'permission' ? "lock-closed" : "warning"} 
              size={18} 
              color={errorType === 'permission' ? "#dc2626" : "#b45309"} 
            />
            <Text style={[
              styles.errorBannerText,
              errorType === 'permission' && styles.errorBannerTextPermission
            ]}>
              {isOffline 
                ? "You're offline. Showing cached data." 
                : errorType === 'permission'
                  ? "Some prayers couldn't be loaded due to privacy settings. Showing available content."
                  : "Couldn't load latest prayers. Pull to refresh."}
            </Text>
            <TouchableOpacity onPress={onRefresh} style={styles.errorRetryButton}>
              <Ionicons name="refresh" size={16} color={errorType === 'permission' ? "#dc2626" : "#b45309"} />
            </TouchableOpacity>
          </View>
        )}

          {loading ? (
            <View style={styles.loading}>
              {[...Array(4)].map((_, idx) => (
                <SkeletonCard key={idx} />
              ))}
            </View>
          ) : filteredItems.length === 0 && !error ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>{mode === 'REQUEST' ? '🙏' : '✨'}</Text>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {searchQuery || selectedCategory !== 'all' 
                  ? 'No matching prayers found'
                  : mode === 'REQUEST' 
                    ? 'No prayer requests yet' 
                    : 'No testimonies yet'}
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
                {searchQuery || selectedCategory !== 'all'
                  ? 'Try adjusting your filters'
                  : mode === 'REQUEST'
                    ? 'Be the first to share a prayer request!'
                    : 'Share how God has answered your prayers!'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredItems}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <FeedCard
                  item={item}
                  onPray={handlePray}
                  onLike={handleLike}
                  onReact={handleReact}
                  disabled={busyIds.has(item.id)}
                  onPress={handleOpen}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onPin={handlePin}
                  currentUserId={user?.uid}
                  currentUserEmail={user?.email}
                />
              )}
              contentContainerStyle={{ paddingBottom: 120 }}
              showsVerticalScrollIndicator={false}
              initialNumToRender={8}
              windowSize={8}
              maxToRenderPerBatch={8}
              updateCellsBatchingPeriod={50}
              removeClippedSubviews
              getItemLayout={(_, index) => ({
                length: 180,
                offset: 180 * index,
                index,
              })}
              refreshControl={
                <RefreshControl 
                  refreshing={refreshing} 
                  onRefresh={onRefresh}
                  colors={['#f59e0b', '#eab308', '#d97706']}
                  tintColor="#f59e0b"
                  title="Refreshing prayers..."
                  titleColor={colors.muted}
                  progressBackgroundColor="#fef3c7"
                />
              }
            />
          )}

        {/* Floating Action Button */}
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: colors.accent }, mode === 'TESTIMONY' && styles.fabTestimony]}
          onPress={navigateToCreate}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  topRowLeft: {
    flexShrink: 0,
  },
  topRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexShrink: 1,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  kicker: {
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontSize: 11,
    fontWeight: '600',
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heading: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  notificationBell: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  searchButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statPill: {
    backgroundColor: '#fff7d6',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#fef08a',
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 16,
    fontWeight: '800',
    color: '#92400e',
  },
  statLabel: {
    fontSize: 9,
    color: '#92400e',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginTop: 1,
  },
  modeSwitch: {
    flexDirection: 'row',
    borderRadius: radius.md,
    backgroundColor: '#f1f5f9',
    padding: 5,
    marginBottom: spacing.md,
  },
  modeButton: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: radius.md,
  },
  modeButtonActive: {
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 2,
  },
  modeText: {
    fontSize: 15,
    fontWeight: '700',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.xs,
    borderWidth: 1,
    minHeight: 36,
  },
  searchIcon: {
    marginRight: spacing.xs,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.xs,
    fontSize: 13,
  },
  clearButton: {
    padding: spacing.xs,
  },
  categoryScroll: {
    marginBottom: spacing.xs,
    marginHorizontal: -spacing.lg,
    maxHeight: 32,
  },
  categoryContainer: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    gap: 3,
    minHeight: 28,
  },
  categoryChipActive: {
    backgroundColor: '#eab308',
    borderColor: '#eab308',
  },
  categoryEmoji: {
    fontSize: 12,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '600',
  },
  categoryTextActive: {
    color: '#1f2937',
  },
  urgentPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#fecaca',
    gap: 6,
  },
  urgentPillActive: {
    backgroundColor: '#ef4444',
    borderColor: '#ef4444',
  },
  urgentEmoji: {
    fontSize: 14,
  },
  urgentText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#dc2626',
  },
  urgentTextActive: {
    color: '#fff',
  },
  loading: {
    marginTop: spacing.md,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#fcd34d',
    gap: spacing.sm,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 13,
    color: '#b45309',
    fontWeight: '600',
  },
  errorBannerPermission: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  errorBannerTextPermission: {
    color: '#dc2626',
  },
  errorRetryButton: {
    padding: spacing.xs,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: spacing.xl,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  offlineBanner: {
    backgroundColor: '#fee2e2',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#fecdd3',
  },
  offlineText: {
    fontSize: 14,
    color: '#b91c1c',
    fontWeight: '700',
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: 100,
    right: spacing.lg,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#eab308',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  fabTestimony: {
    backgroundColor: '#22c55e',
    shadowColor: '#22c55e',
  },
});
