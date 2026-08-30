import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  Image,
  Linking,
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

const { width: SCREEN_W } = Dimensions.get('window');
const COLUMN_COUNT = 3;
const THUMB_SIZE = Math.floor((SCREEN_W - (COLUMN_COUNT - 1)) / COLUMN_COUNT);
const PAGE_SIZE = 30;

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

// ── Permission Denied Guide ──────────────────────────────────────────────────

function PermissionGuide({ onRequestAgain }: { onRequestAgain: () => void }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  const steps = [
    { icon: 'settings-outline' as const,        text: 'Open your device Settings' },
    { icon: 'apps-outline' as const,            text: 'Tap "Apps" or "Privacy"' },
    { icon: 'shield-checkmark-outline' as const, text: 'Find RaraLive → Permissions' },
    { icon: 'images-outline' as const,          text: 'Enable "Photos & Media" access' },
  ];

  return (
    <View style={guide.container}>
      <Animated.View style={[guide.iconWrap, { transform: [{ scale: pulseAnim }] }]}>
        <View style={guide.iconCircle}>
          <Ionicons name="lock-closed-outline" size={48} color="#7A0EED" />
        </View>
        <View style={guide.iconBadge}>
          <Ionicons name="images" size={18} color="#FFFFFF" />
        </View>
      </Animated.View>

      <Text style={guide.title}>Media Access Required</Text>
      <Text style={guide.subtitle}>
        RaraLive needs permission to show your photos and videos here.
      </Text>

      <View style={guide.stepsCard}>
        <Text style={guide.stepsTitle}>How to enable:</Text>
        {steps.map((step, idx) => (
          <View key={idx} style={guide.stepRow}>
            <View style={guide.stepNumWrap}>
              <Text style={guide.stepNum}>{idx + 1}</Text>
            </View>
            <View style={guide.stepIconWrap}>
              <Ionicons name={step.icon} size={18} color="#7A0EED" />
            </View>
            <Text style={guide.stepText}>{step.text}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity style={guide.settingsBtn} onPress={() => Linking.openSettings()} activeOpacity={0.85}>
        <Ionicons name="settings" size={18} color="#FFFFFF" />
        <Text style={guide.settingsBtnText}>Open Settings</Text>
      </TouchableOpacity>

      <TouchableOpacity style={guide.retryBtn} onPress={onRequestAgain} activeOpacity={0.85}>
        <Ionicons name="refresh-outline" size={16} color="#7A0EED" />
        <Text style={guide.retryBtnText}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Album picker sheet ───────────────────────────────────────────────────────

type Album = { id: string; title: string; count: number };

function AlbumSheet({
  albums,
  activeAlbumId,
  onSelect,
  onClose,
}: {
  albums: Album[];
  activeAlbumId: string;
  onSelect: (id: string, title: string) => void;
  onClose: () => void;
}) {
  const slideY = useRef(new Animated.Value(400)).current;
  const fade   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideY, { toValue: 0,   duration: 260, useNativeDriver: true }),
      Animated.timing(fade,   { toValue: 1,   duration: 220, useNativeDriver: true }),
    ]).start();
  }, [slideY, fade]);

  const dismiss = (cb?: () => void) => {
    Animated.parallel([
      Animated.timing(slideY, { toValue: 400, duration: 220, useNativeDriver: true }),
      Animated.timing(fade,   { toValue: 0,   duration: 180, useNativeDriver: true }),
    ]).start(() => { onClose(); cb?.(); });
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[albumS.backdrop, { opacity: fade }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => dismiss()} />
      </Animated.View>
      <Animated.View style={[albumS.sheet, { transform: [{ translateY: slideY }] }]}>
        <View style={albumS.handle} />
        <Text style={albumS.title}>Albums</Text>
        <FlatList
          data={albums}
          keyExtractor={(a) => a.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 }}
          renderItem={({ item }) => {
            const active = item.id === activeAlbumId;
            return (
              <TouchableOpacity
                style={albumS.row}
                activeOpacity={0.7}
                onPress={() => dismiss(() => onSelect(item.id, item.title))}>
                <View style={[albumS.rowIcon, active && albumS.rowIconActive]}>
                  <Ionicons name="folder" size={18} color={active ? '#7A0EED' : '#ABADB2'} />
                </View>
                <Text style={[albumS.rowText, active && albumS.rowTextActive]} numberOfLines={1}>
                  {item.title}
                </Text>
                {item.count > 0 && (
                  <Text style={albumS.rowCount}>{item.count}</Text>
                )}
                {active && <Ionicons name="checkmark" size={18} color="#7A0EED" />}
              </TouchableOpacity>
            );
          }}
        />
      </Animated.View>
    </View>
  );
}

