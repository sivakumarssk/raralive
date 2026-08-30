import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
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

type LeaderEntry = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  total_coins: number;
};

type Tab = 'levels' | 'leaderboard';
type Period = 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | '6_months';
type LbTab = 'gifters' | 'supporters';

const PERIODS: { key: Period; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'this_week', label: 'This Week' },
  { key: 'last_week', label: 'Last Week' },
  { key: 'this_month', label: 'This Month' },
  { key: '6_months', label: '6 Months' },
];

const AVATAR_COLORS = ['#F7A8D0', '#A8D0F7', '#A8F7C6', '#F7D6A8', '#D0A8F7'];

function ProgressBar({ progress }: { progress: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: progress, duration: 900, useNativeDriver: false }).start();
  }, [progress]);
  const width = anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'], extrapolate: 'clamp' });
  return (
    <View style={pb.track}>
      <Animated.View style={[pb.fill, { width }]} />
      <Animated.View style={[pb.dot, { left: width as any }]} />
    </View>
  );
}

const pb = StyleSheet.create({
  track: { height: 8, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 4, overflow: 'visible', position: 'relative' },
  fill: { height: '100%', borderRadius: 4, backgroundColor: '#38BDF8' },
  dot: { position: 'absolute', top: -3, width: 14, height: 14, borderRadius: 7, backgroundColor: '#FFFFFF', borderWidth: 3, borderColor: '#38BDF8', marginLeft: -7, elevation: 4 },
});

const LEVEL_REWARDS = [
  { id: '1', emoji: '🚀', label: 'Rocket', bg: '#DDF0FF', tag: '#4A90E2' },
  { id: '2', emoji: '💍', label: 'Ring', bg: '#FFE8F0', tag: '#E85580' },
  { id: '3', emoji: '🏍️', label: 'Bike', bg: '#2A1A3A', tag: '#F5A623' },
  { id: '4', emoji: '💎', label: 'Diamond', bg: '#4A90D9', tag: '#4A90E2' },
];

