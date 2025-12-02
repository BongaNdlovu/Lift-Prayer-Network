import React, { Suspense, lazy, ComponentType } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

type LazyScreenProps = {
  factory: () => Promise<{ default: ComponentType<any> }>;
  fallback?: React.ReactNode;
  componentProps?: any;
};

export const LazyScreen: React.FC<LazyScreenProps> = ({ factory, fallback, componentProps }) => {
  const { colors } = useTheme();
  const LazyComponent = lazy(factory);

  const defaultFallback = (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={colors.accent} />
    </View>
  );

  return (
    <Suspense fallback={fallback || defaultFallback}>
      <LazyComponent {...componentProps} />
    </Suspense>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
