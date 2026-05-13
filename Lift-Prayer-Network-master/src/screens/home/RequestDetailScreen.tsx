import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Platform,
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
import { fonts, radius, spacing } from '../../theme/colors';
import { LiftScreen } from '../../components/LiftLayout';
import { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../contexts/ThemeContext';
import {
  deleteRequest,
  deleteTestimony,
  fetchRequestOrTestimony,
  flagContent,
  updateRequestContent,
  updateTestimonyContent,
} from '../../services/requests';
import { logPrayer } from '../../services/prayers';
import { addComment, subscribeToComments, deleteComment, updateComment, hideCommentByOwner } from '../../services/comments';
import { addPrayerRequestUpdate, getPrayerRequestUpdates, markPrayerRequestAnswered } from '../../services/prayerJourney';
import { checkUserBlockedFromPosting } from '../../services/moderation';
import { formatRelativeTime } from '../../components/FeedCard';
import { InlineError } from '../../components/InlineError';
import { ErrorState } from '../../components/ErrorState';
import { useOptimisticMutation } from '../../hooks/useOptimisticMutation';
import { canEditContent, canDeleteContent, hasAdminPermission, getVerifiedBadge, BADGE_STYLES } from '../../config/admins';
import type { FeedItem, Comment, PrayerRequestUpdate, PrayerRequestUpdateType } from '../../types';

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
  const { colors } = useTheme();
  const [item, setItem] = useState<FeedItem | null>(initialItem || null);
  const [loading, setLoading] = useState(!initialItem);
  const [editMode, setEditMode] = useState(false);
  const [contentDraft, setContentDraft] = useState(initialItem?.content || '');
  const [saving, setSaving] = useState(false);
  const [busyAction, setBusyAction] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const [commentError, setCommentError] = useState<string | null>(null);
  const [updates, setUpdates] = useState<PrayerRequestUpdate[]>([]);
  const [newUpdate, setNewUpdate] = useState('');
  const [updateType, setUpdateType] = useState<PrayerRequestUpdateType>('CONTINUE_PRAYING');
  const [answerReflection, setAnswerReflection] = useState('');
  const [answerPublic, setAnswerPublic] = useState(false);
  const [shareAsTestimony, setShareAsTestimony] = useState(false);

  const isOwner = useMemo(() => user && item && user.uid === (item as any).ownerUid, [user, item]);
  const canEdit = useMemo(() => item && user && canEditContent((item as any).ownerUid, user.uid, user.email), [item, user]);
  const canDelete = useMemo(() => item && user && canDeleteContent((item as any).ownerUid, user.uid, user.email), [item, user]);
  const isAdmin = useMemo(() => hasAdminPermission(user?.email), [user?.email]);
  
  // Apply current user's profile to their own posts for instant updates
  const displayItem = useMemo(() => {
    if (!item) return null;
    if (isOwner && !(item as any).isAnonymous) {
      return {
        ...item,
        userDisplayName: user?.displayName || item.userDisplayName,
        userPhotoURL: user?.photoURL ?? (item as any).userPhotoURL,
      };
    }
    return item;
  }, [item, isOwner, user?.displayName, user?.photoURL]);
  
  // Get verified badge for the content author
  const authorBadge = useMemo(() => getVerifiedBadge((displayItem as any)?.userEmail), [displayItem]);
  const isEmailVerified = (item as any)?.isEmailVerified === true;
  const badgeStyle = authorBadge ? BADGE_STYLES[authorBadge.badgeType] : null;
  const badgeLabel = authorBadge?.badgeLabel || null;
  const showEmailVerifiedTick = !authorBadge && isEmailVerified;

  // Subscribe to comments
  useEffect(() => {
    const unsub = subscribeToComments(id, type, setComments);
    return () => unsub();
  }, [id, type]);

  useEffect(() => {
    let mounted = true;
    if (type !== 'REQUEST') return undefined;
    getPrayerRequestUpdates(id).then((next) => {
      if (mounted) setUpdates(next);
    });
    return () => {
      mounted = false;
    };
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

    // Check if user is blocked from posting
    const blockStatus = await checkUserBlockedFromPosting(user.uid);
    if (blockStatus.isBlocked) {
      Alert.alert(
        'Posting Restricted',
        blockStatus.reason || 'Your posting privileges have been suspended.',
      );
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

  const handleHideComment = async (comment: Comment) => {
    const success = await hideCommentByOwner(comment.id);
    if (!success) {
      Alert.alert('Error', 'Could not hide this encouragement.');
    }
  };

  const handleAddUpdate = async () => {
    if (!user || !isOwner || type !== 'REQUEST') return;
    if (!newUpdate.trim()) {
      Alert.alert('Update required', 'Write a short update first.');
      return;
    }

    setBusyAction(true);
    try {
      await addPrayerRequestUpdate(id, user.uid, newUpdate.trim(), updateType);
      setNewUpdate('');
      const next = await getPrayerRequestUpdates(id);
      setUpdates(next);
      Alert.alert('Update added', 'People praying can now see the latest.');
    } catch (err: any) {
      Alert.alert('Could not add update', err.message || 'Please try again.');
    } finally {
      setBusyAction(false);
    }
  };

  const handleMarkAnswered = async () => {
    if (!user || !isOwner || type !== 'REQUEST' || !item) return;
    setBusyAction(true);
    try {
      const testimonyId = await markPrayerRequestAnswered({
        requestId: id,
        ownerUid: user.uid,
        reflection: answerReflection.trim(),
        visibility: answerPublic ? 'PUBLIC' : 'PRIVATE',
        shareAsTestimony,
        userDisplayName: user.displayName || 'Anonymous',
        userEmail: user.email,
        userPhotoURL: user.photoURL,
        isAnonymous: (item as any).isAnonymous,
      });

      setItem({
        ...item,
        status: 'ANSWERED',
        severity: 'RESOLVED',
        answerReflection: answerReflection.trim(),
        answerVisibility: answerPublic ? 'PUBLIC' : 'PRIVATE',
        linkedTestimonyId: testimonyId || undefined,
      } as FeedItem);
      const next = await getPrayerRequestUpdates(id);
      setUpdates(next);
      Alert.alert('Answered Prayer', shareAsTestimony ? 'Your testimony has been shared.' : 'Saved as a private answered prayer.');
    } catch (err: any) {
      Alert.alert('Could not mark answered', err.message || 'Please try again.');
    } finally {
      setBusyAction(false);
    }
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

  const submitContentReport = async (reason: string) => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to report content.');
      return;
    }
    const trimmed = reason.trim();
    if (!trimmed) return;

    setBusyAction(true);
    try {
      await flagContent(user.uid, id, type, trimmed);
      Alert.alert('Report submitted', 'Thank you for helping keep the space healthy.');
    } catch (err: any) {
      Alert.alert('Report failed', err.message ?? 'Try again.');
    } finally {
      setBusyAction(false);
    }
  };

  const handleReportContent = () => {
    if (Platform.OS === 'ios') {
      Alert.prompt(
        'Report Content',
        'Why are you reporting this?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Submit', onPress: (reason?: string) => reason && submitContentReport(reason) },
        ],
        'plain-text',
      );
      return;
    }

    Alert.alert('Report Content', 'Choose a reason to report this content.', [
      { text: 'Spam or scam', onPress: () => submitContentReport('Spam or scam') },
      { text: 'Harassment or abuse', onPress: () => submitContentReport('Harassment or abuse') },
      { text: 'Inappropriate content', onPress: () => submitContentReport('Inappropriate content') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const openOverflowMenu = () => {
    const actions: any[] = [];
    if (canEdit) actions.push({ text: 'Edit', onPress: handleAdvancedEdit });
    if (canDelete) actions.push({ text: 'Delete', style: 'destructive', onPress: handleDelete });
    actions.push({ text: 'Report', onPress: handleReportContent });
    actions.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Request Options', undefined, actions);
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

  if (loading || !item || !displayItem) {
    return (
      <ErrorState
        title={loading ? 'Loading request...' : 'Unable to load request'}
        message={!loading ? 'Please go back and try again.' : undefined}
        onRetry={loading ? undefined : () => navigation.goBack()}
      />
    );
  }

  return (
    <LiftScreen>
      {/* === HEADER SECTION === */}
      <View style={styles.headerSection}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.kickerHeader, { color: colors.muted }]}>
            {type === 'REQUEST' ? 'PRAYER REQUEST' : 'PRAISE REPORT'}
          </Text>
          <Text style={[styles.heading, { color: colors.text }]}>
            Details<Text style={styles.headingDot}>.</Text>
          </Text>
        </View>
        <TouchableOpacity onPress={openOverflowMenu} style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="ellipsis-horizontal" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* === MAIN CONTENT === */}
      <View style={styles.mainContent}>
          <ScrollView contentContainerStyle={styles.content}>
        {commentError && (
          <InlineError message={commentError} onDismiss={() => setCommentError(null)} />
        )}
        <Text style={[styles.kicker, { color: colors.muted }]}>{type === 'REQUEST' ? 'Prayer Request' : 'Praise Report'}</Text>
        <Text style={[styles.title, { color: colors.text }]}>{(displayItem as any).title || displayItem.content.slice(0, 100)}</Text>
        
        {/* Author Info with Badge */}
        <View style={styles.authorRow}>
          <Text style={[styles.meta, { color: colors.muted }]}>By {displayItem.userDisplayName}</Text>
          {badgeStyle && badgeLabel && (
            <View style={[styles.authorBadge, { backgroundColor: badgeStyle.backgroundColor }]}>
              <Ionicons name={badgeStyle.icon as any} size={10} color={badgeStyle.textColor} />
              <Text style={[styles.authorBadgeText, { color: badgeStyle.textColor }]}>
                {badgeLabel}
              </Text>
            </View>
          )}
          {showEmailVerifiedTick && (
            <Ionicons name="checkmark-circle" size={14} color="#16a34a" />
          )}
        </View>
        
        {item.location && (
          <Text style={[styles.body, { color: colors.text }]}>{item.location}</Text>
        )}
        <Text style={[styles.meta, { color: colors.muted }]}>Created: {formatDate((item as any).createdAt)}</Text>
        
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
          <View style={[styles.editor, { borderColor: colors.border }]}>
            <TextInput
              style={[styles.editorInput, { color: colors.text }]}
              multiline
              value={contentDraft}
              onChangeText={setContentDraft}
              placeholder="Update content"
              placeholderTextColor={colors.muted}
            />
            <TouchableOpacity style={[styles.saveButton, { backgroundColor: colors.accent }]} onPress={handleSave} disabled={saving}>
              <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save changes'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setEditMode(false)}>
              <Text style={[styles.link, { color: colors.accentDark }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={[styles.body, { color: colors.text }]}>{item.content}</Text>
        )}

        <View style={styles.chipRow}>
          <View style={[styles.chip, type === 'REQUEST' ? styles.requestChip : styles.testimonyChip]}>
            <Text style={styles.chipText}>
              {type === 'REQUEST' ? (item as any).severity : 'RESOLVED'}
            </Text>
          </View>
          {type === 'REQUEST' && <Text style={[styles.meta, { color: colors.muted }]}>Prayers: {(item as any).prayers ?? 0}</Text>}
          {type === 'TESTIMONY' && <Text style={[styles.meta, { color: colors.muted }]}>Amens: {(item as any).likes ?? 0}</Text>}
        </View>

        {type === 'REQUEST' && (
          <View style={styles.supportSummary}>
            <Ionicons name="people-outline" size={18} color="#92400e" />
            <Text style={styles.supportSummaryText}>
              {((item as any).prayers ?? 0) === 0
                ? 'No one has logged a prayer yet.'
                : `${(item as any).prayers} ${(item as any).prayers === 1 ? 'person is' : 'people are'} praying.`}
            </Text>
          </View>
        )}

        <View style={styles.actions}>
          {type === 'REQUEST' ? (
            <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.accent }]} onPress={handlePray} disabled={busyAction}>
              <Ionicons name="heart" size={16} color="#1f2937" />
              <Text style={styles.primaryText}>Pray</Text>
            </TouchableOpacity>
          ) : null}
          
          {/* Quick Edit - for simple content changes */}
          {canEdit && !editMode && (
            <TouchableOpacity style={[styles.secondaryButton, { borderColor: colors.border }]} onPress={() => setEditMode(true)}>
              <Ionicons name="create-outline" size={16} color={colors.text} />
              <Text style={[styles.secondaryText, { color: colors.text }]}>Quick Edit</Text>
            </TouchableOpacity>
          )}
          
          {/* Advanced Edit - for full control (status, category, urgency, etc.) */}
          {canEdit && type === 'REQUEST' && (
            <TouchableOpacity style={[styles.advancedButton, { borderColor: colors.accent }]} onPress={handleAdvancedEdit}>
              <Ionicons name="settings-outline" size={16} color={colors.accentDark} />
              <Text style={[styles.advancedText, { color: colors.accentDark }]}>Full Edit</Text>
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
        <View style={[styles.commentsSection, { borderColor: colors.border }]}>
          <View style={styles.commentHeader}>
            <Ionicons name="chatbubbles-outline" size={20} color={colors.text} />
            <Text style={[styles.commentTitle, { color: colors.text }]}>
              Encouragements ({comments.length})
            </Text>
          </View>

          {type === 'REQUEST' && (item as any).supportPreference === 'PRAYER_ONLY' && (
            <View style={styles.prayerOnlyNotice}>
              <Ionicons name="heart-outline" size={16} color="#92400e" />
              <Text style={styles.prayerOnlyText}>The requester asked for prayer only.</Text>
            </View>
          )}

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
                        <Text style={[styles.commentAuthor, { color: colors.text }]}>{comment.authorName}</Text>
                        <Text style={[styles.commentTime, { color: colors.muted }]}>
                          {formatRelativeTime(comment.createdAt)}
                          {(comment as any).editedAt && ' (edited)'}
                        </Text>
                      </View>
                      {isEditing ? (
                        <View style={styles.commentEditContainer}>
                          <TextInput
                            style={[styles.commentEditInput, { color: colors.text, borderColor: colors.accent }]}
                            value={editingCommentText}
                            onChangeText={setEditingCommentText}
                            multiline
                            maxLength={500}
                            autoFocus
                          />
                          <View style={styles.commentEditActions}>
                            <TouchableOpacity
                              style={[styles.commentEditSave, { backgroundColor: colors.accent }]}
                              onPress={handleSaveCommentEdit}
                            >
                              <Text style={styles.commentEditSaveText}>Save</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.commentEditCancel}
                              onPress={handleCancelCommentEdit}
                            >
                              <Text style={[styles.commentEditCancelText, { color: colors.muted }]}>Cancel</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ) : (
                        <Text style={[styles.commentText, { color: colors.text }]}>{comment.content}</Text>
                      )}
                      {!isEditing && (canModifyComment || (user && !isOwnComment)) && (
                        <View style={styles.commentActions}>
                          {canModifyComment && (
                            <>
                              <TouchableOpacity
                                style={styles.commentActionBtn}
                                onPress={() => handleEditComment(comment)}
                              >
                                <Ionicons name="pencil-outline" size={14} color={colors.muted} />
                                <Text style={[styles.commentActionText, { color: colors.muted }]}>Edit</Text>
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
                          {isOwner && !isOwnComment && (
                            <TouchableOpacity
                              style={styles.commentActionBtn}
                              onPress={() => handleHideComment(comment)}
                            >
                              <Ionicons name="eye-off-outline" size={14} color="#B8956B" />
                              <Text style={[styles.commentActionText, { color: '#B8956B' }]}>Hide</Text>
                            </TouchableOpacity>
                          )}
                          {user && !isOwnComment && (
                            <TouchableOpacity
                              style={styles.commentActionBtn}
                              onPress={() => handleReportComment(comment.id)}
                            >
                              <Ionicons name="flag-outline" size={14} color="#B8956B" />
                              <Text style={[styles.commentActionText, { color: '#B8956B' }]}>
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
              <Text style={[styles.noCommentsText, { color: colors.muted }]}>Be the first to encourage!</Text>
            </View>
          )}

          {user && !(type === 'REQUEST' && (item as any).supportPreference === 'PRAYER_ONLY') && (
            <View style={[styles.commentInput, { borderTopColor: colors.border }]}>
              <TextInput
                style={[styles.commentTextInput, { color: colors.text, borderColor: colors.border }]}
                placeholder="Write an encouraging message..."
                placeholderTextColor={colors.muted}
                value={newComment}
                onChangeText={setNewComment}
                multiline
                maxLength={500}
              />
              <TouchableOpacity
                style={[styles.commentSendButton, { backgroundColor: colors.accent }, !newComment.trim() && styles.commentSendDisabled]}
                onPress={handleAddComment}
                disabled={!newComment.trim() || submittingComment}
              >
                <Ionicons
                  name="send"
                  size={20}
                  color={newComment.trim() ? '#1f2937' : colors.muted}
                />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {type === 'REQUEST' && (
          <View style={[styles.commentsSection, { borderColor: colors.border }]}>
            <View style={styles.commentHeader}>
              <Ionicons name="trail-sign-outline" size={20} color={colors.text} />
              <Text style={[styles.commentTitle, { color: colors.text }]}>Prayer Updates</Text>
            </View>
            {updates.length === 0 ? (
              <Text style={[styles.noCommentsText, { color: colors.muted }]}>No updates yet.</Text>
            ) : (
              <View style={styles.commentsList}>
                {updates.map((update) => (
                  <View key={update.id} style={[styles.updateItem, { borderLeftColor: colors.accent }]}>
                    <Text style={styles.updateType}>{update.updateType.replace(/_/g, ' ')}</Text>
                    <Text style={styles.commentText}>{update.text}</Text>
                    <Text style={styles.commentTime}>{formatRelativeTime(update.createdAt)}</Text>
                  </View>
                ))}
              </View>
            )}
            {isOwner && (item as any).status !== 'ANSWERED' && (
              <View style={[styles.ownerPanel, { borderTopColor: colors.border }]}>
                <TextInput
                  style={[styles.commentTextInput, { color: colors.text, borderColor: colors.border }]}
                  placeholder="Add a short update..."
                  placeholderTextColor={colors.muted}
                  value={newUpdate}
                  onChangeText={setNewUpdate}
                  multiline
                  maxLength={700}
                />
                <View style={styles.updateTypeRow}>
                  {([
                    ['CONTINUE_PRAYING', 'Continue'],
                    ['IMPROVED', 'Improved'],
                    ['STILL_WAITING', 'Waiting'],
                    ['NO_LONGER_NEEDED', 'No longer needed'],
                  ] as [PrayerRequestUpdateType, string][]).map(([value, label]) => (
                    <TouchableOpacity
                      key={value}
                      style={[styles.updateChip, { borderColor: colors.border }, updateType === value && styles.updateChipActive]}
                      onPress={() => setUpdateType(value)}
                    >
                      <Text style={[styles.updateChipText, { color: colors.muted }, updateType === value && styles.updateChipTextActive]}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity style={[styles.secondaryButton, { borderColor: colors.border }]} onPress={handleAddUpdate} disabled={busyAction}>
                  <Text style={[styles.secondaryText, { color: colors.text }]}>Add Update</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {type === 'REQUEST' && isOwner && (item as any).status !== 'ANSWERED' && (
          <View style={styles.answerBox}>
            <View style={styles.commentHeader}>
              <Ionicons name="checkmark-circle-outline" size={20} color="#166534" />
              <Text style={styles.answerTitle}>Mark as Answered</Text>
            </View>
            <TextInput
              style={styles.flagInput}
              placeholder="Optional reflection or testimony..."
              placeholderTextColor={colors.muted}
              value={answerReflection}
              onChangeText={setAnswerReflection}
              multiline
              maxLength={1500}
            />
            <TouchableOpacity style={styles.toggleRow} onPress={() => setAnswerPublic((value) => !value)}>
              <Ionicons name={answerPublic ? 'radio-button-on' : 'radio-button-off'} size={18} color="#166534" />
              <Text style={styles.toggleText}>Make this answered prayer public</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.toggleRow} onPress={() => setShareAsTestimony((value) => !value)}>
              <Ionicons name={shareAsTestimony ? 'radio-button-on' : 'radio-button-off'} size={18} color="#166534" />
              <Text style={styles.toggleText}>Also share as testimony</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.answerButton} onPress={handleMarkAnswered} disabled={busyAction}>
              <Ionicons name="checkmark-circle" size={18} color="#fff" />
              <Text style={styles.answerButtonText}>Mark Answered</Text>
            </TouchableOpacity>
          </View>
        )}

          </ScrollView>
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
    flex: 1,
    alignItems: 'center',
  },
  kickerHeader: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
    opacity: 0.8,
  },
  heading: {
    fontFamily: fonts.heading,
    fontSize: 36,
    fontWeight: '500',
    letterSpacing: 0,
    lineHeight: 38,
    color: '#1c1917',
  },
  headingDot: {
    color: '#4A5D4E',
  },
  mainContent: {
    flex: 1,
    zIndex: 10,
  },
  
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
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
    textAlign: 'center',
    marginHorizontal: spacing.sm,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  kicker: {
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontSize: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
  },
  meta: {
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
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: '#fff',
  },
  secondaryText: {
    fontWeight: '700',
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
  },
  advancedText: {
    fontWeight: '700',
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
    padding: spacing.md,
    gap: spacing.sm,
  },
  editorInput: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  saveButton: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radius.md,
  },
  saveText: {
    fontWeight: '800',
    color: '#1f2937',
  },
  link: {
    fontWeight: '700',
  },
  flagBox: {
    backgroundColor: '#fff',
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    gap: spacing.sm,
  },
  flagTitle: {
    fontWeight: '800',
  },
  flagInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  muted: {
  },
  commentsSection: {
    backgroundColor: '#fff',
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
  },
  supportSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#fef3c7',
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  supportSummaryText: {
    color: '#92400e',
    fontWeight: '700',
    flex: 1,
  },
  prayerOnlyNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: '#fffbeb',
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  prayerOnlyText: {
    color: '#92400e',
    fontSize: 13,
    fontWeight: '600',
  },
  updateItem: {
    borderLeftWidth: 3,
    paddingLeft: spacing.sm,
    paddingVertical: spacing.xs,
  },
  updateType: {
    fontSize: 11,
    fontWeight: '800',
    color: '#92400e',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  ownerPanel: {
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },
  updateTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  updateChip: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    backgroundColor: '#f8fafc',
  },
  updateChipActive: {
    backgroundColor: '#fef3c7',
  },
  updateChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  updateChipTextActive: {
    color: '#92400e',
  },
  answerBox: {
    backgroundColor: '#f0fdf4',
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    gap: spacing.sm,
  },
  answerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#166534',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 2,
  },
  toggleText: {
    color: '#166534',
    fontWeight: '600',
    fontSize: 13,
  },
  answerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: '#16a34a',
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
  },
  answerButtonText: {
    color: '#fff',
    fontWeight: '800',
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
    fontSize: 13,
  },
  commentTime: {
    fontSize: 11,
  },
  commentText: {
    fontSize: 14,
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
    fontSize: 14,
  },
  commentInput: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },
  commentTextInput: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
    maxHeight: 100,
    borderWidth: 1,
  },
  commentSendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    borderWidth: 1,
    minHeight: 60,
  },
  commentEditActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  commentEditSave: {
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
  },
  adminBadgeSmall: {
    marginLeft: 'auto',
    padding: 4,
  },
});
