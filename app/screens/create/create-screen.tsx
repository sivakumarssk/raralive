import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  Image,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppScreenHeader } from '@/components/ui/app-screen-header';

// Media is picked through the system photo picker, which needs no
// READ_MEDIA_IMAGES / READ_MEDIA_VIDEO permission. The earlier in-app gallery
// (expo-media-library grid + albums) lives in git history (commit 18df971) if
// broad gallery access is declared to Google Play later.

const { width: SCREEN_W } = Dimensions.get('window');
const COLUMN_COUNT = 3;
const THUMB_SIZE = Math.floor((SCREEN_W - (COLUMN_COUNT - 1)) / COLUMN_COUNT);
const MAX_ITEMS = 10;

type TabType = 'Photos' | 'Videos';

export type MediaAsset = {
  id: string;
  uri: string;
  mediaType: 'photo' | 'video';
  duration?: number;
  width?: number;
  height?: number;
  filename?: string;
};

function toMediaAsset(a: ImagePicker.ImagePickerAsset): MediaAsset {
  return {
    id:        a.assetId ?? a.uri,
    uri:       a.uri,
    mediaType: a.type === 'video' ? 'video' : 'photo',
    // expo-image-picker reports duration in milliseconds
    duration:  a.duration ? a.duration / 1000 : undefined,
    width:     a.width,
    height:    a.height,
    filename:  a.fileName ?? undefined,
  };
}

// ── Media Thumbnail ──────────────────────────────────────────────────────────

function MediaThumbnail({
  item, selectionIndex, onRemove,
}: {
  item: MediaAsset;
  selectionIndex: number;
  onRemove: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.93, duration: 70,  useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1,    duration: 110, useNativeDriver: true }),
    ]).start(onRemove);
  };

  const fmtDur = (s?: number) => {
    if (!s) return '';
    const m = Math.floor(s / 60);
    const sec = Math.round(s % 60);
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  return (
    <Pressable onPress={handlePress}>
      <Animated.View style={[thumb.wrapper, { transform: [{ scale: scaleAnim }] }]}>
        <Image source={{ uri: item.uri }} style={thumb.image} resizeMode="cover" />

        {item.mediaType === 'video' && (
          <View style={thumb.videoBadge}>
            <Ionicons name="videocam" size={10} color="#FFF" />
            {item.duration ? <Text style={thumb.durText}>{fmtDur(item.duration)}</Text> : null}
          </View>
        )}

        <View style={thumb.selOverlay}>
          <View style={thumb.checkCircle}>
            <Text style={thumb.checkNum}>{selectionIndex}</Text>
          </View>
        </View>
        <View style={thumb.removeBtn}>
          <Ionicons name="close" size={12} color="#FFF" />
        </View>
      </Animated.View>
    </Pressable>
  );
}

// ── Main Create Screen ───────────────────────────────────────────────────────

type CreateScreenProps = {
  onNext: (assets: MediaAsset[]) => void;
  onClose?: () => void;
  initialSelected?: MediaAsset[];
};

