import { useEffect, useRef } from 'react';
import { Dimensions, FlatList, Image, StyleSheet, Text, View } from 'react-native';

import { MEDIA_BASE } from '@/services/api';
import type { CallChatRow } from '@/store/friend-zone-call-chat-store';

const COIN_IMG = require('@/assets/tabs/coin.png');
const { width: SCREEN_W } = Dimensions.get('window');

function resolveImg(url: string | null | undefined) {
  if (!url) return null;
  try { return `${MEDIA_BASE}${new URL(url).pathname}`; }
  catch { return `${MEDIA_BASE}/${url.replace(/^\//, '')}`; }
}

type Props = {
  rows: CallChatRow[];
  selfName: string;
  selfAvatarUri?: string;
  peerName: string;
  peerAvatarUri?: string;
  maxHeight: number;
};

function Avatar({ uri, name }: { uri?: string; name: string }) {
  return uri ? (
    <Image source={{ uri }} style={s.avatar} />
  ) : (
    <View style={[s.avatar, s.avatarFallback]}>
      <Text style={s.avatarInitial}>{name[0]?.toUpperCase()}</Text>
    </View>
  );
}

// Instagram Live style: no bubble box, no background panel — each row is a
// small round profile icon on the left with the message text beside it,
// sitting directly over the video with just a text shadow for legibility.
function Row({ row, selfName, selfAvatarUri, peerName, peerAvatarUri }: {
  row: CallChatRow; selfName: string; selfAvatarUri?: string; peerName: string; peerAvatarUri?: string;
}) {
  const name = row.isSelf ? selfName : peerName;
  const avatarUri = row.isSelf ? selfAvatarUri : peerAvatarUri;

  if (row.kind === 'gift') {
    const imgUri = resolveImg(row.giftImageUrl);
    return (
      <View style={s.row}>
        <Avatar uri={avatarUri} name={name} />
        <View style={s.bodyWrap}>
          {imgUri ? <Image source={{ uri: imgUri }} style={s.giftImg} resizeMode="contain" /> : null}
          <Text style={s.giftText} numberOfLines={2}>
            {row.isSelf ? 'You' : 'Sent you'} {row.qty > 1 ? `${row.qty}x ` : ''}{row.giftName}
          </Text>
          <Image source={COIN_IMG} style={s.giftCoinImg} resizeMode="contain" />
          <Text style={s.giftCoinText}>{row.coins * row.qty}</Text>
        </View>
      </View>
    );
  }
  return (
    <View style={s.row}>
      <Avatar uri={avatarUri} name={name} />
      <View style={s.bodyWrap}>
        <Text style={s.messageText} numberOfLines={3}>
          <Text style={s.senderLabel}>{name}  </Text>
          {row.text}
        </Text>
      </View>
    </View>
  );
}

export function CallChatOverlay({ rows, selfName, selfAvatarUri, peerName, peerAvatarUri, maxHeight }: Props) {
  const listRef = useRef<FlatList<CallChatRow>>(null);

  useEffect(() => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, [rows.length]);

  return (
    <FlatList
      ref={listRef}
      data={rows}
      keyExtractor={item => item.id}
      renderItem={({ item }) => (
        <Row row={item} selfName={selfName} selfAvatarUri={selfAvatarUri} peerName={peerName} peerAvatarUri={peerAvatarUri} />
      )}
      style={[s.list, { maxHeight }]}
      contentContainerStyle={s.listContent}
      onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
      showsVerticalScrollIndicator={false}
    />
  );
}

const s = StyleSheet.create({
  list: { width: SCREEN_W * 0.72 },
  listContent: { paddingVertical: 4, gap: 8, justifyContent: 'flex-end' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    paddingRight: 8,
    gap: 8,
  },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  avatarFallback: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  bodyWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  senderLabel: {
    fontWeight: '800',
    color: 'rgba(255,255,255,0.85)',
  },
  messageText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowRadius: 4,
    textShadowOffset: { width: 0, height: 1 },
  },
  giftImg: { width: 20, height: 20, marginRight: 4 },
  giftText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFD27A',
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowRadius: 4,
    textShadowOffset: { width: 0, height: 1 },
  },
  giftCoinImg: { width: 11, height: 11, marginLeft: 6, marginRight: 2 },
  giftCoinText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFD27A',
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowRadius: 4,
    textShadowOffset: { width: 0, height: 1 },
  },
});
