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
import { subscribeToUserGroups } from '../services/groups';
import { Confetti } from '../components/Confetti';
import { useTheme } from '../contexts/ThemeContext';
import { palette, radius, spacing } from '../theme/colors';
import { CinematicBackground, RoundedPage } from '../components/CinematicBackground';
import { GlassIconButton } from '../components/GlassCard';
import { validateContent, checkRateLimit, checkDailyLimit, CONTENT_LIMITS } from '../utils/security';
import { checkUserBlockedFromPosting } from '../services/moderation';
import type { RootStackParamList } from '../navigation/types';
import type { PrayerGroup } from '../types';

type VisibilityOption = 'PUBLIC' | 'PRIVATE' | 'GROUP';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateTestimony'>;

export const CreateTestimonyScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuth();
  const { colors } = useTheme();

  // Memoize gradient colors for stability
  const gradientColors = useMemo(
    () => [...colors.gradientBoldScreen] as [string, string, ...string[]],
    [colors.gradientBoldScreen]
  );
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
      Alert.alert('Empty Testimony', 'Please share how God answered your prayer.');
      return;
    }

    // Validate GROUP visibility has at least one group selected
    if (visibility === 'GROUP' && selectedGroupIds.length === 0) {
      Alert.alert('Select Groups', 'Please select at least one group to share with.');
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

    setSubmitting(true);

    try {
      await submitFeedItem('TESTIMONY', sanitizedContent, user.uid, user.displayName || 'Anonymous', {
        linkedRequestId: linkedRequestId || undefined,
        userEmail: user.email || undefined,
        userPhotoURL: user.photoURL || null,
        visibility,
        isPrivate: visibility === 'PRIVATE',
        groupIds: visibility === 'GROUP' ? selectedGroupIds : undefined,
        isEmailVerified: user.emailVerified || false,
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
    <CinematicBackground useOuterBackground>
      <Confetti active={showConfetti} onComplete={() => setShowConfetti(false)} />
      <SafeAreaView style={styles.container}>
        {/* === HEADER SECTION === */}
        <View style={styles.headerSection}>
          <GlassIconButton onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color={colors.stone700} />
          </GlassIconButton>
          <View style={styles.headerCenter}>
            <Text style={[styles.kicker, { color: colors.stone500 }]}>CELEBRATE</Text>
            <Text style={styles.heading}>
              Testimony<Text style={styles.headingDot}>.</Text>
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
                <Text style={styles.label}>Link to Prayer Request (Optional)</Text>
                <Text style={styles.hint}>
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

            {/* Privacy Options */}
            <View style={styles.card}>
              <Text style={styles.label}>Who can see this testimony?</Text>
              <View style={styles.visibilityOptions}>
                <TouchableOpacity
                  style={[styles.visibilityOption, visibility === 'PUBLIC' && styles.visibilityOptionActive]}
                  onPress={() => {
                    setVisibility('PUBLIC');
                    setSelectedGroupIds([]);
                    if (Platform.OS !== 'web') Haptics.selectionAsync();
                  }}
                >
                  <Ionicons 
                    name="globe-outline" 
                    size={20} 
                    color={visibility === 'PUBLIC' ? '#166534' : palette.muted} 
                  />
                  <Text style={[styles.visibilityOptionText, visibility === 'PUBLIC' && styles.visibilityOptionTextActive]}>
                    Everyone
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.visibilityOption, visibility === 'PRIVATE' && styles.visibilityOptionActive]}
                  onPress={() => {
                    setVisibility('PRIVATE');
                    setSelectedGroupIds([]);
                    if (Platform.OS !== 'web') Haptics.selectionAsync();
                  }}
                >
                  <Ionicons 
                    name="lock-closed-outline" 
                    size={20} 
                    color={visibility === 'PRIVATE' ? '#166534' : palette.muted} 
                  />
                  <Text style={[styles.visibilityOptionText, visibility === 'PRIVATE' && styles.visibilityOptionTextActive]}>
                    Only Me
                  </Text>
                </TouchableOpacity>
                
                {userGroups.length > 0 && (
                  <TouchableOpacity
                    style={[styles.visibilityOption, visibility === 'GROUP' && styles.visibilityOptionActive]}
                    onPress={() => {
                      setVisibility('GROUP');
                      if (Platform.OS !== 'web') Haptics.selectionAsync();
                    }}
                  >
                    <Ionicons 
                      name="people-outline" 
                      size={20} 
                      color={visibility === 'GROUP' ? '#166534' : palette.muted} 
                    />
                    <Text style={[styles.visibilityOptionText, visibility === 'GROUP' && styles.visibilityOptionTextActive]}>
                      Groups
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              
              {/* Group Selection */}
              {visibility === 'GROUP' && userGroups.length > 0 && (
                <View style={styles.groupSelection}>
                  <Text style={styles.hint}>Select groups to share with:</Text>
                  {userGroups.map((group) => (
                    <TouchableOpacity
                      key={group.id}
                      style={[
                        styles.groupChip,
                        selectedGroupIds.includes(group.id) && styles.groupChipSelected,
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
                        selectedGroupIds.includes(group.id) && styles.groupChipTextSelected,
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
            </View>

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
              &quot;Come and hear, all you who fear God; let me tell you what he has done for me.&quot; — Psalm 66:16
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
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: palette.border,
  },
  visibilityOptionActive: {
    backgroundColor: '#dcfce7',
    borderColor: '#bbf7d0',
  },
  visibilityOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.muted,
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
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: palette.border,
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
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: palette.text,
  },
  groupChipTextSelected: {
    color: '#166534',
  },
});

