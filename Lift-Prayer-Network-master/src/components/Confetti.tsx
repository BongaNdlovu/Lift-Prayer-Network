import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, StyleSheet, View } from 'react-native';

const { width, height } = Dimensions.get('window');

const CONFETTI_COUNT = 50;
const COLORS = ['#4A5D4E', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444', '#C4A882', '#34d399'];

type ConfettiPiece = {
  id: number;
  x: number;
  color: string;
  size: number;
  rotation: number;
};

const createConfettiPieces = (): ConfettiPiece[] => {
  return Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
    id: i,
    x: Math.random() * width,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    size: Math.random() * 8 + 6,
    rotation: Math.random() * 360,
  }));
};

type Props = {
  active: boolean;
  onComplete?: () => void;
};

export const Confetti: React.FC<Props> = ({ active, onComplete }) => {
  const pieces = useRef(createConfettiPieces()).current;
  const animations = useRef(pieces.map(() => new Animated.Value(0))).current;
  const opacities = useRef(pieces.map(() => new Animated.Value(1))).current;

  useEffect(() => {
    if (active) {
      // Reset
      animations.forEach((anim) => anim.setValue(0));
      opacities.forEach((opacity) => opacity.setValue(1));

      // Start animations
      const fallAnimations = animations.map((anim, index) =>
        Animated.timing(anim, {
          toValue: 1,
          duration: 2000 + Math.random() * 1000,
          useNativeDriver: true,
          delay: index * 20,
        })
      );

      const fadeAnimations = opacities.map((opacity) =>
        Animated.timing(opacity, {
          toValue: 0,
          duration: 2500,
          delay: 500,
          useNativeDriver: true,
        })
      );

      Animated.parallel([...fallAnimations, ...fadeAnimations]).start(() => {
        onComplete?.();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  if (!active) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      {pieces.map((piece, index) => {
        const translateY = animations[index].interpolate({
          inputRange: [0, 1],
          outputRange: [-50, height + 100],
        });

        const translateX = animations[index].interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [0, Math.random() * 60 - 30, Math.random() * 100 - 50],
        });

        const rotate = animations[index].interpolate({
          inputRange: [0, 1],
          outputRange: [`${piece.rotation}deg`, `${piece.rotation + 720}deg`],
        });

        const scale = animations[index].interpolate({
          inputRange: [0, 0.2, 1],
          outputRange: [0, 1, 0.8],
        });

        return (
          <Animated.View
            key={piece.id}
            style={[
              styles.piece,
              {
                left: piece.x,
                width: piece.size,
                height: piece.size * 1.5,
                backgroundColor: piece.color,
                borderRadius: piece.size / 4,
                transform: [{ translateY }, { translateX }, { rotate }, { scale }],
                opacity: opacities[index],
              },
            ]}
          />
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
  },
  piece: {
    position: 'absolute',
    top: 0,
  },
});

