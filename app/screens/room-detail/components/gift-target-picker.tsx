import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MEDIA_BASE } from '@/services/api';
import type { GiftItem } from '../room-detail.data';

const COIN_IMG = require('@/assets/tabs/coin.png');

export type GiftTarget = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  isHost: boolean;
};

type Props = {
  visible: boolean;
  gift: GiftItem | null;
  targets: GiftTarget[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onSend: (qty: number) => void;
  onClose: () => void;
  onGiftChange?: (gift: GiftItem) => void;
  allGifts?: GiftItem[];
};

function resolveImg(url: string | null | undefined) {
  if (!url) return null;
  try { return `${MEDIA_BASE}${new URL(url).pathname}`; }
  catch { return `${MEDIA_BASE}/${url.replace(/^\//, '')}`; }
}

function Avatar({ url, name, size = 40 }: { url: string | null; name: string; size?: number }) {
  const uri = resolveImg(url);
  if (uri) return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  return (
    <View style={[s.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={s.avatarInitial}>{name[0]?.toUpperCase()}</Text>
    </View>
  );
}

export function GiftTargetPicker({ visible, gift, targets, selectedId, onSelect, onSend, onGiftChange, allGifts = [] }: Props) {
  const slideY = useRef(new Animated.Value(220)).current;
  const [qty, setQty] = useState(1);

  useEffect(() => {
    if (visible) {
      setQty(1);
      Animated.spring(slideY, { toValue: 0, useNativeDriver: true, tension: 72, friction: 13 }).start();
    } else {
      Animated.timing(slideY, { toValue: 220, duration: 180, useNativeDriver: true }).start();
    }
  }, [visible]);

  // Reset qty when gift changes
  useEffect(() => { setQty(1); }, [gift?.id]);

  if (!gift && !visible) return null;

  const resolvedGift = gift;
  const imgUri = resolvedGift?.image_url ? resolveImg(resolvedGift.image_url) : null;
  const totalCoins = (resolvedGift?.coins ?? 0) * qty;

  return (
    <Animated.View
      style={[s.container, { transform: [{ translateY: slideY }] }]}
      pointerEvents={visible ? 'box-none' : 'none'}>

      {/* ── Top row: gift info + qty + send ── */}
      <View style={s.topRow}>
        {/* Left: gift image + name + coins */}
        <View style={s.giftInfo}>
          {imgUri
            ? <Image source={{ uri: imgUri }} style={s.giftImg} resizeMode="contain" />
            : <Ionicons name="gift-outline" size={28} color="#7A0EED" />}
          <View>
            <Text style={s.giftName} numberOfLines={1}>{resolvedGift?.name}</Text>
            <View style={s.coinRow}>
              <Image source={COIN_IMG} style={s.coinIcon} resizeMode="contain" />
              <Text style={s.coinAmt}>
                {totalCoins >= 1000 ? `${(totalCoins / 1000).toFixed(1)}K` : totalCoins}
              </Text>
            </View>
          </View>
        </View>

        {/* Center: qty control */}
        <View style={s.qtyRow}>
          <TouchableOpacity
            onPress={() => setQty(q => Math.max(1, q - 1))}
            style={s.qtyBtn} activeOpacity={0.7} hitSlop={8}>
            <Ionicons name="remove" size={16} color="#7A0EED" />
          </TouchableOpacity>
          <Text style={s.qtyLabel}>×{qty}</Text>
          <TouchableOpacity
            onPress={() => setQty(q => q + 1)}
            style={s.qtyBtn} activeOpacity={0.7} hitSlop={8}>
            <Ionicons name="add" size={16} color="#7A0EED" />
          </TouchableOpacity>
        </View>

        {/* Right: send button */}
        <TouchableOpacity
          style={[s.sendBtn, !selectedId && s.sendBtnDisabled]}
          onPress={() => { if (selectedId) onSend(qty); }}
          activeOpacity={0.85}
          disabled={!selectedId}>
          <Ionicons name="send" size={14} color="#fff" />
          <Text style={s.sendBtnText}>Send</Text>
        </TouchableOpacity>
      </View>

      {/* ── Targets (horizontal) ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.targetScroll}
        contentContainerStyle={s.targetList}>
        {targets.map(t => {
          const selected = selectedId === t.userId;
          return (
            <TouchableOpacity
              key={t.userId}
              onPress={() => onSelect(t.userId)}
              activeOpacity={0.8}
              style={s.targetItem}>
              <View style={[s.avatarWrap, selected && s.avatarWrapSelected]}>
                <Avatar url={t.avatarUrl} name={t.name} size={42} />
                {t.isHost && (
                  <View style={s.hostBadge}>
                    <Text style={s.hostBadgeText}>HOST</Text>
                  </View>
                )}
                {selected && (
                  <View style={s.checkBadge}>
                    <Ionicons name="checkmark" size={9} color="#fff" />
                  </View>
                )}
              </View>
              <Text style={[s.targetName, selected && s.targetNameSelected]} numberOfLines={1}>
                {t.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Gift picker (horizontal) ── */}
      {allGifts.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.giftScroll}
          contentContainerStyle={s.giftList}>
          {allGifts.map(g => {
            const gImgUri = g.image_url ? resolveImg(g.image_url) : null;
            const isSelected = g.id === resolvedGift?.id;
            return (
              <TouchableOpacity
                key={g.id}
                onPress={() => onGiftChange?.(g)}
                activeOpacity={0.8}
                style={[s.giftCell, isSelected && s.giftCellSelected]}>
                {gImgUri
                  ? <Image source={{ uri: gImgUri }} style={s.giftCellImg} resizeMode="contain" />
                  : <Ionicons name="gift-outline" size={22} color="#7A0EED" />}
                <View style={s.giftCellCoin}>
                  <Image source={COIN_IMG} style={s.giftCellCoinImg} resizeMode="contain" />
                  <Text style={s.giftCellCoinText}>
                    {g.coins >= 1000 ? `${g.coins / 1000}K` : g.coins}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </Animated.View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingBottom: 16,
    shadowColor: '#4A0099',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -4 },
    elevation: 20,
  },

  // Top row
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 10,
    marginBottom: 10,
  },
  giftInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  giftImg: { width: 40, height: 40 },
  giftName: { fontSize: 13, fontWeight: '700', color: '#1C1E22', maxWidth: 100 },
  coinRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  coinIcon: { width: 12, height: 12 },
  coinAmt: { fontSize: 12, fontWeight: '700', color: '#E8944A' },

  // Qty
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0E8FF',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  qtyBtn: {
    width: 24, height: 24,
    alignItems: 'center', justifyContent: 'center',
  },
  qtyLabel: { fontSize: 14, fontWeight: '800', color: '#7A0EED', minWidth: 28, textAlign: 'center' },

  // Send button
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#7A0EED',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  sendBtnDisabled: { backgroundColor: '#DDDAE8' },
  sendBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  // Targets
  targetScroll: { flexShrink: 0 },
  targetList: { paddingHorizontal: 14, gap: 10, paddingBottom: 4 },
  targetItem: { alignItems: 'center', gap: 4, width: 56 },
  avatarWrap: {
    position: 'relative',
    borderRadius: 25,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  avatarWrapSelected: { borderColor: '#7A0EED' },
  avatarFallback: {
    backgroundColor: '#EDE8F7',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { fontSize: 16, fontWeight: '700', color: '#7A0EED' },
  hostBadge: {
    position: 'absolute', bottom: -4, left: '50%',
    transform: [{ translateX: -12 }],
    backgroundColor: '#7A0EED',
    borderRadius: 5, paddingHorizontal: 3, paddingVertical: 1,
  },
  hostBadgeText: { fontSize: 7, fontWeight: '800', color: '#fff' },
  checkBadge: {
    position: 'absolute', top: -2, right: -2,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: '#7A0EED',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#fff',
  },
  targetName: { fontSize: 10, fontWeight: '600', color: '#60626A', textAlign: 'center', maxWidth: 54 },
  targetNameSelected: { color: '#7A0EED', fontWeight: '700' },

  // Gift picker row
  giftScroll: { flexShrink: 0, marginTop: 6 },
  giftList: { paddingHorizontal: 14, gap: 6, paddingBottom: 2 },
  giftCell: {
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'transparent',
    minWidth: 52,
  },
  giftCellSelected: {
    borderColor: '#7A0EED',
    backgroundColor: '#F0E8FF',
  },
  giftCellImg: { width: 34, height: 34 },
  giftCellCoin: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  giftCellCoinImg: { width: 10, height: 10 },
  giftCellCoinText: { fontSize: 10, fontWeight: '700', color: '#1C1E22' },
});
