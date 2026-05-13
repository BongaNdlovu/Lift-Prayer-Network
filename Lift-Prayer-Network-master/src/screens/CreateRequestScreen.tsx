import React, { useState } from 'react';
import {
  Alert,
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
import { Ionicons } from '@expo/vector-icons';
import { useNetInfo } from '@react-native-community/netinfo';
import * as Haptics from 'expo-haptics';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../hooks/useAuth';
import { submitFeedItem } from '../hooks/useFeed';
import { queuePendingRequest } from '../services/offlineCache';
import { useTheme } from '../contexts/ThemeContext';
import { fonts, radius, spacing } from '../theme/colors';
import { LiftScreen } from '../components/LiftLayout';
import { PRAYER_CATEGORIES, PrayerCategory, SupportPreference } from '../types';
import { validateContent, checkRateLimit, checkDailyLimit, CONTENT_LIMITS } from '../utils/security';
import { checkUserBlockedFromPosting } from '../services/moderation';
import { InlineError } from '../components/InlineError';
import type { RootStackParamList } from '../navigation/types';
import { validatePrivacyFields, normalizePrivacyFields } from '../utils/contentPrivacy';
import type { RequestVisibility } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateRequest'>;

export const CreateRequestScreen: React.FC<Props> = ({ route, navigation }) => {
  const { user } = useAuth();
  const { colors } = useTheme();

  const netInfo = useNetInfo();
  const groupId = route.params?.groupId;
  const groupName = route.params?.groupName;
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<PrayerCategory>('other');
  const [isUrgent, setIsUrgent] = useState(false);
  const [isPrivate, setIsPrivate] = useState(!!groupId);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isShareable, setIsShareable] = useState(true); // Default to shareable
  const [supportPreference, setSupportPreference] = useState<SupportPreference>('ENCOURAGEMENT_WELCOME');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const offline = netInfo.isConnected === false;

  const handleSubmit = async () => {
    setErrorMessage(null);
    if (!title.trim()) {
      Alert.alert('Add a title', 'Please add a short summary for this prayer request.');
      return;
    }

    if (!content.trim()) {
      Alert.alert('Empty', 'Please share what you need prayer for.');
      return;
    }

    // Security check: Check if user is blocked from posting
    if (user) {
      const blockStatus = await checkUserBlockedFromPosting(user.uid);
      if (blockStatus.isBlocked) {
        Alert.alert(
          'Posting Restricted',
          blockStatus.reason || 'Your posting privileges have been suspended.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
        return;
      }
    }

    // Security check: Require email verification for non-anonymous users
    if (user && !user.isAnonymous && !user.emailVerified) {
      Alert.alert(
        'Verify Email',
        'Please verify your email address before posting.',
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

    const titleValidation = validateContent(title, {
      minLength: 3,
      maxLength: 90,
      checkProfanity: true,
      checkSuspicious: true,
      checkMoneySolicitation: true,
      contentType: 'REQUEST',
    });

    if (!titleValidation.isValid) {
      Alert.alert('Cannot Submit', titleValidation.error || 'Please revise your title.');
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
      Alert.alert('Sign In', 'Please sign in to submit a prayer request.');
      return;
    }

    // Rate limiting check - per minute
    if (!checkRateLimit(`prayer_create_${user.uid}`, 3, 60000)) {
      Alert.alert('Please Wait', 'You are submitting too many requests. Please wait.');
      return;
    }

    // Daily limit check
    const dailyCheck = checkDailyLimit(`prayer_daily_${user.uid}`, CONTENT_LIMITS.PRAYER_REQUESTS_PER_DAY);
    if (!dailyCheck.allowed) {
      Alert.alert(
        'Daily Limit',
        `You can only submit ${CONTENT_LIMITS.PRAYER_REQUESTS_PER_DAY} prayer requests per day.`
      );
      return;
    }

    await proceedWithSubmit(validation.sanitized || content.trim(), titleValidation.sanitized || title.trim());
  };

  const proceedWithSubmit = async (sanitizedContent: string, sanitizedTitle: string = title.trim()) => {
    if (!user) return;

    // Validate and normalize privacy settings
    const privacyInput = {
      visibility: (groupId ? 'GROUP' : isPrivate ? 'PRIVATE' : 'PUBLIC') as RequestVisibility,
      isPrivate,
      groupIds: groupId ? [groupId] : undefined,
    };

    const privacyError = validatePrivacyFields(privacyInput);
    if (privacyError) {
      Alert.alert('Privacy Setting Needed', privacyError);
      setSubmitting(false);
      return;
    }

    const privacy = normalizePrivacyFields(privacyInput);

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
          isPrivate: privacy.isPrivate,
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
          title: sanitizedTitle,
          isUrgent,
          ...privacy,
          userEmail: isAnonymous ? undefined : (user.email || undefined),
          userPhotoURL: isAnonymous ? null : (user.photoURL || null),
          isAnonymous,
          isShareable,
          supportPreference,
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
    <LiftScreen scroll>
      {/* === HEADER SECTION === */}
      <View style={styles.headerSection}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.heading, { color: colors.text }]}>
            New Prayer Request
          </Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      {/* === MAIN CONTENT === */}
      <View style={styles.mainContent}>
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
            <View style={[styles.card, { borderColor: colors.border }]}>
              <Text style={[styles.label, { color: colors.text }]}>Short Summary</Text>
              <TextInput
                style={[styles.titleInput, { color: colors.text, borderColor: colors.border }]}
                placeholder="A short title for this prayer"
                placeholderTextColor={colors.muted}
                value={title}
                onChangeText={setTitle}
                maxLength={90}
              />
              <Text style={[styles.charCount, { color: colors.muted }]}>{title.length}/90</Text>
            </View>

            <View style={[styles.card, { borderColor: colors.border }]}>
              <Text style={[styles.label, { color: colors.text }]}>Prayer Details</Text>
              <TextInput
                style={[styles.textArea, { color: colors.text, borderColor: colors.border }]}
                placeholder="What do you need prayer for?"
                placeholderTextColor={colors.muted}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                value={content}
                onChangeText={setContent}
                maxLength={1000}
              />
              <Text style={[styles.charCount, { color: colors.muted }]}>{content.length}/1000</Text>
            </View>

            {/* Category Selection */}
            <View style={[styles.card, { borderColor: colors.border }]}>
              <Text style={[styles.label, { color: colors.text }]}>Category</Text>
              <View style={styles.categoryGrid}>
                {PRAYER_CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categoryChip,
                      { borderColor: colors.border },
                      selectedCategory === cat.id && [styles.categoryChipActive, { borderColor: colors.accentDark }],
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
                        { color: colors.muted },
                        selectedCategory === cat.id && [styles.categoryTextActive, { color: colors.text }],
                      ]}
                    >
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Options */}
            <View style={[styles.card, { borderColor: colors.border }]}>
              <Text style={[styles.label, { color: colors.text }]}>Options</Text>
              {groupName && (
                <View style={styles.groupNotice}>
                  <Ionicons name="people-outline" size={16} color="#7c3aed" />
                  <Text style={styles.groupNoticeText}>Sharing with {groupName}</Text>
                </View>
              )}

              {/* Urgent Toggle */}
              <View style={[styles.optionRow, { borderBottomColor: colors.border }]}>
                <View style={styles.optionInfo}>
                  <Text style={styles.optionEmoji}>🚨</Text>
                  <View>
                    <Text style={[styles.optionTitle, { color: colors.text }]}>Urgent</Text>
                    <Text style={[styles.optionHint, { color: colors.muted }]}>Critical need</Text>
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
                  thumbColor={isUrgent ? '#4A5D4E' : '#f4f4f5'}
                />
              </View>

              {/* Private Toggle */}
              <View style={[styles.optionRow, { borderBottomColor: colors.border }]}>
                <View style={styles.optionInfo}>
                  <Text style={styles.optionEmoji}>🔒</Text>
                  <View>
                    <Text style={[styles.optionTitle, { color: colors.text }]}>Private</Text>
                    <Text style={[styles.optionHint, { color: colors.muted }]}>Groups only</Text>
                  </View>
                </View>
                <Switch
                  value={isPrivate}
                  onValueChange={(value) => {
                    if (groupId) return;
                    setIsPrivate(value);
                    if (Platform.OS !== 'web') {
                      Haptics.selectionAsync();
                    }
                  }}
                  trackColor={{ false: '#e2e8f0', true: '#fcd34d' }}
                  thumbColor={isPrivate ? '#4A5D4E' : '#f4f4f5'}
                />
              </View>

              <View style={styles.supportBox}>
                <Text style={[styles.supportLabel, { color: colors.muted }]}>Support Preference</Text>
                {([
                  ['PRAYER_ONLY', 'Prayer only'],
                  ['ENCOURAGEMENT_WELCOME', 'Encouragement welcome'],
                  ['FOLLOW_UP_WELCOME', 'Follow-up welcome'],
                ] as [SupportPreference, string][]).map(([value, label]) => (
                  <TouchableOpacity
                    key={value}
                    style={[
                      styles.supportOption,
                      { borderColor: colors.border },
                      supportPreference === value && [styles.supportOptionActive, { borderColor: colors.accentDark }],
                    ]}
                    onPress={() => setSupportPreference(value)}
                  >
                    <Text
                      style={[
                        styles.supportOptionText,
                        { color: colors.muted },
                        supportPreference === value && [styles.supportOptionTextActive, { color: colors.text }],
                      ]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Anonymous Toggle */}
              <View style={[styles.optionRow, { borderBottomColor: colors.border }]}>
                <View style={styles.optionInfo}>
                  <Text style={styles.optionEmoji}>🎭</Text>
                  <View>
                    <Text style={[styles.optionTitle, { color: colors.text }]}>Anonymous</Text>
                    <Text style={[styles.optionHint, { color: colors.muted }]}>Hide name</Text>
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
                  thumbColor={isAnonymous ? '#4A5D4E' : '#f4f4f5'}
                />
              </View>

              {/* Shareable Toggle */}
              <View style={[styles.optionRow, styles.optionRowLast]}>
                <View style={styles.optionInfo}>
                  <Text style={styles.optionEmoji}>📤</Text>
                  <View>
                    <Text style={styles.optionTitle}>Shareable</Text>
                    <Text style={styles.optionHint}>Allow sharing</Text>
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
                  thumbColor={isShareable ? '#4A5D4E' : '#f4f4f5'}
                />
              </View>
            </View>

            {/* Preview */}
            {(title.trim().length > 0 || content.trim().length > 0) && (
              <View style={[styles.previewCard, { borderColor: colors.accentDark }]}>
                <Text style={[styles.previewLabel, { color: colors.text }]}>Preview</Text>
                <View style={styles.previewContent}>
                  <View style={styles.previewHeader}>
                    <Text style={[styles.previewName, { color: colors.text }]}>{isAnonymous ? 'Anonymous' : (user?.displayName || 'You')}</Text>
                    {isUrgent && <Text style={[styles.urgentBadge, { color: '#dc2626' }]}>🚨 URGENT</Text>}
                    {isPrivate && <Text style={[styles.privateBadge, { color: colors.muted }]}>🔒 Private</Text>}
                    {isAnonymous && <Text style={[styles.anonymousBadge, { color: colors.accent }]}>🎭 Anonymous</Text>}
                  </View>
                  <View style={styles.previewCategory}>
                    <Text style={styles.previewCategoryEmoji}>{getCategoryEmoji(selectedCategory)}</Text>
                    <Text style={[styles.previewCategoryText, { color: colors.muted }]}>
                      {PRAYER_CATEGORIES.find(c => c.id === selectedCategory)?.label}
                    </Text>
                  </View>
                  <Text style={[styles.previewTitle, { color: colors.text }]}>{title || 'Prayer request summary'}</Text>
                  <Text style={[styles.previewText, { color: colors.text }]}>{content}</Text>
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
              disabled={!content.trim() || !title.trim() || submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#2C332E" />
              ) : (
                <>
                  <Ionicons name="send" size={20} color="#2C332E" />
                  <Text style={styles.submitText}>
                    {offline ? 'Save for Later' : 'Submit Prayer Request'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* Encouragement */}
            <Text style={[styles.encouragement, { color: colors.muted }]}>
              &quot;Therefore I tell you, whatever you ask for in prayer, believe that you have received it, and it will be yours.&quot; — Mark 11:24
            </Text>
            </ScrollView>
          </KeyboardAvoidingView>
      </View>
    </LiftScreen>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
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
    fontFamily: fonts.heading,
    fontSize: 32,
    fontWeight: '500',
    letterSpacing: -1,
    lineHeight: 36,
    color: '#2C332E',
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
  },
  label: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  hint: {
    fontFamily: fonts.body,
    fontSize: 12,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  textArea: {
    minHeight: 100,
    fontSize: 14,
    lineHeight: 20,
    padding: spacing.sm,
    backgroundColor: '#FAF8F5',
    borderRadius: radius.md,
    borderWidth: 1,
  },
  titleInput: {
    fontSize: 15,
    padding: spacing.sm,
    backgroundColor: '#FAF8F5',
    borderRadius: radius.md,
    borderWidth: 1,
  },
  charCount: {
    textAlign: 'right',
    fontSize: 12,
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
    backgroundColor: '#FAF8F5',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
    gap: spacing.xs,
    marginBottom: 2,
  },
  categoryChipActive: {
    backgroundColor: '#F7F1E8',
  },
  categoryEmoji: {
    fontSize: 14,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '500',
  },
  categoryTextActive: {
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  optionRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  groupNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: '#ede9fe',
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  groupNoticeText: {
    color: '#7c3aed',
    fontSize: 12,
    fontWeight: '700',
  },
  supportBox: {
    paddingTop: spacing.sm,
    gap: spacing.xs,
  },
  supportLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  supportOption: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: '#FAF8F5',
  },
  supportOptionActive: {
    backgroundColor: '#F7F1E8',
  },
  supportOptionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  supportOptionTextActive: {
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
  },
  optionLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  optionHint: {
    fontSize: 11,
    marginTop: 1,
  },
  previewCard: {
    backgroundColor: '#F7F1E8',
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
  },
  previewLabel: {
    fontSize: 10,
    fontWeight: '600',
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
  },
  urgentBadge: {
    fontSize: 9,
    fontWeight: '600',
    backgroundColor: '#fee2e2',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  privateBadge: {
    fontSize: 9,
    fontWeight: '600',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  anonymousBadge: {
    fontSize: 9,
    fontWeight: '600',
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
    fontWeight: '500',
  },
  previewText: {
    fontSize: 12,
    lineHeight: 18,
  },
  previewTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 3,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#B8956B',
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.md,
    marginTop: spacing.xs,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2C332E',
  },
  encouragement: {
    fontSize: 11,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 16,
  },
});
