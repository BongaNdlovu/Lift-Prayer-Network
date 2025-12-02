import React, { useState, useCallback } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Keyboard,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
} from 'firebase/firestore';
import { db, firebaseEnabled } from '../services/firebase';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../contexts/ThemeContext';
import { logPrayer, logReaction, likeTestimony } from '../services/prayers';
import type { ReactionType } from '../services/prayers';
import { FeedCard } from '../components/FeedCard';
import { palette, radius, spacing } from '../theme/colors';
import { RootStackParamList } from '../navigation/types';
import { PRAYER_CATEGORIES, type PrayerCategory, type FeedItem } from '../types';

type SearchFilter = {
  category: PrayerCategory | 'all';
  type: 'REQUEST' | 'TESTIMONY' | 'all';
  timeRange: 'day' | 'week' | 'month' | 'all';
};

const TIME_RANGES = [
  { id: 'day', label: 'Today' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'all', label: 'All Time' },
];

export const SearchScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<SearchFilter>({
    category: 'all',
    type: 'all',
    timeRange: 'all',
  });
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());

  // Handler for pray button
  const handlePray = async (id: string) => {
    if (!user) {
      Alert.alert('Sign in required', 'Please sign in to pray.');
      return;
    }
    const target = results.find((i) => i.id === id);
    if (!target) return;

    setBusyIds((prev) => new Set(prev).add(id));
    try {
      const result = await logPrayer(
        user.uid,
        id,
        target.ownerUid,
        target.content?.slice(0, 120) || '',
        user.displayName || undefined
      );
      if (result.success && Platform.OS !== 'web') {
        try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
      }
    } catch (err) {
      console.error('[SearchScreen] Prayer error:', err);
    } finally {
      setBusyIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }
  };

  // Handler for amen/like button (testimonies)
  const handleLike = async (id: string) => {
    if (!user) {
      Alert.alert('Sign in required', 'Please sign in to react.');
      return;
    }
    setBusyIds((prev) => new Set(prev).add(id));
    try {
      const result = await likeTestimony(user.uid, id);
      if (result.success && Platform.OS !== 'web') {
        try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
      }
    } catch (err) {
      console.error('[SearchScreen] Like error:', err);
    } finally {
      setBusyIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }
  };

  // Handler for reactions
  const handleReact = async (id: string, reactionType: ReactionType) => {
    if (!user) return;
    const target = results.find((i) => i.id === id);
    if (!target) return;
    try {
      await logReaction(user.uid, id, target.type, reactionType);
    } catch (err) {
      console.error('[SearchScreen] Reaction error:', err);
    }
  };

  const getTimeRangeDate = (range: string): Date | null => {
    const now = new Date();
    switch (range) {
      case 'day':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case 'week':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case 'month':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      default:
        return null;
    }
  };

  const performSearch = useCallback(async () => {
    if (!firebaseEnabled || !db) return;
    
    Keyboard.dismiss();
    setLoading(true);
    setHasSearched(true);

    try {
      const allResults: FeedItem[] = [];
      const searchLower = searchQuery.toLowerCase().trim();

      // Search requests
      if (filters.type === 'all' || filters.type === 'REQUEST') {
        const requestsRef = collection(db, 'requests');
        let requestQuery = query(
          requestsRef,
          orderBy('createdAt', 'desc'),
          limit(100)
        );

        const requestSnapshot = await getDocs(requestQuery);
        requestSnapshot.forEach((doc) => {
          const data = doc.data();
          const content = (data.content || '').toLowerCase();
          const userName = (data.userDisplayName || '').toLowerCase();
          
          // Text search
          const matchesText = !searchLower || 
            content.includes(searchLower) || 
            userName.includes(searchLower);
          
          // Category filter
          const matchesCategory = filters.category === 'all' || 
            data.category === filters.category;
          
          // Time filter
          const timeRangeDate = getTimeRangeDate(filters.timeRange);
          const createdAt = data.createdAt?.toDate?.() || new Date();
          const matchesTime = !timeRangeDate || createdAt >= timeRangeDate;
          
          // Privacy filter
          const isPublic = data.visibility === 'PUBLIC' || 
            (!data.visibility && !data.isPrivate);
          const isOwner = data.ownerUid === user?.uid;
          
          if (matchesText && matchesCategory && matchesTime && (isPublic || isOwner)) {
            allResults.push({
              id: doc.id,
              type: 'REQUEST',
              ...data,
            } as FeedItem);
          }
        });
      }

      // Search testimonies
      if (filters.type === 'all' || filters.type === 'TESTIMONY') {
        const testimoniesRef = collection(db, 'testimonies');
        let testimonyQuery = query(
          testimoniesRef,
          orderBy('createdAt', 'desc'),
          limit(100)
        );

        const testimonySnapshot = await getDocs(testimonyQuery);
        testimonySnapshot.forEach((doc) => {
          const data = doc.data();
          const content = (data.content || '').toLowerCase();
          const userName = (data.userDisplayName || '').toLowerCase();
          
          // Text search
          const matchesText = !searchLower || 
            content.includes(searchLower) || 
            userName.includes(searchLower);
          
          // Time filter
          const timeRangeDate = getTimeRangeDate(filters.timeRange);
          const createdAt = data.createdAt?.toDate?.() || new Date();
          const matchesTime = !timeRangeDate || createdAt >= timeRangeDate;
          
          // Privacy filter
          const isPublic = data.visibility === 'PUBLIC' || 
            (!data.visibility && !data.isPrivate);
          const isOwner = data.ownerUid === user?.uid;
          
          if (matchesText && matchesTime && (isPublic || isOwner)) {
            allResults.push({
              id: doc.id,
              type: 'TESTIMONY',
              ...data,
            } as FeedItem);
          }
        });
      }

      // Sort by date
      allResults.sort((a, b) => {
        const aTime = (a as any).createdAt?.toDate?.()?.getTime() || 0;
        const bTime = (b as any).createdAt?.toDate?.()?.getTime() || 0;
        return bTime - aTime;
      });

      setResults(allResults.slice(0, 50));
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, filters, user]);

  const handleItemPress = (item: FeedItem) => {
    navigation.navigate('RequestDetail', {
      id: item.id,
      type: item.type,
      item,
    });
  };

  const clearFilters = () => {
    setFilters({
      category: 'all',
      type: 'all',
      timeRange: 'all',
    });
  };

  const activeFilterCount = 
    (filters.category !== 'all' ? 1 : 0) +
    (filters.type !== 'all' ? 1 : 0) +
    (filters.timeRange !== 'all' ? 1 : 0);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={palette.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Search</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={palette.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search prayers, testimonies, people..."
            placeholderTextColor={palette.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={performSearch}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={palette.muted} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[styles.filterButton, activeFilterCount > 0 && styles.filterButtonActive]}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Ionicons 
            name="options-outline" 
            size={20} 
            color={activeFilterCount > 0 ? '#fff' : palette.text} 
          />
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Filters Panel */}
      {showFilters && (
        <View style={styles.filtersPanel}>
          <View style={styles.filterHeader}>
            <Text style={styles.filterTitle}>Filters</Text>
            {activeFilterCount > 0 && (
              <TouchableOpacity onPress={clearFilters}>
                <Text style={styles.clearFilters}>Clear all</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Type Filter */}
          <Text style={styles.filterLabel}>Type</Text>
          <View style={styles.filterRow}>
            {[
              { id: 'all', label: 'All' },
              { id: 'REQUEST', label: 'Requests' },
              { id: 'TESTIMONY', label: 'Testimonies' },
            ].map((option) => (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.filterChip,
                  filters.type === option.id && styles.filterChipActive,
                ]}
                onPress={() => setFilters({ ...filters, type: option.id as any })}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    filters.type === option.id && styles.filterChipTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Category Filter */}
          <Text style={styles.filterLabel}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.filterRow}>
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  filters.category === 'all' && styles.filterChipActive,
                ]}
                onPress={() => setFilters({ ...filters, category: 'all' })}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    filters.category === 'all' && styles.filterChipTextActive,
                  ]}
                >
                  All
                </Text>
              </TouchableOpacity>
              {PRAYER_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.filterChip,
                    filters.category === cat.id && styles.filterChipActive,
                  ]}
                  onPress={() => setFilters({ ...filters, category: cat.id })}
                >
                  <Text style={styles.filterChipEmoji}>{cat.emoji}</Text>
                  <Text
                    style={[
                      styles.filterChipText,
                      filters.category === cat.id && styles.filterChipTextActive,
                    ]}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Time Range Filter */}
          <Text style={styles.filterLabel}>Time Range</Text>
          <View style={styles.filterRow}>
            {TIME_RANGES.map((range) => (
              <TouchableOpacity
                key={range.id}
                style={[
                  styles.filterChip,
                  filters.timeRange === range.id && styles.filterChipActive,
                ]}
                onPress={() => setFilters({ ...filters, timeRange: range.id as any })}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    filters.timeRange === range.id && styles.filterChipTextActive,
                  ]}
                >
                  {range.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Search Button */}
          <TouchableOpacity style={styles.searchButton} onPress={performSearch}>
            <Ionicons name="search" size={18} color="#fff" />
            <Text style={styles.searchButtonText}>Search</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Results */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={palette.accent} />
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      ) : !hasSearched ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Ionicons name="search" size={48} color={palette.muted} />
          </View>
          <Text style={styles.emptyTitle}>Search Prayers</Text>
          <Text style={styles.emptySubtitle}>
            Find prayer requests and testimonies by keyword, category, or person
          </Text>
        </View>
      ) : results.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Ionicons name="document-text-outline" size={48} color={palette.muted} />
          </View>
          <Text style={styles.emptyTitle}>No results found</Text>
          <Text style={styles.emptySubtitle}>
            Try different keywords or adjust your filters
          </Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <FeedCard
              item={item}
              onPray={handlePray}
              onLike={handleLike}
              onReact={handleReact}
              disabled={busyIds.has(item.id)}
              onPress={handleItemPress}
              currentUserId={user?.uid}
              currentUserEmail={user?.email}
            />
          )}
          contentContainerStyle={styles.resultsList}
          ListHeaderComponent={
            <Text style={styles.resultsCount}>
              {results.length} result{results.length !== 1 ? 's' : ''}
            </Text>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.text,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: palette.border,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: palette.text,
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.border,
  },
  filterButtonActive: {
    backgroundColor: palette.accentDark,
    borderColor: palette.accentDark,
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  filtersPanel: {
    backgroundColor: '#fff',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  filterTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.text,
  },
  clearFilters: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.accentDark,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.muted,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: '#f1f5f9',
    gap: 4,
  },
  filterChipActive: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  filterChipEmoji: {
    fontSize: 14,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: palette.muted,
  },
  filterChipTextActive: {
    color: '#92400e',
    fontWeight: '600',
  },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.accentDark,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  searchButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: 14,
    color: palette.muted,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: palette.text,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    fontSize: 14,
    color: palette.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
  resultsList: {
    padding: spacing.md,
  },
  resultsCount: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.muted,
    marginBottom: spacing.md,
  },
});

export default SearchScreen;
