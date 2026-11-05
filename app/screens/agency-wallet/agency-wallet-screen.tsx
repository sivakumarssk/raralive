import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  apiAgencyWallet, apiAgencyWalletCreateRequest, apiAgencyWalletLookup, apiAgencyWalletRecharge,
  resolveImageUrl,
  type AgencyCoinRequest, type AgencyRechargeUser, type AgencyWalletOverview,
} from '@/services/api';
import { authStore } from '@/store/auth-store';
import { subscribeChatEvents } from '@/store/chat-socket-store';
import { avatarSource } from '@/utils/default-avatar';

// ── Formatting ────────────────────────────────────────────────────────────────

/** Indian digit grouping (1,25,680) without relying on Intl. */
export function fmt(n: number) {
  const s = String(Math.round(Math.abs(n)));
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  const grouped = rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}` : last3;
  return n < 0 ? `-${grouped}` : grouped;
}

export function dateText(d: string) {
  const x = new Date(d);
  return `${x.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} • ${x.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
}

export function longDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
}

export function longTime(d: string) {
  return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function isToday(d: string) {
  return new Date(d).toDateString() === new Date().toDateString();
}

export function isThisMonth(d: string) {
  const x = new Date(d); const n = new Date();
  return x.getMonth() === n.getMonth() && x.getFullYear() === n.getFullYear();
}

function newIdempotencyKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

type WalletTab = 'user' | 'app';

export const REQUEST_STATUS: Record<AgencyCoinRequest['status'], { label: string; color: string; bg: string }> = {
  pending:  { label: 'Request sent', color: '#B7791F', bg: '#FEF5E1' },
  approved: { label: 'Credited',     color: '#16A34A', bg: '#E9F9EF' },
  rejected: { label: 'Rejected',     color: '#DC2626', bg: '#FDEBEF' },
};

// ── Small building blocks ─────────────────────────────────────────────────────

function Panel({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <View style={s.panel}>
      <Text style={s.panelTitle}>{title}</Text>
      {!!sub && <Text style={s.panelSub}>{sub}</Text>}
      {children}
    </View>
  );
}

export function Tag({ text, color = '#16A34A', bg = '#E9F9EF' }: { text: string; color?: string; bg?: string }) {
  return (
    <View style={[s.tag, { backgroundColor: bg }]}>
      <Text style={[s.tagText, { color }]}>{text}</Text>
    </View>
  );
}

export function Empty({ text }: { text: string }) {
  return <Text style={s.empty}>{text}</Text>;
}

export function DetailLine({ label, value, valueStyle }: { label: string; value: string; valueStyle?: object }) {
  return (
    <View style={s.detailLine}>
      <Text style={s.detailLabel}>{label}</Text>
      <Text style={[s.detailValue, valueStyle]} selectable>{value}</Text>
    </View>
  );
}

export function BottomSheet({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: React.ReactNode }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={s.sheetBackdrop} />
      </TouchableWithoutFeedback>
      <View style={s.sheet}>
        <View style={s.sheetHandle} />
        <ScrollView showsVerticalScrollIndicator={false}>{children}</ScrollView>
      </View>
    </Modal>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export function AgencyWalletScreen() {
  const router = useRouter();
  const [overview, setOverview] = useState<AgencyWalletOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<WalletTab>('user');

  // Recharge User form
  const [profileInput, setProfileInput] = useState('');
  const [lookupState, setLookupState] = useState<'idle' | 'loading' | 'found' | 'not-found'>('idle');
  const [verifiedUser, setVerifiedUser] = useState<AgencyRechargeUser | null>(null);
  const [selectedSlab, setSelectedSlab] = useState(0);
  const [extraText, setExtraText] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const idempotencyKey = useRef<string>(newIdempotencyKey());

  // RaRa Live Wallet (request coins from RaRa Live Official)
  const [buySelected, setBuySelected] = useState(0);
  const [requesting, setRequesting] = useState(false);

  // Toast
  const [toastText, setToastText] = useState('');
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const showToast = useCallback((text: string) => {
    setToastText(text);
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.delay(2200),
      Animated.timing(toastOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [toastOpacity]);

  const load = useCallback(async () => {
    const token = authStore.getToken();
    if (!token) { setLoading(false); return; }
    const o = await apiAgencyWallet(token);
    if (o.ok) { setOverview(o.data); setLoadError(null); } else setLoadError(o.message);
    setLoading(false);
    setRefreshing(false);
  }, []);

  // Fresh from the server every time the screen is shown (incl. first open)
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Live balance: the server pushes the new value whenever this agency's coins
  // change — a recharge, an approved coin request or an admin credit.
  useEffect(() => subscribeChatEvents(event => {
    if (event.type !== 'agency_wallet_balance') return;
    setOverview(prev => (prev && prev.agency.id === event.agencyId ? { ...prev, balance: event.balance } : prev));
  }), []);

  // Verify the user as the agency types (debounced)
  useEffect(() => {
    const q = profileInput.trim();
    setVerifiedUser(null);
    if (q.length < 3) { setLookupState('idle'); return; }
    setLookupState('loading');
    const timer = setTimeout(async () => {
      const token = authStore.getToken();
      if (!token) return;
      const res = await apiAgencyWalletLookup(q, token);
      if (res.ok) { setVerifiedUser(res.data); setLookupState('found'); }
      else setLookupState('not-found');
    }, 500);
    return () => clearTimeout(timer);
  }, [profileInput]);

  const balance = overview?.balance ?? 0;
  const extraCoins = Math.max(0, parseInt(extraText, 10) || 0);
  const total = selectedSlab + extraCoins;
  const exceedsBalance = total > balance;
  const canRecharge = !!verifiedUser && selectedSlab > 0 && !exceedsBalance;
  const lowBalance = !!overview && balance < overview.low_balance_threshold;
  const verifiedHandle = verifiedUser?.username ? `@${verifiedUser.username}` : (verifiedUser?.full_name ?? '');

  const resetForm = () => {
    setProfileInput('');
    setVerifiedUser(null);
    setLookupState('idle');
    setSelectedSlab(0);
    setExtraText('');
    idempotencyKey.current = newIdempotencyKey();
  };

  const confirmRecharge = async () => {
    if (!verifiedUser || !canRecharge || submitting) return;
    const token = authStore.getToken();
    if (!token) return;
    setSubmitting(true);
    // Same key on a retry/double-tap → the server returns the original
    // transaction instead of charging the wallet twice.
    const res = await apiAgencyWalletRecharge({
      userId: verifiedUser.id, slabCoins: selectedSlab, extraCoins, idempotencyKey: idempotencyKey.current,
    }, token);
    setSubmitting(false);
    if (!res.ok) { setConfirmError(res.message); return; }
    setShowConfirm(false);
    resetForm();
    // The server returns the balance after the deduction — show it right away
    setOverview(prev => (prev ? { ...prev, balance: res.data.balance } : prev));
    showToast(`${fmt(res.data.transaction.coins)} Coins recharged successfully`);
    load();
  };

  const sendRequest = async () => {
    if (!buySelected || requesting) return;
    const token = authStore.getToken();
    if (!token) return;
    setRequesting(true);
    const res = await apiAgencyWalletCreateRequest(buySelected, token);
    setRequesting(false);
    if (!res.ok) { showToast(res.message); return; }
    setBuySelected(0);
    showToast(`${fmt(res.data.coins)} Coins request sent — track it in History`);
  };

  if (loading) {
    return (
      <SafeAreaView style={s.root} edges={['top']}>
        <ActivityIndicator color="#7A0EED" style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.headerBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color="#1C1E22" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Agency Wallet</Text>
        <TouchableOpacity onPress={() => router.push('/agency-wallet-history' as any)} style={s.headerBtn} hitSlop={8}>
          <Ionicons name="time-outline" size={22} color="#1C1E22" />
        </TouchableOpacity>
      </View>

      {loadError && !overview ? (
        <View style={s.errorWrap}>
          <Ionicons name="alert-circle-outline" size={40} color="#D8D3EC" />
          <Text style={s.errorText}>{loadError}</Text>
          <TouchableOpacity onPress={() => { setLoading(true); load(); }} style={s.retryBtn}>
            <Text style={s.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.scroll}
            keyboardShouldPersistTaps="handled"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#7A0EED" colors={['#7A0EED']} />}>

            {/* Wallet card */}
            <LinearGradient colors={['#7A0EED', '#B50357']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.walletCard}>
              <View style={s.glowOuter} pointerEvents="none" />
              <Text style={s.eyebrow}>Agency Recharge Coin Balance</Text>
              <Text style={s.balance}>
                {fmt(balance)} <Text style={s.balanceUnit}>Coins</Text>
              </Text>
            </LinearGradient>

            {lowBalance && (
              <View style={s.alert}>
                <Ionicons name="warning" size={15} color="#E14C57" />
                <Text style={s.alertText}>Low balance. Your Agency Wallet is running low. Please request more Coins.</Text>
              </View>
            )}

            {/* Tabs */}
            <View style={s.tabRow}>
              {([['user', 'Recharge User'], ['app', 'RaRa Live Wallet']] as [WalletTab, string][]).map(([key, label]) => (
                <TouchableOpacity key={key} style={[s.tabBtn, tab === key && s.tabBtnActive]} onPress={() => setTab(key)} activeOpacity={0.8}>
                  <Text style={[s.tabText, tab === key && s.tabTextActive]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {tab === 'user' ? (
              <Panel
                title="Users Coin Recharge"
                sub="Verify the user first. After confirmation, Coins are automatically deducted from the Agency Wallet and credited to the User Wallet.">
                <Text style={s.label}>Username / User ID / Profile Link</Text>
                <View style={s.inputWrap}>
                  <TextInput
                    value={profileInput}
                    onChangeText={setProfileInput}
                    placeholder="@username or user ID"
                    placeholderTextColor="#B5AFC7"
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={s.input}
                  />
                  {lookupState === 'loading' && <ActivityIndicator size="small" color="#7A0EED" />}
                </View>

                {lookupState === 'not-found' && (
                  <Text style={s.lookupError}>No user found. Check the username or ID.</Text>
                )}
                {verifiedUser && (
                  <View style={s.userCard}>
                    <Image source={avatarSource(resolveImageUrl(verifiedUser.avatar_url))} style={s.userAvatar} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.userHandle} numberOfLines={1}>{verifiedHandle}</Text>
                      {!!verifiedUser.full_name && <Text style={s.userName} numberOfLines={1}>{verifiedUser.full_name}</Text>}
                      <Text style={s.verified}>✓ Verified User</Text>
                      <Text style={s.uid} numberOfLines={1}>UID: {verifiedUser.id}</Text>
                    </View>
                  </View>
                )}

                <Text style={s.label}>Handle Name</Text>
                <View style={[s.inputWrap, s.inputReadonly]}>
                  <Text style={[s.input, !verifiedHandle && s.placeholder]} numberOfLines={1}>
                    {verifiedHandle || 'Auto-filled after verification'}
                  </Text>
                </View>

                <Text style={s.label}>Choose Coin Slab</Text>
                <View style={s.slabGrid}>
                  {(overview?.recharge_slabs ?? []).map(n => (
                    <TouchableOpacity key={n} style={[s.slab, selectedSlab === n && s.slabSelected]} onPress={() => setSelectedSlab(n)} activeOpacity={0.8}>
                      <Text style={s.slabCoins}>{fmt(n)}</Text>
                      <Text style={s.slabUnit}>Coins</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={s.selectionRow}>
                  <View style={[s.box, { flex: 1 }]}>
                    <Text style={s.boxLabel}>Selected Slab</Text>
                    <Text style={s.boxValue}>{fmt(selectedSlab)}</Text>
                    <Text style={s.boxLabel}>Coins added automatically</Text>
                  </View>
                  <View style={[s.box, { width: 124 }]}>
                    <Text style={s.boxLabel}>Extra Coins</Text>
                    <TextInput
                      value={extraText}
                      onChangeText={v => setExtraText(v.replace(/[^0-9]/g, ''))}
                      keyboardType="number-pad"
                      placeholder="0"
                      placeholderTextColor="#B5AFC7"
                      style={s.extraInput}
                      maxLength={9}
                    />
                  </View>
                </View>

                <View style={s.totalRow}>
                  <Text style={s.totalLabel}>Total Recharge</Text>
                  <Text style={s.totalValue}>{fmt(total)} Coins</Text>
                </View>
                {exceedsBalance && total > 0 && (
                  <Text style={s.lookupError}>Total is more than your Agency Wallet balance.</Text>
                )}

                <TouchableOpacity disabled={!canRecharge} onPress={() => { setConfirmError(null); setShowConfirm(true); }} activeOpacity={0.85} style={!canRecharge && s.disabled}>
                  <LinearGradient colors={['#7A0EED', '#B50357']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={s.primaryBtn}>
                    <Text style={s.primaryText}>Done — Recharge</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <Text style={s.note}>Duplicate protection: one confirmed transaction creates one transaction ID and one wallet deduction.</Text>
              </Panel>
            ) : (
              <Panel
                title="Get Coins from RaRa Live Official"
                sub="Select the required quantity and send a request. RaRa Live Official will contact your Agency and credit the Coins to your Agency Wallet.">
                <View style={s.requestCard}>
                  <Text style={s.requestCardTitle}>Request process</Text>
                  <Text style={s.requestCardText}>
                    1. Select slab → 2. Send request → 3. Official receives notification → 4. Official contacts Agency → 5. Coins are credited to Agency Wallet.
                  </Text>
                </View>
                <View style={[s.slabGrid, { marginTop: 12 }]}>
                  {(overview?.request_slabs ?? []).map(n => (
                    <TouchableOpacity key={n} style={[s.slab, buySelected === n && s.slabSelected]} onPress={() => setBuySelected(n)} activeOpacity={0.8}>
                      <Text style={s.slabCoins}>{fmt(n)}</Text>
                      <Text style={s.slabUnit}>Coins</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity disabled={!buySelected || requesting} onPress={sendRequest} activeOpacity={0.85} style={[{ marginTop: 12 }, (!buySelected || requesting) && s.disabled]}>
                  <LinearGradient colors={['#7A0EED', '#B50357']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={s.primaryBtn}>
                    {requesting ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={s.primaryText}>Send Coin Request</Text>}
                  </LinearGradient>
                </TouchableOpacity>

              </Panel>
            )}

          </ScrollView>
        </KeyboardAvoidingView>
      )}

      {/* Confirm Recharge */}
      <BottomSheet visible={showConfirm} onClose={() => !submitting && setShowConfirm(false)}>
        <Text style={s.sheetTitle}>Confirm Recharge</Text>
        <Text style={s.sheetSub}>Please check all details before the automatic wallet transfer.</Text>
        <View style={s.detailBox}>
          <DetailLine label="User" value={verifiedHandle} />
          {!!verifiedUser?.full_name && <DetailLine label="Name" value={verifiedUser.full_name} />}
          <DetailLine label="UID" value={verifiedUser?.id ?? ''} />
          <DetailLine label="Selected Slab" value={`${fmt(selectedSlab)} Coins`} />
          <DetailLine label="Extra Coins" value={`${fmt(extraCoins)} Coins`} />
          <DetailLine label="Total" value={`${fmt(total)} Coins`} valueStyle={s.plus} />
          <DetailLine label="Wallet After" value={`${fmt(balance - total)} Coins`} />
        </View>
        {!!confirmError && <Text style={[s.lookupError, { textAlign: 'center', marginTop: 10 }]}>{confirmError}</Text>}
        <TouchableOpacity onPress={confirmRecharge} disabled={submitting} activeOpacity={0.85} style={{ marginTop: 14 }}>
          <LinearGradient colors={['#7A0EED', '#B50357']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={s.primaryBtn}>
            {submitting ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={s.primaryText}>Confirm & Recharge</Text>}
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowConfirm(false)} disabled={submitting} style={s.closeBtn}>
          <Text style={s.closeText}>Cancel</Text>
        </TouchableOpacity>
      </BottomSheet>

      {/* Toast */}
      <Animated.View pointerEvents="none" style={[s.toast, { opacity: toastOpacity }]}>
        <Text style={s.toastText}>{toastText}</Text>
      </Animated.View>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const GOLD = '#E8A317';

export const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F7F4FD' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10 },
  headerBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '700', color: '#1C1E22' },
  scroll: { paddingHorizontal: 16, paddingBottom: 48 },

  errorWrap: { alignItems: 'center', gap: 10, paddingTop: 80, paddingHorizontal: 32 },
  errorText: { fontSize: 14, color: '#60626A', textAlign: 'center' },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, backgroundColor: '#F4EEFF' },
  retryText: { fontSize: 14, fontWeight: '700', color: '#7A0EED' },

  // Wallet card
  walletCard: {
    borderRadius: 20, padding: 18, overflow: 'hidden',
    shadowColor: '#7A0EED', shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
  glowOuter: { position: 'absolute', right: -60, top: -50, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.08)' },
  eyebrow: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.85)', letterSpacing: 0.8 },
  balance: { fontSize: 32, fontWeight: '900', color: '#FFFFFF', marginTop: 4 },
  balanceUnit: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },
  stats: { flexDirection: 'row', gap: 8, marginTop: 14 },
  stat: { flex: 1, padding: 9, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  statValue: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
  statLabel: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.75)', marginTop: 2 },

  alert: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12,
    padding: 12, borderRadius: 12, backgroundColor: '#FFF1F2', borderWidth: 1, borderColor: '#F5C2C6',
  },
  alertText: { flex: 1, fontSize: 12, color: '#B4232F', fontWeight: '600', lineHeight: 17 },

  tabRow: { flexDirection: 'row', backgroundColor: '#EDE8F8', borderRadius: 24, padding: 4, marginVertical: 16 },
  tabBtn: { flex: 1, height: 38, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  tabBtnActive: { backgroundColor: '#7A0EED' },
  tabText: { fontSize: 14, fontWeight: '700', color: '#7A7A8A' },
  tabTextActive: { color: '#FFFFFF' },

  // Panels
  panel: {
    backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, marginBottom: 14,
    shadowColor: '#7A0EED', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  panelTitle: { fontSize: 16, fontWeight: '800', color: '#1C1E22' },
  panelSub: { fontSize: 12, color: '#8A8A96', lineHeight: 17, marginTop: 4, marginBottom: 6 },
  label: { fontSize: 12, fontWeight: '700', color: '#3A3C42', marginTop: 12, marginBottom: 6 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F7F4FD', borderRadius: 12, borderWidth: 1, borderColor: '#E6E0F5', paddingHorizontal: 12, minHeight: 46,
  },
  inputReadonly: { backgroundColor: '#F1EEF7' },
  input: { flex: 1, fontSize: 14, color: '#1C1E22', paddingVertical: 10 },
  placeholder: { color: '#B5AFC7' },
  lookupError: { fontSize: 12, color: '#E14C57', fontWeight: '600', marginTop: 6 },

  userCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10,
    padding: 12, borderRadius: 14, borderWidth: 1, borderColor: '#E6E0F5', backgroundColor: '#FBF9FF',
  },
  userAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  userAvatarText: { fontSize: 15, fontWeight: '900', color: '#FFFFFF' },
  userHandle: { fontSize: 14, fontWeight: '800', color: '#1C1E22' },
  userName: { fontSize: 12, color: '#60626A' },
  verified: { fontSize: 11, fontWeight: '700', color: '#16A34A', marginTop: 2 },
  uid: { fontSize: 10, color: '#9A94AE', marginTop: 2 },

  slabGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slab: {
    width: '48.5%', padding: 11, borderRadius: 12,
    borderWidth: 1, borderColor: '#E6E0F5', backgroundColor: '#FFFFFF',
  },
  slabSelected: { borderColor: '#7A0EED', backgroundColor: '#F4EEFF', borderWidth: 1.5 },
  slabCoins: { fontSize: 15, fontWeight: '800', color: GOLD },
  slabUnit: { fontSize: 11, color: '#8A8A96', marginTop: 1 },

  selectionRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  box: { padding: 11, borderRadius: 12, borderWidth: 1, borderColor: '#E6E0F5', backgroundColor: '#FBF9FF' },
  boxLabel: { fontSize: 11, color: '#8A8A96' },
  boxValue: { fontSize: 18, fontWeight: '800', color: GOLD, marginVertical: 2 },
  extraInput: {
    marginTop: 6, fontSize: 15, fontWeight: '700', color: '#1C1E22',
    backgroundColor: '#FFFFFF', borderRadius: 8, borderWidth: 1, borderColor: '#E6E0F5', paddingHorizontal: 10, paddingVertical: 7,
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14 },
  totalLabel: { fontSize: 14, fontWeight: '800', color: '#1C1E22' },
  totalValue: { fontSize: 15, fontWeight: '900', color: GOLD },

  primaryBtn: { height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  disabled: { opacity: 0.45 },
  note: { fontSize: 11, color: '#8A8A96', textAlign: 'center', marginTop: 10, lineHeight: 15 },

  requestCard: { padding: 12, borderRadius: 12, backgroundColor: '#F4EEFF', borderWidth: 1, borderColor: '#E0D2FF', marginTop: 6 },
  requestCardTitle: { fontSize: 13, fontWeight: '800', color: '#1C1E22', marginBottom: 4 },
  requestCardText: { fontSize: 12, color: '#5B4B86', lineHeight: 18 },

  // Lists
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#1C1E22', marginTop: 16, marginBottom: 4 },
  filters: { flexDirection: 'row', gap: 6, marginTop: 6, marginBottom: 4 },
  filterBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: '#E6E0F5', backgroundColor: '#FFFFFF' },
  filterBtnActive: { backgroundColor: '#F4EEFF', borderColor: '#7A0EED' },
  filterText: { fontSize: 12, fontWeight: '700', color: '#8A8A96' },
  filterTextActive: { color: '#7A0EED' },
  item: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#ECE7F6' },
  itemLast: { borderBottomWidth: 0 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  itemTitle: { flex: 1, fontSize: 14, fontWeight: '800', color: '#1C1E22' },
  plus: { fontSize: 14, fontWeight: '800', color: '#16A34A' },
  minus: { fontSize: 14, fontWeight: '800', color: '#DC2626' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  time: { fontSize: 11, color: '#8A8A96', marginTop: 3 },
  link: { fontSize: 11, color: '#9A94AE', marginTop: 3 },
  tag: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  tagText: { fontSize: 10, fontWeight: '800' },
  empty: { textAlign: 'center', paddingVertical: 16, color: '#9A94AE', fontSize: 12 },

  // Bottom sheets
  sheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '88%',
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 28,
  },
  sheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#E0DDED', marginBottom: 12 },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: '#1C1E22' },
  sheetSub: { fontSize: 12, color: '#8A8A96', marginTop: 2, marginBottom: 12 },
  detailBox: { borderRadius: 14, borderWidth: 1, borderColor: '#ECE7F6', backgroundColor: '#FBF9FF', paddingHorizontal: 14, paddingVertical: 6 },
  detailLine: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 7 },
  detailLabel: { fontSize: 12, color: '#8A8A96', fontWeight: '600' },
  detailValue: { flexShrink: 1, fontSize: 12.5, color: '#1C1E22', fontWeight: '700', textAlign: 'right' },
  closeBtn: { alignItems: 'center', paddingVertical: 12, marginTop: 2 },
  closeText: { fontSize: 14, fontWeight: '700', color: '#8A8A96' },

  toast: {
    position: 'absolute', left: 24, right: 24, bottom: 32,
    backgroundColor: '#1C1E22', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
  },
  toastText: { fontSize: 13, fontWeight: '600', color: '#FFFFFF', textAlign: 'center' },
});
