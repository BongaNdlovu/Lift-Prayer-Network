import React, { useState } from 'react';
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
import { palette, radius, spacing } from '../theme/colors';
import { PRAYER_CATEGORIES, PrayerCategory } from '../types';
import { validateContent, checkRateLimit, checkDailyLimit, CONTENT_LIMITS } from '../utils/security';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateRequest'>;

export const CreateRequestScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuth();
  const netInfo = useNetInfo();
  const [content, setContent] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<PrayerCategory>('other');
  const [isUrgent, setIsUrgent] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const offline = netInfo.isConnected === false;

  const handleSubmit = async () => {
    if (!content.trim()) {
      Alert.alert('Empty Request', 'Please share what you need prayer for.');
      return;
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
      if (offline) {
        // Queue for later sync
        await queuePendingRequest({
          content: sanitizedContent,
          ownerUid: user.uid,
          displayName: user.displayName || 'Anonymous',
          category: selectedCategory,
          isUrgent,
          isPrivate,
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
        await submitFeedItem('REQUEST', sanitizedContent, user.uid, isAnonymous ? 'Anonymous' : (user.displayName || 'Anonymous'), {
          category: selectedCategory,
          isUrgent,
          isPrivate,
          userEmail: isAnonymous ? undefined : (user.email || undefined),
          userPhotoURL: isAnonymous ? null : (user.photoURL || null),
          isAnonymous,
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
      Alert.alert('Error', error.message || 'Could not submit your request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const getCategoryEmoji = (categoryId: PrayerCategory): string => {
    return PRAYER_CATEGORIES.find(c => c.id === categoryId)?.emoji || '📝';
  };

  return (
    <LinearGradient colors={['#fefce8', '#f4f4f5']} style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color={palette.text} />
              </TouchableOpacity>
              <Text style={styles.title}>New Prayer Request</Text>
              <View style={styles.placeholder} />
            </View>

            {/* Offline Banner */}
            {offline && (
              <View style={styles.offlineBanner}>
                <Ionicons name="cloud-offline" size={18} color="#b91c1c" />
                <Text style={styles.offlineText}>You're offline. Request will be saved locally.</Text>
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
              <View style={[styles.optionRow, styles.optionRowLast]}>
                <View style={styles.optionInfo}>
                  <Text style={styles.optionEmoji}>🎭</Text>
                  <View>
                    <Text style={styles.optionTitle}>Post Anonymously</Text>
                    <Text style={styles.optionHint}>Your name won't be shown to others</Text>
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
              "Therefore I tell you, whatever you ask for in prayer, believe that you have received it, and it will be yours." — Mark 11:24
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 40,
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
    fontSize: 20,
    fontWeight: '800',
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
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: palette.border,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.text,
    marginBottom: 4,
  },
  hint: {
    fontSize: 13,
    color: palette.muted,
    marginBottom: spacing.md,
  },
  textArea: {
    minHeight: 120,
    fontSize: 16,
    color: palette.text,
    lineHeight: 24,
    padding: spacing.md,
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
    gap: spacing.md,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
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
    fontSize: 16,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.muted,
  },
  categoryTextActive: {
    color: '#1f2937',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
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
    gap: spacing.lg,
    flex: 1,
  },
  optionEmoji: {
    fontSize: 24,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: palette.text,
  },
  optionHint: {
    fontSize: 12,
    color: palette.muted,
    marginTop: 2,
  },
  previewCard: {
    backgroundColor: '#fef3c7',
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#fcd34d',
  },
  previewLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400e',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  previewContent: {
    backgroundColor: '#fff',
    borderRadius: radius.md,
    padding: spacing.md,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  previewName: {
    fontSize: 15,
    fontWeight: '700',
    color: palette.text,
  },
  urgentBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#dc2626',
    backgroundColor: '#fee2e2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  privateBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6b7280',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  anonymousBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7c3aed',
    backgroundColor: '#ede9fe',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  previewCategory: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: spacing.sm,
  },
  previewCategoryEmoji: {
    fontSize: 14,
  },
  previewCategoryText: {
    fontSize: 12,
    color: palette.muted,
    fontWeight: '600',
  },
  previewText: {
    fontSize: 14,
    color: palette.text,
    lineHeight: 20,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
    marginBottom: spacing.lg,
    marginTop: spacing.sm,
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1f2937',
  },
  encouragement: {
    fontSize: 13,
    fontStyle: 'italic',
    color: palette.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
});

