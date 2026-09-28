import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, Text, View } from 'react-native';
import { resolveImageUrl } from '@/services/api';
import type { ChatMessage } from '../room-detail.data';

const { width: W } = Dimensions.get('window');

// How long a banner stays after the last gift in its combo before floating away.
const HOLD_MS = 3000;
// Number of banner slots on screen. When all are busy, a new sender waits for a
// free slot, except the viewer's own gifts, which always get a slot on their
// own screen (the oldest other sender's box is pushed out to make room).
const MAX_SLOTS = 3;

// Layout constants — also used to compute where the gift image sits (see below).
const WRAP_TOP = 6;
const WRAP_LEFT = 8;
const ROW_H = 52;
const ROW_GAP = 6;
const PILL_W = 190;
const GIFT_SIZE = 52;
const GIFT_OVERLAP = 36;

// Center of the first banner's gift image, relative to the chat area's top-left.
// The gift fly animation starts here so the gift appears to fly out of the banner.
export const BANNER_GIFT_CENTER = {
  x: WRAP_LEFT + PILL_W - GIFT_OVERLAP + GIFT_SIZE / 2,
  y: WRAP_TOP + ROW_H / 2,
};
// Vertical distance between stacked banner rows (add row * this to the center's y).
export const BANNER_ROW_STEP = ROW_H + ROW_GAP;

type Banner = {
  id: string;
  // One banner per sender — every gift they send updates this same box.
  senderKey: string;
  senderName: string;
  avatarUri?: string;
  receiverName: string;
  // Gift + receiver of the current combo; the count resets when either changes.
  comboKey: string;
  giftImageUrl: string | null;
  count: number;
  // Increments on every update so the row can pulse + reset its hold timer.
  bump: number;
  updatedAt: number;
  exiting: boolean;
};

export type GiftBannersHandle = {
  /** Shows (or updates) the sender's banner. Returns whether a new box was created
   *  and which row (0 = top) that sender's box is in, or null when all slots are
   *  busy with other senders (the caller should retry on onSlotFree). */
  show: (msg: ChatMessage) => { isNew: boolean; row: number } | null;
};

type Props = {
  /** The viewer: their own gifts always get a slot. */
  myUserId?: string;
  /** Called whenever a slot frees up (a box starts closing on its own). */
  onSlotFree?: () => void;
};

// Live gift banners shown over the top of the chat area (just under the stage).
// Each sender gets ONE box: further gifts from them update its receiver name, gift
// image and "x N" count in place (count keeps growing for the same gift + receiver,
// restarts when either changes). Once they stop for HOLD_MS the box floats up and
// fades out. Driven by the screen's gift queue via ref.show(), so updates happen
// one at a time in step with the gift fly animation.
export const GiftComboBanners = forwardRef<GiftBannersHandle, Props>(function GiftComboBanners({ myUserId, onSlotFree }, ref) {
  const [banners, setBanners] = useState<Banner[]>([]);
  const propsRef = useRef({ myUserId, onSlotFree });
  propsRef.current = { myUserId, onSlotFree };
  // Mirror of `banners` so show() can tell synchronously whether a box exists
  const bannersRef = useRef<Banner[]>([]);
  const commit = (next: Banner[]) => { bannersRef.current = next; setBanners(next); };

  useImperativeHandle(ref, () => ({
    show: (msg: ChatMessage) => {
      const qty = msg.giftQty ?? 1;
      const senderKey = String(msg.user?.id ?? msg.user?.name ?? 'unknown');
      const comboKey = `${msg.giftId ?? msg.giftImageUrl}|${msg.giftForId ?? msg.giftTo}`;
      const receiverName = msg.giftTo ?? '';
      const giftImageUrl = resolveImageUrl(msg.giftImageUrl) ?? null;
      let prev = bannersRef.current;

      const hit = prev.find(b => b.senderKey === senderKey && !b.exiting);
      if (hit) {
        const row = prev.indexOf(hit);
        commit(prev.map(b => (b !== hit ? b : {
          ...b,
          receiverName,
          giftImageUrl,
          comboKey,
          count: b.comboKey === comboKey ? b.count + qty : qty,
          bump: b.bump + 1,
          updatedAt: Date.now(),
        })));
        return { isNew: false, row };
      }

      const active = prev.filter(b => !b.exiting);
      if (active.length >= MAX_SLOTS) {
        const isMine = !!propsRef.current.myUserId && senderKey === propsRef.current.myUserId;
        if (!isMine) return null;  // wait for a free slot
        // My own gift: push out the least recently updated other sender's box
        const victim = active
          .filter(b => b.senderKey !== senderKey)
          .sort((a, b) => a.updatedAt - b.updatedAt)[0];
        if (victim) prev = prev.map(b => (b === victim ? { ...b, exiting: true } : b));
      }

      const next = [...prev, {
        id: `${msg.id}-${Date.now()}`,
        senderKey,
        senderName: msg.user?.name ?? 'Someone',
        avatarUri: msg.user?.avatarUri,
        receiverName,
        comboKey,
        giftImageUrl,
        count: qty,
        bump: 0,
        updatedAt: Date.now(),
        exiting: false,
      }];
      commit(next);
      return { isNew: true, row: next.length - 1 };
    },
  }), []);

  // A box closing on its own frees its slot for the next waiting sender
  const markExiting = (id: string) => {
    commit(bannersRef.current.map(b => (b.id === id ? { ...b, exiting: true } : b)));
    propsRef.current.onSlotFree?.();
  };
  const remove = (id: string) => commit(bannersRef.current.filter(b => b.id !== id));

  if (banners.length === 0) return null;
  return (
    <View style={s.wrap} pointerEvents="none">
      {banners.map(b => (
        <BannerRow key={b.id} banner={b} onExitStart={() => markExiting(b.id)} onDone={() => remove(b.id)} />
      ))}
    </View>
  );
});

