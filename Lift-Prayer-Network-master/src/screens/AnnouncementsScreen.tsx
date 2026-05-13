import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
  TextInput,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../contexts/ThemeContext';
import { hasAdminPermission } from '../config/admins';
import { fonts, radius, spacing } from '../theme/colors';
import { LiftScreen } from '../components/LiftLayout';
import {
  Announcement,
  subscribeToAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} from '../services/announcements';

type Priority = 'normal' | 'important' | 'urgent';

export const AnnouncementsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { colors } = useTheme();
  
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  
  // Form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState<Priority>('normal');
  const [submitting, setSubmitting] = useState(false);

  const isAdmin = hasAdminPermission(user?.email);

  useEffect(() => {
    const unsubscribe = subscribeToAnnouncements((data) => {
      setAnnouncements(data);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const resetForm = () => {
    setTitle('');
    setContent('');
    setPriority('normal');
    setEditingAnnouncement(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const handleOpenEdit = (announcement: Announcement) => {
    setTitle(announcement.title);
    setContent(announcement.content);
    setPriority(announcement.priority);
    setEditingAnnouncement(announcement);
    setShowCreateModal(true);
  };

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) {
      Alert.alert('Missing Fields', 'Please fill in both title and content.');
      return;
    }
    if (!user) return;

    setSubmitting(true);
    try {
      if (editingAnnouncement) {
        const result = await updateAnnouncement(editingAnnouncement.id, {
          title,
          content,
          priority,
        });
        if (result.success) {
          Alert.alert('Success', 'Announcement updated.');
          setShowCreateModal(false);
          resetForm();
        } else {
          Alert.alert('Error', result.error || 'Could not update announcement.');
        }
      } else {
        const result = await createAnnouncement(user.uid, user.displayName || 'Admin', {
          title,
          content,
          priority,
        });
        if (result.success) {
          Alert.alert('Success', 'Announcement created.');
          setShowCreateModal(false);
          resetForm();
        } else {
          Alert.alert('Error', result.error || 'Could not create announcement.');
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (announcement: Announcement) => {
    Alert.alert(
      'Delete Announcement',
      `Are you sure you want to delete "${announcement.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const result = await deleteAnnouncement(announcement.id);
            if (!result.success) {
              Alert.alert('Error', result.error || 'Could not delete announcement.');
            }
          },
        },
      ]
    );
  };

  const getPriorityColor = (p: Priority) => {
    switch (p) {
      case 'urgent': return '#dc2626';
      case 'important': return '#385C3B';
      default: return colors.accent;
    }
  };

  const getPriorityIcon = (p: Priority) => {
    switch (p) {
      case 'urgent': return 'alert-circle';
      case 'important': return 'warning';
      default: return 'megaphone';
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <LiftScreen scroll>
      {/* === HEADER SECTION === */}
      <View style={styles.headerSection}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.kicker, { color: colors.muted }]}>UPDATES</Text>
          <Text style={[styles.heading, { color: colors.text }]}>
            News<Text style={styles.headingDot}>.</Text>
          </Text>
        </View>
        {isAdmin ? (
          <TouchableOpacity onPress={handleOpenCreate} style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="add" size={22} color={colors.text} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 44 }} />
        )}
      </View>

      {/* === MAIN CONTENT === */}
      <View style={styles.mainContent}>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : announcements.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="megaphone-outline" size={64} color={colors.muted} />
          <Text style={[styles.emptyText, { color: colors.muted }]}>No announcements yet</Text>
          {isAdmin && (
            <TouchableOpacity 
              style={[styles.createButton, { backgroundColor: colors.accent }]}
              onPress={handleOpenCreate}
            >
              <Text style={styles.createButtonText}>Create First Announcement</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          {announcements.map((announcement) => (
            <View 
              key={announcement.id} 
              style={[
                styles.card, 
                { 
                  backgroundColor: colors.surface,
                  borderLeftColor: getPriorityColor(announcement.priority),
                }
              ]}
            >
              <View style={styles.cardHeader}>
                <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(announcement.priority) + '20' }]}>
                  <Ionicons 
                    name={getPriorityIcon(announcement.priority) as any} 
                    size={16} 
                    color={getPriorityColor(announcement.priority)} 
                  />
                  <Text style={[styles.priorityText, { color: getPriorityColor(announcement.priority) }]}>
                    {announcement.priority.charAt(0).toUpperCase() + announcement.priority.slice(1)}
                  </Text>
                </View>
                {isAdmin && (
                  <View style={styles.adminActions}>
                    <TouchableOpacity onPress={() => handleOpenEdit(announcement)} style={styles.iconButton}>
                      <Ionicons name="create-outline" size={20} color={colors.muted} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(announcement)} style={styles.iconButton}>
                      <Ionicons name="trash-outline" size={20} color="#dc2626" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
              
              <Text style={[styles.cardTitle, { color: colors.text }]}>{announcement.title}</Text>
              <Text style={[styles.cardContent, { color: colors.muted }]}>{announcement.content}</Text>
              
              <View style={styles.cardFooter}>
                <Text style={[styles.dateText, { color: colors.muted }]}>
                  {formatDate(announcement.createdAt)}
                </Text>
                <Text style={[styles.authorText, { color: colors.muted }]}>
                  — {announcement.authorName}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Create/Edit Modal */}
      <Modal visible={showCreateModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {editingAnnouncement ? 'Edit Announcement' : 'New Announcement'}
              </Text>
              <TouchableOpacity onPress={() => { setShowCreateModal(false); resetForm(); }}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={[styles.label, { color: colors.text }]}>Title</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                value={title}
                onChangeText={setTitle}
                placeholder="Announcement title"
                placeholderTextColor={colors.muted}
              />

              <Text style={[styles.label, { color: colors.text }]}>Content</Text>
              <TextInput
                style={[styles.input, styles.textArea, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                value={content}
                onChangeText={setContent}
                placeholder="Announcement content..."
                placeholderTextColor={colors.muted}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
              />

              <Text style={[styles.label, { color: colors.text }]}>Priority</Text>
              <View style={styles.prioritySelector}>
                {(['normal', 'important', 'urgent'] as Priority[]).map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[
                      styles.priorityOption,
                      { 
                        backgroundColor: priority === p ? getPriorityColor(p) : colors.surface,
                        borderColor: getPriorityColor(p),
                      }
                    ]}
                    onPress={() => setPriority(p)}
                  >
                    <Text style={[
                      styles.priorityOptionText,
                      { color: priority === p ? '#fff' : getPriorityColor(p) }
                    ]}>
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
              <TouchableOpacity
                style={[styles.submitButton, { backgroundColor: colors.accent }]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>
                    {editingAnnouncement ? 'Update' : 'Create'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
        </Modal>
      </View>
    </LiftScreen>
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
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    fontFamily: fonts.heading,
    fontSize: 32,
    fontWeight: '500',
    letterSpacing: -1.5,
    lineHeight: 34,
    color: '#1c1917',
  },
  headingDot: {
    color: '#385C3B',
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
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  addButton: {
    padding: spacing.xs,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  emptyText: {
    fontSize: 16,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  createButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  createButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.md,
    gap: spacing.md,
  },
  card: {
    borderRadius: radius.lg,
    padding: spacing.md,
    borderLeftWidth: 4,
    marginBottom: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    gap: 4,
  },
  priorityText: {
    fontSize: 12,
    fontWeight: '600',
  },
  adminActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  cardContent: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 12,
  },
  authorText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalBody: {
    padding: spacing.md,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.sm,
    fontSize: 16,
  },
  textArea: {
    minHeight: 120,
  },
  prioritySelector: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  priorityOption: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  priorityOptionText: {
    fontWeight: '600',
    fontSize: 13,
  },
  modalFooter: {
    padding: spacing.md,
    borderTopWidth: 1,
  },
  submitButton: {
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
