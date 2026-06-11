import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  Modal,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BASE_URL } from '@/services/api';
import { authStore } from '@/store/auth-store';

const { height: SCREEN_H } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_H * 0.52;
const WINDOW_SIZE = 20; // visible tiers at a time

// ── Gem tier algorithm ────────────────────────────────────────────────────────
// Each tier: { gems, payout (₹), badge?, hostPct }
type Tier = {
  gems: number;
  payout: number;
  badge?: 'MOST POPULAR' | 'BEST VALUE';
  hostPct: number;
};

const ALL_TIERS: Tier[] = [
  // Host 50%
  { gems: 12_500,     payout: 168,       hostPct: 50 },
  { gems: 20_000,     payout: 270,       hostPct: 50 },
  { gems: 40_000,     payout: 540,       hostPct: 50 },
  { gems: 80_000,     payout: 1_080,     hostPct: 50 },
  { gems: 105_000,    payout: 1_418,     hostPct: 50 },
  { gems: 185_000,    payout: 2_497,     hostPct: 50 },
  { gems: 255_000,    payout: 3_442,     hostPct: 50 },
  { gems: 355_000,    payout: 4_792,     hostPct: 50 },
  { gems: 510_000,    payout: 7_650,     hostPct: 50 },
  { gems: 735_000,    payout: 11_025,    hostPct: 50 },
  { gems: 1_025_000,  payout: 15_375,    hostPct: 50 },
  { gems: 1_380_000,  payout: 20_700,    hostPct: 50 },
  { gems: 1_860_000,  payout: 27_900,    hostPct: 50 },
  { gems: 2_415_000,  payout: 36_225,    hostPct: 50 },
  { gems: 2_895_000,  payout: 43_425,    hostPct: 50 },
  { gems: 3_325_000,  payout: 49_875,    hostPct: 50 },
  { gems: 3_820_000,  payout: 57_300,    hostPct: 50 },
  { gems: 4_200_000,  payout: 63_000,    hostPct: 50 },
  { gems: 4_620_000,  payout: 69_300,    hostPct: 50 },
  // Host 55%
  { gems: 5_016_000,  payout: 83_820,    hostPct: 55 },
  { gems: 5_585_000,  payout: 92_152,    hostPct: 55 },
  { gems: 6_140_000,  payout: 101_310,   hostPct: 55 },
  { gems: 6_750_000,  payout: 111_375,   hostPct: 55 },
  { gems: 7_425_000,  payout: 122_512,   hostPct: 55 },
  { gems: 8_165_000,  payout: 134_722,   hostPct: 55 },
  { gems: 8_980_000,  payout: 148_170,   hostPct: 55 },
  { gems: 9_875_000,  payout: 162_937,   hostPct: 55 },
  { gems: 10_860_000, payout: 179_190,   hostPct: 55 },
  { gems: 11_945_000, payout: 197_092,   hostPct: 55 },
  { gems: 13_135_000, payout: 216_727,   hostPct: 55 },
  { gems: 14_445_000, payout: 238_342,   hostPct: 55 },
  { gems: 15_165_000, payout: 250_222,   hostPct: 55 },
  { gems: 15_920_000, payout: 262_680,   hostPct: 55 },
  { gems: 16_715_000, payout: 275_797,   hostPct: 55 },
  { gems: 17_380_000, payout: 286_770,   hostPct: 55 },
  { gems: 18_075_000, payout: 298_237,   hostPct: 55 },
  { gems: 18_795_000, payout: 310_117,   hostPct: 55 },
  { gems: 19_545_000, payout: 322_492,   hostPct: 55 },
  { gems: 20_130_000, payout: 332_145,   hostPct: 55 },
  { gems: 20_730_000, payout: 342_045,   hostPct: 55 },
  { gems: 21_555_000, payout: 355_657,   hostPct: 55 },
  { gems: 22_415_000, payout: 369_847,   hostPct: 55 },
  { gems: 23_310_000, payout: 384_615,   hostPct: 55 },
  { gems: 24_475_000, payout: 403_837,   hostPct: 55 },
  { gems: 25_695_000, payout: 423_967,   hostPct: 55 },
  { gems: 26_945_000, payout: 444_593,   hostPct: 55 },
  { gems: 28_945_000, payout: 477_593,   hostPct: 55 },
  { gems: 30_945_000, payout: 510_592,   hostPct: 55 },
  { gems: 32_945_000, payout: 543_592,   hostPct: 55 },
  { gems: 34_945_000, payout: 576_592,   hostPct: 55 },
  { gems: 37_445_000, payout: 617_842,   hostPct: 55 },
  { gems: 39_945_000, payout: 659_092,   hostPct: 55 },
  { gems: 42_445_000, payout: 700_342,   hostPct: 55 },
  { gems: 45_445_000, payout: 749_842,   hostPct: 55 },
  { gems: 48_445_000, payout: 799_342,   hostPct: 55 },
  { gems: 51_445_000, payout: 848_842,   hostPct: 55 },
  { gems: 54_945_000, payout: 906_592,   hostPct: 55 },
  { gems: 58_445_000, payout: 964_342,   hostPct: 55 },
  { gems: 61_945_000, payout: 1_022_092, hostPct: 55 },
  { gems: 65_945_000, payout: 1_088_092, hostPct: 55 },
];

