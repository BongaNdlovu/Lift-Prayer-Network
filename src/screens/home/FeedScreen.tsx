import React, { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Platform, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useNetInfo } from '@react-native-community/netinfo';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import { useFeed } from '../../hooks/useFeed';
import { logPrayer, pinRequest, unpinRequest } from '../../services/prayers';
import { useAuth } from '../../hooks/useAuth';
import { FeedCard } from '../../components/FeedCard';
import { SkeletonCard } from '../../components/SkeletonCard';
import { Confetti } from '../../components/Confetti';
import { queuePendingPrayer } from '../../services/offlineCache';
import { subscribeToUserGroups } from '../../services/groups';
import { palette, radius, spacing } from '../../theme/colors';
import type { FeedItem, PrayerCategory } from '../../types';
import { PRAYER_CATEGORIES } from '../../types';
import type { RootStackParamList } from '../../navigation/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

export const FeedScreen: React.FC = () => {
  const [mode, setMode] = useState<'REQUEST' | 'TESTIMONY'>('REQUEST');
  const { user } = useAuth();
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
  
  const { items, loading, refresh } = useFeed(mode, user?.uid, userGroupIds);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<PrayerCategory | 'all'>('all');
  const [showUrgentOnly, setShowUrgentOnly] = useState(false);
  const netInfo = useNetInfo();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

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
        } else {
          Alert.alert('Unable to pray', result.error || 'Please try again.');
        }
      } else {
        // Success! Provide haptic feedback
        if (Platform.OS !== 'web') {
          try {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch (e) {}
        }
        
        // If self-prayer, send a local notification as confirmation
        if (result.isSelfPrayer && Platform.OS !== 'web') {
          try {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: '🙏 Prayer Recorded',
                body: 'Your prayer for your own request has been recorded. Keep praying!',
                sound: true,
              },
              trigger: null, // Show immediately
            });
          } catch (e) {
            console.warn('[FeedScreen] Could not send self-prayer notification:', e);
          }
        }
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
          } catch (e) {}
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

  return (
    <LinearGradient colors={['#fefce8', '#f4f4f5']} style={{ flex: 1 }}>
      <Confetti active={showConfetti} onComplete={() => setShowConfetti(false)} />
      <SafeAreaView style={styles.container}>
        {offline && (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineText}>Offline — viewing cached data</Text>
          </View>
        )}
        <View style={styles.topRow}>
          <View style={styles.topRowLeft}>
            <Text style={styles.kicker}>Live Network</Text>
            <View style={styles.headingRow}>
              <Text style={styles.heading}>Lift</Text>
              {/* Discreet donate shortcut */}
              <TouchableOpacity 
                style={styles.donateHint} 
                onPress={() => navigation.navigate('Donation')}
                activeOpacity={0.7}
              >
                <Ionicons name="heart" size={14} color="#ec4899" />
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

        <View style={styles.modeSwitch}>
          {(['REQUEST', 'TESTIMONY'] as const).map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.modeButton, mode === m && styles.modeButtonActive]}
              onPress={() => setMode(m)}
            >
              <Text style={[styles.modeText, mode === m && styles.modeTextActive]}>
                {m === 'REQUEST' ? 'Transmission' : 'Verification'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color={palette.muted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search prayers or people..."
            placeholderTextColor={palette.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
              <Ionicons name="close-circle" size={18} color={palette.muted} />
            </TouchableOpacity>
          )}
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
              style={[styles.categoryChip, selectedCategory === 'all' && styles.categoryChipActive]}
              onPress={() => setSelectedCategory('all')}
            >
              <Text style={[styles.categoryText, selectedCategory === 'all' && styles.categoryTextActive]}>
                All
              </Text>
            </TouchableOpacity>
            {PRAYER_CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[styles.categoryChip, selectedCategory === cat.id && styles.categoryChipActive]}
                onPress={() => setSelectedCategory(selectedCategory === cat.id ? 'all' : cat.id)}
              >
                <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
                <Text style={[styles.categoryText, selectedCategory === cat.id && styles.categoryTextActive]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

          {loading ? (
            <View style={styles.loading}>
              {[...Array(4)].map((_, idx) => (
                <SkeletonCard key={idx} />
              ))}
            </View>
          ) : (
            <FlatList
              data={filteredItems}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <FeedCard
                  item={item}
                  onPray={handlePray}
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
                  titleColor={palette.muted}
                  progressBackgroundColor="#fef3c7"
                />
              }
            />
          )}

        {/* Floating Action Button */}
        <TouchableOpacity
          style={[styles.fab, mode === 'TESTIMONY' && styles.fabTestimony]}
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
    color: palette.muted,
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
    color: palette.text,
    letterSpacing: -0.5,
  },
  donateHint: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fce7f3',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
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
    backgroundColor: '#fff',
    shadowColor: palette.shadow,
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 2,
  },
  modeText: {
    fontSize: 15,
    fontWeight: '700',
    color: palette.muted,
  },
  modeTextActive: {
    color: palette.text,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: palette.border,
    minHeight: 36,
  },
  searchIcon: {
    marginRight: spacing.xs,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.xs,
    fontSize: 13,
    color: palette.text,
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
    backgroundColor: '#fff',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: palette.border,
    gap: 3,
    minHeight: 28,
  },
  categoryChipActive: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  categoryEmoji: {
    fontSize: 12,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '600',
    color: palette.muted,
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
    backgroundColor: palette.accent,
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
