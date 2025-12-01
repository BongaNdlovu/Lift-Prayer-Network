import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Timestamp } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { palette, radius, spacing } from '../../theme/colors';
import { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../hooks/useAuth';
import {
  deleteRequest,
  deleteTestimony,
  fetchRequestOrTestimony,
  flagContent,
  updateRequestContent,
  updateTestimonyContent,
} from '../../services/requests';
import { logPrayer } from '../../services/prayers';
import { addComment, subscribeToComments, deleteComment, updateComment } from '../../services/comments';
import { formatRelativeTime } from '../../components/FeedCard';
import { InlineError } from '../../components/InlineError';
import { ErrorState } from '../../components/ErrorState';
import { useOptimisticMutation } from '../../hooks/useOptimisticMutation';
import { canEditContent, canDeleteContent, hasAdminPermission, getVerifiedBadge, BADGE_STYLES } from '../../config/admins';
import type { FeedItem, Comment } from '../../types';

type Props = NativeStackScreenProps<RootStackParamList, 'RequestDetail'>;

const formatDate = (value?: any) => {
  if (!value) return 'Just now';
  if (value instanceof Timestamp) {
    return value.toDate().toLocaleString();
  }
  if (value instanceof Date) return value.toLocaleString();
  return 'Recently';
};

export const RequestDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { id, type, item: initialItem } = route.params;
  const { user } = useAuth();
  const [item, setItem] = useState<FeedItem | null>(initialItem || null);
  const [loading, setLoading] = useState(!initialItem);
  const [editMode, setEditMode] = useState(false);
  const [contentDraft, setContentDraft] = useState(initialItem?.content || '');
  const [flagText, setFlagText] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyAction, setBusyAction] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const [commentError, setCommentError] = useState<string | null>(null);

  const isOwner = useMemo(() => user && item && user.uid === (item as any).ownerUid, [user, item]);
  const canEdit = useMemo(() => item && user && canEditContent((item as any).ownerUid, user.uid, user.email), [item, user]);
  const canDelete = useMemo(() => item && user && canDeleteContent((item as any).ownerUid, user.uid, user.email), [item, user]);
  const isAdmin = useMemo(() => hasAdminPermission(user?.email), [user?.email]);
  
  // Get verified badge for the content author
  const authorBadge = useMemo(() => getVerifiedBadge((item as any)?.userEmail), [item]);
  const badgeStyle = authorBadge ? BADGE_STYLES[authorBadge.badgeType] : null;

  // Subscribe to comments
  useEffect(() => {
    const unsub = subscribeToComments(id, type, setComments);
    return () => unsub();
  }, [id, type]);

  const { mutate: submitComment, loading: submittingComment } = useOptimisticMutation<
    { content: string },
    void,
    void
  >({
    mutation: async ({ content }) => {
      if (!user) {
        throw new Error('Sign in required to post a comment.');
      }
      await addComment(id, type, user.uid, user.displayName || 'Anonymous', content);
    },
    onSuccess: () => {
      setNewComment('');
      setCommentError(null);
    },
    onError: (err) => {
      setCommentError(err.message || 'Could not post comment.');
    },
  });

  const handleAddComment = async () => {
    const trimmed = newComment.trim();
    if (!trimmed) return;
    if (!user) {
      Alert.alert('Sign in required', 'Sign in to post a comment.');
      return;
    }
    
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    try {
      await submitComment({ content: trimmed });
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not post comment');
    }
  };

  const handleEditComment = (comment: Comment) => {
    setEditingCommentId(comment.id);
    setEditingCommentText(comment.content);
  };

  const handleSaveCommentEdit = async () => {
    if (!editingCommentId || !editingCommentText.trim()) return;
    
    try {
      const success = await updateComment(editingCommentId, editingCommentText.trim());
      if (success) {
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        setEditingCommentId(null);
        setEditingCommentText('');
      } else {
        Alert.alert('Error', 'Could not update comment');
      }
    } catch {
      Alert.alert('Error', 'Could not update comment');
    }
  };

  const handleCancelCommentEdit = () => {
    setEditingCommentId(null);
    setEditingCommentText('');
  };

  const handleDeleteComment = (comment: Comment) => {
    Alert.alert(
      'Delete Comment',
      'Are you sure you want to delete this comment?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const success = await deleteComment(comment.id, id, type);
              if (success) {
                if (Platform.OS !== 'web') {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }
              } else {
                Alert.alert('Error', 'Could not delete comment');
              }
            } catch {
              Alert.alert('Error', 'Could not delete comment');
            }
          },
        },
      ]
    );
  };

  const handleReportComment = (commentId: string) => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to report comments.');
      return;
    }

    const submitReport = async (reason: string) => {
      const trimmed = reason.trim();
      if (!trimmed) return;
      try {
        await flagContent(user.uid, commentId, 'COMMENT', trimmed);
        Alert.alert('Reported', 'Thank you for helping keep our community safe.');
      } catch (err: any) {
        Alert.alert('Error', err?.message || 'Could not report this comment right now.');
      }
    };

    if (Platform.OS === 'ios') {
      Alert.prompt(
        'Report Comment',
        'Why are you reporting this comment?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Submit',
            onPress: (reason: string | undefined) => {
              if (reason) {
                submitReport(reason);
              }
            },
          },
        ],
        'plain-text'
      );
    } else {
      Alert.alert(
        'Report Comment',
        'Choose a reason to report this comment',
        [
          { text: 'Spam or scam', onPress: () => submitReport('Spam or scam') },
          { text: 'Harassment or abuse', onPress: () => submitReport('Harassment or abuse') },
          { text: 'Inappropriate content', onPress: () => submitReport('Inappropriate content') },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    }
  };

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const fresh = await fetchRequestOrTestimony(type, id);
      if (mounted && fresh) {
        setItem({ ...(fresh as any), type } as FeedItem);
        setContentDraft((fresh as any).content);
      }
      setLoading(false);
    };
    if (!initialItem) {
      load();
    } else {
      setLoading(false);
    }
    return () => {
      mounted = false;
    };
  }, [id, type, initialItem]);

  const handleSave = async () => {
    if (!item) return;
    if (!canEdit) {
      Alert.alert('Not allowed', 'You do not have permission to edit this item.');
      return;
    }
    if (!contentDraft.trim()) {
      Alert.alert('Content required', 'Content cannot be empty.');
      return;
    }
    setSaving(true);
    try {
      if (type === 'REQUEST') {
        await updateRequestContent(item.id, contentDraft.trim());
      } else {
        await updateTestimonyContent(item.id, contentDraft.trim());
      }
      setItem({ ...item, content: contentDraft.trim() });
      setEditMode(false);
      Alert.alert('Success', 'Changes saved!');
    } catch (err: any) {
      Alert.alert('Save failed', err.message ?? 'Unable to save changes.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!item) return;
    if (!canDelete) {
      Alert.alert('Not allowed', 'You do not have permission to delete this item.');
      return;
    }
    Alert.alert('Delete', 'Are you sure you want to delete this? This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusyAction(true);
          try {
            if (type === 'REQUEST') {
              await deleteRequest(item.id);
            } else {
              await deleteTestimony(item.id);
            }
            navigation.goBack();
          } catch (err: any) {
            Alert.alert('Delete failed', err.message ?? 'Unable to delete.');
          } finally {
            setBusyAction(false);
          }
        },
      },
    ]);
  };

  const handleAdvancedEdit = () => {
    if (!item) return;
    navigation.navigate('EditRequest', { id: item.id, type, item });
  };

  const handleFlag = async () => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to report content.');
      return;
    }
    if (!flagText.trim()) {
      Alert.alert('Add context', 'Please add a brief reason.');
      return;
    }
    setBusyAction(true);
    try {
      await flagContent(user.uid, id, type, flagText.trim());
      setFlagText('');
      Alert.alert('Flag submitted', 'Thank you for keeping the space healthy.');
    } catch (err: any) {
      Alert.alert('Flag failed', err.message ?? 'Try again.');
    } finally {
      setBusyAction(false);
    }
  };

  const handlePray = async () => {
    if (!user) {
      Alert.alert('Sign in required', 'Sign in to log a prayer.');
      return;
    }
    if (!item) return;
    setBusyAction(true);
    try {
      const result = await logPrayer(
        user.uid, 
        id, 
        (item as any).ownerUid || 'anonymous', 
        item.content?.slice(0, 120) || '', 
        user.displayName || undefined
      );
      
      if (result.success) {
        if (Platform.OS !== 'web') {
          try {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch { /* ignore haptics errors */ }
        }
        Alert.alert('Logged', 'Prayer recorded. 🙏');
        
        // If self-prayer, send a local notification
        if (result.isSelfPrayer && Platform.OS !== 'web') {
          try {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: '🙏 Prayer Recorded',
                body: 'Your prayer for your own request has been recorded. Keep praying!',
                sound: true,
              },
              trigger: null,
            });
          } catch (e) {
            console.warn('[RequestDetail] Could not send notification:', e);
          }
        }
      } else {
        if (result.alreadyPrayed) {
          Alert.alert('Already Prayed', 'You have already prayed for this request. Thank you for your prayer! 🙏');
        } else {
          Alert.alert('Unable to log', result.error || 'Please try again.');
        }
      }
    } catch (err: any) {
      console.error('[RequestDetail] Prayer error:', err);
      Alert.alert('Unable to log', err.message ?? 'An unexpected error occurred. Please try again.');
    } finally {
      setBusyAction(false);
    }
  };

  if (loading || !item) {
    return (
      <ErrorState
        title={loading ? 'Loading request...' : 'Unable to load request'}
        message={!loading ? 'Please go back and try again.' : undefined}
        onRetry={loading ? undefined : () => navigation.goBack()}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with Back Button */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={palette.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {type === 'REQUEST' ? 'Prayer Request' : 'Testimony'}
        </Text>
        <View style={{ width: 40 }} />
      </View>
      
      <ScrollView contentContainerStyle={styles.content}>
        {commentError && (
          <InlineError message={commentError} onDismiss={() => setCommentError(null)} />
        )}
        <Text style={styles.kicker}>{type === 'REQUEST' ? 'Transmission' : 'Verification'}</Text>
        <Text style={styles.title}>{item.content.slice(0, 100)}</Text>
        
        {/* Author Info with Badge */}
        <View style={styles.authorRow}>
          <Text style={styles.meta}>By {item.userDisplayName}</Text>
          {authorBadge && badgeStyle && (
            <View style={[styles.authorBadge, { backgroundColor: badgeStyle.backgroundColor }]}>
              <Ionicons name="checkmark-circle" size={10} color={badgeStyle.textColor} />
              <Text style={[styles.authorBadgeText, { color: badgeStyle.textColor }]}>
                {authorBadge.badgeLabel}
              </Text>
            </View>
          )}
        </View>
        
        {item.location && (
          <Text style={styles.meta}>Location: {item.location}</Text>
        )}
        <Text style={styles.meta}>Created: {formatDate((item as any).createdAt)}</Text>
        
        {/* Admin viewing banner */}
        {isAdmin && !isOwner && (
          <View style={styles.adminBanner}>
            <Ionicons name="shield-checkmark" size={16} color="#3b82f6" />
            <Text style={styles.adminBannerText}>Viewing as Admin - Full Edit Access</Text>
          </View>
        )}

        {/* Show linked original request for testimonies */}
        {type === 'TESTIMONY' && (item as any).linkedRequestId && (
          <View style={styles.linkedSection}>
            <View style={styles.linkedHeader}>
              <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
              <Text style={styles.linkedTitle}>Answered Prayer</Text>
            </View>
            <Text style={styles.linkedDesc}>
              This testimony is linked to an original prayer request that has been answered!
            </Text>
          </View>
        )}

        {editMode ? (
          <View style={styles.editor}>
            <TextInput
              style={styles.editorInput}
              multiline
              value={contentDraft}
              onChangeText={setContentDraft}
              placeholder="Update content"
              placeholderTextColor={palette.muted}
            />
            <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
              <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save changes'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setEditMode(false)}>
              <Text style={styles.link}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.body}>{item.content}</Text>
        )}

        <View style={styles.chipRow}>
          <View style={[styles.chip, type === 'REQUEST' ? styles.requestChip : styles.testimonyChip]}>
            <Text style={styles.chipText}>
              {type === 'REQUEST' ? (item as any).severity : 'RESOLVED'}
            </Text>
          </View>
          {type === 'REQUEST' && <Text style={styles.meta}>Prayers: {(item as any).prayers ?? 0}</Text>}
          {type === 'TESTIMONY' && <Text style={styles.meta}>Amens: {(item as any).likes ?? 0}</Text>}
        </View>

        <View style={styles.actions}>
          {type === 'REQUEST' ? (
            <TouchableOpacity style={styles.primaryButton} onPress={handlePray} disabled={busyAction}>
              <Ionicons name="heart" size={16} color="#1f2937" />
              <Text style={styles.primaryText}>Pray</Text>
            </TouchableOpacity>
          ) : null}
          
          {/* Quick Edit - for simple content changes */}
          {canEdit && !editMode && (
            <TouchableOpacity style={styles.secondaryButton} onPress={() => setEditMode(true)}>
              <Ionicons name="create-outline" size={16} color={palette.text} />
              <Text style={styles.secondaryText}>Quick Edit</Text>
            </TouchableOpacity>
          )}
          
          {/* Advanced Edit - for full control (status, category, urgency, etc.) */}
          {canEdit && type === 'REQUEST' && (
            <TouchableOpacity style={styles.advancedButton} onPress={handleAdvancedEdit}>
              <Ionicons name="settings-outline" size={16} color={palette.accentDark} />
              <Text style={styles.advancedText}>Full Edit</Text>
            </TouchableOpacity>
          )}
          
          {/* Delete - owner or admin only */}
          {canDelete && (
            <TouchableOpacity style={styles.dangerButton} onPress={handleDelete} disabled={busyAction}>
              <Ionicons name="trash-outline" size={16} color="#b91c1c" />
              <Text style={styles.dangerText}>Delete</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Comments Section */}
        <View style={styles.commentsSection}>
          <View style={styles.commentHeader}>
            <Ionicons name="chatbubbles-outline" size={20} color={palette.text} />
            <Text style={styles.commentTitle}>
              Encouragements ({comments.length})
            </Text>
          </View>

          {comments.length > 0 ? (
            <View style={styles.commentsList}>
              {comments.map((comment) => {
                const isOwnComment = user?.uid === comment.authorUid;
                const canModifyComment = isOwnComment || isAdmin;
                const isEditing = editingCommentId === comment.id;
                
                return (
                  <View key={comment.id} style={styles.commentItem}>
                    <View style={styles.commentAvatar}>
                      <Text style={styles.commentAvatarText}>
                        {comment.authorName?.charAt(0).toUpperCase() || '?'}
                      </Text>
                    </View>
                    <View style={styles.commentContent}>
                      <View style={styles.commentMeta}>
                        <Text style={styles.commentAuthor}>{comment.authorName}</Text>
                        <Text style={styles.commentTime}>
                          {formatRelativeTime(comment.createdAt)}
                          {(comment as any).editedAt && ' (edited)'}
                        </Text>
                      </View>
                      {isEditing ? (
                        <View style={styles.commentEditContainer}>
                          <TextInput
                            style={styles.commentEditInput}
                            value={editingCommentText}
                            onChangeText={setEditingCommentText}
                            multiline
                            maxLength={500}
                            autoFocus
                          />
                          <View style={styles.commentEditActions}>
                            <TouchableOpacity
                              style={styles.commentEditSave}
                              onPress={handleSaveCommentEdit}
                            >
                              <Text style={styles.commentEditSaveText}>Save</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.commentEditCancel}
                              onPress={handleCancelCommentEdit}
                            >
                              <Text style={styles.commentEditCancelText}>Cancel</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ) : (
                        <Text style={styles.commentText}>{comment.content}</Text>
                      )}
                      {!isEditing && (canModifyComment || (user && !isOwnComment)) && (
                        <View style={styles.commentActions}>
                          {canModifyComment && (
                            <>
                              <TouchableOpacity
                                style={styles.commentActionBtn}
                                onPress={() => handleEditComment(comment)}
                              >
                                <Ionicons name="pencil-outline" size={14} color={palette.muted} />
                                <Text style={styles.commentActionText}>Edit</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.commentActionBtn}
                                onPress={() => handleDeleteComment(comment)}
                              >
                                <Ionicons name="trash-outline" size={14} color="#dc2626" />
                                <Text style={[styles.commentActionText, { color: '#dc2626' }]}>Delete</Text>
                              </TouchableOpacity>
                            </>
                          )}
                          {user && !isOwnComment && (
                            <TouchableOpacity
                              style={styles.commentActionBtn}
                              onPress={() => handleReportComment(comment.id)}
                            >
                              <Ionicons name="flag-outline" size={14} color="#b45309" />
                              <Text style={[styles.commentActionText, { color: '#b45309' }]}>
                                Report
                              </Text>
                            </TouchableOpacity>
                          )}
                          {isAdmin && !isOwnComment && (
                            <View style={styles.adminBadgeSmall}>
                              <Ionicons name="shield-checkmark" size={12} color="#3b82f6" />
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.noComments}>
              <Text style={styles.noCommentsEmoji}>💬</Text>
              <Text style={styles.noCommentsText}>Be the first to encourage!</Text>
            </View>
          )}

          {user && (
            <View style={styles.commentInput}>
              <TextInput
                style={styles.commentTextInput}
                placeholder="Write an encouraging message..."
                placeholderTextColor={palette.muted}
                value={newComment}
                onChangeText={setNewComment}
                multiline
                maxLength={500}
              />
              <TouchableOpacity
                style={[styles.commentSendButton, !newComment.trim() && styles.commentSendDisabled]}
                onPress={handleAddComment}
                disabled={!newComment.trim() || submittingComment}
              >
                <Ionicons
                  name="send"
                  size={20}
                  color={newComment.trim() ? '#1f2937' : palette.muted}
                />
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.flagBox}>
          <Text style={styles.flagTitle}>Flag / Report</Text>
          <TextInput
            style={styles.flagInput}
            placeholder="Why is this inappropriate or unsafe?"
            placeholderTextColor={palette.muted}
            value={flagText}
            onChangeText={setFlagText}
            multiline
          />
          <TouchableOpacity style={styles.secondaryButton} onPress={handleFlag} disabled={busyAction}>
            <Text style={styles.secondaryText}>Submit Flag</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: palette.text,
    textAlign: 'center',
    marginHorizontal: spacing.sm,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  kicker: {
    color: palette.muted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontSize: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: palette.text,
  },
  meta: {
    color: palette.muted,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  authorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  authorBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  adminBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dbeafe',
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: '#93c5fd',
  },
  adminBannerText: {
    color: '#1d4ed8',
    fontWeight: '600',
    fontSize: 13,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: palette.text,
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.md,
  },
  requestChip: {
    backgroundColor: '#fee2e2',
  },
  testimonyChip: {
    backgroundColor: '#dcfce7',
  },
  chipText: {
    fontWeight: '800',
    color: '#1f2937',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: palette.accent,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  primaryText: {
    fontWeight: '800',
    color: '#1f2937',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderColor: palette.border,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: '#fff',
  },
  secondaryText: {
    fontWeight: '700',
    color: palette.text,
  },
  advancedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: '#fef3c7',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.accent,
  },
  advancedText: {
    fontWeight: '700',
    color: palette.accentDark,
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: '#fee2e2',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  dangerText: {
    color: '#b91c1c',
    fontWeight: '800',
  },
  editor: {
    backgroundColor: '#fff',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  editorInput: {
    minHeight: 120,
    color: palette.text,
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: palette.accent,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radius.md,
  },
  saveText: {
    fontWeight: '800',
    color: '#1f2937',
  },
  link: {
    color: palette.accentDark,
    fontWeight: '700',
  },
  flagBox: {
    backgroundColor: '#fff',
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.border,
    gap: spacing.sm,
  },
  flagTitle: {
    fontWeight: '800',
    color: palette.text,
  },
  flagInput: {
    minHeight: 80,
    color: palette.text,
    textAlignVertical: 'top',
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  muted: {
    color: palette.muted,
  },
  commentsSection: {
    backgroundColor: '#fff',
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.border,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  commentTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: palette.text,
  },
  commentsList: {
    gap: spacing.md,
  },
  commentItem: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#3b82f6',
  },
  commentContent: {
    flex: 1,
  },
  commentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 2,
  },
  commentAuthor: {
    fontWeight: '700',
    color: palette.text,
    fontSize: 13,
  },
  commentTime: {
    fontSize: 11,
    color: palette.muted,
  },
  commentText: {
    fontSize: 14,
    color: palette.text,
    lineHeight: 20,
  },
  noComments: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  noCommentsEmoji: {
    fontSize: 32,
    marginBottom: spacing.sm,
  },
  noCommentsText: {
    color: palette.muted,
    fontSize: 14,
  },
  commentInput: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
  commentTextInput: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
    color: palette.text,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: palette.border,
  },
  commentSendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentSendDisabled: {
    backgroundColor: '#f1f5f9',
  },
  linkedSection: {
    backgroundColor: '#dcfce7',
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  linkedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  linkedTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#166534',
  },
  linkedDesc: {
    fontSize: 13,
    color: '#166534',
    lineHeight: 18,
  },
  commentActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  commentActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
  },
  commentActionText: {
    fontSize: 12,
    color: palette.muted,
    fontWeight: '600',
  },
  commentEditContainer: {
    marginTop: spacing.xs,
  },
  commentEditInput: {
    backgroundColor: '#f8fafc',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    fontSize: 14,
    color: palette.text,
    borderWidth: 1,
    borderColor: palette.accent,
    minHeight: 60,
  },
  commentEditActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  commentEditSave: {
    backgroundColor: palette.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  commentEditSaveText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1f2937',
  },
  commentEditCancel: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  commentEditCancelText: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.muted,
  },
  adminBadgeSmall: {
    marginLeft: 'auto',
    padding: 4,
  },
});
