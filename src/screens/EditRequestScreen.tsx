import React, { useState, useEffect } from 'react';
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
import * as Haptics from 'expo-haptics';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../hooks/useAuth';
import { editPrayerRequest, editTestimony, deletePrayerRequest, deleteTestimony } from '../services/prayers';
import { useTheme } from '../contexts/ThemeContext';
import { palette, radius, spacing } from '../theme/colors';
import { PRAYER_CATEGORIES, PrayerCategory } from '../types';
import { canEditContent, canDeleteContent, hasAdminPermission } from '../config/admins';
import { validateContent } from '../utils/security';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'EditRequest'>;

export const EditRequestScreen: React.FC<Props> = ({ route, navigation }) => {
  const { id, type, item } = route.params;
  const { user } = useAuth();
  useTheme();
  const isRequest = type === 'REQUEST';
  
  // Form state
  const [content, setContent] = useState(item.content || '');
  const [selectedCategory, setSelectedCategory] = useState<PrayerCategory>(item.category || 'other');
  const [isUrgent, setIsUrgent] = useState(item.isUrgent || false);
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
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={palette.accent} />
      </SafeAreaView>
    );
  }

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
              <Text style={styles.title}>
                Edit {isRequest ? 'Prayer Request' : 'Testimony'}
              </Text>
              <View style={styles.placeholder} />
            </View>

            {/* Admin Badge */}
            {isAdmin && !isOwner && (
              <View style={styles.adminBanner}>
                <Ionicons name="shield-checkmark" size={18} color="#3b82f6" />
                <Text style={styles.adminBannerText}>
                  Editing as Admin
                </Text>
              </View>
            )}

            {/* Content Input */}
            <View style={styles.card}>
              <Text style={styles.label}>Content</Text>
              <TextInput
                style={styles.textArea}
                placeholder={isRequest ? "What do you need prayer for?" : "Share your testimony..."}
                placeholderTextColor={palette.muted}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                value={content}
                onChangeText={setContent}
                maxLength={isRequest ? 1000 : 1500}
              />
              <Text style={styles.charCount}>
                {content.length}/{isRequest ? 1000 : 1500}
              </Text>
            </View>

            {/* Request-specific options */}
            {isRequest && (
              <>
                {/* Category Selection */}
                <View style={styles.card}>
                  <Text style={styles.label}>Category</Text>
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

                {/* Status Info (read-only) */}
                <View style={styles.statusInfoCard}>
                  <Ionicons name="information-circle" size={20} color="#3b82f6" />
                  <View style={styles.statusInfoContent}>
                    <Text style={styles.statusInfoTitle}>Current Status: {item.status || 'PENDING'}</Text>
                    <Text style={styles.statusInfoText}>
                      Status changes automatically when your prayer receives engagement from the community.
                    </Text>
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
                        <Text style={styles.optionHint}>Highlight as a critical need</Text>
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
                  <View style={[styles.optionRow, styles.optionRowLast]}>
                    <View style={styles.optionInfo}>
                      <Text style={styles.optionEmoji}>🔒</Text>
                      <View>
                        <Text style={styles.optionTitle}>Private Request</Text>
                        <Text style={styles.optionHint}>Only visible to your groups</Text>
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
                <ActivityIndicator color="#1f2937" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#1f2937" />
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
                  <ActivityIndicator color="#dc2626" />
                ) : (
                  <>
                    <Ionicons name="trash-outline" size={20} color="#dc2626" />
                    <Text style={styles.deleteButtonText}>Delete</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.background,
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
  adminBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dbeafe',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: '#93c5fd',
  },
  adminBannerText: {
    color: '#1d4ed8',
    fontWeight: '700',
    fontSize: 14,
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
    marginBottom: spacing.sm,
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
    textAlignVertical: 'top',
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
    borderColor: palette.border,
    gap: spacing.xs,
  },
  categoryChipActive: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  categoryEmoji: {
    fontSize: 14,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.muted,
  },
  categoryTextActive: {
    color: '#1f2937',
  },
  statusInfoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#eff6ff',
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  statusInfoContent: {
    flex: 1,
  },
  statusInfoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e40af',
    marginBottom: 4,
  },
  statusInfoText: {
    fontSize: 13,
    color: '#3b82f6',
    lineHeight: 18,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
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
    gap: spacing.md,
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
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.md,
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
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

