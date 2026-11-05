import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Dimensions, FlatList, Linking, StyleSheet, TouchableOpacity, View } from 'react-native';

import { BASE_URL, MEDIA_BASE } from '@/services/api';

export type Banner = { id: string; title: string | null; image_url: string; link_url: string | null };

export type BannerPlacement = 'home' | 'chatroom' | 'live';

/** Admin-uploaded banners for one screen (Admin → Banners, one tab per screen). */
export async function fetchBanners(placement: BannerPlacement): Promise<Banner[]> {
  try {
    const r = await fetch(`${BASE_URL}/banners/public?placement=${placement}`);
    const j = await r.json();
    return j.success ? j.data : [];
  } catch {
    return [];
  }
}

const CARD_W = Dimensions.get('window').width - 32;
// Same 16:7 shape as the admin upload preview, so banners aren't stretched
const CARD_H = Math.round(CARD_W * 7 / 16);

export function BannerCarousel({ banners }: { banners: Banner[] }) {
  const router = useRouter();
  const bannerRef = useRef<FlatList>(null);
  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);

  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(() => {
      indexRef.current = (indexRef.current + 1) % banners.length;
      setIndex(indexRef.current);
      bannerRef.current?.scrollToIndex({ index: indexRef.current, animated: true });
    }, 4000);
    return () => clearInterval(timer);
  }, [banners.length]);

  if (banners.length === 0) return null;

  // Link: "https://…" opens outside the app, "/create" etc. opens that app screen
  const openLink = (link: string | null) => {
    if (!link) return;
    if (link.startsWith('/')) router.push(link as any);
    else Linking.openURL(link).catch(() => {});
  };

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
        getItemLayout={(_, i) => ({ length: CARD_W, offset: CARD_W * i, index: i })}
        onMomentumScrollEnd={e => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / CARD_W);
          indexRef.current = idx;
          setIndex(idx);
        }}
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={item.link_url ? 0.9 : 1}
            disabled={!item.link_url}
            onPress={() => openLink(item.link_url)}
            style={s.bannerCard}>
            <ExpoImage
              source={{ uri: `${MEDIA_BASE}/${item.image_url.replace(/^\//, '')}` }}
              style={s.bannerImg}
              contentFit="cover"
            />
          </TouchableOpacity>
        )}
      />
      {banners.length > 1 && (
        <View style={s.bannerDots}>
          {banners.map((b, i) => (
            <View key={b.id} style={[s.bannerDot, i === index && s.bannerDotActive]} />
          ))}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  bannerWrap: { paddingHorizontal: 16, marginBottom: 12 },
  bannerCard: {
    width: CARD_W,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#F3EEFF',
  },
  bannerImg: { width: CARD_W, height: CARD_H },
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
