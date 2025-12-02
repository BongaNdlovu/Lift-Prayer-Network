import React, { useEffect, useState, useCallback } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  updateDoc,
  doc,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { db, firebaseEnabled } from '../services/firebase';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../contexts/ThemeContext';
import { palette, radius, spacing } from '../theme/colors';
import { SkeletonNotifications } from '../components/SkeletonCard';
import { RootStackParamList } from '../navigation/types';

type NotificationType = 'prayer_received' | 'comment' | 'reaction' | 'testimony' | 'group_request';

type Notification = {
  id: string;
  type: NotificationType;
  actorDisplayName: string;
  actorPhotoURL?: string;
  targetRequestId?: string;
  targetSummary?: string;
  groupName?: string;
  reactionType?: string;
  createdAt: Timestamp;
  read: boolean;
};

const getNotificationIcon = (type: NotificationType): { name: keyof typeof Ionicons.glyphMap; color: string } => {
  switch (type) {
    case 'prayer_received':
      return { name: 'hand-left', color: '#f59e0b' };
    case 'comment':
      return { name: 'chatbubble', color: '#3b82f6' };
    case 'reaction':
      return { name: 'heart', color: '#ec4899' };
    case 'testimony':
      return { name: 'sparkles', color: '#10b981' };
    case 'group_request':
      return { name: 'people', color: '#8b5cf6' };
    default:
      return { name: 'notifications', color: palette.muted };
  }
};

const getNotificationMessage = (notification: Notification): string => {
  switch (notification.type) {
    case 'prayer_received':
      return `prayed for your request`;
    case 'comment':
      return `commented on your ${notification.targetSummary ? 'request' : 'post'}`;
    case 'reaction':
      return `reacted ${notification.reactionType === 'heart' ? '❤️' : notification.reactionType === 'fire' ? '🔥' : '💪'} to your post`;
    case 'testimony':
      return `shared a testimony you prayed for`;
    case 'group_request':
      return `posted a prayer in ${notification.groupName || 'your group'}`;
    default:
      return 'sent you a notification';
  }
};

const formatTimeAgo = (timestamp: Timestamp): string => {
  if (!timestamp) return '';
  const now = Date.now();
  const time = timestamp.toDate().getTime();
  const diff = now - time;
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return timestamp.toDate().toLocaleDateString();
};

export const NotificationsInboxScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadNotifications = useCallback(async () => {
    if (!user || !firebaseEnabled || !db) {
      setLoading(false);
      return;
    }

    try {
      const notificationsRef = collection(db, 'notifications');
      const q = query(
        notificationsRef,
        where('recipientUid', '==', user.uid),
        orderBy('createdAt', 'desc'),
        limit(50)
      );

      const snapshot = await getDocs(q);
      const items: Notification[] = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        items.push({
          id: docSnap.id,
          type: data.type || 'prayer_received',
          actorDisplayName: data.actorDisplayName || 'Someone',
          actorPhotoURL: data.actorPhotoURL,
          targetRequestId: data.targetRequestId,
          targetSummary: data.targetSummary,
          groupName: data.groupName,
          reactionType: data.reactionType,
          createdAt: data.createdAt,
          read: data.read || false,
        });
      });

      setNotifications(items);
    } catch (err) {
      console.error('Error loading notifications:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleNotificationPress = async (notification: Notification) => {
    // Mark as read
    if (!notification.read && db) {
      try {
        await updateDoc(doc(db!, 'notifications', notification.id), { read: true });
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
        );
      } catch (err) {
        console.warn('Error marking notification as read:', err);
      }
    }

    // Navigate to the relevant screen
    if (notification.targetRequestId) {
      navigation.navigate('RequestDetail', {
        id: notification.targetRequestId,
        type: notification.type === 'testimony' ? 'TESTIMONY' : 'REQUEST',
      });
    }
  };

  const markAllAsRead = async () => {
    if (!db || notifications.length === 0) return;

    const unread = notifications.filter((n) => !n.read);
    if (unread.length === 0) return;

    try {
      const batch = writeBatch(db!);
      unread.forEach((n) => {
        batch.update(doc(db!, 'notifications', n.id), { read: true });
      });
      await batch.commit();

      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={palette.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={markAllAsRead} style={styles.markAllButton}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 80 }} />
        )}
      </View>

      {loading ? (
        <View style={styles.list}>
          <SkeletonNotifications count={6} />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Ionicons name="notifications-outline" size={48} color={palette.muted} />
          </View>
          <Text style={styles.emptyTitle}>No notifications yet</Text>
          <Text style={styles.emptySubtitle}>
            When someone prays for you or interacts with your posts, you&apos;ll see it here
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadNotifications();
              }}
            />
          }
        >
          {unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{unreadCount} new</Text>
            </View>
          )}

          {notifications.map((notification) => {
            const icon = getNotificationIcon(notification.type);
            const message = getNotificationMessage(notification);

            return (
              <TouchableOpacity
                key={notification.id}
                style={[styles.notificationCard, !notification.read && styles.notificationUnread]}
                onPress={() => handleNotificationPress(notification)}
                activeOpacity={0.7}
              >
                <View style={styles.notificationLeft}>
                  {notification.actorPhotoURL ? (
                    <Image
                      source={{ uri: notification.actorPhotoURL }}
                      style={styles.avatar}
                    />
                  ) : (
                    <View style={[styles.avatarPlaceholder, { backgroundColor: icon.color + '20' }]}>
                      <Text style={[styles.avatarText, { color: icon.color }]}>
                        {getInitials(notification.actorDisplayName)}
                      </Text>
                    </View>
                  )}
                  <View style={[styles.iconBadge, { backgroundColor: icon.color }]}>
                    <Ionicons name={icon.name} size={10} color="#fff" />
                  </View>
                </View>

                <View style={styles.notificationContent}>
                  <Text style={styles.notificationText}>
                    <Text style={styles.actorName}>{notification.actorDisplayName}</Text>
                    {' '}{message}
                  </Text>
                  {notification.targetSummary && (
                    <Text style={styles.targetSummary} numberOfLines={1}>
                      &quot;{notification.targetSummary}&quot;
                    </Text>
                  )}
                  <Text style={styles.timeAgo}>{formatTimeAgo(notification.createdAt)}</Text>
                </View>

                {!notification.read && <View style={styles.unreadDot} />}
              </TouchableOpacity>
            );
          })}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
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
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.text,
  },
  markAllButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  markAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.accentDark,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: palette.text,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    fontSize: 14,
    color: palette.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
  list: {
    flex: 1,
  },
  unreadBadge: {
    alignSelf: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    marginVertical: spacing.sm,
  },
  unreadBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400e',
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  notificationUnread: {
    backgroundColor: '#fffbeb',
  },
  notificationLeft: {
    position: 'relative',
    marginRight: spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
  },
  iconBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  notificationContent: {
    flex: 1,
  },
  notificationText: {
    fontSize: 14,
    color: palette.text,
    lineHeight: 20,
  },
  actorName: {
    fontWeight: '700',
  },
  targetSummary: {
    fontSize: 13,
    color: palette.muted,
    fontStyle: 'italic',
    marginTop: 2,
  },
  timeAgo: {
    fontSize: 12,
    color: palette.muted,
    marginTop: 4,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#f59e0b',
    marginLeft: spacing.sm,
  },
});

export default NotificationsInboxScreen;
