import React, { useRef, useState, useMemo, useCallback } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  Alert,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ViewToken,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { palette, radius, spacing, fonts, fontSizes } from '../theme/colors';
import { recordOnboardingAnalytics, type OnboardingAnswers } from '../services/userProfile';
import { validateDisplayName } from '../utils/security';
import { CinematicBackground } from '../components/CinematicBackground';

const { width } = Dimensions.get('window');

const ONBOARDING_KEY = '@lift_onboarding_complete';
const ONBOARDING_ANSWERS_KEY = '@lift_onboarding_answers';

type OnboardingSlide = {
  id: string;
  emoji: string;
  title: string;
  description: string;
  color: string;
};

// Tutorial slides with cross emoji as requested
const getSlides = (colors: any): OnboardingSlide[] => [
  {
    id: '1',
    emoji: '✝️',
    title: 'Welcome to Lift',
    description: 'A live network where prayers meet purpose. Share your needs, lift others up.',
    color: colors.accentLight,
  },
  {
    id: '2',
    emoji: '📡',
    title: 'Transmit Your Need',
    description: 'Post prayer requests and let the community rally around you in support.',
    color: colors.amber100,
  },
  {
    id: '3',
    emoji: '✨',
    title: 'Verify & Celebrate',
    description: 'When prayers are answered, share your testimony and inspire others.',
    color: colors.successLight,
  },
];

type QuestionOption = {
  id: string;
  label: string;
  emoji?: string;
};

type Question = {
  id: string;
  question: string;
  subtitle?: string;
  type: 'single' | 'multi' | 'text';
  options?: QuestionOption[];
  placeholder?: string;
};

const questions: Question[] = [
  {
    id: 'faith_journey',
    question: 'Where are you on your faith journey?',
    subtitle: 'This helps us personalize your experience',
    type: 'single',
    options: [
      { id: 'exploring', label: 'Exploring faith', emoji: '🌱' },
      { id: 'growing', label: 'Growing in faith', emoji: '🌿' },
      { id: 'mature', label: 'Mature believer', emoji: '🌳' },
      { id: 'returning', label: 'Returning to faith', emoji: '🔄' },
    ],
  },
  {
    id: 'prayer_style',
    question: 'How do you prefer to pray?',
    type: 'single',
    options: [
      { id: 'alone', label: 'Alone / Private', emoji: '🤫' },
      { id: 'community', label: 'With community', emoji: '👥' },
      { id: 'both', label: 'Both ways', emoji: '✝️' },
    ],
  },
  {
    id: 'interests',
    question: 'What matters most to you?',
    subtitle: 'Select all that apply',
    type: 'multi',
    options: [
      { id: 'health', label: 'Health & Healing', emoji: '🏥' },
      { id: 'family', label: 'Family', emoji: '👨‍👩‍👧‍👦' },
      { id: 'work', label: 'Work & Career', emoji: '💼' },
      { id: 'relationships', label: 'Relationships', emoji: '❤️' },
      { id: 'finances', label: 'Finances', emoji: '💰' },
      { id: 'spiritual', label: 'Spiritual Growth', emoji: '✨' },
    ],
  },
  {
    id: 'name',
    question: "What should we call you?",
    subtitle: 'This will be shown to others when you pray',
    type: 'text',
    placeholder: 'Your name or nickname',
  },
];

type Props = {
  onComplete: () => void;
};

