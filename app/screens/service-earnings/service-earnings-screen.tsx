import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BASE_URL } from '@/services/api';
import { authStore } from '@/store/auth-store';
import {
  SOURCE_BY_KEY, formatCallDuration, formatGemValue, formatInr, formatN, formatTxnTime, gemValue, monthLabel,
  type EarningSource,
} from '@/screens/wallet/earnings-shared';

type Slab = {
  name: string; gems: number; payout: number; bonus: number;
  reached: boolean; achieved_at: string | null;
};

type HistoryItem = {
  id: string; kind: 'gift' | 'call'; gift_name: string | null; quantity: number;
  gems: number; created_at: string;
  person_name: string | null; person_username: string | null;
  duration_seconds: number | null; call_type: 'audio' | 'video' | null;
};

type HistoryMonth = {
  month: string; gems: number; slab: string | null; earnings: number;
  items: HistoryItem[]; current: boolean;
};

type SourceEarnings = {
  source: EarningSource; month: string; month_gems: number; month_earnings: number;
  current_slab: string | null; next_slab: { name: string; gems: number } | null;
  configured: boolean; gems_per_coin: number | null;
  bonus_pct: number | null; slabs: Slab[]; history_months: HistoryMonth[];
};

type Tab = 'slabs' | 'history';

