import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { collection, doc, getDocs, orderBy, query, updateDoc, where } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../services/firebase';
import { hasAdminPermission } from '../../config/admins';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../contexts/ThemeContext';
import { pinRequest, unpinRequest } from '../../services/prayers';
import { fonts, palette, radius, spacing } from '../../theme/colors';
import { LiftScreen, LiftHeader } from '../../components/LiftLayout';

type RequestItem = {
  id: string;
  content: string;
  userDisplayName?: string;
  isPinned?: boolean;
  pinnedAt?: any;
};

export const PinnedRequestsScreen: React.FC = () => {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [items, setItems] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = hasAdminPermission(user?.email);

  useEffect(() => {
    const loadPinned = async () => {
      if (!db || !isAdmin) {
        setLoading(false);
        return;
      }
      try {
        const q = query(
          collection(db, 'requests'),
          where('isPinned', '==', true),
          orderBy('pinnedAt', 'desc')
        );
        const snapshot = await getDocs(q);
        const next: RequestItem[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }));
        setItems(next);
      } catch (err) {
        console.warn('[PinnedRequests] Failed to load pinned requests', err);
        Alert.alert('Error', 'Could not load pinned requests.');
      } finally {
        setLoading(false);
      }
    };

    loadPinned();
  }, [isAdmin]);

  const handleTogglePin = async (item: RequestItem) => {
    if (!db || !user || !isAdmin) return;

    try {
      if (item.isPinned) {
        const result = await unpinRequest(item.id, user.uid, user.email);
        if (!result.success) {
          throw new Error(result.error || 'Failed to unpin request');
        }
        await updateDoc(doc(db, 'requests', item.id), {
          isPinned: false,
          pinnedAt: null,
          pinnedBy: null,
        });
      } else {
        const result = await pinRequest(item.id, user.uid, user.email);
        if (!result.success) {
          throw new Error(result.error || 'Failed to pin request');
        }
      }

      setItems((prev) =>
        prev.map((r) =>
          r.id === item.id
            ? { ...r, isPinned: !item.isPinned }
            : r
        )
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not update pin state');
    }
  };

  if (!isAdmin) {
    return (
      <LiftScreen>
        <View style={styles.center}>
          <Ionicons name="shield" size={32} color={colors.muted} />
          <Text style={[styles.denied, { color: colors.text }]}>Admin access required</Text>
        </View>
      </LiftScreen>
    );
  }

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
      <LiftHeader title="Pinned" subtitle="Featured requests" />
      <View style={styles.content}>
          <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      contentContainerStyle={[styles.listContent, { backgroundColor: colors.background }]}
      ListEmptyComponent={
        <View style={[styles.center, { backgroundColor: colors.background }]}>
          <Ionicons name="star-outline" size={32} color={colors.muted} />
          <Text style={[styles.emptyText, { color: colors.muted }]}>No pinned requests</Text>
        </View>
      }
      renderItem={({ item }) => (
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
              {item.content}
            </Text>
            {item.userDisplayName ? (
              <Text style={[styles.subtitle, { color: colors.muted }]}>By {item.userDisplayName}</Text>
            ) : null}
          </View>
          <TouchableOpacity
            style={[styles.pinButton, { backgroundColor: colors.surface }]}
            onPress={() => handleTogglePin(item)}
          >
            <Ionicons
              name={item.isPinned ? 'star' : 'star-outline'}
              size={20}
              color={item.isPinned ? colors.accent : colors.muted}
            />
            <Text style={[styles.pinText, { color: colors.muted }]}>{item.isPinned ? 'Unpin' : 'Pin'}</Text>
          </TouchableOpacity>
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
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    gap: spacing.md,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 12,
  },
  pinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: palette.border,
  },
  pinText: {
    fontSize: 13,
    fontWeight: '600',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    marginTop: spacing.sm,
    fontWeight: '600',
  },
  denied: {
    marginTop: spacing.sm,
  },
});

