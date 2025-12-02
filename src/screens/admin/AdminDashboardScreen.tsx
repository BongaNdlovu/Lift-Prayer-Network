import React from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { hasAdminPermission } from '../../config/admins';
import { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../contexts/ThemeContext';
import { palette, radius, spacing } from '../../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'AdminDashboard'>;

export const AdminDashboardScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuth();
  const { colors } = useTheme();

  const isAdmin = hasAdminPermission(user?.email);

  if (!isAdmin) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: colors.background }]}>
        <Ionicons name="shield" size={40} color={colors.muted} />
        <Text style={[styles.denied, { color: colors.text }]}>Admin access required</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backButton, { backgroundColor: colors.surface }]}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Admin Tools</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
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
      </View>
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
});

