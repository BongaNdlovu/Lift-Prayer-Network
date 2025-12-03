import React, { useState, useMemo } from 'react';
import {
  Alert,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
  Switch,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNetInfo } from '@react-native-community/netinfo';
import * as Haptics from 'expo-haptics';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../hooks/useAuth';
import { submitFeedItem } from '../hooks/useFeed';
import { queuePendingRequest } from '../services/offlineCache';
import { useTheme } from '../contexts/ThemeContext';
import { fonts, palette, radius, spacing } from '../theme/colors';
import { CinematicBackground, RoundedPage } from '../components/CinematicBackground';
import { GlassIconButton } from '../components/GlassCard';
import { PRAYER_CATEGORIES, PrayerCategory } from '../types';
import { validateContent, checkRateLimit, checkDailyLimit, CONTENT_LIMITS } from '../utils/security';
import { checkUserBlockedFromPosting } from '../services/moderation';
import { InlineError } from '../components/InlineError';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateRequest'>;

export const CreateRequestScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuth();
  const { colors } = useTheme();

  // Memoize gradient colors for stability
  const gradientColors = useMemo(
    () => [...colors.gradientBoldScreen] as [string, string, ...string[]],
    [colors.gradientBoldScreen]
  );
  const netInfo = useNetInfo();
  const [content, setContent] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<PrayerCategory>('other');
  const [isUrgent, setIsUrgent] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isShareable, setIsShareable] = useState(true); // Default to shareable
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const offline = netInfo.isConnected === false;

  const handleSubmit = async () => {
    setErrorMessage(null);
    if (!content.trim()) {
      Alert.alert('Empty Request', 'Please share what you need prayer for.');
      return;
    }

    // Security check: Check if user is blocked from posting
    if (user) {
      const blockStatus = await checkUserBlockedFromPosting(user.uid);
      if (blockStatus.isBlocked) {
        Alert.alert(
          'Posting Restricted',
          blockStatus.reason || 'Your posting privileges have been suspended. You can still view and pray for others.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
        return;
      }
    }

    // Security check: Require email verification for non-anonymous users
    if (user && !user.isAnonymous && !user.emailVerified) {
      Alert.alert(
        'Email Verification Required',
        'To prevent scammers and ensure community trust, please verify your email address before posting prayer requests.\n\nCheck your inbox for a verification link, or go to your Profile to resend it.',
        [
          { text: 'OK' },
          { 
            text: 'Go to Profile', 
            onPress: () => navigation.goBack()
          }
        ]
      );
      return;
    }

    // Validate content for security and appropriateness
    const validation = validateContent(content, {
      minLength: 10,
      maxLength: 1000,
      checkProfanity: true,
      checkSuspicious: true,
      checkMoneySolicitation: true,
      contentType: 'REQUEST',
    });

    if (!validation.isValid) {
      Alert.alert('Cannot Submit', validation.error || 'Please revise your prayer request.');
      return;
    }

    // Show warnings if any
    if (validation.warnings && validation.warnings.length > 0) {
      Alert.alert('Notice', validation.warnings.join('\n'), [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Submit Anyway', onPress: () => proceedWithSubmit(validation.sanitized || content.trim()) },
      ]);
      return;
    }

    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to submit a prayer request.');
      return;
    }

    // Rate limiting check - per minute
    if (!checkRateLimit(`prayer_create_${user.uid}`, 3, 60000)) {
      Alert.alert('Please Wait', 'You are submitting too many requests. Please wait a moment before trying again.');
      return;
    }

    // Daily limit check
    const dailyCheck = checkDailyLimit(`prayer_daily_${user.uid}`, CONTENT_LIMITS.PRAYER_REQUESTS_PER_DAY);
    if (!dailyCheck.allowed) {
      Alert.alert(
        'Daily Limit Reached',
        `You can only submit ${CONTENT_LIMITS.PRAYER_REQUESTS_PER_DAY} prayer requests per day. This helps keep our community focused and meaningful. Try again tomorrow!`
      );
      return;
    }

    await proceedWithSubmit(validation.sanitized || content.trim());
  };

  const proceedWithSubmit = async (sanitizedContent: string) => {
    if (!user) return;

    setSubmitting(true);

    try {
      const requestDisplayName = isAnonymous ? 'Anonymous' : (user.displayName || 'Anonymous');

      if (offline) {
        // Queue for later sync
        await queuePendingRequest({
          content: sanitizedContent,
          ownerUid: user.uid,
          displayName: requestDisplayName,
          category: selectedCategory,
          isUrgent,
          isPrivate,
          isAnonymous,
        });
        
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        
        Alert.alert(
          'Saved Offline',
          'Your prayer request has been saved and will be submitted when you\'re back online.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } else {
        // Submit immediately with sanitized content
        await submitFeedItem('REQUEST', sanitizedContent, user.uid, requestDisplayName, {
          category: selectedCategory,
          isUrgent,
          isPrivate,
          userEmail: isAnonymous ? undefined : (user.email || undefined),
          userPhotoURL: isAnonymous ? null : (user.photoURL || null),
          isAnonymous,
          isShareable,
          isEmailVerified: !isAnonymous && user.emailVerified,
        });

        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }

        Alert.alert(
          'Prayer Request Submitted',
          'Your request has been shared with the community. We\'re praying with you! 🙏',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      }
    } catch (error: any) {
      setErrorMessage(error.message || 'Could not submit your request. Please try again.');
      Alert.alert('Error', error.message || 'Could not submit your request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const getCategoryEmoji = (categoryId: PrayerCategory): string => {
    return PRAYER_CATEGORIES.find(c => c.id === categoryId)?.emoji || '📝';
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
            <Text style={[styles.kicker, { color: colors.stone500 }]}>SHARE YOUR HEART</Text>
            <Text style={styles.heading}>
              New Request<Text style={styles.headingDot}>.</Text>
            </Text>
          </View>
          <View style={{ width: 44 }} />
        </View>

        {/* === MAIN CONTENT === */}
        <RoundedPage style={styles.mainContent}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardView}
          >
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {errorMessage && (
                <InlineError message={errorMessage} onDismiss={() => setErrorMessage(null)} />
              )}

            {/* Offline Banner */}
            {offline && (
              <View style={styles.offlineBanner}>
                <Ionicons name="cloud-offline" size={18} color="#b91c1c" />
                <Text style={styles.offlineText}>You&apos;re offline. Request will be saved locally.</Text>
              </View>
            )}

            {/* Content Input */}
            <View style={styles.card}>
              <Text style={styles.label}>What do you need prayer for?</Text>
              <TextInput
                style={styles.textArea}
                placeholder="Share your prayer request with the community..."
                placeholderTextColor={palette.muted}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                value={content}
                onChangeText={setContent}
                maxLength={1000}
              />
              <Text style={styles.charCount}>{content.length}/1000</Text>
            </View>

            {/* Category Selection */}
            <View style={styles.card}>
              <Text style={styles.label}>Category</Text>
              <Text style={styles.hint}>Help others find and pray for similar needs</Text>
              <View style={styles.categoryGrid}>
                {PRAYER_CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categoryChip,
                      selectedCategory === cat.id && styles.categoryChipActive,
                    ]}
                    onPress={() => {
                      setSelectedCategory(cat.id);
                      if (Platform.OS !== 'web') {
                        Haptics.selectionAsync();
                      }
                    }}
                  >
                    <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
                    <Text
                      style={[
                        styles.categoryText,
                        selectedCategory === cat.id && styles.categoryTextActive,
                      ]}
                    >
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Options */}
            <View style={styles.card}>
              <Text style={styles.label}>Options</Text>

              {/* Urgent Toggle */}
              <View style={styles.optionRow}>
                <View style={styles.optionInfo}>
                  <Text style={styles.optionEmoji}>🚨</Text>
                  <View>
                    <Text style={styles.optionTitle}>Mark as Urgent</Text>
                    <Text style={styles.optionHint}>Highlight this as a critical need</Text>
                  </View>
                </View>
                <Switch
                  value={isUrgent}
                  onValueChange={(value) => {
                    setIsUrgent(value);
                    if (Platform.OS !== 'web') {
                      Haptics.selectionAsync();
                    }
                  }}
                  trackColor={{ false: '#e2e8f0', true: '#fcd34d' }}
                  thumbColor={isUrgent ? '#f59e0b' : '#f4f4f5'}
                />
              </View>

              {/* Private Toggle */}
              <View style={styles.optionRow}>
                <View style={styles.optionInfo}>
                  <Text style={styles.optionEmoji}>🔒</Text>
                  <View>
                    <Text style={styles.optionTitle}>Private Request</Text>
                    <Text style={styles.optionHint}>Only visible to your prayer groups</Text>
                  </View>
                </View>
                <Switch
                  value={isPrivate}
                  onValueChange={(value) => {
                    setIsPrivate(value);
                    if (Platform.OS !== 'web') {
                      Haptics.selectionAsync();
                    }
                  }}
                  trackColor={{ false: '#e2e8f0', true: '#fcd34d' }}
                  thumbColor={isPrivate ? '#f59e0b' : '#f4f4f5'}
                />
              </View>

              {/* Anonymous Toggle */}
              <View style={styles.optionRow}>
                <View style={styles.optionInfo}>
                  <Text style={styles.optionEmoji}>🎭</Text>
                  <View>
                    <Text style={styles.optionTitle}>Post Anonymously</Text>
                    <Text style={styles.optionHint}>Your name won&apos;t be shown to others</Text>
                  </View>
                </View>
                <Switch
                  value={isAnonymous}
                  onValueChange={(value) => {
                    setIsAnonymous(value);
                    if (Platform.OS !== 'web') {
                      Haptics.selectionAsync();
                    }
                  }}
                  trackColor={{ false: '#e2e8f0', true: '#fcd34d' }}
                  thumbColor={isAnonymous ? '#f59e0b' : '#f4f4f5'}
                />
              </View>

              {/* Shareable Toggle */}
              <View style={[styles.optionRow, styles.optionRowLast]}>
                <View style={styles.optionInfo}>
                  <Text style={styles.optionEmoji}>📤</Text>
                  <View>
                    <Text style={styles.optionTitle}>Allow Sharing</Text>
                    <Text style={styles.optionHint}>Let others share your request outside the app</Text>
                  </View>
                </View>
                <Switch
                  value={isShareable}
                  onValueChange={(value) => {
                    setIsShareable(value);
                    if (Platform.OS !== 'web') {
                      Haptics.selectionAsync();
                    }
                  }}
                  trackColor={{ false: '#e2e8f0', true: '#fcd34d' }}
                  thumbColor={isShareable ? '#f59e0b' : '#f4f4f5'}
                />
              </View>
            </View>

            {/* Preview */}
            {content.trim().length > 0 && (
              <View style={styles.previewCard}>
                <Text style={styles.previewLabel}>Preview</Text>
                <View style={styles.previewContent}>
                  <View style={styles.previewHeader}>
                    <Text style={styles.previewName}>{isAnonymous ? 'Anonymous' : (user?.displayName || 'You')}</Text>
                    {isUrgent && <Text style={styles.urgentBadge}>🚨 URGENT</Text>}
                    {isPrivate && <Text style={styles.privateBadge}>🔒 Private</Text>}
                    {isAnonymous && <Text style={styles.anonymousBadge}>🎭 Anonymous</Text>}
                  </View>
                  <View style={styles.previewCategory}>
                    <Text style={styles.previewCategoryEmoji}>{getCategoryEmoji(selectedCategory)}</Text>
                    <Text style={styles.previewCategoryText}>
                      {PRAYER_CATEGORIES.find(c => c.id === selectedCategory)?.label}
                    </Text>
                  </View>
                  <Text style={styles.previewText}>{content}</Text>
                </View>
              </View>
            )}

            {/* Submit Button */}
            <TouchableOpacity
              style={[
                styles.submitButton,
                (!content.trim() || submitting) && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!content.trim() || submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#1f2937" />
              ) : (
                <>
                  <Ionicons name="send" size={20} color="#1f2937" />
                  <Text style={styles.submitText}>
                    {offline ? 'Save for Later' : 'Submit Prayer Request'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* Encouragement */}
            <Text style={styles.encouragement}>
              &quot;Therefore I tell you, whatever you ask for in prayer, believe that you have received it, and it will be yours.&quot; — Mark 11:24
            </Text>
            </ScrollView>
          </KeyboardAvoidingView>
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
    alignItems: 'center',
    flex: 1,
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
  
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 140,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  backButton: {
    padding: spacing.sm,
    marginLeft: -spacing.sm,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 20,
    fontWeight: '700',
    color: palette.text,
  },
  placeholder: {
    width: 40,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fee2e2',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: '#fecdd3',
  },
  offlineText: {
    color: '#b91c1c',
    fontWeight: '600',
    fontSize: 13,
    flex: 1,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: palette.border,
  },
  label: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    fontWeight: '600',
    color: palette.text,
    marginBottom: spacing.xs,
  },
  hint: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: palette.muted,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  textArea: {
    minHeight: 100,
    fontSize: 14,
    color: palette.text,
    lineHeight: 20,
    padding: spacing.sm,
    backgroundColor: '#f8fafc',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
  },
  charCount: {
    textAlign: 'right',
    fontSize: 12,
    color: palette.muted,
    marginTop: spacing.sm,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: palette.border,
    gap: spacing.xs,
    marginBottom: 2,
  },
  categoryChipActive: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  categoryEmoji: {
    fontSize: 14,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '500',
    color: palette.muted,
  },
  categoryTextActive: {
    color: '#1f2937',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  optionRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  optionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  optionEmoji: {
    fontSize: 18,
  },
  optionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.text,
  },
  optionHint: {
    fontSize: 11,
    color: palette.muted,
    marginTop: 1,
  },
  previewCard: {
    backgroundColor: '#fef3c7',
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: '#fcd34d',
  },
  previewLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#92400e',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  previewContent: {
    backgroundColor: '#fff',
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  previewName: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.text,
  },
  urgentBadge: {
    fontSize: 9,
    fontWeight: '600',
    color: '#dc2626',
    backgroundColor: '#fee2e2',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  privateBadge: {
    fontSize: 9,
    fontWeight: '600',
    color: '#6b7280',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  anonymousBadge: {
    fontSize: 9,
    fontWeight: '600',
    color: '#7c3aed',
    backgroundColor: '#ede9fe',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  previewCategory: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginBottom: spacing.xs,
  },
  previewCategoryEmoji: {
    fontSize: 12,
  },
  previewCategoryText: {
    fontSize: 11,
    color: palette.muted,
    fontWeight: '500',
  },
  previewText: {
    fontSize: 12,
    color: palette.text,
    lineHeight: 18,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.accent,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.md,
    marginTop: spacing.xs,
    
    
    
    
    elevation: 4,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2937',
  },
  encouragement: {
    fontSize: 11,
    fontStyle: 'italic',
    color: palette.muted,
    textAlign: 'center',
    lineHeight: 16,
  },
});

