import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Dimensions,
  FlatList,
  Image,
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
};

type LiveScreenProps = {
  broadcasters: LiveBroadcaster[];
  onGoLive: () => void;
  onBroadcasterPress: (b: LiveBroadcaster) => void;
};

// ── Broadcaster Card ──────────────────────────────────────────────────────────

function BroadcasterCard({ item, onPress }: { item: LiveBroadcaster; onPress: () => void }) {
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

      <View style={card.info}>
        <View style={card.langRow}>
          <Ionicons name="language" size={10} color="rgba(255,255,255,0.8)" />
          <Text style={card.langText} numberOfLines={1}>{item.languages.join(', ')}</Text>
        </View>
        <View style={card.nameRow}>
          <Text style={card.name} numberOfLines={1}>{item.name}</Text>
          {item.isFavorite && <Text style={card.heart}> ❤️</Text>}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export function LiveScreen({ broadcasters, onGoLive, onBroadcasterPress }: LiveScreenProps) {
  return (
    <View style={s.container}>
      {/* Header row */}
      <View style={s.headerRow}>
        <View>
          <Text style={s.title}>Live Now</Text>
          <Text style={s.subtitle}>Broadcasters</Text>
        </View>
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

      {broadcasters.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="radio-outline" size={40} color="#D8D3EC" />
          <Text style={s.emptyText}>No one is live right now</Text>
        </View>
      ) : (
        <FlatList
          data={broadcasters}
          keyExtractor={b => b.id}
          numColumns={2}
          columnWrapperStyle={s.row}
          contentContainerStyle={s.grid}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <BroadcasterCard item={item} onPress={() => onBroadcasterPress(item)} />
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
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.52)',
    borderRadius: 20,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#FF3B3B',
  },
  liveText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
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
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  name: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  heart: { fontSize: 12 },
});
