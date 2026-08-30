import { useMemo } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const STAR_COUNT = 60;

type Star = { left: number; top: number; size: number; opacity: number };

function makeStars(): Star[] {
  return Array.from({ length: STAR_COUNT }, () => ({
    left: Math.random() * SCREEN_W,
    top: Math.random() * SCREEN_H,
    size: Math.random() < 0.15 ? 3 : Math.random() < 0.5 ? 2 : 1,
    opacity: 0.25 + Math.random() * 0.65,
  }));
}

// Static twinkle-free starfield — cheap fallback backdrop shown behind the
// host's video tile (or in place of it, when camera is off), matching the
// reference "Moj Live" look. Regenerated once per screen mount, not
// animated, to keep this file dependency-free.
export function StarfieldBackground() {
  const stars = useMemo(makeStars, []);
  return (
    <View style={s.root} pointerEvents="none">
      {stars.map((star, i) => (
        <View
          key={i}
          style={[
            s.star,
            {
              left: star.left, top: star.top,
              width: star.size, height: star.size, borderRadius: star.size / 2,
              opacity: star.opacity,
            },
          ]}
        />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: '#1A0F3D', overflow: 'hidden' },
  star: { position: 'absolute', backgroundColor: '#FFFFFF' },
});