// ── Media Thumbnail ──────────────────────────────────────────────────────────

function MediaThumbnail({
  item, selected, selectionIndex, onPress,
}: {
  item: MediaAsset;
  selected: boolean;
  selectionIndex: number;
  onPress: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.93, duration: 70,  useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1,    duration: 110, useNativeDriver: true }),
    ]).start();
    onPress();
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

        {selected ? (
          <View style={thumb.selOverlay}>
            <View style={thumb.checkCircle}>
              <Text style={thumb.checkNum}>{selectionIndex}</Text>
            </View>
          </View>
        ) : (
          <View style={thumb.emptyCircle} />
        )}
      </Animated.View>
    </Pressable>
  );
}

// ── Main Create Screen ───────────────────────────────────────────────────────

type CreateScreenProps = { onNext: (assets: MediaAsset[]) => void; onClose?: () => void };

export function CreateScreen({ onNext, onClose }: CreateScreenProps) {
  const insets = useSafeAreaInsets();
  const bottomInset     = Platform.OS === 'android' ? Math.max(insets.bottom, 12) : 0;
  const TAB_BAR_HEIGHT  = Platform.OS === 'ios' ? 80 : 56 + bottomInset;

  const [permStatus,    setPermStatus]    = useState<'loading' | 'granted' | 'denied'>('loading');
  // Separate caches per tab — switching tabs never re-fetches
  const [photoCache,    setPhotoCache]    = useState<MediaAsset[]>([]);
  const [videoCache,    setVideoCache]    = useState<MediaAsset[]>([]);
  const [loadingMedia,  setLoadingMedia]  = useState(false);
  const [activeTab,     setActiveTab]     = useState<TabType>('Photos');
  const [selected,      setSelected]      = useState<MediaAsset[]>([]);
  const [albums,        setAlbums]        = useState<Album[]>([]);
  const [albumId,       setAlbumId]       = useState<string>('');
  const [albumTitle,    setAlbumTitle]    = useState('Recents');
  const [showAlbums,    setShowAlbums]    = useState(false);
  const [photoCursor,   setPhotoCursor]   = useState<string | undefined>(undefined);
  const [videoCursor,   setVideoCursor]   = useState<string | undefined>(undefined);
  const [photoHasMore,  setPhotoHasMore]  = useState(false);
  const [videoHasMore,  setVideoHasMore]  = useState(false);
  const tabAnim = useRef(new Animated.Value(0)).current;

  // Derived — which cache to show
  const media = activeTab === 'Photos' ? photoCache : videoCache;
  const endCursor = activeTab === 'Photos' ? photoCursor : videoCursor;
  const hasMore = activeTab === 'Photos' ? photoHasMore : videoHasMore;

  // ── load assets — writes into the correct per-tab cache ─────────────────────
  const loadAssets = useCallback(async (
    tab: TabType,
    aid: string,
    cursor?: string,
    append = false,
  ) => {
    setLoadingMedia(true);
    try {
      const mediaType = tab === 'Photos'
        ? MediaLibrary.MediaType.photo
        : MediaLibrary.MediaType.video;

      const opts: MediaLibrary.AssetsOptions = {
        mediaType,
        first: PAGE_SIZE,
        sortBy: [MediaLibrary.SortBy.creationTime],
        after: cursor,
      };
      if (aid) opts.album = aid;

      const page = await MediaLibrary.getAssetsAsync(opts);
      const items: MediaAsset[] = page.assets.map((a) => ({
        id:        a.id,
        uri:       a.uri,
        mediaType: a.mediaType === MediaLibrary.MediaType.video ? 'video' : 'photo',
        duration:  a.duration > 0 ? a.duration : undefined,
        width:     a.width,
        height:    a.height,
        filename:  a.filename,
      }));

      if (tab === 'Photos') {
        setPhotoCache(prev => {
          if (!append) return items;
          const seen = new Set(prev.map(a => a.id));
          return [...prev, ...items.filter(a => !seen.has(a.id))];
        });
        setPhotoHasMore(page.hasNextPage);
        setPhotoCursor(page.endCursor);
      } else {
        setVideoCache(prev => {
          if (!append) return items;
          const seen = new Set(prev.map(a => a.id));
          return [...prev, ...items.filter(a => !seen.has(a.id))];
        });
        setVideoHasMore(page.hasNextPage);
        setVideoCursor(page.endCursor);
      }
    } finally {
      setLoadingMedia(false);
    }
  }, []);

  const loadAlbums = useCallback(async () => {
    const list = await MediaLibrary.getAlbumsAsync({ includeSmartAlbums: true });
    const mapped: Album[] = list
      .filter(a => a.assetCount > 0)
      .map(a => ({ id: a.id, title: a.title, count: a.assetCount }));
    setAlbums([{ id: '', title: 'Recents', count: 0 }, ...mapped]);
  }, []);

  // ── load after permission confirmed ─────────────────────────────────────────
  const loadAfterGrant = useCallback(async () => {
    setPermStatus('granted');
    await loadAlbums();
    await loadAssets('Photos', '');
  }, [loadAlbums, loadAssets]);

  // ── init permission ──────────────────────────────────────────────────────────
  const initPermission = useCallback(async () => {
    setPermStatus('loading');
    // Always request — resolves instantly if already granted, shows dialog if not
    const { status } = await MediaLibrary.requestPermissionsAsync(false);
    if (status === 'granted') {
      await loadAfterGrant();
    } else {
      setPermStatus('denied');
    }
  }, [loadAfterGrant]);

  useEffect(() => {
    initPermission();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── tab switch — instant if cache exists, fetch only if empty ────────────────
  const switchTab = (tab: TabType) => {
    if (tab === activeTab) return;
    Animated.timing(tabAnim, {
      toValue: tab === 'Photos' ? 0 : 1,
      duration: 220,
      useNativeDriver: false,
    }).start();
    setActiveTab(tab);
    // Only fetch if this tab's cache is empty
    const cacheEmpty = tab === 'Photos' ? photoCache.length === 0 : videoCache.length === 0;
    if (cacheEmpty) loadAssets(tab, albumId);
  };

  // ── album select — clear both caches and reload current tab ──────────────────
  const handleSelectAlbum = (id: string, title: string) => {
    setAlbumId(id);
    setAlbumTitle(title);
    setPhotoCache([]);
    setVideoCache([]);
    setSelected([]);
    setPhotoCursor(undefined);
    setVideoCursor(undefined);
    loadAssets(activeTab, id);
  };

  // ── pagination ───────────────────────────────────────────────────────────────
  const loadMore = () => {
    if (!hasMore || loadingMedia) return;
    loadAssets(activeTab, albumId, endCursor, true);
  };

  // ── camera ───────────────────────────────────────────────────────────────────
  const handleCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: activeTab === 'Photos' ? ['images'] : ['videos'],
      quality: 0.9,
    });
    if (!result.canceled && result.assets[0]) {
      const a = result.assets[0];
      const newItem: MediaAsset = {
        id:        a.assetId ?? a.uri,
        uri:       a.uri,
        mediaType: a.type === 'video' ? 'video' : 'photo',
        duration:  a.duration ?? undefined,
        width:     a.width,
        height:    a.height,
      };
      if (activeTab === 'Photos') setPhotoCache(prev => [newItem, ...prev]);
      else setVideoCache(prev => [newItem, ...prev]);
    }
  };

  const toggleSelect = (item: MediaAsset) => {
    setSelected(prev => {
      if (prev.find(s => s.id === item.id)) return prev.filter(s => s.id !== item.id);
      if (prev.length >= 10) return prev;
      return [...prev, item];
    });
  };

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
            <Text style={[styles.tabText, activeTab === 'Photos' && styles.tabTextActive]}>Photos</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tabBtn} onPress={() => switchTab('Videos')} activeOpacity={0.85}>
            <Text style={[styles.tabText, activeTab === 'Videos' && styles.tabTextActive]}>Videos</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      {permStatus === 'denied' ? (
        <PermissionGuide onRequestAgain={initPermission} />
      ) : permStatus === 'loading' ? (
        <View style={styles.centerWrap}>
          <View style={styles.loadingCircle}>
            <Ionicons name="images-outline" size={40} color="#7A0EED" />
          </View>
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {/* Gallery header */}
          <View style={styles.galleryHeader}>
            <TouchableOpacity style={styles.albumRow} onPress={() => setShowAlbums(true)} activeOpacity={0.75}>
              <Text style={styles.albumTitle}>{albumTitle}</Text>
              <Ionicons name="chevron-down" size={16} color="#1C1E22" />
            </TouchableOpacity>
            <View style={styles.galleryActions}>
              <TouchableOpacity style={styles.actionBtn} onPress={() => setShowAlbums(true)} hitSlop={8}>
                <Ionicons name="folder-outline" size={20} color="#1C1E22" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={handleCamera} activeOpacity={0.85}>
                <Ionicons name="camera-outline" size={22} color="#1C1E22" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Grid */}
          {loadingMedia && media.length === 0 ? (
            <View style={styles.centerWrap}>
              <View style={styles.loadingCircle}>
                <Ionicons name="images-outline" size={40} color="#7A0EED" />
              </View>
              <Text style={styles.loadingText}>Loading media…</Text>
            </View>
          ) : media.length === 0 ? (
            <View style={styles.centerWrap}>
              <Ionicons
                name={activeTab === 'Photos' ? 'image-outline' : 'videocam-outline'}
                size={56} color="#D0C8F0"
              />
              <Text style={styles.emptyTitle}>No {activeTab}</Text>
              <Text style={styles.emptySubtitle}>This album appears to be empty</Text>
            </View>
          ) : (
            <FlatList
              data={media}
              keyExtractor={item => item.id}
              numColumns={COLUMN_COUNT}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[
                styles.grid,
                selected.length > 0 && { paddingBottom: TAB_BAR_HEIGHT + 90 },
              ]}
              ItemSeparatorComponent={() => <View style={{ height: 1 }} />}
              columnWrapperStyle={{ gap: 1 }}
              onEndReached={loadMore}
              onEndReachedThreshold={0.4}
              renderItem={({ item }) => {
                const selIdx = selected.findIndex(s => s.id === item.id);
                return (
                  <MediaThumbnail
                    item={item}
                    selected={selIdx !== -1}
                    selectionIndex={selIdx + 1}
                    onPress={() => toggleSelect(item)}
                  />
                );
              }}
            />
          )}

          {/* Selection bar */}
          {selected.length > 0 && (
            <View style={[selbar.container, { bottom: TAB_BAR_HEIGHT }]}>
              <FlatList
                horizontal
                data={selected}
                keyExtractor={item => item.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={selbar.list}
                style={{ flex: 1 }}
                renderItem={({ item }) => (
                  <View style={selbar.chip}>
                    <Image source={{ uri: item.uri }} style={selbar.chipImg} resizeMode="cover" />
                    <TouchableOpacity
                      style={selbar.remove}
                      onPress={() => setSelected(prev => prev.filter(s => s.id !== item.id))}
                      hitSlop={8}>
                      <View style={selbar.removeInner}>
                        <Ionicons name="close" size={10} color="#FFF" />
                      </View>
                    </TouchableOpacity>
                  </View>
                )}
              />
              <TouchableOpacity style={selbar.nextBtn} onPress={() => onNext(selected)} activeOpacity={0.88}>
                <Text style={selbar.nextText}>Next</Text>
                <Ionicons name="arrow-forward" size={16} color="#FFF" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Album sheet */}
      {showAlbums && (
        <AlbumSheet
          albums={albums}
          activeAlbumId={albumId}
          onSelect={handleSelectAlbum}
          onClose={() => setShowAlbums(false)}
        />
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

  galleryHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 10,
  },
  albumRow:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  albumTitle:  { fontSize: 16, fontWeight: '700', color: '#1C1E22' },
  galleryActions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: '#F5F3FA', alignItems: 'center', justifyContent: 'center',
  },

  grid: { paddingBottom: 20 },

  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingCircle: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#F5F3FA',
    alignItems: 'center', justifyContent: 'center',
  },
  loadingText: { fontSize: 14, color: '#ABADB2', fontWeight: '500' },
  emptyTitle:  { fontSize: 18, fontWeight: '700', color: '#1C1E22', marginTop: 8 },
  emptySubtitle: { fontSize: 13, color: '#ABADB2', textAlign: 'center' },
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
    backgroundColor: 'rgba(122,14,237,0.22)',
    alignItems: 'flex-end', padding: 6,
  },
  checkCircle: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: '#7A0EED',
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFF',
  },
  checkNum:   { fontSize: 12, fontWeight: '800', color: '#FFF' },
  emptyCircle: {
    position: 'absolute', top: 6, right: 6,
    width: 26, height: 26, borderRadius: 13,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.85)',
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
});

