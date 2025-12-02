import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
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
import { palette, radius, spacing } from '../theme/colors';
import { RootStackParamList } from '../navigation/types';
import { Testimony } from '../types';
import { Confetti } from '../components/Confetti';


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
        <LinearGradient
          colors={['#f0fdf4', '#dcfce7', '#bbf7d0']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.card}
        >
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

          {/* Decorative Elements */}
          <View style={styles.sparkle1}>
            <Text style={styles.sparkleEmoji}>✨</Text>
          </View>
          <View style={styles.sparkle2}>
            <Text style={styles.sparkleEmoji}>⭐</Text>
          </View>
        </LinearGradient>
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

  const loadTestimonies = useCallback(async () => {
    if (!firebaseEnabled || !db) {
      setLoading(false);
      return;
    }

    try {
      const testimoniesRef = collection(db, 'testimonies');
      const q = query(
        testimoniesRef,
        orderBy('createdAt', 'desc'),
        limit(50)
      );

      const snapshot = await getDocs(q);
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
      item,
    });
  };

  // Dynamic gradient colors for header
  const headerGradient = isDark 
    ? [colors.successLight, colors.surface] as const
    : ['#f0fdf4', '#dcfce7'] as const;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {showConfetti && <Confetti active={showConfetti} onComplete={() => setShowConfetti(false)} />}

      {/* Header */}
      <LinearGradient
        colors={headerGradient}
        style={styles.header}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backButton, { backgroundColor: isDark ? colors.surface : 'rgba(255,255,255,0.8)' }]}>
          <Ionicons name="arrow-back" size={24} color={colors.success} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerEmoji}>🎉</Text>
          <Text style={[styles.headerTitle, { color: isDark ? colors.success : '#065f46' }]}>Answered Prayers</Text>
          <Text style={[styles.headerSubtitle, { color: colors.success }]}>Celebrate God&apos;s faithfulness</Text>
        </View>
        <View style={{ width: 40 }} />
      </LinearGradient>

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

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.success} />
          <Text style={[styles.loadingText, { color: colors.success }]}>Loading testimonies...</Text>
        </View>
      ) : testimonies.length === 0 ? (
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
          data={testimonies}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <TestimonyCard
              item={item}
              onPress={() => handleTestimonyPress(item)}
              index={index}
            />
          )}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadTestimonies();
              }}
              tintColor={colors.success}
            />
          }
          ListFooterComponent={
            <TouchableOpacity
              style={styles.shareTestimonyButton}
              onPress={() => navigation.navigate('CreateTestimony')}
            >
              <LinearGradient
                colors={['#10b981', '#059669']}
                style={styles.shareTestimonyGradient}
              >
                <Ionicons name="sparkles" size={20} color="#fff" />
                <Text style={styles.shareTestimonyText}>Share Your Testimony</Text>
              </LinearGradient>
            </TouchableOpacity>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0fdf4',
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
    fontSize: 24,
    fontWeight: '900',
    color: '#065f46',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#059669',
    marginTop: 2,
  },
  statsBanner: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radius.lg,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statBoxValue: {
    fontSize: 28,
    fontWeight: '900',
    color: '#10b981',
  },
  statBoxLabel: {
    fontSize: 12,
    color: palette.muted,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: palette.border,
    marginHorizontal: spacing.md,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: 14,
    color: '#059669',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyEmoji: {
    fontSize: 48,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#065f46',
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#059669',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10b981',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.xs,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  list: {
    padding: spacing.md,
    paddingBottom: 100,
  },
  cardContainer: {
    marginBottom: spacing.md,
  },
  card: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: '#86efac',
    position: 'relative',
    overflow: 'hidden',
  },
  celebrationBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10b981',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    gap: 4,
  },
  celebrationEmoji: {
    fontSize: 12,
  },
  celebrationText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  userInfo: {
    marginLeft: spacing.md,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#065f46',
  },
  dateText: {
    fontSize: 12,
    color: '#059669',
    marginTop: 2,
  },
  content: {
    fontSize: 15,
    color: '#065f46',
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statEmoji: {
    fontSize: 16,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#065f46',
  },
  statLabel: {
    fontSize: 12,
    color: '#059669',
  },
  linkedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    gap: 4,
  },
  linkedText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#059669',
  },
  sparkle1: {
    position: 'absolute',
    top: 60,
    right: 20,
    opacity: 0.3,
  },
  sparkle2: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    opacity: 0.3,
  },
  sparkleEmoji: {
    fontSize: 20,
  },
  shareTestimonyButton: {
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  shareTestimonyGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.xs,
  },
  shareTestimonyText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});

export default AnsweredPrayersScreen;
