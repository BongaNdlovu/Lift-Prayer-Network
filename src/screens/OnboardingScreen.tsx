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
import { palette, radius, spacing } from '../theme/colors';
import { recordOnboardingAnalytics, type OnboardingAnswers } from '../services/userProfile';
import { validateDisplayName } from '../utils/security';

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
const getSlides = (isDark: boolean): OnboardingSlide[] => [
  {
    id: '1',
    emoji: '✝️',
    title: 'Welcome to Lift',
    description: 'A live network where prayers meet purpose. Share your needs, lift others up.',
    color: isDark ? '#4a4a00' : '#fef3c7',
  },
  {
    id: '2',
    emoji: '📡',
    title: 'Transmit Your Need',
    description: 'Post prayer requests and let the community rally around you in support.',
    color: isDark ? '#003366' : '#dbeafe',
  },
  {
    id: '3',
    emoji: '✨',
    title: 'Verify & Celebrate',
    description: 'When prayers are answered, share your testimony and inspire others.',
    color: isDark ? '#004d00' : '#dcfce7',
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
  const slides = getSlides(isDark);
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
            style={[styles.dot, { width: dotWidth, opacity }]}
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
    <LinearGradient colors={gradientColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }}>
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
    </LinearGradient>
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
    backgroundColor: palette.background,
  },
  skipContainer: {
    alignItems: 'flex-end',
    padding: spacing.lg,
    minHeight: 50,
  },
  skipText: {
    color: palette.muted,
    fontWeight: '600',
    fontSize: 16,
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  emojiContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  emoji: {
    fontSize: 64,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  description: {
    fontSize: 16,
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
    backgroundColor: palette.accent,
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
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '800',
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
    backgroundColor: palette.border,
  },
  progressDotActive: {
    backgroundColor: palette.accent,
    width: 20,
  },
  questionContent: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  questionText: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  questionSubtitle: {
    fontSize: 14,
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
    borderColor: palette.border,
    gap: spacing.sm,
  },
  optionButtonSelected: {
    borderColor: palette.accent,
  },
  optionEmoji: {
    fontSize: 24,
  },
  optionLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  optionLabelSelected: {
    fontWeight: '700',
  },
  textInput: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: palette.border,
    fontSize: 18,
    marginTop: spacing.md,
  },
  skipButton: {
    marginTop: spacing.md,
    alignItems: 'center',
  },
  skipButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