export const OnboardingScreen: React.FC<Props> = ({ onComplete }) => {
  const { colors, isDark } = useTheme();
  const [currentIndex, setCurrentIndex] = useState(0);
  const slides = getSlides(colors);
  const [showQuestionnaire, setShowQuestionnaire] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const viewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index !== null) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const viewConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const handleNext = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    
    if (currentIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
    } else {
      // Move to questionnaire
      setShowQuestionnaire(true);
    }
  };

  const handleQuestionNext = useCallback((forceSkip = false) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    const currentQuestion = questions[questionIndex];
    const currentAnswer = answers[currentQuestion.id];
    
    // Validate answer (unless force skipping)
    if (!forceSkip && (!currentAnswer || (Array.isArray(currentAnswer) && currentAnswer.length === 0))) {
      // Allow skipping text questions
      if (currentQuestion.type !== 'text') return;
    }

    if (currentQuestion.id === 'name' && typeof currentAnswer === 'string' && currentAnswer.trim()) {
      const validation = validateDisplayName(currentAnswer);
      if (!validation.isValid) {
        Alert.alert('Invalid Name', validation.error || 'Please enter a different display name.');
        return;
      }
      if (validation.sanitized && validation.sanitized !== currentAnswer) {
        setAnswers((prev) => ({ ...prev, [currentQuestion.id]: validation.sanitized as string }));
      }
    }

    if (questionIndex < questions.length - 1) {
      setQuestionIndex(questionIndex + 1);
    } else {
      handleComplete();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionIndex, answers]);

  // Handler for skip button - forces advancement without validation
  const handleSkipQuestion = useCallback(() => {
    handleQuestionNext(true);
  }, [handleQuestionNext]);

  const handleQuestionBack = () => {
    if (questionIndex > 0) {
      setQuestionIndex(questionIndex - 1);
    } else {
      setShowQuestionnaire(false);
    }
  };

  const handleComplete = async () => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {
        // Haptics not available
      }
    }
    
    // Save locally
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    await AsyncStorage.setItem(ONBOARDING_ANSWERS_KEY, JSON.stringify(answers));
    
    // Record to Firestore analytics (anonymous since user hasn't signed in yet)
    // This will be linked to user profile when they sign in
    try {
      await recordOnboardingAnalytics(null, answers as OnboardingAnswers, {
        isAnonymous: true,
      });
    } catch (err) {
      console.warn('[Onboarding] Could not record analytics:', err);
      // Don't block onboarding completion
    }
    
    onComplete();
  };

  const handleSelectOption = (questionId: string, optionId: string, isMulti: boolean) => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }

    setAnswers((prev) => {
      if (isMulti) {
        const current = (prev[questionId] as string[]) || [];
        if (current.includes(optionId)) {
          return { ...prev, [questionId]: current.filter((id) => id !== optionId) };
        } else {
          return { ...prev, [questionId]: [...current, optionId] };
        }
      } else {
        return { ...prev, [questionId]: optionId };
      }
    });
  };

  const renderSlide = ({ item }: { item: OnboardingSlide }) => (
    <View style={[styles.slide, { width }]}>
      <View style={[styles.emojiContainer, { backgroundColor: item.color }]}>
        <Text style={styles.emoji}>{item.emoji}</Text>
      </View>
      <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
      <Text style={[styles.description, { color: colors.muted }]}>{item.description}</Text>
    </View>
  );

  const renderDots = () => (
    <View style={styles.dotsContainer}>
      {slides.map((_, index) => {
        const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
        const dotWidth = scrollX.interpolate({
          inputRange,
          outputRange: [8, 24, 8],
          extrapolate: 'clamp',
        });
        const opacity = scrollX.interpolate({
          inputRange,
          outputRange: [0.3, 1, 0.3],
          extrapolate: 'clamp',
        });
        return (
          <Animated.View
            key={index}
            style={[
              styles.dot, 
              { 
                width: dotWidth, 
                opacity,
                backgroundColor: colors.accent
              }
            ]}
          />
        );
      })}
    </View>
  );

  const renderQuestion = () => {
    const question = questions[questionIndex];
    const currentAnswer = answers[question.id];
    const isMulti = question.type === 'multi';
    const selectedOptions = isMulti ? (currentAnswer as string[]) || [] : [currentAnswer as string];

    const canProceed = question.type === 'text' 
      ? true 
      : (currentAnswer && (Array.isArray(currentAnswer) ? currentAnswer.length > 0 : true));

    // Bold diagonal gradient
    const gradientColors = [...colors.gradientBoldScreen] as [string, string, ...string[]];

    return (
      <LinearGradient colors={gradientColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }}>
      <SafeAreaView style={[styles.container, { backgroundColor: 'transparent' }]}>
        <View style={styles.questionHeader}>
          <TouchableOpacity onPress={handleQuestionBack} style={[styles.backButton, { backgroundColor: colors.surface }]}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.progressContainer}>
            {questions.map((_, idx) => (
              <View
                key={idx}
                style={[
                  styles.progressDot,
                  {
                    backgroundColor: idx <= questionIndex ? colors.accent : colors.border
                  },
                  idx <= questionIndex && styles.progressDotActive,
                ]}
              />
            ))}
          </View>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView 
          contentContainerStyle={styles.questionContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.questionText, { color: colors.text }]}>{question.question}</Text>
          {question.subtitle && (
            <Text style={[styles.questionSubtitle, { color: colors.muted }]}>{question.subtitle}</Text>
          )}

          {question.type === 'text' ? (
            <TextInput
              style={[styles.textInput, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
              placeholder={question.placeholder}
              placeholderTextColor={colors.muted}
              value={(currentAnswer as string) || ''}
              onChangeText={(text) => setAnswers((prev) => ({ ...prev, [question.id]: text }))}
              autoFocus
            />
          ) : (
            <View style={styles.optionsContainer}>
              {question.options?.map((option) => {
                const isSelected = selectedOptions.includes(option.id);
                return (
                  <TouchableOpacity
                    key={option.id}
                    style={[
                      styles.optionButton, 
                      { backgroundColor: colors.surface, borderColor: colors.border },
                      isSelected && [styles.optionButtonSelected, { backgroundColor: colors.accentLight, borderColor: colors.accent }]
                    ]}
                    onPress={() => handleSelectOption(question.id, option.id, isMulti)}
                  >
                    {option.emoji && <Text style={styles.optionEmoji}>{option.emoji}</Text>}
                    <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected, { color: colors.text }]}>
                      {option.label}
                    </Text>
                    {isSelected && (
                      <Ionicons 
                        name={isMulti ? "checkbox" : "radio-button-on"} 
                        size={20} 
                        color={colors.accent} 
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </ScrollView>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[
              styles.button, 
              { backgroundColor: colors.accent },
              !canProceed && [styles.buttonDisabled, { backgroundColor: colors.muted, opacity: 0.5 }]
            ]}
            onPress={() => handleQuestionNext()}
          >
            <Text style={[styles.buttonText, { color: colors.text }]}>
              {questionIndex === questions.length - 1 ? "Let's Go! ✝️" : 'Continue'}
            </Text>
          </TouchableOpacity>
          {question.type !== 'text' && !canProceed && (
            <TouchableOpacity onPress={handleSkipQuestion} style={styles.skipButton}>
              <Text style={[styles.skipButtonText, { color: colors.muted }]}>Skip this question</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
      </LinearGradient>
    );
  };

  // Memoize gradient colors for performance and stability
  const gradientColors = useMemo(
    () => [...colors.gradientBoldScreen] as [string, string, ...string[]],
    [colors.gradientBoldScreen]
  );

  if (showQuestionnaire) {
    return renderQuestion();
  }

  return (
    <CinematicBackground>
      <SafeAreaView style={[styles.container, { backgroundColor: 'transparent' }]}>
      <View style={styles.skipContainer}>
        {currentIndex < slides.length - 1 && (
          <TouchableOpacity onPress={() => setShowQuestionnaire(true)}>
            <Text style={[styles.skipText, { color: colors.muted }]}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>

      <Animated.FlatList
        ref={flatListRef}
        data={slides}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        onViewableItemsChanged={viewableItemsChanged}
        viewabilityConfig={viewConfig}
        scrollEventThrottle={16}
      />

      {renderDots()}

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={[styles.button, { backgroundColor: colors.accent }]} onPress={handleNext}>
          <Text style={[styles.buttonText, { color: colors.text }]}>
            {currentIndex === slides.length - 1 ? 'Continue' : 'Next'}
          </Text>
        </TouchableOpacity>
      </View>
      </SafeAreaView>
    </CinematicBackground>
  );
};

export const checkOnboardingComplete = async (): Promise<boolean> => {
  const value = await AsyncStorage.getItem(ONBOARDING_KEY);
  return value === 'true';
};

export const getOnboardingAnswers = async (): Promise<Record<string, any> | null> => {
  const value = await AsyncStorage.getItem(ONBOARDING_ANSWERS_KEY);
  return value ? JSON.parse(value) : null;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  skipContainer: {
    alignItems: 'flex-end',
    padding: spacing.lg,
    minHeight: 50,
  },
  skipText: {
    fontFamily: fonts.bodyMedium,
    fontWeight: '600',
    fontSize: fontSizes.md,
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  emojiContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
    
    
    
    
    elevation: 8,
  },
  emoji: {
    fontSize: 48,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.xxl,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.md,
    letterSpacing: -0.5,
  },
  description: {
    fontFamily: fonts.body,
    fontSize: fontSizes.md,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: spacing.lg,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  buttonContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  button: {
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    
    
    
    
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.lg,
    fontWeight: '700',
  },
  // Question styles
  questionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressContainer: {
    flexDirection: 'row',
    gap: 6,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  progressDotActive: {
    width: 20,
  },
  questionContent: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  questionText: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.xxl,
    fontWeight: '700',
    marginBottom: spacing.sm,
    letterSpacing: -0.5,
  },
  questionSubtitle: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    marginBottom: spacing.xl,
  },
  optionsContainer: {
    gap: spacing.sm,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 2,
    gap: spacing.sm,
  },
  optionButtonSelected: {
  },
  optionEmoji: {
    fontSize: 24,
  },
  optionLabel: {
    fontFamily: fonts.bodyMedium,
    flex: 1,
    fontSize: fontSizes.md,
    fontWeight: '600',
  },
  optionLabelSelected: {
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
  },
  textInput: {
    fontFamily: fonts.body,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 2,
    fontSize: fontSizes.lg,
    marginTop: spacing.md,
  },
  skipButton: {
    marginTop: spacing.md,
    alignItems: 'center',
  },
  skipButtonText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
    fontWeight: '600',
  },
});
