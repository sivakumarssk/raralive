import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FEATURES } from '@/constants/features';
import { BASE_URL } from '@/services/api';
import { authStore } from '@/store/auth-store';
import {
  EARNING_SOURCES, SOURCE_BY_KEY, formatInr, formatTxnTime, monthLabel, type EarningSource,
} from './earnings-shared';

const WHATSAPP_NUMBER = '+919676855851';
const PURSE_IMG = require('@/assets/images/wallet-purse.png');

type WalletTab = 'coins' | 'earnings' | 'store';

type CoinPackage = {
  id: string; coins: number; price: string;
  original_price: string | null; discount: string; highlighted: boolean;
};

// ── Earnings data ─────────────────────────────────────────────────────────────

type SourceSummary = {
  source: EarningSource; month_gems: number; month_earnings: number;
  current_slab: string | null; next_slab: { name: string; gems: number } | null;
};

type WalletTxn =
  | { type: 'credit'; source: EarningSource; slab: string; amount: number; at: string; kind?: 'bonus'; gems?: number }
  | { type: 'withdrawal'; id: string; amount: number; status: 'pending' | 'paid' | 'rejected'; at: string };

type WalletMonth = { month: string; added: number; withdrawn: number; transactions: WalletTxn[] };

const WITHDRAW_STATUS: Record<'pending' | 'paid' | 'rejected', { label: string; color: string }> = {
  pending:  { label: 'Pending',  color: '#F59E0B' },
  paid:     { label: 'Paid',     color: '#16A34A' },
  rejected: { label: 'Rejected · refunded', color: '#DC2626' },
};

type EarningsOverview = {
  month: string;
  total_month_earnings: number;
  growth_pct: number | null;
  available_balance: number;
  sources: SourceSummary[];
  months: WalletMonth[];
};

// ── Earnings Tab ──────────────────────────────────────────────────────────────