const selbar = StyleSheet.create({
  container: {
    position: 'absolute', left: 0, right: 0,
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingTop: 12, paddingBottom: 14, paddingHorizontal: 12,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    shadowColor: '#4A0099', shadowOpacity: 0.18, shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 }, elevation: 20,
  },
  list:    { gap: 8, paddingLeft: 4, paddingRight: 4 },
  chip:    { width: 60, height: 60, borderRadius: 12, position: 'relative', marginTop: 6 },
  chipImg: { width: 60, height: 60, borderRadius: 12, backgroundColor: '#E9E9F0' },
  remove:  { position: 'absolute', top: -7, right: -7 },
  removeInner: {
    width: 18, height: 18, borderRadius: 9, backgroundColor: '#7A0EED',
    alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#FFF',
  },
  nextBtn: {
    height: 48, paddingHorizontal: 22, borderRadius: 999, backgroundColor: '#7A0EED',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    shadowColor: '#7A0EED', shadowOpacity: 0.35, shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  nextText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
});

const albumS = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20,
    maxHeight: '62%',
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: '#E0DFF5',
    alignSelf: 'center', marginTop: 10, marginBottom: 14,
  },
  title:   { fontSize: 17, fontWeight: '800', color: '#1C1E22', marginBottom: 10 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#F0EFF5',
  },
  rowIcon: {
    width: 34, height: 34, borderRadius: 10, backgroundColor: '#F5F3FA',
    alignItems: 'center', justifyContent: 'center',
  },
  rowIconActive: { backgroundColor: '#EEE6FF' },
  rowText:       { flex: 1, fontSize: 15, fontWeight: '500', color: '#3C3F4A' },
  rowTextActive: { color: '#7A0EED', fontWeight: '700' },
  rowCount:      { fontSize: 13, color: '#ABADB2', fontWeight: '500' },
});

