import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { hasAdminPermission, hasModeratorPermission } from '../../config/admins';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../contexts/ThemeContext';
import { fonts, palette, radius, spacing } from '../../theme/colors';
import { LiftScreen, LiftHeader } from '../../components/LiftLayout';

type Props = NativeStackScreenProps<RootStackParamList, 'AdminDashboard'>;

export const AdminDashboardScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuth();
  const { colors } = useTheme();

  const isAdmin = hasAdminPermission(user?.email);
  const isModerator = hasModeratorPermission(user?.email);

  // Must be at least a moderator to access
  if (!isModerator) {
    return (
      <LiftScreen>
        <View style={styles.center}>
          <Ionicons name="shield" size={40} color={colors.muted} />
          <Text style={[styles.denied, { color: colors.text }]}>Moderator access required</Text>
        </View>
      </LiftScreen>
    );
  }

  return (
    <LiftScreen>
      <LiftHeader title="Admin" subtitle="Management dashboard" onBack={() => navigation.goBack()} />
      <View style={styles.content}>
        {/* Reports - Available to Moderators and Admins */}
        <TouchableOpacity
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => navigation.navigate('AdminReports')}
        >
          <View style={[styles.iconCircle, { backgroundColor: colors.accentLight }]}>
            <Ionicons name="flag-outline" size={22} color={colors.accent} />
          </View>
          <View style={styles.cardText}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Reports</Text>
            <Text style={[styles.cardSubtitle, { color: colors.muted }]}>Review and moderate reported content</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.muted} />
        </TouchableOpacity>

        {/* Admin-only sections below */}
        {isAdmin && (
          <>
            <TouchableOpacity
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => navigation.navigate('AdminPinnedRequests')}
            >
              <View style={[styles.iconCircle, { backgroundColor: colors.accentLight }]}>
                <Ionicons name="star-outline" size={22} color={colors.accent} />
              </View>
              <View style={styles.cardText}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>Pinned Requests</Text>
                <Text style={[styles.cardSubtitle, { color: colors.muted }]}>Manage highlighted requests in the feed</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.muted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => navigation.navigate('AdminGlobalStats')}
            >
              <View style={[styles.iconCircle, { backgroundColor: colors.accentLight }]}>
                <Ionicons name="stats-chart-outline" size={22} color={colors.accent} />
              </View>
              <View style={styles.cardText}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>Global Stats</Text>
                <Text style={[styles.cardSubtitle, { color: colors.muted }]}>View overall prayer activity</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.muted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => navigation.navigate('AdminBannedUsers')}
            >
              <View style={[styles.iconCircle, { backgroundColor: colors.dangerLight }]}>
                <Ionicons name="ban-outline" size={22} color={colors.danger} />
              </View>
              <View style={styles.cardText}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>Banned Users</Text>
                <Text style={[styles.cardSubtitle, { color: colors.muted }]}>View and unban restricted users</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.muted} />
            </TouchableOpacity>
          </>
        )}

        {/* Show info for moderators about their access */}
        {!isAdmin && (
          <View style={[styles.infoCard, { backgroundColor: colors.surfaceSecondary }]}>
            <Ionicons name="information-circle-outline" size={20} color={colors.muted} />
            <Text style={[styles.infoText, { color: colors.muted }]}>
              As a moderator, you can review reports, delete content, and block users from posting. Banning users from the app and pinning requests are admin-only.
            </Text>
          </View>
        )}
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
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.text,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  cardText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.text,
  },
  cardSubtitle: {
    fontSize: 12,
    color: palette.muted,
    marginTop: 2,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.background,
  },
  denied: {
    marginTop: spacing.sm,
    color: palette.muted,
    fontWeight: '600',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    borderRadius: radius.md,
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
});
