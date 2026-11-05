import { Ionicons } from '@expo/vector-icons';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { MEDIA_BASE } from '@/services/api';
import type { ChatMessage } from '../room-detail.data';
import { RC, RT } from '../room-ui';
import { avatarSource } from '@/utils/default-avatar';

// Pinned message at the top of the room chat. Anyone can tap it to jump to the
// message; only the host sees the × to unpin.
export function PinnedMessageBar({ message, canUnpin, onPress, onUnpin }: {
  message: ChatMessage;
  canUnpin: boolean;
  onPress: () => void;
  onUnpin: () => void;
}) {
  const user = message.user;
  const isGift = message.type === 'gift';
  const giftImg = isGift && message.giftImageUrl
    ? `${MEDIA_BASE}/${message.giftImageUrl.replace(/^\//, '')}`
    : null;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={s.bar}>
      <View style={s.avatarWrap}>
        <Image source={avatarSource(user?.avatarUri)} style={s.avatar} />
        <View style={s.pinBadge}>
          <Ionicons name="pin" size={9} color="#FFFFFF" />
        </View>
      </View>

      <Text style={s.text} numberOfLines={2} ellipsizeMode="tail">
        <Text style={s.name}>{user?.name ?? 'Message'}: </Text>
        {isGift
          ? `Sent ${message.giftName ?? 'a gift'}${message.giftTo ? ` to ${message.giftTo}` : ''}`
          : message.text}
      </Text>

      {isGift && (
        <View style={s.gift}>
          {giftImg
            ? <Image source={{ uri: giftImg }} style={s.giftImg} resizeMode="contain" />
            : <Text style={s.giftEmoji}>🎁</Text>}
          <Text style={s.giftQty}>×{message.giftQty ?? 1}</Text>
        </View>
      )}

      {canUnpin && (
        <TouchableOpacity onPress={onUnpin} hitSlop={10} style={s.close}>
          <Ionicons name="close" size={14} color="#60626A" />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 12, marginTop: 8, marginBottom: 2,
    paddingHorizontal: 10, paddingVertical: 8,
    borderRadius: 12, backgroundColor: '#F4EEFF',
    borderLeftWidth: 3, borderLeftColor: '#7A0EED',
  },
  avatarWrap: { width: 30, height: 30 },
  avatar: { width: 30, height: 30, borderRadius: 15 },
  avatarFallback: { backgroundColor: '#EDE8F7', alignItems: 'center', justifyContent: 'center' },
  initial: { fontSize: RT.secondary, fontWeight: '700', color: '#7A0EED' },
  pinBadge: {
    position: 'absolute', right: -3, bottom: -3,
    width: 15, height: 15, borderRadius: 8,
    backgroundColor: '#7A0EED', borderWidth: 1.5, borderColor: '#F4EEFF',
    alignItems: 'center', justifyContent: 'center',
  },
  text: { flex: 1, fontSize: RT.secondary + 1, lineHeight: 18, color: '#1C1E22' },
  name: { fontWeight: '700', color: '#5A0BB0' },
  gift: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  giftImg: { width: 24, height: 24 },
  giftEmoji: { fontSize: 18 },
  giftQty: { fontSize: RT.secondary + 1, fontWeight: '800', fontStyle: 'italic', color: RC.number },
  close: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
});
