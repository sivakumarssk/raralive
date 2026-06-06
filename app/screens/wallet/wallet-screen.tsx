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
import { BASE_URL, MEDIA_BASE } from '@/services/api';
import { authStore } from '@/store/auth-store';

const WHATSAPP_NUMBER = '+919676855851';

type WalletTab = 'coins' | 'gems';
type GemTab = 'chat-rooms' | 'friend-zone' | 'live';

type CoinPackage = {
  id: string; coins: number; price: string;
  original_price: string | null; discount: string; highlighted: boolean;
};

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

const FLASH_SALE_DURATION = 6322;

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

function resolveImg(url: string | null | undefined) {
  if (!url) return null;
  return url.startsWith('http') ? url : `${MEDIA_BASE}/${url.replace(/^\//, '')}`;
}

function formatGems(n: number): string {
  if (n >= 10_000_000) return `${(n / 10_000_000).toFixed(2)} Cr`;
  if (n >= 100_000)    return `${(n / 100_000).toFixed(2)} Lac`;
  if (n >= 1_000)      return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function monthLabel(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
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

// ── Chat Rooms gem history ────────────────────────────────────────────────────

function ChatRoomGems({ events }: { events: GiftEvent[] }) {
  if (events.length === 0) {
    return (
      <View style={gem.empty}>
        <Ionicons name="chatbubbles-outline" size={40} color="#D8D3EC" />
        <Text style={gem.emptyText}>No gems earned from chat rooms yet</Text>
      </View>
    );
  }

  const grouped = events.reduce<Record<string, GiftEvent[]>>((acc, ev) => {
    const key = monthLabel(ev.created_at);
    if (!acc[key]) acc[key] = [];
    acc[key].push(ev);
    return acc;
  }, {});

  return (
    <View style={gem.list}>
      {Object.entries(grouped).map(([month, evs]) => {
        const monthGems = evs.reduce((s, e) => s + e.gems_earned, 0);
        return (
          <View key={month} style={gem.group}>
            <View style={gem.groupHeader}>
              <Text style={gem.groupMonth}>{month}</Text>
              <Text style={gem.groupTotal}>+{monthGems.toLocaleString()} gems</Text>
            </View>
            {evs.map((ev, i) => (
              <View key={ev.id} style={[gem.row, i < evs.length - 1 && gem.rowBorder]}>
                {/* Gift image */}
                <View style={gem.giftImgWrap}>
                  {resolveImg(ev.gift_image_url)
                    ? <Image source={{ uri: resolveImg(ev.gift_image_url)! }} style={gem.giftImg} resizeMode="contain" />
                    : <Text style={gem.giftEmoji}>🎁</Text>}
                </View>
                {/* Info */}
                <View style={gem.rowInfo}>
                  <Text style={gem.rowTitle} numberOfLines={1}>
                    {ev.gift_name} × {ev.quantity}
                  </Text>
                  <Text style={gem.rowSub} numberOfLines={1}>
                    {ev.room_name} · from {ev.sender_name || (ev.sender_username ? `@${ev.sender_username}` : '?')}
                  </Text>
                </View>
                {/* Gems earned */}
                <View style={gem.rowRight}>
                  <Text style={gem.rowGems}>+{ev.gems_earned.toLocaleString()}</Text>
                  <Text style={gem.rowTime}>
                    {new Date(ev.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                  </Text>
                </View>
              </View>
            ))}
          </View>
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

function GemsTab({ gemBalance }: { gemBalance: number }) {
  const [activeGemTab, setActiveGemTab] = useState<GemTab>('chat-rooms');
  const [selectedPill, setSelectedPill] = useState<PillKey>('total');
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

  const chatroomGems  = history?.chatroom.total_gems   ?? 0;
  const friendzoneGems = history?.friendzone.total_gems ?? 0;
  const liveGems       = history?.live.total_gems       ?? 0;

  const displayGems = selectedPill === 'total'       ? gemBalance
    : selectedPill === 'chat-rooms'  ? chatroomGems
    : selectedPill === 'friend-zone' ? friendzoneGems
    : liveGems;

  const { label: displayLabel, color: displayColor } = PILL_META[selectedPill];

  const handlePillPress = (key: PillKey, tab?: GemTab) => {
    setSelectedPill(key);
    if (tab) setActiveGemTab(tab);
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
      {/* Big balance card — reflects selected pill */}
      <View style={s.balanceCard}>
        <Ionicons name="diamond" size={48} color={displayColor} />
        <Text style={[s.balanceNumber, { color: displayColor }]}>{formatGems(displayGems)}</Text>
        <Text style={s.balanceLabel}>{displayLabel}</Text>
      </View>

      {/* Source breakdown pills — tappable */}
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

      {/* Sub-tabs */}
      <GemTabSwitcher active={activeGemTab} onChange={setActiveGemTab} />

      {loading ? (
        <ActivityIndicator color="#7A0EED" style={{ marginTop: 32 }} />
      ) : (
        <>
          {activeGemTab === 'chat-rooms' && (
            <ChatRoomGems events={history?.chatroom.events ?? []} />
          )}
          {activeGemTab === 'friend-zone' && (
            <ComingSoonGems icon="people-outline" label="Friend Zone" />
          )}
          {activeGemTab === 'live' && (
            <ComingSoonGems icon="radio-outline" label="Live" />
          )}
        </>
      )}
    </ScrollView>
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
