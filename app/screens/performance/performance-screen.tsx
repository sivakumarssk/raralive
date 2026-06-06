import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BASE_URL, MEDIA_BASE } from '@/services/api';
import { getLevelImage } from '@/screens/room-detail/components/room-level-up';

const COIN_IMG = require('@/assets/tabs/coin.png');
const { width: W } = Dimensions.get('window');

// Level thresholds — mirrors backend utils/room-levels.js
const LEVEL_THRESHOLDS = [
  0, 5, 300, 700, 2000, 3500, 6000, 10000, 15000, 22000, 32000,
  45000, 65000, 90000, 125000, 170000, 225000, 295000, 375000, 435000, 500000,
  600000, 800000, 1000000, 1250000, 1500000, 1800000, 2100000, 2400000, 2700000,
  3000000, 3300000, 3600000, 3900000, 4200000, 4400000, 4600000, 4700000, 4800000,
  4900000, 5000000, 5200000, 5400000, 5600000, 5800000, 6000000, 6200000, 6400000,
  6600000, 6800000, 7000000, 7200000, 7400000, 7600000, 7800000, 8000000, 8200000,
  8400000, 8600000, 8800000, 9000000, 9200000, 9400000, 9600000, 9800000, 10000000,
  10300000, 10600000, 10900000, 11200000, 11500000, 11800000, 12100000, 12400000,
  12700000, 13000000, 13300000, 13600000, 14000000, 14400000, 14800000, 15200000,
  15600000, 16000000, 16400000, 16800000, 17200000, 17600000, 18000000, 18400000,
  18800000, 19000000, 19200000, 19400000, 19500000, 19600000, 19700000, 19800000,
  19900000, 19950000, 20000000,
];

function formatCoins(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function resolveAvatar(url: string | null | undefined) {
  if (!url) return null;
  return url.startsWith('http') ? url : `${MEDIA_BASE}/${url.replace(/^\//, '')}`;
}

type Supporter = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  total_coins: number;
};

type Tab = 'levels' | 'supporters';

const AVATAR_COLORS = ['#F7A8D0', '#A8D0F7', '#A8F7C6', '#F7D6A8', '#D0A8F7'];

// ── Animated progress bar ─────────────────────────────────────────────────────

function ProgressBar({ progress }: { progress: number }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: progress,
      duration: 900,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  const width = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  return (
    <View style={pb.track}>
      <Animated.View style={[pb.fill, { width }]} />
      {/* Glow dot at tip */}
      <Animated.View style={[pb.dot, { left: width as any }]} />
    </View>
  );
}

