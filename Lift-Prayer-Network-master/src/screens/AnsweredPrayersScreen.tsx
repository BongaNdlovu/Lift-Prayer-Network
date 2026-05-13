import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Animated,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  where,
} from 'firebase/firestore';
import { db, firebaseEnabled } from '../services/firebase';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../contexts/ThemeContext';
import { fonts, fontSizes, radius, spacing } from '../theme/colors';
import { LiftScreen, LiftCard } from '../components/LiftLayout';
import { RootStackParamList } from '../navigation/types';
import { Testimony, PRAYER_CATEGORIES, PrayerCategory } from '../types';
import { Confetti } from '../components/Confetti';
import { ANSWERED_LIMIT } from '../config/queryLimits';
import { logFirestoreRead } from '../utils/readBudget';

type TestimonyWithMeta = Testimony & {
  id: string;
};

const TestimonyCard: React.FC<{
  item: TestimonyWithMeta;
  onPress: () => void;
  index: number;
}> = ({ item, onPress, index }) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 8,
        delay: index * 100,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 300,
        delay: index * 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, [index, scaleAnim, opacityAnim]);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDate = (date: any) => {
    if (!date) return '';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <Animated.View
      style={[
        styles.cardContainer,
        {
          transform: [{ scale: scaleAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
        <LiftCard style={styles.card}>
          {/* Celebration Badge */}
          <View style={styles.celebrationBadge}>
            <Text style={styles.celebrationEmoji}>🎉</Text>
            <Text style={styles.celebrationText}>ANSWERED</Text>
          </View>

          {/* User Info */}
          <View style={styles.userRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials(item.userDisplayName || 'A')}</Text>
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{item.userDisplayName || 'Anonymous'}</Text>
              <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
            </View>
          </View>

          {/* Content */}
          <Text style={styles.content} numberOfLines={4}>
            {item.content}
          </Text>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statEmoji}>🙌</Text>
              <Text style={styles.statValue}>{item.likes || 0}</Text>
              <Text style={styles.statLabel}>Amens</Text>
            </View>
            {item.linkedRequestId && (
              <View style={styles.linkedBadge}>
                <Ionicons name="link" size={14} color="#059669" />
                <Text style={styles.linkedText}>From Prayer Request</Text>
              </View>
            )}
          </View>
        </LiftCard>
      </TouchableOpacity>
    </Animated.View>
  );
};

export const AnsweredPrayersScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const [testimonies, setTestimonies] = useState<TestimonyWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [stats, setStats] = useState({ total: 0, thisMonth: 0 });
  const [selectedCategory, setSelectedCategory] = useState<PrayerCategory | 'all'>('all');

  // Filter testimonies by category (using linkedRequestCategory if available)
  const filteredTestimonies = selectedCategory === 'all'
    ? testimonies
    : testimonies.filter(t => (t as any).linkedRequestCategory === selectedCategory);

  const loadTestimonies = useCallback(async () => {
    if (!firebaseEnabled || !db) {
      setLoading(false);
      return;
    }

    try {
      const testimoniesRef = collection(db, 'testimonies');
      const q = query(
        testimoniesRef,
        where('visibility', '==', 'PUBLIC'),
        orderBy('createdAt', 'desc'),
        limit(ANSWERED_LIMIT)
      );

      const snapshot = await getDocs(q);
      logFirestoreRead('answered_prayers', snapshot.size);
      const items: TestimonyWithMeta[] = [];
      let thisMonthCount = 0;
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      snapshot.forEach((doc) => {
        const data = doc.data();

        // Privacy filter
        const isPublic = data.visibility === 'PUBLIC' ||
          (!data.visibility && !data.isPrivate);
        const isOwner = data.ownerUid === user?.uid;

        if (isPublic || isOwner) {
          items.push({
            id: doc.id,
            ...data,
          } as TestimonyWithMeta);

          // Count this month's testimonies
          const createdAt = data.createdAt?.toDate?.();
          if (createdAt && createdAt >= monthStart) {
            thisMonthCount++;
          }
        }
      });

      setTestimonies(items);
      setStats({ total: items.length, thisMonth: thisMonthCount });

      // Show confetti on first load if there are testimonies
      if (items.length > 0 && !refreshing) {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3000);
      }
    } catch (err) {
      console.error('Error loading testimonies:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, refreshing]);

  useEffect(() => {
    loadTestimonies();
  }, [loadTestimonies]);

  const handleTestimonyPress = (item: TestimonyWithMeta) => {
    navigation.navigate('RequestDetail', {
      id: item.id,
      type: 'TESTIMONY',
      item: { ...item, type: 'TESTIMONY' },
    });
  };

  return (
    <LiftScreen scroll>
      {showConfetti && <Confetti active={showConfetti} onComplete={() => setShowConfetti(false)} />}

      {/* === HEADER SECTION === */}
      <View style={styles.headerSection}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.kicker, { color: colors.muted }]}>CELEBRATE</Text>
          <Text style={[styles.heading, { color: colors.text }]}>
            Answered<Text style={styles.headingDot}>.</Text>
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate('CreateTestimony')}
          style={[styles.iconButton, { backgroundColor: colors.accentLight, borderColor: colors.accentDark }]}
        >
          <Ionicons name="add" size={24} color={colors.accentDark} />
        </TouchableOpacity>
      </View>

      {/* === MAIN CONTENT === */}
      <View style={styles.mainContent}>

      {/* Stats Banner */}
      <View style={[styles.statsBanner, { backgroundColor: colors.surface }]}>
        <View style={styles.statBox}>
          <Text style={styles.statBoxValue}>{stats.total}</Text>
          <Text style={[styles.statBoxLabel, { color: colors.muted }]}>Total Testimonies</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statBox}>
          <Text style={styles.statBoxValue}>{stats.thisMonth}</Text>
          <Text style={[styles.statBoxLabel, { color: colors.muted }]}>This Month</Text>
        </View>
      </View>

      {/* Category Filter */}
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

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.success} />
          <Text style={[styles.loadingText, { color: colors.success }]}>Loading testimonies...</Text>
        </View>
      ) : filteredTestimonies.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIcon, { backgroundColor: isDark ? colors.successLight : '#dcfce7' }]}>
            <Text style={styles.emptyEmoji}>🙏</Text>
          </View>
          <Text style={[styles.emptyTitle, { color: isDark ? colors.success : '#065f46' }]}>No Testimonies Yet</Text>
          <Text style={[styles.emptySubtitle, { color: colors.success }]}>
            When prayers are answered, testimonies will appear here to celebrate God&apos;s faithfulness
          </Text>
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => navigation.navigate('CreateTestimony')}
          >
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.createButtonText}>Share a Testimony</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredTestimonies}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <TestimonyCard
              item={item}
              onPress={() => handleTestimonyPress(item)}
              index={index}
            />
          )}
          initialNumToRender={10}
          windowSize={5}
          maxToRenderPerBatch={10}
          updateCellsBatchingPeriod={50}
          removeClippedSubviews={Platform.OS !== 'web'}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                // Haptic feedback on pull-to-refresh
                if (Platform.OS !== 'web') {
                  try {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  } catch {
                    // Haptics not available
                  }
                }
                setRefreshing(true);
                loadTestimonies();
              }}
              tintColor={colors.success}
            />
          }
          ListFooterComponent={
            <TouchableOpacity
              style={[styles.shareTestimonyButton, { backgroundColor: colors.success }]}
              onPress={() => navigation.navigate('CreateTestimony')}
            >
              <Ionicons name="sparkles" size={20} color="#fff" />
              <Text style={styles.shareTestimonyText}>Share Your Testimony</Text>
            </TouchableOpacity>
          }
        />
      )}
      </View>
    </LiftScreen>
  );
};

