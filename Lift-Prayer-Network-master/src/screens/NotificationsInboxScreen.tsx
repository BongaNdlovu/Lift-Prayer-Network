import React, { useEffect, useState, useCallback } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  RefreshControl,
  Image,
  Platform,
  Alert,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Swipeable } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  updateDoc,
  doc,
  deleteDoc,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { db, firebaseEnabled } from '../services/firebase';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../contexts/ThemeContext';
import { fonts, radius, spacing } from '../theme/colors';
import { LiftScreen, LiftHeader, LiftIconButton } from '../components/LiftLayout';
import { SkeletonNotifications } from '../components/SkeletonCard';
import { RootStackParamList } from '../navigation/types';
import { NOTIFICATIONS_LIMIT } from '../config/queryLimits';
import { logFirestoreRead } from '../utils/readBudget';
import {
  DEFAULT_NOTIFICATION_TYPE,
  NOTIFICATION_TYPES,
  type NotificationType,
} from '../types/notifications';

type Notification = {
  id: string;
  type: NotificationType;
  actorDisplayName: string;
  actorPhotoURL?: string;
  targetRequestId?: string;
  targetTestimonyId?: string;
  targetSummary?: string;
  groupName?: string;
  reactionType?: string;
  createdAt: Timestamp;
  read: boolean;
};

const NOTIFICATION_ITEM_HEIGHT = 96;

const getNotificationIcon = (type: NotificationType): { name: keyof typeof Ionicons.glyphMap; color: string } => {
  switch (type) {
    case NOTIFICATION_TYPES.PRAYER:
      return { name: 'hand-left', color: '#385C3B' };
    case NOTIFICATION_TYPES.AMEN:
      return { name: 'sparkles', color: '#10b981' };
    case NOTIFICATION_TYPES.COMMENT:
      return { name: 'chatbubble', color: '#3b82f6' };
    case NOTIFICATION_TYPES.GROUP_INVITE:
      return { name: 'people', color: '#8b5cf6' };
    case NOTIFICATION_TYPES.GROUP_JOIN:
      return { name: 'people', color: '#8b5cf6' };
    case NOTIFICATION_TYPES.FOLLOW:
      return { name: 'person-add', color: '#8b5cf6' };
    case NOTIFICATION_TYPES.ANNOUNCEMENT:
      return { name: 'megaphone', color: '#3b82f6' };
    case NOTIFICATION_TYPES.ADMIN:
      return { name: 'shield-checkmark', color: '#dc2626' };
    default:
      return { name: 'notifications', color: '#6b7280' };
  }
};

