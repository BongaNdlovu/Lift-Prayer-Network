import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Alert, FlatList, Platform, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View, Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useNetInfo } from '@react-native-community/netinfo';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFeed } from '../../hooks/useFeed';
import { useFollowing, useFollowingUids } from '../../hooks/useFollowing';
import { useUnreadNotifications } from '../../hooks/useUnreadNotifications';
import { logPrayer, logReaction, likeTestimony, pinRequest, unpinRequest } from '../../services/prayers';
import type { ReactionType } from '../../services/prayers';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../contexts/ThemeContext';
import { FeedCard } from '../../components/FeedCard';
import { SkeletonCard } from '../../components/SkeletonCard';
import { Confetti } from '../../components/Confetti';
import { LiftScreen, LiftCard } from '../../components/LiftLayout';
import { queuePendingPrayer, queuePendingPrayerPromise } from '../../services/offlineCache';
import { createOrUpdatePrayerPromise } from '../../services/prayerPromises';
import { subscribeToUserGroups } from '../../services/groups';
import { prefetchFeedAvatars } from '../../utils/imagePrefetch';
import { fonts, fontSizes, radius, spacing } from '../../theme/colors';
import type { FeedItem, PrayerCategory } from '../../types';
import { PRAYER_CATEGORIES } from '../../types';
import type { RootStackParamList } from '../../navigation/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getVerseOfDay } from '../../services/verseOfDay';

type FeedTab = 'all' | 'following' | 'answered';