function EarningsTab() {
  const router = useRouter();
  const [data, setData] = useState<EarningsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [withdrawing, setWithdrawing] = useState(false);

  const load = useCallback(() => {
    const token = authStore.getToken();
    if (!token) { setLoading(false); return; }
    fetch(`${BASE_URL}/tasks/earnings`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(j => { if (j.success) setData(j.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const monthTotal = data?.total_month_earnings ?? 0;
  const growth = data?.growth_pct ?? null;
  const available = data?.available_balance ?? 0;
  const months = data?.months ?? [];

  // Records the request (deducting it from the wallet right away), then hands
  // off to WhatsApp where the payout is settled.
  const submitWithdraw = async () => {
    setWithdrawing(true);
    try {
      const r = await fetch(`${BASE_URL}/tasks/earnings/withdraw`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authStore.getToken()}` },
      });
      const j = await r.json();
      if (!j.success) { Alert.alert('Withdraw failed', j.message ?? 'Please try again.'); return; }
      const text = `Hi, I want to withdraw ${formatInr(j.data.amount)} from my RaRa Live earnings.\nRequest ID: ${j.data.id}\nUsername: @${authStore.getUser()?.username ?? ''}`;
      Linking.openURL(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`).catch(() => {});
      load();
    } catch {
      Alert.alert('Withdraw failed', 'Please check your connection and try again.');
    } finally {
      setWithdrawing(false);
    }
  };

  const handleWithdraw = () => {
    if (available <= 0 || withdrawing) return;
    Alert.alert('Withdraw', `Withdraw ${formatInr(available)} from your wallet?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Withdraw', onPress: submitWithdraw },
    ]);
  };

  const openSource = (source: EarningSource) =>
    router.push({ pathname: '/service-earnings', params: { source } } as any);

  if (loading) return <ActivityIndicator color="#7A0EED" style={{ marginTop: 32 }} />;

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
      {/* Total earnings card */}
      <LinearGradient
        colors={['#7A0EED', '#B50357']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={e.balanceCard}>
        <View style={e.glowOuter} pointerEvents="none" />
        <View style={e.glowInner} pointerEvents="none" />

        <View style={e.totalRow}>
          <View style={{ flex: 1 }}>
            <Text style={e.balanceLabel}>Total Earnings (This Month)</Text>
            <View style={e.balanceRow}>
              <Text style={e.balanceNumber}>{formatInr(monthTotal)}</Text>
              {growth !== null && (
                <View style={[e.growthBadge, growth < 0 && e.growthBadgeDown]}>
                  <Text style={[e.growthText, growth < 0 && e.growthTextDown]}>
                    {growth >= 0 ? '+' : ''}{growth.toFixed(1)}%
                  </Text>
                </View>
              )}
            </View>
          </View>
          <Image source={PURSE_IMG} style={e.purseImg} resizeMode="contain" />
        </View>

        <View style={e.divider} />

        <View style={e.availableRow}>
          <View style={{ flex: 1 }}>
            <Text style={e.availableLabel}>Available in Wallet</Text>
            <Text style={e.availableNumber}>{formatInr(available)}</Text>
          </View>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleWithdraw}
            disabled={available <= 0 || withdrawing}
            style={[e.withdrawBtn, (available <= 0 || withdrawing) && { opacity: 0.6 }]}>
            {withdrawing
              ? <ActivityIndicator color="#7A0EED" size="small" />
              : <Text style={e.withdrawText}>Withdraw</Text>}
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Earnings overview — tap a service for its slab screen */}
      <SectionHeader title="Earnings Overview" hint="(This Month)" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={e.overviewScroll}
        contentContainerStyle={e.overviewRow}>
        {EARNING_SOURCES.map(src => {
          const amount = data?.sources.find(x => x.source === src.key)?.month_earnings ?? 0;
          const pct = monthTotal > 0 ? (amount / monthTotal) * 100 : 0;
          return (
            <TouchableOpacity key={src.key} activeOpacity={0.8} disabled={src.comingSoon} onPress={() => openSource(src.key)} style={e.overviewCard}>
              <View style={e.overviewTop}>
                <View style={[e.iconWrap, { backgroundColor: src.tint }]}>
                  <Ionicons name={src.icon as any} size={16} color={src.color} />
                </View>
                <Text style={e.overviewLabel} numberOfLines={2}>{src.label}</Text>
              </View>
              <Text style={e.overviewAmount}>{formatInr(amount)}</Text>
              <Text style={[e.overviewPct, { color: src.color }]}>
                {src.comingSoon ? 'Coming soon' : `${pct.toFixed(2)}%`}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Recent wallet transactions, one section per month */}
      <SectionHeader title="Recent Transactions" />
      {months.length === 0 ? (
        <View style={e.empty}>
          <Ionicons name="wallet-outline" size={40} color="#D8D3EC" />
          <Text style={e.emptyText}>No transactions yet</Text>
          <Text style={e.emptyHint}>Complete a slab to add money to your wallet</Text>
        </View>
      ) : (
        months.map(m => (
          <View key={m.month} style={e.monthBlock}>
            <View style={e.monthHeader}>
              <Text style={e.monthTitle}>{monthLabel(m.month)}</Text>
              <Text style={e.monthSummary}>
                <Text style={e.monthAdded}>+{formatInr(m.added).replace(' ', '')}</Text>
                {m.withdrawn > 0 && <Text style={e.monthWithdrawn}>  −{formatInr(m.withdrawn).replace(' ', '')}</Text>}
              </Text>
            </View>
            <View style={e.txnList}>
              {m.transactions.map((t, i) => (
                <TxnRow
                  key={t.type === 'credit' ? `c-${t.kind ?? 'slab'}-${t.source}-${t.slab}-${t.gems ?? ''}-${t.at}` : `w-${t.id}`}
                  txn={t}
                  last={i === m.transactions.length - 1}
                  onPress={t.type === 'credit' ? () => openSource(t.source) : undefined}
                />
              ))}
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

function TxnRow({ txn, last, onPress }: { txn: WalletTxn; last: boolean; onPress?: () => void }) {
  const src = txn.type === 'credit' ? SOURCE_BY_KEY[txn.source] : null;
  // Daily Task "Bonus Payment" credit
  const isBonus = txn.type === 'credit' && txn.kind === 'bonus';
  const status = txn.type === 'withdrawal' ? WITHDRAW_STATUS[txn.status] : null;
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      disabled={!onPress}
      onPress={onPress}
      style={[e.txnRow, !last && e.txnBorder]}>
      <View style={[e.iconWrap, e.txnIconWrap, { backgroundColor: isBonus ? '#FFF4E0' : src?.tint ?? '#FEF3E2' }]}>
        <Ionicons name={(isBonus ? 'gift' : src?.icon ?? 'arrow-up-circle') as any} size={18} color={isBonus ? '#F59E0B' : src?.color ?? '#F59E0B'} />
      </View>
      <View style={e.txnInfo}>
        <Text style={e.txnTitle} numberOfLines={1}>
          {isBonus ? `Extra Bonus · ${src!.short}` : txn.type === 'credit' ? `${src!.short} - ${txn.slab}` : 'Withdrawal'}
        </Text>
        <Text style={e.txnSub} numberOfLines={1}>
          {formatTxnTime(new Date(txn.at))}
          {status && <Text style={{ color: status.color, fontWeight: '700' }}>  · {status.label}</Text>}
        </Text>
      </View>
      <Text style={[
        e.txnAmount,
        txn.type === 'withdrawal' && e.txnAmountOut,
        txn.type === 'withdrawal' && txn.status === 'rejected' && e.txnAmountVoid,
      ]}>
        {txn.type === 'credit' ? '+' : '−'}{formatInr(txn.amount).replace(' ', '')}
      </Text>
    </TouchableOpacity>
  );
}

function SectionHeader({ title, hint, onViewAll }: { title: string; hint?: string; onViewAll?: () => void }) {
  return (
    <View style={e.sectionRow}>
      <Text style={s.sectionHeading}>
        {title}{hint ? <Text style={e.sectionHint}> {hint}</Text> : null}
      </Text>
      {onViewAll && (
        <TouchableOpacity onPress={onViewAll} hitSlop={8} style={e.viewAll}>
          <Text style={e.viewAllText}>View All</Text>
          <Ionicons name="chevron-forward" size={13} color="#7A0EED" />
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Main Wallet Screen ────────────────────────────────────────────────────────

export function WalletScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<WalletTab>('coins');
  const username = authStore.getUser()?.username ?? '';
  const [coinBalance, setCoinBalance] = useState(0);
  const [packages, setPackages] = useState<CoinPackage[]>([]);
  const [pkgLoading, setPkgLoading] = useState(true);

  useEffect(() => {
    const token = authStore.getToken();
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    fetch(`${BASE_URL}/wallet/me`, { headers }).then(r => r.json()).then(j => { if (j.success) setCoinBalance(j.data.coins); }).catch(() => {});
    if (!FEATURES.coinPurchases) { setPkgLoading(false); return; }
    fetch(`${BASE_URL}/coin-packages/public`).then(r => r.json()).then(j => { if (j.success) setPackages(j.data); }).catch(() => {}).finally(() => setPkgLoading(false));
  }, []);

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.headerBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color="#1C1E22" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>My Wallet</Text>
        <TouchableOpacity onPress={() => router.push('/wallet-history' as any)} style={s.headerBtn} hitSlop={8}>
          <Ionicons name="time-outline" size={22} color="#1C1E22" />
        </TouchableOpacity>
      </View>

      {/* Coins / Earnings / Store tabs */}
      <View style={s.tabRow}>
        {(['coins', 'earnings', 'store'] as WalletTab[]).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[s.tabBtn, activeTab === tab && s.tabBtnActive]}
            onPress={() => setActiveTab(tab)}
            activeOpacity={0.8}>
            <Text style={[s.tabText, activeTab === tab && s.tabTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Coins tab */}
      {activeTab === 'coins' && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
          <LinearGradient
            colors={['#7A0EED', '#E91E7F']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={s.balanceCard}>
            <View style={s.balanceCardTop}>
              <Text style={s.balanceCardLabel}>Total Coins</Text>
            </View>
            <Text style={s.balanceCardNumber}>{coinBalance.toLocaleString()}</Text>
            <Image source={require('@/assets/tabs/wallet/walletcard.png')} style={s.coinIcon} resizeMode="contain" />
          </LinearGradient>

          {FEATURES.spinAndWin && (
          <View style={s.spinCard}>
            <View style={s.spinIconWrap}>
              <Image source={require('@/assets/tabs/wallet/spin.png')} style={s.spinIcon} resizeMode="contain" />
            </View>
            <View style={s.spinTextWrap}>
              <Text style={s.spinTitle}>Spin &amp; Win Coins</Text>
              <Text style={s.spinSub}>Spin daily and win exciting coins</Text>
            </View>
            <TouchableOpacity activeOpacity={0.85} style={s.spinBtn}>
              <LinearGradient
                colors={['#7A0EED', '#B50357']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={s.spinBtnGradient}>
                <Text style={s.spinBtnText}>Spin Now</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
          )}

          {FEATURES.coinPurchases ? (
            <>
              <Text style={s.sectionHeading}>Buy Coins</Text>

              {pkgLoading ? (
                <ActivityIndicator color="#7A0EED" style={{ marginTop: 20 }} />
              ) : (
                <View style={s.packageList}>
                  {packages.map(pkg => <PackageRow key={pkg.id} pkg={pkg} username={username} />)}
                </View>
              )}
            </>
          ) : (
            <View style={s.comingSoonCard}>
              <Ionicons name="time-outline" size={22} color="#7A0EED" />
              <View style={{ flex: 1 }}>
                <Text style={s.comingSoonTitle}>Coin packages coming soon</Text>
                <Text style={s.comingSoonSub}>{"You'll be able to buy coins right here in the app."}</Text>
              </View>
            </View>
          )}
        </ScrollView>
      )}

      {/* Earnings tab */}
      {activeTab === 'earnings' && <EarningsTab />}

      {/* Store tab — placeholder until the store is built */}
      {activeTab === 'store' && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
          <View style={s.storeCard}>
            <View style={s.storeIconWrap}>
              <Ionicons name="storefront-outline" size={28} color="#7A0EED" />
            </View>
            <Text style={s.storeTitle}>Store coming soon</Text>
            <Text style={s.storeSub}>
              Frames, entry effects and more — buy them with your coins right here.
            </Text>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ── Package Row ───────────────────────────────────────────────────────────────

const PKG_ICONS: { max: number; image: number }[] = [
  { max: 100,      image: require('@/assets/tabs/wallet/below100.png') },
  { max: 1_000,    image: require('@/assets/tabs/wallet/below1000.png') },
  { max: 5_000,    image: require('@/assets/tabs/wallet/below5000.png') },
  { max: 10_000,   image: require('@/assets/tabs/wallet/below10000.png') },
  { max: Infinity, image: require('@/assets/tabs/wallet/above10000.png') },
];

function pkgIconFor(coins: number) {
  return (PKG_ICONS.find(t => coins <= t.max) ?? PKG_ICONS[PKG_ICONS.length - 1]).image;
}

function PackageRow({ pkg, username }: { pkg: CoinPackage; username: string }) {
  const price = parseFloat(pkg.price);
  const origPrice = pkg.original_price ? parseFloat(pkg.original_price) : null;
  const discount = parseFloat(pkg.discount);

  const handlePress = () => {
    const text = `Hi, I want to buy a package of ${pkg.coins} coins for ₹${price.toFixed(0)} on RaRa Live.\nUsername: @${username}`;
    Linking.openURL(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`).catch(() => {});
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.8} style={s.pkgRow}>
      <View style={s.pkgIconWrap}>
        <Image source={pkgIconFor(pkg.coins)} style={s.pkgIcon} resizeMode="contain" />
      </View>

      <View style={s.pkgLeft}>
        <View style={s.pkgCoinRow}>
          <Text style={s.pkgCoins}>{pkg.coins.toLocaleString()}</Text>
          <Text style={s.pkgCoinsLabel}> Coins</Text>
        </View>
        {discount > 0 && <Text style={s.discountText}>-{discount.toFixed(0)}%</Text>}
      </View>

      <View style={s.priceBtn}>
        <Text style={s.priceText}>₹{price.toFixed(0)}</Text>
        {origPrice && <Text style={s.origPrice}> ₹{origPrice.toFixed(0)}</Text>}
      </View>
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F7F4FD' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#F7F4FD' },
  headerBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '700', color: '#1C1E22' },
  tabRow: { flexDirection: 'row', marginHorizontal: 16, backgroundColor: '#EDE8F8', borderRadius: 24, padding: 4, marginTop: 4, marginBottom: 16 },
  tabBtn: { flex: 1, height: 38, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  tabBtnActive: { backgroundColor: '#FFFFFF', shadowColor: '#7A0EED', shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  tabText: { fontSize: 15, fontWeight: '500', color: '#7A7A8A' },
  tabTextActive: { color: '#1C1E22', fontWeight: '700' },
  scroll: { paddingHorizontal: 16, paddingBottom: 40 },
  balanceCard: { backgroundColor: '#FFFFFF', borderRadius: 20, paddingBottom: 20, alignItems: 'center', marginBottom: 16, gap: 4, shadowColor: '#7A0EED', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3, overflow: 'hidden' },
  coinIcon: { position: 'absolute', width: 192, height: 152, right: -20},
  balanceNumber: { fontSize: 34, fontWeight: '800', color: '#1C1E22' },
  balanceTarget: { fontSize: 12, color: '#ABADB2', fontWeight: '400', marginTop: -2 },
  balanceLabel: { fontSize: 15, fontWeight: '400', color: '#7A7A8A' },

  // Coins gradient card (Total Coins) — reference-styled, overlaps `balanceCard`'s dimensions
  balanceCardTop: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginLeft: 20, marginTop: 20 },
  balanceCardLabel: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  balanceCardNumber: { alignSelf: 'flex-start', marginLeft: 20, marginTop: 4, fontSize: 34, fontWeight: '800', color: '#FFFFFF' },

  // Spin & Win banner
  spinCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#F6D8E8',
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16,
    shadowColor: '#B50357', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  spinIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F3EFFE', alignItems: 'center', justifyContent: 'center' },
  spinIcon: { width: 85, height: 85 },
  spinTextWrap: { flex: 1, gap: 2 },
  spinTitle: { fontSize: 14, fontWeight: '800', color: '#1C1E22' },
  spinSub: { fontSize: 12, color: '#8A8A96' },
  spinBtn: { borderRadius: 20, overflow: 'hidden' },
  spinBtnGradient: { height: 36, paddingHorizontal: 16, justifyContent: 'center' },
  spinBtnText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },

  sectionHeading: { fontSize: 16, fontWeight: '700', color: '#1C1E22', marginBottom: 10, marginTop: 4 },
  packageList: { gap: 10 },
  comingSoonCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#F5F0FF', borderRadius: 16, padding: 16, marginTop: 4,
  },
  comingSoonTitle: { fontSize: 14, fontWeight: '700', color: '#1C1E22' },
  comingSoonSub:   { fontSize: 12, color: '#6B6E7A', marginTop: 2 },
  storeCard: {
    alignItems: 'center', gap: 6, backgroundColor: '#FFFFFF', borderRadius: 20,
    paddingVertical: 32, paddingHorizontal: 24,
    shadowColor: '#7A0EED', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  storeIconWrap: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: '#F4EEFF',
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  storeTitle: { fontSize: 16, fontWeight: '700', color: '#1C1E22' },
  storeSub: { fontSize: 13, color: '#6B6E7A', textAlign: 'center', lineHeight: 19 },
  pkgRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  pkgIconWrap: { width: 56, height: 56, borderRadius: 12, backgroundColor: '#FFF7E8', alignItems: 'center', justifyContent: 'center' },
  pkgIcon: { width: 84, height: 84 },
  pkgLeft: { flex: 1, gap: 6 },
  pkgCoinRow: { flexDirection: 'row', alignItems: 'baseline' },
  pkgCoins: { fontSize: 18, fontWeight: '800', color: '#1C1E22' },
  pkgCoinsLabel: { fontSize: 11, fontWeight: '600', color: '#7A7A8A', letterSpacing: 0.5 },
  // Discount: plain green text, no badge background
  discountText: { fontSize: 11, fontWeight: '700', color: '#16A34A' },
  // Price: light purple instead of solid purple — same size and layout as before
  priceBtn: { flexDirection: 'row', alignItems: 'baseline', backgroundColor: '#F1EBFF', paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20 },
  priceText: { fontSize: 14, fontWeight: '700', color: '#7A0EED' },
  origPrice: { fontSize: 11, color: '#9A94AE', textDecorationLine: 'line-through' },
});

// Earnings tab styles
const e = StyleSheet.create({
  // Total earnings card
  balanceCard: {
    borderRadius: 20, paddingHorizontal: 18, paddingVertical: 16, marginBottom: 16, overflow: 'hidden',
    shadowColor: '#7A0EED', shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
  glowOuter: {
    position: 'absolute', right: -60, top: -50,
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  glowInner: {
    position: 'absolute', right: 10, bottom: 60,
    width: 70, height: 70, borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  balanceLabel: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },
  balanceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4, flexWrap: 'wrap' },
  balanceNumber: { fontSize: 28, fontWeight: '800', color: '#FFFFFF' },
  growthBadge: { backgroundColor: '#DCFCE7', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  growthBadgeDown: { backgroundColor: '#FEE2E2' },
  growthText: { fontSize: 11, fontWeight: '800', color: '#16A34A' },
  growthTextDown: { color: '#DC2626' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.35)', marginVertical: 14 },
  availableRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  // Total earnings on the left, purse artwork (transparent PNG) on the right
  totalRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  purseImg: { width: 72, height: 72, marginVertical: -6 },
  availableLabel: { fontSize: 12, fontWeight: '500', color: 'rgba(255,255,255,0.75)' },
  availableNumber: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', marginTop: 2 },
  withdrawBtn: { backgroundColor: '#FFFFFF', borderRadius: 20, height: 40, minWidth: 110, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  withdrawText: { fontSize: 14, fontWeight: '800', color: '#7A0EED' },

  // Section headers
  sectionRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  sectionHint: { fontSize: 12, fontWeight: '500', color: '#8A8A96' },
  viewAll: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  viewAllText: { fontSize: 13, fontWeight: '700', color: '#7A0EED' },

  // Earnings overview grid
  // Bleeds to the screen edges so cards scroll under the 16px gutter
  // Earnings overview grid
  // Bleeds to the screen edges so cards scroll under the 16px gutter
  overviewScroll: { marginHorizontal: -16, marginBottom: 16 },
  overviewRow: { paddingHorizontal: 16, paddingBottom: 4, gap: 10 },
  overviewCard: {
    width: 140, backgroundColor: '#FFFFFF', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 12, gap: 6,
    shadowColor: '#7A0EED', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  overviewTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  iconWrap: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  overviewLabel: { flex: 1, fontSize: 12, fontWeight: '700', color: '#1C1E22', lineHeight: 16, minHeight: 32 },
  overviewAmount: { fontSize: 16, fontWeight: '800', color: '#1C1E22' },
  overviewPct: { fontSize: 11, fontWeight: '600' },


  // Gem value card

  // Recent transactions
  txnList: {
    backgroundColor: '#FFFFFF', borderRadius: 16, overflow: 'hidden',
    shadowColor: '#7A0EED', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  txnRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 11 },
  txnBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F0EDF8' },
  txnIconWrap: { width: 36, height: 36, borderRadius: 10 },
  txnInfo: { flex: 1, gap: 2 },
  txnTitle: { fontSize: 14, fontWeight: '600', color: '#1C1E22' },
  txnSub: { fontSize: 12, color: '#ABADB2' },
  txnAmount: { fontSize: 14, fontWeight: '800', color: '#16A34A' },
  txnAmountOut: { color: '#DC2626' },
  txnAmountVoid: { color: '#ABADB2', textDecorationLine: 'line-through' },

  // Month sections in Recent Transactions
  monthBlock: { marginBottom: 14 },
  monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 8 },
  monthTitle: { fontSize: 13, fontWeight: '700', color: '#60626A' },
  monthSummary: { fontSize: 12, fontWeight: '700' },
  monthAdded: { color: '#16A34A' },
  monthWithdrawn: { color: '#DC2626' },

  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, gap: 10 },
  emptyText: { fontSize: 14, color: '#B0AEC0', fontWeight: '500' },
  emptyHint: { fontSize: 12, color: '#C8C5D8', fontWeight: '400' },
});
