import { Ionicons } from '@expo/vector-icons';
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
import { useUserLevel } from '@/components/UserLevel';
import { authStore } from '@/store/auth-store';
import { onWalletUpdate } from '@/store/socket-store';
import { getLevelThreshold, getNextLevelThreshold } from '@/utils/userLevel';
import { RC } from '../room-ui';
import { avatarSource } from '@/utils/default-avatar';

const COIN_IMG = require('@/assets/tabs/coin.png');

const { height: SCREEN_H, width: SCREEN_W } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_H * 0.52;
const ITEM_W = (SCREEN_W - 2) / 4;

/** 1000 → "1,000" — the exact amount, not a rounded 1.0K */
function groupDigits(n: number): string {
  return String(Math.max(0, Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
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
  const { level, coinsSpent } = useUserLevel();
  const walletCoins = useWalletCoins(visible);

  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCatId, setActiveCatId] = useState<string | null>(null);
  const [selectedGift, setSelectedGift] = useState<ShopGift | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [showUserPicker, setShowUserPicker] = useState(false);
  const [showQtyPicker, setShowQtyPicker] = useState(false);
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
    setShowUserPicker(false);
    setShowQtyPicker(false);
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

  // THRESHOLDS is cumulative lifetime coins gifted, so the coins it takes to
  // go from this level to the next is the gap between the two thresholds —
  // e.g. level 2 is 250 → 650, so Level 2 → Level 3 needs 400 coins.
  const nextThreshold = getNextLevelThreshold(level);
  const coinsForNextLevel = nextThreshold != null ? Math.max(0, nextThreshold - getLevelThreshold(level)) : null;
  // How far into this level the user's gifting is (bar only — no counts)
  const levelProgress = coinsForNextLevel
    ? Math.min(Math.max((coinsSpent - getLevelThreshold(level)) / coinsForNextLevel, 0), 1)
    : 1;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={close} onShow={open}>
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={close} />

      <Animated.View style={[s.sheet, { height: SHEET_HEIGHT, paddingBottom: insets.bottom, transform: [{ translateY }] }]}>

        {/* Drag handle */}
        <View {...panResponder.panHandlers} style={s.handleArea}>
          <View style={s.handle} />
        </View>

        {/* ID Level (current → next, coins required) and wallet balance */}
        <View style={s.levelBox}>
          <View style={s.infoRow}>
            <View style={s.levelPath}>
              <Text style={s.levelText}>Level {level}</Text>
              {coinsForNextLevel != null && (
                <>
                  <Ionicons name="arrow-forward" size={13} color="rgba(255,255,255,0.55)" />
                  <Text style={s.levelText}>Level {level + 1}</Text>
                </>
              )}
            </View>
            {coinsForNextLevel != null ? (
              <View style={s.infoValue}>
                <Image source={COIN_IMG} style={s.infoCoin} resizeMode="contain" />
                <Text style={s.infoNumber} numberOfLines={1}>{groupDigits(coinsForNextLevel)}</Text>
                <Text style={s.infoLabel} numberOfLines={1}>coins required</Text>
              </View>
            ) : (
              <Text style={s.infoLabel}>Max level reached</Text>
            )}
          </View>

          {/* Progress towards the next level */}
          <View style={s.levelTrack}>
            <View style={[s.levelFill, { width: `${Math.round(levelProgress * 100)}%` }]} />
          </View>

          <View style={[s.infoRow, s.walletRow]}>
            <Text style={s.infoLabel}>Wallet coins</Text>
            <View style={s.infoValue}>
              <Image source={COIN_IMG} style={s.infoCoin} resizeMode="contain" />
              <Text style={s.infoNumber} numberOfLines={1}>
                {walletCoins != null ? groupDigits(walletCoins) : '—'}
              </Text>
            </View>
          </View>
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
                <View style={[s.giftImgWrap, { backgroundColor: item.bg_color }]}>
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

        {/* Bottom bar */}
        <View style={s.bottomBar}>
          {/* User picker — tap a row in the dropdown below to toggle it; several can be selected */}
          <TouchableOpacity style={s.userPicker} activeOpacity={0.8} onPress={() => { setShowQtyPicker(false); setShowUserPicker(v => !v); }}>
            <Text style={s.userPickerText} numberOfLines={1}>
              {selectedUserIds.length === 0
                ? 'Select recipient'
                : selectedUserIds.length === 1
                  ? (targets.find(t => t.userId === selectedUserIds[0])?.name ?? 'User')
                  : `${selectedUserIds.length} selected`}
            </Text>
            <Ionicons name={showUserPicker ? 'chevron-down' : 'chevron-up'} size={14} color="#ABADB2" />
          </TouchableOpacity>

          {/* Qty picker */}
          <TouchableOpacity style={s.qtyPicker} activeOpacity={0.8} onPress={() => { setShowUserPicker(false); setShowQtyPicker(v => !v); }}>
            <Text style={s.qtyText}>x{quantity}</Text>
            <Ionicons name={showQtyPicker ? 'chevron-down' : 'chevron-up'} size={14} color="#ABADB2" />
          </TouchableOpacity>

          {/* Send */}
          <TouchableOpacity
            style={[s.sendBtn, (!selectedGift || selectedUserIds.length === 0) && s.sendBtnDisabled]}
            activeOpacity={0.85}
            disabled={!selectedGift || selectedUserIds.length === 0}
            onPress={handleSend}>
            <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* User picker dropdown — tap toggles a recipient in/out of the selection */}
        {showUserPicker && (
          <View style={s.dropdown}>
            {targets.map(t => {
              const uri = resolveImg(t.avatarUrl);
              const isSelected = selectedUserIds.includes(t.userId);
              return (
                <TouchableOpacity
                  key={t.userId}
                  style={[s.dropdownItem, isSelected && s.dropdownItemSelected]}
                  onPress={() => {
                    setSelectedUserIds(prev =>
                      prev.includes(t.userId) ? prev.filter(id => id !== t.userId) : [...prev, t.userId]
                    );
                  }}>
                  <Image source={avatarSource(uri)} style={s.dropdownAvatar} />
                  <Text style={[s.dropdownName, isSelected && s.dropdownNameSelected]}>{t.name}</Text>
                  {t.isHost && <View style={s.hostChip}><Text style={s.hostChipText}>Host</Text></View>}
                  {isSelected && <Ionicons name="checkmark" size={16} color="#7A0EED" style={{ marginLeft: 'auto' }} />}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Qty picker dropdown */}
        {showQtyPicker && (
          <View style={s.qtyDropdown}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.qtyList}>
              {[1,2,3,4,5,6,7,8,9,10].map(n => (
                <TouchableOpacity
                  key={n}
                  style={[s.qtyItem, quantity === n && s.qtyItemSelected]}
                  onPress={() => { setQuantity(n); setShowQtyPicker(false); }}>
                  <Text style={[s.qtyItemText, quantity === n && s.qtyItemTextSelected]}>x{n}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#151718', borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden',
  },
  handleArea: { alignItems: 'center', paddingTop: 8, paddingBottom: 6 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)' },

  // ID Level + wallet: two aligned rows — label/levels left, coin amount right
  levelBox: {
    backgroundColor: '#1E2022',
    paddingHorizontal: 14, paddingVertical: 10,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, minHeight: 20 },
  // Small gap between the ID Level row and the wallet line
  levelTrack: { height: 6, marginTop: 8, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 3, overflow: 'hidden' },
  levelFill: { height: '100%', backgroundColor: '#A855F7', borderRadius: 3 },
  walletRow: { marginTop: 8 },
  levelPath: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
  levelText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  infoValue: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1, justifyContent: 'flex-end' },
  infoCoin: { width: 15, height: 15 },
  infoNumber: { fontSize: 13, fontWeight: '800', color: RC.numberOnDark },
  infoLabel: { fontSize: 12, fontWeight: '500', color: 'rgba(255,255,255,0.6)', flexShrink: 1 },

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
    paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#1E2022',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.08)', gap: 8,
  },
  userPicker: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#26282B', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12,
  },
  userPickerText: { fontSize: 13, fontWeight: '600', color: '#FFFFFF', flex: 1 },
  qtyPicker: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#26282B', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12,
    minWidth: 72, justifyContent: 'center',
  },
  qtyText: { fontSize: 13, fontWeight: '700', color: RC.numberOnDark },
  sendBtn: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#7A0EED', alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.15)' },

  // User dropdown
  dropdown: {
    position: 'absolute', left: 12, right: 12, bottom: 70,
    backgroundColor: '#26282B', borderRadius: 14, elevation: 8,
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: -2 },
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', maxHeight: 220, overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  dropdownItemSelected: { backgroundColor: 'rgba(168,85,247,0.15)' },
  dropdownAvatar: { width: 34, height: 34, borderRadius: 17 },
  dropdownAvatarFallback: { backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  dropdownInitial: { fontSize: 14, fontWeight: '700', color: '#A855F7' },
  dropdownName: { fontSize: 13, fontWeight: '600', color: '#FFFFFF', flex: 1 },
  dropdownNameSelected: { color: '#A855F7' },
  hostChip: { backgroundColor: '#7A0EED', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  hostChipText: { fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },

  // Qty dropdown
  qtyDropdown: {
    position: 'absolute', right: 60, bottom: 70,
    backgroundColor: '#26282B', borderRadius: 12, elevation: 8,
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: -2 },
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  qtyList: { paddingHorizontal: 8, paddingVertical: 10, gap: 6 },
  qtyItem: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#33353A', alignItems: 'center', justifyContent: 'center' },
  qtyItemSelected: { backgroundColor: '#7A0EED' },
  qtyItemText: { fontSize: 13, fontWeight: '700', color: RC.numberOnDark },
  qtyItemTextSelected: { color: RC.numberOnDark },
});
