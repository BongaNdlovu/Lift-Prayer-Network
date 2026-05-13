import React, { useEffect, useState, useCallback } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
  ActivityIndicator,
  Alert,
  Share,
  ActionSheetIOS,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../contexts/ThemeContext';
import { radius, spacing } from '../theme/colors';
import { LiftScreen } from '../components/LiftLayout';
import { HapticPatterns } from '../utils/haptics';
import {
  StudyGuide,
  UserStats,
  getStudyGuides,
  getUserStats,
} from '../services/studyGuides';
import { RootStackParamList } from '../navigation/types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Tab options
type TabOption = 'Current' | 'Archive' | 'Saved';

const EMPTY_USER_STATS: UserStats = {
  currentStreak: 0,
  longestStreak: 0,
  lessonsCompleted: 0,
  guidesCompleted: 0,
  savedLessons: [],
};

export const DevotionsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();
  const { colors } = useTheme();
  
  const [guides, setGuides] = useState<StudyGuide[]>([]);
  const [stats, setStats] = useState<UserStats>(EMPTY_USER_STATS);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabOption>('Current');
  
  // Local state for likes and bookmarks (persisted in stats.savedLessons for bookmarks)
  const [likedGuides, setLikedGuides] = useState<Set<string>>(new Set());
  const [bookmarkedGuides, setBookmarkedGuides] = useState<Set<string>>(new Set());
  // Track like counts per guide (starts at 0, increments/decrements with user action)
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    let mounted = true;

    getStudyGuides().then((data) => {
      if (!mounted) return;
      setGuides(data);
      setLoading(false);
    });

    // Get user stats
    if (user?.uid) {
      getUserStats(user.uid).then((userStats) => {
        setStats(userStats);
        // Initialize bookmarked guides from saved lessons
        setBookmarkedGuides(new Set(userStats.savedLessons || []));
      });
    }

    return () => {
      mounted = false;
    };
  }, [user?.uid]);

  const handleSelectGuide = useCallback((guide: StudyGuide) => {
    navigation.navigate('GuideDetails', { guideId: guide.id });
  }, [navigation]);

  // Handle like toggle
  const handleLike = useCallback((guideId: string) => {
    HapticPatterns.buttonPress();
    const isCurrentlyLiked = likedGuides.has(guideId);
    
    // Update liked guides set
    setLikedGuides(prev => {
      const newSet = new Set(prev);
      if (newSet.has(guideId)) {
        newSet.delete(guideId);
      } else {
        newSet.add(guideId);
      }
      return newSet;
    });
    
    // Update like count
    setLikeCounts(prev => ({
      ...prev,
      [guideId]: (prev[guideId] || 0) + (isCurrentlyLiked ? -1 : 1),
    }));
  }, [likedGuides]);

  // Handle bookmark toggle
  const handleBookmark = useCallback((guideId: string) => {
    HapticPatterns.buttonPress();
    setBookmarkedGuides(prev => {
      const newSet = new Set(prev);
      if (newSet.has(guideId)) {
        newSet.delete(guideId);
      } else {
        newSet.add(guideId);
      }
      return newSet;
    });
    // Update stats for saved count display
    setStats(prev => ({
      ...prev,
      savedLessons: bookmarkedGuides.has(guideId)
        ? prev.savedLessons.filter(id => id !== guideId)
        : [...prev.savedLessons, guideId],
    }));
  }, [bookmarkedGuides]);

  // Local state for archived guides (user can archive/unarchive)
  const [archivedGuides, setArchivedGuides] = useState<Set<string>>(new Set());

  // Handle archive toggle
  const handleArchive = useCallback((guideId: string, guideName: string) => {
    HapticPatterns.buttonPress();
    const isCurrentlyArchived = archivedGuides.has(guideId);
    
    setArchivedGuides(prev => {
      const newSet = new Set(prev);
      if (newSet.has(guideId)) {
        newSet.delete(guideId);
      } else {
        newSet.add(guideId);
      }
      return newSet;
    });

    // Show confirmation
    Alert.alert(
      isCurrentlyArchived ? 'Restored' : 'Archived',
      isCurrentlyArchived 
        ? `"${guideName}" has been restored to your current studies.`
        : `"${guideName}" has been moved to your archive.`,
      [{ text: 'OK' }]
    );
  }, [archivedGuides]);

  // Handle more menu
  const handleMoreMenu = useCallback((guide: StudyGuide) => {
    HapticPatterns.buttonPress();
    
    const isArchived = archivedGuides.has(guide.id);
    const archiveOption = isArchived ? 'Restore from Archive' : 'Archive Study';
    const options = ['Share', archiveOption, 'View Details', 'Cancel'];
    const cancelButtonIndex = 3;

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex,
          title: guide.title,
        },
        (buttonIndex) => {
          if (buttonIndex === 0) {
            handleShare(guide);
          } else if (buttonIndex === 1) {
            handleArchive(guide.id, guide.title);
          } else if (buttonIndex === 2) {
            handleSelectGuide(guide);
          }
        }
      );
    } else {
      // Android fallback
      Alert.alert(
        guide.title,
        'Choose an action',
        [
          { text: 'Share', onPress: () => handleShare(guide) },
          { text: archiveOption, onPress: () => handleArchive(guide.id, guide.title) },
          { text: 'View Details', onPress: () => handleSelectGuide(guide) },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    }
  }, [archivedGuides, handleArchive, handleSelectGuide]);

  // Handle share
  const handleShare = async (guide: StudyGuide) => {
    try {
      await Share.share({
        title: guide.title,
        message: `📖 ${guide.title}\n\n${guide.description}\n\nStudy with me on Lift!`,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  // Filter guides based on active tab
  const filteredGuides = guides.filter(guide => {
    // User-archived guides go to Archive tab
    const isUserArchived = archivedGuides.has(guide.id);
    
    if (activeTab === 'Current') {
      // Show active guides that user hasn't archived
      return guide.isActive && !isUserArchived;
    }
    if (activeTab === 'Archive') {
      // Show inactive guides OR user-archived guides
      return !guide.isActive || isUserArchived;
    }
    if (activeTab === 'Saved') {
      return bookmarkedGuides.has(guide.id);
    }
    return true;
  });

  return (
    <LiftScreen scroll>
      {/* Header Section */}
      <View style={styles.headerSection}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <Text style={[styles.kicker, { color: colors.muted }]}>SABBATH SCHOOL</Text>
          <Text style={[styles.heading, { color: colors.text }]}>
            Study<Text style={styles.headingDot}>.</Text>
          </Text>
        </View>
        
        <TouchableOpacity onPress={() => {}} style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Stats Strip */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.statValue, { color: colors.text }]}>{stats.currentStreak}</Text>
          <Text style={[styles.statLabel, { color: colors.muted }]}>Day Streak</Text>
        </View>
        <View style={[styles.statCard, styles.statCardHighlight, { backgroundColor: colors.amber100, borderColor: colors.amber200 }]}>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {Math.round((stats.lessonsCompleted / 13) * 100)}%
          </Text>
          <Text style={[styles.statLabel, { color: colors.muted }]}>Completed</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.statValue, { color: colors.text }]}>{stats.savedLessons.length}</Text>
          <Text style={[styles.statLabel, { color: colors.muted }]}>Saved</Text>
        </View>
      </View>

      {/* Main Content Sheet */}
      <View style={[styles.contentSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {/* Tabs */}
          <View style={[styles.tabsContainer, { borderBottomColor: colors.stone100 }]}>
            {(['Current', 'Archive', 'Saved'] as TabOption[]).map((tab) => (
              <TouchableOpacity
                key={tab}
                style={styles.tab}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[
                  styles.tabText,
                  activeTab === tab ? styles.tabTextActive : null,
                  { color: activeTab === tab ? colors.stone900 : colors.stone400 }
                ]}>
                  {tab}
                </Text>
                {activeTab === tab && (
                  <View style={[styles.tabIndicator, { backgroundColor: colors.amber500 }]} />
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Guide Feed */}
          <ScrollView
            style={styles.feedScroll}
            contentContainerStyle={styles.feedContent}
            showsVerticalScrollIndicator={false}
          >
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.accent} />
              </View>
            ) : filteredGuides.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="book-outline" size={48} color={colors.stone300} />
                <Text style={[styles.emptyText, { color: colors.stone400 }]}>
                  {activeTab === 'Saved' ? 'No saved lessons yet' : 'No study guides available'}
                </Text>
              </View>
            ) : (
              filteredGuides.map((guide) => (
                <TouchableOpacity
                  key={guide.id}
                  style={[styles.guideCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => handleSelectGuide(guide)}
                  activeOpacity={0.7}
                >
                  {/* Author Row */}
                  <View style={styles.authorRow}>
                    <View style={styles.authorInfo}>
                      <View style={[styles.authorAvatar, { backgroundColor: colors.stone200 }]}>
                        {guide.authorAvatar ? (
                          <Image source={{ uri: guide.authorAvatar }} style={styles.avatarImage} />
                        ) : (
                          <Ionicons name="person" size={16} color={colors.stone400} />
                        )}
                      </View>
                      <View>
                        <Text style={[styles.authorName, { color: colors.stone900 }]}>{guide.author}</Text>
                        <Text style={[styles.dateRange, { color: colors.stone400 }]}>{guide.dateRange}</Text>
                      </View>
                    </View>
                    <TouchableOpacity 
                      style={styles.moreButton}
                      onPress={() => handleMoreMenu(guide)}
                    >
                      <Ionicons name="ellipsis-horizontal" size={18} color={colors.stone400} />
                    </TouchableOpacity>
                  </View>

                  {/* Content */}
                  <View style={styles.guideContent}>
                    <Text style={[styles.guideTitle, { color: colors.stone900 }]} numberOfLines={2}>
                      {guide.title}
                    </Text>
                    <Text style={[styles.guideDescription, { color: colors.stone500 }]} numberOfLines={2}>
                      {guide.description}
                    </Text>
                  </View>

                  {/* Cover Image */}
                  <View style={styles.coverContainer}>
                    <Image
                      source={{ uri: guide.coverImage }}
                      style={styles.coverImage}
                      resizeMode="cover"
                    />
                    <View style={styles.coverOverlay} />
                    {guide.isActive && (
                      <View style={[styles.activeBadge, { backgroundColor: colors.amber500 }]}>
                        <Text style={styles.activeBadgeText}>CURRENT</Text>
                      </View>
                    )}
                  </View>

                  {/* Actions */}
                  <View style={styles.actionsRow}>
                    <TouchableOpacity 
                      style={[styles.readButton, { backgroundColor: colors.stone900 }]}
                      onPress={() => handleSelectGuide(guide)}
                    >
                      <Ionicons name="book-outline" size={16} color={colors.amber100} />
                      <Text style={[styles.readButtonText, { color: colors.amber100 }]}>Read</Text>
                    </TouchableOpacity>
                    <View style={styles.socialActions}>
                      <TouchableOpacity 
                        style={styles.socialButton}
                        onPress={() => handleLike(guide.id)}
                      >
                        <Ionicons 
                          name={likedGuides.has(guide.id) ? "heart" : "heart-outline"} 
                          size={20} 
                          color={likedGuides.has(guide.id) ? colors.rose500 : colors.stone400} 
                        />
                        <Text style={[styles.socialCount, { color: likedGuides.has(guide.id) ? colors.rose500 : colors.stone400 }]}>
                          {likeCounts[guide.id] || 0}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={styles.socialButton}
                        onPress={() => handleBookmark(guide.id)}
                      >
                        <Ionicons 
                          name={bookmarkedGuides.has(guide.id) ? "bookmark" : "bookmark-outline"} 
                          size={20} 
                          color={bookmarkedGuides.has(guide.id) ? colors.amber500 : colors.stone400} 
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
    </LiftScreen>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  
  // Header
  headerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    marginBottom: 2,
    opacity: 0.8,
  },
  heading: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontSize: 32,
    fontWeight: '500',
    letterSpacing: -1,
  },
  headingDot: {
    color: '#f59e0b',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
  },
  statCardHighlight: {
    position: 'relative',
    overflow: 'hidden',
  },
  statValue: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontSize: 22,
    fontWeight: '600',
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 2,
  },

  // Content Sheet
  contentSheet: {
    flex: 1,
    borderTopLeftRadius: radius.xxxl,
    borderTopRightRadius: radius.xxxl,
    borderWidth: 1,
    borderBottomWidth: 0,
    overflow: 'hidden',
  },

  // Tabs
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    borderBottomWidth: 1,
  },
  tab: {
    marginRight: spacing.xl,
    paddingBottom: spacing.md,
    position: 'relative',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '400',
  },
  tabTextActive: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontWeight: '500',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    borderRadius: 1,
  },

  // Feed
  feedScroll: {
    flex: 1,
  },
  feedContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl * 2,
    gap: spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxl * 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxl * 2,
  },
  emptyText: {
    fontSize: 15,
    marginTop: spacing.md,
  },

  // Guide Card
  guideCard: {
    borderRadius: radius.xxxl,
    padding: spacing.lg,
    borderWidth: 1,
  },
  authorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  authorAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  authorName: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  dateRange: {
    fontFamily: Platform.select({ ios: 'Georgia-Italic', android: 'serif' }),
    fontSize: 12,
    fontStyle: 'italic',
  },
  moreButton: {
    padding: spacing.xs,
  },

  // Guide Content
  guideContent: {
    marginBottom: spacing.md,
  },
  guideTitle: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
    marginBottom: spacing.xs,
  },
  guideDescription: {
    fontSize: 14,
    lineHeight: 20,
  },

  // Cover Image
  coverContainer: {
    height: 120,
    borderRadius: radius.xl,
    overflow: 'hidden',
    marginBottom: spacing.md,
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  activeBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  activeBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },

  // Actions
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  readButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
  },
  readButtonText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  socialActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  socialCount: {
    fontSize: 12,
    fontWeight: '500',
  },
});

export default DevotionsScreen;
