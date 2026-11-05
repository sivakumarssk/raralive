import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BASE_URL } from '@/services/api';
import { authStore } from '@/store/auth-store';
import { formatInr, formatN } from '@/screens/wallet/earnings-shared';
import { RS, RT } from '../room-ui';

// Gift Progress: the user's Audio Chat monthly earning slabs (same data as the
// wallet's Audio Chat Rooms screen). Gems from chat-room gifts count towards
// the slabs and reset at month end.

type Slab = { name: string; gems: number; payout: number; bonus: number; reached: boolean };

export type GiftSlabProgress = {
  month_gems: number;
  current_slab: string | null;
  next_slab: { name: string; gems: number } | null;
  slabs: Slab[];
};

/** Fetches the chat-room slab summary; `reload` re-fetches (e.g. on modal open). */
export function useGiftSlabProgress() {
  const [data, setData] = useState<GiftSlabProgress | null>(null);

  const reload = useCallback(() => {
    const token = authStore.getToken();
    if (!token) return;
    fetch(`${BASE_URL}/tasks/earnings/chatroom?summary=1`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(j => { if (j.success) setData(j.data); })
      .catch(() => {});
  }, []);

  useEffect(() => { reload(); }, [reload]);

  return { data, reload };
}

/** 0–100: progress towards the next slab target (100 when all slabs are done). */
export function slabProgressPct(data: GiftSlabProgress | null): number {
  if (!data) return 0;
  if (!data.next_slab) return 100;
  return Math.min(100, (data.month_gems / data.next_slab.gems) * 100);
}

type Props = {
  visible: boolean;
  onClose: () => void;
  data: GiftSlabProgress | null;
};

export function CoinBoxModal({ visible, onClose, data }: Props) {
  const scale = useRef(new Animated.Value(0.9)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  function open() {
    scale.setValue(0.9); opacity.setValue(0);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 80, friction: 9 }),
      Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }),
    ]).start();
  }

  function close() {
    Animated.timing(opacity, { toValue: 0, duration: 140, useNativeDriver: true }).start(onClose);
  }

  const slabs = data?.slabs ?? [];
  const reachedCount = slabs.filter(sl => sl.reached).length;
  const nextIdx = slabs.findIndex(sl => !sl.reached);   // -1 when every slab is done
  const next = nextIdx >= 0 ? slabs[nextIdx] : null;
  const gems = data?.month_gems ?? 0;
  const pct = slabProgressPct(data);

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={close} onShow={open}>
      <Animated.View style={[s.backdrop, { opacity }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={close} />

        <Animated.View style={[s.card, { transform: [{ scale }] }]}>
          {/* Header */}
          <View style={s.header}>
            <View style={s.headerText}>
              <Text style={s.title}>Gift Progress</Text>
              <Text style={s.subtitle}>Your gift slab progress · This month</Text>
            </View>
            <TouchableOpacity onPress={close} hitSlop={10} style={s.closeBtn}>
              <Ionicons name="close" size={16} color="#60626A" />
            </TouchableOpacity>
          </View>

          {!data ? (
            <ActivityIndicator color="#7A0EED" style={{ marginVertical: 40 }} />
          ) : slabs.length === 0 ? (
            <View style={s.unset}>
              <Text style={s.unsetEmoji}>🎁</Text>
              <Text style={s.unsetText}>Gift slabs aren't set up yet. Check back soon.</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
              {/* Current slab + progress */}
              <View style={s.progressCard}>
                <View style={s.currentRow}>
                  <LinearGradient colors={['#9B4DFF', '#7A0EED']} style={s.badge}>
                    <Text style={s.badgeNum}>{reachedCount}</Text>
                  </LinearGradient>
                  <View style={{ flex: 1 }}>
                    <Text style={s.badgeLabel}>Current slab</Text>
                    <Text style={s.progressAmount}>
                      {formatN(gems)}
                      <Text style={s.progressTarget}> / {formatN(next?.gems ?? gems)} gems</Text>
                    </Text>
                  </View>
                  <Text style={s.pct}>{Math.floor(pct)}%</Text>
                </View>
                <View style={s.track}>
                  <LinearGradient
                    colors={['#7A0EED', '#B57BFF']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={[s.fill, { width: `${pct}%` }]}
                  />
                </View>
              </View>

              {/* Next target / remaining */}
              <View style={s.statsRow}>
                <View style={s.statTile}>
                  <Text style={s.statLabel}>Next slab target</Text>
                  <Text style={[s.statValue, { color: '#7A0EED' }]}>
                    {next ? formatN(next.gems) : 'Completed'}
                  </Text>
                </View>
                <View style={s.statTile}>
                  <Text style={s.statLabel}>Remaining gems</Text>
                  <Text style={[s.statValue, { color: '#F5457A' }]}>
                    {next ? formatN(next.gems - gems) : '0'}
                  </Text>
                </View>
              </View>

              {/* Slab rewards */}
              <Text style={s.sectionTitle}>Slab Rewards</Text>
              <View style={s.table}>
                {slabs.map((sl, i) => {
                  const isNext = i === nextIdx;
                  const isTop = i === slabs.length - 1;
                  return (
                    <View key={sl.name} style={[s.row, i < slabs.length - 1 && s.rowBorder, isNext && s.rowNext]}>
                      <Text style={[s.rowName, isNext && s.rowTextNext]}>Slab {i + 1}</Text>
                      <Text style={[s.rowGems, isNext && s.rowTextNext]}>{formatN(sl.gems)} gems</Text>
                      <View style={s.rowCheck}>
                        {sl.reached && <Ionicons name="checkmark-circle" size={16} color="#22B45A" />}
                      </View>
                      <View style={s.rowReward}>
                        {isTop && <Text style={s.crown}>👑</Text>}
                        <Text style={[s.rewardText, sl.reached && s.rewardTextDone]}>
                          {formatInr(sl.payout + sl.bonus).replace(' ', '')}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>

              {/* Next reward */}
              <View style={s.banner}>
                <Text style={s.bannerEmoji}>🎁</Text>
                <View style={{ flex: 1 }}>
                  {next ? (
                    <>
                      <Text style={s.bannerText}>Complete the next slab to earn</Text>
                      <Text style={s.bannerHighlight}>
                        {formatInr(next.payout + next.bonus).replace(' ', '')} in your wallet
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text style={s.bannerText}>All slabs completed!</Text>
                      <Text style={s.bannerHighlight}>Slabs reset at month end</Text>
                    </>
                  )}
                </View>
              </View>
            </ScrollView>
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  unset: { alignItems: 'center', gap: 6, paddingVertical: 28 },
  unsetEmoji: { fontSize: 28 },
  unsetText: { fontSize: RT.body, color: '#60626A', textAlign: 'center' },
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20,
  },
  card: {
    width: '100%', maxWidth: 380, maxHeight: '82%',
    backgroundColor: '#FFFFFF', borderRadius: RS.cardRadius, padding: RS.pad,
    elevation: 12,
  },

  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  headerText: { flex: 1 },
  title: { fontSize: RT.title, fontWeight: '700', color: '#1C1E22' },
  subtitle: { fontSize: RT.secondary, color: '#8A8C93', marginTop: 2 },
  closeBtn: {
    width: RS.close, height: RS.close, borderRadius: RS.close / 2, backgroundColor: '#F4F3F8',
    alignItems: 'center', justifyContent: 'center',
  },

  progressCard: { backgroundColor: '#F7F3FF', borderRadius: 14, padding: 12, gap: 10 },
  currentRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  badge: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  badgeNum: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  badgeLabel: { fontSize: RT.secondary, color: '#8A8C93' },
  progressAmount: { fontSize: 18, fontWeight: '800', color: '#1C1E22', marginTop: 1 },
  progressTarget: { fontSize: RT.secondary + 1, fontWeight: '500', color: '#8A8C93' },
  pct: { fontSize: RT.body, fontWeight: '800', color: '#7A0EED' },
  track: { height: 8, borderRadius: 4, backgroundColor: '#E8E0FA', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },

  statsRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  statTile: {
    flex: 1, gap: 2, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12,
    borderWidth: 1, borderColor: '#EEEBF6', backgroundColor: '#FFFFFF',
  },
  statLabel: { fontSize: RT.secondary, color: '#8A8C93' },
  statValue: { fontSize: 16, fontWeight: '800' },

  sectionTitle: { fontSize: RT.section, fontWeight: '700', color: '#1C1E22', marginTop: 16, marginBottom: 8 },
  table: { borderRadius: 12, borderWidth: 1, borderColor: '#EEEBF6', overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10 },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EEEBF6' },
  // Next slab to reach: light purple with a purple edge
  rowNext: { backgroundColor: '#F4EEFF', borderLeftWidth: 3, borderLeftColor: '#7A0EED', paddingLeft: 9 },
  rowName: { width: 56, fontSize: 13, fontWeight: '600', color: '#3A3C42' },
  rowGems: { flex: 1, fontSize: 13, color: '#60626A' },
  rowTextNext: { color: '#5A0BB0', fontWeight: '700' },
  rowCheck: { width: 22, alignItems: 'center' },
  rowReward: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, minWidth: 84 },
  crown: { fontSize: 13 },
  rewardText: { fontSize: 13, fontWeight: '800', color: '#E8944A' },
  rewardTextDone: { color: '#22B45A' },

  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14,
    borderRadius: 12, borderWidth: 1, borderColor: '#FFE3C2', backgroundColor: '#FFF7EC',
    paddingHorizontal: 12, paddingVertical: 10,
  },
  bannerEmoji: { fontSize: 22 },
  bannerText: { fontSize: RT.secondary, color: '#60626A' },
  bannerHighlight: { fontSize: RT.body, fontWeight: '800', color: '#E8944A', marginTop: 2 },
});
