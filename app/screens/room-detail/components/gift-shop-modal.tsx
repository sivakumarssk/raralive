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

const COIN_IMG = require('@/assets/tabs/coin.png');

const { height: SCREEN_H, width: SCREEN_W } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_H * 0.52;
const ITEM_W = (SCREEN_W - 2) / 4;

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
  onSendGift: (gift: ShopGift, targetName: string, qty: number) => void;
};

function resolveImg(url: string | null) {
  if (!url) return null;
  return `${MEDIA_BASE}/${url.replace(/^\//, '')}`;
}

export function GiftShopModal({ visible, onClose, seats, hostInfo, onSendGift }: Props) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;

  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCatId, setActiveCatId] = useState<string | null>(null);
  const [selectedGift, setSelectedGift] = useState<ShopGift | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [showUserPicker, setShowUserPicker] = useState(false);
  const [showQtyPicker, setShowQtyPicker] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>(hostInfo.userId);
  const [selectedUserName, setSelectedUserName] = useState<string>(hostInfo.name);

  // Targets: host first then on-stage seats
  const targets = [
    { userId: hostInfo.userId, name: hostInfo.name, avatarUrl: hostInfo.avatarUrl, isHost: true },
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

  // Reset host selection when modal opens
  useEffect(() => {
    if (visible) {
      setSelectedUserId(hostInfo.userId);
      setSelectedUserName(hostInfo.name);
      setSelectedGift(null);
      setQuantity(1);
    }
  }, [visible]);

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
    if (!selectedGift) return;
    close();
    onSendGift(selectedGift, selectedUserName, quantity);
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

        {/* Points bar */}
        {/* <View style={s.pointsBar}>
          <View style={s.pointsLeft}>
            <Text style={s.pointsText}>0/50 Pts</Text>
            <View style={s.pointsTrack}><View style={s.pointsFill} /></View>
          </View>
          <TouchableOpacity style={s.pointsRight}>
            <Image source={COIN_IMG} style={s.pointsCoin} resizeMode="contain" />
            <Text style={s.pointsBalance}>0</Text>
            <Ionicons name="chevron-forward" size={14} color="#7A0EED" />
          </TouchableOpacity>
        </View> */}

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
          {/* User picker */}
          <TouchableOpacity style={s.userPicker} activeOpacity={0.8} onPress={() => { setShowQtyPicker(false); setShowUserPicker(v => !v); }}>
            <Text style={s.userPickerText} numberOfLines={1}>{selectedUserName}</Text>
            <Ionicons name={showUserPicker ? 'chevron-down' : 'chevron-up'} size={14} color="#ABADB2" />
          </TouchableOpacity>

          {/* Qty picker */}
          <TouchableOpacity style={s.qtyPicker} activeOpacity={0.8} onPress={() => { setShowUserPicker(false); setShowQtyPicker(v => !v); }}>
            <Text style={s.qtyText}>x{quantity}</Text>
            <Ionicons name={showQtyPicker ? 'chevron-down' : 'chevron-up'} size={14} color="#ABADB2" />
          </TouchableOpacity>

          {/* Send */}
          <TouchableOpacity
            style={[s.sendBtn, !selectedGift && s.sendBtnDisabled]}
            activeOpacity={0.85}
            disabled={!selectedGift}
            onPress={handleSend}>
            <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* User picker dropdown */}
        {showUserPicker && (
          <View style={s.dropdown}>
            {targets.map(t => {
              const uri = resolveImg(t.avatarUrl);
              const isSelected = t.userId === selectedUserId;
              return (
                <TouchableOpacity
                  key={t.userId}
                  style={[s.dropdownItem, isSelected && s.dropdownItemSelected]}
                  onPress={() => { setSelectedUserId(t.userId); setSelectedUserName(t.name); setShowUserPicker(false); }}>
                  {uri
                    ? <Image source={{ uri }} style={s.dropdownAvatar} />
                    : <View style={[s.dropdownAvatar, s.dropdownAvatarFallback]}><Text style={s.dropdownInitial}>{t.name[0]}</Text></View>
                  }
                  <Text style={[s.dropdownName, isSelected && s.dropdownNameSelected]}>{t.name}</Text>
                  {t.isHost && <View style={s.hostChip}><Text style={s.hostChipText}>HOST</Text></View>}
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
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden',
  },
  handleArea: { alignItems: 'center', paddingTop: 8, paddingBottom: 6 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#DDDAE8' },

  pointsBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F7FC',
    paddingHorizontal: 16, paddingVertical: 8, gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#EBEBEB',
  },
  pointsLeft: { flex: 1, gap: 4 },
  pointsText: { fontSize: 11, color: '#ABADB2', fontWeight: '600' },
  pointsTrack: { height: 4, backgroundColor: '#EBEBEB', borderRadius: 2, overflow: 'hidden' },
  pointsFill: { width: '0%', height: '100%', backgroundColor: '#F59E0B', borderRadius: 2 },
  pointsRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pointsCoin: { width: 16, height: 16 },
  pointsBalance: { fontSize: 14, fontWeight: '700', color: '#1C1E22' },

  tabsScroll: { flexShrink: 0, maxHeight: 40 },
  tabsContent: { paddingHorizontal: 12, gap: 4 },
  tab: { paddingHorizontal: 14, paddingVertical: 8, position: 'relative', alignItems: 'center' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#ABADB2' },
  tabTextActive: { color: '#1C1E22', fontWeight: '700' },
  tabUnderline: { position: 'absolute', bottom: 0, left: 10, right: 10, height: 2, borderRadius: 1, backgroundColor: '#7A0EED' },

  grid: { flex: 1 },
  gridContent: { paddingBottom: 4 },
  giftCell: {
    aspectRatio: 0.85, alignItems: 'center', justifyContent: 'center',
    paddingBottom: 6, borderWidth: 1.5, borderColor: 'transparent', position: 'relative', gap: 4,
  },
  giftCellSelected: { borderColor: '#7A0EED', backgroundColor: 'rgba(122,14,237,0.07)', borderRadius: 10 },
  giftImgWrap: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  giftImg: { width: 42, height: 42 },
  giftEmoji: { fontSize: 28 },
  giftPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  giftCoin: { width: 11, height: 11 },
  giftPrice: { fontSize: 11, fontWeight: '700', color: '#E8944A' },

  bottomBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#EBEBEB', gap: 8,
  },
  userPicker: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#F4F5F8', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12,
  },
  userPickerText: { fontSize: 13, fontWeight: '600', color: '#1C1E22', flex: 1 },
  qtyPicker: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#F4F5F8', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12,
    minWidth: 72, justifyContent: 'center',
  },
  qtyText: { fontSize: 13, fontWeight: '700', color: '#1C1E22' },
  sendBtn: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#7A0EED', alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: '#DDDAE8' },

  // User dropdown
  dropdown: {
    position: 'absolute', left: 12, right: 12, bottom: 70,
    backgroundColor: '#FFFFFF', borderRadius: 14, elevation: 8,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: -2 },
    borderWidth: 1, borderColor: '#F0EDF8', maxHeight: 220, overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F4F4F4',
  },
  dropdownItemSelected: { backgroundColor: '#F4EEFF' },
  dropdownAvatar: { width: 34, height: 34, borderRadius: 17 },
  dropdownAvatarFallback: { backgroundColor: '#EDE8F7', alignItems: 'center', justifyContent: 'center' },
  dropdownInitial: { fontSize: 14, fontWeight: '700', color: '#7A0EED' },
  dropdownName: { fontSize: 13, fontWeight: '600', color: '#1C1E22', flex: 1 },
  dropdownNameSelected: { color: '#7A0EED' },
  hostChip: { backgroundColor: '#7A0EED', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  hostChipText: { fontSize: 8, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },

  // Qty dropdown
  qtyDropdown: {
    position: 'absolute', right: 60, bottom: 70,
    backgroundColor: '#FFFFFF', borderRadius: 12, elevation: 8,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: -2 },
    borderWidth: 1, borderColor: '#F0EDF8',
  },
  qtyList: { paddingHorizontal: 8, paddingVertical: 10, gap: 6 },
  qtyItem: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#F4F5F8', alignItems: 'center', justifyContent: 'center' },
  qtyItemSelected: { backgroundColor: '#7A0EED' },
  qtyItemText: { fontSize: 13, fontWeight: '700', color: '#1C1E22' },
  qtyItemTextSelected: { color: '#FFFFFF' },
});
