import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_GAP = 10;
const CARD_PADDING = 16;
const CARD_W = (SCREEN_W - CARD_PADDING * 2 - CARD_GAP) / 2;
const CARD_H = CARD_W * 1.35;

// ── Types ─────────────────────────────────────────────────────────────────────

export type LiveBroadcaster = {
  id: string;
  name: string;
  languages: string[];
  imageUri?: string;
  isLive: boolean;
  isFavorite?: boolean;
  isVerified?: boolean;
  viewerCount?: number;
  statusLine?: string;
};

export type LiveFilter = 'popular' | 'nearby' | 'new' | 'following';

type LiveScreenProps = {
  broadcasters: LiveBroadcaster[];
  onGoLive: () => void;
  onBroadcasterPress: (b: LiveBroadcaster) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  /** The current user's own active broadcast, if they're live right now — shown as a pinned banner. */
  myLiveBroadcast?: LiveBroadcaster | null;
  onResumeMyLive?: () => void;
};

// ── Filter tabs ───────────────────────────────────────────────────────────────

const FILTERS: { key: LiveFilter; label: string }[] = [
  { key: 'popular', label: 'Popular' },
  { key: 'nearby', label: 'Nearby' },
  { key: 'new', label: 'New' },
  { key: 'following', label: 'Following' },
];

