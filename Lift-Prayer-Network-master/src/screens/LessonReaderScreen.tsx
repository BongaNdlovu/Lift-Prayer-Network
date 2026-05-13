import React, { useEffect, useState, useRef } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
  Dimensions,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../contexts/ThemeContext';
import { radius, spacing, fonts } from '../theme/colors';
import {
  Lesson,
  getLesson,
  MOCK_LESSONS,
} from '../services/studyGuides';
import { RootStackParamList } from '../navigation/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HERO_HEIGHT = SCREEN_WIDTH * 0.65;

type LessonReaderRouteProp = RouteProp<RootStackParamList, 'LessonReader'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const LessonReaderScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<LessonReaderRouteProp>();
  const { colors } = useTheme();
  
  const { guideId, lessonId } = route.params;
  
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const scrollY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const fetchLesson = async () => {
      const lessonData = await getLesson(guideId, lessonId);
      if (lessonData) {
        setLesson(lessonData);
      } else {
        // Fallback to mock data
        const mockLessons = MOCK_LESSONS[guideId] || [];
        const mockLesson = mockLessons.find(l => l.id === lessonId);
        if (mockLesson) setLesson(mockLesson);
      }
      setLoading(false);
    };
    fetchLesson();
  }, [guideId, lessonId]);

  // Header opacity based on scroll
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, HERO_HEIGHT - 100],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (!lesson) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.errorText, { color: colors.muted }]}>Lesson not found</Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backLink}>
            <Text style={[styles.backLinkText, { color: colors.accent }]}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Parse content into paragraphs
  const paragraphs = lesson.content.split('\n\n').filter(p => p.trim());

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Sticky Header (appears on scroll) */}
      <Animated.View 
        style={[
          styles.stickyHeader, 
          { 
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
            opacity: headerOpacity,
          }
        ]}
      >
        <SafeAreaView style={styles.stickyHeaderInner}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.stickyTitle, { color: colors.text }]} numberOfLines={1}>
            {lesson.title}
          </Text>
          <TouchableOpacity style={styles.headerButton}>
            <Ionicons name="bookmark-outline" size={22} color={colors.text} />
          </TouchableOpacity>
        </SafeAreaView>
      </Animated.View>

      {/* Floating Back Button (visible at top) */}
      <SafeAreaView style={styles.floatingHeader}>
        <TouchableOpacity
          style={styles.floatingBackButton}
          onPress={() => navigation.goBack()}
        >
          <View style={[styles.floatingBackInner, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.floatingBackButton}>
          <View style={[styles.floatingBackInner, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="bookmark-outline" size={22} color={colors.text} />
          </View>
        </TouchableOpacity>
      </SafeAreaView>

      <Animated.ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
      >
        {/* Hero Image */}
        <View style={styles.heroContainer}>
          <Image
            source={{ uri: lesson.heroImage || 'https://images.unsplash.com/photo-1497294815431-9365093b7331?auto=format&fit=crop&q=80&w=800' }}
            style={styles.heroImage}
            resizeMode="cover"
          />
          <View style={[styles.heroGradient, { backgroundColor: colors.background }]} />
        </View>

        {/* Article Content */}
        <View style={styles.articleContainer}>
          {/* Meta Badge */}
          <View style={styles.metaRow}>
            <View style={[styles.metaBadge, { backgroundColor: colors.accentLight }]}>
              <Text style={[styles.metaBadgeText, { color: colors.accentDark }]}>
                Lesson {lesson.number}
              </Text>
            </View>
            <Text style={[styles.metaDate, { color: colors.muted }]}>
              {lesson.date}
            </Text>
          </View>

          {/* Title */}
          <Text style={[styles.articleTitle, { color: colors.text }]}>
            {lesson.title}
          </Text>

          {/* Memory Verse Card */}
          <View style={[styles.memoryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.memoryAccent, { backgroundColor: colors.accent }]} />
            <Ionicons 
              name="book-outline" 
              size={36} 
              color={colors.muted} 
              style={styles.memoryIcon}
            />
            <Text style={[styles.memoryText, { color: colors.textSecondary }]}>
              &ldquo;{lesson.memoryText}&rdquo;
            </Text>
            <Text style={[styles.memoryRef, { color: colors.accentDark }]}>
              — {lesson.memoryRef}
            </Text>
          </View>

          {/* Readings */}
          {lesson.readings && (
            <View style={styles.readingsRow}>
              <Ionicons name="library-outline" size={16} color={colors.muted} />
              <Text style={[styles.readingsText, { color: colors.textSecondary }]}>
                {lesson.readings}
              </Text>
            </View>
          )}

          {/* Body Content */}
          <View style={styles.bodyContent}>
            {paragraphs.map((paragraph, index) => {
              // Check if it's a heading (starts with capital and is short)
              const isHeading = paragraph.length < 60 && /^[A-Z]/.test(paragraph) && !paragraph.includes('.');
              
              if (isHeading) {
                return (
                  <Text 
                    key={index} 
                    style={[styles.bodyHeading, { color: colors.text }]}
                  >
                    {paragraph}
                  </Text>
                );
              }

              // First paragraph gets drop cap styling
              if (index === 0) {
                const firstLetter = paragraph.charAt(0);
                const restOfParagraph = paragraph.slice(1);
                return (
                  <View key={index} style={styles.dropCapContainer}>
                    <Text style={[styles.dropCap, { color: colors.amber600 }]}>
                      {firstLetter}
                    </Text>
                    <Text style={[styles.bodyText, styles.dropCapText, { color: colors.stone800 }]}>
                      {restOfParagraph}
                    </Text>
                  </View>
                );
              }

              return (
                <Text 
                  key={index} 
                  style={[styles.bodyText, { color: colors.stone800 }]}
                >
                  {paragraph}
                </Text>
              );
            })}
          </View>

          {/* End Mark */}
          <View style={styles.endMark}>
            <View style={[styles.endDot, { backgroundColor: colors.border }]} />
            <View style={[styles.endDot, { backgroundColor: colors.border }]} />
            <View style={[styles.endDot, { backgroundColor: colors.border }]} />
          </View>

          {/* Discussion Questions */}
          <View style={[styles.discussionCard, { backgroundColor: colors.accentLight, borderColor: colors.accentDark }]}>
            <View style={styles.discussionHeader}>
              <Ionicons name="chatbubbles-outline" size={20} color={colors.accentDark} />
              <Text style={[styles.discussionTitle, { color: colors.accentDark }]}>
                Discussion Questions
              </Text>
            </View>
            <Text style={[styles.discussionText, { color: colors.textSecondary }]}>
              1. How does Joshua&apos;s call to be &ldquo;strong and courageous&rdquo; apply to your life today?
            </Text>
            <Text style={[styles.discussionText, { color: colors.textSecondary }]}>
              2. What &ldquo;promised lands&rdquo; is God calling you to enter?
            </Text>
            <Text style={[styles.discussionText, { color: colors.textSecondary }]}>
              3. How can meditating on Scripture day and night transform your daily decisions?
            </Text>
          </View>
        </View>
      </Animated.ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontFamily: fonts.body,
    fontSize: 16,
    marginBottom: spacing.md,
  },
  backLink: {
    padding: spacing.sm,
  },
  backLinkText: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
  },

  // Sticky Header
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    borderBottomWidth: 1,
  },
  stickyHeaderInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  headerButton: {
    padding: spacing.xs,
  },
  stickyTitle: {
    flex: 1,
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    textAlign: 'center',
    marginHorizontal: spacing.md,
  },

  // Floating Header
  floatingHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  floatingBackButton: {
    zIndex: 51,
  },
  floatingBackInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },

  // Scroll View
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xxl * 2,
  },

  // Hero
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

  // Article
  articleContainer: {
    paddingHorizontal: spacing.lg,
    marginTop: -spacing.xl,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  metaBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  metaBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  metaDate: {
    fontFamily: fonts.heading,
    fontSize: 13,
    fontStyle: 'italic',
  },
  articleTitle: {
    fontFamily: fonts.heading,
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 40,
    letterSpacing: -0.5,
    marginBottom: spacing.xl,
  },

  // Memory Card
  memoryCard: {
    position: 'relative',
    padding: spacing.lg,
    paddingLeft: spacing.xl,
    borderRadius: radius.xl,
    borderWidth: 1,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  memoryAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  memoryIcon: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    opacity: 0.3,
  },
  memoryText: {
    fontFamily: fonts.heading,
    fontSize: 17,
    fontStyle: 'italic',
    lineHeight: 26,
    marginBottom: spacing.md,
  },
  memoryRef: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    textAlign: 'right',
  },

  // Readings
  readingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  readingsText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 13,
  },

  // Body Content
  bodyContent: {
    marginTop: spacing.md,
  },
  dropCapContainer: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
  },
  dropCap: {
    fontFamily: fonts.heading,
    fontSize: 56,
    lineHeight: 56,
    marginRight: spacing.sm,
    marginTop: -spacing.xs,
  },
  dropCapText: {
    flex: 1,
    paddingTop: spacing.xs,
  },
  bodyText: {
    fontFamily: fonts.heading,
    fontSize: 18,
    lineHeight: 30,
    marginBottom: spacing.lg,
  },
  bodyHeading: {
    fontFamily: fonts.heading,
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },

  // End Mark
  endMark: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    marginVertical: spacing.xl,
    opacity: 0.5,
  },
  endDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },

  // Discussion Card
  discussionCard: {
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    marginTop: spacing.md,
  },
  discussionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  discussionTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    letterSpacing: 0.5,
  },
  discussionText: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 24,
    marginBottom: spacing.sm,
  },
});

export default LessonReaderScreen;
