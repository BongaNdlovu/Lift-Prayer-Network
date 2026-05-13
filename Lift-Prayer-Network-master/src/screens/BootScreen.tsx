import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { LiftScreen } from '../components/LiftLayout';
import { useTheme } from '../contexts/ThemeContext';

export const BootScreen: React.FC = () => {
  const { colors } = useTheme();
  const scaleAnim = useRef(new Animated.Value(0.3)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Logo entrance animation
    const entrance = Animated.sequence([
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 600,
          easing: Easing.out(Easing.back(1.5)),
          useNativeDriver: true,
        }),
      ]),
      // Title fade in
      Animated.timing(titleOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      // Subtitle fade in
      Animated.timing(subtitleOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]);

    // Continuous pulse animation
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    entrance.start();
    pulse.start();

    return () => {
      entrance.stop();
      pulse.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['-90deg', '0deg'],
  });

  return (
    <LiftScreen contentStyle={styles.container}>
      <Animated.View
        style={[
          styles.logoBox,
          {
            opacity: opacityAnim,
            transform: [
              { scale: scaleAnim },
              { rotate },
            ],
          },
        ]}
      >
        <Animated.View style={[styles.pulseRing, { borderColor: colors.accent, transform: [{ scale: pulseAnim }] }]} />
        <View style={[styles.crossVertical, { backgroundColor: colors.accent }]} />
        <View style={[styles.crossHorizontal, { backgroundColor: colors.accent }]} />
      </Animated.View>
      <Animated.Text style={[styles.title, { color: colors.text, opacity: titleOpacity }]}>LIFT</Animated.Text>
      <Animated.Text style={[styles.subtitle, { color: colors.muted, opacity: subtitleOpacity }]}>
        Live Network of Prayer
      </Animated.Text>
    </LiftScreen>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  logoBox: {
    width: 96,
    height: 96,
    borderWidth: 2,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    
    
    
    
    elevation: 10,
  },
  pulseRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
  },
  crossVertical: {
    position: 'absolute',
    width: 6,
    height: 68,
    borderRadius: 3,
  },
  crossHorizontal: {
    position: 'absolute',
    height: 6,
    width: 68,
    borderRadius: 3,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 8,
    marginTop: 8,
  },
  subtitle: {
    fontSize: 13,
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
});