export function CreateScreen({ onNext, onClose, initialSelected }: CreateScreenProps) {
  const insets = useSafeAreaInsets();
  const bottomInset     = Platform.OS === 'android' ? Math.max(insets.bottom, 12) : 0;
  const TAB_BAR_HEIGHT  = Platform.OS === 'ios' ? 80 : 56 + bottomInset;

  const [activeTab, setActiveTab] = useState<TabType>('Photos');
  const [selected,  setSelected]  = useState<MediaAsset[]>(initialSelected ?? []);
  const [picking,   setPicking]   = useState(false);
  const tabAnim = useRef(new Animated.Value(0)).current;

  const remaining = MAX_ITEMS - selected.length;
  const isPhotos  = activeTab === 'Photos';

  const addAssets = (assets: MediaAsset[]) => {
    setSelected(prev => {
      const seen = new Set(prev.map(a => a.id));
      const fresh = assets.filter(a => !seen.has(a.id));
      return [...prev, ...fresh].slice(0, MAX_ITEMS);
    });
  };

  const switchTab = (tab: TabType) => {
    if (tab === activeTab) return;
    Animated.timing(tabAnim, {
      toValue: tab === 'Photos' ? 0 : 1,
      duration: 220,
      useNativeDriver: false,
    }).start();
    setActiveTab(tab);
  };

  // ── system photo picker (no media permission required) ──────────────────────
  const handlePickFromGallery = async () => {
    if (picking || remaining <= 0) return;
    setPicking(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: isPhotos ? ['images'] : ['videos'],
        allowsMultipleSelection: true,
        selectionLimit: remaining,
        orderedSelection: true,
        quality: 0.9,
      });
      if (!result.canceled) addAssets(result.assets.map(toMediaAsset));
    } finally {
      setPicking(false);
    }
  };

  // ── camera ───────────────────────────────────────────────────────────────────
  const handleCamera = async () => {
    if (picking || remaining <= 0) return;
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;
    setPicking(true);
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: isPhotos ? ['images'] : ['videos'],
        quality: 0.9,
      });
      if (!result.canceled && result.assets[0]) addAssets([toMediaAsset(result.assets[0])]);
    } finally {
      setPicking(false);
    }
  };

  const removeItem = (id: string) => setSelected(prev => prev.filter(s => s.id !== id));

  const [trackW, setTrackW] = useState(0);
  const pillW   = trackW > 0 ? trackW / 2 - 8 : 0;   // half minus 4px inset each side
  const tabLeft = tabAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [4, trackW / 2 + 4],                  // 4px inset from edge on both sides
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAFAFA" />

      <AppScreenHeader title="Create" onClose={onClose} backgroundColor="#FAFAFA" />

      {/* Tab switcher */}
      <View style={styles.tabWrap}>
        <View style={styles.tabTrack} onLayout={e => setTrackW(e.nativeEvent.layout.width)}>
          <Animated.View style={[styles.tabIndicator, { left: tabLeft, width: pillW }]} />
          <TouchableOpacity style={styles.tabBtn} onPress={() => switchTab('Photos')} activeOpacity={0.85}>
            <Text style={[styles.tabText, isPhotos && styles.tabTextActive]}>Photos</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tabBtn} onPress={() => switchTab('Videos')} activeOpacity={0.85}>
            <Text style={[styles.tabText, !isPhotos && styles.tabTextActive]}>Videos</Text>
          </TouchableOpacity>
        </View>
      </View>

      {selected.length === 0 ? (
        /* Empty state — pick from gallery or camera */
        <View style={[styles.emptyWrap, { paddingBottom: TAB_BAR_HEIGHT }]}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name={isPhotos ? 'images-outline' : 'videocam-outline'} size={44} color="#7A0EED" />
          </View>
          <Text style={styles.emptyTitle}>Share your moments</Text>
          <Text style={styles.emptySubtitle}>
            Choose {isPhotos ? 'photos' : 'videos'} from your gallery or use the camera.
            {'\n'}You can add up to {MAX_ITEMS} in one post.
          </Text>

          <TouchableOpacity style={styles.primaryBtn} onPress={handlePickFromGallery} activeOpacity={0.85} disabled={picking}>
            <Ionicons name="images" size={18} color="#FFF" />
            <Text style={styles.primaryBtnText}>Choose from Gallery</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={handleCamera} activeOpacity={0.85} disabled={picking}>
            <Ionicons name={isPhotos ? 'camera-outline' : 'videocam-outline'} size={18} color="#7A0EED" />
            <Text style={styles.secondaryBtnText}>{isPhotos ? 'Take Photo' : 'Record Video'}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {/* Selected header */}
          <View style={styles.galleryHeader}>
            <Text style={styles.albumTitle}>Selected ({selected.length}/{MAX_ITEMS})</Text>
            <View style={styles.galleryActions}>
              <TouchableOpacity
                style={[styles.actionBtn, remaining <= 0 && styles.actionBtnDisabled]}
                onPress={handlePickFromGallery}
                disabled={picking || remaining <= 0}
                hitSlop={8}>
                <Ionicons name="add" size={22} color="#1C1E22" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, remaining <= 0 && styles.actionBtnDisabled]}
                onPress={handleCamera}
                disabled={picking || remaining <= 0}
                activeOpacity={0.85}>
                <Ionicons name="camera-outline" size={22} color="#1C1E22" />
              </TouchableOpacity>
            </View>
          </View>
          <Text style={styles.hint}>Tap an item to remove it</Text>

          {/* Selected grid */}
          <FlatList
            data={selected}
            keyExtractor={item => item.id}
            numColumns={COLUMN_COUNT}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.grid, { paddingBottom: TAB_BAR_HEIGHT + 90 }]}
            ItemSeparatorComponent={() => <View style={{ height: 1 }} />}
            columnWrapperStyle={{ gap: 1 }}
            renderItem={({ item, index }) => (
              <MediaThumbnail item={item} selectionIndex={index + 1} onRemove={() => removeItem(item.id)} />
            )}
          />

          {/* Next bar */}
          <View style={[selbar.container, { bottom: TAB_BAR_HEIGHT }]}>
            <Text style={selbar.count}>
              {selected.length} {selected.length === 1 ? 'item' : 'items'} selected
            </Text>
            <TouchableOpacity style={selbar.nextBtn} onPress={() => onNext(selected)} activeOpacity={0.88}>
              <Text style={selbar.nextText}>Next</Text>
              <Ionicons name="arrow-forward" size={16} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FAFAFA' },
  tabWrap: { paddingHorizontal: 20, paddingVertical: 10, alignItems: 'center' },
  tabTrack: {
    flexDirection: 'row', width: '80%', height: 42,
    backgroundColor: '#F0ECF9', borderRadius: 999, position: 'relative', alignItems: 'center',
  },
  tabIndicator: {
    position: 'absolute', height: 34, backgroundColor: '#FFFFFF',
    borderRadius: 999, top: 4,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  tabBtn:      { flex: 1, height: 42, alignItems: 'center', justifyContent: 'center' },
  tabText:     { fontSize: 14, fontWeight: '600', color: '#9B9BA8' },
  tabTextActive: { color: '#7A0EED', fontWeight: '700' },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  emptyIconCircle: {
    width: 96, height: 96, borderRadius: 48, backgroundColor: '#F0E8FF',
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#DDD0FF',
    marginBottom: 18,
  },
  emptyTitle:    { fontSize: 22, fontWeight: '800', color: '#1C1E22', textAlign: 'center', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#6B6E7A', textAlign: 'center', lineHeight: 21, marginBottom: 28 },
  primaryBtn: {
    width: '100%', height: 52, borderRadius: 999, backgroundColor: '#7A0EED',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    shadowColor: '#7A0EED', shadowOpacity: 0.3, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }, elevation: 4, marginBottom: 12,
  },
  primaryBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  secondaryBtn: {
    width: '100%', height: 48, borderRadius: 999, borderWidth: 1.5, borderColor: '#7A0EED',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  secondaryBtnText: { fontSize: 14, fontWeight: '700', color: '#7A0EED' },

  galleryHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 4,
  },
  albumTitle:  { fontSize: 16, fontWeight: '700', color: '#1C1E22' },
  galleryActions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: '#F5F3FA', alignItems: 'center', justifyContent: 'center',
  },
  actionBtnDisabled: { opacity: 0.4 },
  hint: { fontSize: 12, color: '#ABADB2', paddingHorizontal: 16, paddingBottom: 10 },

  grid: { paddingBottom: 20 },
});

