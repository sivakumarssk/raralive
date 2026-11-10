import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  Image,
  Modal,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BASE_URL, MEDIA_BASE } from '@/services/api';
import type { SeatSlot } from '@/hooks/useRoomSocket';
import { authStore } from '@/store/auth-store';
import { onWalletUpdate } from '@/store/socket-store';
import { RC } from '../room-ui';
import Svg, { Path } from 'react-native-svg';
import { avatarSource } from '@/utils/default-avatar';

const COIN_IMG = require('@/assets/tabs/coin.png');

// The whole gift box is black; the top bar's coin side matches it
const GIFT_BOX_BG = '#000000';
const LEVEL_BAR_H = 48;
const QUANTITIES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const CURVE_LEAN = 22; // how far the recipients panel's curved edge runs sideways
const CURVE_BEND = 13; // how round that S-curve is

/**
 * The recipients panel: square on the left; its right edge starts further out
 * at the top and S-curves back in to the bottom.
 */
function levelPanelPath(end: number, h: number) {
  const top = end + CURVE_LEAN;
  return `M 0 0 L ${top} 0 C ${top - CURVE_BEND} 0 ${end + CURVE_BEND} ${h} ${end} ${h} L 0 ${h} Z`;
}

const { height: SCREEN_H, width: SCREEN_W } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_H * 0.52;
const ITEM_W = (SCREEN_W - 2) / 4;

/** 1000 → "1,000" — the exact amount, not a rounded 1.0K */
/** Wallet coins in short Indian units: 950 · 1.2K · 3.5L · 2Cr. */
function compactCoins(n: number): string {
  const v = Math.max(0, Math.round(n));
  const short = (x: number, unit: string) => `${x >= 100 ? Math.floor(x) : Math.floor(x * 10) / 10}${unit}`.replace('.0', '');
  if (v >= 1_00_00_000) return short(v / 1_00_00_000, 'Cr');
  if (v >= 1_00_000) return short(v / 1_00_000, 'L');
  if (v >= 1_000) return short(v / 1_000, 'K');
  return String(v);
}

/**
 * The user's wallet coins: loaded when the Gift Box opens, then kept current
 * by the room socket's wallet_update (sent after every gift).
 */