const guide = StyleSheet.create({
  container: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 28, paddingBottom: 40, backgroundColor: '#FAFAFA',
  },
  iconWrap: {
    width: 100, height: 100, marginBottom: 20,
    position: 'relative', alignItems: 'center', justifyContent: 'center',
  },
  iconCircle: {
    width: 96, height: 96, borderRadius: 48, backgroundColor: '#F0E8FF',
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#DDD0FF',
  },
  iconBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 32, height: 32, borderRadius: 16, backgroundColor: '#B50357',
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFF',
  },
  title:    { fontSize: 22, fontWeight: '800', color: '#1C1E22', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#6B6E7A', textAlign: 'center', lineHeight: 21, marginBottom: 24 },
  stepsCard: {
    width: '100%', backgroundColor: '#FFF', borderRadius: 18, padding: 18, gap: 14,
    shadowColor: '#4A0099', shadowOpacity: 0.07, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 3, marginBottom: 24,
  },
  stepsTitle: { fontSize: 13, fontWeight: '700', color: '#7A0EED', letterSpacing: 0.5, marginBottom: 2 },
  stepRow:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepNumWrap: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: '#7A0EED',
    alignItems: 'center', justifyContent: 'center',
  },
  stepNum:    { fontSize: 11, fontWeight: '800', color: '#FFF' },
  stepIconWrap: {
    width: 32, height: 32, borderRadius: 10, backgroundColor: '#F0E8FF',
    alignItems: 'center', justifyContent: 'center',
  },
  stepText:   { flex: 1, fontSize: 13, color: '#3C3F4A', fontWeight: '500', lineHeight: 18 },
  settingsBtn: {
    width: '100%', height: 52, borderRadius: 999, backgroundColor: '#7A0EED',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    shadowColor: '#7A0EED', shadowOpacity: 0.3, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }, elevation: 4, marginBottom: 12,
  },
  settingsBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  retryBtn: {
    width: '100%', height: 48, borderRadius: 999, borderWidth: 1.5, borderColor: '#7A0EED',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  retryBtnText: { fontSize: 14, fontWeight: '700', color: '#7A0EED' },
});