const getNotificationMessage = (notification: Notification): string => {
  switch (notification.type) {
    case NOTIFICATION_TYPES.PRAYER:
      return `prayed for your request`;
    case NOTIFICATION_TYPES.AMEN:
      return `said Amen to your testimony`;
    case NOTIFICATION_TYPES.COMMENT:
      return `commented on your ${notification.targetSummary ? 'request' : 'post'}`;
    case NOTIFICATION_TYPES.GROUP_INVITE:
      return `posted a prayer in ${notification.groupName || 'your group'}`;
    case NOTIFICATION_TYPES.GROUP_JOIN:
      return `approved your request to join ${notification.groupName || 'the group'}`;
    case NOTIFICATION_TYPES.FOLLOW:
      return `started following you`;
    case NOTIFICATION_TYPES.ANNOUNCEMENT:
      return `shared an announcement`;
    case NOTIFICATION_TYPES.ADMIN:
      return `sent you an update`;
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
  const { colors } = useTheme();
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
        limit(NOTIFICATIONS_LIMIT)
      );

      const snapshot = await getDocs(q);
      logFirestoreRead('notifications_inbox', snapshot.size);
      const items: Notification[] = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        items.push({
          id: docSnap.id,
          type: data.type || DEFAULT_NOTIFICATION_TYPE,
          actorDisplayName: data.actorDisplayName || 'Someone',
          actorPhotoURL: data.actorPhotoURL,
          targetRequestId: data.targetRequestId,
          targetTestimonyId: data.targetTestimonyId,
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
    if (notification.type === NOTIFICATION_TYPES.AMEN && notification.targetTestimonyId) {
      navigation.navigate('RequestDetail', {
        id: notification.targetTestimonyId,
        type: 'TESTIMONY',
      });
    } else if (notification.targetRequestId) {
      navigation.navigate('RequestDetail', {
        id: notification.targetRequestId,
        type: 'REQUEST',
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

  // Delete a single notification
  const handleDeleteNotification = async (notificationId: string) => {
    if (!db) return;

    try {
      await deleteDoc(doc(db, 'notifications', notificationId));
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch (err) {
      console.error('Error deleting notification:', err);
      Alert.alert('Error', 'Could not delete notification');
    }
  };

  // Delete all notifications
  const handleDeleteAll = () => {
    if (notifications.length === 0) return;

    Alert.alert(
      'Delete All Notifications',
      'Are you sure you want to delete all notifications? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            if (!db) return;
            
            try {
              const batch = writeBatch(db);
              notifications.forEach((n) => {
                batch.delete(doc(db!, 'notifications', n.id));
              });
              await batch.commit();
              setNotifications([]);
              
              if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
            } catch (err) {
              console.error('Error deleting all notifications:', err);
              Alert.alert('Error', 'Could not delete notifications');
            }
          },
        },
      ]
    );
  };

  // Render swipe action (delete button)
  const renderRightActions = (
    _progress: Animated.AnimatedInterpolation<number>,
    _dragX: Animated.AnimatedInterpolation<number>,
    notificationId: string
  ) => {
    return (
      <TouchableOpacity
        style={styles.deleteAction}
        onPress={() => handleDeleteNotification(notificationId)}
      >
        <Ionicons name="trash-outline" size={24} color="#fff" />
        <Text style={styles.deleteActionText}>Delete</Text>
      </TouchableOpacity>
    );
  };

  const renderNotification = ({ item }: { item: Notification }) => {
    const icon = getNotificationIcon(item.type);
    const message = getNotificationMessage(item);

    return (
      <Swipeable
        renderRightActions={(progress, dragX) => renderRightActions(progress, dragX, item.id)}
        overshootRight={false}
        friction={2}
      >
        <TouchableOpacity
          style={[
            styles.notificationCard, 
            { backgroundColor: colors.surface, borderBottomColor: colors.border },
            !item.read && { backgroundColor: colors.accentLight }
          ]}
          onPress={() => handleNotificationPress(item)}
          activeOpacity={0.7}
        >
          <View style={styles.notificationLeft}>
            {item.actorPhotoURL ? (
              <Image
                source={{ uri: item.actorPhotoURL }}
                style={styles.avatar}
              />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: icon.color + '20' }]}>
                <Text style={[styles.avatarText, { color: icon.color }]}>
                  {getInitials(item.actorDisplayName)}
                </Text>
              </View>
            )}
            <View style={[styles.iconBadge, { backgroundColor: icon.color }]}>
              <Ionicons name={icon.name} size={10} color="#fff" />
            </View>
          </View>

          <View style={styles.notificationContent}>
            <Text style={[styles.notificationText, { color: colors.textSecondary }]}>
              <Text style={[styles.actorName, { color: colors.text }]}>{item.actorDisplayName}</Text>
              {' '}{message}
            </Text>
            {item.targetSummary && (
              <Text style={[styles.targetSummary, { color: colors.muted }]} numberOfLines={1}>
                &quot;{item.targetSummary}&quot;
              </Text>
            )}
            <Text style={[styles.timeAgo, { color: colors.muted }]}>{formatTimeAgo(item.createdAt)}</Text>
          </View>

          {!item.read && <View style={styles.unreadDot} />}
        </TouchableOpacity>
      </Swipeable>
    );
  };

  return (
    <LiftScreen>
      <LiftHeader
        title="Inbox"
        subtitle="Your notifications"
        onBack={() => navigation.goBack()}
        right={
          <View style={styles.headerActions}>
            {unreadCount > 0 ? (
              <LiftIconButton icon="checkmark-done" onPress={markAllAsRead} />
            ) : null}
            {notifications.length > 0 ? (
              <LiftIconButton icon="trash-outline" onPress={handleDeleteAll} />
            ) : null}
          </View>
        }
      />
      <View style={styles.content}>

      {loading ? (
        <View style={styles.list}>
          <SkeletonNotifications count={6} />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceSecondary }]}>
            <Ionicons name="notifications-outline" size={48} color={colors.muted} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No notifications yet</Text>
          <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
            When someone prays for you or interacts with your posts, you&apos;ll see it here
          </Text>
        </View>
      ) : (
        <FlatList
          style={styles.list}
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderNotification}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                // Haptic feedback on pull-to-refresh
                if (Platform.OS !== 'web') {
                  try {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  } catch {
                    // Haptics not available
                  }
                }
                setRefreshing(true);
                loadNotifications();
              }}
            />
          }
          ListHeaderComponent={
            <View style={styles.listHeader}>
              {unreadCount > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>{unreadCount} new</Text>
                </View>
              )}
              <Text style={[styles.swipeHint, { color: colors.muted }]}>Swipe left to delete</Text>
            </View>
          }
          initialNumToRender={10}
          windowSize={5}
          maxToRenderPerBatch={10}
          updateCellsBatchingPeriod={50}
          removeClippedSubviews={Platform.OS !== 'web'}
          getItemLayout={(_, index) => ({
            length: NOTIFICATION_ITEM_HEIGHT,
            offset: NOTIFICATION_ITEM_HEIGHT * index,
            index,
          })}
          ListFooterComponent={<View style={{ height: 40 }} />}
        />
      )}
      </View>
    </LiftScreen>
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
    alignItems: 'center',
    flex: 1,
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
  
  // Content styles
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
  markAllButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  markAllText: {
    fontSize: 13,
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  headerActionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteAction: {
    backgroundColor: '#dc2626',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '100%',
  },
  deleteActionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
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
    paddingHorizontal: spacing.lg,
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
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  list: {
    flex: 1,
  },
  listHeader: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  swipeHint: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  unreadBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
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
    lineHeight: 20,
  },
  actorName: {
    fontWeight: '700',
  },
  targetSummary: {
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 2,
  },
  timeAgo: {
    fontSize: 12,
    marginTop: 4,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#385C3B',
    marginLeft: spacing.sm,
  },
});

export default NotificationsInboxScreen;