function FilterTabs({ active, onChange }: { active: LiveFilter; onChange: (f: LiveFilter) => void }) {
  return (
    <View style={filter.row}>
      {FILTERS.map(f => {
        const isActive = f.key === active;
        return (
          <TouchableOpacity
            key={f.key}
            onPress={() => onChange(f.key)}
            activeOpacity={0.85}
            style={filter.pillWrap}>
            {isActive ? (
              <LinearGradient
                colors={['#7A0EED', '#B50357']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={filter.pillActive}>
                <Text style={filter.labelActive}>{f.label}</Text>
              </LinearGradient>
            ) : (
              <View style={filter.pill}>
                <Text style={filter.label}>{f.label}</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function formatViewerCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return String(n);
}

// ── Broadcaster Card ──────────────────────────────────────────────────────────

function BroadcasterCard({ item, onPress }: {
  item: LiveBroadcaster;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      style={[card.container, { width: CARD_W, height: CARD_H }]}>
      {item.imageUri ? (
        <Image source={{ uri: item.imageUri }} style={card.image} resizeMode="cover" />
      ) : (
        <View style={[card.image, card.imageFallback]}>
          <Ionicons name="person" size={36} color="#C4B5FD" />
        </View>
      )}

      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.72)']}
        style={card.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />

      <View style={card.liveBadge}>
        <View style={card.liveDot} />
        <Text style={card.liveText}>LIVE</Text>
      </View>

      {typeof item.viewerCount === 'number' && (
        <View style={card.viewerBadge}>
          <Ionicons name="eye" size={10} color="#FFFFFF" />
          <Text style={card.viewerText}>{formatViewerCount(item.viewerCount)}</Text>
        </View>
      )}

      <View style={card.info}>
        {item.statusLine ? (
          <Text style={card.statusLine} numberOfLines={1}>{item.statusLine}</Text>
        ) : item.languages.length > 0 ? (
          <View style={card.langRow}>
            <Ionicons name="language" size={10} color="rgba(255,255,255,0.8)" />
            <Text style={card.langText} numberOfLines={1}>{item.languages.join(', ')}</Text>
          </View>
        ) : null}
        <View style={card.nameRow}>
          <Text style={card.name} numberOfLines={1}>{item.name}</Text>
          {item.isVerified && (
            <Ionicons name="checkmark-circle" size={13} color="#4FC3F7" style={card.verifiedIcon} />
          )}
          {item.isFavorite && <Text style={card.heart}> ❤️</Text>}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export function LiveScreen({
  broadcasters, onGoLive, onBroadcasterPress, onRefresh, refreshing = false, myLiveBroadcast, onResumeMyLive,
}: LiveScreenProps) {
  const [activeFilter, setActiveFilter] = useState<LiveFilter>('popular');

  return (
    <View style={s.container}>
      {/* Header row */}
      <View style={s.headerRow}>
        <View>
          <Text style={s.title}>Live Now</Text>
          <Text style={s.subtitle}>Broadcasters</Text>
        </View>
        <View style={s.headerActions}>
          {onRefresh && (
            <TouchableOpacity onPress={onRefresh} activeOpacity={0.85} style={s.refreshBtn} disabled={refreshing}>
              <Ionicons name="refresh" size={16} color="#7A0EED" />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={onGoLive} activeOpacity={0.88} style={s.goLiveBtn}>
            <LinearGradient
              colors={['#7A0EED', '#B50357']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={s.goLiveGrad}>
              <Ionicons name="videocam" size={13} color="#FFFFFF" />
              <Text style={s.goLiveText}>GO LIVE</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>

      {myLiveBroadcast && (
        <TouchableOpacity onPress={onResumeMyLive} activeOpacity={0.9} style={s.myLiveBanner}>
          <LinearGradient
            colors={['#7A0EED', '#B50357']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.myLiveBannerGrad}>
            {myLiveBroadcast.imageUri ? (
              <Image source={{ uri: myLiveBroadcast.imageUri }} style={s.myLiveAvatar} />
            ) : (
              <View style={[s.myLiveAvatar, s.myLiveAvatarFallback]}>
                <Ionicons name="person" size={16} color="#FFFFFF" />
              </View>
            )}
            <View style={s.myLiveTextWrap}>
              <Text style={s.myLiveTitle}>You're Live</Text>
              <Text style={s.myLiveSubtitle}>Tap to return to your broadcast</Text>
            </View>
            <View style={s.myLiveBadge}>
              <View style={s.liveDotSmall} />
              <Text style={s.myLiveBadgeText}>LIVE</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.85)" />
          </LinearGradient>
        </TouchableOpacity>
      )}

      <FilterTabs active={activeFilter} onChange={setActiveFilter} />

      {broadcasters.length === 0 ? (
        <FlatList
          key="live-empty"
          data={[]}
          keyExtractor={() => 'empty'}
          renderItem={null}
          refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#7A0EED']} tintColor="#7A0EED" /> : undefined}
          contentContainerStyle={s.emptyScrollContent}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="radio-outline" size={40} color="#D8D3EC" />
              <Text style={s.emptyText}>No one is live right now</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          key="live-grid"
          data={broadcasters}
          keyExtractor={b => b.id}
          numColumns={2}
          columnWrapperStyle={s.row}
          contentContainerStyle={s.grid}
          showsVerticalScrollIndicator={false}
          refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#7A0EED']} tintColor="#7A0EED" /> : undefined}
          renderItem={({ item }) => (
            <BroadcasterCard
              item={item}
              onPress={() => onBroadcasterPress(item)}
            />
          )}
          ListFooterComponent={<View style={{ height: 100 }} />}
        />
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F3FA' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: CARD_PADDING,
    paddingTop: 14,
    paddingBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1C1E22',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 12,
    color: '#ABADB2',
    fontWeight: '500',
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  refreshBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0EAFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  myLiveBanner: {
    marginHorizontal: CARD_PADDING,
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#7A0EED',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  myLiveBannerGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  myLiveAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  myLiveAvatarFallback: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  myLiveTextWrap: { flex: 1, gap: 1 },
  myLiveTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.1,
  },
  myLiveSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.85)',
  },
  myLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  liveDotSmall: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#FF3B3B',
  },
  myLiveBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  goLiveBtn: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#7A0EED',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  goLiveGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  goLiveText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  grid: { paddingHorizontal: CARD_PADDING },
  row: { gap: CARD_GAP, marginBottom: CARD_GAP },
  emptyScrollContent: { flexGrow: 1 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingBottom: 80,
  },
  emptyText: {
    fontSize: 14,
    color: '#B0AEC0',
    fontWeight: '500',
  },
});

const card = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#E8E3F5',
  },
  image: { ...StyleSheet.absoluteFillObject },
  imageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EDE8F7',
  },
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '55%',
  },
  liveBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FF3B3B',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  liveDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
  },
  liveText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  viewerBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.52)',
    borderRadius: 20,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  viewerText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  info: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    gap: 2,
  },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  langText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 10,
    fontWeight: '500',
  },
  statusLine: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 10,
    fontWeight: '500',
  },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  name: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  verifiedIcon: { marginLeft: 3 },
  heart: { fontSize: 12 },
});

const filter = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: CARD_PADDING,
    paddingBottom: 14,
  },
  pillWrap: { borderRadius: 18, overflow: 'hidden' },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
  },
  pillActive: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8B8D96',
  },
  labelActive: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
