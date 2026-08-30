import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BASE_URL, MEDIA_BASE } from '@/services/api';

const COIN_IMG = require('@/assets/tabs/coin.png');

type RoomEntry = {
  id: string;
  room_name: string | null;
  room_image_url: string | null;
  total_coins: number;
};

type UserEntry = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  total_coins: number;
};

type LbTab = 'rooms' | 'gifters' | 'receivers' | 'battles' | 'battleSupporters';
type Period = 'today' | 'this_week' | 'this_month' | 'this_year';

const TABS: { key: LbTab; label: string }[] = [
  { key: 'rooms', label: 'Top Chatroom' },
  { key: 'gifters', label: 'Chatroom Top Gifters' },
  { key: 'receivers', label: 'Chatroom Top Receivers' },
  { key: 'battles', label: 'Chatroom Battle Winners' },
  { key: 'battleSupporters', label: 'Chatroom Battle Supporters' },
];

// Endpoint path per tab, all under /rooms — matches the backend routes.
const TAB_ENDPOINT: Record<LbTab, string> = {
  rooms: 'top-gifted',
  gifters: 'top-supporters',
  receivers: 'top-receivers',
  battles: 'top-battle-winners',
  battleSupporters: 'top-battle-supporters',
};

// Distinct stage gradient per tab, so switching tabs is visually obvious.
const STAGE_COLORS: Record<LbTab, [string, string, string]> = {
  rooms: ['#1A0040', '#2D1070', '#1A0040'],
  gifters: ['#3A0A1A', '#7A0E2D', '#3A0A1A'],
  receivers: ['#062A2E', '#0E5C61', '#062A2E'],
  battles: ['#2A1A00', '#7A4E0E', '#2A1A00'],
  battleSupporters: ['#1A0026', '#5C0E7A', '#1A0026'],
};

const STAGE_TITLES: Record<LbTab, string> = {
  rooms: 'Top Gifted Chat Rooms',
  gifters: 'Top Gifters',
  receivers: 'Top Receivers',
  battles: 'Top Battle Winners',
  battleSupporters: 'Top Battle Supporters',
};

const EMPTY_MESSAGES: Record<LbTab, string> = {
  rooms: 'No gifted rooms for this period',
  gifters: 'No gifters for this period',
  receivers: 'No receivers for this period',
  battles: 'No battle wins for this period',
  battleSupporters: 'No battle supporters for this period',
};

// Rooms + battle-winner rooms show a coin/trophy metric with an icon; gifters/receivers are users shown with coins.
const METRIC_UNIT: Record<LbTab, 'coins' | 'wins'> = {
  rooms: 'coins',
  gifters: 'coins',
  receivers: 'coins',
  battles: 'wins',
  battleSupporters: 'coins',
};

function formatMetric(unit: 'coins' | 'wins', n: number) {
  if (unit === 'wins') return `${n} win${n === 1 ? '' : 's'}`;
  return formatCoins(n);
}

const PERIODS: { key: Period; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'this_week', label: 'This Week' },
  { key: 'this_month', label: 'This Month' },
  { key: 'this_year', label: 'This Year' },
];