const thumb = StyleSheet.create({
  wrapper:  { width: THUMB_SIZE, height: THUMB_SIZE },
  image:    { width: THUMB_SIZE, height: THUMB_SIZE, backgroundColor: '#E9E9F0' },
  videoBadge: {
    position: 'absolute', bottom: 6, left: 6,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 6,
    paddingHorizontal: 5, paddingVertical: 2,
  },
  durText:  { fontSize: 10, color: '#FFF', fontWeight: '600' },
  selOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(122,14,237,0.12)',
    alignItems: 'flex-start', padding: 6,
  },
  checkCircle: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: '#7A0EED',
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFF',
  },
  checkNum:   { fontSize: 12, fontWeight: '800', color: '#FFF' },
  removeBtn: {
    position: 'absolute', top: 6, right: 6,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.85)',
  },
});

const selbar = StyleSheet.create({
  container: {
    position: 'absolute', left: 0, right: 0,
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingTop: 12, paddingBottom: 14, paddingHorizontal: 18,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10,
    shadowColor: '#4A0099', shadowOpacity: 0.18, shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 }, elevation: 20,
  },
  count:   { fontSize: 14, fontWeight: '600', color: '#3C3F4A' },
  nextBtn: {
    height: 48, paddingHorizontal: 22, borderRadius: 999, backgroundColor: '#7A0EED',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    shadowColor: '#7A0EED', shadowOpacity: 0.35, shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  nextText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
});
