import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import {
  Animated,
  Image,
  Modal,
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
  targets: GiftTarget[];         // host first, then on-stage users
  selectedId: string | null;
  onSelect: (id: string) => void;
  onSend: () => void;
  onClose: () => void;
};

function resolveAvatar(url: string | null | undefined) {
  if (!url) return null;
  try { return `${MEDIA_BASE}${new URL(url).pathname}`; }
  catch { return `${MEDIA_BASE}/${url.replace(/^\//, '')}`; }
}

function Avatar({ url, name, size = 40 }: { url: string | null; name: string; size?: number }) {
  const uri = resolveAvatar(url);
  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }
  return (
    <View style={[s.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={s.avatarInitial}>{name[0]?.toUpperCase()}</Text>
    </View>
  );
}

export function GiftTargetPicker({ visible, gift, targets, selectedId, onSelect, onSend, onClose }: Props) {
  const slideY = useRef(new Animated.Value(200)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideY, { toValue: 0, useNativeDriver: true, tension: 70, friction: 12 }).start();
    } else {
      slideY.setValue(200);
    }
  }, [visible]);

  if (!gift) return null;

  const imgUri = gift.image_url
    ? `${MEDIA_BASE}/${gift.image_url.replace(/^\//, '')}`
    : null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose} />

      <Animated.View style={[s.sheet, { transform: [{ translateY: slideY }] }]}>
        {/* Handle */}
        <View style={s.handle} />

        {/* Gift preview row */}
        <View style={s.giftRow}>
          <View style={[s.giftCircle, { backgroundColor: gift.bg_color }]}>
            {imgUri
              ? <Image source={{ uri: imgUri }} style={s.giftImg} resizeMode="contain" />
              : <Ionicons name="gift-outline" size={20} color="#7A0EED" />
            }
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.giftName}>{gift.name}</Text>
            <View style={s.coinRow}>
              <Image source={COIN_IMG} style={s.coinImg} resizeMode="contain" />
              <Text style={s.coinAmt}>{gift.coins >= 1000 ? `${gift.coins / 1000}K` : gift.coins} coins</Text>
            </View>
          </View>
          <Text style={s.label}>Send to</Text>
        </View>

        {/* User list */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.userScroll} contentContainerStyle={s.userList}>
          {targets.map(t => {
            const selected = selectedId === t.userId;
            return (
              <TouchableOpacity
                key={t.userId}
                onPress={() => onSelect(t.userId)}
                activeOpacity={0.8}
                style={s.userItem}>
                <View style={[s.avatarWrap, selected && s.avatarWrapSelected]}>
                  <Avatar url={t.avatarUrl} name={t.name} size={46} />
                  {t.isHost && (
                    <View style={s.hostBadge}>
                      <Text style={s.hostBadgeText}>HOST</Text>
                    </View>
                  )}
                  {selected && (
                    <View style={s.checkBadge}>
                      <Ionicons name="checkmark" size={10} color="#fff" />
                    </View>
                  )}
                </View>
                <Text style={[s.userName, selected && s.userNameSelected]} numberOfLines={1}>
                  {t.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Send button */}
        <TouchableOpacity
          style={[s.sendBtn, !selectedId && s.sendBtnDisabled]}
          onPress={onSend}
          activeOpacity={0.85}
          disabled={!selectedId}>
          <Ionicons name="send" size={16} color="#fff" />
          <Text style={s.sendBtnText}>Send Gift</Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 16,
    paddingBottom: 32,
    paddingTop: 8,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: '#E0DDED',
    alignSelf: 'center', marginBottom: 14,
  },
  giftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F8F6FF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  giftCircle: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  giftImg: { width: 32, height: 32 },
  giftName: { fontSize: 14, fontWeight: '700', color: '#1C1E22' },
  coinRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  coinImg: { width: 12, height: 12 },
  coinAmt: { fontSize: 12, fontWeight: '600', color: '#E8944A' },
  label: { fontSize: 12, fontWeight: '700', color: '#7A0EED' },

  userScroll: { flexShrink: 0 },
  userList: { gap: 12, paddingHorizontal: 4, paddingBottom: 4 },
  userItem: { alignItems: 'center', gap: 6, width: 64 },
  avatarWrap: {
    position: 'relative',
    borderRadius: 27,
    borderWidth: 2.5,
    borderColor: 'transparent',
  },
  avatarWrapSelected: { borderColor: '#7A0EED' },
  avatarFallback: {
    backgroundColor: '#EDE8F7',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { fontSize: 18, fontWeight: '700', color: '#7A0EED' },
  hostBadge: {
    position: 'absolute', bottom: -4, left: '50%',
    transform: [{ translateX: -14 }],
    backgroundColor: '#7A0EED',
    borderRadius: 6, paddingHorizontal: 4, paddingVertical: 1,
  },
  hostBadgeText: { fontSize: 8, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },
  checkBadge: {
    position: 'absolute', top: -2, right: -2,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#7A0EED',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#fff',
  },
  userName: {
    fontSize: 10, fontWeight: '600', color: '#60626A',
    textAlign: 'center', maxWidth: 62,
  },
  userNameSelected: { color: '#7A0EED', fontWeight: '700' },

  sendBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginTop: 16,
    backgroundColor: '#7A0EED', borderRadius: 48, paddingVertical: 14,
  },
  sendBtnDisabled: { backgroundColor: '#DDDAE8' },
  sendBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
