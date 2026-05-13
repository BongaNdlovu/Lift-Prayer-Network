/**
 * Toast Context
 * 
 * Provides a global toast notification system for user-facing feedback.
 * Supports different severity levels and optional actions.
 */

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ErrorSeverity, AppError } from '../types/errors';

type ToastType = ErrorSeverity | 'success';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
  action?: {
    label: string;
    onPress: () => void;
  };
}

interface ToastContextValue {
  showToast: (toast: Omit<Toast, 'id'>) => void;
  showError: (error: AppError, action?: Toast['action']) => void;
  showSuccess: (message: string) => void;
  hideToast: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_DURATION = 4000;

const TOAST_CONFIG: Record<ToastType, { 
  bg: string; 
  border: string; 
  text: string; 
  icon: keyof typeof Ionicons.glyphMap;
}> = {
  success: { bg: '#dcfce7', border: '#86efac', text: '#166534', icon: 'checkmark-circle' },
  info: { bg: '#dbeafe', border: '#93c5fd', text: '#1e40af', icon: 'information-circle' },
  warning: { bg: '#F7F1E8', border: '#fcd34d', text: '#92400e', icon: 'warning' },
  error: { bg: '#fee2e2', border: '#fca5a5', text: '#991b1b', icon: 'alert-circle' },
  critical: { bg: '#fecaca', border: '#f87171', text: '#7f1d1d', icon: 'close-circle' },
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentToast, setCurrentToast] = useState<Toast | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const insets = useSafeAreaInsets();

  const hideToast = useCallback(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setCurrentToast(null);
    });
  }, [fadeAnim, slideAnim]);

  const showToast = useCallback((toast: Omit<Toast, 'id'>) => {
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const id = `toast_${Date.now()}`;
    setCurrentToast({ ...toast, id });

    // Animate in
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 10,
      }),
    ]).start();

    // Auto-hide after duration
    const duration = toast.duration ?? TOAST_DURATION;
    if (duration > 0) {
      timeoutRef.current = setTimeout(hideToast, duration);
    }
  }, [fadeAnim, slideAnim, hideToast]);

  const showError = useCallback((error: AppError, action?: Toast['action']) => {
    showToast({
      type: error.severity,
      message: error.userMessage,
      action: action || (error.recoverable ? undefined : {
        label: 'Dismiss',
        onPress: hideToast,
      }),
    });
  }, [showToast, hideToast]);

  const showSuccess = useCallback((message: string) => {
    showToast({
      type: 'success',
      message,
      duration: 3000,
    });
  }, [showToast]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const config = currentToast ? TOAST_CONFIG[currentToast.type] : TOAST_CONFIG.info;

  return (
    <ToastContext.Provider value={{ showToast, showError, showSuccess, hideToast }}>
      {children}
      {currentToast && (
        <Animated.View
          style={[
            styles.container,
            {
              top: insets.top + 10,
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
              backgroundColor: config.bg,
              borderColor: config.border,
            },
          ]}
        >
          <View style={styles.content}>
            <Ionicons name={config.icon} size={22} color={config.text} />
            <Text style={[styles.message, { color: config.text }]} numberOfLines={3}>
              {currentToast.message}
            </Text>
          </View>
          {currentToast.action && (
            <TouchableOpacity
              style={[styles.actionButton, { borderColor: config.border }]}
              onPress={() => {
                currentToast.action?.onPress();
                hideToast();
              }}
            >
              <Text style={[styles.actionText, { color: config.text }]}>
                {currentToast.action.label}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.closeButton} onPress={hideToast}>
            <Ionicons name="close" size={18} color={config.text} />
          </TouchableOpacity>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    zIndex: 9999,
    elevation: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  message: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    marginLeft: 8,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
    marginLeft: 4,
  },
});
