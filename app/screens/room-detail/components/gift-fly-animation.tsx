import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
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
  /** Window coords of the gift's start point (its center). Defaults to bottom-center. */
  origin?: SlotPosition;
  /** Wait before flying, e.g. so the gift banner has slid in first. */
  startDelay?: number;
  /** Flight time in ms (default 600) — shortened when gifts are coming in fast. */
  duration?: number;
};

function resolveImg(url: string | null | undefined) {
  if (!url) return null;
  try { return `${MEDIA_BASE}${new URL(url).pathname}`; }
  catch { return `${MEDIA_BASE}/${url.replace(/^\//, '')}`; }
}

function SingleFly({ item, delay = 0, onDone }: { item: FlyItem; delay?: number; onDone: () => void }) {
  const startX = (item.origin?.x ?? W / 2) - GIFT_SIZE / 2;
  const startY = item.origin ? item.origin.y - GIFT_SIZE / 2 : H * 0.78;

  // Shift left by half gift size so the gift CENTER lands on the avatar center
  const endX = item.targetPos
    ? item.targetPos.x - GIFT_SIZE / 2
    : W / 2 - GIFT_SIZE / 2;
  const endY = item.targetPos
    ? item.targetPos.y + 18
    : H * 0.25;

  const posX = useRef(new Animated.Value(startX)).current;
  const posY = useRef(new Animated.Value(startY)).current;
  // Hidden until it starts flying, so delayed gifts don't sit visible at the origin
  const opacity = useRef(new Animated.Value(0)).current;
  const doneRef = useRef(false);

  useEffect(() => {
    const fly = () => {
      opacity.setValue(1);
      Animated.parallel([
        Animated.timing(posX, { toValue: endX, duration: item.duration ?? 600, useNativeDriver: true }),
        Animated.timing(posY, { toValue: endY, duration: item.duration ?? 600, useNativeDriver: true }),
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
          delay={(item.startDelay ?? 0) + i * 100}
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

export type GiftFlyHandle = { launch: (item: FlyItem) => void };

// Flying gifts are kept in this component's own state (launched via ref) so each
// launch/landing only re-renders this overlay — not the whole room screen and its
// chat list, which made rapid gifting stutter.
export const GiftFlyAnimation = forwardRef<GiftFlyHandle>(function GiftFlyAnimation(_props, ref) {
  const [items, setItems] = useState<FlyItem[]>([]);
  useImperativeHandle(ref, () => ({
    launch: (item: FlyItem) => setItems(prev => [...prev, item]),
  }), []);

  if (items.length === 0) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {items.map(item => (
        <MultiFly
          key={item.id}
          item={item}
          onDone={() => setItems(prev => prev.filter(i => i.id !== item.id))}
        />
      ))}
    </View>
  );
});

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
