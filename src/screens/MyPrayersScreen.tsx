import React, { useEffect, useState, useCallback } from 'react';
import {
  SafeAreaView,
  FlatList,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db, firebaseEnabled } from '../services/firebase';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../contexts/ThemeContext';
import { logReaction, likeTestimony } from '../services/prayers';
import type { ReactionType } from '../services/prayers';
import { FeedCard } from '../components/FeedCard';
import { SkeletonCard } from '../components/SkeletonCard';
import { palette, radius, spacing } from '../theme/colors';
import { CinematicBackground, RoundedPage } from '../components/CinematicBackground';
import { GlassIconButton } from '../components/GlassCard';
import type { FeedItem, LiftRequest } from '../types';
import type { RootStackParamList } from '../navigation/types';

const FEED_ITEM_HEIGHT = 260;

type FilterType = 'all' | 'requests' | 'testimonies';
type StatusFilter = 'all' | 'PENDING' | 'ACTIVE' | 'RESOLVED';

export const MyPrayersScreen: React.FC = () => {
  const { user } = useAuth();
  const { colors } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const loadUserPrayers = useCallback(() => {
    if (!user || !firebaseEnabled || !db) {
      setLoading(false);
      return () => {};
    }

    const unsubscribes: Unsubscribe[] = [];

    // Load user's requests
    const requestsQuery = query(
      collection(db, 'requests'),
      where('ownerUid', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const requestsUnsub = onSnapshot(
      requestsQuery,
      (snapshot) => {
        const requests = snapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
          type: 'REQUEST' as const,
        })) as FeedItem[];
        
        // Load testimonies
        const testimoniesQuery = query(
          collection(db!, 'testimonies'),
          where('ownerUid', '==', user.uid),
          orderBy('createdAt', 'desc')
        );

        const testimoniesUnsub = onSnapshot(
          testimoniesQuery,
          (testimonySnapshot) => {
            const testimonies = testimonySnapshot.docs.map((doc) => ({
              ...doc.data(),
              id: doc.id,
              type: 'TESTIMONY' as const,
            })) as FeedItem[];

            // Combine and sort by date
            const combined = [...requests, ...testimonies].sort((a, b) => {
              const aTime = (a as any).createdAt?.toDate?.()?.getTime() || 0;
              const bTime = (b as any).createdAt?.toDate?.()?.getTime() || 0;
              return bTime - aTime;
            });

            setItems(combined);
            setLoading(false);
          },
          (err) => {
            console.error('[MyPrayers] Testimonies error:', err);
            setItems(requests);
            setLoading(false);
          }
        );

        unsubscribes.push(testimoniesUnsub);
      },
      (err) => {
        console.error('[MyPrayers] Requests error:', err);
        setLoading(false);
      }
    );

    unsubscribes.push(requestsUnsub);

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [user]);

  useEffect(() => {
    const cleanup = loadUserPrayers();
    return cleanup;
  }, [loadUserPrayers]);

  const filteredItems = React.useMemo(() => {
    let result = items;

    // Filter by type
    if (filter === 'requests') {
      result = result.filter((item) => item.type === 'REQUEST');
    } else if (filter === 'testimonies') {
      result = result.filter((item) => item.type === 'TESTIMONY');
    }

    // Filter by status (only for requests)
    if (statusFilter !== 'all') {
      result = result.filter(
        (item) => item.type !== 'REQUEST' || (item as LiftRequest).status === statusFilter
      );
    }

    return result;
  }, [items, filter, statusFilter]);

  const stats = React.useMemo(() => {
    const requests = items.filter((i) => i.type === 'REQUEST') as LiftRequest[];
    const testimonies = items.filter((i) => i.type === 'TESTIMONY');
    const pendingCount = requests.filter((r) => r.status === 'PENDING').length;
    const activeCount = requests.filter((r) => r.status === 'ACTIVE').length;
    const resolvedCount = requests.filter((r) => r.status === 'RESOLVED').length;
    const totalPrayers = requests.reduce((sum, r) => sum + (r.prayers || 0), 0);

    return {
      total: items.length,
      requests: requests.length,
      testimonies: testimonies.length,
      pending: pendingCount,
      active: activeCount,
      resolved: resolvedCount,
      totalPrayers,
    };
  }, [items]);

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
    // The onSnapshot will automatically update
    setTimeout(() => setRefreshing(false), 800);
  };

  const handleOpen = (item: FeedItem) => {
    navigation.navigate('RequestDetail', { id: item.id, type: item.type, item });
  };

  const handleEdit = (item: FeedItem) => {
    navigation.navigate('EditRequest', { id: item.id, type: item.type, item });
  };

  const handleDelete = () => {
    // Data will refresh automatically via onSnapshot
  };

  const handlePray = () => {
    // Users typically don't pray for their own requests
    Alert.alert('Info', 'This is your own prayer request.');
  };

  // Handler for amen/like button (testimonies)
  const handleLike = async (id: string) => {
    if (!user) return;
    try {
      await likeTestimony(user.uid, id);
      if (Platform.OS !== 'web') {
        try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
      }
    } catch (err) {
      console.error('[MyPrayers] Like error:', err);
    }
  };

  // Handler for reactions
  const handleReact = async (id: string, reactionType: ReactionType) => {
    if (!user) return;
    const target = items.find((i) => i.id === id);
    if (!target) return;
    try {
      await logReaction(user.uid, id, target.type, reactionType);
    } catch (err) {
      console.error('[MyPrayers] Reaction error:', err);
    }
  };

  return (
    <CinematicBackground useOuterBackground>
      <SafeAreaView style={styles.container}>
        {/* === HEADER SECTION === */}
        <View style={styles.headerSection}>
          <GlassIconButton onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color={colors.stone700} />
          </GlassIconButton>
          <View style={styles.headerCenter}>
            <Text style={[styles.kicker, { color: colors.stone500 }]}>YOUR CONTENT</Text>
            <Text style={styles.heading}>
              My Prayers<Text style={styles.headingDot}>.</Text>
            </Text>
          </View>
          <GlassIconButton
            onPress={() => navigation.navigate('CreateRequest')}
            style={{ backgroundColor: colors.amber100, borderColor: colors.amber200 }}
          >
            <Ionicons name="add" size={24} color={colors.amber700} />
          </GlassIconButton>
        </View>

        {/* === MAIN CONTENT === */}
        <RoundedPage style={styles.mainContent}>

        {/* Stats Row */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={styles.statsScroll}
          contentContainerStyle={styles.statsRow}
        >
          <View style={styles.statPill}>
            <Text style={styles.statNumber}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={[styles.statPill, styles.statPillPending]}>
            <Text style={[styles.statNumber, styles.statNumberPending]}>{stats.pending}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={[styles.statPill, styles.statPillActive]}>
            <Text style={[styles.statNumber, styles.statNumberActive]}>{stats.active}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
          <View style={[styles.statPill, styles.statPillResolved]}>
            <Text style={[styles.statNumber, styles.statNumberResolved]}>{stats.resolved}</Text>
            <Text style={styles.statLabel}>Resolved</Text>
          </View>
        </ScrollView>

        {/* Filter Tabs */}
        <View style={styles.filterRow}>
          <View style={styles.filterGroup}>
            {(['all', 'requests', 'testimonies'] as FilterType[]).map((f) => (
              <TouchableOpacity
                key={f}
                style={[styles.filterChip, filter === f && styles.filterChipActive]}
                onPress={() => setFilter(f)}
              >
                <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                  {f === 'all' ? 'All' : f === 'requests' ? 'Requests' : 'Testimonies'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Status Filter (for requests) */}
        {(filter === 'all' || filter === 'requests') && (
          <View style={styles.statusFilterRow}>
            {(['all', 'PENDING', 'ACTIVE', 'RESOLVED'] as StatusFilter[]).map((s) => (
              <TouchableOpacity
                key={s}
                style={[
                  styles.statusChip,
                  statusFilter === s && styles.statusChipActive,
                  s === 'PENDING' && statusFilter === s && { backgroundColor: '#fecaca' },
                  s === 'ACTIVE' && statusFilter === s && { backgroundColor: '#fde68a' },
                  s === 'RESOLVED' && statusFilter === s && { backgroundColor: '#bbf7d0' },
                ]}
                onPress={() => setStatusFilter(s)}
              >
                <Text
                  style={[
                    styles.statusChipText,
                    statusFilter === s && styles.statusChipTextActive,
                  ]}
                >
                  {s === 'all' ? 'All Status' : s}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Content */}
        {loading ? (
          <View style={styles.loadingContainer}>
            {[...Array(3)].map((_, idx) => (
              <SkeletonCard key={idx} />
            ))}
          </View>
        ) : filteredItems.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={64} color={palette.muted} />
            <Text style={styles.emptyTitle}>No prayers yet</Text>
            <Text style={styles.emptySubtitle}>
              {filter === 'all'
                ? 'Start by creating a prayer request'
                : filter === 'requests'
                ? 'You haven\'t created any requests'
                : 'You haven\'t shared any testimonies'}
            </Text>
            <TouchableOpacity
              style={styles.createButton}
              onPress={() => navigation.navigate('CreateRequest')}
            >
              <Ionicons name="add" size={20} color="#1f2937" />
              <Text style={styles.createButtonText}>Create Request</Text>
            </TouchableOpacity>
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
                onPress={handleOpen}
                onEdit={handleEdit}
                onDelete={handleDelete}
                currentUserId={user?.uid}
                currentUserEmail={user?.email}
              />
            )}
            initialNumToRender={10}
            windowSize={5}
            maxToRenderPerBatch={10}
            updateCellsBatchingPeriod={50}
            removeClippedSubviews={Platform.OS !== 'web'}
            getItemLayout={(_, index) => ({
              length: FEED_ITEM_HEIGHT,
              offset: FEED_ITEM_HEIGHT * index,
              index,
            })}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['#f59e0b']}
                tintColor="#f59e0b"
              />
            }
          />
        )}
        </RoundedPage>
      </SafeAreaView>
    </CinematicBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  
  // Header styles
  headerSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    zIndex: 20,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  kicker: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
    opacity: 0.8,
  },
  heading: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontSize: 32,
    fontWeight: '500',
    letterSpacing: -1,
    lineHeight: 36,
    color: '#1c1917',
  },
  headingDot: {
    color: '#f59e0b',
  },
  
  // Content styles
  mainContent: {
    flex: 1,
    zIndex: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subheading: {
    fontSize: 14,
    color: palette.muted,
    marginTop: 4,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsScroll: {
    marginBottom: spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  statPill: {
    backgroundColor: '#fff',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.border,
    minWidth: 72,
  },
  statPillPending: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  statPillActive: {
    backgroundColor: '#fef3c7',
    borderColor: '#fde68a',
  },
  statPillResolved: {
    backgroundColor: '#dcfce7',
    borderColor: '#bbf7d0',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: palette.text,
  },
  statNumberPending: {
    color: '#dc2626',
  },
  statNumberActive: {
    color: '#d97706',
  },
  statNumberResolved: {
    color: '#16a34a',
  },
  statLabel: {
    fontSize: 10,
    color: palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
    fontWeight: '600',
  },
  filterRow: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  filterGroup: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: radius.md,
    padding: 5,
  },
  filterChip: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: radius.md,
  },
  filterChipActive: {
    backgroundColor: '#fff',
    
    
    
    
    elevation: 2,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.muted,
  },
  filterTextActive: {
    color: palette.text,
    fontWeight: '700',
  },
  statusFilterRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  statusChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: 'transparent',
    minHeight: 36,
    justifyContent: 'center',
  },
  statusChipActive: {
    borderColor: palette.border,
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusChipTextActive: {
    color: '#1f2937',
  },
  loadingContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: palette.text,
    marginTop: spacing.lg,
  },
  emptySubtitle: {
    fontSize: 15,
    color: palette.muted,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 22,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: palette.accent,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    marginTop: spacing.xl,
    minHeight: 48,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
});

