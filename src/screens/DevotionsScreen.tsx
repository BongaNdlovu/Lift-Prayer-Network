import React, { useEffect, useState } from 'react';
import {
  Platform,
  SafeAreaView,
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
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../contexts/ThemeContext';
import { hasAdminPermission } from '../config/admins';
import { radius, spacing } from '../theme/colors';
import { CinematicBackground, RoundedPage } from '../components/CinematicBackground';
import { GlassIconButton } from '../components/GlassCard';
import {
  Devotion,
  subscribeToDevotions,
  createDevotion,
  updateDevotion,
  deleteDevotion,
} from '../services/devotions';

export const DevotionsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { colors } = useTheme();
  
  const [devotions, setDevotions] = useState<Devotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingDevotion, setEditingDevotion] = useState<Devotion | null>(null);
  const [selectedDevotion, setSelectedDevotion] = useState<Devotion | null>(null);
  
  // Form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [bibleVerse, setBibleVerse] = useState('');
  const [bibleReference, setBibleReference] = useState('');
  const [reflection, setReflection] = useState('');
  const [prayer, setPrayer] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isAdmin = hasAdminPermission(user?.email);

  useEffect(() => {
    const unsubscribe = subscribeToDevotions((data) => {
      setDevotions(data);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const resetForm = () => {
    setTitle('');
    setContent('');
    setBibleVerse('');
    setBibleReference('');
    setReflection('');
    setPrayer('');
    setEditingDevotion(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const handleOpenEdit = (devotion: Devotion) => {
    setTitle(devotion.title);
    setContent(devotion.content);
    setBibleVerse(devotion.bibleVerse);
    setBibleReference(devotion.bibleReference);
    setReflection(devotion.reflection || '');
    setPrayer(devotion.prayer || '');
    setEditingDevotion(devotion);
    setShowCreateModal(true);
  };

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim() || !bibleVerse.trim() || !bibleReference.trim()) {
      Alert.alert('Missing Fields', 'Please fill in title, content, Bible verse, and reference.');
      return;
    }
    if (!user) return;

    setSubmitting(true);
    try {
      if (editingDevotion) {
        const result = await updateDevotion(editingDevotion.id, {
          title,
          content,
          bibleVerse,
          bibleReference,
          reflection: reflection || undefined,
          prayer: prayer || undefined,
        });
        if (result.success) {
          Alert.alert('Success', 'Devotion updated.');
          setShowCreateModal(false);
          resetForm();
        } else {
          Alert.alert('Error', result.error || 'Could not update devotion.');
        }
      } else {
        const result = await createDevotion(user.uid, user.displayName || 'Admin', {
          title,
          content,
          bibleVerse,
          bibleReference,
          reflection: reflection || undefined,
          prayer: prayer || undefined,
        });
        if (result.success) {
          Alert.alert('Success', 'Devotion created.');
          setShowCreateModal(false);
          resetForm();
        } else {
          Alert.alert('Error', result.error || 'Could not create devotion.');
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (devotion: Devotion) => {
    Alert.alert(
      'Delete Devotion',
      `Are you sure you want to delete "${devotion.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const result = await deleteDevotion(devotion.id);
            if (!result.success) {
              Alert.alert('Error', result.error || 'Could not delete devotion.');
            }
          },
        },
      ]
    );
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      month: 'long', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Detail view for a selected devotion
  if (selectedDevotion) {
    return (
      <CinematicBackground useOuterBackground>
        <SafeAreaView style={styles.container}>
          <View style={styles.headerSection}>
            <GlassIconButton onPress={() => setSelectedDevotion(null)}>
              <Ionicons name="arrow-back" size={22} color={colors.stone700} />
            </GlassIconButton>
            <View style={styles.headerCenter}>
              <Text style={[styles.kicker, { color: colors.stone500 }]}>DAILY</Text>
              <Text style={styles.heading}>
                Devotion<Text style={styles.headingDot}>.</Text>
              </Text>
            </View>
            {isAdmin ? (
              <GlassIconButton onPress={() => handleOpenEdit(selectedDevotion)}>
                <Ionicons name="create-outline" size={22} color={colors.stone700} />
              </GlassIconButton>
            ) : (
              <View style={{ width: 44 }} />
            )}
          </View>
          <RoundedPage style={styles.mainContent}>

        <ScrollView style={styles.detailContent} contentContainerStyle={styles.detailContainer}>
          <Text style={[styles.detailDate, { color: colors.muted }]}>
            {formatDate(selectedDevotion.publishDate)}
          </Text>
          
          <Text style={[styles.detailTitle, { color: colors.text }]}>
            {selectedDevotion.title}
          </Text>

          {/* Bible Verse Card */}
          <View style={[styles.verseCard, { backgroundColor: colors.accentLight }]}>
            <Ionicons name="book-outline" size={24} color={colors.accent} style={styles.verseIcon} />
            <Text style={[styles.verseText, { color: colors.text }]}>
              &ldquo;{selectedDevotion.bibleVerse}&rdquo;
            </Text>
            <Text style={[styles.verseReference, { color: colors.accent }]}>
              — {selectedDevotion.bibleReference}
            </Text>
          </View>

          {/* Main Content */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              <Ionicons name="document-text-outline" size={18} color={colors.accent} /> Today&apos;s Message
            </Text>
            <Text style={[styles.sectionContent, { color: colors.text }]}>
              {selectedDevotion.content}
            </Text>
          </View>

          {/* Reflection */}
          {selectedDevotion.reflection && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                <Ionicons name="bulb-outline" size={18} color={colors.accent} /> Reflection
              </Text>
              <Text style={[styles.sectionContent, { color: colors.text }]}>
                {selectedDevotion.reflection}
              </Text>
            </View>
          )}

          {/* Prayer */}
          {selectedDevotion.prayer && (
            <View style={[styles.prayerCard, { backgroundColor: colors.surface }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                <Ionicons name="heart-outline" size={18} color={colors.accent} /> Prayer
              </Text>
              <Text style={[styles.prayerText, { color: colors.text, fontStyle: 'italic' }]}>
                {selectedDevotion.prayer}
              </Text>
            </View>
          )}

          <Text style={[styles.authorText, { color: colors.muted }]}>
            Written by {selectedDevotion.authorName}
          </Text>
          </ScrollView>
        </RoundedPage>
      </SafeAreaView>
    </CinematicBackground>
    );
  }

  return (
    <CinematicBackground useOuterBackground>
      <SafeAreaView style={styles.container}>
        {/* === HEADER SECTION === */}
        <View style={styles.headerSection}>
          <GlassIconButton onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color={colors.stone700} />
          </GlassIconButton>
          <View style={styles.headerCenter}>
            <Text style={[styles.kicker, { color: colors.stone500 }]}>SPIRITUAL</Text>
            <Text style={styles.heading}>
              Devotions<Text style={styles.headingDot}>.</Text>
            </Text>
          </View>
          {isAdmin ? (
            <GlassIconButton onPress={handleOpenCreate}>
              <Ionicons name="add" size={22} color={colors.stone700} />
            </GlassIconButton>
          ) : (
            <View style={{ width: 44 }} />
          )}
        </View>

        {/* === MAIN CONTENT === */}
        <RoundedPage style={styles.mainContent}>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : devotions.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="book-outline" size={64} color={colors.muted} />
          <Text style={[styles.emptyText, { color: colors.muted }]}>No devotions yet</Text>
          {isAdmin && (
            <TouchableOpacity 
              style={[styles.createButton, { backgroundColor: colors.accent }]}
              onPress={handleOpenCreate}
            >
              <Text style={styles.createButtonText}>Create First Devotion</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          {/* Featured/Latest Devotion */}
          {devotions.length > 0 && (
            <TouchableOpacity 
              style={[styles.featuredCard, { backgroundColor: colors.accent }]}
              onPress={() => setSelectedDevotion(devotions[0])}
            >
              <View style={styles.featuredBadge}>
                <Ionicons name="sunny" size={16} color="#fff" />
                <Text style={styles.featuredBadgeText}>Today&apos;s Devotion</Text>
              </View>
              <Text style={styles.featuredTitle}>{devotions[0].title}</Text>
              <Text style={styles.featuredVerse} numberOfLines={2}>
                &ldquo;{devotions[0].bibleVerse}&rdquo;
              </Text>
              <Text style={styles.featuredReference}>— {devotions[0].bibleReference}</Text>
              <View style={styles.featuredFooter}>
                <Text style={styles.featuredDate}>{formatDate(devotions[0].publishDate)}</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </View>
            </TouchableOpacity>
          )}

          {/* Previous Devotions */}
          {devotions.length > 1 && (
            <>
              <Text style={[styles.sectionHeader, { color: colors.text }]}>Previous Devotions</Text>
              {devotions.slice(1).map((devotion) => (
                <TouchableOpacity 
                  key={devotion.id} 
                  style={[styles.card, { backgroundColor: colors.surface }]}
                  onPress={() => setSelectedDevotion(devotion)}
                >
                  <View style={styles.cardContent}>
                    <Text style={[styles.cardTitle, { color: colors.text }]}>{devotion.title}</Text>
                    <Text style={[styles.cardVerse, { color: colors.muted }]} numberOfLines={1}>
                      {devotion.bibleReference}
                    </Text>
                    <Text style={[styles.cardDate, { color: colors.muted }]}>
                      {formatDate(devotion.publishDate)}
                    </Text>
                  </View>
                  {isAdmin && (
                    <View style={styles.adminActions}>
                      <TouchableOpacity onPress={() => handleOpenEdit(devotion)} style={styles.iconButton}>
                        <Ionicons name="create-outline" size={18} color={colors.muted} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDelete(devotion)} style={styles.iconButton}>
                        <Ionicons name="trash-outline" size={18} color="#dc2626" />
                      </TouchableOpacity>
                    </View>
                  )}
                  <Ionicons name="chevron-forward" size={20} color={colors.muted} />
                </TouchableOpacity>
              ))}
            </>
          )}
        </ScrollView>
      )}

      {/* Create/Edit Modal */}
      <Modal visible={showCreateModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {editingDevotion ? 'Edit Devotion' : 'New Devotion'}
              </Text>
              <TouchableOpacity onPress={() => { setShowCreateModal(false); resetForm(); }}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={[styles.label, { color: colors.text }]}>Title *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                value={title}
                onChangeText={setTitle}
                placeholder="Devotion title"
                placeholderTextColor={colors.muted}
              />

              <Text style={[styles.label, { color: colors.text }]}>Bible Verse *</Text>
              <TextInput
                style={[styles.input, styles.textArea, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                value={bibleVerse}
                onChangeText={setBibleVerse}
                placeholder="Enter the Bible verse text..."
                placeholderTextColor={colors.muted}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              <Text style={[styles.label, { color: colors.text }]}>Bible Reference *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                value={bibleReference}
                onChangeText={setBibleReference}
                placeholder="e.g., John 3:16"
                placeholderTextColor={colors.muted}
              />

              <Text style={[styles.label, { color: colors.text }]}>Message/Content *</Text>
              <TextInput
                style={[styles.input, styles.textAreaLarge, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                value={content}
                onChangeText={setContent}
                placeholder="Today's devotional message..."
                placeholderTextColor={colors.muted}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />

              <Text style={[styles.label, { color: colors.text }]}>Reflection (Optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                value={reflection}
                onChangeText={setReflection}
                placeholder="Questions or thoughts for reflection..."
                placeholderTextColor={colors.muted}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              <Text style={[styles.label, { color: colors.text }]}>Prayer (Optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                value={prayer}
                onChangeText={setPrayer}
                placeholder="A prayer for today..."
                placeholderTextColor={colors.muted}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
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
                    {editingDevotion ? 'Update' : 'Publish'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
        </Modal>
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
    letterSpacing: -1,
    lineHeight: 36,
    color: '#1c1917',
  },
  headingDot: {
    color: '#f59e0b',
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
  },
  featuredCard: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  featuredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: spacing.sm,
  },
  featuredBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.9,
  },
  featuredTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  featuredVerse: {
    color: '#fff',
    fontSize: 14,
    fontStyle: 'italic',
    opacity: 0.9,
    marginBottom: spacing.xs,
  },
  featuredReference: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.8,
  },
  featuredFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  featuredDate: {
    color: '#fff',
    fontSize: 12,
    opacity: 0.8,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  cardVerse: {
    fontSize: 13,
    marginBottom: 2,
  },
  cardDate: {
    fontSize: 12,
  },
  adminActions: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginRight: spacing.sm,
  },
  iconButton: {
    padding: spacing.xs,
  },
  // Detail view styles
  detailContent: {
    flex: 1,
  },
  detailContainer: {
    padding: spacing.lg,
  },
  detailDate: {
    fontSize: 14,
    marginBottom: spacing.xs,
  },
  detailTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: spacing.lg,
    lineHeight: 28,
  },
  verseCard: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  verseIcon: {
    marginBottom: spacing.sm,
  },
  verseText: {
    fontSize: 16,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.sm,
  },
  verseReference: {
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  sectionContent: {
    fontSize: 16,
    lineHeight: 24,
  },
  prayerCard: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  prayerText: {
    fontSize: 15,
    lineHeight: 22,
  },
  authorText: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '95%',
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
    minHeight: 80,
  },
  textAreaLarge: {
    minHeight: 120,
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