function formatN(n: number) {
  if (n >= 10_000_000) return `${(n / 10_000_000).toFixed(1)}Cr`;
  if (n >= 100_000)    return `${(n / 100_000).toFixed(2)}L`;
  if (n >= 1_000)      return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

function formatPayout(n: number) {
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(2)}L`;
  if (n >= 1_000)   return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${n.toLocaleString()}`;
}

// ── Tier Row ──────────────────────────────────────────────────────────────────

function TierRow({ tier, isCurrent, isCompleted }: { tier: Tier; isCurrent: boolean; isCompleted: boolean }) {
  const perGem = (tier.payout / tier.gems);
  const perGemStr = perGem < 0.01 ? perGem.toFixed(4) : perGem.toFixed(3);

  return (
    <View style={[tr.row, isCurrent && tr.rowCurrent, isCompleted && tr.rowDone]}>
      {/* Left: diamond icon + gems */}
      <View style={[tr.iconWrap, { backgroundColor: isCompleted ? '#E8F5E9' : isCurrent ? '#EDE8F7' : '#F5F3FA' }]}>
        <Ionicons name="diamond" size={22} color={isCompleted ? '#43A047' : isCurrent ? '#7A0EED' : '#B0A8CC'} />
      </View>

      <View style={tr.mid}>
        <Text style={[tr.gems, isCurrent && tr.gemsCurrent, isCompleted && tr.gemsDone]}>
          {formatN(tier.gems)}
        </Text>
        <Text style={tr.label}>Gems · Host {tier.hostPct}%</Text>
        <Text style={tr.perGem}>₹{perGemStr} / Gem</Text>
      </View>

      <View style={tr.right}>
        {isCompleted ? (
          <View style={tr.doneChip}>
            <Ionicons name="checkmark" size={11} color="#fff" />
            <Text style={tr.doneText}>Done</Text>
          </View>
        ) : isCurrent ? (
          <LinearGradient colors={['#7A0EED', '#B50357']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={tr.payoutBtn}>
            <Text style={tr.payoutBtnText}>{formatPayout(tier.payout)}</Text>
          </LinearGradient>
        ) : (
          <View style={tr.payoutChip}>
            <Text style={tr.payoutChipText}>{formatPayout(tier.payout)}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────

type Props = { visible: boolean; onClose: () => void };

export function CoinBoxModal({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const [gemBalance, setGemBalance] = useState(0);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!visible) return;
    const token = authStore.getToken();
    if (!token) return;
    fetch(`${BASE_URL}/tasks/gems`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(j => { if (j.success) setGemBalance(j.data.gems ?? 0); })
      .catch(() => {});
  }, [visible]);

  // Which tier index has the user currently reached (highest completed)
  const currentTierIdx = useMemo(() => {
    let idx = -1;
    for (let i = 0; i < ALL_TIERS.length; i++) {
      if (gemBalance >= ALL_TIERS[i].gems) idx = i;
      else break;
    }
    return idx;
  }, [gemBalance]);

  // Show 20 tiers starting from the last completed one (or 0 if none)
  const windowStart = Math.max(0, currentTierIdx);
  const visibleTiers = ALL_TIERS.slice(windowStart, windowStart + WINDOW_SIZE);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 5,
      onPanResponderMove: (_, g) => { if (g.dy > 0) translateY.setValue(g.dy); },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 100) close();
        else Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
      },
    })
  ).current;

  function open() {
    translateY.setValue(SHEET_HEIGHT);
    Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }).start();
  }

  function close() {
    Animated.timing(translateY, { toValue: SHEET_HEIGHT, duration: 220, useNativeDriver: true }).start(onClose);
  }

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={close} onShow={open}>
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={close} />

      <Animated.View style={[s.sheet, { height: SHEET_HEIGHT, paddingBottom: insets.bottom + 8, transform: [{ translateY }] }]}>
        {/* Drag handle */}
        <View {...panResponder.panHandlers} style={s.handleArea}>
          <View style={s.handle} />
        </View>

        {/* Header */}
        <View style={s.header}>
          <Ionicons name="diamond" size={20} color="#7A0EED" />
          <Text style={s.title}>Getting Gems</Text>
          <View style={s.gemBadge}>
            <Ionicons name="diamond" size={13} color="#7A0EED" />
            <Text style={s.gemBadgeText}>{formatN(gemBalance)}</Text>
          </View>
        </View>

        {/* Column labels */}
        <View style={s.colRow}>
          <Text style={s.colGems}>Gems Threshold</Text>
          <Text style={s.colPayout}>Host Payment</Text>
        </View>

        <FlatList
          ref={listRef}
          data={visibleTiers}
          keyExtractor={(_, i) => String(windowStart + i)}
          renderItem={({ item, index }) => {
            const absIdx = windowStart + index;
            return (
              <TierRow
                tier={item}
                isCurrent={absIdx === currentTierIdx + 1} // next tier to reach
                isCompleted={absIdx <= currentTierIdx}
              />
            );
          }}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={s.sep} />}
        />

        {/* Footer note */}
        <View style={s.footer}>
          <Ionicons name="information-circle-outline" size={14} color="#ABADB2" />
          <Text style={s.footerText}>Gems are earned when you receive gifts in chat rooms</Text>
        </View>
      </Animated.View>
    </Modal>
  );
}

