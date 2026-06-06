import { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BASE_URL, MEDIA_BASE } from '@/services/api';
import type { GiftItem } from '../room-detail.data';

const COIN_IMG = require('@/assets/tabs/coin.png');

type GiftBarProps = {
  onGiftPress?: (gift: GiftItem) => void;
};

export function GiftBar({ onGiftPress }: GiftBarProps) {
  const [gifts, setGifts] = useState<GiftItem[]>([]);

  useEffect(() => {
    fetch(`${BASE_URL}/gifts/public`)
      .then(r => r.json())
      .then(json => { if (json.success) setGifts(json.data); })
      .catch(() => {});
  }, []);

  if (gifts.length === 0) return null;

  return (
    <View style={tray.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={tray.scrollContent}>
        {gifts.map((gift, index) => {
          const imgUri = gift.image_url
            ? `${MEDIA_BASE}/${gift.image_url.replace(/^\//, '')}`
            : null;

          return (
            <View key={gift.id} style={tray.cellWrap}>
              {index > 0 && <View style={tray.divider} />}
              <TouchableOpacity
                onPress={() => onGiftPress?.(gift)}
                activeOpacity={0.8}
                style={tray.item}>
                <View style={[tray.iconCircle, { backgroundColor: gift.bg_color }]}>
                  {imgUri ? (
                    <Image source={{ uri: imgUri }} style={tray.giftImg} resizeMode="contain" />
                  ) : (
                    <View style={tray.giftImgPlaceholder} />
                  )}
                </View>
                <Image source={COIN_IMG} style={tray.coinImg} resizeMode="contain" />
                <Text style={tray.coinText}>
                  {gift.coins >= 1000 ? `${gift.coins / 1000}K` : gift.coins}
                </Text>
              </TouchableOpacity>
            </View>
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
    paddingVertical: 6,
  },
  scrollContent: {
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  cellWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  divider: {
    width: 1,
    height: 28,
    backgroundColor: '#E8E4F5',
    marginHorizontal: 4,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  giftImg: {
    width: 22,
    height: 22,
  },
  giftImgPlaceholder: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#D0CAFE',
  },
  coinImg: {
    width: 13,
    height: 13,
  },
  coinText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1C1E22',
  },
});
