import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { collection, doc, getDocs, orderBy, query, updateDoc, where } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../services/firebase';
import { hasAdminPermission } from '../../config/admins';
import { useAuth } from '../../hooks/useAuth';
import { pinRequest, unpinRequest } from '../../services/prayers';
import { palette, radius, spacing } from '../../theme/colors';

type RequestItem = {
  id: string;
  content: string;
  userDisplayName?: string;
  isPinned?: boolean;
  pinnedAt?: any;
};

export const PinnedRequestsScreen: React.FC = () => {
  const { user } = useAuth();
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
      <View style={styles.center}>
        <Ionicons name="shield" size={32} color={palette.muted} />
        <Text style={styles.denied}>Admin access required</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={palette.accent} />
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      ListEmptyComponent={
        <View style={styles.center}>
          <Ionicons name="star-outline" size={32} color={palette.muted} />
          <Text style={styles.emptyText}>No pinned requests</Text>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={2}>
              {item.content}
            </Text>
            {item.userDisplayName ? (
              <Text style={styles.subtitle}>By {item.userDisplayName}</Text>
            ) : null}
          </View>
          <TouchableOpacity
            style={styles.pinButton}
            onPress={() => handleTogglePin(item)}
          >
            <Ionicons
              name={item.isPinned ? 'star' : 'star-outline'}
              size={20}
              color={item.isPinned ? '#facc15' : palette.muted}
            />
            <Text style={styles.pinText}>{item.isPinned ? 'Unpin' : 'Pin'}</Text>
          </TouchableOpacity>
        </View>
      )}
    />
  );
};

const styles = StyleSheet.create({
  listContent: {
    padding: spacing.md,
    gap: spacing.md,
    backgroundColor: palette.background,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: '#ffffff',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    gap: spacing.md,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: palette.text,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 12,
    color: palette.muted,
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
    backgroundColor: '#f8fafc',
  },
  pinText: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.text,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.background,
  },
  emptyText: {
    marginTop: spacing.sm,
    color: palette.muted,
    fontWeight: '600',
  },
  denied: {
    marginTop: spacing.sm,
    color: palette.muted,
  },
});