export const FeedScreen: React.FC = () => {
  const [mode, setMode] = useState<'REQUEST' | 'TESTIMONY'>('REQUEST');
  const [activeTab, setActiveTab] = useState<FeedTab>('all');
  const { user } = useAuth();
  const { colors } = useTheme();
  const { unreadCount } = useUnreadNotifications();
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
  
  // Get following data for feed prioritization and follow actions
  const { follow, unfollow, isFollowing } = useFollowing(user?.uid, {
    displayName: user?.displayName || undefined,
    photoURL: user?.photoURL,
  });
  const followingUids = useFollowingUids(user?.uid);
  
  // Pass current user's profile to useFeed for instant profile updates on their own posts
  const { items, loading, error, errorType, isOffline, refresh, loadMore, hasMore } = useFeed(
    mode,
    user?.uid,
    userGroupIds,
    followingUids,
    {
      displayName: user?.displayName,
      photoURL: user?.photoURL,
    }
  );
  
  // Follow/unfollow handlers for FeedCard
  const handleFollow = async (targetUid: string, displayName: string, photoURL?: string | null): Promise<boolean> => {
    return await follow(targetUid, displayName, photoURL);
  };
  
  const handleUnfollow = async (targetUid: string): Promise<boolean> => {
    return await unfollow(targetUid);
  };
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [prayedIds, setPrayedIds] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [searchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<PrayerCategory | 'all'>('all');
  const [showUrgentOnly, setShowUrgentOnly] = useState(false);
  const netInfo = useNetInfo();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  useEffect(() => {
    if (items.length > 0) {
      prefetchFeedAvatars(items as any);
    }
  }, [items]);

  // Filter items based on search, category, urgent filter, and active tab
  const filteredItems = useMemo(() => {
    let result = items;

    // Following tab filter - show only posts from followed users
    if (activeTab === 'following') {
      result = result.filter((item) => followingUids.includes(item.ownerUid));
    }

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
  }, [items, searchQuery, selectedCategory, showUrgentOnly, mode, activeTab, followingUids]);

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
          // Mark as prayed locally so button shows correct state
          setPrayedIds((prev) => new Set(prev).add(id));
          Alert.alert('Already Prayed', 'You have already prayed for this request. Thank you for your prayer! 🙏');
        } else if (result.isSelfPrayer) {
          Alert.alert('Your Request', 'You cannot pray on your own request. Share it with others to receive prayers!');
        } else {
          Alert.alert('Unable to pray', result.error || 'Please try again.');
        }
      } else {
        // Success! Mark as prayed and provide haptic feedback
        setPrayedIds((prev) => new Set(prev).add(id));
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

  const handlePromise = async (id: string, reminderFrequency: 'daily' | 'weekly' | 'once' | 'none' = 'daily') => {
    if (!user) {
      Alert.alert('Sign in required', 'Create an account to make prayer promises.');
      return;
    }
    const target = items.find((i) => i.id === id) as FeedItem | undefined;
    if (!target) {
      Alert.alert('Error', 'Could not find the prayer request. Please refresh and try again.');
      return;
    }

    if (offline) {
      await queuePendingPrayerPromise({
        userId: user.uid,
        requestId: id,
        requestOwnerUid: target.ownerUid,
        requestSummary: target.content?.slice(0, 120) || '',
        reminderFrequency,
      });
      Alert.alert('Saved offline', 'We will save this prayer promise when you reconnect.');
      return;
    }

    setBusyIds((prev) => new Set(prev).add(id));
    try {
      await createOrUpdatePrayerPromise({
        userId: user.uid,
        requestId: id,
        requestOwnerUid: target.ownerUid,
        requestSummary: target.content?.slice(0, 120) || '',
        reminderFrequency,
      });

      if (Platform.OS !== 'web') {
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch { /* ignore */ }
      }
      Alert.alert('Promise Made', 'You have committed to pray for this request. 🙏');
    } catch (err: any) {
      console.error('[FeedScreen] Promise error:', err);
      Alert.alert('Unable to make promise', err.message ?? 'An unexpected error occurred. Please try again.');
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const onRefresh = async () => {
    // Haptic feedback on pull-to-refresh
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {
        // Haptics not available
      }
    }
    
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

  // FAB pulse animation
  const fabPulseAnim = useRef(new Animated.Value(1)).current;
  
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(fabPulseAnim, {
          toValue: 1.05,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(fabPulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [fabPulseAnim]);

  return (
    <LiftScreen>
      <Confetti active={showConfetti} onComplete={() => setShowConfetti(false)} />
        {/* === HEADER SECTION === */}
        <View style={styles.headerSection}>
          {/* Offline Banner */}
          {offline && (
            <View style={styles.offlineBanner}>
              <Ionicons name="cloud-offline" size={14} color="#b91c1c" />
              <Text style={styles.offlineText}>Offline — viewing cached data</Text>
            </View>
          )}
          
          {/* Top Row: Logo + Actions */}
          <View style={styles.topRow}>
            <View style={styles.topRowLeft}>
              <Text style={[styles.heading, { color: colors.text }]}>
                Lift<Text style={styles.headingDot}>.</Text>
              </Text>
            </View>
            <View style={styles.topRowRight}>
              <TouchableOpacity onPress={() => navigation.navigate('NotificationsInbox')} style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="notifications-outline" size={20} color={colors.muted} />
                {unreadCount > 0 && <View style={[styles.badgeDot, { backgroundColor: colors.danger }]} />}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigation.navigate('Search')} style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="search-outline" size={20} color={colors.muted} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Quick Access: Announcements & Devotions */}
          <View style={styles.quickAccessRow}>
            <TouchableOpacity
              style={[styles.quickAccessButton, { backgroundColor: colors.glassWhite, borderColor: colors.glassBorder }]}
              onPress={() => navigation.navigate('Announcements')}
              activeOpacity={0.7}
            >
              <Ionicons name="megaphone-outline" size={18} color={colors.amber600} />
              <Text style={[styles.quickAccessText, { color: colors.stone700 }]}>Announcements</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickAccessButton, { backgroundColor: colors.glassWhite, borderColor: colors.glassBorder }]}
              onPress={() => navigation.navigate('Devotions')}
              activeOpacity={0.7}
            >
              <Ionicons name="book-outline" size={18} color={colors.amber600} />
              <Text style={[styles.quickAccessText, { color: colors.stone700 }]}>Devotions</Text>
            </TouchableOpacity>
          </View>

          {/* Stats Strip - Compact */}
          <View style={styles.statsRow}>
            <LiftCard style={styles.statCard}>
              <Text style={[styles.statValue, { color: colors.text }]}>{headerCounts.items}</Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>Requests</Text>
            </LiftCard>
            <LiftCard style={styles.statCard}>
              <Text style={[styles.statValue, { color: colors.accentDark }]}>{headerCounts.totalPrayers}</Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>Prayers</Text>
            </LiftCard>
            <LiftCard style={styles.statCard}>
              <Text style={[styles.statValue, { color: colors.text }]}>{user ? '🔥' : '—'}</Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>Streak</Text>
            </LiftCard>
          </View>
        </View>

        {/* === MAIN CONTENT AREA === */}
        <View style={styles.mainContent}>
          {/* Sticky Nav */}
          <View style={styles.stickyHeader}>
            {/* Tab Navigation */}
            <View style={styles.tabRow}>
              {/* For You Tab */}
              <TouchableOpacity
                onPress={() => {
                  setActiveTab('all');
                  setMode('REQUEST');
                }}
                style={styles.tabButton}
              >
                <Text style={[
                  styles.tabText,
                  { color: colors.stone400 },
                  activeTab === 'all' && mode === 'REQUEST' && styles.tabTextActive,
                  activeTab === 'all' && mode === 'REQUEST' && { color: colors.stone900 },
                ]}>
                  For You
                </Text>
                {activeTab === 'all' && mode === 'REQUEST' && <View style={styles.tabIndicator} />}
              </TouchableOpacity>

              {/* Following Tab - only show if user is logged in */}
              {user && (
                <TouchableOpacity
                  onPress={() => {
                    setActiveTab('following');
                    setMode('REQUEST');
                  }}
                  style={styles.tabButton}
                >
                  <View style={styles.tabWithBadge}>
                    <Text style={[
                      styles.tabText,
                      { color: colors.stone400 },
                      activeTab === 'following' && styles.tabTextActive,
                      activeTab === 'following' && { color: colors.stone900 },
                    ]}>
                      Following
                    </Text>
                    {followingUids.length > 0 && (
                      <View style={[styles.followingBadge, activeTab === 'following' && styles.followingBadgeActive]}>
                        <Text style={[styles.followingBadgeText, activeTab === 'following' && styles.followingBadgeTextActive]}>
                          {followingUids.length}
                        </Text>
                      </View>
                    )}
                  </View>
                  {activeTab === 'following' && <View style={styles.tabIndicator} />}
                </TouchableOpacity>
              )}

              {/* Answered Tab */}
              <TouchableOpacity
                onPress={() => {
                  setActiveTab('answered');
                  setMode('TESTIMONY');
                }}
                style={styles.tabButton}
              >
                <Text style={[
                  styles.tabText,
                  { color: colors.stone400 },
                  activeTab === 'answered' && styles.tabTextActive,
                  activeTab === 'answered' && { color: colors.stone900 },
                ]}>
                  Answered
                </Text>
                {activeTab === 'answered' && <View style={styles.tabIndicator} />}
              </TouchableOpacity>
            </View>

            {/* Filter Chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filterScroll}
              contentContainerStyle={styles.filterContainer}
            >
              <TouchableOpacity
                onPress={() => setSelectedCategory('all')}
                style={[styles.chip, { backgroundColor: colors.surfaceSecondary }, selectedCategory === 'all' && [styles.chipActive, { backgroundColor: colors.accentLight, borderColor: colors.accentDark }]]}
              >
                <Text style={[
                  styles.chipText,
                  { color: colors.muted },
                  selectedCategory === 'all' && { color: colors.text },
                ]}>
                  All
                </Text>
              </TouchableOpacity>
              {PRAYER_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => setSelectedCategory(selectedCategory === cat.id ? 'all' : cat.id)}
                  style={[styles.chip, { backgroundColor: colors.surfaceSecondary }, selectedCategory === cat.id && [styles.chipActive, { backgroundColor: colors.accentLight, borderColor: colors.accentDark }]]}
                >
                  <Text style={styles.chipEmoji}>{cat.emoji}</Text>
                  <Text style={[
                    styles.chipText,
                    { color: colors.muted },
                    selectedCategory === cat.id && { color: colors.text },
                  ]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
              {/* Urgent filter */}
              {mode === 'REQUEST' && headerCounts.urgentCount > 0 && (
                <TouchableOpacity
                  onPress={() => setShowUrgentOnly(!showUrgentOnly)}
                  style={[styles.chip, { backgroundColor: colors.surfaceSecondary }, showUrgentOnly && styles.chipActiveUrgent]}
                >
                  <Text style={styles.chipEmoji}>🚨</Text>
                  <Text style={[
                    styles.chipText,
                    { color: showUrgentOnly ? '#fff' : '#dc2626' },
                  ]}>
                    Urgent ({headerCounts.urgentCount})
                  </Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>

          {/* Verse of the Day */}
          <View style={styles.verseCard}>
            <View style={styles.verseHeader}>
              <Text style={styles.verseLabel}>VERSE OF THE DAY</Text>
              <Text style={styles.verseReference}>{getVerseOfDay().reference}</Text>
            </View>
            <Text style={[styles.verseText, { color: colors.stone700 }]}>
              &quot;{getVerseOfDay().text}&quot;
            </Text>
          </View>

          {/* Error/Offline Banner */}
          {(error || isOffline) && !loading && (
            <View style={[
              styles.errorBanner,
              { backgroundColor: colors.glassWhiteLight, borderColor: colors.glassBorder },
              errorType === 'permission' && styles.errorBannerPermission
            ]}>
              <Ionicons 
                name={isOffline ? "cloud-offline" : errorType === 'permission' ? "lock-closed" : "warning"} 
                size={18} 
                color={errorType === 'permission' ? "#dc2626" : colors.amber600} 
              />
              <Text style={[
                styles.errorBannerText,
                { color: colors.stone700 },
                errorType === 'permission' && styles.errorBannerTextPermission
              ]}>
                {isOffline 
                  ? "You're offline. Showing cached data." 
                  : errorType === 'permission'
                    ? "Some prayers couldn't be loaded due to privacy settings."
                    : "Couldn't load latest prayers. Pull to refresh."}
              </Text>
              <TouchableOpacity onPress={onRefresh} style={styles.errorRetryButton}>
                <Ionicons name="refresh" size={16} color={colors.amber600} />
              </TouchableOpacity>
            </View>
          )}

          {/* Feed Content */}
          <View style={styles.feedContainer}>
            {loading ? (
              <View style={styles.loading}>
                {[...Array(4)].map((_, idx) => (
                  <SkeletonCard key={idx} />
                ))}
              </View>
            ) : filteredItems.length === 0 && !error ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>
                  {activeTab === 'following' ? '👥' : mode === 'REQUEST' ? '🙏' : '✨'}
                </Text>
                <Text style={[styles.emptyTitle, { color: colors.stone900 }]}>
                  {activeTab === 'following'
                    ? followingUids.length === 0
                      ? 'Not following anyone yet'
                      : 'No posts from people you follow'
                    : searchQuery || selectedCategory !== 'all' 
                      ? 'No matching prayers found'
                      : mode === 'REQUEST' 
                        ? 'No prayer requests yet' 
                        : 'No testimonies yet'}
                </Text>
                <Text style={[styles.emptySubtitle, { color: colors.stone500 }]}>
                  {activeTab === 'following'
                    ? followingUids.length === 0
                      ? 'Follow users from the feed to see their posts here'
                      : 'Check back later for new posts'
                    : searchQuery || selectedCategory !== 'all'
                      ? 'Try adjusting your filters'
                      : mode === 'REQUEST'
                        ? 'Be the first to share a prayer request!'
                        : 'Share how God has answered your prayers!'}
                </Text>
                {activeTab === 'following' && followingUids.length === 0 && (
                  <TouchableOpacity
                    style={[styles.emptyActionButton, { backgroundColor: colors.accent }]}
                    onPress={() => setActiveTab('all')}
                  >
                    <Text style={styles.emptyActionButtonText}>Browse Feed</Text>
                  </TouchableOpacity>
                )}
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
                    onPromise={handlePromise}
                    disabled={busyIds.has(item.id)}
                    hasPrayed={prayedIds.has(item.id)}
                    onPress={handleOpen}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onPin={handlePin}
                    onFollow={handleFollow}
                    onUnfollow={handleUnfollow}
                    isFollowing={isFollowing(item.ownerUid)}
                    currentUserId={user?.uid}
                    currentUserEmail={user?.email}
                  />
                )}
                ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
                contentContainerStyle={styles.feedList}
                showsVerticalScrollIndicator={false}
                initialNumToRender={8}
                windowSize={8}
                maxToRenderPerBatch={8}
                updateCellsBatchingPeriod={50}
                removeClippedSubviews
                getItemLayout={(_, index) => ({
                  length: 200,
                  offset: 200 * index,
                  index,
                })}
                onEndReached={() => {
                  if (hasMore && !loading) {
                    loadMore();
                  }
                }}
                onEndReachedThreshold={0.5}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    colors={[colors.amber500, colors.amber400, colors.amber600]}
                    tintColor={colors.amber500}
                    title="Refreshing prayers..."
                    titleColor={colors.stone400}
                    progressBackgroundColor={colors.amber100}
                  />
                }
              />
            )}
          </View>
        </View>

        {/* === FAB === */}
        <View style={styles.fabContainer}>
          <Animated.View style={[
            styles.fabGlow,
            { transform: [{ scale: fabPulseAnim }] }
          ]} />
          <TouchableOpacity
            style={[styles.fab, { backgroundColor: mode === 'TESTIMONY' ? colors.success : colors.accent }]}
            onPress={navigateToCreate}
            activeOpacity={0.9}
          >
            <Ionicons name="add" size={32} color="#fff" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
    </LiftScreen>
  );
};