export function PerformanceScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ roomId: string; level: string; totalCoins: string }>();

  const roomId = params.roomId ?? '';
  const level = parseInt(params.level ?? '0', 10);
  const totalCoins = parseInt(params.totalCoins ?? '0', 10);

  const [activeTab, setActiveTab] = useState<Tab>('levels');
  const [period, setPeriod] = useState<Period>('today');
  const [lbTab, setLbTab] = useState<LbTab>('gifters');
  const [gifters, setGifters] = useState<LeaderEntry[]>([]);
  const [supporters, setSupporters] = useState<LeaderEntry[]>([]);
  const [loadingLb, setLoadingLb] = useState(false);

  const currentThreshold = LEVEL_THRESHOLDS[level] ?? 0;
  const nextThreshold = LEVEL_THRESHOLDS[level + 1] ?? LEVEL_THRESHOLDS[level] ?? 1;
  const coinsIntoLevel = Math.max(0, totalCoins - currentThreshold);
  const coinsNeeded = Math.max(1, nextThreshold - currentThreshold);
  const progress = Math.min(coinsIntoLevel / coinsNeeded, 1);
  const levelImg = getLevelImage(level);

  useEffect(() => {
    if (!roomId || activeTab !== 'leaderboard') return;
    setLoadingLb(true);
    fetch(`${BASE_URL}/rooms/${roomId}/leaderboard?period=${period}`)
      .then(r => r.json())
      .then(j => {
        if (j.success) {
          setGifters(j.data.gifters ?? []);
          setSupporters(j.data.supporters ?? []);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingLb(false));
  }, [roomId, period, activeTab]);

  const TABS: { key: Tab; label: string }[] = [
    { key: 'levels', label: 'Levels' },
    { key: 'leaderboard', label: 'Leaderboard' },
  ];

  const activeList = lbTab === 'gifters' ? gifters : supporters;
  const top3 = activeList.slice(0, 3);
  const rest = activeList.slice(3);

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
            <LinearGradient
              colors={['#0F172A', '#1E3A5F', '#0F2744']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={s.hero}>
              <View style={[s.circle, s.circleTopRight]} />
              <View style={[s.circle, s.circleBottomLeft]} />
              <View style={[s.circleSm, s.circleTopLeft]} />

              <View style={s.heroTopRow}>
                <LinearGradient colors={['#F59E0B', '#EF4444']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.levelBadge}>
                  <Text style={s.levelBadgeText}>LEVEL {level}</Text>
                </LinearGradient>
                <View style={s.heroCoinsBadge}>
                  <Image source={COIN_IMG} style={s.heroCoin} resizeMode="contain" />
                  <Text style={s.heroCoins}>{formatCoins(totalCoins)}</Text>
                </View>
              </View>

              <ExpoImage source={levelImg} style={s.levelImg} contentFit="contain" />

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
                    <Text style={s.remainText}>{formatCoins(Math.max(0, nextThreshold - totalCoins))} to go</Text>
                  </View>
                  <View style={s.progressLabelRow}>
                    <Image source={COIN_IMG} style={s.smallCoin} resizeMode="contain" />
                    <Text style={s.progressLabelCoins}>{formatCoins(nextThreshold)}</Text>
                  </View>
                </View>
              </View>
            </LinearGradient>

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

        {/* ── Leaderboard tab ── */}
        {activeTab === 'leaderboard' && (
          <>
            {/* Dark stage — tabs, period, podium all inside */}
            <LinearGradient
              colors={['#1A0040', '#2D1070', '#1A0040']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={lb.stage}>
              <View style={[lb.decCircle, { top: -30, right: -30 }]} />
              <View style={[lb.decCircle, { bottom: -40, left: -20, width: 120, height: 120, borderRadius: 60 }]} />

              {/* Category tabs inside stage */}
              <View style={lb.catTabBar}>
                <TouchableOpacity
                  style={[lb.catTab, lbTab === 'gifters' && lb.catTabActive]}
                  onPress={() => setLbTab('gifters')} activeOpacity={0.75}>
                  <Text style={[lb.catTabText, lbTab === 'gifters' && lb.catTabTextActive]}>Top Gifters</Text>
                  {lbTab === 'gifters' && <View style={lb.catTabLine} />}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[lb.catTab, lbTab === 'supporters' && lb.catTabActive]}
                  onPress={() => setLbTab('supporters')} activeOpacity={0.75}>
                  <Text style={[lb.catTabText, lbTab === 'supporters' && lb.catTabTextActive]}>Top Supporters</Text>
                  {lbTab === 'supporters' && <View style={lb.catTabLine} />}
                </TouchableOpacity>
              </View>

              {/* Period pills inside stage */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={lb.periodRow}>
                {PERIODS.map(p => (
                  <TouchableOpacity
                    key={p.key}
                    onPress={() => setPeriod(p.key)}
                    activeOpacity={0.8}
                    style={[lb.periodPill, period === p.key && lb.periodPillActive]}>
                    <Text style={[lb.periodText, period === p.key && lb.periodTextActive]}>{p.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Podium — always show 3 slots */}
              {loadingLb ? (
                <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                  <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>Loading…</Text>
                </View>
              ) : (
                <>
                  <View style={lb.podiumRow}>
                    {/* 2nd — left */}
                    <View style={lb.podiumSide}>
                      {top3[1] ? (
                        <>
                          <View style={[lb.podRing, lb.podRingSilver]}>
                            {resolveAvatar(top3[1].avatar_url) ? (
                              <Image source={{ uri: resolveAvatar(top3[1].avatar_url)! }} style={lb.podAvatar} />
                            ) : (
                              <View style={[lb.podAvatar, { backgroundColor: '#C0C0C0', alignItems: 'center', justifyContent: 'center' }]}>
                                <Text style={lb.podInitial}>{(top3[1].full_name || top3[1].username || '?')[0]?.toUpperCase()}</Text>
                              </View>
                            )}
                            <View style={[lb.podRankBadge, { backgroundColor: '#C0C0C0' }]}>
                              <Text style={lb.podRankText}>2</Text>
                            </View>
                          </View>
                          <Text style={lb.podName} numberOfLines={1}>{top3[1].full_name || top3[1].username || 'User'}</Text>
                          <View style={lb.podCoinRow}>
                            <Image source={COIN_IMG} style={lb.podCoinImg} resizeMode="contain" />
                            <Text style={lb.podCoinText}>{formatCoins(Number(top3[1].total_coins))}</Text>
                          </View>
                        </>
                      ) : (
                        <View style={[lb.podRing, lb.podRingSilver, lb.podEmpty]}>
                          <Ionicons name="person-outline" size={22} color="rgba(255,255,255,0.25)" />
                          <View style={[lb.podRankBadge, { backgroundColor: '#C0C0C0' }]}>
                            <Text style={lb.podRankText}>2</Text>
                          </View>
                        </View>
                      )}
                    </View>

                    {/* 1st — center */}
                    <View style={lb.podiumCenter}>
                      {top3[0] ? (
                        <>
                          <View style={[lb.podRing, lb.podRingGold, lb.podRingBig]}>
                            {resolveAvatar(top3[0].avatar_url) ? (
                              <Image source={{ uri: resolveAvatar(top3[0].avatar_url)! }} style={lb.podAvatarBig} />
                            ) : (
                              <View style={[lb.podAvatarBig, { backgroundColor: '#FFD700', alignItems: 'center', justifyContent: 'center' }]}>
                                <Text style={[lb.podInitial, { fontSize: 28 }]}>{(top3[0].full_name || top3[0].username || '?')[0]?.toUpperCase()}</Text>
                              </View>
                            )}
                            <View style={[lb.podRankBadge, lb.podRankBadgeBig, { backgroundColor: '#FFD700' }]}>
                              <Text style={[lb.podRankText, { fontSize: 12 }]}>1</Text>
                            </View>
                          </View>
                          <Text style={[lb.podName, { fontSize: 13 }]} numberOfLines={1}>{top3[0].full_name || top3[0].username || 'User'}</Text>
                          <View style={lb.podCoinRow}>
                            <Image source={COIN_IMG} style={lb.podCoinImg} resizeMode="contain" />
                            <Text style={[lb.podCoinText, { fontSize: 14 }]}>{formatCoins(Number(top3[0].total_coins))}</Text>
                          </View>
                        </>
                      ) : (
                        <View style={[lb.podRing, lb.podRingGold, lb.podRingBig, lb.podEmpty]}>
                          <Ionicons name="person-outline" size={28} color="rgba(255,255,255,0.25)" />
                          <View style={[lb.podRankBadge, lb.podRankBadgeBig, { backgroundColor: '#FFD700' }]}>
                            <Text style={[lb.podRankText, { fontSize: 12 }]}>1</Text>
                          </View>
                        </View>
                      )}
                    </View>

                    {/* 3rd — right */}
                    <View style={lb.podiumSide}>
                      {top3[2] ? (
                        <>
                          <View style={[lb.podRing, lb.podRingBronze]}>
                            {resolveAvatar(top3[2].avatar_url) ? (
                              <Image source={{ uri: resolveAvatar(top3[2].avatar_url)! }} style={lb.podAvatar} />
                            ) : (
                              <View style={[lb.podAvatar, { backgroundColor: '#CD7F32', alignItems: 'center', justifyContent: 'center' }]}>
                                <Text style={lb.podInitial}>{(top3[2].full_name || top3[2].username || '?')[0]?.toUpperCase()}</Text>
                              </View>
                            )}
                            <View style={[lb.podRankBadge, { backgroundColor: '#CD7F32' }]}>
                              <Text style={lb.podRankText}>3</Text>
                            </View>
                          </View>
                          <Text style={lb.podName} numberOfLines={1}>{top3[2].full_name || top3[2].username || 'User'}</Text>
                          <View style={lb.podCoinRow}>
                            <Image source={COIN_IMG} style={lb.podCoinImg} resizeMode="contain" />
                            <Text style={lb.podCoinText}>{formatCoins(Number(top3[2].total_coins))}</Text>
                          </View>
                        </>
                      ) : (
                        <View style={[lb.podRing, lb.podRingBronze, lb.podEmpty]}>
                          <Ionicons name="person-outline" size={22} color="rgba(255,255,255,0.25)" />
                          <View style={[lb.podRankBadge, { backgroundColor: '#CD7F32' }]}>
                            <Text style={lb.podRankText}>3</Text>
                          </View>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Podium blocks */}
                  <View style={lb.podiumBlocks}>
                    <View style={[lb.podBlock, lb.podBlock2]} />
                    <View style={[lb.podBlock, lb.podBlock1]} />
                    <View style={[lb.podBlock, lb.podBlock3]} />
                  </View>
                </>
              )}
            </LinearGradient>

            {/* Ranked list — #4 onwards on light bg */}
            {rest.length > 0 && (
              <View style={lb.listSection}>
                {rest.map((entry, i) => {
                  const rank = i + 4;
                  const uri = resolveAvatar(entry.avatar_url);
                  const name = entry.full_name || entry.username || 'User';
                  const initials = name[0]?.toUpperCase() ?? '?';
                  return (
                    <View key={entry.id} style={lb.listRow}>
                      <View style={lb.listRankWrap}>
                        <Text style={lb.listRankNum}>{rank}</Text>
                      </View>
                      <View style={[lb.listAvatar, !uri && { backgroundColor: AVATAR_COLORS[rank % 5] }]}>
                        {uri ? (
                          <Image source={{ uri }} style={lb.listAvatarImg} />
                        ) : (
                          <Text style={lb.listAvatarInitial}>{initials}</Text>
                        )}
                      </View>
                      <View style={lb.listInfo}>
                        <Text style={lb.listName} numberOfLines={1}>{name}</Text>
                        {entry.username && entry.full_name && (
                          <Text style={lb.listUsername}>@{entry.username}</Text>
                        )}
                      </View>
                      <View style={lb.listCoins}>
                        <Image source={COIN_IMG} style={lb.listCoinImg} resizeMode="contain" />
                        <Text style={lb.listCoinText}>{formatCoins(Number(entry.total_coins))}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {!loadingLb && activeList.length === 0 && (
              <View style={s.emptyWrap}>
                <Ionicons name="trophy-outline" size={44} color="#D8D3EC" />
                <Text style={s.emptyText}>No data for this period</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFFFFF' },
  headerBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700', color: '#1C1E22' },

  tabBar: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E0DDED', backgroundColor: '#FFFFFF' },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 13, position: 'relative' },
  tabLabel: { fontSize: 15, fontWeight: '500', color: '#7A7A8A' },
  tabLabelActive: { color: '#7A0EED', fontWeight: '700' },
  tabUnderline: { position: 'absolute', bottom: 0, left: 20, right: 20, height: 2.5, borderRadius: 2, backgroundColor: '#7A0EED' },

  // Hero
  hero: { alignItems: 'center', paddingTop: 20, paddingBottom: 24, paddingHorizontal: 20, position: 'relative', overflow: 'hidden' },
  circle: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(56,189,248,0.12)', borderWidth: 1, borderColor: 'rgba(56,189,248,0.1)' },
  circleTopRight: { top: -60, right: -60 },
  circleBottomLeft: { bottom: -80, left: -60, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(245,158,11,0.08)' },
  circleSm: { position: 'absolute', width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.12)' },
  circleTopLeft: { top: 20, left: -20 },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: 10 },
  levelBadge: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  levelBadgeText: { fontSize: 12, fontWeight: '900', color: '#FFFFFF', letterSpacing: 1 },
  heroCoinsBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  heroCoin: { width: 18, height: 18 },
  heroCoins: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  levelImg: { width: W * 0.38, height: W * 0.38, marginVertical: 6 },
  progressCard: { width: '100%', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', marginTop: 10, gap: 10 },
  progressCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
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

  emptyWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 10 },
  emptyText: { fontSize: 14, color: '#ABADB2', fontWeight: '500' },
});

const lb = StyleSheet.create({
  // Full dark stage container
  stage: {
    paddingTop: 14, paddingBottom: 0, paddingHorizontal: 0,
    position: 'relative', overflow: 'hidden',
  },
  decCircle: { position: 'absolute', width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(122,14,237,0.12)' },

  // Category tabs inside stage
  catTabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)',
    marginBottom: 14,
    gap: 16,
    paddingHorizontal: 16,
  },
  catTab: { flex: 1, alignItems: 'center', paddingVertical: 14, position: 'relative' },
  catTabActive: {},
  catTabText: { fontSize: 14, fontWeight: '500', color: 'rgba(255,255,255,0.45)' },
  catTabTextActive: { color: '#FFFFFF', fontWeight: '700' },
  catTabLine: {
    position: 'absolute', bottom: -1, left: 20, right: 20,
    height: 2.5, borderRadius: 2, backgroundColor: '#FFFFFF',
  },

  // Period pills inside stage
  periodRow: { paddingHorizontal: 16, paddingBottom: 16,paddingTop: 16, gap: 6 },
  periodPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  periodPillActive: { backgroundColor: 'rgba(255,255,255,0.18)', borderColor: 'rgba(255,255,255,0.35)' },
  periodText: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.4)' },
  periodTextActive: { color: '#FFFFFF', fontWeight: '700' },

  podiumRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', paddingVertical: 12, paddingTop: 18 },
  podiumSide: { flex: 1, alignItems: 'center', gap: 4, marginTop: 24 },
  podiumCenter: { flex: 1.2, alignItems: 'center', gap: 4 },

  podRing: { borderWidth: 3, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  podRingGold: { borderColor: '#FFD700', width: 70, height: 70, borderRadius: 35 },
  podRingSilver: { borderColor: '#C0C0C0', width: 58, height: 58, borderRadius: 29 },
  podRingBronze: { borderColor: '#CD7F32', width: 58, height: 58, borderRadius: 29 },
  podRingBig: { width: 78, height: 78, borderRadius: 39, borderWidth: 4 },

  podEmpty: { backgroundColor: 'rgba(255,255,255,0.06)' },
  podAvatar: { width: 52, height: 52, borderRadius: 26 },
  podAvatarBig: { width: 68, height: 68, borderRadius: 34 },
  podInitial: { fontSize: 22, fontWeight: '800', color: '#FFFFFF' },

  podRankBadge: {
    position: 'absolute', bottom: -6,
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#1A0040',
  },
  podRankBadgeBig: { width: 24, height: 24, borderRadius: 12, bottom: -8 },
  podRankText: { fontSize: 10, fontWeight: '900', color: '#1A0040' },

  podName: { fontSize: 11, fontWeight: '700', color: '#FFFFFF', textAlign: 'center', maxWidth: 90, marginTop: 4 },
  podCoinRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  podCoinImg: { width: 14, height: 14 },
  podCoinText: { fontSize: 12, fontWeight: '800', color: '#FFD700' },

  // Podium blocks (decorative platform)
  podiumBlocks: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 8 },
  podBlock: { flex: 1, borderTopLeftRadius: 8, borderTopRightRadius: 8 },
  podBlock1: { height: 48, backgroundColor: 'rgba(255,215,0,0.2)' },
  podBlock2: { height: 36, backgroundColor: 'rgba(192,192,192,0.15)' },
  podBlock3: { height: 28, backgroundColor: 'rgba(205,127,50,0.15)' },

  // Ranked list
  listSection: {
    marginHorizontal: 16, marginTop: 16,
    backgroundColor: '#FFFFFF', borderRadius: 18,
    borderWidth: 1, borderColor: '#EDE8F7', overflow: 'hidden',
  },
  listRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F0EDF8',
  },
  listRankWrap: { width: 28, alignItems: 'center' },
  listRankNum: { fontSize: 14, fontWeight: '700', color: '#ABADB2' },
  listAvatar: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  listAvatarImg: { width: 44, height: 44, borderRadius: 22 },
  listAvatarInitial: { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },
  listInfo: { flex: 1, gap: 2 },
  listName: { fontSize: 14, fontWeight: '700', color: '#1C1E22' },
  listUsername: { fontSize: 11, color: '#ABADB2' },
  listCoins: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  listCoinImg: { width: 18, height: 18 },
  listCoinText: { fontSize: 15, fontWeight: '800', color: '#E8944A' },
});
