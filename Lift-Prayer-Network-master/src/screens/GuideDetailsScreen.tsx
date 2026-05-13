import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../contexts/ThemeContext';
import { LiftScreen } from '../components/LiftLayout';
import { radius, spacing, fonts } from '../theme/colors';
import {
  StudyGuide,
  Lesson,
  getStudyGuide,
  subscribeToLessons,
} from '../services/studyGuides';
import { RootStackParamList } from '../navigation/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HERO_HEIGHT = SCREEN_WIDTH * 0.6;

type GuideDetailsRouteProp = RouteProp<RootStackParamList, 'GuideDetails'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const GuideDetailsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<GuideDetailsRouteProp>();
  const { colors } = useTheme();
  
  const { guideId } = route.params;
  
  const [guide, setGuide] = useState<StudyGuide | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get guide details
    const fetchGuide = async () => {
      const guideData = await getStudyGuide(guideId);
      if (guideData) {
        setGuide(guideData);
      }
    };
    fetchGuide();

    // Subscribe to lessons
    const unsubscribe = subscribeToLessons(guideId, (data) => {
      if (data.length > 0) {
        setLessons(data);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, [guideId]);

  const handleSelectLesson = (lesson: Lesson) => {
    navigation.navigate('LessonReader', {
      guideId,
      lessonId: lesson.id,
      lessonTitle: lesson.title,
    });
  };

  if (!guide) {
    return (
      <LiftScreen>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </LiftScreen>
    );
  }

  return (
    <LiftScreen contentStyle={styles.screenContent}>
      {/* Hero Image Section */}
      <View style={styles.heroContainer}>
        <Image
          source={{ uri: guide.coverImage }}
          style={styles.heroImage}
          resizeMode="cover"
        />
        <View style={[styles.heroGradient, { backgroundColor: 'rgba(0,0,0,0.3)' }]} />
        
        {/* Back Button */}
        <View style={styles.headerOverlay}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <View style={styles.backButtonInner}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Hero Content */}
        <View style={styles.heroContent}>
          <Text style={styles.heroSubtitle}>{guide.subtitle}</Text>
          <Text style={styles.heroTitle}>{guide.title}</Text>
        </View>
      </View>

      {/* Content Sheet */}
      <View style={[styles.contentSheet, { backgroundColor: colors.background }]}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Description */}
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            {guide.description}
          </Text>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <View style={[styles.statItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="book-outline" size={18} color={colors.accent} />
              <Text style={[styles.statValue, { color: colors.text }]}>{guide.lessonCount}</Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>Lessons</Text>
            </View>
            <View style={[styles.statItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="calendar-outline" size={18} color={colors.accent} />
              <Text style={[styles.statValue, { color: colors.text }]}>{guide.dateRange}</Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>Quarter</Text>
            </View>
          </View>

          {/* Lessons Section */}
          <View style={styles.lessonsSection}>
            <Text style={[styles.sectionTitle, { color: colors.muted }]}>THIS QUARTER</Text>
            
            {loading ? (
              <ActivityIndicator size="small" color={colors.accent} style={{ marginTop: 20 }} />
            ) : lessons.length === 0 ? (
              <View style={styles.emptyLessons}>
                <Ionicons name="document-text-outline" size={48} color={colors.border} />
                <Text style={[styles.emptyText, { color: colors.muted }]}>
                  Lessons coming soon
                </Text>
              </View>
            ) : (
              <View style={styles.lessonsList}>
                {lessons.map((lesson) => (
                  <TouchableOpacity
                    key={lesson.id}
                    style={[styles.lessonCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    onPress={() => handleSelectLesson(lesson)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.lessonNumber, { backgroundColor: colors.surfaceSecondary }]}>
                      <Text style={[styles.lessonNumberText, { color: colors.muted }]}>
                        {lesson.number}
                      </Text>
                    </View>
                    <View style={styles.lessonContent}>
                      <Text style={[styles.lessonTitle, { color: colors.text }]} numberOfLines={1}>
                        {lesson.title}
                      </Text>
                      <Text style={[styles.lessonDate, { color: colors.muted }]}>
                        {lesson.date}
                      </Text>
                    </View>
                    <View style={[styles.lessonArrow, { borderColor: colors.border }]}>
                      <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </LiftScreen>
  );
};

const styles = StyleSheet.create({
  screenContent: { paddingHorizontal: 0 },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Hero Section
  heroContainer: {
    height: HERO_HEIGHT,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  backButton: {
    marginTop: spacing.md,
    marginLeft: spacing.md,
  },
  backButtonInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  heroContent: {
    position: 'absolute',
    bottom: spacing.xl,
    left: spacing.lg,
    right: spacing.lg,
  },
  heroSubtitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#fcd34d',
    marginBottom: spacing.xs,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  heroTitle: {
    fontFamily: fonts.heading,
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    lineHeight: 34,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },

  // Content Sheet
  contentSheet: {
    flex: 1,
    marginTop: -spacing.xl,
    borderTopLeftRadius: radius.xxxl,
    borderTopRightRadius: radius.xxxl,
    overflow: 'hidden',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl * 2,
  },
  description: {
    fontFamily: fonts.heading,
    fontSize: 17,
    lineHeight: 26,
    marginBottom: spacing.lg,
  },

  // Stats Row
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  statItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  statValue: {
    fontFamily: fonts.heading,
    fontSize: 16,
    fontWeight: '600',
  },
  statLabel: {
    fontFamily: fonts.body,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  // Lessons Section
  lessonsSection: {
    marginTop: spacing.sm,
  },
  sectionTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: spacing.lg,
  },
  emptyLessons: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyText: {
    fontFamily: fonts.body,
    fontSize: 15,
    marginTop: spacing.md,
  },
  lessonsList: {
    gap: spacing.sm,
  },
  lessonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
  },
  lessonNumber: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lessonNumberText: {
    fontFamily: fonts.heading,
    fontSize: 16,
    fontWeight: '700',
  },
  lessonContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  lessonTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    marginBottom: 2,
  },
  lessonDate: {
    fontFamily: fonts.body,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  lessonArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0,
  },
});

export default GuideDetailsScreen;
