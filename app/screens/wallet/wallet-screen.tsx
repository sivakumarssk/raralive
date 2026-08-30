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

// Index where 55% tiers start
const FIRST_55_IDX = ALL_TIERS.findIndex(t => t.hostPct === 55);

function PctBadge({ pct, done }: { pct: number; done?: boolean }) {
  const is55 = pct === 55;
  return (
    <View style={[tier.pctBadge, is55 ? tier.pctBadge55 : tier.pctBadge50, done && tier.pctBadgeDone]}>
      <Text style={[tier.pctBadgeText, is55 ? tier.pctBadgeText55 : tier.pctBadgeText50, done && tier.pctBadgeTextDone]}>
        {pct}%
      </Text>
    </View>
  );
}

function UnlockBanner() {
  return (
    <LinearGradient
      colors={['#7A0EED22', '#B5035722']}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
      style={tier.unlockBanner}>
      <Ionicons name="arrow-up-circle" size={16} color="#7A0EED" />
      <Text style={tier.unlockText}>
        Complete target &amp; unlock{' '}
        <Text style={tier.unlockHighlight}>55% withdraw value</Text>
      </Text>
      <Ionicons name="chevron-forward" size={14} color="#B50357" />
    </LinearGradient>
  );
}

function GemTiers({ gemBalance }: { gemBalance: number }) {
  const currentTierIdx = (() => {
    let idx = -1;
    for (let i = 0; i < ALL_TIERS.length; i++) {
      if (gemBalance >= ALL_TIERS[i].gems) idx = i; else break;
    }
    return idx;
  })();

  const windowStart  = Math.max(0, currentTierIdx);
  const windowEnd    = Math.min(ALL_TIERS.length, windowStart + WINDOW_SIZE);
  const visibleTiers = ALL_TIERS.slice(windowStart, windowEnd);

  // Whether banner should appear inside visible window
  const bannerAbsIdx = FIRST_55_IDX; // show banner just before first 55% row

  const rows: React.ReactNode[] = [];
  let bannerInserted = false;

  visibleTiers.forEach((t, i) => {
    const absIdx      = windowStart + i;
    const isCompleted = absIdx <= currentTierIdx;
    const isCurrent   = absIdx === currentTierIdx + 1;
    const isLast      = i === visibleTiers.length - 1;

    // Insert unlock banner before first 55% row (only if not yet in 55% zone)
    if (!bannerInserted && absIdx === bannerAbsIdx && currentTierIdx < FIRST_55_IDX - 1) {
      rows.push(<UnlockBanner key="unlock-banner" />);
      bannerInserted = true;
    }

    if (isCompleted) {
      const isTopCompleted = absIdx === currentTierIdx;
      const handleWithdraw = () => {
        const text = `Hi, I want to withdraw ${formatN(t.gems)} gems (₹${formatPayout(t.payout)}) on Rara Live.\nUsername: @${authStore.getUser()?.username ?? ''}`;
        Linking.openURL(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`).catch(() => {});
      };

      rows.push(
        <View key={absIdx} style={[tier.row, !isLast && tier.rowBorder, tier.rowDone]}>
          <View style={tier.leftCol}>
            <Ionicons name="checkmark-circle" size={15} color="#16A34A" style={{ marginRight: 6 }} />
            <View>
              <Text style={tier.gemsTextDone}>{formatN(t.gems)}</Text>
              <Text style={tier.perGemDone}>{formatPerGem(t.gems, t.payout)}</Text>
            </View>
          </View>
          <View style={tier.rightCol}>
            <PctBadge pct={t.hostPct} done />
            {isTopCompleted ? (
              <TouchableOpacity activeOpacity={0.8} onPress={handleWithdraw} style={gem.withdrawBtn}>
                <Ionicons name="cash-outline" size={13} color="#FFFFFF" />
                <Text style={gem.withdrawText}>₹{formatPayout(t.payout)}</Text>
              </TouchableOpacity>
            ) : (
              <View style={[tier.payoutBadge, tier.payoutBadgeDone]}>
                <Text style={[tier.payoutBadgeText, tier.payoutBadgeTextDone]}>₹{formatPayout(t.payout)}</Text>
              </View>
            )}
          </View>
        </View>
      );
      return;
    }

    if (isCurrent) {
      rows.push(
        <LinearGradient
          key={absIdx}
          colors={['#1D6FE014', '#4A90E214']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={[tier.row, !isLast && tier.rowBorder, tier.rowCurrent]}>
          <View style={tier.leftCol}>
            <Ionicons name="diamond" size={16} color="#1D6FE0" style={{ marginRight: 6 }} />
            <View>
              <Text style={tier.gemsTextCurrent}>{formatN(t.gems)}</Text>
              <Text style={tier.perGemCurrent}>{formatPerGem(t.gems, t.payout)}</Text>
            </View>
          </View>
          <View style={tier.rightCol}>
            <PctBadge pct={t.hostPct} />
            <View style={tier.payoutBadge}>
              <Text style={tier.payoutBadgeText}>₹{formatPayout(t.payout)}</Text>
            </View>
          </View>
        </LinearGradient>
      );
      return;
    }

    rows.push(
      <View key={absIdx} style={[tier.row, !isLast && tier.rowBorder]}>
        <View style={tier.leftCol}>
          <Ionicons name="diamond" size={14} color="#4A90E2" style={{ marginRight: 6 }} />
          <View>
            <Text style={tier.gemsText}>{formatN(t.gems)}</Text>
            <Text style={tier.perGemText}>{formatPerGem(t.gems, t.payout)}</Text>
          </View>
        </View>
        <View style={tier.rightCol}>
          <PctBadge pct={t.hostPct} />
          <View style={[tier.payoutBadge, tier.payoutBadgeFuture]}>
            <Text style={[tier.payoutBadgeText, tier.payoutBadgeTextFuture]}>₹{formatPayout(t.payout)}</Text>
          </View>
        </View>
      </View>
    );
  });

  return (
    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={tier.container}>
      <View style={tier.colHeader}>
        <Text style={tier.colLeft}>Getting Gems</Text>
        <Text style={tier.colRight}>Rate · Host Payment</Text>
      </View>

      <View style={tier.list}>{rows}</View>

      <View style={gem.withdrawInfoCard}>
        <View style={gem.withdrawInfoIconWrap}>
          <Ionicons name="gift" size={20} color="#1D6FE0" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={gem.withdrawInfoTitle}>Withdraw Value</Text>
          <Text style={gem.withdrawInfoSub}>{ALL_TIERS[0].hostPct}% of gems will be added to your wallet balance.</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#ABADB2" />
      </View>
    </ScrollView>
  );
}

type GiftEvent = {
  id: string; coins: number; quantity: number; gems_earned: number;
  gift_name: string; gift_image_url: string | null; created_at: string;
  room_name: string; room_id: string;
  sender_name: string | null; sender_username: string | null; sender_avatar: string | null;
};

type FriendZoneCallEarning = {
  kind: 'call';
  id: string; call_type: 'audio' | 'video'; duration_seconds: number; gems_earned: number;
  created_at: string;
  caller_name: string | null; caller_username: string | null; caller_avatar: string | null;
};

type FriendZoneGiftEarning = {
  kind: 'gift';
  id: string; call_type: 'audio' | 'video'; gift_name: string; gift_image_url: string | null;
  coins: number; quantity: number; gems_earned: number; created_at: string;
  sender_name: string | null; sender_username: string | null; sender_avatar: string | null;
};

type FriendZoneEarning = FriendZoneCallEarning | FriendZoneGiftEarning;

type GemHistory = {
  chatroom: { total_gems: number; events: GiftEvent[] };
  friendzone: { total_gems: number; events: FriendZoneEarning[] };
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

// ── Placeholder for Live ──────────────────────────────────────────────────────

function ComingSoonGems({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={gem.empty}>
      <Ionicons name={icon as any} size={40} color="#D8D3EC" />
      <Text style={gem.emptyText}>No gems from {label} yet</Text>
      <Text style={gem.emptyHint}>Gems from {label} will appear here</Text>
    </View>
  );
}

// ── Friend Zone earnings list ─────────────────────────────────────────────────

function formatCallDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function FriendZoneEarningsList({ events }: { events: FriendZoneEarning[] }) {
  if (events.length === 0) {
    return <ComingSoonGems icon="people-outline" label="Friend Zone" />;
  }

  return (
    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={tier.container}>
      <View style={gem.group}>
        {events.map((e, i) => {
          const isGift = e.kind === 'gift';
          const person = isGift
            ? (e.sender_name || e.sender_username || 'Unknown')
            : (e.caller_name || e.caller_username || 'Unknown');
          return (
            <View key={e.id} style={[gem.row, i < events.length - 1 && gem.rowBorder]}>
              <View style={gem.giftImgWrap}>
                <Ionicons
                  name={isGift ? 'gift' : (e.call_type === 'video' ? 'videocam' : 'call')}
                  size={18}
                  color="#0EA5E9"
                />
              </View>
              <View style={gem.rowInfo}>
                <Text style={gem.rowTitle} numberOfLines={1}>{person}</Text>
                <Text style={gem.rowSub}>
                  {isGift
                    ? `Sent ${e.quantity > 1 ? `${e.quantity}x ` : ''}${e.gift_name}`
                    : `${e.call_type === 'video' ? 'Video call' : 'Audio call'} · ${formatCallDuration(e.duration_seconds)}`}
                </Text>
              </View>
              <View style={gem.rowRight}>
                <Text style={gem.rowGems}>+{formatGems(e.gems_earned)}</Text>
                <Text style={gem.rowTime}>
                  {new Date(e.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
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

function nextTierFor(gems: number) {
  for (const t of ALL_TIERS) { if (gems < t.gems) return t; }
  return null;
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

  const { label: displayLabel } = PILL_META[selectedPill];
  const nt = nextTierFor(tierGems);

  const handlePillPress = (key: PillKey, tab?: GemTab) => {
    setSelectedPill(key);
    if (tab) setActiveGemTab(tab);
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Fixed header: balance card + pills + sub-tabs */}
      <View style={s.gemHeader}>
        <LinearGradient
          colors={['#EAF4FF', '#DCEBFF']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={gem.balanceCard}>
          <View style={gem.balanceCardTop}>
            <Ionicons name="diamond" size={14} color="#1D6FE0" />
            <Text style={gem.balanceCardLabel}>{displayLabel}</Text>
          </View>
          <Text style={gem.balanceCardNumber}>{formatGems(displayGems)}</Text>
          <Text style={gem.balanceCardInr}>≈ ₹{(displayGems * 0.0135).toFixed(2)}</Text>
          <Image source={require('@/assets/tabs/wallet/gemscard.png')} style={gem.balanceCardImage} resizeMode="contain" />
        </LinearGradient>

        <View style={gem.sourcePills}>
          <SourcePill
            icon="chatbubble-ellipses" label="Chat Rooms" gems={chatroomGems} color="#1D6FE0"
            active={selectedPill === 'chat-rooms'}
            onPress={() => handlePillPress('chat-rooms', 'chat-rooms')}
          />
          <SourcePill
            icon="people" label="Friend Zone" gems={friendzoneGems} color="#1D6FE0"
            active={selectedPill === 'friend-zone'}
            onPress={() => handlePillPress('friend-zone', 'friend-zone')}
          />
          <SourcePill
            icon="radio" label="Live" gems={liveGems} color="#E91E7F"
            active={selectedPill === 'live'}
            onPress={() => handlePillPress('live', 'live')}
          />
        </View>

        {nt && (
          <View style={gem.targetCard}>
            <View style={gem.targetTop}>
              <View style={gem.targetLeft}>
                <Ionicons name="flag" size={13} color="#1D6FE0" />
                <Text style={gem.targetText}>
                  Next target: <Text style={gem.targetVal}>{formatN(nt.gems)} gems</Text>
                </Text>
              </View>
              <Text style={gem.targetPct}>{nt.hostPct}% withdraw value</Text>
            </View>
            <View style={gem.targetTrack}>
              <View style={[gem.targetFill, { width: `${Math.min(100, (tierGems / nt.gems) * 100)}%` }]} />
            </View>
          </View>
        )}

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
            <FriendZoneEarningsList events={history?.friendzone.events ?? []} />
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
          <LinearGradient
            colors={['#7A0EED', '#E91E7F']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={s.balanceCard}>
            <View style={s.balanceCardTop}>
              <Ionicons name="logo-usd" size={16} color="#FFD75E" />
              <Text style={s.balanceCardLabel}>Total Coins</Text>
            </View>
            <Text style={s.balanceCardNumber}>{coinBalance.toLocaleString()}</Text>
            <Image source={require('@/assets/tabs/wallet/walletcard.png')} style={s.coinIcon} resizeMode="contain" />
          </LinearGradient>

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

          <Text style={s.sectionHeading}>Buy Coins</Text>

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
    const text = `Hi, I want to buy a package of ${pkg.coins} coins for ₹${price.toFixed(0)} on Rara Live.\nUsername: @${username}`;
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
          <Text style={s.pkgCoinsLabel}> COINS</Text>
        </View>
        {discount > 0 && (
          <View style={s.discountBadge}>
            <Text style={s.discountText}>-{discount.toFixed(0)}%</Text>
          </View>
        )}
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
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#F7F4FD' },
  headerBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700', color: '#1C1E22' },
  tabRow: { flexDirection: 'row', marginHorizontal: 16, backgroundColor: '#EDE8F8', borderRadius: 30, padding: 4, marginBottom: 16 },
  tabBtn: { flex: 1, paddingVertical: 9, borderRadius: 26, alignItems: 'center' },
  tabBtnActive: { backgroundColor: '#FFFFFF', shadowColor: '#7A0EED', shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  tabText: { fontSize: 14, fontWeight: '500', color: '#7A7A8A' },
  tabTextActive: { color: '#1C1E22', fontWeight: '700' },
  scroll: { paddingHorizontal: 16, paddingBottom: 40 },
  balanceCard: { backgroundColor: '#FFFFFF', borderRadius: 20, paddingVertical: 24, alignItems: 'center', marginBottom: 16, gap: 4, shadowColor: '#7A0EED', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3, overflow: 'hidden' },
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
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 20,
    shadowColor: '#B50357', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  spinIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F3EFFE', alignItems: 'center', justifyContent: 'center' },
  spinIcon: { width: 85, height: 85 },
  spinTextWrap: { flex: 1, gap: 2 },
  spinTitle: { fontSize: 14, fontWeight: '800', color: '#1C1E22' },
  spinSub: { fontSize: 11, color: '#8A8A96', fontWeight: '400' },
  spinBtn: { borderRadius: 20, overflow: 'hidden' },
  spinBtnGradient: { paddingHorizontal: 16, paddingVertical: 9 },
  spinBtnText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },

  sectionHeading: { fontSize: 16, fontWeight: '800', color: '#1C1E22', marginBottom: 12, marginTop: 4 },
  packageList: { gap: 10 },
  pkgRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  pkgIconWrap: { width: 56, height: 56, borderRadius: 12, backgroundColor: '#FFF7E8', alignItems: 'center', justifyContent: 'center' },
  pkgIcon: { width: 84, height: 84 },
  pkgLeft: { flex: 1, gap: 6 },
  pkgCoinRow: { flexDirection: 'row', alignItems: 'baseline' },
  pkgCoins: { fontSize: 18, fontWeight: '800', color: '#1C1E22' },
  pkgCoinsLabel: { fontSize: 11, fontWeight: '600', color: '#7A7A8A', letterSpacing: 0.5 },
  discountBadge: { backgroundColor: '#E91E7F', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, alignSelf: 'flex-start' },
  discountText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  priceBtn: { flexDirection: 'row', alignItems: 'baseline', backgroundColor: '#7A0EED', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 30 },
  priceText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  origPrice: { fontSize: 11, color: 'rgba(255,255,255,0.7)', textDecorationLine: 'line-through' },
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
  currDot:    { width: 8, height: 8, borderRadius: 4, backgroundColor: '#1D6FE0', marginRight: 8 },

  // future rows
  gemsText:    { fontSize: 14, fontWeight: '600', color: '#1C1E22' },
  perGemText:  { fontSize: 11, color: '#ABADB2', fontWeight: '400', marginTop: 1 },
  payoutText:  { fontSize: 14, fontWeight: '600', color: '#6B7280' },

  // completed rows
  gemsTextDone:  { fontSize: 14, fontWeight: '700', color: '#16A34A' },
  perGemDone:    { fontSize: 11, color: '#86EFAC', fontWeight: '400', marginTop: 1 },
  payoutTextDone:{ fontSize: 14, fontWeight: '700', color: '#16A34A' },

  // current (next target) row
  gemsTextCurrent:  { fontSize: 15, fontWeight: '800', color: '#1D6FE0' },
  perGemCurrent:    { fontSize: 11, color: '#7FADE8', fontWeight: '500', marginTop: 1 },

  // payout badge — shared shape, different fills per state
  payoutBadge:            { borderRadius: 20, paddingHorizontal: 13, paddingVertical: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1D6FE0' },
  payoutBadgeText:        { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
  // done: green tint
  payoutBadgeDone:        { backgroundColor: '#16A34A' },
  payoutBadgeTextDone:    { color: '#FFFFFF' },
  // future: same solid blue pill as reference
  payoutBadgeFuture:      { backgroundColor: '#1D6FE0' },
  payoutBadgeTextFuture:  { color: '#FFFFFF', fontWeight: '800' },

  rightCol: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  // % badge on each row
  pctBadge:        { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1 },
  pctBadge50:      { backgroundColor: '#E4EFFD', borderColor: '#B8D3F5' },
  pctBadge55:      { backgroundColor: '#FDE8F3', borderColor: '#F0A8D0' },
  pctBadgeDone:    { backgroundColor: '#E8F5E9', borderColor: '#86EFAC' },
  pctBadgeText:    { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  pctBadgeText50:  { color: '#1D6FE0' },
  pctBadgeText55:  { color: '#B50357' },
  pctBadgeTextDone:{ color: '#16A34A' },

  // Unlock banner between 50% and 55% groups
  unlockBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    marginVertical: 4,
  },
  unlockText:      { flex: 1, fontSize: 12, fontWeight: '600', color: '#1C1E22' },
  unlockHighlight: { color: '#B50357', fontWeight: '800' },
});

// Gem sub-tab switcher styles
const gt = StyleSheet.create({
  wrapper: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#EEEAF6', marginBottom: 16 },
  btn: { flex: 1, paddingVertical: 12, alignItems: 'center', position: 'relative' },
  label: { fontSize: 13, fontWeight: '500', color: '#ABADB2' },
  labelActive: { color: '#1D6FE0', fontWeight: '700' },
  underline: { position: 'absolute', bottom: -1, left: 8, right: 8, height: 2.5, borderRadius: 2, backgroundColor: '#1D6FE0' },
});

// Gem content styles
const gem = StyleSheet.create({
  // Gems balance card (blue theme)
  balanceCard: {
    borderRadius: 20, padding: 20, marginBottom: 16, overflow: 'hidden',
    shadowColor: '#1D6FE0', shadowOpacity: 0.1, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  balanceCardTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  balanceCardLabel: { fontSize: 13, fontWeight: '600', color: '#1D6FE0' },
  balanceCardNumber: { fontSize: 32, fontWeight: '800', color: '#0D3B7A', marginTop: 6 },
  balanceCardInr: { fontSize: 13, color: '#5A82AE', fontWeight: '500', marginTop: 2 },
  balanceCardImage: { position: 'absolute', right: -10, bottom: -30, width: 180, height: 180 },

  // Tappable withdraw pill on a completed tier row
  withdrawBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 20, paddingHorizontal: 13, paddingVertical: 6,
    backgroundColor: '#16A34A',
  },
  withdrawText: { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },

  // Next target progress card
  targetCard: {
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 16,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  targetTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  targetLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  targetText: { fontSize: 12, color: '#60626A', fontWeight: '500' },
  targetVal: { color: '#1D6FE0', fontWeight: '700' },
  targetPct: { fontSize: 11, color: '#8A8A96', fontWeight: '600' },
  targetTrack: { height: 6, borderRadius: 3, backgroundColor: '#EAF0F8', overflow: 'hidden' },
  targetFill: { height: '100%', borderRadius: 3, backgroundColor: '#1D6FE0' },

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

  // Withdraw value info card (bottom of tier list)
  withdrawInfoCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, marginTop: 4,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  withdrawInfoIconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#E4EFFD', alignItems: 'center', justifyContent: 'center' },
  withdrawInfoTitle: { fontSize: 13, fontWeight: '700', color: '#1C1E22' },
  withdrawInfoSub: { fontSize: 11, color: '#ABADB2', fontWeight: '400', marginTop: 2 },
});
