import React, { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Platform, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useNetInfo } from '@react-native-community/netinfo';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFeed } from '../../hooks/useFeed';
import { useUnreadNotifications } from '../../hooks/useUnreadNotifications';
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
import { fonts, radius, spacing } from '../../theme/colors';
import type { FeedItem, PrayerCategory } from '../../types';
import { PRAYER_CATEGORIES } from '../../types';
import type { RootStackParamList } from '../../navigation/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

export const FeedScreen: React.FC = () => {
  const [mode, setMode] = useState<'REQUEST' | 'TESTIMONY'>('REQUEST');
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
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
  
  const { items, loading, error, errorType, isOffline, refresh } = useFeed(mode, user?.uid, userGroupIds);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
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

  // Get top 3 most prayed requests (only show if we have enough items with prayers)
  const mostPrayedItems = useMemo(() => {
    if (mode !== 'REQUEST') return [];
    
    const requestsWithPrayers = items
      .filter((item) => item.type === 'REQUEST' && ((item as any).prayers ?? 0) >= 5)
      .sort((a, b) => ((b as any).prayers ?? 0) - ((a as any).prayers ?? 0))
      .slice(0, 3);
    
    // Only show if we have at least 2 items with significant prayers
    return requestsWithPrayers.length >= 2 ? requestsWithPrayers : [];
  }, [items, mode]);

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

  // Dynamic bold diagonal gradient colors based on theme
  const gradientColors = [...colors.gradientBoldScreen] as [string, string, ...string[]];

  return (
    <LinearGradient 
      colors={gradientColors} 
      start={{ x: 0, y: 0 }} 
      end={{ x: 1, y: 1 }} 
      style={{ flex: 1 }}
    >
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
                {unreadCount > 0 && (
                  <View style={styles.notificationBadge}>
                    <Text style={styles.notificationBadgeText}>
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </Text>
                  </View>
                )}
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

        {/* Quick Access Bar - Devotions & Announcements */}
        <View style={styles.quickAccessBar}>
          <TouchableOpacity
            style={[styles.quickAccessButton, { backgroundColor: colors.accentLight }]}
            onPress={() => navigation.navigate('Devotions')}
          >
            <Ionicons name="book" size={18} color={colors.accent} />
            <Text style={[styles.quickAccessText, { color: colors.accent }]}>Daily Devotion</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickAccessButton, { backgroundColor: isDark ? '#7f1d1d' : '#fef2f2' }]}
            onPress={() => navigation.navigate('Announcements')}
          >
            <Ionicons name="megaphone" size={18} color="#dc2626" />
            <Text style={[styles.quickAccessText, { color: '#dc2626' }]}>Announcements</Text>
          </TouchableOpacity>
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
              ListHeaderComponent={
                mostPrayedItems.length > 0 ? (
                  <View style={styles.mostPrayedSection}>
                    <View style={styles.mostPrayedHeader}>
                      <Text style={styles.mostPrayedEmoji}>🔥</Text>
                      <Text style={[styles.mostPrayedTitle, { color: colors.text }]}>Most Prayed</Text>
                    </View>
                    <ScrollView 
                      horizontal 
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.mostPrayedScroll}
                    >
                      {mostPrayedItems.map((item, index) => (
                        <TouchableOpacity
                          key={item.id}
                          style={[
                            styles.mostPrayedCard,
                            { backgroundColor: isDark ? colors.surface : '#fff', borderColor: colors.border }
                          ]}
                          onPress={() => handleOpen(item)}
                          activeOpacity={0.8}
                        >
                          <View style={styles.mostPrayedRank}>
                            <Text style={styles.mostPrayedRankText}>#{index + 1}</Text>
                          </View>
                          <Text 
                            style={[styles.mostPrayedContent, { color: colors.text }]} 
                            numberOfLines={2}
                          >
                            {item.content}
                          </Text>
                          <View style={styles.mostPrayedFooter}>
                            <Text style={styles.mostPrayedPrayers}>
                              🙏 {(item as any).prayers ?? 0} prayers
                            </Text>
                            <Text style={[styles.mostPrayedAuthor, { color: colors.muted }]} numberOfLines={1}>
                              by {item.userDisplayName}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                ) : null
              }
              contentContainerStyle={{ paddingBottom: 120 }}
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
    fontFamily: fonts.bodyMedium,
    textTransform: 'uppercase',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heading: {
    fontFamily: fonts.heading,
    fontSize: 28,
    fontWeight: '700',
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
    position: 'relative' as const,
  },
  notificationBadge: {
    position: 'absolute' as const,
    top: -4,
    right: -4,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#fff',
  },
  notificationBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
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
  quickAccessBar: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  quickAccessButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    gap: 8,
  },
  quickAccessText: {
    fontSize: 12,
    fontWeight: '600',
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
    marginBottom: spacing.md,
    marginHorizontal: -spacing.lg,
    minHeight: 44,
    maxHeight: 44,
  },
  categoryContainer: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 4,
    minHeight: 32,
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
    bottom: 90,
    right: spacing.md,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#eab308',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  fabTestimony: {
    backgroundColor: '#22c55e',
    shadowColor: '#22c55e',
  },
  // Most Prayed Section Styles
  mostPrayedSection: {
    marginBottom: spacing.md,
  },
  mostPrayedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  mostPrayedEmoji: {
    fontSize: 16,
  },
  mostPrayedTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  mostPrayedScroll: {
    paddingRight: spacing.lg,
    gap: spacing.sm,
  },
  mostPrayedCard: {
    width: 160,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  mostPrayedRank: {
    position: 'absolute',
    top: -6,
    left: 8,
    backgroundColor: '#f59e0b',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  mostPrayedRankText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  mostPrayedContent: {
    fontSize: 11,
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
    fontSize: 10,
    fontWeight: '600',
    color: '#f59e0b',
  },
  mostPrayedAuthor: {
    fontSize: 9,
    maxWidth: 60,
  },
});