const pb = StyleSheet.create({
  track: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 4,
    overflow: 'visible',
    position: 'relative',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: '#38BDF8',
    shadowColor: '#38BDF8',
    shadowOpacity: 0.7,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  dot: {
    position: 'absolute',
    top: -3,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: '#38BDF8',
    marginLeft: -7,
    shadowColor: '#38BDF8',
    shadowOpacity: 0.6,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
});

// ── Level Rewards placeholder cards ──────────────────────────────────────────

const LEVEL_REWARDS = [
  { id: '1', emoji: '🚀', label: 'Rocket',   bg: '#DDF0FF', tag: '#4A90E2' },
  { id: '2', emoji: '💍', label: 'Ring',      bg: '#FFE8F0', tag: '#E85580' },
  { id: '3', emoji: '🏍️', label: 'Bike',      bg: '#2A1A3A', tag: '#F5A623' },
  { id: '4', emoji: '💎', label: 'Diamond',   bg: '#4A90D9', tag: '#4A90E2' },
];

// ── Main Screen ───────────────────────────────────────────────────────────────

export function PerformanceScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ roomId: string; level: string; totalCoins: string }>();

  const roomId     = params.roomId ?? '';
  const level      = parseInt(params.level ?? '0', 10);
  const totalCoins = parseInt(params.totalCoins ?? '0', 10);

  const [activeTab, setActiveTab] = useState<Tab>('levels');
  const [supporters, setSupporters] = useState<Supporter[]>([]);
  const [loadingSup, setLoadingSup] = useState(false);

  // Compute progress within current level
  const currentThreshold = LEVEL_THRESHOLDS[level] ?? 0;
  const nextThreshold     = LEVEL_THRESHOLDS[level + 1] ?? LEVEL_THRESHOLDS[level] ?? 1;
  const coinsIntoLevel    = Math.max(0, totalCoins - currentThreshold);
  const coinsNeeded       = Math.max(1, nextThreshold - currentThreshold);
  const progress          = Math.min(coinsIntoLevel / coinsNeeded, 1);

  const levelImg = getLevelImage(level);

  // Fetch real supporters
  useEffect(() => {
    if (!roomId) return;
    setLoadingSup(true);
    fetch(`${BASE_URL}/rooms/${roomId}/supporters`)
      .then(r => r.json())
      .then(j => { if (j.success) setSupporters(j.data); })
      .catch(() => {})
      .finally(() => setLoadingSup(false));
  }, [roomId]);

  const TABS: { key: Tab; label: string }[] = [
    { key: 'levels',     label: 'Levels' },
    { key: 'supporters', label: 'Top Supporters' },
  ];

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.headerBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color="#1C1E22" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Performance</Text>
        <View style={s.headerBtn} />
      </View>

      {/* Tab bar */}
      <View style={s.tabBar}>
        {TABS.map(t => (
          <TouchableOpacity key={t.key} style={s.tabBtn} onPress={() => setActiveTab(t.key)} activeOpacity={0.75}>
            <Text style={[s.tabLabel, activeTab === t.key && s.tabLabelActive]}>{t.label}</Text>
            {activeTab === t.key && <View style={s.tabUnderline} />}
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* ── Levels tab ── */}
        {activeTab === 'levels' && (
          <>
            {/* Hero banner */}
            <LinearGradient
              colors={['#0F172A', '#1E3A5F', '#0F2744']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.hero}>

              {/* Decorative circles */}
              <View style={[s.circle, s.circleTopRight]} />
              <View style={[s.circle, s.circleBottomLeft]} />
              <View style={[s.circleSm, s.circleTopLeft]} />

              {/* Top row: level badge + coins */}
              <View style={s.heroTopRow}>
                <LinearGradient
                  colors={['#F59E0B', '#EF4444']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={s.levelBadge}>
                  <Text style={s.levelBadgeText}>LEVEL {level}</Text>
                </LinearGradient>

                <View style={s.heroCoinsBadge}>
                  <Image source={COIN_IMG} style={s.heroCoin} resizeMode="contain" />
                  <Text style={s.heroCoins}>{formatCoins(totalCoins)}</Text>
                </View>
              </View>

              {/* Level image — smaller, centred */}
              <Image source={levelImg} style={s.levelImg} resizeMode="contain" />

              {/* Progress card */}
              <View style={s.progressCard}>
                <View style={s.progressCardHeader}>
                  <Text style={s.progressCardTitle}>Progress to Lv {level + 1}</Text>
                  <Text style={s.progressPercent}>{Math.round(progress * 100)}%</Text>
                </View>
                <ProgressBar progress={progress} />
                <View style={s.progressLabels}>
                  <View style={s.progressLabelRow}>
                    <Image source={COIN_IMG} style={s.smallCoin} resizeMode="contain" />
                    <Text style={s.progressLabelCoins}>{formatCoins(currentThreshold)}</Text>
                  </View>
                  <View style={s.remainRow}>
                    <Image source={COIN_IMG} style={s.smallCoin} resizeMode="contain" />
                    <Text style={s.remainText}>
                      {formatCoins(Math.max(0, nextThreshold - totalCoins))} to go
                    </Text>
                  </View>
                  <View style={s.progressLabelRow}>
                    <Image source={COIN_IMG} style={s.smallCoin} resizeMode="contain" />
                    <Text style={s.progressLabelCoins}>{formatCoins(nextThreshold)}</Text>
                  </View>
                </View>
              </View>
            </LinearGradient>

            {/* Level rewards */}
            <View style={s.rewardsSection}>
              <Text style={s.rewardsTitle}>Level Rewards</Text>
              <Text style={s.rewardsSub}>Top contributors may win rewards</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.rewardsRow}>
                {LEVEL_REWARDS.map(r => (
                  <View key={r.id} style={[s.rewardCard, { backgroundColor: r.bg }]}>
                    <Text style={s.rewardEmoji}>{r.emoji}</Text>
                    <View style={[s.rewardTag, { backgroundColor: r.tag }]}>
                      <Text style={s.rewardTagText}>1 Day</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>
          </>
        )}

        {/* ── Top Supporters tab ── */}
        {activeTab === 'supporters' && (
          <View style={s.supList}>
            {loadingSup ? (
              <View style={s.supEmpty}>
                <Text style={s.supEmptyText}>Loading…</Text>
              </View>
            ) : supporters.length === 0 ? (
              <View style={s.supEmpty}>
                <Ionicons name="gift-outline" size={44} color="#D8D3EC" />
                <Text style={s.supEmptyText}>No supporters yet</Text>
                <Text style={s.supEmptyHint}>Be the first to send a gift!</Text>
              </View>
            ) : (
              supporters.map((sup, i) => {
                const avatarUri = resolveAvatar(sup.avatar_url);
                const initials = (sup.full_name || sup.username || '?')[0].toUpperCase();
                const isTop3 = i < 3;
                const medals = ['🥇', '🥈', '🥉'];
                return (
                  <View key={sup.id} style={[s.supRow, isTop3 && s.supRowTop]}>
                    {/* Rank */}
                    <View style={s.rankWrap}>
                      {isTop3
                        ? <Text style={s.medal}>{medals[i]}</Text>
                        : <Text style={s.rankNum}>{i + 1}</Text>}
                    </View>

                    {/* Avatar */}
                    <View style={[s.avatar, !avatarUri && { backgroundColor: AVATAR_COLORS[i % 5] }]}>
                      {avatarUri
                        ? <Image source={{ uri: avatarUri }} style={s.avatarImg} />
                        : <Text style={s.avatarInitial}>{initials}</Text>}
                    </View>

                    {/* Name */}
                    <View style={s.supInfo}>
                      <Text style={s.supName} numberOfLines={1}>
                        {sup.full_name || (sup.username ? `@${sup.username}` : 'User')}
                      </Text>
                      {sup.username && sup.full_name && (
                        <Text style={s.supUsername}>@{sup.username}</Text>
                      )}
                    </View>

                    {/* Coins */}
                    <View style={s.supCoins}>
                      <Image source={COIN_IMG} style={s.supCoinImg} resizeMode="contain" />
                      <Text style={[s.supCoinText, isTop3 && s.supCoinTextTop]}>
                        {formatCoins(sup.total_coins)}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F7F4FD' },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#F7F4FD' },
  headerBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700', color: '#1C1E22' },

  // Tabs
  tabBar: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E0DDED', backgroundColor: '#FFFFFF' },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 13, position: 'relative' },
  tabLabel: { fontSize: 15, fontWeight: '500', color: '#7A7A8A' },
  tabLabelActive: { color: '#7A0EED', fontWeight: '700' },
  tabUnderline: { position: 'absolute', bottom: 0, left: 20, right: 20, height: 2.5, borderRadius: 2, backgroundColor: '#7A0EED' },

  // Hero
  hero: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 24,
    paddingHorizontal: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  circle: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(56,189,248,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.1)',
  },
  circleTopRight: { top: -60, right: -60 },
  circleBottomLeft: { bottom: -80, left: -60, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(245,158,11,0.08)' },
  circleSm: { position: 'absolute', width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.12)' },
  circleTopLeft: { top: 20, left: -20 },

  // Top row
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 10,
  },
  levelBadge: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  levelBadgeText: { fontSize: 12, fontWeight: '900', color: '#FFFFFF', letterSpacing: 1 },
  heroCoinsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  heroCoin: { width: 18, height: 18 },
  heroCoins: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },

  // Level image
  levelImg: { width: W * 0.38, height: W * 0.38, marginVertical: 6 },

  // Progress card
  progressCard: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    marginTop: 10,
    gap: 10,
  },
  progressCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressCardTitle: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.7)' },
  progressPercent: { fontSize: 14, fontWeight: '900', color: '#38BDF8' },
  progressLabels: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  progressLabelCoins: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.75)' },
  smallCoin: { width: 11, height: 11 },
  remainRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  remainText: { fontSize: 11, color: '#38BDF8', fontWeight: '600' },

  // Rewards
  rewardsSection: { paddingTop: 20, paddingHorizontal: 16 },
  rewardsTitle: { fontSize: 17, fontWeight: '800', color: '#1C1E22', marginBottom: 3 },
  rewardsSub: { fontSize: 12, color: '#7A7A8A', marginBottom: 14 },
  rewardsRow: { gap: 12, paddingBottom: 8 },
  rewardCard: { width: W * 0.34, height: W * 0.34, borderRadius: 16, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  rewardEmoji: { fontSize: 44 },
  rewardTag: { position: 'absolute', bottom: 8, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  rewardTagText: { fontSize: 10, fontWeight: '700', color: '#FFFFFF' },

  // Supporters
  supList: { paddingTop: 4 },
  supEmpty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 10 },
  supEmptyText: { fontSize: 15, color: '#B0AEC0', fontWeight: '500' },
  supEmptyHint: { fontSize: 12, color: '#C8C5D8' },
  supRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14, gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F0EDF8',
    backgroundColor: '#FFFFFF',
  },
  supRowTop: { backgroundColor: '#FDFAFF' },
  rankWrap: { width: 30, alignItems: 'center' },
  medal: { fontSize: 22 },
  rankNum: { fontSize: 14, fontWeight: '700', color: '#ABADB2' },
  avatar: { width: 46, height: 46, borderRadius: 23, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: 46, height: 46, borderRadius: 23 },
  avatarInitial: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  supInfo: { flex: 1, gap: 2 },
  supName: { fontSize: 15, fontWeight: '700', color: '#1C1E22' },
  supUsername: { fontSize: 12, color: '#ABADB2' },
  supCoins: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  supCoinImg: { width: 16, height: 16 },
  supCoinText: { fontSize: 14, fontWeight: '700', color: '#E8944A' },
  supCoinTextTop: { color: '#7A0EED', fontSize: 15 },
});