const styles = StyleSheet.create({
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Header styles
  headerSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  kicker: {
    fontSize: fontSizes.xs - 3,
    fontWeight: '600',
    fontFamily: fonts.bodyMedium,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 2,
    opacity: 0.8,
  },
  heading: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.xxl,
    fontWeight: '600',
    letterSpacing: -0.5,
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  headerEmoji: {
    fontSize: 32,
    marginBottom: spacing.xs,
  },
  headerTitle: {
    fontFamily: fonts.heading,
    fontSize: 24,
    fontWeight: '700',
    color: '#065f46',
  },
  headerSubtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: '#059669',
    marginTop: 2,
  },
  statsBanner: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    padding: spacing.sm,
    elevation: 0,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statBoxValue: {
    fontSize: fontSizes.xl,
    fontWeight: '700',
    fontFamily: fonts.heading,
    color: '#10b981',
  },
  statBoxLabel: {
    fontSize: fontSizes.xs - 1,
    fontFamily: fonts.body,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    marginHorizontal: spacing.md,
  },
  categoryScroll: {
    marginBottom: spacing.sm,
    marginHorizontal: spacing.md,
    minHeight: 36,
    maxHeight: 36,
  },
  categoryContainer: {
    gap: spacing.xs,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
    gap: 3,
    minHeight: 28,
  },
  categoryChipActive: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  categoryEmoji: {
    fontSize: 11,
  },
  categoryText: {
    fontSize: fontSizes.xs,
    fontWeight: '500',
    fontFamily: fonts.body,
  },
  categoryTextActive: {
    color: '#fff',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.sm,
    fontSize: fontSizes.sm,
    fontFamily: fonts.body,
    color: '#059669',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyEmoji: {
    fontSize: 36,
  },
  emptyTitle: {
    fontSize: fontSizes.xl,
    fontWeight: '600',
    fontFamily: fonts.heading,
    color: '#065f46',
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.body,
    color: '#059669',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10b981',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    gap: spacing.xs,
  },
  createButtonText: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
    fontFamily: fonts.bodyMedium,
    color: '#fff',
  },
  list: {
    padding: spacing.md,
    paddingBottom: 100,
  },
  cardContainer: {
    marginBottom: spacing.sm,
  },
  card: {
    padding: spacing.md,
    position: 'relative',
  },
  celebrationBadge: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10b981',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.full,
    gap: 3,
  },
  celebrationEmoji: {
    fontSize: 10,
  },
  celebrationText: {
    fontSize: fontSizes.xs - 3,
    fontWeight: '700',
    fontFamily: fonts.bodyBold,
    color: '#fff',
    letterSpacing: 0.5,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
    fontFamily: fonts.bodyMedium,
    color: '#fff',
  },
  userInfo: {
    marginLeft: spacing.sm,
  },
  userName: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
    fontFamily: fonts.bodyMedium,
    color: '#065f46',
  },
  dateText: {
    fontSize: fontSizes.xs - 1,
    fontFamily: fonts.body,
    color: '#059669',
    marginTop: 1,
  },
  content: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.heading,
    color: '#065f46',
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  statEmoji: {
    fontSize: 14,
  },
  statValue: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
    fontFamily: fonts.bodyMedium,
    color: '#065f46',
  },
  statLabel: {
    fontSize: fontSizes.xs,
    fontFamily: fonts.body,
    color: '#059669',
  },
  linkedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.full,
    gap: 3,
  },
  linkedText: {
    fontSize: fontSizes.xs - 1,
    fontWeight: '500',
    fontFamily: fonts.body,
    color: '#059669',
  },
  shareTestimonyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    gap: spacing.xs,
  },
  shareTestimonyText: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
    fontFamily: fonts.bodyMedium,
    color: '#fff',
  },
});

export default AnsweredPrayersScreen;
