import { useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';

const AUTO_SCROLL_MS = 3500;

type PhotoCarouselProps = {
  photos: string[];
  width: number;
  height: number;
  autoScroll?: boolean;
  style?: ViewStyle;
  dotsStyle?: 'light' | 'dark';
  showDots?: boolean;
};

export function PhotoCarousel({ photos, width, height, autoScroll = true, style, dotsStyle = 'light', showDots = true }: PhotoCarouselProps) {
  const listRef = useRef<FlatList<string>>(null);
  const indexRef = useRef(0);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!autoScroll || photos.length <= 1) return;
    const interval = setInterval(() => {
      indexRef.current = (indexRef.current + 1) % photos.length;
      listRef.current?.scrollToIndex({ index: indexRef.current, animated: true });
      setIndex(indexRef.current);
    }, AUTO_SCROLL_MS);
    return () => clearInterval(interval);
  }, [autoScroll, photos.length]);

  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    indexRef.current = i;
    setIndex(i);
  };

  return (
    <View style={[{ width, height }, style]}>
      <FlatList
        ref={listRef}
        data={photos}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumScrollEnd}
        onScrollToIndexFailed={() => {}}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        renderItem={({ item }) => (
          <View style={[c.slide, { width, height }]}>
            <Image source={{ uri: item }} style={{ width, height }} resizeMode="contain" />
          </View>
        )}
      />

      {showDots && photos.length > 1 && (
        <View style={c.dotsRow}>
          {photos.map((_, i) => (
            <View
              key={i}
              style={[
                c.dot,
                dotsStyle === 'dark' ? c.dotDark : c.dotLight,
                i === index && (dotsStyle === 'dark' ? c.dotActiveDark : c.dotActiveLight),
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const c = StyleSheet.create({
  slide: {
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotsRow: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotLight: { backgroundColor: 'rgba(255,255,255,0.5)' },
  dotActiveLight: { backgroundColor: '#FFFFFF', width: 16 },
  dotDark: { backgroundColor: 'rgba(122,14,237,0.25)' },
  dotActiveDark: { backgroundColor: '#7A0EED', width: 16 },
});

export function screenWidthMinus(padding: number) {
  return Dimensions.get('window').width - padding;
}
