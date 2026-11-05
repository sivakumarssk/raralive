import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { speakingStore } from '@/store/speaking-store';

// Voice waves behind a stage seat while that person is speaking.
//   • glow ring — hugs the avatar, brightens/swells with the voice level
//   • 2 ripples — keep rolling outward; how far and how bright follows the level
// Everything is 0 (invisible) when silent and eases between levels, so it
// reacts to intensity without jumping. Native-driver only (transform/opacity).

const RIPPLE_MS = 1500;

export function SpeakingWaves({ userId, size, color }: {
  userId: string;
  /** Diameter of the seat ring the waves sit behind. */
  size: number;
  color: string;
}) {
  const level = useRef(new Animated.Value(speakingStore.getLevel(userId))).current;
  const phaseA = useRef(new Animated.Value(0)).current;
  const phaseB = useRef(new Animated.Value(0)).current;

  // Follow the speaker's level, eased (rises quickly, falls a bit slower)
  useEffect(() => {
    let current = speakingStore.getLevel(userId);
    level.setValue(current);
    const unsub = speakingStore.subscribe(userId, next => {
      Animated.timing(level, {
        toValue: next,
        duration: next > current ? 140 : 320,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
      current = next;
    });
    return unsub;
  }, [userId, level]);

  // Two ripples, half a cycle apart, rolling outward forever (invisible when silent)
  useEffect(() => {
    const ripple = (v: Animated.Value) => Animated.loop(
      Animated.timing(v, { toValue: 1, duration: RIPPLE_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    );
    const a = ripple(phaseA);
    const b = ripple(phaseB);
    a.start();
    const t = setTimeout(() => b.start(), RIPPLE_MS / 2);
    return () => { clearTimeout(t); a.stop(); b.stop(); };
  }, [phaseA, phaseB]);

  // Ripple reach: 15% past the ring when quiet-ish, up to ~55% when loud
  const rippleStyle = (phase: Animated.Value) => ({
    opacity: Animated.multiply(phase.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }), level),
    transform: [{
      scale: Animated.add(1, Animated.multiply(phase, Animated.add(0.15, Animated.multiply(level, 0.4)))),
    }],
  });

  const glowStyle = {
    opacity: level.interpolate({ inputRange: [0, 0.05, 1], outputRange: [0, 0.55, 1] }),
    transform: [{ scale: level.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) }],
  };

  const ring = { width: size, height: size, borderRadius: size / 2 };

  return (
    <View pointerEvents="none" style={[s.wrap, ring]}>
      <Animated.View style={[s.ripple, ring, { backgroundColor: color }, rippleStyle(phaseA)]} />
      <Animated.View style={[s.ripple, ring, { backgroundColor: color }, rippleStyle(phaseB)]} />
      <Animated.View style={[s.glow, ring, { borderColor: color, shadowColor: color }, glowStyle]} />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0 },
  ripple: { position: 'absolute', top: 0, left: 0, opacity: 0 },
  glow: {
    position: 'absolute', top: 0, left: 0,
    borderWidth: 3, opacity: 0,
    shadowOpacity: 0.8, shadowRadius: 8, shadowOffset: { width: 0, height: 0 },
  },
});
