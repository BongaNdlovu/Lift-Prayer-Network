import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Alert, FlatList, Platform, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View, Animated } from 'react-native';
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
import { CinematicBackground, RoundedPage, GlassHeader } from '../../components/CinematicBackground';
import { GlassStatCard, GlassChip, GlassIconButton } from '../../components/GlassCard';
import { queuePendingPrayer } from '../../services/offlineCache';
import { subscribeToUserGroups } from '../../services/groups';
import { prefetchFeedAvatars } from '../../utils/imagePrefetch';
import { fonts, fontSizes, radius, spacing, shadows } from '../../theme/colors';
import type { FeedItem, PrayerCategory } from '../../types';
import { PRAYER_CATEGORIES } from '../../types';
import type { RootStackParamList } from '../../navigation/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getVerseOfDay } from '../../services/verseOfDay';

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
    <CinematicBackground useOuterBackground>
      <Confetti active={showConfetti} onComplete={() => setShowConfetti(false)} />
      <SafeAreaView style={styles.container}>
        {/* === CINEMATIC HEADER SECTION === */}
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
              <Text style={[styles.heading, { color: colors.stone900 }]}>
                Lift<Text style={styles.headingDot}>.</Text>
              </Text>
            </View>
            <View style={styles.topRowRight}>
              <GlassIconButton
                onPress={() => navigation.navigate('NotificationsInbox')}
                badge={unreadCount}
              >
                <Ionicons name="notifications-outline" size={20} color={colors.stone700} />
              </GlassIconButton>
              <GlassIconButton onPress={() => navigation.navigate('Search')}>
                <Ionicons name="search-outline" size={20} color={colors.stone700} />
              </GlassIconButton>
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
              style={[styles.quickAccessButton, styles.quickAccessLocked, { backgroundColor: colors.glassWhiteLight, borderColor: colors.glassBorderLight }]}
              activeOpacity={1}
              onPress={() => {}}
            >
              <Ionicons name="book-outline" size={18} color={colors.stone400} />
              <Text style={[styles.quickAccessText, { color: colors.stone400 }]}>Devotions</Text>
              <View style={[styles.comingSoonBadge, { backgroundColor: colors.amber100 }]}>
                <Text style={[styles.comingSoonText, { color: colors.amber700 }]}>Soon</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Stats Strip - Compact */}
          <View style={styles.statsRow}>
            <GlassStatCard value={headerCounts.items} label="Requests" />
            <GlassStatCard value={headerCounts.totalPrayers} label="Prayers" accent />
            <GlassStatCard value={user ? '🔥' : '—'} label="Streak" />
          </View>
        </View>

        {/* === MAIN CONTENT AREA - Rounded "Page" Effect === */}
        <RoundedPage style={styles.mainContent}>
          {/* Sticky Nav with Glass Effect */}
          <GlassHeader style={styles.stickyHeader}>
            {/* Tab Navigation */}
            <View style={styles.tabRow}>
              {(['For You', 'Requests', 'Answered'] as const).map((tab) => {
                const tabKey = tab === 'For You' ? 'REQUEST' : tab === 'Requests' ? 'REQUEST' : 'TESTIMONY';
                const isActive = (tab === 'For You' && mode === 'REQUEST') || 
                                 (tab === 'Requests' && mode === 'REQUEST') ||
                                 (tab === 'Answered' && mode === 'TESTIMONY');
                // Only show "For You" and "Answered" for simplicity
                if (tab === 'Requests') return null;
                return (
                  <TouchableOpacity
                    key={tab}
                    onPress={() => setMode(tab === 'Answered' ? 'TESTIMONY' : 'REQUEST')}
                    style={styles.tabButton}
                  >
                    <Text style={[
                      styles.tabText,
                      { color: colors.stone400 },
                      isActive && styles.tabTextActive,
                      isActive && { color: colors.stone900 },
                    ]}>
                      {tab === 'For You' ? 'Prayer Requests' : 'Answered Prayers'}
                    </Text>
                    {isActive && <View style={styles.tabIndicator} />}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Filter Chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filterScroll}
              contentContainerStyle={styles.filterContainer}
            >
              <GlassChip
                active={selectedCategory === 'all'}
                onPress={() => setSelectedCategory('all')}
              >
                <Text style={[
                  styles.chipText,
                  { color: colors.stone500 },
                  selectedCategory === 'all' && styles.chipTextActive,
                ]}>
                  All
                </Text>
              </GlassChip>
              {PRAYER_CATEGORIES.map((cat) => (
                <GlassChip
                  key={cat.id}
                  active={selectedCategory === cat.id}
                  onPress={() => setSelectedCategory(selectedCategory === cat.id ? 'all' : cat.id)}
                  icon={<Text style={styles.chipEmoji}>{cat.emoji}</Text>}
                >
                  <Text style={[
                    styles.chipText,
                    { color: colors.stone500 },
                    selectedCategory === cat.id && styles.chipTextActive,
                  ]}>
                    {cat.label}
                  </Text>
                </GlassChip>
              ))}
              {/* Urgent filter */}
              {mode === 'REQUEST' && headerCounts.urgentCount > 0 && (
                <GlassChip
                  active={showUrgentOnly}
                  onPress={() => setShowUrgentOnly(!showUrgentOnly)}
                  icon={<Text style={styles.chipEmoji}>🚨</Text>}
                >
                  <Text style={[
                    styles.chipText,
                    { color: showUrgentOnly ? '#fff' : '#dc2626' },
                  ]}>
                    Urgent ({headerCounts.urgentCount})
                  </Text>
                </GlassChip>
              )}
            </ScrollView>
          </GlassHeader>

          {/* Verse of the Day */}
          <View style={styles.verseCard}>
            <View style={styles.verseHeader}>
              <Text style={styles.verseLabel}>VERSE OF THE DAY</Text>
              <Text style={styles.verseReference}>{getVerseOfDay().reference}</Text>
            </View>
            <Text style={[styles.verseText, { color: colors.stone700 }]}>
              "{getVerseOfDay().text}"
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
                <Text style={styles.emptyEmoji}>{mode === 'REQUEST' ? '🙏' : '✨'}</Text>
                <Text style={[styles.emptyTitle, { color: colors.stone900 }]}>
                  {searchQuery || selectedCategory !== 'all' 
                    ? 'No matching prayers found'
                    : mode === 'REQUEST' 
                      ? 'No prayer requests yet' 
                      : 'No testimonies yet'}
                </Text>
                <Text style={[styles.emptySubtitle, { color: colors.stone500 }]}>
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
                    hasPrayed={prayedIds.has(item.id)}
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
                        <Text style={[styles.mostPrayedTitle, { color: colors.stone900 }]}>Most Prayed</Text>
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
                              { 
                                backgroundColor: colors.glassWhite, 
                                borderColor: colors.glassBorder 
                              }
                            ]}
                            onPress={() => handleOpen(item)}
                            activeOpacity={0.8}
                          >
                            <View style={styles.mostPrayedRank}>
                              <Text style={styles.mostPrayedRankText}>#{index + 1}</Text>
                            </View>
                            <Text 
                              style={[styles.mostPrayedContent, { color: colors.stone800 }]} 
                              numberOfLines={2}
                            >
                              {item.content}
                            </Text>
                            <View style={styles.mostPrayedFooter}>
                              <Text style={styles.mostPrayedPrayers}>
                                🙏 {(item as any).prayers ?? 0}
                              </Text>
                              <Text style={[styles.mostPrayedAuthor, { color: colors.stone400 }]} numberOfLines={1}>
                                {item.userDisplayName}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  ) : null
                }
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
        </RoundedPage>

        {/* === CINEMATIC FAB - Glowing Orb === */}
        <View style={styles.fabContainer}>
          <Animated.View style={[
            styles.fabGlow,
            { transform: [{ scale: fabPulseAnim }] }
          ]} />
          <TouchableOpacity
            style={styles.fab}
            onPress={navigateToCreate}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={mode === 'TESTIMONY' 
                ? ['#22c55e', '#16a34a'] 
                : [colors.amber400, colors.orange500]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.fabGradient}
            >
              <Ionicons name="add" size={32} color="#fff" strokeWidth={2.5} />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </CinematicBackground>
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
    // Glow effect
    
    
    
    
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
  chipText: {
    fontSize: fontSizes.xs,
    fontWeight: '500',
    fontFamily: fonts.body,
  },
  chipTextActive: {
    color: '#fff',
  },
  chipEmoji: {
    fontSize: 14,
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
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 36,
    backgroundColor: 'rgba(245,158,11,0.4)',
  },
  fab: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    ...shadows.fabGlow,
  },
  fabGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    ...shadows.cinematicCard,
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
