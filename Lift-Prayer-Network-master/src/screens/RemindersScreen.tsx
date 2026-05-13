import React, { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import {
  addReminder,
  deleteReminder,
  formatTime,
  getDayNames,
  loadReminders,
  requestNotificationPermissions,
  REMINDER_MESSAGES,
  updateReminder,
  type PrayerReminder,
} from '../services/reminders';
import { fonts, palette, radius, spacing } from '../theme/colors';
import { LiftScreen, LiftHeader } from '../components/LiftLayout';

const DAYS = [
  { id: 0, short: 'S', full: 'Sunday' },
  { id: 1, short: 'M', full: 'Monday' },
  { id: 2, short: 'T', full: 'Tuesday' },
  { id: 3, short: 'W', full: 'Wednesday' },
  { id: 4, short: 'T', full: 'Thursday' },
  { id: 5, short: 'F', full: 'Friday' },
  { id: 6, short: 'S', full: 'Saturday' },
];

export const RemindersScreen: React.FC = () => {
  const navigation = useNavigation();
  const [reminders, setReminders] = useState<PrayerReminder[]>([]);
  const [, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingReminder, setEditingReminder] = useState<PrayerReminder | null>(null);
  const [hour, setHour] = useState(8);
  const [minute, setMinute] = useState(0);
  const [selectedDays, setSelectedDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [message, setMessage] = useState(REMINDER_MESSAGES[0]);
  const [permissionGranted, setPermissionGranted] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const hasPermission = await requestNotificationPermissions();
    setPermissionGranted(hasPermission);
    
    const data = await loadReminders();
    setReminders(data);
    setLoading(false);
  };

  const handleAddReminder = () => {
    setEditingReminder(null);
    setHour(8);
    setMinute(0);
    setSelectedDays([0, 1, 2, 3, 4, 5, 6]);
    setMessage(REMINDER_MESSAGES[0]);
    setShowModal(true);
  };

  const handleEditReminder = (reminder: PrayerReminder) => {
    setEditingReminder(reminder);
    setHour(reminder.hour);
    setMinute(reminder.minute);
    setSelectedDays(reminder.days);
    setMessage(reminder.message);
    setShowModal(true);
  };

  const handleSaveReminder = async () => {
    if (selectedDays.length === 0) {
      Alert.alert('Select Days', 'Please select at least one day');
      return;
    }

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    try {
      if (editingReminder) {
        const updated = {
          ...editingReminder,
          hour,
          minute,
          days: selectedDays,
          message,
        };
        await updateReminder(updated);
        setReminders((prev) =>
          prev.map((r) => (r.id === updated.id ? updated : r))
        );
      } else {
        const newReminder = await addReminder({
          hour,
          minute,
          days: selectedDays,
          message,
          enabled: true,
        });
        setReminders((prev) => [...prev, newReminder]);
      }

      setShowModal(false);
    } catch {
      Alert.alert('Error', 'Could not save reminder');
    }
  };

  const handleToggleReminder = async (reminder: PrayerReminder) => {
    const updated = { ...reminder, enabled: !reminder.enabled };
    await updateReminder(updated);
    setReminders((prev) =>
      prev.map((r) => (r.id === reminder.id ? updated : r))
    );
  };

  const handleDeleteReminder = (reminder: PrayerReminder) => {
    Alert.alert(
      'Delete Reminder',
      'Are you sure you want to delete this reminder?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteReminder(reminder.id);
            setReminders((prev) => prev.filter((r) => r.id !== reminder.id));
          },
        },
      ]
    );
  };

  const toggleDay = (dayId: number) => {
    setSelectedDays((prev) =>
      prev.includes(dayId)
        ? prev.filter((d) => d !== dayId)
        : [...prev, dayId].sort()
    );
  };

  const adjustHour = (delta: number) => {
    setHour((prev) => {
      const next = prev + delta;
      if (next < 0) return 23;
      if (next > 23) return 0;
      return next;
    });
  };

  const adjustMinute = (delta: number) => {
    setMinute((prev) => {
      const next = prev + delta;
      if (next < 0) return 55;
      if (next > 55) return 0;
      return next;
    });
  };

  if (!permissionGranted && Platform.OS !== 'web') {
    return (
      <LiftScreen>
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>🔔</Text>
          <Text style={styles.emptyTitle}>Enable Notifications</Text>
          <Text style={styles.emptySubtitle}>
            Allow notifications to receive prayer reminders
          </Text>
          <TouchableOpacity
            style={styles.enableBtn}
            onPress={async () => {
              const granted = await requestNotificationPermissions();
              setPermissionGranted(granted);
            }}
          >
            <Text style={styles.enableBtnText}>Enable Notifications</Text>
          </TouchableOpacity>
        </View>
      </LiftScreen>
    );
  }

  const renderReminder = ({ item }: { item: PrayerReminder }) => (
    <TouchableOpacity
      style={styles.reminderCard}
      onPress={() => handleEditReminder(item)}
    >
      <View style={styles.reminderMain}>
        <Text style={[styles.reminderTime, !item.enabled && styles.reminderDisabled]}>
          {formatTime(item.hour, item.minute)}
        </Text>
        <Text style={[styles.reminderDays, !item.enabled && styles.reminderDisabled]}>
          {getDayNames(item.days)}
        </Text>
      </View>
      <View style={styles.reminderActions}>
        <Switch
          value={item.enabled}
          onValueChange={() => handleToggleReminder(item)}
          trackColor={{ false: '#e5e7eb', true: '#fde68a' }}
          thumbColor={item.enabled ? '#4A5D4E' : '#9ca3af'}
        />
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => handleDeleteReminder(item)}
        >
          <Ionicons name="trash-outline" size={18} color="#dc2626" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <>
    <LiftScreen>
      <LiftHeader title="Reminders" subtitle="Schedule your prayer reminders" onBack={() => navigation.goBack()} />
      <View style={styles.content}>

      {reminders.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>⏰</Text>
          <Text style={styles.emptyTitle}>No reminders yet</Text>
          <Text style={styles.emptySubtitle}>
            Set daily reminders to build your prayer habit
          </Text>
          <TouchableOpacity style={styles.enableBtn} onPress={handleAddReminder}>
            <Ionicons name="add-circle-outline" size={20} color={palette.accentDark} />
            <Text style={styles.enableBtnText}>Add Reminder</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={reminders}
          keyExtractor={(item) => item.id}
          renderItem={renderReminder}
          contentContainerStyle={styles.list}
        />
      )}
      </View>
    </LiftScreen>

    {/* Add/Edit Modal */}
    <Modal
        visible={showModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingReminder ? 'Edit Reminder' : 'New Reminder'}
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color={palette.muted} />
              </TouchableOpacity>
            </View>

            {/* Time Picker */}
            <View style={styles.timePicker}>
              <View style={styles.timeColumn}>
                <TouchableOpacity onPress={() => adjustHour(1)} style={styles.timeBtn}>
                  <Ionicons name="chevron-up" size={24} color={palette.muted} />
                </TouchableOpacity>
                <Text style={styles.timeValue}>{hour.toString().padStart(2, '0')}</Text>
                <TouchableOpacity onPress={() => adjustHour(-1)} style={styles.timeBtn}>
                  <Ionicons name="chevron-down" size={24} color={palette.muted} />
                </TouchableOpacity>
              </View>
              <Text style={styles.timeSeparator}>:</Text>
              <View style={styles.timeColumn}>
                <TouchableOpacity onPress={() => adjustMinute(5)} style={styles.timeBtn}>
                  <Ionicons name="chevron-up" size={24} color={palette.muted} />
                </TouchableOpacity>
                <Text style={styles.timeValue}>{minute.toString().padStart(2, '0')}</Text>
                <TouchableOpacity onPress={() => adjustMinute(-5)} style={styles.timeBtn}>
                  <Ionicons name="chevron-down" size={24} color={palette.muted} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Day Selector */}
            <Text style={styles.sectionLabel}>Repeat on</Text>
            <View style={styles.daySelector}>
              {DAYS.map((day) => (
                <TouchableOpacity
                  key={day.id}
                  style={[
                    styles.dayBtn,
                    selectedDays.includes(day.id) && styles.dayBtnActive,
                  ]}
                  onPress={() => toggleDay(day.id)}
                >
                  <Text
                    style={[
                      styles.dayBtnText,
                      selectedDays.includes(day.id) && styles.dayBtnTextActive,
                    ]}
                  >
                    {day.short}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Message Selector */}
            <Text style={styles.sectionLabel}>Reminder message</Text>
            <ScrollView style={styles.messageScroll} horizontal showsHorizontalScrollIndicator={false}>
              {REMINDER_MESSAGES.map((msg) => (
                <TouchableOpacity
                  key={msg}
                  style={[
                    styles.messageOption,
                    message === msg && styles.messageOptionActive,
                  ]}
                  onPress={() => setMessage(msg)}
                >
                  <Text
                    style={[
                      styles.messageText,
                      message === msg && styles.messageTextActive,
                    ]}
                  >
                    {msg}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Save Button */}
            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveReminder}>
              <Text style={styles.saveBtnText}>
                {editingReminder ? 'Update Reminder' : 'Create Reminder'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
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
  
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    paddingBottom: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    padding: spacing.lg,
    paddingTop: 0,
  },
  reminderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: spacing.lg,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: palette.border,
  },
  reminderMain: {
    flex: 1,
  },
  reminderTime: {
    fontSize: 28,
    fontWeight: '800',
    color: palette.text,
  },
  reminderDays: {
    fontSize: 13,
    color: palette.muted,
  },
  reminderDisabled: {
    opacity: 0.4,
  },
  reminderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  deleteBtn: {
    padding: spacing.xs,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: palette.text,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: 14,
    color: palette.muted,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  enableBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: '#F7F1E8',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  enableBtnText: {
    fontWeight: '700',
    color: palette.accentDark,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: palette.text,
  },
  timePicker: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  timeColumn: {
    alignItems: 'center',
  },
  timeBtn: {
    padding: spacing.sm,
  },
  timeValue: {
    fontSize: 48,
    fontWeight: '800',
    color: palette.text,
    minWidth: 80,
    textAlign: 'center',
  },
  timeSeparator: {
    fontSize: 48,
    fontWeight: '800',
    color: palette.muted,
    marginHorizontal: spacing.sm,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.muted,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  daySelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  dayBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBtnActive: {
    backgroundColor: palette.accent,
  },
  dayBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.muted,
  },
  dayBtnTextActive: {
    color: '#2C332E',
  },
  messageInput: {
    backgroundColor: '#FAF8F5',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
    color: palette.text,
    borderWidth: 1,
    borderColor: palette.border,
    marginBottom: spacing.lg,
  },
  messageScroll: {
    maxHeight: 120,
  },
  messageOption: {
    backgroundColor: '#f1f5f9',
    padding: spacing.sm,
    borderRadius: radius.sm,
    marginRight: spacing.sm,
  },
  messageOptionActive: {
    backgroundColor: palette.accent,
  },
  messageText: {
    fontSize: 14,
    color: palette.muted,
  },
  messageTextActive: {
    color: '#2C332E',
  },
  saveBtn: {
    backgroundColor: palette.accent,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#2C332E',
  },
});
