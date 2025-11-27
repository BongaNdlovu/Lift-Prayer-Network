import React, { useMemo, useState } from 'react';
import { Alert, FlatList, RefreshControl, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useNetInfo } from '@react-native-community/netinfo';
import { useFeed, submitFeedItem } from '../../hooks/useFeed';
import { logPrayer } from '../../services/prayers';
import { useAuth } from '../../hooks/useAuth';
import { FeedCard } from '../../components/FeedCard';
import { SkeletonCard } from '../../components/SkeletonCard';
import { palette, radius, spacing } from '../../theme/colors';
import type { FeedItem } from '../../types';
import type { RootStackParamList } from '../../navigation/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

export const FeedScreen: React.FC = () => {
  const [mode, setMode] = useState<'REQUEST' | 'TESTIMONY'>('REQUEST');
  const { items, loading } = useFeed(mode);
  const { user } = useAuth();
  const [input, setInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const netInfo = useNetInfo();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const headerCounts = useMemo(() => {
    const totalPrayers = items.reduce((sum, item) => sum + (item.type === 'REQUEST' ? item.prayers ?? 0 : 0), 0);
    return {
      items: items.length,
      totalPrayers,
    };
  }, [items]);

  const offline = netInfo.isConnected === false;

  const onSubmit = async () => {
    if (!input.trim()) return;
    if (offline) {
      Alert.alert('Offline', 'Reconnect to send transmissions.');
      return;
    }
    if (!user) {
      Alert.alert('Sign in required', 'Create an account or continue as guest to post.');
      return;
    }
    setSubmitting(true);
    try {
      await submitFeedItem(mode, input.trim(), user.uid, user.displayName || 'You');
      setInput('');
    } catch (err: any) {
      Alert.alert('Could not post', err.message ?? 'Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePray = async (id: string) => {
    if (!user) {
      Alert.alert('Sign in required', 'Create an account or continue as guest to log prayers.');
      return;
    }
    if (offline) {
      Alert.alert('Offline', 'Reconnect to log prayers.');
      return;
    }
    const target = items.find((i) => i.id === id) as FeedItem | undefined;
    if (!target) return;
    setBusyIds((prev) => new Set(prev).add(id));
    try {
      await logPrayer(user.uid, id, target.ownerUid, target.content.slice(0, 120));
    } catch (err: any) {
      Alert.alert('Unable to pray', err.message ?? 'Try again.');
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleOpen = (feedItem: FeedItem) => {
    navigation.navigate('RequestDetail', { id: feedItem.id, type: feedItem.type, item: feedItem });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    // Basic refetch by toggling mode temporarily
    setTimeout(() => setRefreshing(false), 600);
  };

  return (
    <LinearGradient colors={['#fefce8', '#f4f4f5']} style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
        {offline && (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineText}>Offline — viewing cached data</Text>
          </View>
        )}
        <View style={styles.topRow}>
          <View>
            <Text style={styles.kicker}>Live Network</Text>
            <Text style={styles.heading}>Lift</Text>
          </View>
          <View style={styles.statPill}>
            <Text style={styles.statNumber}>{headerCounts.items}</Text>
            <Text style={styles.statLabel}>{mode === 'REQUEST' ? 'Requests' : 'Testimonies'}</Text>
          </View>
          <View style={styles.statPill}>
            <Text style={styles.statNumber}>{headerCounts.totalPrayers}</Text>
            <Text style={styles.statLabel}>Prayers</Text>
          </View>
        </View>

        <View style={styles.modeSwitch}>
          {(['REQUEST', 'TESTIMONY'] as const).map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.modeButton, mode === m && styles.modeButtonActive]}
              onPress={() => setMode(m)}
            >
              <Text style={[styles.modeText, mode === m && styles.modeTextActive]}>
                {m === 'REQUEST' ? 'Transmission' : 'Verification'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.composer}>
          <TextInput
            placeholder={
              mode === 'REQUEST'
                ? 'Share a need to rally prayer...'
                : 'Share how the story resolved...'
            }
            placeholderTextColor={palette.muted}
            multiline
            style={styles.input}
            value={input}
            onChangeText={setInput}
          />
          <TouchableOpacity
            style={[styles.submitButton, !input.trim() && styles.submitDisabled]}
            onPress={onSubmit}
            disabled={!input.trim() || submitting}
          >
            <Text style={styles.submitText}>{submitting ? 'Sending...' : 'Send'}</Text>
          </TouchableOpacity>
        </View>

          {loading ? (
            <View style={styles.loading}>
              {[...Array(4)].map((_, idx) => (
                <SkeletonCard key={idx} />
              ))}
            </View>
          ) : (
            <FlatList
              data={items}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <FeedCard
                  item={item}
                  onPray={handlePray}
                  disabled={busyIds.has(item.id)}
                  onPress={handleOpen}
                />
              )}
              contentContainerStyle={{ paddingBottom: 120 }}
              showsVerticalScrollIndicator={false}
              initialNumToRender={8}
              windowSize={8}
              maxToRenderPerBatch={8}
              updateCellsBatchingPeriod={50}
              removeClippedSubviews
              getItemLayout={(_, index) => ({
                length: 180,
                offset: 180 * index,
                index,
              })}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            />
          )}
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  kicker: {
    color: palette.muted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontSize: 12,
  },
  heading: {
    fontSize: 30,
    fontWeight: '900',
    color: palette.text,
  },
  statPill: {
    backgroundColor: '#fff7d6',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#fef08a',
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: '#92400e',
  },
  statLabel: {
    fontSize: 11,
    color: '#92400e',
  },
  modeSwitch: {
    flexDirection: 'row',
    borderRadius: radius.md,
    backgroundColor: '#f1f5f9',
    padding: 4,
    marginBottom: spacing.md,
  },
  modeButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radius.md,
  },
  modeButtonActive: {
    backgroundColor: '#fff',
    shadowColor: palette.shadow,
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    elevation: 2,
  },
  modeText: {
    fontWeight: '700',
    color: palette.muted,
  },
  modeTextActive: {
    color: palette.text,
  },
  composer: {
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: palette.border,
    marginBottom: spacing.md,
  },
  input: {
    minHeight: 60,
    color: palette.text,
    fontSize: 15,
  },
  submitButton: {
    alignSelf: 'flex-start',
    backgroundColor: palette.accent,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  submitText: {
    fontWeight: '800',
    color: '#1f2937',
  },
  submitDisabled: {
    opacity: 0.5,
  },
  loading: {
    marginTop: spacing.sm,
  },
  offlineBanner: {
    backgroundColor: '#fee2e2',
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: '#fecdd3',
  },
  offlineText: {
    color: '#b91c1c',
    fontWeight: '700',
    textAlign: 'center',
  },
});
