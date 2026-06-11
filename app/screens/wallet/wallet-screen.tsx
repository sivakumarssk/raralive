import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BASE_URL } from '@/services/api';
import { authStore } from '@/store/auth-store';

const WHATSAPP_NUMBER = '+919676855851';

type WalletTab = 'coins' | 'gems';
type GemTab = 'chat-rooms' | 'friend-zone' | 'live';

type CoinPackage = {
  id: string; coins: number; price: string;
  original_price: string | null; discount: string; highlighted: boolean;
};

const FLASH_SALE_DURATION = 6322;

// ── Gem Tier Data ─────────────────────────────────────────────────────────────

type Tier = { gems: number; payout: number; hostPct: number };

const ALL_TIERS: Tier[] = [
  // Host 50%
  { gems: 12_500,      payout: 168,       hostPct: 50 },
  { gems: 20_000,      payout: 270,       hostPct: 50 },
  { gems: 40_000,      payout: 540,       hostPct: 50 },
  { gems: 80_000,      payout: 1_080,     hostPct: 50 },
  { gems: 105_000,     payout: 1_418,     hostPct: 50 },
  { gems: 185_000,     payout: 2_497,     hostPct: 50 },
  { gems: 255_000,     payout: 3_442,     hostPct: 50 },
  { gems: 355_000,     payout: 4_792,     hostPct: 50 },
  { gems: 510_000,     payout: 7_650,     hostPct: 50 },
  { gems: 735_000,     payout: 11_025,    hostPct: 50 },
  { gems: 1_025_000,   payout: 15_375,    hostPct: 50 },
  { gems: 1_380_000,   payout: 20_700,    hostPct: 50 },
  { gems: 1_860_000,   payout: 27_900,    hostPct: 50 },
  { gems: 2_415_000,   payout: 36_225,    hostPct: 50 },
  { gems: 2_895_000,   payout: 43_425,    hostPct: 50 },
  { gems: 3_325_000,   payout: 49_875,    hostPct: 50 },
  { gems: 3_820_000,   payout: 57_300,    hostPct: 50 },
  { gems: 4_200_000,   payout: 63_000,    hostPct: 50 },
  { gems: 4_620_000,   payout: 69_300,    hostPct: 50 },
  // Host 55%
  { gems: 5_016_000,   payout: 83_820,    hostPct: 55 },
  { gems: 5_585_000,   payout: 92_152,    hostPct: 55 },
  { gems: 6_140_000,   payout: 101_310,   hostPct: 55 },
  { gems: 6_750_000,   payout: 111_375,   hostPct: 55 },
  { gems: 7_425_000,   payout: 122_512,   hostPct: 55 },
  { gems: 8_165_000,   payout: 134_722,   hostPct: 55 },
  { gems: 8_980_000,   payout: 148_170,   hostPct: 55 },
  { gems: 9_875_000,   payout: 162_937,   hostPct: 55 },
  { gems: 10_860_000,  payout: 179_190,   hostPct: 55 },
  { gems: 11_945_000,  payout: 197_092,   hostPct: 55 },
  { gems: 13_135_000,  payout: 216_727,   hostPct: 55 },
  { gems: 14_445_000,  payout: 238_342,   hostPct: 55 },
  { gems: 15_165_000,  payout: 250_222,   hostPct: 55 },
  { gems: 15_920_000,  payout: 262_680,   hostPct: 55 },
  { gems: 16_715_000,  payout: 275_797,   hostPct: 55 },
  { gems: 17_380_000,  payout: 286_770,   hostPct: 55 },
  { gems: 18_075_000,  payout: 298_237,   hostPct: 55 },
  { gems: 18_795_000,  payout: 310_117,   hostPct: 55 },
  { gems: 19_545_000,  payout: 322_492,   hostPct: 55 },
  { gems: 20_130_000,  payout: 332_145,   hostPct: 55 },
  { gems: 20_730_000,  payout: 342_045,   hostPct: 55 },
  { gems: 21_555_000,  payout: 355_657,   hostPct: 55 },
  { gems: 22_415_000,  payout: 369_847,   hostPct: 55 },
  { gems: 23_310_000,  payout: 384_615,   hostPct: 55 },
  { gems: 24_475_000,  payout: 403_837,   hostPct: 55 },
  { gems: 25_695_000,  payout: 423_967,   hostPct: 55 },
  { gems: 26_945_000,  payout: 444_593,   hostPct: 55 },
  { gems: 28_945_000,  payout: 477_593,   hostPct: 55 },
  { gems: 30_945_000,  payout: 510_592,   hostPct: 55 },
  { gems: 32_945_000,  payout: 543_592,   hostPct: 55 },
  { gems: 34_945_000,  payout: 576_592,   hostPct: 55 },
  { gems: 37_445_000,  payout: 617_842,   hostPct: 55 },
  { gems: 39_945_000,  payout: 659_092,   hostPct: 55 },
  { gems: 42_445_000,  payout: 700_342,   hostPct: 55 },
  { gems: 45_445_000,  payout: 749_842,   hostPct: 55 },
  { gems: 48_445_000,  payout: 799_342,   hostPct: 55 },
  { gems: 51_445_000,  payout: 848_842,   hostPct: 55 },
  { gems: 54_945_000,  payout: 906_592,   hostPct: 55 },
  { gems: 58_445_000,  payout: 964_342,   hostPct: 55 },
  { gems: 61_945_000,  payout: 1_022_092, hostPct: 55 },
  { gems: 65_945_000,  payout: 1_088_092, hostPct: 55 },
];

