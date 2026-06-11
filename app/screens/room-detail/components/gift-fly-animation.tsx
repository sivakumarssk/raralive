import { useEffect, useRef } from 'react';
import { Animated, Dimensions, Image, StyleSheet, Text, View } from 'react-native';
import { MEDIA_BASE } from '@/services/api';
import type { GiftItem } from '../room-detail.data';

const { width: W, height: H } = Dimensions.get('window');

export type SlotPosition = { x: number; y: number };

export type FlyItem = {
  id: string;
  gift: GiftItem;
  qty: number;
};

type SingleProps = {
  item: FlyItem;
  onDone: (id: string) => void;
};

const COIN_IMG = require('@/assets/tabs/coin.png');

function resolveImg(url: string | null | undefined) {
  if (!url) return null;
  try { return `${MEDIA_BASE}${new URL(url).pathname}`; }
  catch { return `${MEDIA_BASE}/${url.replace(/^\//, '')}`; }
}

function SingleFly({ item, onDone }: SingleProps) {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  // Slight random horizontal offset so stacked gifts don't perfectly overlap
  const offsetX = useRef((Math.random() - 0.5) * 80).current;
  const offsetY = useRef((Math.random() - 0.5) * 40).current;

  useEffect(() => {
    scale.setValue(0);
    opacity.setValue(1);

    Animated.sequence([
      // Pop in
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 200,
        friction: 7,
      }),
      // Hold briefly
      Animated.delay(500),
      // Fade out with slight scale up
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1.3, duration: 250, useNativeDriver: true }),
      ]),
    ]).start(() => onDone(item.id));
  }, []);

  const imgUri = resolveImg(item.gift.image_url);

  return (
    <Animated.View
      style={[
        s.flyEl,
        {
          left: W / 2 - 36 + offsetX,
          top: H * 0.38 + offsetY,
          opacity,
          transform: [{ scale }],
        },
      ]}>
      {imgUri
        ? <Image source={{ uri: imgUri }} style={s.img} resizeMode="contain" />
        : <View style={s.fallback} />}
      {item.qty > 1 && (
        <View style={s.qtyBadge}>
          <Text style={s.qtyText}>×{item.qty}</Text>
        </View>
      )}
    </Animated.View>
  );
}

type Props = {
  items: FlyItem[];
  onItemDone: (id: string) => void;
};

export function GiftFlyAnimation({ items, onItemDone }: Props) {
  if (items.length === 0) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {items.map(item => (
        <SingleFly key={item.id} item={item} onDone={onItemDone} />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  flyEl: {
    position: 'absolute',
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  img: { width: 72, height: 72 },
  fallback: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#7A0EED' },
  qtyBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#1C1E22',
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: '#fff',
  },
  qtyText: { fontSize: 10, fontWeight: '800', color: '#fff' },
});
