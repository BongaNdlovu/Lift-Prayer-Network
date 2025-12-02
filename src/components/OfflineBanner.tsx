import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNetInfo } from '@react-native-community/netinfo';
import { useTheme } from '../contexts/ThemeContext';
import { getPendingActionCounts, type PendingActionCounts } from '../services/offlineCache';
import { spacing, radius } from '../theme/colors';

type Props = {
  onSyncPress?: () => void;
  showPendingCount?: boolean;
};

export const OfflineBanner: React.FC<Props> = ({ onSyncPress, showPendingCount = true }) => {
  const netInfo = useNetInfo();
  const { colors, isDark } = useTheme();
  const [pendingCounts, setPendingCounts] = useState<PendingActionCounts>({
    prayers: 0,
    requests: 0,
    comments: 0,
    reactions: 0,
    total: 0,
  });
  const [slideAnim] = useState(new Animated.Value(-100));
  
  const isOffline = netInfo.isConnected === false;

  // Load pending counts
  useEffect(() => {
    const loadCounts = async () => {
      const counts = await getPendingActionCounts();
      setPendingCounts(counts);
    };
    
    loadCounts();
    
    // Refresh counts periodically when offline
    if (isOffline) {
      const interval = setInterval(loadCounts, 5000);
      return () => clearInterval(interval);
    }
  }, [isOffline]);

  // Animate banner in/out
  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: isOffline ? 0 : -100,
      useNativeDriver: true,
      tension: 50,
      friction: 8,
    }).start();
  }, [isOffline, slideAnim]);

  if (!isOffline && pendingCounts.total === 0) {
    return null;
  }

  const bannerBg = isOffline 
    ? (isDark ? '#7f1d1d' : '#fef2f2')
    : (isDark ? '#1e3a5f' : '#eff6ff');
  
  const textColor = isOffline
    ? (isDark ? '#fecaca' : '#991b1b')
    : (isDark ? '#93c5fd' : '#1e40af');

  const iconColor = isOffline
    ? (isDark ? '#f87171' : '#dc2626')
    : (isDark ? '#60a5fa' : '#2563eb');

  return (
    <Animated.View
      style={[
        styles.container,
        { 
          backgroundColor: bannerBg,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={styles.content}>
        <Ionicons 
          name={isOffline ? 'cloud-offline-outline' : 'cloud-upload-outline'} 
          size={18} 
          color={iconColor} 
        />
        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: textColor }]}>
            {isOffline ? 'You\'re offline' : 'Syncing...'}
          </Text>
          {showPendingCount && pendingCounts.total > 0 && (
            <Text style={[styles.subtitle, { color: textColor, opacity: 0.8 }]}>
              {pendingCounts.total} action{pendingCounts.total !== 1 ? 's' : ''} queued
            </Text>
          )}
        </View>
        {!isOffline && onSyncPress && pendingCounts.total > 0 && (
          <TouchableOpacity 
            style={[styles.syncButton, { backgroundColor: iconColor }]}
            onPress={onSyncPress}
          >
            <Text style={styles.syncButtonText}>Sync Now</Text>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    paddingTop: 4,
    paddingBottom: 8,
    paddingHorizontal: spacing.md,
    borderBottomLeftRadius: radius.md,
    borderBottomRightRadius: radius.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  syncButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  syncButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default OfflineBanner;
