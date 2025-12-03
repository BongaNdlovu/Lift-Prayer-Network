import React, { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../contexts/ThemeContext';
import { palette, radius, spacing, fonts, shadows } from '../theme/colors';
import { CinematicBackground, RoundedPage } from '../components/CinematicBackground';
import { GlassIconButton } from '../components/GlassCard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { requestNotificationPermissions } from '../services/reminders';
import { parseNaturalLanguage, formatParsedEvent, type ParsedEvent } from '../utils/naturalLanguageParser';

const EVENTS_KEY = '@lift_prayer_events';

type PrayerEvent = {
  id: string;
  title: string;
  description?: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm (24-hour format)
  reminder: boolean;
  reminderMinutesBefore: number; // Minutes before event to send reminder
  category: 'personal' | 'family' | 'work' | 'health' | 'other';
  color: string;
  notificationId?: string; // ID of scheduled notification
};

const CATEGORIES = [
  { id: 'personal', label: 'Personal', color: '#3b82f6', emoji: '🙏' },
  { id: 'family', label: 'Family', color: '#22c55e', emoji: '👨‍👩‍👧‍👦' },
  { id: 'work', label: 'Work', color: '#f59e0b', emoji: '💼' },
  { id: 'health', label: 'Health', color: '#ef4444', emoji: '🏥' },
  { id: 'other', label: 'Other', color: '#8b5cf6', emoji: '✨' },
];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Reminder time options in minutes before event
const REMINDER_OPTIONS = [
  { value: 0, label: 'At time of event' },
  { value: 5, label: '5 minutes before' },
  { value: 15, label: '15 minutes before' },
  { value: 30, label: '30 minutes before' },
  { value: 60, label: '1 hour before' },
  { value: 120, label: '2 hours before' },
  { value: 1440, label: '1 day before' },
];

// Format time for display (12-hour format)
const formatDisplayTime = (hour: number, minute: number): string => {
  const h = hour % 12 || 12;
  const m = minute.toString().padStart(2, '0');
  const period = hour < 12 ? 'AM' : 'PM';
  return `${h}:${m} ${period}`;
};

// Parse HH:mm string to hour and minute
const parseTimeString = (timeStr: string): { hour: number; minute: number } => {
  const [hour, minute] = timeStr.split(':').map(Number);
  return { hour: hour || 9, minute: minute || 0 };
};

export const CalendarScreen: React.FC = () => {
  useAuth();
  const { colors, isDark } = useTheme();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [events, setEvents] = useState<PrayerEvent[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newCategory, setNewCategory] = useState<PrayerEvent['category']>('personal');
  const [newReminder, setNewReminder] = useState(true);
  const [newHour, setNewHour] = useState(() => new Date().getHours());
  const [newMinute, setNewMinute] = useState(() => new Date().getMinutes());
  const [newReminderMinutes, setNewReminderMinutes] = useState(15);
  const [showReminderPicker, setShowReminderPicker] = useState(false);
  // For editing events
  const [editingEvent, setEditingEvent] = useState<PrayerEvent | null>(null);
  
  // Quick add feature
  const [quickAddText, setQuickAddText] = useState('');
  const [parsedPreview, setParsedPreview] = useState<ParsedEvent | null>(null);

  useEffect(() => {
    loadEvents();
    // Request notification permissions on mount
    requestNotificationPermissions();
  }, []);

  const loadEvents = async () => {
    try {
      const data = await AsyncStorage.getItem(EVENTS_KEY);
      if (data) {
        setEvents(JSON.parse(data));
      }
    } catch (err) {
      console.warn('Error loading events:', err);
    }
  };

  const saveEvents = async (newEvents: PrayerEvent[]) => {
    try {
      await AsyncStorage.setItem(EVENTS_KEY, JSON.stringify(newEvents));
      setEvents(newEvents);
    } catch (err) {
      console.warn('Error saving events:', err);
    }
  };

  // Schedule a notification for an event
  const scheduleEventNotification = async (event: PrayerEvent): Promise<string | null> => {
    if (Platform.OS === 'web' || !event.reminder || !event.time) return null;

    try {
      // Parse the event date and time
      const [year, month, day] = event.date.split('-').map(Number);
      const { hour, minute } = parseTimeString(event.time);
      
      // Create the event date
      const eventDate = new Date(year, month - 1, day, hour, minute, 0);
      
      // Calculate notification time (subtract reminder minutes)
      const notificationDate = new Date(eventDate.getTime() - event.reminderMinutesBefore * 60 * 1000);
      
      // Don't schedule if the notification time is in the past
      if (notificationDate.getTime() <= Date.now()) {
        console.log('[Calendar] Notification time is in the past, skipping');
        return null;
      }

      // Get category info for the notification
      const category = CATEGORIES.find((c) => c.id === event.category);
      
      // Build notification content
      const reminderText = event.reminderMinutesBefore === 0 
        ? 'now' 
        : event.reminderMinutesBefore < 60 
          ? `in ${event.reminderMinutesBefore} minutes`
          : event.reminderMinutesBefore < 1440
            ? `in ${Math.round(event.reminderMinutesBefore / 60)} hour${event.reminderMinutesBefore >= 120 ? 's' : ''}`
            : 'tomorrow';

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: `${category?.emoji || '🙏'} Prayer Reminder`,
          body: `${event.title} - ${reminderText} at ${formatDisplayTime(hour, minute)}`,
          sound: true,
          data: { type: 'prayer_event', eventId: event.id },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: notificationDate,
        },
      });

      console.log('[Calendar] Scheduled notification:', notificationId, 'for', notificationDate);
      return notificationId;
    } catch (err) {
      console.error('[Calendar] Error scheduling notification:', err);
      return null;
    }
  };

  // Cancel a scheduled notification
  const cancelEventNotification = async (notificationId: string) => {
    if (Platform.OS === 'web') return;
    
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
      console.log('[Calendar] Cancelled notification:', notificationId);
    } catch (err) {
      console.warn('[Calendar] Error cancelling notification:', err);
    }
  };

  // Open modal for adding new event
  const openAddModal = () => {
    const now = new Date();
    setEditingEvent(null);
    setNewTitle('');
    setNewDescription('');
    setNewCategory('personal');
    setNewReminder(true);
    setNewHour(now.getHours());
    setNewMinute(now.getMinutes());
    setNewReminderMinutes(15);
    setShowReminderPicker(false);
    setShowAddModal(true);
  };

  // Open modal for editing an event
  const openEditModal = (event: PrayerEvent) => {
    setEditingEvent(event);
    setNewTitle(event.title);
    setNewDescription(event.description || '');
    setNewCategory(event.category);
    setNewReminder(event.reminder);
    if (event.time) {
      const { hour, minute } = parseTimeString(event.time);
      setNewHour(hour);
      setNewMinute(minute);
    } else {
      const now = new Date();
      setNewHour(now.getHours());
      setNewMinute(now.getMinutes());
    }
    setNewReminderMinutes(event.reminderMinutesBefore);
    setShowReminderPicker(false);
    setShowAddModal(true);
  };

  const handleSaveEvent = async () => {
    if (!newTitle.trim() || !selectedDate) return;

    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch { /* ignore */ }
    }

    const category = CATEGORIES.find((c) => c.id === newCategory);
    const timeString = `${newHour.toString().padStart(2, '0')}:${newMinute.toString().padStart(2, '0')}`;
    
    if (editingEvent) {
      // Editing existing event
      // Cancel old notification if exists
      if (editingEvent.notificationId) {
        await cancelEventNotification(editingEvent.notificationId);
      }

      const updatedEvent: PrayerEvent = {
        ...editingEvent,
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
        date: selectedDate,
        time: timeString,
        reminder: newReminder,
        reminderMinutesBefore: newReminderMinutes,
        category: newCategory,
        color: category?.color || '#3b82f6',
        notificationId: undefined,
      };

      // Schedule new notification if reminder is enabled
      if (newReminder) {
        const notificationId = await scheduleEventNotification(updatedEvent);
        if (notificationId) {
          updatedEvent.notificationId = notificationId;
        }
      }

      const updatedEvents = events.map((e) => 
        e.id === editingEvent.id ? updatedEvent : e
      );
      await saveEvents(updatedEvents);
      
      Alert.alert('Event Updated', newReminder && updatedEvent.notificationId 
        ? 'You will be reminded at the scheduled time.' 
        : 'Your prayer event has been updated.');
    } else {
      // Creating new event
      const newEvent: PrayerEvent = {
        id: Date.now().toString(),
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
        date: selectedDate,
        time: timeString,
        reminder: newReminder,
        reminderMinutesBefore: newReminderMinutes,
        category: newCategory,
        color: category?.color || '#3b82f6',
      };

      // Schedule notification if reminder is enabled
      if (newReminder) {
        const notificationId = await scheduleEventNotification(newEvent);
        if (notificationId) {
          newEvent.notificationId = notificationId;
        }
      }

      await saveEvents([...events, newEvent]);
      
      if (newReminder && newEvent.notificationId) {
        Alert.alert('Event Created', 'You will be reminded at the scheduled time.');
      }
    }

    setShowAddModal(false);
    setEditingEvent(null);
    setNewTitle('');
    setNewDescription('');
    setNewCategory('personal');
    setNewReminder(true);
    const now = new Date();
    setNewHour(now.getHours());
    setNewMinute(now.getMinutes());
    setNewReminderMinutes(15);
  };

  const handleDeleteEvent = (eventId: string) => {
    const event = events.find((e) => e.id === eventId);
    
    Alert.alert('Delete Event', 'Are you sure you want to delete this prayer event?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          // Cancel the notification if it exists
          if (event?.notificationId) {
            await cancelEventNotification(event.notificationId);
          }
          await saveEvents(events.filter((e) => e.id !== eventId));
        },
      },
    ]);
  };

  // Quick add handlers
  const handleQuickAddChange = (text: string) => {
    setQuickAddText(text);
    if (text.trim().length > 2) {
      const parsed = parseNaturalLanguage(text);
      setParsedPreview(parsed);
    } else {
      setParsedPreview(null);
    }
  };

  const handleQuickAdd = async () => {
    if (!parsedPreview) return;
    
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    const dateKey = `${parsedPreview.date.getFullYear()}-${String(parsedPreview.date.getMonth() + 1).padStart(2, '0')}-${String(parsedPreview.date.getDate()).padStart(2, '0')}`;
    
    const newEvent: PrayerEvent = {
      id: Date.now().toString(),
      title: parsedPreview.title,
      date: dateKey,
      time: parsedPreview.hasTime && parsedPreview.time 
        ? `${String(parsedPreview.time.hour).padStart(2, '0')}:${String(parsedPreview.time.minute).padStart(2, '0')}`
        : undefined,
      reminder: parsedPreview.hasTime,
      reminderMinutesBefore: 15,
      category: 'personal',
      color: '#3b82f6',
    };

    // Schedule notification if has time
    if (newEvent.reminder && newEvent.time) {
      const notificationId = await scheduleEventNotification(newEvent);
      if (notificationId) {
        newEvent.notificationId = notificationId;
      }
    }

    await saveEvents([...events, newEvent]);
    setQuickAddText('');
    setParsedPreview(null);
    setSelectedDate(dateKey);
    
    Alert.alert('Added!', `"${parsedPreview.title}" added to ${formatParsedEvent(parsedPreview)}`);
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return { firstDay, daysInMonth };
  };

  const formatDateKey = (year: number, month: number, day: number) => {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const getEventsForDate = (dateKey: string) => {
    return events.filter((e) => e.date === dateKey);
  };

  const goToPrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    const today = new Date();
    setSelectedDate(formatDateKey(today.getFullYear(), today.getMonth(), today.getDate()));
  };

  const { firstDay, daysInMonth } = getDaysInMonth(currentDate);
  const today = new Date();
  const todayKey = formatDateKey(today.getFullYear(), today.getMonth(), today.getDate());

  const renderCalendarDays = () => {
    const days = [];
    
    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) {
      days.push(<View key={`empty-${i}`} style={styles.dayCell} />);
    }

    // Days of month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = formatDateKey(currentDate.getFullYear(), currentDate.getMonth(), day);
      const dayEvents = getEventsForDate(dateKey);
      const isToday = dateKey === todayKey;
      const isSelected = dateKey === selectedDate;

      days.push(
        <TouchableOpacity
          key={day}
          style={[
            styles.dayCell,
            isToday && styles.todayCell,
            isSelected && styles.selectedCell,
          ]}
          onPress={() => {
            if (Platform.OS !== 'web') Haptics.selectionAsync();
            setSelectedDate(dateKey);
          }}
        >
          <Text
            style={[
              styles.dayText,
              { color: colors.text },
              isToday && styles.todayText,
              isSelected && styles.selectedText,
            ]}
          >
            {day}
          </Text>
          {dayEvents.length > 0 && (
            <View style={styles.eventDots}>
              {dayEvents.slice(0, 3).map((event, i) => (
                <View
                  key={i}
                  style={[styles.eventDot, { backgroundColor: event.color }]}
                />
              ))}
            </View>
          )}
        </TouchableOpacity>
      );
    }

    return days;
  };

  const selectedDateEvents = selectedDate ? getEventsForDate(selectedDate) : [];

  return (
    <CinematicBackground useOuterBackground>
      <SafeAreaView style={styles.container}>
        {/* === HEADER SECTION === */}
        <View style={styles.headerSection}>
          <View>
            <Text style={[styles.kicker, { color: colors.stone500 }]}>PLAN YOUR PRAYERS</Text>
            <Text style={styles.heading}>
              Calendar<Text style={styles.headingDot}>.</Text>
            </Text>
          </View>
          <GlassIconButton
            onPress={goToToday}
            style={{ backgroundColor: colors.amber100, borderColor: colors.amber200 }}
          >
            <Text style={{ fontWeight: '700', color: colors.amber700, fontSize: 12 }}>TODAY</Text>
          </GlassIconButton>
        </View>

        {/* === MAIN CONTENT === */}
        <RoundedPage style={styles.mainContent}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

          {/* Quick Add */}
          <View style={[styles.quickAddContainer, { backgroundColor: isDark ? colors.surface : 'rgba(255, 255, 255, 0.9)' }]}>
            <View style={styles.quickAddInputRow}>
              <Ionicons name="flash-outline" size={20} color={colors.accent} />
              <TextInput
                style={[styles.quickAddInput, { color: colors.text }]}
                placeholder="Quick add: 'Pray for John tomorrow 7am'"
                placeholderTextColor={colors.muted}
                value={quickAddText}
                onChangeText={handleQuickAddChange}
                returnKeyType="done"
                onSubmitEditing={parsedPreview ? handleQuickAdd : undefined}
              />
              {quickAddText.length > 0 && (
                <TouchableOpacity onPress={() => { setQuickAddText(''); setParsedPreview(null); }}>
                  <Ionicons name="close-circle" size={20} color={colors.muted} />
                </TouchableOpacity>
              )}
            </View>
            {parsedPreview && (
              <TouchableOpacity style={styles.quickAddPreview} onPress={handleQuickAdd}>
                <View style={styles.quickAddPreviewContent}>
                  <Text style={[styles.quickAddPreviewTitle, { color: colors.text }]}>
                    {parsedPreview.title}
                  </Text>
                  <Text style={[styles.quickAddPreviewDate, { color: colors.muted }]}>
                    {formatParsedEvent(parsedPreview)}
                  </Text>
                </View>
                <View style={[styles.quickAddButton, { backgroundColor: colors.accent }]}>
                  <Ionicons name="add" size={18} color="#fff" />
                </View>
              </TouchableOpacity>
            )}
          </View>

          {/* Month Navigation */}
          <View style={styles.monthNav}>
            <TouchableOpacity onPress={goToPrevMonth} style={[styles.navButton, { backgroundColor: colors.surface }]}>
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.monthTitle, { color: colors.text }]}>
              {MONTH_NAMES[currentDate.getMonth()]} {currentDate.getFullYear()}
            </Text>
            <TouchableOpacity onPress={goToNextMonth} style={[styles.navButton, { backgroundColor: colors.surface }]}>
              <Ionicons name="chevron-forward" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Calendar Grid */}
          <View style={[styles.calendarCard, { backgroundColor: isDark ? colors.surface : 'rgba(255, 255, 255, 0.8)' }]}>
            {/* Day Headers */}
            <View style={styles.dayHeaders}>
              {DAY_NAMES.map((day) => (
                <View key={day} style={styles.dayHeaderCell}>
                  <Text style={[styles.dayHeaderText, { color: colors.muted }]}>{day}</Text>
                </View>
              ))}
            </View>

            {/* Days Grid */}
            <View style={styles.daysGrid}>{renderCalendarDays()}</View>
          </View>

          {/* Selected Date Events */}
          {selectedDate && (
            <View style={styles.eventsSection}>
              <View style={styles.eventsSectionHeader}>
                <Text style={[styles.eventsSectionTitle, { color: colors.text }]}>
                  {selectedDate === todayKey ? 'Today' : selectedDate}
                </Text>
                <TouchableOpacity
                  style={styles.addEventButton}
                  onPress={openAddModal}
                >
                  <Ionicons name="add" size={20} color="#fff" />
                </TouchableOpacity>
              </View>

              {selectedDateEvents.length === 0 ? (
                <View style={[styles.noEvents, { backgroundColor: isDark ? colors.surface : 'rgba(255, 255, 255, 0.6)' }]}>
                  <Text style={styles.noEventsEmoji}>📅</Text>
                  <Text style={[styles.noEventsText, { color: colors.muted }]}>No prayer events</Text>
                  <TouchableOpacity
                    style={styles.addFirstButton}
                    onPress={openAddModal}
                  >
                    <Ionicons name="add-circle-outline" size={18} color={palette.accentDark} />
                    <Text style={styles.addFirstText}>Add Prayer Event</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                selectedDateEvents.map((event) => {
                  const eventTime = event.time ? parseTimeString(event.time) : null;
                  return (
                    <View key={event.id} style={[styles.eventCard, { borderLeftColor: event.color, backgroundColor: colors.surface }]}>
                      <View style={styles.eventContent}>
                        <View style={styles.eventTitleRow}>
                          <Text style={[styles.eventTitle, { color: colors.text }]}>{event.title}</Text>
                          {eventTime && (
                            <View style={styles.eventTimeBadge}>
                              <Ionicons name="time-outline" size={12} color={palette.muted} />
                              <Text style={styles.eventTimeText}>
                                {formatDisplayTime(eventTime.hour, eventTime.minute)}
                              </Text>
                            </View>
                          )}
                        </View>
                        {event.description && (
                          <Text style={styles.eventDescription}>{event.description}</Text>
                        )}
                        <View style={styles.eventMeta}>
                          <View style={[styles.categoryBadge, { backgroundColor: event.color + '20' }]}>
                            <Text style={[styles.categoryText, { color: event.color }]}>
                              {CATEGORIES.find((c) => c.id === event.category)?.emoji}{' '}
                              {CATEGORIES.find((c) => c.id === event.category)?.label}
                            </Text>
                          </View>
                          {event.reminder && (
                            <View style={styles.reminderBadge}>
                              <Ionicons name="notifications" size={12} color={palette.accent} />
                              <Text style={styles.reminderBadgeText}>
                                {REMINDER_OPTIONS.find((r) => r.value === event.reminderMinutesBefore)?.label || 'Reminder set'}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                      <View style={styles.eventActions}>
                        <TouchableOpacity
                          style={styles.editEventButton}
                          onPress={() => openEditModal(event)}
                        >
                          <Ionicons name="pencil-outline" size={18} color={palette.accent} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.deleteEventButton}
                          onPress={() => handleDeleteEvent(event.id)}
                        >
                          <Ionicons name="trash-outline" size={18} color="#dc2626" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          )}
          </ScrollView>
        </RoundedPage>

        {/* Add Event Modal */}
        <Modal
        visible={showAddModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView>
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  {editingEvent ? 'Edit Prayer Event' : 'Add Prayer Event'}
                </Text>
                <TouchableOpacity onPress={() => {
                  setShowAddModal(false);
                  setEditingEvent(null);
                }}>
                  <Ionicons name="close" size={24} color={colors.muted} />
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>Title</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Job interview, Doctor's appointment"
                placeholderTextColor={palette.muted}
                value={newTitle}
                onChangeText={setNewTitle}
              />

              <Text style={styles.inputLabel}>Description (optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Add prayer points..."
                placeholderTextColor={palette.muted}
                value={newDescription}
                onChangeText={setNewDescription}
                multiline
              />

              {/* Time Input - Users can type directly */}
              <Text style={styles.inputLabel}>Event Time</Text>
              <View style={styles.timeInputContainer}>
                <View style={styles.timeInputWrapper}>
                  <TextInput
                    style={styles.timeInput}
                    value={newHour.toString().padStart(2, '0')}
                    onChangeText={(text) => {
                      const num = parseInt(text.replace(/[^0-9]/g, ''), 10);
                      if (!isNaN(num) && num >= 0 && num <= 23) {
                        setNewHour(num);
                      } else if (text === '') {
                        setNewHour(0);
                      }
                    }}
                    keyboardType="number-pad"
                    maxLength={2}
                    placeholder="HH"
                    placeholderTextColor={palette.muted}
                    selectTextOnFocus
                  />
                  <Text style={styles.timeInputLabel}>Hour</Text>
                </View>
                
                <Text style={styles.timeInputSeparator}>:</Text>
                
                <View style={styles.timeInputWrapper}>
                  <TextInput
                    style={styles.timeInput}
                    value={newMinute.toString().padStart(2, '0')}
                    onChangeText={(text) => {
                      const num = parseInt(text.replace(/[^0-9]/g, ''), 10);
                      if (!isNaN(num) && num >= 0 && num <= 59) {
                        setNewMinute(num);
                      } else if (text === '') {
                        setNewMinute(0);
                      }
                    }}
                    keyboardType="number-pad"
                    maxLength={2}
                    placeholder="MM"
                    placeholderTextColor={palette.muted}
                    selectTextOnFocus
                  />
                  <Text style={styles.timeInputLabel}>Min</Text>
                </View>
                
                <View style={styles.amPmIndicator}>
                  <Text style={styles.amPmText}>
                    {newHour < 12 ? 'AM' : 'PM'}
                  </Text>
                  <Text style={styles.time12Hour}>
                    {formatDisplayTime(newHour, newMinute)}
                  </Text>
                </View>
              </View>
              
              {/* Quick time presets */}
              <View style={styles.timePresets}>
                {[
                  { label: '6 AM', hour: 6, min: 0 },
                  { label: '9 AM', hour: 9, min: 0 },
                  { label: '12 PM', hour: 12, min: 0 },
                  { label: '6 PM', hour: 18, min: 0 },
                  { label: '9 PM', hour: 21, min: 0 },
                ].map((preset) => (
                  <TouchableOpacity
                    key={preset.label}
                    style={[
                      styles.timePresetButton,
                      newHour === preset.hour && newMinute === preset.min && styles.timePresetButtonActive,
                    ]}
                    onPress={() => {
                      setNewHour(preset.hour);
                      setNewMinute(preset.min);
                      if (Platform.OS !== 'web') {
                        try { Haptics.selectionAsync(); } catch { /* ignore */ }
                      }
                    }}
                  >
                    <Text style={[
                      styles.timePresetText,
                      newHour === preset.hour && newMinute === preset.min && styles.timePresetTextActive,
                    ]}>
                      {preset.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Category</Text>
              <View style={styles.categoryPicker}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categoryOption,
                      newCategory === cat.id && { backgroundColor: cat.color + '20', borderColor: cat.color },
                    ]}
                    onPress={() => setNewCategory(cat.id as PrayerEvent['category'])}
                  >
                    <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
                    <Text
                      style={[
                        styles.categoryLabel,
                        newCategory === cat.id && { color: cat.color },
                      ]}
                    >
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Reminder Toggle */}
              <TouchableOpacity
                style={styles.reminderToggle}
                onPress={() => setNewReminder(!newReminder)}
              >
                <Ionicons
                  name={newReminder ? 'checkbox' : 'square-outline'}
                  size={24}
                  color={newReminder ? palette.accent : palette.muted}
                />
                <Text style={styles.reminderText}>Remind me to pray</Text>
              </TouchableOpacity>

              {/* Reminder Time Options */}
              {newReminder && (
                <View style={styles.reminderOptionsContainer}>
                  <Text style={styles.inputLabel}>When to remind</Text>
                  <TouchableOpacity
                    style={styles.reminderPickerButton}
                    onPress={() => setShowReminderPicker(!showReminderPicker)}
                  >
                    <Ionicons name="notifications-outline" size={18} color={palette.accent} />
                    <Text style={styles.reminderPickerText}>
                      {REMINDER_OPTIONS.find((r) => r.value === newReminderMinutes)?.label || '15 minutes before'}
                    </Text>
                    <Ionicons name={showReminderPicker ? 'chevron-up' : 'chevron-down'} size={18} color={palette.muted} />
                  </TouchableOpacity>

                  {showReminderPicker && (
                    <View style={styles.reminderOptionsGrid}>
                      {REMINDER_OPTIONS.map((option) => (
                        <TouchableOpacity
                          key={option.value}
                          style={[
                            styles.reminderOption,
                            newReminderMinutes === option.value && styles.reminderOptionSelected,
                          ]}
                          onPress={() => {
                            if (Platform.OS !== 'web') Haptics.selectionAsync();
                            setNewReminderMinutes(option.value);
                            setShowReminderPicker(false);
                          }}
                        >
                          <Text
                            style={[
                              styles.reminderOptionText,
                              newReminderMinutes === option.value && styles.reminderOptionTextSelected,
                            ]}
                          >
                            {option.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              )}

              <TouchableOpacity
                style={[styles.saveButton, !newTitle.trim() && styles.saveButtonDisabled]}
                onPress={handleSaveEvent}
                disabled={!newTitle.trim()}
              >
                <Text style={styles.saveButtonText}>
                  {editingEvent ? 'Save Changes' : 'Add Event'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
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
  scrollContent: {
    paddingBottom: 140,
  },
  gradient: {
    flex: 1,
  },
  quickAddContainer: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  quickAddInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  quickAddInput: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 14,
    paddingVertical: spacing.xs,
  },
  quickAddPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  quickAddPreviewContent: {
    flex: 1,
  },
  quickAddPreviewTitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
  },
  quickAddPreviewDate: {
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: 2,
  },
  quickAddButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  monthTitle: {
    fontFamily: fonts.heading,
    fontSize: 20,
    color: palette.text,
  },
  calendarCard: {
    marginHorizontal: spacing.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadows.md,
  },
  dayHeaders: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  dayHeaderCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  dayHeaderText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: palette.muted,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    minHeight: 44, // WCAG 2.1 minimum tap target
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  todayCell: {
    backgroundColor: palette.accentLight,
    borderRadius: radius.full,
  },
  selectedCell: {
    backgroundColor: palette.accent,
    borderRadius: radius.full,
  },
  dayText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: palette.text,
  },
  todayText: {
    fontFamily: fonts.bodyBold,
    color: palette.accentDark,
  },
  selectedText: {
    fontFamily: fonts.bodyBold,
    color: '#1f2937',
  },
  eventDots: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 2,
  },
  eventDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  eventsSection: {
    margin: spacing.lg,
    marginTop: spacing.xl,
  },
  eventsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  eventsSectionTitle: {
    fontFamily: fonts.heading,
    fontSize: 18,
    color: palette.text,
  },
  addEventButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.glow,
  },
  noEvents: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: radius.lg,
  },
  noEventsEmoji: {
    fontSize: 40,
    marginBottom: spacing.sm,
  },
  noEventsText: {
    fontFamily: fonts.body,
    color: palette.muted,
    marginBottom: spacing.md,
  },
  addFirstButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: palette.accentLight,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  addFirstText: {
    fontFamily: fonts.bodyBold,
    color: palette.accentDark,
  },
  eventCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderLeftWidth: 4,
    ...shadows.sm,
  },
  eventContent: {
    flex: 1,
  },
  eventTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  eventTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: palette.text,
    flex: 1,
  },
  eventTimeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  eventTimeText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: palette.muted,
  },
  eventDescription: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: palette.muted,
    marginTop: 4,
  },
  eventMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  categoryBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  categoryText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
  },
  reminderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    backgroundColor: palette.accentLight,
    borderRadius: radius.sm,
  },
  reminderBadgeText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    color: '#92400e',
  },
  eventActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  editEventButton: {
    padding: spacing.sm,
  },
  deleteEventButton: {
    padding: spacing.sm,
  },
  // Modal styles
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
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontFamily: fonts.heading,
    fontSize: 20,
    color: palette.text,
  },
  inputLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: fonts.body,
    fontSize: 16,
    color: palette.text,
    borderWidth: 1,
    borderColor: palette.border,
    marginBottom: spacing.md,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  categoryPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: '#f8fafc',
  },
  categoryEmoji: {
    fontSize: 16,
  },
  categoryLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: palette.muted,
  },
  reminderToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  reminderText: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: palette.text,
  },
  saveButton: {
    backgroundColor: palette.accent,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    ...shadows.glow,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: '#1f2937',
  },
  // Time picker styles
  // Time input styles
  timeInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.border,
    marginBottom: spacing.sm,
  },
  timeInputWrapper: {
    alignItems: 'center',
  },
  timeInput: {
    width: 60,
    height: 50,
    backgroundColor: '#fff',
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: palette.accent,
    fontSize: 24,
    fontWeight: '700',
    color: palette.text,
    textAlign: 'center',
  },
  timeInputLabel: {
    fontSize: 10,
    color: palette.muted,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  timeInputSeparator: {
    fontSize: 28,
    fontWeight: '700',
    color: palette.text,
    marginHorizontal: spacing.md,
  },
  amPmIndicator: {
    marginLeft: spacing.lg,
    alignItems: 'center',
  },
  amPmText: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.accent,
  },
  time12Hour: {
    fontSize: 12,
    color: palette.muted,
    marginTop: 2,
  },
  timePresets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  timePresetButton: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: palette.border,
  },
  timePresetButtonActive: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  timePresetText: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.muted,
  },
  timePresetTextActive: {
    color: '#1f2937',
  },
  // Legacy styles (kept for reference)
  timeOptionTextSelected: {
    fontFamily: fonts.bodyBold,
    color: '#1f2937',
  },
  timeSeparator: {
    fontFamily: fonts.bodyBold,
    fontSize: 24,
    color: palette.text,
    marginHorizontal: spacing.sm,
    marginTop: 20,
  },
  // Reminder options styles
  reminderOptionsContainer: {
    marginBottom: spacing.md,
  },
  reminderPickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: palette.accent,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  reminderPickerText: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: '#92400e',
  },
  reminderOptionsGrid: {
    backgroundColor: '#f8fafc',
    borderRadius: radius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: palette.border,
  },
  reminderOption: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    marginVertical: 2,
  },
  reminderOptionSelected: {
    backgroundColor: palette.accent,
  },
  reminderOptionText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: palette.text,
  },
  reminderOptionTextSelected: {
    fontFamily: fonts.bodyBold,
    color: '#1f2937',
  },
});

