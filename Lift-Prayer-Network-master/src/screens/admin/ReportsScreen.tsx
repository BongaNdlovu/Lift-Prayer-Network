import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { collection, deleteDoc, doc, getDocs, orderBy, query, updateDoc, where } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../services/firebase';
import { hasAdminPermission } from '../../config/admins';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../contexts/ThemeContext';
import { fonts, palette, radius, spacing } from '../../theme/colors';
import { LiftScreen, LiftHeader } from '../../components/LiftLayout';

type Report = {
  id: string;
  actorUid: string;
  targetId: string;
  targetType: 'REQUEST' | 'TESTIMONY' | 'COMMENT';
  reason: string;
  status: 'PENDING' | 'REVIEWED' | 'RESOLVED' | 'DISMISSED';
  createdAt: any;
};

export const ReportsScreen: React.FC = () => {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db) return;
    let mounted = true;

    const q = query(
      collection(db, 'reports'),
      where('status', '==', 'PENDING'),
      orderBy('createdAt', 'desc'),
    );

    getDocs(q)
      .then((snapshot) => {
        if (!mounted) return;
        const data = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Report[];
        setReports(data);
        setLoading(false);
      })
      .catch(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (!hasAdminPermission(user?.email)) {
    return (
      <LiftScreen>
        <View style={styles.center}>
          <Ionicons name="shield" size={32} color={colors.muted} />
          <Text style={[styles.denied, { color: colors.text }]}>Access Denied</Text>
        </View>
      </LiftScreen>
    );
  }

  const handleAction = async (reportId: string, action: 'dismiss' | 'hide' | 'delete') => {
    if (!db) return;
    const report = reports.find((r) => r.id === reportId);
    if (!report) return;

    try {
      if (action === 'dismiss') {
        await updateDoc(doc(db, 'reports', reportId), { status: 'DISMISSED' });
      } else {
        const collectionName =
          report.targetType === 'COMMENT'
            ? 'comments'
            : report.targetType === 'REQUEST'
              ? 'requests'
              : 'testimonies';

        if (action === 'hide') {
          await updateDoc(doc(db, collectionName, report.targetId), {
            hidden: true,
            hiddenAt: new Date(),
            hiddenReason: report.reason,
          });
          await updateDoc(doc(db, 'reports', reportId), { status: 'RESOLVED' });
        } else if (action === 'delete') {
          await deleteDoc(doc(db, collectionName, report.targetId));
          await updateDoc(doc(db, 'reports', reportId), { status: 'RESOLVED' });
        }
      }
      setReports((prev) => prev.filter((item) => item.id !== reportId));
      Alert.alert('Done', `Report ${action}ed successfully`);
    } catch {
      Alert.alert('Error', 'Could not process report');
    }
  };

  if (loading) {
    return (
      <LiftScreen>
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </LiftScreen>
    );
  }

  return (
    <LiftScreen>
      <LiftHeader title="Reports" subtitle="Moderation queue" />
      <View style={styles.content}>
          <FlatList
      data={reports}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      ListEmptyComponent={
        <View style={styles.center}>
          <Ionicons name="checkmark-circle" size={32} color={palette.accent} />
          <Text style={styles.emptyText}>No pending reports</Text>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.targetType}>{item.targetType}</Text>
            <Text style={styles.reason}>{item.reason}</Text>
          </View>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => handleAction(item.id, 'dismiss')}>
              <Ionicons name="close-circle" size={16} color={palette.muted} />
              <Text style={styles.actionText}>Dismiss</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => handleAction(item.id, 'hide')}>
              <Ionicons name="eye-off" size={16} color="#B8956B" />
              <Text style={[styles.actionText, { color: '#B8956B' }]}>Hide</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => handleAction(item.id, 'delete')}>
              <Ionicons name="trash" size={16} color="#dc2626" />
              <Text style={[styles.actionText, { color: '#dc2626' }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
          />
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
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    zIndex: 20,
  },
  headerCenter: {
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
    color: '#4A5D4E',
  },
  mainContent: {
    flex: 1,
    zIndex: 10,
  },
  
  listContent: {
    padding: spacing.md,
    gap: spacing.md,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  denied: {
    color: palette.muted,
    marginTop: spacing.sm,
  },
  emptyText: {
    color: palette.muted,
    marginTop: spacing.sm,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.border,
    gap: spacing.sm,
  },
  cardHeader: {
    gap: 4,
  },
  targetType: {
    fontWeight: '800',
    color: palette.text,
  },
  reason: {
    color: palette.muted,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#f8fafc',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: palette.border,
  },
  actionText: {
    fontWeight: '700',
    color: palette.text,
  },
});