export function ServiceEarningsScreen() {
  const router = useRouter();
  const { source } = useLocalSearchParams<{ source: EarningSource }>();
  const meta = SOURCE_BY_KEY[source as EarningSource] ?? SOURCE_BY_KEY.chatroom;
  const [data, setData] = useState<SourceEarnings | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('slabs');
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const token = authStore.getToken();
    if (!token) { setLoading(false); return; }
    fetch(`${BASE_URL}/tasks/earnings/${meta.key}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(j => { if (j.success) setData(j.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [meta.key]);

  const gems = data?.month_gems ?? 0;
  const next = data?.next_slab ?? null;
  const prevTarget = data?.slabs.filter(sl => sl.reached).pop()?.gems ?? 0;
  const progress = next ? Math.min(100, ((gems - prevTarget) / (next.gems - prevTarget)) * 100) : 100;
  const value = data ? gemValue(data.slabs, data.current_slab) : null;
  const configured = !!data?.configured && (data?.slabs.length ?? 0) > 0;

  const showInfo = () => Alert.alert(
    'How slabs work',
    `Gems you earn in ${meta.label} this month count towards these slabs. ` +
    `Reaching a slab pays its amount${data?.slabs.some(sl => sl.bonus > 0) ? ' plus its bonus' : ''} — each slab shows the total for reaching it, so a higher slab replaces the one before. ` +
    `Gem value is that total divided by the slab's gems. ` +
    'Gems and slabs reset to 0 at the end of every month; money already added stays in your wallet.',
  );

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.headerBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color="#1C1E22" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{meta.short} Earnings</Text>
      </View>

      {loading ? (
        <ActivityIndicator color="#7A0EED" style={{ marginTop: 32 }} />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
          {/* This month stats */}
          <View style={s.statCard}>
            <View style={s.statCol}>
              <Text style={s.statLabel}>This Month Earnings</Text>
              <Text style={s.statValue}>{formatInr(data?.month_earnings ?? 0)}</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statCol}>
              <Text style={s.statLabel}>Gems Earned</Text>
              <Text style={s.statValue}>{formatN(gems)}</Text>
            </View>
          </View>

          {configured ? (
            <TouchableOpacity activeOpacity={0.7} onPress={showInfo} style={s.rateRow}>
              <Text style={s.rateText}>
                Gem value: <Text style={s.rateVal}>{formatGemValue(value)}</Text>
              </Text>
              <Ionicons name="information-circle-outline" size={16} color="#8A8A96" />
            </TouchableOpacity>
          ) : (
            <View style={s.unsetCard}>
              <Ionicons name="time-outline" size={18} color="#7A0EED" />
              <Text style={s.unsetText}>Slabs for {meta.label} aren't set up yet. Check back soon.</Text>
            </View>
          )}

          {/* Slab Earnings / History */}
          <View style={s.tabRow}>
            {([['slabs', 'Slab Earnings'], ['history', 'History']] as [Tab, string][]).map(([key, label]) => (
              <TouchableOpacity
                key={key}
                style={[s.tabBtn, tab === key && s.tabBtnActive]}
                onPress={() => setTab(key)}
                activeOpacity={0.8}>
                <Text style={[s.tabText, tab === key && s.tabTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {tab === 'slabs' ? (
            <View style={s.slabList}>
              {(data?.slabs ?? []).map(sl => (
                <View key={sl.name} style={[s.slabRow, sl.reached && s.slabRowDone]}>
                  <View style={[s.iconWrap, { backgroundColor: meta.tint }]}>
                    <Ionicons name={meta.icon as any} size={20} color={meta.color} />
                  </View>
                  <View style={s.slabInfo}>
                    <Text style={s.slabName}>{sl.name}</Text>
                    <Text style={s.slabGems}>{formatN(sl.gems)} Gems</Text>
                  </View>
                  <View style={s.slabRight}>
                    <Text style={s.slabPayout}>{formatInr(sl.payout).replace(' ', '')}</Text>
                    <Text style={s.slabBonus}>+{formatInr(sl.bonus).replace(' ', '')} Bonus</Text>
                  </View>
                  <Ionicons
                    name={sl.reached ? 'checkmark-circle' : 'ellipse-outline'}
                    size={26}
                    color={sl.reached ? '#16A34A' : '#D8D3EC'}
                  />
                </View>
              ))}
            </View>
          ) : (
            <HistoryList months={data?.history_months ?? []} />
          )}
        </ScrollView>
      )}

      {/* Next-slab progress stays pinned to the bottom while the slab list scrolls */}
      {!loading && tab === 'slabs' && configured && (
        <View style={[s.progressCard, { paddingBottom: 14 + insets.bottom }]}>
          <Text style={s.progressTitle}>
            {next ? `Next Slab Progress · ${next.name}` : 'All slabs completed this month 🎉'}
          </Text>
          {next && (
            <>
              <View style={s.progressTop}>
                <Text style={s.progressText}>{formatN(gems)} / {formatN(next.gems)} Gems</Text>
                <Text style={s.progressPct}>{Math.floor(progress)}%</Text>
              </View>
              <View style={s.track}>
                <View style={[s.fill, { width: `${progress}%`, backgroundColor: meta.color }]} />
              </View>
            </>
          )}
          <Text style={s.resetNote}>Slabs and gems reset at the end of every month.</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

// Month-by-month history for this service: a summary header per month
// (gems, slab reached, money earned) followed by that month's gifts/calls.
function HistoryList({ months }: { months: HistoryMonth[] }) {
  const [open, setOpen] = useState<string | null>(months[0]?.month ?? null);

  if (months.every(m => m.items.length === 0)) {
    return (
      <View style={s.empty}>
        <Ionicons name="time-outline" size={40} color="#D8D3EC" />
        <Text style={s.emptyText}>No gems earned yet</Text>
      </View>
    );
  }

  return (
    <View style={s.slabList}>
      {months.map(m => {
        const expanded = open === m.month;
        return (
          <View key={m.month} style={s.monthCard}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setOpen(expanded ? null : m.month)}
              style={s.monthHeader}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={s.monthTitle}>{monthLabel(m.month)}</Text>
                <Text style={s.monthSub}>
                  {formatN(m.gems)} Gems · {m.slab ?? 'No slab yet'}
                </Text>
              </View>
              <Text style={s.monthEarned}>{formatInr(m.earnings).replace(' ', '')}</Text>
              <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color="#ABADB2" />
            </TouchableOpacity>

            {expanded && (m.items.length === 0 ? (
              <Text style={s.monthEmpty}>No gems earned this month</Text>
            ) : m.items.map(it => {
              const person = it.person_name || it.person_username || 'Unknown';
              const detail = it.kind === 'call'
                ? `${it.call_type === 'video' ? 'Video call' : 'Audio call'} · ${formatCallDuration(it.duration_seconds ?? 0)}`
                : `Sent ${it.quantity > 1 ? `${it.quantity}x ` : ''}${it.gift_name}`;
              return (
                <View key={`${it.kind}-${it.id}`} style={s.historyRow}>
                  <View style={[s.iconWrap, s.historyIcon]}>
                    <Ionicons name={it.kind === 'call' ? 'call' : 'gift'} size={18} color="#7A0EED" />
                  </View>
                  <View style={s.slabInfo}>
                    <Text style={s.slabName} numberOfLines={1}>{person}</Text>
                    <Text style={s.slabGems} numberOfLines={1}>{detail}</Text>
                  </View>
                  <View style={s.slabRight}>
                    <Text style={s.historyGems}>+{formatN(it.gems)} Gems</Text>
                    <Text style={s.historyTime}>{formatTxnTime(new Date(it.created_at))}</Text>
                  </View>
                </View>
              );
            }))}
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  unsetCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16,
    backgroundColor: '#F5F0FF', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
  },
  unsetText: { flex: 1, fontSize: 13, color: '#5A0BB0', lineHeight: 18 },
  root: { flex: 1, backgroundColor: '#F7F4FD' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#F7F4FD' },
  headerBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'left', fontSize: 18, fontWeight: '700', color: '#1C1E22' },
  scroll: { paddingHorizontal: 16, paddingBottom: 40 },

  statCard: {
    flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 18, paddingVertical: 16, paddingHorizontal: 16,
    shadowColor: '#7A0EED', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  statCol: { flex: 1, gap: 6 },
  statDivider: { width: StyleSheet.hairlineWidth, backgroundColor: '#E5E0F2', marginHorizontal: 14 },
  statLabel: { fontSize: 12, fontWeight: '500', color: '#8A8A96' },
  statValue: { fontSize: 20, fontWeight: '800', color: '#1C1E22' },

  rateRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4, paddingVertical: 14 },
  rateText: { fontSize: 13, fontWeight: '500', color: '#60626A' },
  rateVal: { fontWeight: '700', color: '#1C1E22' },

  tabRow: { flexDirection: 'row', backgroundColor: '#EDE8F8', borderRadius: 30, padding: 4, marginBottom: 14 },
  tabBtn: { flex: 1, paddingVertical: 9, borderRadius: 26, alignItems: 'center' },
  tabBtnActive: { backgroundColor: '#FFFFFF', shadowColor: '#7A0EED', shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  tabText: { fontSize: 14, fontWeight: '500', color: '#7A7A8A' },
  tabTextActive: { color: '#1C1E22', fontWeight: '700' },

  slabList: { gap: 10 },
  slabRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', borderRadius: 16,
    paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: 'transparent',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  slabRowDone: { borderColor: '#BBF7D0', backgroundColor: '#F4FBF5' },
  iconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  slabInfo: { flex: 1, gap: 2 },
  slabName: { fontSize: 14, fontWeight: '700', color: '#1C1E22' },
  slabGems: { fontSize: 11, color: '#8A8A96', fontWeight: '400' },
  slabRight: { alignItems: 'flex-end', gap: 2 },
  slabPayout: { fontSize: 15, fontWeight: '800', color: '#1C1E22' },
  slabBonus: { fontSize: 11, fontWeight: '700', color: '#16A34A' },

  progressCard: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 18, paddingTop: 14, gap: 10,
    shadowColor: '#7A0EED', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: -3 }, elevation: 8,
  },
  progressTitle: { fontSize: 13, fontWeight: '700', color: '#1C1E22' },
  progressTop: { flexDirection: 'row', justifyContent: 'space-between' },
  progressText: { fontSize: 12, color: '#60626A', fontWeight: '500' },
  progressPct: { fontSize: 12, color: '#1C1E22', fontWeight: '700' },
  track: { height: 6, borderRadius: 3, backgroundColor: '#EDE8F8', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  resetNote: { fontSize: 11, color: '#ABADB2' },

  historyIcon: { backgroundColor: '#F3EFFE', width: 40, height: 40 },
  historyRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#F0EDF8',
  },
  monthCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  monthHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 14 },
  monthTitle: { fontSize: 14, fontWeight: '800', color: '#1C1E22' },
  monthSub: { fontSize: 11, color: '#8A8A96', fontWeight: '500' },
  monthEarned: { fontSize: 15, fontWeight: '800', color: '#16A34A' },
  monthEmpty: { fontSize: 12, color: '#ABADB2', paddingHorizontal: 14, paddingBottom: 14 },
  historyGems: { fontSize: 13, fontWeight: '800', color: '#7A0EED' },
  historyTime: { fontSize: 10, color: '#ABADB2' },

  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, gap: 10 },
  emptyText: { fontSize: 14, color: '#B0AEC0', fontWeight: '500' },
});
