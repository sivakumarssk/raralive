import { Image as ExpoImage } from 'expo-image';
import { useEffect, useRef } from 'react';
import { Dimensions, FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';

import { MEDIA_BASE } from '@/services/api';

export type Banner = { id: string; title: string | null; image_url: string; link_url: string | null };

export function BannerCarousel({ banners }: { banners: Banner[] }) {
  const bannerRef = useRef<FlatList>(null);
  const bannerIndex = useRef(0);

  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(() => {
      bannerIndex.current = (bannerIndex.current + 1) % banners.length;
      bannerRef.current?.scrollToIndex({ index: bannerIndex.current, animated: true });
    }, 4000);
    return () => clearInterval(timer);
  }, [banners.length]);

  if (banners.length === 0) return null;

  return (
    <View style={s.bannerWrap}>
      <FlatList
        ref={bannerRef}
        data={banners}
        keyExtractor={b => b.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScrollToIndexFailed={() => {}}
        onMomentumScrollEnd={e => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / (Dimensions.get('window').width - 32));
          bannerIndex.current = idx;
        }}
        renderItem={({ item }) => (
          <TouchableOpacity activeOpacity={0.9} style={s.bannerCard}>
            <ExpoImage
              source={{ uri: `${MEDIA_BASE}/${item.image_url.replace(/^\//, '')}` }}
              style={s.bannerImg}
              contentFit="fill"
            />
          </TouchableOpacity>
        )}
      />
      {banners.length > 1 && (
        <View style={s.bannerDots}>
          {banners.map((b, i) => (
            <View key={b.id} style={[s.bannerDot, i === bannerIndex.current && s.bannerDotActive]} />
          ))}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  bannerWrap: { paddingHorizontal: 16, marginBottom: 12 },
  bannerCard: {
    width: Dimensions.get('window').width - 32,
    borderRadius: 16,
    overflow: 'hidden',
  },
  bannerImg: { width: Dimensions.get('window').width - 32, height: 160 },
  bannerDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
  },
  bannerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D8D3EC',
  },
  bannerDotActive: { backgroundColor: '#7A0EED', width: 18 },
});
