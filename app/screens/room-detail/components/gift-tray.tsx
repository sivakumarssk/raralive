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
import { BASE_URL, MEDIA_BASE } from '@/services/api';
import type { GiftItem } from '../room-detail.data';

const COIN_IMG = require('@/assets/tabs/coin.png');

const QTY_PRESETS = [1, 10, 50, 100, 500, 1000];

export type GiftTarget = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  isHost: boolean;
};

type GiftBarProps = {
  onGiftPress?: (gift: GiftItem) => void;
  hasRoomBg?: boolean;
};

type GiftPickerBarProps = {
  visible: boolean;
  gift: GiftItem | null;
  gifts: GiftItem[];
  targets: GiftTarget[];
  selectedTargetId: string | null;
  onSelectTarget: (id: string) => void;
  onGiftChange: (gift: GiftItem) => void;
  onSend: (qty: number) => void;
  onClose: () => void;
};

function resolveImg(url: string | null | undefined) {
  if (!url) return null;
  try { return `${MEDIA_BASE}${new URL(url).pathname}`; }
  catch { return `${MEDIA_BASE}/${url.replace(/^\//, '')}`; }
}

function Avatar({ url, name, size = 38 }: { url: string | null; name: string; size?: number }) {
  const uri = resolveImg(url);
  if (uri) return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  return (
    <View style={[av.fallback, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={av.initial}>{name[0]?.toUpperCase()}</Text>
    </View>
  );
}

const av = StyleSheet.create({
  fallback: { backgroundColor: '#EDE8F7', alignItems: 'center', justifyContent: 'center' },
  initial: { fontSize: 15, fontWeight: '700', color: '#7A0EED' },
});

// ── Gift Tray (always visible, horizontal scroll of gifts) ────────────────────

export function GiftBar({ onGiftPress, hasRoomBg }: GiftBarProps) {
  const [gifts, setGifts] = useState<GiftItem[]>([]);

  useEffect(() => {
    fetch(`${BASE_URL}/gifts/public`)
      .then(r => r.json())
      .then(json => { if (json.success) setGifts(json.data); })
      .catch(() => {});
  }, []);

  if (gifts.length === 0) return null;

  return (
    <View style={[tray.container, hasRoomBg && tray.containerBg]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={tray.scrollContent}>
        {gifts.map(gift => {
          const imgUri = resolveImg(gift.image_url);
          return (
            <TouchableOpacity
              key={gift.id}
              onPress={() => onGiftPress?.(gift)}
              activeOpacity={0.8}
              style={tray.cell}>
              {imgUri
                ? <Image source={{ uri: imgUri }} style={tray.giftImg} resizeMode="contain" />
                : <View style={tray.placeholder} />}
              <View style={tray.coinRow}>
                <Image source={COIN_IMG} style={tray.coinImg} resizeMode="contain" />
                <Text style={[tray.coinText, hasRoomBg && tray.coinTextBg]}>
                  {gift.coins >= 1000 ? `${gift.coins / 1000}K` : gift.coins}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const tray = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    borderTopColor: '#F0EDF8',
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
  },
  scrollContent: {
    paddingHorizontal: 10,
    gap: 4,
    alignItems: 'center',
  },
  cell: {
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
    minWidth: 52,
  },
  giftImg: { width: 26, height: 26 },
  placeholder: { width: 26, height: 26, borderRadius: 6, backgroundColor: '#EDE8F7' },
  coinRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  coinImg: { width: 11, height: 11 },
  coinText: { fontSize: 11, fontWeight: '700', color: '#1C1E22' },
  containerBg: { backgroundColor: 'rgba(0,0,0,0.45)', borderTopColor: 'rgba(255,255,255,0.1)' },
  coinTextBg: { color: '#FFFFFF' },
});

// ── Gift Picker Bar (slides up when a gift is tapped) ─────────────────────────

export function GiftPickerBar({
  visible, gift, gifts, targets,
  selectedTargetId, onSelectTarget, onGiftChange,
  onSend, onClose,
}: GiftPickerBarProps) {
  const slideY = useRef(new Animated.Value(300)).current;
  const [qty, setQty] = useState(1);
  const [showQtyPopup, setShowQtyPopup] = useState(false);

  useEffect(() => {
    if (visible) {
      setQty(1);
      setShowQtyPopup(false);
      Animated.spring(slideY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 14 }).start();
    } else {
      setShowQtyPopup(false);
      Animated.timing(slideY, { toValue: 300, duration: 200, useNativeDriver: true }).start();
    }
  }, [visible]);

  useEffect(() => { setQty(1); setShowQtyPopup(false); }, [gift?.id]);

  if (!visible && !gift) return null;

  const imgUri = resolveImg(gift?.image_url);
  const totalCoins = (gift?.coins ?? 0) * qty;

  return (
    <Animated.View
      style={[bar.wrapper, { transform: [{ translateY: slideY }] }]}
      pointerEvents={visible ? 'box-none' : 'none'}>

      {/* ── Qty popup (dark, floats above) ── */}
      {showQtyPopup && (
        <View style={bar.qtyPopup}>
          {/* Manual +/- row */}
          <View style={bar.qtyManualRow}>
            <TouchableOpacity
              onPress={() => setQty(q => Math.max(1, q - 1))}
              style={bar.qtyManualBtn} hitSlop={8} activeOpacity={0.7}>
              <Text style={bar.qtyManualIcon}>−</Text>
            </TouchableOpacity>
            <Text style={bar.qtyManualCount}>{qty}</Text>
            <TouchableOpacity
              onPress={() => setQty(q => q + 1)}
              style={bar.qtyManualBtn} hitSlop={8} activeOpacity={0.7}>
              <Text style={bar.qtyManualIcon}>+</Text>
            </TouchableOpacity>
          </View>
          {/* Preset chips */}
          {QTY_PRESETS.map(p => (
            <TouchableOpacity
              key={p}
              onPress={() => { setQty(p); setShowQtyPopup(false); }}
              style={[bar.qtyPresetRow, qty === p && bar.qtyPresetRowActive]}
              activeOpacity={0.8}>
              <Text style={[bar.qtyPresetText, qty === p && bar.qtyPresetTextActive]}>
                x{p}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* ── Gift scroll (the gift picker row) ── */}
      <View style={bar.giftRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={bar.giftScroll}>
          {gifts.map(g => {
            const gImg = resolveImg(g.image_url);
            const isSel = g.id === gift?.id;
            return (
              <TouchableOpacity
                key={g.id}
                onPress={() => onGiftChange(g)}
                activeOpacity={0.8}
                style={[bar.giftCell, isSel && bar.giftCellSelected]}>
                {gImg
                  ? <Image source={{ uri: gImg }} style={bar.giftCellImg} resizeMode="contain" />
                  : <View style={bar.giftCellPlaceholder} />}
                <View style={bar.giftCellCoin}>
                  <Image source={COIN_IMG} style={bar.giftCellCoinImg} resizeMode="contain" />
                  <Text style={[bar.giftCellCoinText, isSel && bar.giftCellCoinTextSel]}>
                    {g.coins >= 1000 ? `${g.coins / 1000}K` : g.coins}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Bottom control bar ── */}
      <View style={bar.controlRow}>
        {/* Close */}
        <TouchableOpacity onPress={onClose} style={bar.closeBtn} hitSlop={8} activeOpacity={0.8}>
          <Text style={bar.closeBtnText}>✕</Text>
        </TouchableOpacity>

        {/* Target avatar scroll */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={bar.avatarScroll}
          contentContainerStyle={bar.avatarList}>
          {targets.map(t => {
            const sel = selectedTargetId === t.userId;
            return (
              <TouchableOpacity
                key={t.userId}
                onPress={() => onSelectTarget(t.userId)}
                activeOpacity={0.8}
                style={bar.avatarItem}>
                <View style={[bar.avatarWrap, sel && bar.avatarWrapSel]}>
                  <Avatar url={t.avatarUrl} name={t.name} size={36} />
                  {t.isHost && <View style={bar.hostDot} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Qty toggle button */}
        <TouchableOpacity
          onPress={() => setShowQtyPopup(v => !v)}
          style={bar.qtyToggleBtn}
          activeOpacity={0.8}>
          <Text style={bar.qtyToggleText}>x{qty}</Text>
          <Text style={bar.qtyToggleCaret}>{showQtyPopup ? '▼' : '▲'}</Text>
        </TouchableOpacity>

        {/* Send button */}
        <TouchableOpacity
          onPress={() => { if (selectedTargetId) onSend(qty); }}
          disabled={!selectedTargetId}
          style={[bar.sendBtn, !selectedTargetId && bar.sendBtnDisabled]}
          activeOpacity={0.85}>
          <Text style={bar.sendArrow}>➤</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const bar = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -3 },
    elevation: 30,
    zIndex: 30,
  },

  // Gift row
  giftRow: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0EDF8',
    paddingVertical: 6,
  },
  giftScroll: {
    paddingHorizontal: 12,
    gap: 4,
    alignItems: 'center',
  },
  giftCell: {
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'transparent',
    minWidth: 46,
    gap: 2,
  },
  giftCellSelected: {
    borderColor: '#E8944A',
    backgroundColor: '#FFF7EE',
  },
  giftCellImg: { width: 28, height: 28 },
  giftCellPlaceholder: { width: 28, height: 28, borderRadius: 6, backgroundColor: '#EDE8F7' },
  giftCellCoin: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  giftCellCoinImg: { width: 10, height: 10 },
  giftCellCoinText: { fontSize: 10, fontWeight: '700', color: '#60626A' },
  giftCellCoinTextSel: { color: '#E8944A' },

  // Control row
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 8,
  },

  // Close
  closeBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#F4F3F8',
    alignItems: 'center', justifyContent: 'center',
  },
  closeBtnText: { fontSize: 14, color: '#60626A', fontWeight: '700' },

  // Avatar scroll
  avatarScroll: { flex: 1 },
  avatarList: { gap: 8, alignItems: 'center', paddingHorizontal: 4 },
  avatarItem: {},
  avatarWrap: {
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  avatarWrapSel: { borderColor: '#7A0EED' },
  hostDot: {
    position: 'absolute', bottom: 0, right: 0,
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#7A0EED',
    borderWidth: 1.5, borderColor: '#fff',
  },

  // Qty toggle
  qtyToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1C1E22',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  qtyToggleText: { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
  qtyToggleCaret: { fontSize: 9, color: '#ABADB2' },

  // Send
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#E8944A',
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#DDDAE8' },
  sendArrow: { fontSize: 16, color: '#FFFFFF' },

  // Qty popup (dark panel above bar)
  qtyPopup: {
    position: 'absolute',
    bottom: 50,   // sits above the two rows (gift row ~52 + control row ~58)
    right: 55,
    backgroundColor: '#1C1E22',
    borderRadius: 12,
    overflow: 'hidden',
    minWidth: 90,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 40,
    zIndex: 40,
  },
  qtyManualRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  qtyManualBtn: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  qtyManualIcon: { fontSize: 13, color: '#FFFFFF', fontWeight: '600', lineHeight: 16 },
  qtyManualCount: { fontSize: 12, fontWeight: '800', color: '#FFFFFF', minWidth: 22, textAlign: 'center' },
  qtyPresetRow: {
    paddingVertical: 5,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  qtyPresetRowActive: { backgroundColor: 'rgba(255,255,255,0.08)' },
  qtyPresetText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.7)' },
  qtyPresetTextActive: { color: '#E8944A', fontWeight: '800' },
});
