import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BASE_URL } from '@/services/api';
import { authStore } from '@/store/auth-store';

const COIN_IMG = require('@/assets/tabs/coin.png');

type Transaction = {
  id: string;
  type: 'credit' | 'debit';
  coins: number;
  balance_after: number;
  description: string | null;
  created_at: string;
};

type Filter = 'all' | 'credit' | 'debit';

const PAGE_SIZE = 30;

function monthLabel(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

function formatN(n: number) {
  return n.toLocaleString('en-IN');
}

function formatTime(d: string) {
  return new Date(d).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

function formatDay(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

// A transaction description doubles as a fine-grained category — bucket it
// into a small icon set so the list reads at a glance instead of every row
// looking identical.
function iconFor(tx: Transaction): { name: keyof typeof Ionicons.glyphMap; bg: string; color: string } {
  const desc = (tx.description ?? '').toLowerCase();
  if (tx.type === 'debit') {
    if (desc.includes('gift')) return { name: 'gift', bg: '#FDEBEF', color: '#E14C57' };
    return { name: 'arrow-up-circle', bg: '#FDEBEF', color: '#E14C57' };
  }
  if (desc.includes('recharge') || desc.includes('package')) return { name: 'card', bg: '#E9F9EF', color: '#16A34A' };
  if (desc.includes('admin')) return { name: 'shield-checkmark', bg: '#EAF4FF', color: '#1D6FE0' };
  return { name: 'arrow-down-circle', bg: '#E9F9EF', color: '#16A34A' };
}

type ListItem =
  | { kind: 'header'; key: string; label: string }
  | { kind: 'row'; key: string; tx: Transaction; isLastInGroup: boolean };

function groupByMonth(transactions: Transaction[]): ListItem[] {
  const items: ListItem[] = [];
  let lastMonth = '';
  transactions.forEach((tx, i) => {
    const month = monthLabel(tx.created_at);
    if (month !== lastMonth) {
      items.push({ kind: 'header', key: `h-${month}`, label: month });
      lastMonth = month;
    }
    const next = transactions[i + 1];
    const isLastInGroup = !next || monthLabel(next.created_at) !== month;
    items.push({ kind: 'row', key: tx.id, tx, isLastInGroup });
  });
  return items;
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[s.chip, active && s.chipActive]}>
      <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function TransactionRow({ tx, isLastInGroup }: { tx: Transaction; isLastInGroup: boolean }) {
  const icon = iconFor(tx);
  const isCredit = tx.type === 'credit';
  return (
    <View style={[s.row, !isLastInGroup && s.rowBorder]}>
      <View style={[s.iconWrap, { backgroundColor: icon.bg }]}>
        <Ionicons name={icon.name} size={20} color={icon.color} />
      </View>
      <View style={s.rowInfo}>
        <Text style={s.rowTitle} numberOfLines={2}>{tx.description || (isCredit ? 'Coins added' : 'Coins spent')}</Text>
        <Text style={s.rowMeta}>{formatDay(tx.created_at)} · {formatTime(tx.created_at)}</Text>
      </View>
      <View style={s.rowRight}>
        <View style={s.amountRow}>
          <Text style={[s.rowAmount, isCredit ? s.rowAmountCredit : s.rowAmountDebit]}>
            {isCredit ? '+' : '−'}{formatN(tx.coins)}
          </Text>
          <Image source={COIN_IMG} style={s.coinIcon} resizeMode="contain" />
        </View>
        <Text style={s.rowBalance}>Bal: {formatN(tx.balance_after)}</Text>
      </View>
    </View>
  );
}

export function WalletHistoryScreen() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [total, setTotal] = useState(0);

  const load = useCallback(async (offset: number, isRefresh: boolean) => {
    const token = authStore.getToken();
    if (!token) { setLoading(false); return; }
    try {
      const res = await fetch(`${BASE_URL}/wallet/me/transactions?limit=${PAGE_SIZE}&offset=${offset}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success) {
        setTotal(json.total ?? 0);
        setTransactions(prev => (offset === 0 ? json.data : [...prev, ...json.data]));
      }
    } catch {
      // silent — the empty/error state is just "no transactions shown"
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => { load(0, false); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(0, true); };

  const onEndReached = () => {
    if (loadingMore || loading || transactions.length >= total) return;
    setLoadingMore(true);
    load(transactions.length, false);
  };

  const filtered = filter === 'all' ? transactions : transactions.filter(t => t.type === filter);
  const items = groupByMonth(filtered);

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.headerBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color="#1C1E22" />
        </TouchableOpacity>
        <Text style={s.title}>Transaction History</Text>
      </View>

      <View style={s.filterRow}>
        <FilterChip label="All" active={filter === 'all'} onPress={() => setFilter('all')} />
        <FilterChip label="Earned" active={filter === 'credit'} onPress={() => setFilter('credit')} />
        <FilterChip label="Withdraw" active={filter === 'debit'} onPress={() => setFilter('debit')} />
      </View>

      {loading ? (
        <ActivityIndicator color="#7A0EED" style={{ marginTop: 40 }} />
      ) : items.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="receipt-outline" size={48} color="#D8D3EC" />
          <Text style={s.emptyText}>No transactions yet</Text>
          <Text style={s.emptyHint}>Coin purchases and spends will appear here</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item.key}
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7A0EED" />}
          onEndReachedThreshold={0.4}
          onEndReached={onEndReached}
          ListFooterComponent={loadingMore ? <ActivityIndicator color="#7A0EED" style={{ marginVertical: 16 }} /> : null}
          renderItem={({ item }) =>
            item.kind === 'header' ? (
              <Text style={s.groupLabel}>{item.label}</Text>
            ) : (
              <TransactionRow tx={item.tx} isLastInGroup={item.isLastInGroup} />
            )
          }
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F7F4FD' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: '#F7F4FD', gap: 10,
  },
  headerBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 18, fontWeight: '700', color: '#1C1E22', textAlign: 'left' },
  filterRow: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 16, paddingBottom: 12,
  },
  chip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EEEAF6',
  },
  chipActive: { backgroundColor: '#7A0EED', borderColor: '#7A0EED' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#7A7686' },
  chipTextActive: { color: '#FFFFFF' },
  scroll: { paddingHorizontal: 16, paddingBottom: 40 },
  groupLabel: {
    fontSize: 12.5, fontWeight: '700', color: '#9A94AE',
    marginTop: 18, marginBottom: 8, marginLeft: 2,
    textTransform: 'uppercase', letterSpacing: 0.3,
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    gap: 12, paddingVertical: 13,
    backgroundColor: '#FFFFFF', paddingHorizontal: 14,
  },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F0EDF8' },
  iconWrap: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
  },
  rowInfo: { flex: 1, gap: 3 },
  rowTitle: { fontSize: 13.5, fontWeight: '700', color: '#1C1E22' },
  rowMeta: { fontSize: 11, color: '#ABADB2' },
  rowRight: { alignItems: 'flex-end', gap: 3 },
  amountRow: { flexDirection: 'row', alignItems: 'center' },
  coinIcon: { width: 13, height: 13, marginLeft: 3 },
  rowAmount: { fontSize: 14, fontWeight: '800' },
  rowAmountCredit: { color: '#16A34A' },
  rowAmountDebit: { color: '#E14C57' },
  rowBalance: { fontSize: 10.5, color: '#ABADB2' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontSize: 15, color: '#B0AEC0', fontWeight: '600' },
  emptyHint: { fontSize: 13, color: '#C8C5D8', textAlign: 'center', paddingHorizontal: 40 },
});
