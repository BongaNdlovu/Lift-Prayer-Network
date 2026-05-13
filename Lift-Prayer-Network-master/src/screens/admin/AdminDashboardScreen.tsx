import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { hasAdminPermission, hasModeratorPermission } from '../../config/admins';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../contexts/ThemeContext';
import { spacing } from '../../theme/colors';
import {
  LiftEmptyState,
  LiftFlatCard,
  LiftHeader,
  LiftListGroup,
  LiftListItem,
  LiftScreen,
} from '../../components/LiftLayout';

type Props = NativeStackScreenProps<RootStackParamList, 'AdminDashboard'>;

export const AdminDashboardScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuth();
  const { colors } = useTheme();

  const isAdmin = hasAdminPermission(user?.email);
  const isModerator = hasModeratorPermission(user?.email);

  if (!isModerator) {
    return (
      <LiftScreen>
        <LiftHeader title="Admin" subtitle="Management dashboard" onBack={() => navigation.goBack()} />
        <LiftEmptyState
          icon="shield-outline"
          title="Moderator access required"
          message="This area is reserved for trusted moderation and admin accounts."
        />
      </LiftScreen>
    );
  }

  return (
    <LiftScreen scroll>
      <LiftHeader title="Admin" subtitle={isAdmin ? 'Full management dashboard' : 'Moderation dashboard'} onBack={() => navigation.goBack()} />

      <View style={styles.content}>
        <LiftFlatCard style={styles.roleCard}>
          <View style={[styles.roleIcon, { backgroundColor: colors.surfaceSecondary }]}>
            <Ionicons name={isAdmin ? 'shield-checkmark' : 'shield'} size={22} color={colors.accent} />
          </View>
          <View style={styles.roleText}>
            <Text style={[styles.roleTitle, { color: colors.text }]}>{isAdmin ? 'Administrator' : 'Moderator'}</Text>
            <Text style={[styles.roleSubtitle, { color: colors.textSecondary }]}>
              {isAdmin
                ? 'Manage reports, pinned requests, global stats, and restricted users.'
                : 'Review reports, remove harmful content, and block posting when needed.'}
            </Text>
          </View>
        </LiftFlatCard>

        <LiftListGroup>
          <LiftListItem
            icon={<Ionicons name="flag-outline" size={20} color={colors.accent} />}
            title="Reports"
            subtitle="Review and moderate reported content"
            onPress={() => navigation.navigate('AdminReports')}
          />
          {isAdmin ? (
            <>
              <LiftListItem
                icon={<Ionicons name="star-outline" size={20} color={colors.accent} />}
                title="Pinned Requests"
                subtitle="Manage highlighted requests in the feed"
                onPress={() => navigation.navigate('AdminPinnedRequests')}
              />
              <LiftListItem
                icon={<Ionicons name="stats-chart-outline" size={20} color={colors.accent} />}
                title="Global Stats"
                subtitle="View overall prayer activity"
                onPress={() => navigation.navigate('AdminGlobalStats')}
              />
              <LiftListItem
                icon={<Ionicons name="ban-outline" size={20} color={colors.danger} />}
                title="Banned Users"
                subtitle="View and unban restricted users"
                onPress={() => navigation.navigate('AdminBannedUsers')}
              />
            </>
          ) : null}
        </LiftListGroup>
      </View>
    </LiftScreen>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  roleIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleText: {
    flex: 1,
  },
  roleTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  roleSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 3,
  },
});
