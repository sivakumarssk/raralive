import { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { BASE_URL, MEDIA_BASE } from '@/services/api';

const COIN_IMG = require('@/assets/tabs/coin.png');

export type CallGiftItem = {
  id: string;
  name: string;
  image_url: string | null;
  coins: number;
};

function resolveImg(url: string | null | undefined) {
  if (!url) return null;
  try { return `${MEDIA_BASE}${new URL(url).pathname}`; }
  catch { return `${MEDIA_BASE}/${url.replace(/^\//, '')}`; }
}

type Props = {
  onSendGift: (gift: CallGiftItem) => void;
};

// Same flat horizontal strip as the room's GiftBar — a plain row of gift
// icons with a coin badge, tap to send. No title/close chrome; it just sits
// directly above the call controls like the room version sits above the
// room's chat input.
export function CallGiftBar({ onSendGift }: Props) {
  const [gifts, setGifts] = useState<CallGiftItem[]>([]);

  useEffect(() => {
    fetch(`${BASE_URL}/gifts/public`)
      .then(r => r.json())
      .then(json => { if (json.success) setGifts(json.data); })
      .catch(() => {});
  }, []);

  if (gifts.length === 0) return null;

  return (
    <View style={s.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.scrollContent}>
        {gifts.map(gift => {
          const imgUri = resolveImg(gift.image_url);
          return (
            <TouchableOpacity
              key={gift.id}
              onPress={() => onSendGift(gift)}
              activeOpacity={0.8}
              style={s.cell}>
              {imgUri
                ? <Image source={{ uri: imgUri }} style={s.giftImg} resizeMode="contain" />
                : <View style={s.placeholder} />}
              <View style={s.coinRow}>
                <Image source={COIN_IMG} style={s.coinImg} resizeMode="contain" />
                <Text style={s.coinText}>{gift.coins >= 1000 ? `${gift.coins / 1000}K` : gift.coins}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    paddingVertical: 6,
  },
  scrollContent: {
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
  placeholder: { width: 26, height: 26, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.12)' },
  coinRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  coinImg: { width: 11, height: 11 },
  coinText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
});
