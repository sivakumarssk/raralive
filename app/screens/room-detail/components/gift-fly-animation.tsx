import { useEffect, useRef } from 'react';
import { Animated, Dimensions, Image, StyleSheet, View } from 'react-native';
import { MEDIA_BASE } from '@/services/api';
import type { GiftItem } from '../room-detail.data';

const { width: W, height: H } = Dimensions.get('window');

export type SlotPosition = {
  x: number;
  y: number;
};

type Props = {
  gift: GiftItem | null;
  targetPos: SlotPosition | null;
  onDone: () => void;
};

export function GiftFlyAnimation({ gift, targetPos, onDone }: Props) {
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  const startX = W / 2;
  const startY = H - 120;

  useEffect(() => {
    if (!gift || !targetPos) return;

    // Stop any running animation immediately before starting new one
    animRef.current?.stop();

    translateX.setValue(0);
    translateY.setValue(0);
    scale.setValue(1);

    const dx = targetPos.x - startX;
    const dy = targetPos.y - startY;

    const anim = Animated.sequence([
      Animated.parallel([
        Animated.timing(translateX, { toValue: dx, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: dy, duration: 200, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 0.5, duration: 200, useNativeDriver: true }),
      ]),
      Animated.spring(scale, { toValue: 1.3, useNativeDriver: true, tension: 300, friction: 5 }),
    ]);

    animRef.current = anim;
    anim.start(({ finished }) => {
      if (finished) onDone();
    });

    return () => { animRef.current?.stop(); };
  }, [gift, targetPos]);

  if (!gift) return null;

  const imgUri = gift.image_url
    ? `${MEDIA_BASE}/${gift.image_url.replace(/^\//, '')}`
    : null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View
        style={[
          s.gifEl,
          {
            left: startX - 28,
            top: startY - 28,
            transform: [{ translateX }, { translateY }, { scale }],
          },
        ]}>
        {imgUri
          ? <Image source={{ uri: imgUri }} style={s.img} resizeMode="contain" />
          : <View style={s.fallback} />
        }
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  gifEl: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  img: { width: 56, height: 56 },
  fallback: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#7A0EED' },
});
