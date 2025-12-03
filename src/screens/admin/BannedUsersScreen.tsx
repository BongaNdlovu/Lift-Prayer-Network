import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db, firebaseEnabled } from '../../services/firebase';
import { unbanUser } from '../../services/moderation';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../contexts/ThemeContext';
import { hasAdminPermission } from '../../config/admins';
import { palette, radius, spacing } from '../../theme/colors';

type BannedUser = {
  id: string;
  displayName?: string;
  email?: string;
  bannedAt?: Timestamp;
  banReason?: string;
};

export const BannedUsersScreen: React.FC = () => {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const { user } = useAuth();
  const [bannedUsers, setBannedUsers] = useState<BannedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isAdmin = hasAdminPermission(user?.email);

  const loadBannedUsers = async () => {
    if (!firebaseEnabled || !db || !isAdmin) {
      setLoading(false);
      return;
    }

    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('isBanned', '==', true));
      const snapshot = await getDocs(q);

      const users: BannedUser[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        users.push({
          id: doc.id,
          displayName: data.displayName || 'Unknown User',
          email: data.email,
          bannedAt: data.bannedAt,
          banReason: data.banReason,
        });
      });

      setBannedUsers(users);
    } catch (err) {
      console.error('Error loading banned users:', err);
      Alert.alert('Error', 'Could not load banned users');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadBannedUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUnban = async (userId: string, displayName: string) => {
    Alert.alert(
      'Unban User',
      `Are you sure you want to unban "${displayName}"? They will be able to use the app again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unban',
          onPress: async () => {
            const result = await unbanUser(userId);
            if (result.success) {
              setBannedUsers((prev) => prev.filter((u) => u.id !== userId));
              Alert.alert('Success', `${displayName} has been unbanned.`);
            } else {
              Alert.alert('Error', result.error || 'Could not unban user');
            }
          },
        },
      ]
    );
  };

  const formatDate = (timestamp?: Timestamp) => {
    if (!timestamp) return 'Unknown date';
    const date = timestamp.toDate();
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Bold diagonal gradient
  const gradientColors = [...colors.gradientBoldScreen] as [string, string, ...string[]];

  if (!isAdmin) {
    return (
      <LinearGradient colors={gradientColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }}>
      <SafeAreaView style={[styles.container, { backgroundColor: 'transparent' }]}>
        <View style={styles.center}>
          <Ionicons name="lock-closed" size={48} color={colors.muted} />
          <Text style={[styles.noAccessText, { color: colors.text }]}>Admin access required</Text>
        </View>
      </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={gradientColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }}>
    <SafeAreaView style={[styles.container, { backgroundColor: 'transparent' }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Banned Users</Text>
        <View style={styles.headerRight} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <ScrollView
          style={styles.content}
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
                loadBannedUsers();
              }}
            />
          }
        >
          {bannedUsers.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: colors.surface }]}>
              <Ionicons name="checkmark-circle" size={64} color={colors.success} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No Banned Users</Text>
              <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
                All users are in good standing
              </Text>
            </View>
          ) : (
            <>
              <Text style={[styles.countText, { color: colors.muted }]}>
                {bannedUsers.length} banned user{bannedUsers.length !== 1 ? 's' : ''}
              </Text>
              {bannedUsers.map((bannedUser) => (
                <View key={bannedUser.id} style={[styles.userCard, { backgroundColor: colors.surface }]}>
                  <View style={[styles.userAvatar, { backgroundColor: colors.muted }]}>
                    <Ionicons name="person" size={24} color={colors.text} />
                  </View>
                  <View style={styles.userInfo}>
                    <Text style={[styles.userName, { color: colors.text }]}>{bannedUser.displayName}</Text>
                    {bannedUser.email && (
                      <Text style={[styles.userEmail, { color: colors.muted }]}>{bannedUser.email}</Text>
                    )}
                    <Text style={[styles.banReason, { color: colors.muted }]}>
                      Reason: {bannedUser.banReason || 'No reason provided'}
                    </Text>
                    <Text style={[styles.banDate, { color: colors.muted }]}>
                      Banned: {formatDate(bannedUser.bannedAt)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.unbanButton, { backgroundColor: colors.success }]}
                    onPress={() => handleUnban(bannedUser.id, bannedUser.displayName || 'User')}
                  >
                    <Ionicons name="checkmark-circle" size={20} color={colors.text} />
                    <Text style={[styles.unbanText, { color: colors.text }]}>Unban</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  },
  headerRight: {
    width: 40,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noAccessText: {
    marginTop: spacing.md,
    fontSize: 16,
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  countText: {
    fontSize: 14,
    marginBottom: spacing.md,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: spacing.md,
  },
  emptySubtitle: {
    fontSize: 14,
    marginTop: spacing.xs,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: '#fecaca',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
  },
  userEmail: {
    fontSize: 13,
    marginTop: 2,
  },
  banReason: {
    fontSize: 12,
    marginTop: 4,
  },
  banDate: {
    fontSize: 11,
    marginTop: 2,
  },
  unbanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    gap: 4,
  },
  unbanText: {
    fontSize: 13,
    fontWeight: '600',
  },
});

export default BannedUsersScreen;
