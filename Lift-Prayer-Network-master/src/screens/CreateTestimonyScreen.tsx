import React, { useMemo, useRef, useState } from 'react';
import {
  Alert,
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
import { Ionicons } from '@expo/vector-icons';
import { useNetInfo } from '@react-native-community/netinfo';
import * as Haptics from 'expo-haptics';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../hooks/useAuth';
import { useFeed, submitFeedItem } from '../hooks/useFeed';
import { subscribeToUserGroups } from '../services/groups';
import { Confetti } from '../components/Confetti';
import { useTheme } from '../contexts/ThemeContext';
import { fonts, radius, spacing } from '../theme/colors';
import { LiftFormSection, LiftScreen, LiftTopBar } from '../components/LiftLayout';
import { validateContent, checkRateLimit, checkDailyLimit, CONTENT_LIMITS } from '../utils/security';
import { checkUserBlockedFromPosting } from '../services/moderation';
import type { RootStackParamList } from '../navigation/types';
import type { PrayerGroup } from '../types';
import { validatePrivacyFields, normalizePrivacyFields } from '../utils/contentPrivacy';

type VisibilityOption = 'PUBLIC' | 'PRIVATE' | 'GROUP';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateTestimony'>;

export const CreateTestimonyScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuth();
  const { colors } = useTheme();

  const netInfo = useNetInfo();
  const { items: allRequests } = useFeed('REQUEST', user?.uid);
  const [content, setContent] = useState('');
  const [linkedRequestId, setLinkedRequestId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  
  // Privacy options
  const [visibility, setVisibility] = useState<VisibilityOption>('PUBLIC');
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [userGroups, setUserGroups] = useState<PrayerGroup[]>([]);

  const offline = netInfo.isConnected === false;
  const alertTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  React.useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (alertTimeoutRef.current) clearTimeout(alertTimeoutRef.current);
    };
  }, []);
  
  // Load user's groups
  React.useEffect(() => {
    if (!user?.uid) return;
    const unsub = subscribeToUserGroups(user.uid, (groups) => {
      setUserGroups(groups);
    });
    return () => unsub();
  }, [user?.uid]);

  // Get user's own requests that can be linked
  const userRequests = useMemo(() => {
    if (!user) return [];
    return allRequests.filter(
      (item) => item.type === 'REQUEST' && item.ownerUid === user.uid
    );
  }, [allRequests, user]);

  const handleSubmit = async () => {
    if (!content.trim()) {
      Alert.alert('Empty Testimony', 'Please share how God answered your prayer.', [{ text: 'OK' }]);
      return;
    }

    // Validate privacy settings
    const privacyError = validatePrivacyFields({
      visibility,
      isPrivate: visibility === 'PRIVATE',
      groupIds: selectedGroupIds,
    });
    if (privacyError) {
      Alert.alert('Privacy Setting Needed', privacyError, [{ text: 'OK' }]);
      return;
    }

    // Security check: Check if user is blocked from posting
    if (user) {
      try {
        const blockStatus = await checkUserBlockedFromPosting(user.uid);
        if (blockStatus.isBlocked) {
          Alert.alert(
            'Posting Restricted',
            blockStatus.reason || 'Your posting privileges have been suspended. You can still view and pray for others.',
            [{ text: 'OK', onPress: () => navigation.goBack() }]
          );
          return;
        }
      } catch {
        Alert.alert('Error', 'Could not verify posting status. Please try again.');
        return;
      }
    }

    // Security check: require email confirmation for non-anonymous users
    if (user && !user.isAnonymous && !user.emailVerified) {
      Alert.alert(
        'Email Confirmation Required',
        'To prevent scammers and ensure community trust, please confirm your email address before sharing testimonies.\n\nCheck your inbox for a confirmation link, or go to your Profile to resend it.',
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
      Alert.alert('Cannot Submit', validation.error || 'Please revise your testimony.', [{ text: 'OK' }]);
      return;
    }

    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to share a testimony.', [{ text: 'OK' }]);
      return;
    }

    // Rate limiting check - per minute
    if (!checkRateLimit(`testimony_create_${user.uid}`, 2, 60000)) {
      Alert.alert('Please Wait', 'You are submitting too many testimonies. Please wait a moment before trying again.', [{ text: 'OK' }]);
      return;
    }

    // Daily limit check
    const dailyCheck = checkDailyLimit(`testimony_daily_${user.uid}`, CONTENT_LIMITS.TESTIMONIES_PER_DAY);
    if (!dailyCheck.allowed) {
      Alert.alert(
        'Daily Limit Reached',
        `You can only share ${CONTENT_LIMITS.TESTIMONIES_PER_DAY} testimonies per day. This helps keep our community focused and meaningful. Try again tomorrow!`,
        [{ text: 'OK' }]
      );
      return;
    }

    if (offline) {
      Alert.alert('Offline', 'You need to be online to share a testimony.', [{ text: 'OK' }]);
      return;
    }

    // Linking to a prayer request is optional - just encourage it if they have requests
    // No longer blocking submission without a linked request

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

    // Normalize privacy settings
    const privacy = normalizePrivacyFields({
      visibility,
      isPrivate: visibility === 'PRIVATE',
      groupIds: selectedGroupIds,
    });

    setSubmitting(true);

    try {
      await submitFeedItem('TESTIMONY', sanitizedContent, user.uid, user.displayName || 'Anonymous', {
        linkedRequestId: linkedRequestId || undefined,
        userEmail: user.email || undefined,
        userPhotoURL: user.photoURL || null,
        ...privacy,
        isEmailVerified: user.emailVerified || false,
      });

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      setShowConfetti(true);

      alertTimeoutRef.current = setTimeout(() => {
        if (!isMountedRef.current) return;
        Alert.alert(
          '🎉 Testimony Shared!',
          'Your testimony has been shared with the community. Praise God for answered prayers!',
          [{ text: 'Amen!', onPress: () => { if (isMountedRef.current) navigation.goBack(); } }]
        );
      }, 1500);
    } catch (error: any) {
      if (isMountedRef.current) {
        Alert.alert('Error', error.message || 'Could not share your testimony. Please try again.', [{ text: 'OK' }]);
        setSubmitting(false);
      }
    }
  };

  return (
    <LiftScreen scroll>
      <Confetti active={showConfetti} onComplete={() => setShowConfetti(false)} />
      <LiftTopBar title="Share Testimony" onBack={() => navigation.goBack()} />

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

            {/* Celebration Banner */}
            <View style={styles.celebrationBanner}>
              <Text style={styles.celebrationEmoji}>🙌</Text>
              <View style={styles.celebrationContent}>
                <Text style={styles.celebrationTitle}>Celebrate God&apos;s Faithfulness!</Text>
                <Text style={styles.celebrationText}>
                  Share how God answered your prayer and encourage others in their faith journey.
                </Text>
              </View>
            </View>

            <LiftFormSection label="How did God answer your prayer?" hint={`${content.length}/1500`}>
              <TextInput
                style={[styles.textArea, { color: colors.text, borderColor: colors.border }]}
                placeholder="Share your testimony of God's faithfulness..."
                placeholderTextColor={colors.muted}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                value={content}
                onChangeText={setContent}
                maxLength={1500}
              />
            </LiftFormSection>

            {/* Link to Original Request */}
            {userRequests.length > 0 && (
              <View style={[styles.card, { borderColor: colors.border }]}>
                <Text style={[styles.label, { color: colors.text }]}>Link to Prayer Request (Optional)</Text>
                <Text style={[styles.hint, { color: colors.muted }]}>
                  Link your testimony to a prayer request to notify everyone who prayed for you.
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
                      <Ionicons name="close-circle" size={20} color={colors.muted} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.requestList}>
                    {userRequests.slice(0, 5).map((req) => (
                      <TouchableOpacity
                        key={req.id}
                        style={[styles.requestChip, { borderColor: colors.border }]}
                        onPress={() => {
                          setLinkedRequestId(req.id);
                          if (Platform.OS !== 'web') {
                            Haptics.selectionAsync();
                          }
                        }}
                      >
                        <Ionicons name="link" size={14} color={colors.muted} />
                        <Text style={[styles.requestChipText, { color: colors.muted }]} numberOfLines={1}>
                          {req.content.slice(0, 50)}...
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            )}

            <LiftFormSection label="Who can see this testimony?">
              <View style={styles.visibilityOptions}>
                <TouchableOpacity
                  style={[
                    styles.visibilityOption,
                    { borderColor: colors.border },
                    visibility === 'PUBLIC' && [styles.visibilityOptionActive, { borderColor: colors.accentDark }],
                  ]}
                  onPress={() => {
                    setVisibility('PUBLIC');
                    setSelectedGroupIds([]);
                    if (Platform.OS !== 'web') Haptics.selectionAsync();
                  }}
                >
                  <Ionicons 
                    name="globe-outline" 
                    size={20} 
                    color={visibility === 'PUBLIC' ? '#166534' : colors.muted} 
                  />
                  <Text style={[styles.visibilityOptionText, { color: colors.muted }, visibility === 'PUBLIC' && [styles.visibilityOptionTextActive, { color: colors.text }]]}>
                    Everyone
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.visibilityOption,
                    { borderColor: colors.border },
                    visibility === 'PRIVATE' && [styles.visibilityOptionActive, { borderColor: colors.accentDark }],
                  ]}
                  onPress={() => {
                    setVisibility('PRIVATE');
                    setSelectedGroupIds([]);
                    if (Platform.OS !== 'web') Haptics.selectionAsync();
                  }}
                >
                  <Ionicons 
                    name="lock-closed-outline" 
                    size={20} 
                    color={visibility === 'PRIVATE' ? '#166534' : colors.muted} 
                  />
                  <Text style={[styles.visibilityOptionText, { color: colors.muted }, visibility === 'PRIVATE' && [styles.visibilityOptionTextActive, { color: colors.text }]]}>
                    Only Me
                  </Text>
                </TouchableOpacity>
                
                {userGroups.length > 0 && (
                  <TouchableOpacity
                    style={[
                    styles.visibilityOption,
                    { borderColor: colors.border },
                    visibility === 'GROUP' && [styles.visibilityOptionActive, { borderColor: colors.accentDark }],
                  ]}
                    onPress={() => {
                      setVisibility('GROUP');
                      if (Platform.OS !== 'web') Haptics.selectionAsync();
                    }}
                  >
                    <Ionicons 
                      name="people-outline" 
                      size={20} 
                      color={visibility === 'GROUP' ? '#166534' : colors.muted} 
                    />
                    <Text style={[styles.visibilityOptionText, { color: colors.muted }, visibility === 'GROUP' && [styles.visibilityOptionTextActive, { color: colors.text }]]}>
                      Groups
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              
              {/* Group Selection */}
              {visibility === 'GROUP' && userGroups.length > 0 && (
                <View style={styles.groupSelection}>
                  <Text style={[styles.hint, { color: colors.muted }]}>Select groups to share with:</Text>
                  {userGroups.map((group) => (
                    <TouchableOpacity
                      key={group.id}
                      style={[
                        styles.groupChip,
                        { borderColor: colors.border },
                        selectedGroupIds.includes(group.id) && [styles.groupChipSelected, { borderColor: colors.accentDark }],
                      ]}
                      onPress={() => {
                        setSelectedGroupIds((prev) =>
                          prev.includes(group.id)
                            ? prev.filter((id) => id !== group.id)
                            : [...prev, group.id]
                        );
                        if (Platform.OS !== 'web') Haptics.selectionAsync();
                      }}
                    >
                      <Text style={styles.groupChipEmoji}>{group.emoji || '🙏'}</Text>
                      <Text style={[
                        styles.groupChipText,
                        { color: colors.muted },
                        selectedGroupIds.includes(group.id) && [styles.groupChipTextSelected, { color: colors.text }],
                      ]}>
                        {group.name}
                      </Text>
                      {selectedGroupIds.includes(group.id) && (
                        <Ionicons name="checkmark-circle" size={16} color="#166534" />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </LiftFormSection>

            {/* Preview */}
            {content.trim().length > 0 && (
              <View style={styles.previewCard}>
                <Text style={styles.previewLabel}>Preview</Text>
                <View style={styles.previewContent}>
                  <View style={styles.previewHeader}>
                    <Text style={[styles.previewName, { color: colors.text }]}>{user?.displayName || 'You'}</Text>
                    <View style={styles.resolvedBadge}>
                      <Ionicons name="checkmark-circle" size={14} color="#22c55e" />
                      <Text style={styles.resolvedBadgeText}>Answered Prayer</Text>
                    </View>
                  </View>
                  <Text style={[styles.previewText, { color: colors.text }]}>{content}</Text>
                  {linkedRequestId && (
                    <View style={[styles.previewLinked, { borderTopColor: colors.border }]}>
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
                <ActivityIndicator color="#2C332E" />
              ) : (
                <>
                  <Ionicons name="sparkles" size={20} color="#2C332E" />
                  <Text style={styles.submitText}>Share Testimony</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Encouragement */}
            <Text style={[styles.encouragement, { color: colors.muted }]}>
              &quot;Come and hear, all you who fear God; let me tell you what he has done for me.&quot; — Psalm 66:16
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
    fontSize: 20,
    fontWeight: '800',
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
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  hint: {
    fontSize: 13,
    marginBottom: spacing.md,
  },
  textArea: {
    minHeight: 140,
    fontSize: 16,
    lineHeight: 24,
    padding: spacing.md,
    backgroundColor: '#FAF8F5',
    borderRadius: radius.md,
    borderWidth: 1,
  },
  charCount: {
    textAlign: 'right',
    fontSize: 12,
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
    backgroundColor: '#FAF8F5',
    padding: spacing.md,
    borderRadius: radius.md,
    gap: spacing.sm,
    borderWidth: 1,
  },
  requestChipText: {
    flex: 1,
    fontSize: 13,
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
    lineHeight: 20,
  },
  previewLinked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
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
    textAlign: 'center',
    lineHeight: 20,
  },
  // Privacy options styles
  visibilityOptions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  visibilityOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
  },
  visibilityOptionActive: {
    backgroundColor: '#dcfce7',
    borderColor: '#bbf7d0',
  },
  visibilityOptionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  visibilityOptionTextActive: {
    color: '#166534',
  },
  groupSelection: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  groupChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    gap: spacing.sm,
  },
  groupChipSelected: {
    backgroundColor: '#dcfce7',
    borderColor: '#bbf7d0',
  },
  groupChipEmoji: {
    fontSize: 18,
  },
  groupChipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  groupChipTextSelected: {
    color: '#166534',
  },
});
