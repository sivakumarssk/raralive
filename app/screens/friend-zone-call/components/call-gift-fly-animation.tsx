import { useEffect, useRef } from 'react';
import { Animated, Dimensions, Image, StyleSheet, View } from 'react-native';

import { MEDIA_BASE } from '@/services/api';

const { width: W, height: H } = Dimensions.get('window');
const GIFT_SIZE = 44;

export type CallFlyItem = {
  id: string;
  giftName: string;
  giftImageUrl: string | null;
  qty: number;
};

function resolveImg(url: string | null | undefined) {
  if (!url) return null;
  try { return `${MEDIA_BASE}${new URL(url).pathname}`; }
  catch { return `${MEDIA_BASE}/${url.replace(/^\//, '')}`; }
}

function SingleFly({ item, delay = 0, onDone }: { item: CallFlyItem; delay?: number; onDone: () => void }) {
  const startX = W / 2 - GIFT_SIZE / 2;
  const startY = H * 0.72;
  const endX = W - 60 - GIFT_SIZE / 2;
  const endY = H * 0.14;

  const posX = useRef(new Animated.Value(startX)).current;
  const posY = useRef(new Animated.Value(startY)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const doneRef = useRef(false);

  useEffect(() => {
    const fly = () => {
      Animated.parallel([
        Animated.timing(posX, { toValue: endX, duration: 650, useNativeDriver: true }),
        Animated.timing(posY, { toValue: endY, duration: 650, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 0.5, duration: 650, useNativeDriver: true }),
      ]).start(() => {
        Animated.timing(opacity, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
          if (!doneRef.current) { doneRef.current = true; onDone(); }
        });
      });
    };
    if (delay > 0) {
      const t = setTimeout(fly, delay);
      return () => clearTimeout(t);
    }
    fly();
  }, []);

  const imgUri = resolveImg(item.giftImageUrl);

  return (
    <Animated.View
      style={[
        s.flyEl,
        {
          width: GIFT_SIZE,
          height: GIFT_SIZE,
          opacity,
          transform: [{ translateX: posX }, { translateY: posY }, { scale }],
        },
      ]}>
      {imgUri
        ? <Image source={{ uri: imgUri }} style={s.giftImg} resizeMode="contain" />
        : <View style={s.fallback} />}
    </Animated.View>
  );
}

function MultiFly({ item, onDone }: { item: CallFlyItem; onDone: () => void }) {
  const count = Math.min(item.qty, 5);
  const doneCount = useRef(0);

  const handleOneDone = () => {
    doneCount.current += 1;
    if (doneCount.current >= count) onDone();
  };

  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <SingleFly key={`${item.id}_${i}`} delay={i * 140} item={item} onDone={handleOneDone} />
      ))}
    </>
  );
}

type Props = {
  items: CallFlyItem[];
  onItemDone: (id: string) => void;
};

export function CallGiftFlyAnimation({ items, onItemDone }: Props) {
  if (items.length === 0) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {items.map(item => (
        <MultiFly key={item.id} item={item} onDone={() => onItemDone(item.id)} />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  flyEl: { position: 'absolute', top: 0, left: 0 },
  giftImg: { width: GIFT_SIZE, height: GIFT_SIZE },
  fallback: { width: GIFT_SIZE, height: GIFT_SIZE, borderRadius: GIFT_SIZE / 2, backgroundColor: '#7A0EED' },
});