function BannerRow({ banner, onExitStart, onDone }: { banner: Banner; onExitStart: () => void; onDone: () => void }) {
  // Height of this row's slot in the stack. Collapsed to 0 on exit so the banners
  // below slide up into the freed space instead of leaving a gap. (JS-driven —
  // height can't use the native driver — so it lives on its own outer view.)
  const slotH = useRef(new Animated.Value(ROW_H + ROW_GAP)).current;
  const slideX = useRef(new Animated.Value(-W)).current;
  const liftY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const countScale = useRef(new Animated.Value(1)).current;
  const giftBob = useRef(new Animated.Value(0)).current;

  // Slide in from the left on mount
  useEffect(() => {
    Animated.spring(slideX, { toValue: 0, friction: 8, tension: 60, useNativeDriver: true }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(giftBob, { toValue: -4, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(giftBob, { toValue: 0, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Every combo hit: pulse the counter and restart the hold timer. When the timer
  // runs out the box is marked exiting (frees its slot), which runs the exit below.
  useEffect(() => {
    if (banner.exiting) return;
    if (banner.bump > 0) {
      countScale.setValue(1.6);
      Animated.spring(countScale, { toValue: 1, friction: 4, useNativeDriver: true }).start();
    }
    const t = setTimeout(onExitStart, HOLD_MS);
    return () => clearTimeout(t);
  }, [banner.bump, banner.exiting]);

  // Exit (timed out, or pushed out for the viewer's own gift): float up while
  // fading, collapse the slot so boxes below move up, then remove.
  const exitStarted = useRef(false);
  useEffect(() => {
    if (!banner.exiting || exitStarted.current) return;
    exitStarted.current = true;
    Animated.timing(slotH, { toValue: 0, duration: 450, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }).start();
    Animated.parallel([
      Animated.timing(liftY, { toValue: -60, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start(() => onDone());
  }, [banner.exiting]);

  return (
    <Animated.View style={{ height: slotH }}>
    <Animated.View style={[s.row, { opacity, transform: [{ translateX: slideX }, { translateY: liftY }] }]}>
      <LinearGradient
        colors={['rgba(58,16,92,0.95)', 'rgba(120,40,170,0.75)', 'rgba(120,40,170,0)']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={s.pill}>
        <View style={s.avatarRing}>
          {banner.avatarUri ? (
            <ExpoImage source={{ uri: banner.avatarUri }} style={s.avatar} contentFit="cover" />
          ) : (
            <View style={[s.avatar, s.avatarFallback]}>
              <Text style={s.avatarInitial}>{banner.senderName.charAt(0).toUpperCase()}</Text>
            </View>
          )}
        </View>
        <View style={s.textCol}>
          <Text style={s.name} numberOfLines={1}>{banner.senderName}</Text>
          <Text style={s.sent} numberOfLines={1} ellipsizeMode="tail">
            sent to <Text style={s.giftName}>{banner.receiverName}</Text>
          </Text>
        </View>
      </LinearGradient>

      <Animated.View style={[s.giftWrap, { transform: [{ translateY: giftBob }] }]}>
        {banner.giftImageUrl ? (
          <ExpoImage source={{ uri: banner.giftImageUrl }} style={s.giftImg} contentFit="contain" />
        ) : (
          <Text style={s.giftEmoji}>🎁</Text>
        )}
      </Animated.View>

      <Animated.Text style={[s.count, { transform: [{ scale: countScale }] }]}>
        <Text style={s.countX}>x</Text>{banner.count}
      </Animated.Text>
    </Animated.View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: WRAP_TOP,
    left: WRAP_LEFT,
    right: WRAP_LEFT,
    zIndex: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: ROW_H,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 190,
    height: 44,
    borderRadius: 22,
    paddingLeft: 3,
    paddingRight: 40,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  avatarRing: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    borderColor: '#F5C84B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: { width: 34, height: 34, borderRadius: 17 },
  avatarFallback: { backgroundColor: '#7A0EED', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#FFF', fontWeight: '800', fontSize: 14 },
  textCol: { marginLeft: 8, flexShrink: 1 },
  name: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  sent: { color: 'rgba(255,255,255,0.8)', fontSize: 11, marginTop: 1 },
  giftName: { color: '#FFD76A', fontWeight: '700' },
  giftWrap: {
    marginLeft: -36,
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  giftImg: { width: 52, height: 52 },
  giftEmoji: { fontSize: 34 },
  count: {
    marginLeft: 4,
    color: '#FFD76A',
    fontSize: 24,
    fontWeight: '900',
    fontStyle: 'italic',
    textShadowColor: 'rgba(122,14,237,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  countX: { fontSize: 16 },
});