function useWalletCoins(visible: boolean): number | null {
  const [coins, setCoins] = useState<number | null>(null);
  useEffect(() => {
    if (!visible) return;
    const token = authStore.getToken();
    if (!token) return;
    let cancelled = false;
    fetch(`${BASE_URL}/wallet/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(j => { if (!cancelled && j.success) setCoins(Number(j.data?.coins) || 0); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [visible]);
  useEffect(() => {
    const unsub = onWalletUpdate(c => setCoins(c));
    return () => { unsub(); };
  }, []);
  return coins;
}

type ShopGift = {
  id: string;
  name: string;
  image_url: string | null;
  coins: number;
  /** Still sent in the gift message for older app versions; no longer drawn. */
  bg_color: string;
};

type Category = {
  id: string | null;
  name: string;
  gifts: ShopGift[];
};

type Props = {
  visible: boolean;
  onClose: () => void;
  seats: SeatSlot[];
  hostInfo: { userId: string; name: string; avatarUrl: string | null };
  isHostOnline?: boolean;
  onSendGift: (gift: ShopGift, qty: number, targets: { userId: string; name: string }[]) => void;
  initialTargetUserId?: string;
  initialTargetName?: string;
};

function resolveImg(url: string | null) {
  if (!url) return null;
  return `${MEDIA_BASE}/${url.replace(/^\//, '')}`;
}

export function GiftShopModal({
  visible, onClose, seats, hostInfo, isHostOnline = true, onSendGift,
  initialTargetUserId, initialTargetName,
}: Props) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const router = useRouter();
  const [barWidth, setBarWidth] = useState(0);
  const [levelPanelEnd, setLevelPanelEnd] = useState(0);
  const walletCoins = useWalletCoins(visible);

  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCatId, setActiveCatId] = useState<string | null>(null);
  const [selectedGift, setSelectedGift] = useState<ShopGift | null>(null);
  const [quantity, setQuantity] = useState(1);
  // Multiple recipients can be selected — sending fires one gift per target.
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([hostInfo.userId]);

  // Targets: host first (only if online) then on-stage seats
  const targets = [
    ...(isHostOnline ? [{ userId: hostInfo.userId, name: hostInfo.name, avatarUrl: hostInfo.avatarUrl, isHost: true }] : []),
    ...seats
      .filter(s => s.slotIndex !== 0 && s.userId !== hostInfo.userId)
      .map(s => ({ userId: s.userId, name: s.userName, avatarUrl: s.avatarUrl, isHost: false })),
  ];

  useEffect(() => {
    if (!visible) return;
    fetch(`${BASE_URL}/shop-gifts/public`)
      .then(r => r.json())
      .then(json => {
        if (json.success && json.data.length) {
          setCategories(json.data);
          setActiveCatId(json.data[0].id);
        }
      })
      .catch(() => {});
  }, [visible]);

  // Reset selection when modal opens — prefer an explicit preselected target
  // (e.g. tapped from a user's profile sheet), else pick the first available target
  useEffect(() => {
    if (visible) {
      if (initialTargetUserId) {
        setSelectedUserIds([initialTargetUserId]);
      } else {
        const firstTargetId = isHostOnline
          ? hostInfo.userId
          : (seats.find(s => s.slotIndex !== 0 && s.userId !== hostInfo.userId)?.userId ?? hostInfo.userId);
        setSelectedUserIds([firstTargetId]);
      }
      setSelectedGift(null);
      setQuantity(1);
    }
  }, [visible, initialTargetUserId]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 8,
      onPanResponderMove: (_, g) => { if (g.dy > 0) translateY.setValue(g.dy); },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 100) close();
        else Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
      },
    })
  ).current;

  function open() {
    translateY.setValue(SHEET_HEIGHT);
    Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }).start();
  }

  function close() {
    Animated.timing(translateY, { toValue: SHEET_HEIGHT, duration: 220, useNativeDriver: true }).start(onClose);
  }

  function handleSend() {
    if (!selectedGift || selectedUserIds.length === 0) return;
    const chosenTargets = selectedUserIds
      .map(id => targets.find(t => t.userId === id))
      .filter((t): t is (typeof targets)[number] => !!t)
      .map(t => ({ userId: t.userId, name: t.name }));
    if (chosenTargets.length === 0) return;
    close();
    onSendGift(selectedGift, quantity, chosenTargets);
  }

  const activeGifts = categories.find(c => c.id === activeCatId)?.gifts ?? [];

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={close} onShow={open}>
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={close} />

      <Animated.View style={[s.sheet, { height: SHEET_HEIGHT, paddingBottom: insets.bottom, transform: [{ translateY }] }]}>

        {/* Drag handle */}
        <View {...panResponder.panHandlers} style={s.handleArea}>
          <View style={s.handle} />
        </View>

        {/* One bar: a lighter recipients panel ending in a curve, wallet coins on
            the darker part → tap opens the Wallet */}
        <View style={s.levelBar} onLayout={e => setBarWidth(e.nativeEvent.layout.width)}>
          {barWidth > 0 && levelPanelEnd > 0 && (
            <Svg width={barWidth} height={LEVEL_BAR_H} style={StyleSheet.absoluteFill}>
              <Path d={levelPanelPath(levelPanelEnd, LEVEL_BAR_H)} fill="#2B2724" />
            </Svg>
          )}
          {/* Who gets the gift: host + people on stage. Tap to select one or more;
              the chosen gift × quantity goes to each of them. */}
          <View
            style={s.levelSide}
            onLayout={e => setLevelPanelEnd(e.nativeEvent.layout.x + e.nativeEvent.layout.width)}>
            {targets.length === 0 ? (
              <Text style={s.noTargets}>No one on stage to gift</Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.peopleList}>
                {targets.map(t => {
                  const selected = selectedUserIds.includes(t.userId);
                  return (
                    <TouchableOpacity
                      key={t.userId}
                      activeOpacity={0.8}
                      onPress={() => setSelectedUserIds(prev =>
                        prev.includes(t.userId) ? prev.filter(id => id !== t.userId) : [...prev, t.userId])}
                      accessibilityLabel={`${selected ? 'Deselect' : 'Select'} ${t.name}`}
                      style={[s.personRing, selected && s.personRingSelected]}>
                      <Image source={avatarSource(resolveImg(t.avatarUrl))} style={s.personAvatar} />
                      {t.isHost && <View style={s.hostTag}><Text style={s.hostTagText}>Host</Text></View>}
                      {selected && (
                        <View style={s.personCheck}>
                          <Ionicons name="checkmark" size={9} color="#FFFFFF" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>

          {/* Room for the curve between the two halves */}
          <View style={{ width: CURVE_LEAN }} />

          <TouchableOpacity
            style={s.walletSide}
            activeOpacity={0.75}
            onPress={() => { close(); router.push('/wallet' as never); }}
            accessibilityLabel="Wallet coins, open wallet">
            <Image source={COIN_IMG} style={s.walletCoin} resizeMode="contain" />
            <Text style={s.walletCoins} numberOfLines={1}>
              {walletCoins != null ? compactCoins(walletCoins) : '—'}
            </Text>
            <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>
        </View>

        {/* Category tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabsScroll} contentContainerStyle={s.tabsContent}>
          {categories.map(cat => (
            <TouchableOpacity key={String(cat.id)} onPress={() => setActiveCatId(cat.id)} style={s.tab} activeOpacity={0.75}>
              <Text style={[s.tabText, activeCatId === cat.id && s.tabTextActive]}>{cat.name}</Text>
              {activeCatId === cat.id && <View style={s.tabUnderline} />}
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Gift grid */}
        <FlatList
          data={activeGifts}
          keyExtractor={g => g.id}
          numColumns={4}
          showsVerticalScrollIndicator={false}
          style={s.grid}
          contentContainerStyle={s.gridContent}
          renderItem={({ item }) => {
            const isSelected = selectedGift?.id === item.id;
            const imgUri = resolveImg(item.image_url);
            return (
              <TouchableOpacity
                onPress={() => setSelectedGift(item)}
                activeOpacity={0.8}
                style={[s.giftCell, { width: ITEM_W }, isSelected && s.giftCellSelected]}>
                <View style={s.giftImgWrap}>
                  {imgUri
                    ? <Image source={{ uri: imgUri }} style={s.giftImg} resizeMode="contain" />
                    : <Text style={s.giftEmoji}>🎁</Text>
                  }
                </View>
                <View style={s.giftPriceRow}>
                  <Image source={COIN_IMG} style={s.giftCoin} resizeMode="contain" />
                  <Text style={s.giftPrice}>
                    {item.coins >= 1000 ? `${(item.coins / 1000).toFixed(1)}K`.replace('.0K', 'K') : item.coins}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />

        {/* Bottom bar: quantity chips side by side (scroll for more) + Send.
            Recipients: whoever the box was opened for, else the host. */}
        <View style={s.bottomBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.qtyScroll} contentContainerStyle={s.qtyList}>
            {QUANTITIES.map(n => (
              <TouchableOpacity
                key={n}
                activeOpacity={0.8}
                style={[s.qtyItem, quantity === n && s.qtyItemSelected]}
                onPress={() => setQuantity(n)}>
                <Text style={[s.qtyItemText, quantity === n && s.qtyItemTextSelected]}>{n}x</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity
            style={[s.sendBtn, (!selectedGift || selectedUserIds.length === 0) && s.sendBtnDisabled]}
            activeOpacity={0.85}
            disabled={!selectedGift || selectedUserIds.length === 0}
            onPress={handleSend}>
            <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: GIFT_BOX_BG, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden',
  },
  handleArea: { alignItems: 'center', paddingTop: 8, paddingBottom: 6 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)' },

  // Recipients (left) and wallet coins (right) in one bar
  levelBar: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 12, marginBottom: 6, paddingLeft: 10, height: LEVEL_BAR_H,
    backgroundColor: GIFT_BOX_BG, borderRadius: 12, overflow: 'hidden',
  },
  levelSide: { flex: 1, minWidth: 0, justifyContent: 'center' },
  peopleList: { alignItems: 'center', gap: 8, paddingRight: 4 },
  personRing: {
    width: 38, height: 38, borderRadius: 19, padding: 2,
    borderWidth: 2, borderColor: 'transparent',
  },
  personRingSelected: { borderColor: '#A855F7' },
  personAvatar: { width: '100%', height: '100%', borderRadius: 15 },
  hostTag: {
    position: 'absolute', bottom: -4, alignSelf: 'center',
    backgroundColor: '#F5B83D', borderRadius: 5, paddingHorizontal: 3,
  },
  hostTagText: { fontSize: 7, fontWeight: '800', color: '#1C1E22' },
  personCheck: {
    position: 'absolute', top: -3, right: -3, width: 14, height: 14, borderRadius: 7,
    backgroundColor: '#A855F7', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#2B2724',
  },
  noTargets: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.6)' },
  walletSide: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: '100%', minWidth: 96, paddingLeft: 10, paddingRight: 14 },
  walletCoin: { width: 20, height: 20 },
  walletCoins: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },

  tabsScroll: { flexShrink: 0, maxHeight: 40 },
  tabsContent: { paddingHorizontal: 12, gap: 4 },
  tab: { paddingHorizontal: 14, paddingVertical: 8, position: 'relative', alignItems: 'center' },
  tabText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.45)' },
  tabTextActive: { color: '#FFFFFF', fontWeight: '700' },
  tabUnderline: { position: 'absolute', bottom: 0, left: 10, right: 10, height: 2, borderRadius: 1, backgroundColor: '#A855F7' },

  grid: { flex: 1 },
  gridContent: { paddingBottom: 4 },
  giftCell: {
    aspectRatio: 0.85, alignItems: 'center', justifyContent: 'center',
    paddingBottom: 6, borderWidth: 1.5, borderColor: 'transparent', position: 'relative', gap: 4,
  },
  giftCellSelected: { borderColor: '#A855F7', backgroundColor: 'rgba(168,85,247,0.15)', borderRadius: 10 },
  giftImgWrap: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  giftImg: { width: 42, height: 42 },
  giftEmoji: { fontSize: 22 },
  giftPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  giftCoin: { width: 11, height: 11 },
  giftPrice: { fontSize: 11, fontWeight: '700', color: RC.numberOnDark },

  bottomBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10, backgroundColor: GIFT_BOX_BG,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.14)', gap: 10,
  },
  qtyScroll: { flex: 1 },
  qtyList: { gap: 8, alignItems: 'center' },
  qtyItem: {
    minWidth: 44, height: 36, paddingHorizontal: 10, borderRadius: 10,
    backgroundColor: '#1C1D20', alignItems: 'center', justifyContent: 'center',
  },
  qtyItemSelected: { backgroundColor: '#7A0EED' },
  qtyItemText: { fontSize: 13, fontWeight: '700', color: RC.numberOnDark },
  qtyItemTextSelected: { color: '#FFFFFF' },
  sendBtn: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#7A0EED', alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.15)' },
});
