import React, { useState, useEffect } from 'react';
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
import * as Haptics from 'expo-haptics';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../hooks/useAuth';
import { editPrayerRequest, editTestimony, deletePrayerRequest, deleteTestimony } from '../services/prayers';
import { useTheme } from '../contexts/ThemeContext';
import { radius, spacing } from '../theme/colors';
import { LiftScreen } from '../components/LiftLayout';
import { PRAYER_CATEGORIES, PrayerCategory } from '../types';
import { canEditContent, canDeleteContent, hasAdminPermission } from '../config/admins';
import { validateContent } from '../utils/security';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'EditRequest'>;

export const EditRequestScreen: React.FC<Props> = ({ route, navigation }) => {
  const { id, type, item } = route.params;
  const { user } = useAuth();
  const { colors } = useTheme();
  const isRequest = type === 'REQUEST';
  const requestItem = isRequest && item.type === 'REQUEST' ? item : null;
  
  // Form state
  const [content, setContent] = useState(item.content || '');
  const [selectedCategory, setSelectedCategory] = useState<PrayerCategory>(requestItem?.category || 'other');
  const [isUrgent, setIsUrgent] = useState(requestItem?.isUrgent || false);
  const [isPrivate, setIsPrivate] = useState(item.isPrivate || false);
  // Note: Status is NOT editable by users - it changes automatically based on prayer engagement
  
  // UI state
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  // Permission checks
  const isAdmin = hasAdminPermission(user?.email);
  const isOwner = item.ownerUid === user?.uid;
  const canEdit = canEditContent(item.ownerUid, user?.uid, user?.email);
  const canDelete = canDeleteContent(item.ownerUid, user?.uid, user?.email);

  // Redirect if no permission
  useEffect(() => {
    if (!canEdit) {
      Alert.alert('No Permission', 'You do not have permission to edit this content.');
      navigation.goBack();
    }
  }, [canEdit, navigation]);

  const handleSave = async () => {
    if (!content.trim()) {
      Alert.alert('Error', 'Content cannot be empty.');
      return;
    }

    // Validate content for security and appropriateness
    const validation = validateContent(content, {
      minLength: 10,
      maxLength: isRequest ? 1000 : 1500,
      checkProfanity: true,
      checkSuspicious: true,
    });

    if (!validation.isValid) {
      Alert.alert('Cannot Save', validation.error || 'Please revise your content.');
      return;
    }

    if (!user) {
      Alert.alert('Error', 'You must be signed in.');
      return;
    }

    setSaving(true);
    
    const sanitizedContent = validation.sanitized || content.trim();

    try {
      let result;
      
      if (isRequest) {
        result = await editPrayerRequest(
          id,
          {
            content: sanitizedContent,
            category: selectedCategory,
            isUrgent,
            isPrivate,
            // Status is not editable - it changes automatically based on prayer engagement
          },
          user.uid,
          user.email
        );
      } else {
        result = await editTestimony(
          id,
          { content: sanitizedContent },
          user.uid,
          user.email
        );
      }

      if (result.success) {
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        Alert.alert('Success', 'Changes saved!', [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]);
      } else {
        Alert.alert('Error', result.error || 'Could not save changes.');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete ' + (isRequest ? 'Prayer Request' : 'Testimony'),
      'Are you sure you want to delete this? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!user) return;

            setDeleting(true);
            try {
              let result;
              
              if (isRequest) {
                result = await deletePrayerRequest(id, user.uid, user.email);
              } else {
                result = await deleteTestimony(id, user.uid, user.email);
              }

              if (result.success) {
                if (Platform.OS !== 'web') {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }
                Alert.alert('Deleted', 'Content has been removed.', [
                  { text: 'OK', onPress: () => navigation.popToTop() }
                ]);
              } else {
                Alert.alert('Error', result.error || 'Could not delete.');
              }
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Could not delete.');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  if (!canEdit) {
    return (
      <LiftScreen>
        <ActivityIndicator size="large" color={colors.accent} />
      </LiftScreen>
    );
  }

  return (
    <LiftScreen scroll>
      {/* === HEADER SECTION === */}
      <View style={styles.headerSection}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.kicker, { color: colors.muted }]}>MODIFY</Text>
          <Text style={[styles.heading, { color: colors.text }]}>
            Edit<Text style={styles.headingDot}>.</Text>
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

            {/* Admin Badge */}
            {isAdmin && !isOwner && (
              <View style={[styles.adminBanner, { borderColor: colors.border }]}>
                <Ionicons name="shield-checkmark" size={18} color="#3b82f6" />
                <Text style={[styles.adminBannerText, { color: colors.text }]}>
                  Editing as Admin
                </Text>
              </View>
            )}

            {/* Content Input */}
            <View style={[styles.card, { borderColor: colors.border }]}>
              <Text style={[styles.label, { color: colors.text }]}>Content</Text>
              <TextInput
                style={[styles.textArea, { color: colors.text, borderColor: colors.border }]}
                placeholder={isRequest ? "What do you need prayer for?" : "Share your testimony..."}
                placeholderTextColor={colors.muted}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                value={content}
                onChangeText={setContent}
                maxLength={isRequest ? 1000 : 1500}
              />
              <Text style={[styles.charCount, { color: colors.muted }]}>
                {content.length}/{isRequest ? 1000 : 1500}
              </Text>
            </View>

            {/* Request-specific options */}
            {isRequest && (
              <>
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
                        <Text style={[styles.categoryEmoji, { color: colors.text }]}>{cat.emoji}</Text>
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

                {/* Status Info (read-only) */}
                <View style={[styles.statusInfoCard, { borderColor: colors.border }]}>
                  <Ionicons name="information-circle" size={20} color="#3b82f6" />
                  <View style={styles.statusInfoContent}>
                    <Text style={[styles.statusInfoTitle, { color: colors.text }]}>Current Status: {requestItem?.status || 'PENDING'}</Text>
                    <Text style={[styles.statusInfoText, { color: colors.muted }]}>
                      Status changes automatically when your prayer receives engagement from the community.
                    </Text>
                  </View>
                </View>

                {/* Options */}
                <View style={[styles.card, { borderColor: colors.border }]}>
                  <Text style={[styles.label, { color: colors.text }]}>Options</Text>

                  {/* Urgent Toggle */}
                  <View style={[styles.optionRow, { borderBottomColor: colors.border }]}>
                    <View style={styles.optionInfo}>
                      <Text style={styles.optionEmoji}>🚨</Text>
                      <View>
                        <Text style={[styles.optionTitle, { color: colors.text }]}>Mark as Urgent</Text>
                        <Text style={[styles.optionHint, { color: colors.muted }]}>Highlight as a critical need</Text>
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
                      trackColor={{ false: colors.border, true: colors.accent }}
                      thumbColor={isUrgent ? colors.accent : colors.surface}
                    />
                  </View>

                  {/* Private Toggle */}
                  <View style={[styles.optionRow, styles.optionRowLast]}>
                    <View style={styles.optionInfo}>
                      <Text style={styles.optionEmoji}>🔒</Text>
                      <View>
                        <Text style={[styles.optionTitle, { color: colors.text }]}>Private Request</Text>
                        <Text style={[styles.optionHint, { color: colors.muted }]}>Only visible to your groups</Text>
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
                      trackColor={{ false: colors.border, true: colors.accent }}
                      thumbColor={isPrivate ? colors.accent : colors.surface}
                    />
                  </View>
                </View>
              </>
            )}

            {/* Save Button */}
            <TouchableOpacity
              style={[
                styles.saveButton,
                (!content.trim() || saving) && styles.buttonDisabled,
              ]}
              onPress={handleSave}
              disabled={!content.trim() || saving}
            >
              {saving ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color={colors.text} />
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Delete Button */}
            {canDelete && (
              <TouchableOpacity
                style={[styles.deleteButton, deleting && styles.buttonDisabled]}
                onPress={handleDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <ActivityIndicator color='#dc2626' />
                ) : (
                  <>
                    <Ionicons name="trash-outline" size={20} color='#dc2626' />
                    <Text style={styles.deleteButtonText}>Delete</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
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
  loadingContainer: {
    flex: 1,
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
    flex: 1,
    alignItems: 'center',
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
    letterSpacing: -1.5,
    lineHeight: 34,
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
  },
  placeholder: {
    width: 40,
  },
  adminBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
  },
  adminBannerText: {
    fontWeight: '700',
    fontSize: 14,
  },
  card: {
    backgroundColor: '#f8fafc',
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  textArea: {
    minHeight: 120,
    fontSize: 16,
    lineHeight: 24,
    padding: spacing.md,
    backgroundColor: '#f8fafc',
    borderRadius: radius.md,
    borderWidth: 1,
    textAlignVertical: 'top',
  },
  charCount: {
    textAlign: 'right',
    fontSize: 12,
    marginTop: spacing.sm,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.xs,
  },
  categoryChipActive: {
    backgroundColor: '#fef3c7',
  },
  categoryEmoji: {
    fontSize: 14,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '600',
  },
  categoryTextActive: {
  },
  statusInfoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f8fafc',
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
  },
  statusInfoContent: {
    flex: 1,
  },
  statusInfoTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  statusInfoText: {
    fontSize: 13,
    lineHeight: 18,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  optionRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  optionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  optionEmoji: {
    fontSize: 24,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  optionHint: {
    fontSize: 12,
    marginTop: 2,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d97706',
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.md,
    elevation: 4,
  },
  saveButtonText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1f2937',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef2f2',
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#dc2626',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