const styles = StyleSheet.create({
  // === MAIN CONTAINER ===
  container: {
    flex: 1,
  },
  
  // === HEADER SECTION ===
  headerSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    zIndex: 20,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  topRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  topRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  heading: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.xxl,
    fontWeight: '600',
    letterSpacing: -0.5,
  },
  headingDot: {
    color: '#f59e0b',
  },
  
  // === QUICK ACCESS ROW ===
  quickAccessRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  quickAccessButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  quickAccessLocked: {
    opacity: 0.7,
  },
  quickAccessText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
  },
  comingSoonBadge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.sm,
    marginLeft: spacing.xs,
  },
  comingSoonText: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  
  // === STATS ROW ===
  statsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  statValue: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.lg,
    fontWeight: '600',
  },
  statLabel: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    marginTop: 2,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    marginRight: spacing.xs,
  },
  chipActive: {
    borderWidth: 1,
  },
  chipActiveUrgent: {
    backgroundColor: '#dc2626',
  },
  chipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
  },
  chipEmoji: {
    fontSize: 14,
  },
  
  // === MAIN CONTENT AREA ===
  mainContent: {
    flex: 1,
    zIndex: 10,
  },
  
  // === STICKY HEADER ===
  stickyHeader: {
    zIndex: 30,
  },
  
  // === TAB NAVIGATION ===
  tabRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xs,
  },
  tabButton: {
    position: 'relative',
  },
  tabText: {
    fontSize: fontSizes.md,
    fontWeight: '500',
    fontFamily: fonts.body,
  },
  tabTextActive: {
    fontFamily: fonts.heading,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  tabIndicator: {
    position: 'absolute',
    bottom: -8,
    left: 0,
    right: 0,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#fbbf24',
  },
  tabWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  followingBadge: {
    backgroundColor: 'rgba(0,0,0,0.08)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  followingBadgeActive: {
    backgroundColor: '#fbbf24',
  },
  followingBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6b7280',
  },
  followingBadgeTextActive: {
    color: '#1c1917',
  },
  
  // === FILTER CHIPS ===
  filterScroll: {
    marginTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  filterContainer: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
  chipTextActive: {
    color: '#fff',
  },
  
  // === FEED CONTAINER ===
  feedContainer: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  feedList: {
    paddingBottom: 120,
    paddingTop: spacing.sm,
  },
  
  // === ERROR BANNER ===
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    gap: spacing.sm,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  errorBannerPermission: {
    backgroundColor: 'rgba(254,242,242,0.8)',
    borderColor: 'rgba(254,205,211,0.6)',
  },
  errorBannerTextPermission: {
    color: '#dc2626',
  },
  errorRetryButton: {
    padding: spacing.xs,
  },
  
  // === LOADING STATE ===
  loading: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  
  // === EMPTY STATE ===
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: spacing.lg,
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.xl,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyActionButton: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
  },
  emptyActionButtonText: {
    color: '#fff',
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
    fontWeight: '600',
  },
  
  // === OFFLINE BANNER ===
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(254,226,226,0.8)',
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  offlineText: {
    fontSize: 12,
    color: '#b91c1c',
    fontWeight: '600',
  },
  
  // === FAB (Floating Action Button) ===
  fabContainer: {
    position: 'absolute',
    bottom: 100,
    right: spacing.lg,
    zIndex: 40,
  },
  fabGlow: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(56, 92, 59, 0.2)',
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  
  // === MOST PRAYED SECTION ===
  mostPrayedSection: {
    marginBottom: spacing.md,
    marginTop: spacing.xs,
  },
  mostPrayedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  mostPrayedEmoji: {
    fontSize: 16,
  },
  mostPrayedTitle: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.md,
    fontWeight: '600',
  },
  mostPrayedScroll: {
    paddingRight: spacing.md,
    gap: spacing.xs,
  },
  mostPrayedCard: {
    width: 180,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  mostPrayedRank: {
    position: 'absolute',
    top: -8,
    left: 12,
    backgroundColor: '#f59e0b',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    
    
    
    
    elevation: 3,
  },
  mostPrayedRankText: {
    color: '#fff',
    fontSize: fontSizes.xs - 2,
    fontWeight: '700',
    fontFamily: fonts.bodyBold,
  },
  mostPrayedContent: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.xs,
    lineHeight: 16,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  mostPrayedFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mostPrayedPrayers: {
    fontSize: fontSizes.xs - 1,
    fontWeight: '700',
    fontFamily: fonts.bodyBold,
    color: '#f59e0b',
  },
  mostPrayedAuthor: {
    fontSize: fontSizes.xs - 2,
    fontFamily: fonts.body,
    maxWidth: 70,
  },
  
  // === VERSE OF THE DAY ===
  verseCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.sm,
    backgroundColor: 'rgba(254,243,199,0.4)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.2)',
  },
  verseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  verseLabel: {
    fontSize: fontSizes.xs - 3,
    fontWeight: '700',
    fontFamily: fonts.bodyBold,
    letterSpacing: 1,
    color: '#b45309',
    opacity: 0.8,
  },
  verseReference: {
    fontSize: fontSizes.xs - 1,
    fontWeight: '600',
    fontFamily: fonts.bodyMedium,
    color: '#b45309',
  },
  verseText: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.xs,
    lineHeight: 18,
    fontStyle: 'italic',
  },
});