function formatCoins(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function resolveImage(url: string | null | undefined) {
  if (!url) return null;
  return url.startsWith('http') ? url : `${MEDIA_BASE}/${url.replace(/^\//, '')}`;
}

// Normalized shape both room and user entries render through the podium/list.
type Entry = {
  id: string;
  name: string;
  imageUri: string | null;
  totalCoins: number;
};

function roomToEntry(r: RoomEntry): Entry {
  return { id: r.id, name: r.room_name || 'Room', imageUri: resolveImage(r.room_image_url), totalCoins: Number(r.total_coins) };
}

function userToEntry(u: UserEntry): Entry {
  return { id: u.id, name: u.full_name || u.username || 'User', imageUri: resolveImage(u.avatar_url), totalCoins: Number(u.total_coins) };
}

export function LeaderboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<LbTab>('rooms');
  const stageColors = STAGE_COLORS[tab];
  const [period, setPeriod] = useState<Period>('today');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    const path = TAB_ENDPOINT[tab];
    fetch(`${BASE_URL}/rooms/${path}?period=${period}&limit=10`)
      .then(r => r.json())
      .then(j => {
        if (!j.success) return;
        const raw = (j.data ?? []) as (RoomEntry | UserEntry)[];
        const isRoomData = tab === 'rooms' || tab === 'battles';
        setEntries(isRoomData ? raw.map(e => roomToEntry(e as RoomEntry)) : raw.map(e => userToEntry(e as UserEntry)));
      })
      .catch(() => {})
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  };

  useEffect(() => {
    load();
  }, [tab, period]);

  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);
  const isRoomTab = tab === 'rooms' || tab === 'battles';
  const fallbackIcon = isRoomTab ? 'chatbubbles' : 'person';
  const metricUnit = METRIC_UNIT[tab];

  const goToEntry = (entry: Entry) => {
    if (isRoomTab) router.push(`/room/${entry.id}` as any);
  };

  return (
    <View style={s.root}>
      <StatusBar style="light" translucent backgroundColor="transparent" />
      {/* Header + tab bar share one continuous gradient with the stage below, so the whole top
          block (status bar → header → tabs → podium) recolors together per active tab. */}
      <LinearGradient
        colors={stageColors}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top }}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.headerBtn} hitSlop={8}>
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={s.headerTitleLight}>Leaderboard</Text>
        </View>

        {/* Tab bar — switches which stage color + dataset is shown */}
        <View style={s.tabBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabBarContent}>
            {TABS.map(t => (
              <TouchableOpacity key={t.key} style={s.tabBtn} onPress={() => setTab(t.key)} activeOpacity={0.75}>
                <Text style={[s.tabLabelLight, tab === t.key && s.tabLabelLightActive]}>{t.label}</Text>
                {tab === t.key && <View style={s.tabUnderlineLight} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </LinearGradient>

      <ScrollView
        style={{ backgroundColor: '#FFFFFF' }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}>
        {/* Dark stage — period pills + podium, color keyed to active tab */}
        <LinearGradient
          colors={STAGE_COLORS[tab]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={lb.stage}>
          <View style={[lb.decCircle, { top: -30, right: -30 }]} />
          <View style={[lb.decCircle, { bottom: -40, left: -20, width: 120, height: 120, borderRadius: 60 }]} />

          <Text style={lb.stageTitle}>{STAGE_TITLES[tab]}</Text>

          {/* Period pills */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ width: '100%' }} contentContainerStyle={lb.periodRow}>
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
          {loading ? (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>Loading…</Text>
            </View>
          ) : (
            <>
              <View style={lb.podiumRow}>
                {/* 2nd — left */}
                <View style={lb.podiumSide}>
                  {top3[1] ? (
                    <TouchableOpacity activeOpacity={0.8} onPress={() => goToEntry(top3[1])} disabled={!isRoomTab}>
                      <View style={[lb.podRing, lb.podRingSilver]}>
                        {top3[1].imageUri ? (
                          <Image source={{ uri: top3[1].imageUri }} style={lb.podAvatar} />
                        ) : (
                          <View style={[lb.podAvatar, lb.podAvatarFallback]}>
                            <Ionicons name={fallbackIcon as any} size={20} color="#FFFFFF" />
                          </View>
                        )}
                        <View style={[lb.podRankBadge, { backgroundColor: '#C0C0C0' }]}>
                          <Text style={lb.podRankText}>2</Text>
                        </View>
                      </View>
                      <Text style={lb.podName} numberOfLines={1}>{top3[1].name}</Text>
                      <View style={lb.podCoinRow}>
                        {metricUnit === 'wins' ? (
                          <Ionicons name="trophy" size={13} color="#FFD700" />
                        ) : (
                          <Image source={COIN_IMG} style={lb.podCoinImg} resizeMode="contain" />
                        )}
                        <Text style={lb.podCoinText}>{formatMetric(metricUnit, top3[1].totalCoins)}</Text>
                      </View>
                    </TouchableOpacity>
                  ) : (
                    <View style={[lb.podRing, lb.podRingSilver, lb.podEmpty]}>
                      <Ionicons name={`${fallbackIcon}-outline` as any} size={22} color="rgba(255,255,255,0.25)" />
                      <View style={[lb.podRankBadge, { backgroundColor: '#C0C0C0' }]}>
                        <Text style={lb.podRankText}>2</Text>
                      </View>
                    </View>
                  )}
                </View>

                {/* 1st — center */}
                <View style={lb.podiumCenter}>
                  {top3[0] ? (
                    <TouchableOpacity activeOpacity={0.8} onPress={() => goToEntry(top3[0])} disabled={!isRoomTab}>
                      <View style={[lb.podRing, lb.podRingGold, lb.podRingBig]}>
                        {top3[0].imageUri ? (
                          <Image source={{ uri: top3[0].imageUri }} style={lb.podAvatarBig} />
                        ) : (
                          <View style={[lb.podAvatarBig, lb.podAvatarFallback]}>
                            <Ionicons name={fallbackIcon as any} size={26} color="#FFFFFF" />
                          </View>
                        )}
                        <View style={[lb.podRankBadge, lb.podRankBadgeBig, { backgroundColor: '#FFD700' }]}>
                          <Text style={[lb.podRankText, { fontSize: 12 }]}>1</Text>
                        </View>
                      </View>
                      <Text style={[lb.podName, { fontSize: 13 }]} numberOfLines={1}>{top3[0].name}</Text>
                      <View style={lb.podCoinRow}>
                        {metricUnit === 'wins' ? (
                          <Ionicons name="trophy" size={15} color="#FFD700" />
                        ) : (
                          <Image source={COIN_IMG} style={lb.podCoinImg} resizeMode="contain" />
                        )}
                        <Text style={[lb.podCoinText, { fontSize: 14 }]}>{formatMetric(metricUnit, top3[0].totalCoins)}</Text>
                      </View>
                    </TouchableOpacity>
                  ) : (
                    <View style={[lb.podRing, lb.podRingGold, lb.podRingBig, lb.podEmpty]}>
                      <Ionicons name={`${fallbackIcon}-outline` as any} size={28} color="rgba(255,255,255,0.25)" />
                      <View style={[lb.podRankBadge, lb.podRankBadgeBig, { backgroundColor: '#FFD700' }]}>
                        <Text style={[lb.podRankText, { fontSize: 12 }]}>1</Text>
                      </View>
                    </View>
                  )}
                </View>

                {/* 3rd — right */}
                <View style={lb.podiumSide}>
                  {top3[2] ? (
                    <TouchableOpacity activeOpacity={0.8} onPress={() => goToEntry(top3[2])} disabled={!isRoomTab}>
                      <View style={[lb.podRing, lb.podRingBronze]}>
                        {top3[2].imageUri ? (
                          <Image source={{ uri: top3[2].imageUri }} style={lb.podAvatar} />
                        ) : (
                          <View style={[lb.podAvatar, lb.podAvatarFallback]}>
                            <Ionicons name={fallbackIcon as any} size={20} color="#FFFFFF" />
                          </View>
                        )}
                        <View style={[lb.podRankBadge, { backgroundColor: '#CD7F32' }]}>
                          <Text style={lb.podRankText}>3</Text>
                        </View>
                      </View>
                      <Text style={lb.podName} numberOfLines={1}>{top3[2].name}</Text>
                      <View style={lb.podCoinRow}>
                        {metricUnit === 'wins' ? (
                          <Ionicons name="trophy" size={13} color="#FFD700" />
                        ) : (
                          <Image source={COIN_IMG} style={lb.podCoinImg} resizeMode="contain" />
                        )}
                        <Text style={lb.podCoinText}>{formatMetric(metricUnit, top3[2].totalCoins)}</Text>
                      </View>
                    </TouchableOpacity>
                  ) : (
                    <View style={[lb.podRing, lb.podRingBronze, lb.podEmpty]}>
                      <Ionicons name={`${fallbackIcon}-outline` as any} size={22} color="rgba(255,255,255,0.25)" />
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
              return (
                <TouchableOpacity
                  key={entry.id}
                  style={lb.listRow}
                  activeOpacity={isRoomTab ? 0.75 : 1}
                  onPress={() => goToEntry(entry)}
                  disabled={!isRoomTab}>
                  <View style={lb.listRankWrap}>
                    <Text style={lb.listRankNum}>{rank}</Text>
                  </View>
                  <View style={[lb.listAvatar, !entry.imageUri && lb.listAvatarFallback]}>
                    {entry.imageUri ? (
                      <Image source={{ uri: entry.imageUri }} style={lb.listAvatarImg} />
                    ) : (
                      <Ionicons name={fallbackIcon as any} size={20} color="#7A0EED" />
                    )}
                  </View>
                  <View style={lb.listInfo}>
                    <Text style={lb.listName} numberOfLines={1}>{entry.name}</Text>
                  </View>
                  <View style={lb.listCoins}>
                    {metricUnit === 'wins' ? (
                      <Ionicons name="trophy" size={16} color="#E8944A" />
                    ) : (
                      <Image source={COIN_IMG} style={lb.listCoinImg} resizeMode="contain" />
                    )}
                    <Text style={lb.listCoinText}>{formatMetric(metricUnit, entry.totalCoins)}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {!loading && entries.length === 0 && (
          <View style={s.emptyWrap}>
            <Ionicons name="trophy-outline" size={44} color="#D8D3EC" />
            <Text style={s.emptyText}>{EMPTY_MESSAGES[tab]}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  headerBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitleLight: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', marginLeft: 4 },

  tabBar: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.15)' },
  tabBarContent: { flexDirection: 'row', paddingHorizontal: 8 },
  tabBtn: { alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, position: 'relative' },
  tabLabelLight: { fontSize: 15, fontWeight: '500', color: 'rgba(255,255,255,0.55)' },
  tabLabelLightActive: { color: '#FFFFFF', fontWeight: '700' },
  tabUnderlineLight: { position: 'absolute', bottom: 0, left: 16, right: 16, height: 2.5, borderRadius: 2, backgroundColor: '#FFFFFF' },

  emptyWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 10 },
  emptyText: { fontSize: 14, color: '#ABADB2', fontWeight: '500' },
});

const lb = StyleSheet.create({
  stage: {
    paddingTop: 14, paddingBottom: 0, paddingHorizontal: 0,
    position: 'relative', overflow: 'hidden',
  },
  decCircle: { position: 'absolute', width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.08)' },

  stageTitle: { fontSize: 15, fontWeight: '800', color: '#FFFFFF', textAlign: 'center', marginBottom: 14 },

  periodRow: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 16, paddingBottom: 16, gap: 6 },
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
  podAvatarFallback: { backgroundColor: '#7A0EED', alignItems: 'center', justifyContent: 'center' },

  podRankBadge: {
    position: 'absolute', bottom: -6,
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#1A0040',
  },
  podRankBadgeBig: { width: 24, height: 24, borderRadius: 12, bottom: -8 },
  podRankText: { fontSize: 10, fontWeight: '900', color: '#1A0040' },

  podName: { fontSize: 11, fontWeight: '700', color: '#FFFFFF', textAlign: 'center', maxWidth: 90, marginTop: 4 },
  podCoinRow: { flexDirection: 'row', alignItems: 'center', gap: 3, justifyContent: 'center' },
  podCoinImg: { width: 14, height: 14 },
  podCoinText: { fontSize: 12, fontWeight: '800', color: '#FFD700' },

  podiumBlocks: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 8 },
  podBlock: { flex: 1, borderTopLeftRadius: 8, borderTopRightRadius: 8 },
  podBlock1: { height: 48, backgroundColor: 'rgba(255,215,0,0.2)' },
  podBlock2: { height: 36, backgroundColor: 'rgba(192,192,192,0.15)' },
  podBlock3: { height: 28, backgroundColor: 'rgba(205,127,50,0.15)' },

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
  listAvatarFallback: { backgroundColor: '#EDE8F7' },
  listInfo: { flex: 1, gap: 2 },
  listName: { fontSize: 14, fontWeight: '700', color: '#1C1E22' },
  listCoins: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  listCoinImg: { width: 18, height: 18 },
  listCoinText: { fontSize: 15, fontWeight: '800', color: '#E8944A' },
});