const WINDOW_SIZE = 20;

function formatN(n: number): string {
  return n.toLocaleString('en-IN');
}

function formatPayout(n: number): string {
  return n.toLocaleString('en-IN');
}

function formatPerGem(gems: number, payout: number): string {
  const rate = payout / gems;
  if (rate >= 1)    return `₹${rate.toFixed(2)}/Gem`;
  if (rate >= 0.01) return `₹${rate.toFixed(3)}/Gem`;
  return `₹${rate.toFixed(4)}/Gem`;
}

// ── Gem Tiers component ───────────────────────────────────────────────────────

function GemTiers({ gemBalance }: { gemBalance: number }) {
  // Highest tier index the user has fully reached
  const currentTierIdx = (() => {
    let idx = -1;
    for (let i = 0; i < ALL_TIERS.length; i++) {
      if (gemBalance >= ALL_TIERS[i].gems) idx = i; else break;
    }
    return idx;
  })();

  // Sliding window of 20: keep 1 completed row at top if any, rest are upcoming
  const windowStart  = Math.max(0, currentTierIdx);
  const windowEnd    = Math.min(ALL_TIERS.length, windowStart + WINDOW_SIZE);
  const visibleTiers = ALL_TIERS.slice(windowStart, windowEnd);

  return (
    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={tier.container}>
      {/* Column headers */}
      <View style={tier.colHeader}>
        <Text style={tier.colLeft}>Getting Gems</Text>
        <Text style={tier.colRight}>Host Payment</Text>
      </View>

      <View style={tier.list}>
        {visibleTiers.map((t, i) => {
          const absIdx      = windowStart + i;
          const isCompleted = absIdx <= currentTierIdx;
          const isCurrent   = absIdx === currentTierIdx + 1;
          const isLast      = i === visibleTiers.length - 1;

          if (isCompleted) {
            return (
              <View key={absIdx} style={[tier.row, !isLast && tier.rowBorder, tier.rowDone]}>
                <View style={tier.leftCol}>
                  <Ionicons name="checkmark-circle" size={15} color="#16A34A" style={{ marginRight: 6 }} />
                  <View>
                    <Text style={tier.gemsTextDone}>{formatN(t.gems)}</Text>
                    <Text style={tier.perGemDone}>{formatPerGem(t.gems, t.payout)}</Text>
                  </View>
                </View>
                <View style={[tier.payoutBadge, tier.payoutBadgeDone]}>
                  <Text style={[tier.payoutBadgeText, tier.payoutBadgeTextDone]}>₹{formatPayout(t.payout)}</Text>
                </View>
              </View>
            );
          }

          if (isCurrent) {
            return (
              <LinearGradient
                key={absIdx}
                colors={['#7A0EED14', '#B5035714']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={[tier.row, !isLast && tier.rowBorder, tier.rowCurrent]}>
                <View style={tier.leftCol}>
                  <View style={tier.currDot} />
                  <View>
                    <Text style={tier.gemsTextCurrent}>{formatN(t.gems)}</Text>
                    <Text style={tier.perGemCurrent}>{formatPerGem(t.gems, t.payout)}</Text>
                  </View>
                </View>
                <LinearGradient
                  colors={['#7A0EED', '#B50357']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={tier.payoutBadge}>
                  <Text style={tier.payoutBadgeText}>₹{formatPayout(t.payout)}</Text>
                </LinearGradient>
              </LinearGradient>
            );
          }

          // future row — payout badge in purple tint
          return (
            <View key={absIdx} style={[tier.row, !isLast && tier.rowBorder]}>
              <View style={tier.leftCol}>
                <Ionicons name="diamond-outline" size={14} color="#C4B8E8" style={{ marginRight: 6 }} />
                <View>
                  <Text style={tier.gemsText}>{formatN(t.gems)}</Text>
                  <Text style={tier.perGemText}>{formatPerGem(t.gems, t.payout)}</Text>
                </View>
              </View>
              <View style={[tier.payoutBadge, tier.payoutBadgeFuture]}>
                <Text style={[tier.payoutBadgeText, tier.payoutBadgeTextFuture]}>₹{formatPayout(t.payout)}</Text>
              </View>
            </View>
          );
        })}
      </View>

      <Text style={tier.footer}>Gems are earned when viewers send you gifts in chat rooms</Text>
    </ScrollView>
  );
}

type GiftEvent = {
  id: string; coins: number; quantity: number; gems_earned: number;
  gift_name: string; gift_image_url: string | null; created_at: string;
  room_name: string; room_id: string;
  sender_name: string | null; sender_username: string | null; sender_avatar: string | null;
};

type GemHistory = {
  chatroom: { total_gems: number; events: GiftEvent[] };
  friendzone: { total_gems: number; events: [] };
  live: { total_gems: number; events: [] };
};

function formatGems(n: number): string {
  if (n >= 10_000_000) return `${(n / 10_000_000).toFixed(2)} Cr`;
  if (n >= 100_000)    return `${(n / 100_000).toFixed(2)} Lac`;
  if (n >= 1_000)      return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

// ── Gem sub-tab switcher ──────────────────────────────────────────────────────

const GEM_TABS: { key: GemTab; label: string }[] = [
  { key: 'chat-rooms', label: 'Chat Rooms' },
  { key: 'friend-zone', label: 'Friend Zone' },
  { key: 'live', label: 'Live' },
];

function GemTabSwitcher({ active, onChange }: { active: GemTab; onChange: (t: GemTab) => void }) {
  return (
    <View style={gt.wrapper}>
      {GEM_TABS.map(tab => {
        const isActive = tab.key === active;
        return (
          <TouchableOpacity key={tab.key} onPress={() => onChange(tab.key)} activeOpacity={0.75} style={gt.btn}>
            <Text style={[gt.label, isActive && gt.labelActive]}>{tab.label}</Text>
            {isActive && <View style={gt.underline} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── Placeholder for Friend Zone / Live ────────────────────────────────────────

function ComingSoonGems({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={gem.empty}>
      <Ionicons name={icon as any} size={40} color="#D8D3EC" />
      <Text style={gem.emptyText}>No gems from {label} yet</Text>
      <Text style={gem.emptyHint}>Gems from {label} will appear here</Text>
    </View>
  );
}

// ── Gems Tab ──────────────────────────────────────────────────────────────────

type PillKey = 'total' | 'chat-rooms' | 'friend-zone' | 'live';

const PILL_META: Record<PillKey, { label: string; color: string }> = {
  'total':       { label: 'Total Gems',   color: '#A855F7' },
  'chat-rooms':  { label: 'Chat Rooms',   color: '#7A0EED' },
  'friend-zone': { label: 'Friend Zone',  color: '#0EA5E9' },
  'live':        { label: 'Live',         color: '#E91E7F' },
};

function useCountdown(seconds: number) {
  const [remaining, setRemaining] = useState(seconds);
  useEffect(() => {
    const interval = setInterval(() => setRemaining(p => (p > 0 ? p - 1 : 0)), 1000);
    return () => clearInterval(interval);
  }, []);
  const h = Math.floor(remaining / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  const s = remaining % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function GemsTab({ gemBalance }: { gemBalance: number }) {
  const [activeGemTab, setActiveGemTab] = useState<GemTab>('chat-rooms');
  const [selectedPill, setSelectedPill] = useState<PillKey>('chat-rooms');
  const [history, setHistory] = useState<GemHistory | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = authStore.getToken();
    if (!token) { setLoading(false); return; }
    fetch(`${BASE_URL}/tasks/gem-history`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(j => { if (j.success) setHistory(j.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const chatroomGems   = history?.chatroom.total_gems   ?? 0;
  const friendzoneGems = history?.friendzone.total_gems ?? 0;
  const liveGems       = history?.live.total_gems       ?? 0;

  const displayGems = selectedPill === 'total'       ? gemBalance
    : selectedPill === 'chat-rooms'  ? chatroomGems
    : selectedPill === 'friend-zone' ? friendzoneGems
    : liveGems;

  // Use the selected tab's gems to determine the tier window
  const tierGems = activeGemTab === 'chat-rooms'  ? chatroomGems
    : activeGemTab === 'friend-zone' ? friendzoneGems
    : liveGems;

  const { label: displayLabel, color: displayColor } = PILL_META[selectedPill];

  const handlePillPress = (key: PillKey, tab?: GemTab) => {
    setSelectedPill(key);
    if (tab) setActiveGemTab(tab);
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Fixed header: balance card + pills + sub-tabs */}
      <View style={s.gemHeader}>
        <View style={s.balanceCard}>
          <Ionicons name="diamond" size={48} color={displayColor} />
          <Text style={[s.balanceNumber, { color: displayColor }]}>{formatGems(displayGems)}</Text>
          <Text style={s.balanceLabel}>{displayLabel}</Text>
        </View>

        <View style={gem.sourcePills}>
          <SourcePill
            icon="chatbubbles" label="Chat Rooms" gems={chatroomGems} color="#7A0EED"
            active={selectedPill === 'chat-rooms'}
            onPress={() => handlePillPress('chat-rooms', 'chat-rooms')}
          />
          <SourcePill
            icon="people" label="Friend Zone" gems={friendzoneGems} color="#0EA5E9"
            active={selectedPill === 'friend-zone'}
            onPress={() => handlePillPress('friend-zone', 'friend-zone')}
          />
          <SourcePill
            icon="radio" label="Live" gems={liveGems} color="#E91E7F"
            active={selectedPill === 'live'}
            onPress={() => handlePillPress('live', 'live')}
          />
        </View>

        <GemTabSwitcher active={activeGemTab} onChange={setActiveGemTab} />
      </View>

      {/* Scrollable tier list only */}
      {loading ? (
        <ActivityIndicator color="#7A0EED" style={{ marginTop: 32 }} />
      ) : (
        <>
          {activeGemTab === 'chat-rooms' && (
            <GemTiers gemBalance={tierGems} />
          )}
          {activeGemTab === 'friend-zone' && (
            <ComingSoonGems icon="people-outline" label="Friend Zone" />
          )}
          {activeGemTab === 'live' && (
            <ComingSoonGems icon="radio-outline" label="Live" />
          )}
        </>
      )}
    </View>
  );
}

function SourcePill({ icon, label, gems, color, active = false, onPress }: {
  icon: string; label: string; gems: number; color: string;
  active?: boolean; onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[gem.pill, { borderColor: active ? color : color + '33', backgroundColor: active ? color + '12' : '#FAFAFA' }]}>
      <Ionicons name={icon as any} size={14} color={color} />
      <View style={gem.pillText}>
        <Text style={[gem.pillGems, { color }]}>{formatGems(gems)}</Text>
        <Text style={gem.pillLabel}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Main Wallet Screen ────────────────────────────────────────────────────────

export function WalletScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<WalletTab>('coins');
  const countdown = useCountdown(FLASH_SALE_DURATION);
  const username = authStore.getUser()?.username ?? '';
  const [coinBalance, setCoinBalance] = useState(0);
  const [gemBalance, setGemBalance] = useState(0);
  const [packages, setPackages] = useState<CoinPackage[]>([]);
  const [pkgLoading, setPkgLoading] = useState(true);

  useEffect(() => {
    const token = authStore.getToken();
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    fetch(`${BASE_URL}/wallet/me`, { headers }).then(r => r.json()).then(j => { if (j.success) setCoinBalance(j.data.coins); }).catch(() => {});
    fetch(`${BASE_URL}/tasks/gems`, { headers }).then(r => r.json()).then(j => { if (j.success) setGemBalance(j.data.gems); }).catch(() => {});
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
        <TouchableOpacity style={s.headerBtn} hitSlop={8}>
          <Ionicons name="time-outline" size={22} color="#1C1E22" />
        </TouchableOpacity>
      </View>

      {/* Coins / Gems tabs */}
      <View style={s.tabRow}>
        {(['coins', 'gems'] as WalletTab[]).map(tab => (
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
          <View style={s.balanceCard}>
            <Image source={require('@/assets/tabs/coin.png')} style={s.coinIcon} resizeMode="contain" />
            <Text style={s.balanceNumber}>{coinBalance.toLocaleString()}</Text>
            <Text style={s.balanceLabel}>Coins</Text>
          </View>

          <View style={s.flashRow}>
            <View style={s.flashLeft}>
              <Ionicons name="flash" size={18} color="#E91E7F" />
              <Text style={s.flashTitle}>Flash Sale</Text>
            </View>
            <View style={s.timerBadge}>
              <Ionicons name="time-outline" size={13} color="#E91E7F" />
              <Text style={s.timerText}>{countdown}</Text>
            </View>
          </View>

          {pkgLoading ? (
            <ActivityIndicator color="#7A0EED" style={{ marginTop: 20 }} />
          ) : (
            <View style={s.packageList}>
              {packages.map(pkg => <PackageRow key={pkg.id} pkg={pkg} username={username} />)}
            </View>
          )}
        </ScrollView>
      )}

      {/* Gems tab */}
      {activeTab === 'gems' && <GemsTab gemBalance={gemBalance} />}
    </SafeAreaView>
  );
}

// ── Package Row ───────────────────────────────────────────────────────────────

function PackageRow({ pkg, username }: { pkg: CoinPackage; username: string }) {
  const price = parseFloat(pkg.price);
  const origPrice = pkg.original_price ? parseFloat(pkg.original_price) : null;
  const discount = parseFloat(pkg.discount);

  const handlePress = () => {
    const text = `Hi, I want to buy a package of ${pkg.coins} coins for ₹${price.toFixed(0)} on Rara Live.\nUsername: @${username}`;
    Linking.openURL(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`).catch(() => {});
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.8} style={[s.pkgRow, pkg.highlighted && s.pkgRowHighlighted]}>
      <View style={s.pkgLeft}>
        <View style={s.pkgCoinRow}>
          <Text style={s.pkgCoins}>{pkg.coins.toLocaleString()}</Text>
          <Text style={s.pkgCoinsLabel}> COINS</Text>
        </View>
        {discount > 0 && (
          <View style={s.discountBadge}>
            <Text style={s.discountText}>-{discount.toFixed(0)}%</Text>
          </View>
        )}
      </View>
      {pkg.highlighted ? (
        <LinearGradient colors={['#B44FE8', '#7A0EED']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.priceGradientBtn}>
          <Text style={s.priceGradientText}>₹{price.toFixed(0)}</Text>
          {origPrice && <Text style={s.origPriceGradient}> ₹{origPrice.toFixed(0)}—</Text>}
        </LinearGradient>
      ) : (
        <View style={s.priceBtn}>
          <Text style={s.priceText}>₹{price.toFixed(0)}</Text>
          {origPrice && <Text style={s.origPrice}> ₹{origPrice.toFixed(0)}—</Text>}
        </View>
      )}
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F7F4FD' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#F7F4FD' },
  headerBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700', color: '#1C1E22' },
  tabRow: { flexDirection: 'row', marginHorizontal: 16, backgroundColor: '#EDE8F8', borderRadius: 30, padding: 4, marginBottom: 16 },
  tabBtn: { flex: 1, paddingVertical: 9, borderRadius: 26, alignItems: 'center' },
  tabBtnActive: { backgroundColor: '#FFFFFF', shadowColor: '#7A0EED', shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  tabText: { fontSize: 14, fontWeight: '500', color: '#7A7A8A' },
  tabTextActive: { color: '#1C1E22', fontWeight: '700' },
  scroll: { paddingHorizontal: 16, paddingBottom: 40 },
  balanceCard: { backgroundColor: '#FFFFFF', borderRadius: 20, paddingVertical: 24, alignItems: 'center', marginBottom: 16, gap: 4, shadowColor: '#7A0EED', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  coinIcon: { width: 56, height: 56, marginBottom: 6 },
  balanceNumber: { fontSize: 34, fontWeight: '800', color: '#1C1E22' },
  balanceLabel: { fontSize: 15, fontWeight: '400', color: '#7A7A8A' },
  flashRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFF0F7', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 14 },
  flashLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  flashTitle: { fontSize: 16, fontWeight: '700', color: '#1C1E22' },
  timerBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFE0EF', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  timerText: { fontSize: 13, fontWeight: '700', color: '#E91E7F' },
  packageList: { gap: 10 },
  pkgRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  pkgRowHighlighted: { borderWidth: 1.5, borderColor: '#B44FE8' },
  pkgLeft: { gap: 6 },
  pkgCoinRow: { flexDirection: 'row', alignItems: 'baseline' },
  pkgCoins: { fontSize: 22, fontWeight: '800', color: '#1C1E22' },
  pkgCoinsLabel: { fontSize: 11, fontWeight: '600', color: '#7A7A8A', letterSpacing: 0.5 },
  discountBadge: { backgroundColor: '#E91E7F', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, alignSelf: 'flex-start' },
  discountText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  priceBtn: { flexDirection: 'row', alignItems: 'baseline', backgroundColor: '#F3EFFE', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 30 },
  priceText: { fontSize: 16, fontWeight: '700', color: '#1C1E22' },
  origPrice: { fontSize: 12, color: '#ABADB2', textDecorationLine: 'line-through' },
  priceGradientBtn: { flexDirection: 'row', alignItems: 'baseline', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 30 },
  priceGradientText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  origPriceGradient: { fontSize: 12, color: 'rgba(255,255,255,0.65)', textDecorationLine: 'line-through' },
  gemHeader: { paddingHorizontal: 16, paddingTop: 0, paddingBottom: 0 },
});

// Gem tier styles
const tier = StyleSheet.create({
  container:  { gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40 },
  colHeader:  { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 6, paddingBottom: 2 },
  colLeft:    { fontSize: 12, fontWeight: '700', color: '#7A7A8A', textTransform: 'uppercase', letterSpacing: 0.4 },
  colRight:   { fontSize: 12, fontWeight: '700', color: '#7A7A8A', textTransform: 'uppercase', letterSpacing: 0.4 },
  list: {
    backgroundColor: '#FFFFFF', borderRadius: 18,
    shadowColor: '#7A0EED', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 3,
    overflow: 'hidden',
  },
  row:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  rowBorder:  { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F0EDF8' },
  rowDone:    { backgroundColor: '#F4FBF5' },
  rowCurrent: { borderLeftWidth: 3, borderLeftColor: '#7A0EED' },
  leftCol:    { flexDirection: 'row', alignItems: 'center' },
  currDot:    { width: 8, height: 8, borderRadius: 4, backgroundColor: '#7A0EED', marginRight: 8 },

  // future rows
  gemsText:    { fontSize: 14, fontWeight: '600', color: '#1C1E22' },
  perGemText:  { fontSize: 11, color: '#ABADB2', fontWeight: '400', marginTop: 1 },
  payoutText:  { fontSize: 14, fontWeight: '600', color: '#6B7280' },

  // completed rows
  gemsTextDone:  { fontSize: 14, fontWeight: '700', color: '#16A34A' },
  perGemDone:    { fontSize: 11, color: '#86EFAC', fontWeight: '400', marginTop: 1 },
  payoutTextDone:{ fontSize: 14, fontWeight: '700', color: '#16A34A' },

  // current (next target) row
  gemsTextCurrent:  { fontSize: 15, fontWeight: '800', color: '#7A0EED' },
  perGemCurrent:    { fontSize: 11, color: '#A78BFA', fontWeight: '500', marginTop: 1 },

  // payout badge — shared shape, different fills per state
  payoutBadge:            { borderRadius: 20, paddingHorizontal: 13, paddingVertical: 6, alignItems: 'center', justifyContent: 'center' },
  payoutBadgeText:        { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
  // done: green tint
  payoutBadgeDone:        { backgroundColor: '#16A34A' },
  payoutBadgeTextDone:    { color: '#FFFFFF' },
  // future: soft purple pill
  payoutBadgeFuture:      { backgroundColor: '#EDE8F8' },
  payoutBadgeTextFuture:  { color: '#7A0EED', fontWeight: '700' },

  footer: { textAlign: 'center', fontSize: 12, color: '#ABADB2', paddingHorizontal: 20, lineHeight: 17 },
});

// Gem sub-tab switcher styles
const gt = StyleSheet.create({
  wrapper: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#EEEAF6', marginBottom: 16 },
  btn: { flex: 1, paddingVertical: 12, alignItems: 'center', position: 'relative' },
  label: { fontSize: 13, fontWeight: '500', color: '#ABADB2' },
  labelActive: { color: '#7A0EED', fontWeight: '700' },
  underline: { position: 'absolute', bottom: -1, left: 8, right: 8, height: 2.5, borderRadius: 2, backgroundColor: '#7A0EED' },
});

// Gem content styles
const gem = StyleSheet.create({
  sourcePills: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  pill: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FAFAFA', borderRadius: 12, padding: 10, borderWidth: 1 },
  pillText: { flex: 1 },
  pillGems: { fontSize: 14, fontWeight: '800' },
  pillLabel: { fontSize: 10, color: '#ABADB2', fontWeight: '500', marginTop: 1 },
  sectionDivider: { paddingVertical: 12, paddingHorizontal: 2 },
  sectionLabel: { fontSize: 14, fontWeight: '700', color: '#1C1E22' },
  list: { gap: 12 },
  group: { backgroundColor: '#FFFFFF', borderRadius: 16, overflow: 'hidden', shadowColor: '#7A0EED', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#F9F5FF' },
  groupMonth: { fontSize: 13, fontWeight: '700', color: '#1C1E22' },
  groupTotal: { fontSize: 12, fontWeight: '700', color: '#A855F7' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F0EDF8' },
  giftImgWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F5F0FF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  giftImg: { width: 32, height: 32 },
  giftEmoji: { fontSize: 20 },
  rowInfo: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 13, fontWeight: '700', color: '#1C1E22' },
  rowSub: { fontSize: 11, color: '#ABADB2', fontWeight: '400' },
  rowRight: { alignItems: 'flex-end', gap: 2 },
  rowGems: { fontSize: 13, fontWeight: '800', color: '#A855F7' },
  rowTime: { fontSize: 10, color: '#ABADB2' },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, gap: 10 },
  emptyText: { fontSize: 14, color: '#B0AEC0', fontWeight: '500' },
  emptyHint: { fontSize: 12, color: '#C8C5D8', fontWeight: '400' },
});
