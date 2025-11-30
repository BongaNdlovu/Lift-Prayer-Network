import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const REMINDERS_KEY = '@lift_prayer_reminders';

export type PrayerReminder = {
  id: string;
  hour: number;
  minute: number;
  days: number[]; // 0-6 for Sunday-Saturday
  enabled: boolean;
  message: string;
};

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const requestNotificationPermissions = async (): Promise<boolean> => {
  if (Platform.OS === 'web') return false;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  return finalStatus === 'granted';
};

export const scheduleReminder = async (reminder: PrayerReminder): Promise<string[]> => {
  if (Platform.OS === 'web') return [];

  const notificationIds: string[] = [];

  // Cancel existing notifications for this reminder
  await cancelReminder(reminder.id);

  if (!reminder.enabled) return [];

  // Schedule for each selected day
  for (const day of reminder.days) {
    const trigger: Notifications.WeeklyTriggerInput = {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: day + 1, // Expo uses 1-7 (Sunday = 1)
      hour: reminder.hour,
      minute: reminder.minute,
    };

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: '🙏 Time to Pray',
        body: reminder.message || 'Take a moment to pray and lift others up.',
        sound: true,
        data: { type: 'prayer_reminder', reminderId: reminder.id },
      },
      trigger,
    });

    notificationIds.push(id);
  }

  return notificationIds;
};

export const cancelReminder = async (reminderId: string): Promise<void> => {
  if (Platform.OS === 'web') return;

  const allNotifications = await Notifications.getAllScheduledNotificationsAsync();
  
  for (const notification of allNotifications) {
    if (notification.content.data?.reminderId === reminderId) {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier);
    }
  }
};

export const cancelAllReminders = async (): Promise<void> => {
  if (Platform.OS === 'web') return;
  await Notifications.cancelAllScheduledNotificationsAsync();
};

export const saveReminders = async (reminders: PrayerReminder[]): Promise<void> => {
  await AsyncStorage.setItem(REMINDERS_KEY, JSON.stringify(reminders));
};

export const loadReminders = async (): Promise<PrayerReminder[]> => {
  const data = await AsyncStorage.getItem(REMINDERS_KEY);
  if (!data) return [];
  return JSON.parse(data);
};

export const addReminder = async (reminder: Omit<PrayerReminder, 'id'>): Promise<PrayerReminder> => {
  const reminders = await loadReminders();
  const newReminder: PrayerReminder = {
    ...reminder,
    id: Date.now().toString(),
  };
  
  reminders.push(newReminder);
  await saveReminders(reminders);
  
  if (newReminder.enabled) {
    await scheduleReminder(newReminder);
  }
  
  return newReminder;
};

export const updateReminder = async (reminder: PrayerReminder): Promise<void> => {
  const reminders = await loadReminders();
  const index = reminders.findIndex((r) => r.id === reminder.id);
  
  if (index !== -1) {
    reminders[index] = reminder;
    await saveReminders(reminders);
    await scheduleReminder(reminder);
  }
};

export const deleteReminder = async (reminderId: string): Promise<void> => {
  const reminders = await loadReminders();
  const filtered = reminders.filter((r) => r.id !== reminderId);
  await saveReminders(filtered);
  await cancelReminder(reminderId);
};

export const formatTime = (hour: number, minute: number): string => {
  const h = hour % 12 || 12;
  const m = minute.toString().padStart(2, '0');
  const period = hour < 12 ? 'AM' : 'PM';
  return `${h}:${m} ${period}`;
};

export const getDayNames = (days: number[]): string => {
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  if (days.length === 7) return 'Every day';
  if (days.length === 5 && !days.includes(0) && !days.includes(6)) return 'Weekdays';
  if (days.length === 2 && days.includes(0) && days.includes(6)) return 'Weekends';
  
  return days.map((d) => dayNames[d]).join(', ');
};

// Default reminder messages
export const REMINDER_MESSAGES = [
  'Take a moment to pray and lift others up.',
  'Start your day with prayer.',
  'Remember to pray for those in need.',
  'Pause and connect with God.',
  'Time to lift someone up in prayer.',
];

