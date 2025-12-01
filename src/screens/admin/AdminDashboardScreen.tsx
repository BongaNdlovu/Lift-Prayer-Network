import React from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { hasAdminPermission } from '../../config/admins';
import { RootStackParamList } from '../../navigation/types';
import { palette, radius, spacing } from '../../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'AdminDashboard'>;

export const AdminDashboardScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuth();

  const isAdmin = hasAdminPermission(user?.email);

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.center}>
        <Ionicons name="shield" size={40} color={palette.muted} />
        <Text style={styles.denied}>Admin access required</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={palette.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Admin Tools</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <TouchableOpacity
          style={styles.card}
          onPress={() => navigation.navigate('AdminReports')}
        >
          <View style={styles.iconCircle}>
            <Ionicons name="flag-outline" size={22} color={palette.accentDark} />
          </View>
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>Reports</Text>
            <Text style={styles.cardSubtitle}>Review and moderate reported content</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={palette.muted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.card}
          onPress={() => navigation.navigate('AdminPinnedRequests')}
        >
          <View style={styles.iconCircle}>
            <Ionicons name="star-outline" size={22} color={palette.accentDark} />
          </View>
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>Pinned Requests</Text>
            <Text style={styles.cardSubtitle}>Manage highlighted requests in the feed</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={palette.muted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.card}
          onPress={() => navigation.navigate('AdminGlobalStats')}
        >
          <View style={styles.iconCircle}>
            <Ionicons name="stats-chart-outline" size={22} color={palette.accentDark} />
          </View>
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>Global Stats</Text>
            <Text style={styles.cardSubtitle}>View overall prayer activity</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={palette.muted} />
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
    backgroundColor: '#f1f5f9',
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
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: palette.border,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fefce8',
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