// ── Tier row styles ───────────────────────────────────────────────────────────

const tr = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
    backgroundColor: '#FAFAFA',
    borderRadius: 14,
    marginHorizontal: 12,
  },
  rowCurrent: {
    backgroundColor: '#F2EAFF',
    borderWidth: 1.5,
    borderColor: '#7A0EED',
  },
  rowDone: {
    backgroundColor: '#F1FBF2',
  },
  iconWrap: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  mid: { flex: 1, gap: 1 },
  gems: { fontSize: 15, fontWeight: '800', color: '#1C1E22' },
  gemsCurrent: { color: '#7A0EED' },
  gemsDone: { color: '#43A047' },
  label: { fontSize: 10, color: '#ABADB2', fontWeight: '500' },
  perGem: { fontSize: 10, color: '#B0A8CC', fontWeight: '500' },
  right: { alignItems: 'flex-end' },
  payoutBtn: {
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
  },
  payoutBtnText: { fontSize: 13, fontWeight: '800', color: '#fff' },
  payoutChip: {
    backgroundColor: '#F0EDF8',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
  },
  payoutChipText: { fontSize: 13, fontWeight: '700', color: '#60626A' },
  doneChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#43A047',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
  },
  doneText: { fontSize: 11, fontWeight: '700', color: '#fff' },
});

// ── Sheet styles ──────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
  },
  handleArea: { alignItems: 'center', paddingTop: 10, paddingBottom: 4 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#DDDAE8' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingBottom: 10,
  },
  title: { flex: 1, fontSize: 16, fontWeight: '800', color: '#1C1E22' },
  gemBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F2EAFF', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  gemBadgeText: { fontSize: 13, fontWeight: '800', color: '#7A0EED' },
  colRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 28, paddingBottom: 6,
  },
  colGems: { fontSize: 10, fontWeight: '700', color: '#ABADB2', textTransform: 'uppercase', letterSpacing: 0.5 },
  colPayout: { fontSize: 10, fontWeight: '700', color: '#ABADB2', textTransform: 'uppercase', letterSpacing: 0.5 },
  list: { paddingBottom: 8, gap: 6 },
  sep: { height: 0 },
  footer: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#F0EDF8',
  },
  footerText: { fontSize: 11, color: '#ABADB2', flex: 1, lineHeight: 16 },
});
