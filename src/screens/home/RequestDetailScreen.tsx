import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
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
import type { FeedItem } from '../../types';

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

  const isOwner = useMemo(() => user && item && user.uid === (item as any).ownerUid, [user, item]);

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
    if (!isOwner) {
      Alert.alert('Not allowed', 'Only the owner can edit this item.');
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
    } catch (err: any) {
      Alert.alert('Save failed', err.message ?? 'Unable to save changes.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!item) return;
    if (!isOwner) {
      Alert.alert('Not allowed', 'Only the owner can delete this item.');
      return;
    }
    Alert.alert('Delete', 'Are you sure you want to delete this?', [
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

  const handleFlag = async () => {
    if (!flagText.trim()) {
      Alert.alert('Add context', 'Please add a brief reason.');
      return;
    }
    setBusyAction(true);
    try {
      await flagContent(user?.uid, id, type, flagText.trim());
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
      await logPrayer(user.uid, id, (item as any).ownerUid, item.content.slice(0, 120));
      Alert.alert('Logged', 'Prayer recorded.');
    } catch (err: any) {
      Alert.alert('Unable to log', err.message ?? 'Try again.');
    } finally {
      setBusyAction(false);
    }
  };

  if (loading || !item) {
    return (
      <SafeAreaView style={styles.loading}>
        <Text style={styles.muted}>Loading...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.kicker}>{type === 'REQUEST' ? 'Transmission' : 'Verification'}</Text>
        <Text style={styles.title}>{item.content.slice(0, 100)}</Text>
        <Text style={styles.meta}>By {item.userDisplayName}</Text>
        <Text style={styles.meta}>Location: {item.location}</Text>
        <Text style={styles.meta}>Created: {formatDate((item as any).createdAt)}</Text>

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
              <Text style={styles.primaryText}>Pray</Text>
            </TouchableOpacity>
          ) : null}
          {isOwner && !editMode && (
            <TouchableOpacity style={styles.secondaryButton} onPress={() => setEditMode(true)}>
              <Text style={styles.secondaryText}>Edit</Text>
            </TouchableOpacity>
          )}
          {isOwner && (
            <TouchableOpacity style={styles.dangerButton} onPress={handleDelete} disabled={busyAction}>
              <Text style={styles.dangerText}>Delete</Text>
            </TouchableOpacity>
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
  dangerButton: {
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
});
