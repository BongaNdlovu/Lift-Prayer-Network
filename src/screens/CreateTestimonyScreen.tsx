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
import { useFeed, submitFeedItem } from '../hooks/useFeed';
import { Confetti } from '../components/Confetti';
import { palette, radius, spacing } from '../theme/colors';
import { validateContent, checkRateLimit, checkDailyLimit, CONTENT_LIMITS } from '../utils/security';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateTestimony'>;

export const CreateTestimonyScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuth();
  const netInfo = useNetInfo();
  const { items: allRequests } = useFeed('REQUEST', user?.uid);
  const [content, setContent] = useState('');
  const [linkedRequestId, setLinkedRequestId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  const offline = netInfo.isConnected === false;

  // Get user's own requests that can be linked
  const userRequests = useMemo(() => {
    if (!user) return [];
    return allRequests.filter(
      (item) => item.type === 'REQUEST' && item.ownerUid === user.uid && item.status !== 'RESOLVED'
    );
  }, [allRequests, user]);

  const handleSubmit = async () => {
    if (!content.trim()) {
      Alert.alert('Empty Testimony', 'Please share how God answered your prayer.');
      return;
    }

    // Security check: Require email verification for non-anonymous users
    if (user && !user.isAnonymous && !user.emailVerified) {
      Alert.alert(
        'Email Verification Required',
        'To prevent scammers and ensure community trust, please verify your email address before sharing testimonies.\n\nCheck your inbox for a verification link, or go to your Profile to resend it.',
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
    // Note: contentType 'TESTIMONY' allows GoFundMe links with a warning
    const validation = validateContent(content, {
      minLength: 10,
      maxLength: 1500,
      checkProfanity: true,
      checkSuspicious: true,
      checkMoneySolicitation: true,
      contentType: 'TESTIMONY',
    });

    if (!validation.isValid) {
      Alert.alert('Cannot Submit', validation.error || 'Please revise your testimony.');
      return;
    }

    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to share a testimony.');
      return;
    }

    // Rate limiting check - per minute
    if (!checkRateLimit(`testimony_create_${user.uid}`, 2, 60000)) {
      Alert.alert('Please Wait', 'You are submitting too many testimonies. Please wait a moment before trying again.');
      return;
    }

    // Daily limit check
    const dailyCheck = checkDailyLimit(`testimony_daily_${user.uid}`, CONTENT_LIMITS.TESTIMONIES_PER_DAY);
    if (!dailyCheck.allowed) {
      Alert.alert(
        'Daily Limit Reached',
        `You can only share ${CONTENT_LIMITS.TESTIMONIES_PER_DAY} testimonies per day. This helps keep our community focused and meaningful. Try again tomorrow!`
      );
      return;
    }

    if (offline) {
      Alert.alert('Offline', 'You need to be online to share a testimony.');
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

    await proceedWithSubmit(validation.sanitized || content.trim());
  };

  const proceedWithSubmit = async (sanitizedContent: string) => {
    if (!user) return;

    setSubmitting(true);

    try {
      await submitFeedItem('TESTIMONY', sanitizedContent, user.uid, user.displayName || 'Anonymous', {
        linkedRequestId: linkedRequestId || undefined,
        userEmail: user.email || undefined,
        userPhotoURL: user.photoURL || null,
      });

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      setShowConfetti(true);

      setTimeout(() => {
        Alert.alert(
          '🎉 Testimony Shared!',
          'Your testimony has been shared with the community. Praise God for answered prayers!',
          [{ text: 'Amen!', onPress: () => navigation.goBack() }]
        );
      }, 1500);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Could not share your testimony. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <LinearGradient colors={['#f0fdf4', '#ecfdf5']} style={{ flex: 1 }}>
      <Confetti active={showConfetti} onComplete={() => setShowConfetti(false)} />
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
              <Text style={styles.title}>Share Testimony</Text>
              <View style={styles.placeholder} />
            </View>

            {/* Celebration Banner */}
            <View style={styles.celebrationBanner}>
              <Text style={styles.celebrationEmoji}>🙌</Text>
              <View style={styles.celebrationContent}>
                <Text style={styles.celebrationTitle}>Celebrate God's Faithfulness!</Text>
                <Text style={styles.celebrationText}>
                  Share how God answered your prayer and encourage others in their faith journey.
                </Text>
              </View>
            </View>

            {/* Content Input */}
            <View style={styles.card}>
              <Text style={styles.label}>How did God answer your prayer?</Text>
              <TextInput
                style={styles.textArea}
                placeholder="Share your testimony of God's faithfulness..."
                placeholderTextColor={palette.muted}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                value={content}
                onChangeText={setContent}
                maxLength={1500}
              />
              <Text style={styles.charCount}>{content.length}/1500</Text>
            </View>

            {/* Link to Original Request */}
            {userRequests.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.label}>Link to Prayer Request</Text>
                <Text style={styles.hint}>
                  Connect this testimony to your original prayer request
                </Text>

                {linkedRequestId ? (
                  <View style={styles.linkedRequest}>
                    <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                    <Text style={styles.linkedRequestText} numberOfLines={2}>
                      {userRequests.find((r) => r.id === linkedRequestId)?.content}
                    </Text>
                    <TouchableOpacity
                      onPress={() => setLinkedRequestId(null)}
                      style={styles.unlinkButton}
                    >
                      <Ionicons name="close-circle" size={20} color={palette.muted} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.requestList}>
                    {userRequests.slice(0, 5).map((req) => (
                      <TouchableOpacity
                        key={req.id}
                        style={styles.requestChip}
                        onPress={() => {
                          setLinkedRequestId(req.id);
                          if (Platform.OS !== 'web') {
                            Haptics.selectionAsync();
                          }
                        }}
                      >
                        <Ionicons name="link" size={14} color={palette.muted} />
                        <Text style={styles.requestChipText} numberOfLines={1}>
                          {req.content.slice(0, 50)}...
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Preview */}
            {content.trim().length > 0 && (
              <View style={styles.previewCard}>
                <Text style={styles.previewLabel}>Preview</Text>
                <View style={styles.previewContent}>
                  <View style={styles.previewHeader}>
                    <Text style={styles.previewName}>{user?.displayName || 'You'}</Text>
                    <View style={styles.resolvedBadge}>
                      <Ionicons name="checkmark-circle" size={14} color="#22c55e" />
                      <Text style={styles.resolvedBadgeText}>Answered Prayer</Text>
                    </View>
                  </View>
                  <Text style={styles.previewText}>{content}</Text>
                  {linkedRequestId && (
                    <View style={styles.previewLinked}>
                      <Ionicons name="link" size={12} color="#6b7280" />
                      <Text style={styles.previewLinkedText}>Linked to prayer request</Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Submit Button */}
            <TouchableOpacity
              style={[
                styles.submitButton,
                (!content.trim() || submitting || offline) && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!content.trim() || submitting || offline}
            >
              {submitting ? (
                <ActivityIndicator color="#1f2937" />
              ) : (
                <>
                  <Ionicons name="sparkles" size={20} color="#1f2937" />
                  <Text style={styles.submitText}>Share Testimony</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Encouragement */}
            <Text style={styles.encouragement}>
              "Come and hear, all you who fear God; let me tell you what he has done for me." — Psalm 66:16
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
  celebrationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dcfce7',
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  celebrationEmoji: {
    fontSize: 36,
  },
  celebrationContent: {
    flex: 1,
  },
  celebrationTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#166534',
    marginBottom: 4,
  },
  celebrationText: {
    fontSize: 13,
    color: '#15803d',
    lineHeight: 18,
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
    minHeight: 140,
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
  linkedRequest: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    padding: spacing.md,
    borderRadius: radius.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  linkedRequestText: {
    flex: 1,
    fontSize: 14,
    color: '#166534',
    fontWeight: '500',
  },
  unlinkButton: {
    padding: 4,
  },
  requestList: {
    gap: spacing.sm,
  },
  requestChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: spacing.md,
    borderRadius: radius.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: palette.border,
  },
  requestChipText: {
    flex: 1,
    fontSize: 13,
    color: palette.muted,
  },
  previewCard: {
    backgroundColor: '#dcfce7',
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  previewLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
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
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  previewName: {
    fontSize: 15,
    fontWeight: '700',
    color: palette.text,
  },
  resolvedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  resolvedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#166534',
  },
  previewText: {
    fontSize: 14,
    color: palette.text,
    lineHeight: 20,
  },
  previewLinked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
  previewLinkedText: {
    fontSize: 12,
    color: '#6b7280',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22c55e',
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },
  encouragement: {
    fontSize: 13,
    fontStyle: 'italic',
    color: palette.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
});

