import { useEffect, useRef } from 'react';
import { Animated, Dimensions, Image, StyleSheet, View } from 'react-native';
import { MEDIA_BASE } from '@/services/api';
import type { GiftItem } from '../room-detail.data';

const { width: W, height: H } = Dimensions.get('window');
const GIFT_SIZE = 40;

export type SlotPosition = { x: number; y: number };

export type FlyItem = {
  id: string;
  gift: GiftItem;
  qty: number;
  targetUserId?: string;
  targetPos?: SlotPosition;
};

function resolveImg(url: string | null | undefined) {
  if (!url) return null;
  try { return `${MEDIA_BASE}${new URL(url).pathname}`; }
  catch { return `${MEDIA_BASE}/${url.replace(/^\//, '')}`; }
}

function SingleFly({ item, delay = 0, onDone }: { item: FlyItem; delay?: number; onDone: () => void }) {
  const startX = W / 2 - GIFT_SIZE / 2;
  const startY = H * 0.78;

  // Shift left by half gift size so the gift CENTER lands on the avatar center
  const endX = item.targetPos
    ? item.targetPos.x - GIFT_SIZE / 2
    : W / 2 - GIFT_SIZE / 2;
  const endY = item.targetPos
    ? item.targetPos.y + 18
    : H * 0.25;

  const posX = useRef(new Animated.Value(startX)).current;
  const posY = useRef(new Animated.Value(startY)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const doneRef = useRef(false);

  useEffect(() => {
    const fly = () => {
      Animated.parallel([
        Animated.timing(posX, { toValue: endX, duration: 600, useNativeDriver: true }),
        Animated.timing(posY, { toValue: endY, duration: 600, useNativeDriver: true }),
      ]).start(() => {
        Animated.timing(opacity, {
          toValue: 0,
          duration: 100,
          useNativeDriver: true,
        }).start(() => {
          if (!doneRef.current) {
            doneRef.current = true;
            onDone();
          }
        });
      });
    };
    if (delay > 0) {
      const t = setTimeout(fly, delay);
      return () => clearTimeout(t);
    }
    fly();
  }, []);

  const imgUri = resolveImg(item.gift.image_url);

  return (
    <Animated.View
      style={[
        s.flyEl,
        {
          width: GIFT_SIZE,
          height: GIFT_SIZE,
          opacity,
          transform: [{ translateX: posX }, { translateY: posY }],
        },
      ]}>
      {imgUri
        ? <Image source={{ uri: imgUri }} style={s.giftImg} resizeMode="contain" />
        : <View style={s.fallback} />}
    </Animated.View>
  );
}

// Wrapper that tracks done count for multi-qty items
function MultiFly({ item, onDone }: { item: FlyItem; onDone: () => void }) {
  const count = Math.min(item.qty, 5);
  const doneCount = useRef(0);

  const handleOneDone = () => {
    doneCount.current += 1;
    if (doneCount.current >= count) onDone();
  };

  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <SingleFly
          key={`${item.id}_${i}`}
          delay={i * 150}
          item={i === 0 ? item : {
            ...item,
            targetPos: item.targetPos ? {
              x: item.targetPos.x + (Math.random() - 0.5) * 20,
              y: item.targetPos.y + (Math.random() - 0.5) * 14,
            } : undefined,
          }}
          onDone={handleOneDone}
        />
      ))}
    </>
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
        <MultiFly
          key={item.id}
          item={item}
          onDone={() => onItemDone(item.id)}
        />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  flyEl: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  giftImg: {
    width: GIFT_SIZE,
    height: GIFT_SIZE,
  },
  fallback: {
    width: GIFT_SIZE,
    height: GIFT_SIZE,
    borderRadius: GIFT_SIZE / 2,
    backgroundColor: '#7A0EED',
  },
});
