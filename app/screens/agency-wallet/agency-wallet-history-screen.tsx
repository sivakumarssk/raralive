import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { apiAgencyWalletRequests, apiAgencyWalletTransactions, type AgencyCoinRequest, type AgencyWalletTxn } from '@/services/api';
import { authStore } from '@/store/auth-store';
import {
  BottomSheet, DetailLine, Empty, REQUEST_STATUS, Tag, dateText, fmt, isThisMonth, isToday, longDate, longTime,
  s as ws,
} from './agency-wallet-screen';

// Agency Wallet → history icon. Three tabs:
//   User Recharges   — coins this agency sent to users (agency wallet −)
//   Wallet Recharges — coins RaRa Live Official credited to this wallet (+)
//   Requests         — coin requests sent to Official, with their status

type HistoryTab = 'user' | 'wallet' | 'requests';
type HistoryFilter = 'all' | 'today' | 'month';

const TABS: { key: HistoryTab; label: string }[] = [
  { key: 'user', label: 'User Recharges' },
  { key: 'wallet', label: 'Wallet Recharges' },
  { key: 'requests', label: 'Requests' },
];

const FILTERS: { key: HistoryFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'today', label: 'Today' },
  { key: 'month', label: 'This Month' },
];

export function AgencyWalletHistoryScreen() {
  const router = useRouter();
  const [txns, setTxns] = useState<AgencyWalletTxn[]>([]);
  const [requests, setRequests] = useState<AgencyCoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<HistoryTab>('user');
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [detail, setDetail] = useState<AgencyWalletTxn | null>(null);

  const load = useCallback(async () => {
    const token = authStore.getToken();
    if (!token) { setLoading(false); return; }
    const [r, q] = await Promise.all([apiAgencyWalletTransactions(token), apiAgencyWalletRequests(token)]);
    if (r.ok) { setTxns(r.data); setError(null); } else setError(r.message);
    if (q.ok) setRequests(q.data);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => txns
    .filter(t => t.type === (tab === 'user' ? 'user_recharge' : 'official_credit'))
    .filter(t => (filter === 'today' ? isToday(t.created_at) : filter === 'month' ? isThisMonth(t.created_at) : true)),
  [txns, tab, filter]);

  const requestRows = useMemo(() => requests
    .filter(r => (filter === 'today' ? isToday(r.created_at) : filter === 'month' ? isThisMonth(r.created_at) : true)),
  [requests, filter]);

  const isRequestsTab = tab === 'requests';
  const totalCoins = rows.reduce((sum, t) => sum + t.coins, 0);
  const isUserTab = tab === 'user';

  return (
    <SafeAreaView style={ws.root} edges={['top']}>
      <View style={ws.header}>
        <TouchableOpacity onPress={() => router.back()} style={ws.headerBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color="#1C1E22" />
        </TouchableOpacity>
        <Text style={ws.headerTitle}>Recharge History</Text>
      </View>

      <View style={{ paddingHorizontal: 16 }}>
        <View style={[ws.tabRow, { marginTop: 4, marginBottom: 12 }]}>
          {TABS.map(t => (
            <TouchableOpacity key={t.key} style={[ws.tabBtn, tab === t.key && ws.tabBtnActive]} onPress={() => setTab(t.key)} activeOpacity={0.8}>
              <Text style={[ws.tabText, h.tabLabel, tab === t.key && ws.tabTextActive]} numberOfLines={1}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={h.filterRow}>
          <View style={ws.filters}>
            {FILTERS.map(f => (
              <TouchableOpacity key={f.key} onPress={() => setFilter(f.key)} style={[ws.filterBtn, filter === f.key && ws.filterBtnActive]} activeOpacity={0.8}>
                <Text style={[ws.filterText, filter === f.key && ws.filterTextActive]}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {!loading && !isRequestsTab && rows.length > 0 && (
            <Text style={[h.total, isUserTab ? ws.minus : ws.plus]}>
              {isUserTab ? '-' : '+'}{fmt(totalCoins)} Coins
            </Text>
          )}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color="#7A0EED" style={{ marginTop: 40 }} />
      ) : error ? (
        <View style={h.center}>
          <Ionicons name="alert-circle-outline" size={40} color="#D8D3EC" />
          <Text style={h.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => { setLoading(true); load(); }} style={h.retryBtn}>
            <Text style={h.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={ws.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#7A0EED" colors={['#7A0EED']} />}>
          <View style={ws.panel}>
            {isRequestsTab ? (
              requestRows.length === 0 ? <Empty text="No coin requests for this filter." /> : requestRows.map((r, i) => {
                const st = REQUEST_STATUS[r.status];
                return (
                  <View key={r.id} style={[ws.item, i === requestRows.length - 1 && ws.itemLast]}>
                    <View style={ws.row}>
                      <Text style={ws.itemTitle}>{fmt(r.coins)} Coins</Text>
                      {r.status === 'approved' && <Text style={ws.plus}>+{fmt(r.coins + r.extra_coins)}</Text>}
                    </View>
                    <View style={ws.timeRow}>
                      <Text style={ws.time}>{dateText(r.created_at)}</Text>
                      <Tag text={st.label} color={st.color} bg={st.bg} />
                    </View>
                    <Text style={ws.link}>{r.request_code}{r.extra_coins > 0 ? ` • +${fmt(r.extra_coins)} extra` : ''}</Text>
                    {!!r.admin_note && <Text style={ws.link}>Note: {r.admin_note}</Text>}
                  </View>
                );
              })
            ) : rows.length === 0 ? (
              <Empty text={isUserTab ? 'No user recharges for this filter.' : 'No wallet recharges for this filter.'} />
            ) : rows.map((t, i) => (
              <TouchableOpacity key={t.id} onPress={() => setDetail(t)} activeOpacity={0.7} style={[ws.item, i === rows.length - 1 && ws.itemLast]}>
                <View style={ws.row}>
                  <Text style={ws.itemTitle} numberOfLines={1}>
                    {isUserTab ? (t.user_handle || t.user_name || 'User') : 'RaRa Live Official'}
                  </Text>
                  <Text style={isUserTab ? ws.minus : ws.plus}>{isUserTab ? '-' : '+'}{fmt(t.coins)} Coins</Text>
                </View>
                <Text style={ws.link} numberOfLines={1}>
                  {isUserTab
                    ? `UID: ${t.user_id ?? '—'}`
                    : `${fmt(t.slab_coins)} Coins${t.extra_coins > 0 ? ` + ${fmt(t.extra_coins)} extra` : ''}`}
                </Text>
                <View style={ws.timeRow}>
                  <Text style={ws.time}>{dateText(t.created_at)}</Text>
                  <Tag text={isUserTab ? 'Success' : 'Credited'} />
                </View>
                <Text style={ws.link}>{t.txn_code}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}

      {/* Transaction details */}
      <BottomSheet visible={!!detail} onClose={() => setDetail(null)}>
        {detail && (
          <>
            <Text style={ws.sheetTitle}>Transaction Details</Text>
            <Text style={ws.sheetSub}>Complete recharge record</Text>
            <View style={ws.detailBox}>
              <DetailLine label="Transaction" value={detail.type === 'official_credit' ? 'Official → Agency Coin Credit' : 'Agency → User Recharge'} />
              <DetailLine label="Transaction ID" value={detail.txn_code} />
              <DetailLine label="Status" value={detail.type === 'official_credit' ? 'Credited' : 'Success'} valueStyle={ws.plus} />
              {detail.type === 'official_credit' ? (
                <>
                  <DetailLine label="Agency" value={detail.agency_name} />
                  <DetailLine label="Coins" value={`${fmt(detail.slab_coins)} Coins`} />
                  {detail.extra_coins > 0 && <DetailLine label="Extra Coins" value={`${fmt(detail.extra_coins)} Coins`} />}
                  <DetailLine label="Coins Added to Agency Wallet" value={`+${fmt(detail.coins)} Coins`} valueStyle={ws.plus} />
                  {!!detail.note && <DetailLine label="Note" value={detail.note} />}
                </>
              ) : (
                <>
                  {!!detail.user_name && <DetailLine label="User Name" value={detail.user_name} />}
                  <DetailLine label="Handle Name" value={detail.user_handle || '—'} />
                  <DetailLine label="UID" value={detail.user_id ?? '—'} />
                  <DetailLine label="Agency" value={detail.agency_name} />
                  <DetailLine label="Selected Slab" value={`${fmt(detail.slab_coins)} Coins`} />
                  <DetailLine label="Extra Coins" value={`${fmt(detail.extra_coins)} Coins`} />
                  <DetailLine label="Coins Added to User" value={`+${fmt(detail.coins)} Coins`} valueStyle={ws.plus} />
                  <DetailLine label="Agency Wallet Deduction" value={`-${fmt(detail.coins)} Coins`} valueStyle={ws.minus} />
                </>
              )}
              <DetailLine label="Date" value={longDate(detail.created_at)} />
              <DetailLine label="Time" value={longTime(detail.created_at)} />
              <DetailLine label="Wallet Balance After" value={`${fmt(detail.balance_after)} Coins`} />
            </View>
            <TouchableOpacity onPress={() => setDetail(null)} activeOpacity={0.85} style={{ marginTop: 14 }}>
              <LinearGradient colors={['#7A0EED', '#B50357']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={ws.primaryBtn}>
                <Text style={ws.primaryText}>Done</Text>
              </LinearGradient>
            </TouchableOpacity>
          </>
        )}
      </BottomSheet>
    </SafeAreaView>
  );
}

const h = StyleSheet.create({
  tabLabel: { fontSize: 12.5 },
  filterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 },
  total: { fontSize: 13 },
  center: { alignItems: 'center', gap: 10, paddingTop: 60, paddingHorizontal: 32 },
  errorText: { fontSize: 14, color: '#60626A', textAlign: 'center' },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, backgroundColor: '#F4EEFF' },
  retryText: { fontSize: 14, fontWeight: '700', color: '#7A0EED' },
});
