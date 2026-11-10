import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Modal,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BASE_URL, MEDIA_BASE } from '@/services/api';
import { authStore } from '@/store/auth-store';
import { DiamondCutButton } from '@/components/ui/diamond-cut-button';
import { DiamondCutTabs } from '@/components/ui/diamond-cut-tabs';
import { GradientButton } from '@/components/ui/gradient-button';
import { onBattleInviteAccepted, onBattleInviteDeclined } from '@/store/socket-store';
import { RC } from '../room-ui';

const { height: SCREEN_H } = Dimensions.get('window');
const SHEET_NORMAL  = SCREEN_H * 0.60;
const SHEET_GIFTING = SCREEN_H * 0.78;
const SHEET_WAITING = SCREEN_H * 0.80;
// Battle lengths on offer (minutes) — fixed by product, not admin-managed.
const DURATION_OPTIONS = [5, 10, 15, 20, 25, 30];

/** Gifting Battle target, managed in the admin panel (GET /battle-targets). */
type BattleTarget = {
  id: string;
  label: string | null;
  coin_amount: string | number;
  image_url: string | null;
  description: string | null;
};

/** 5000 → "5K", 1500000 → "1.5M". */
function shortCoins(n: number) {
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${+(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function targetLabel(t: BattleTarget) {
  return t.label || shortCoins(Number(t.coin_amount));
}

type Room = { id: string; room_name: string; room_image_url: string | null };
type Page = 'setup' | 'invite' | 'waiting';
type BattleMode = 'normal' | 'gifting';

type InviteDetail = {
  id: string;
  duration_minutes: number;
  status: 'pending' | 'accepted' | 'declined' | 'active' | 'finished';
  from_room_name: string;
  from_room_image_url: string | null;
  to_room_name: string;
  to_room_image_url: string | null;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  roomId: string;
  roomImageUrl?: string | null;
};

function resolveUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.startsWith('http') ? url : `${MEDIA_BASE}/${url.replace(/^\//, '')}`;
}

function RoomAvatar({ url, name, size = 46 }: { url: string | null; name: string; size?: number }) {
  const resolved = resolveUrl(url);
  const style = { width: size, height: size, borderRadius: size / 2 };
  if (resolved) return <Image source={{ uri: resolved }} style={style} />;
  return (
    <View style={[style, inv.roomAvatarFallback]}>
      <Text style={[inv.roomAvatarInitial, { fontSize: size * 0.38 }]}>{name[0]?.toUpperCase()}</Text>
    </View>
  );
}

export function BattleModal({ visible, onClose, roomId, roomImageUrl }: Props) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(SHEET_NORMAL)).current;

  const [page, setPage] = useState<Page>('setup');
  const [selectedTime, setSelectedTime] = useState(30);
  const [battleMode, setBattleMode] = useState<BattleMode>('normal');
  // Gifting Battle targets come from the admin panel, refreshed each time the sheet opens
  const [targets, setTargets] = useState<BattleTarget[]>([]);
  const [targetsLoading, setTargetsLoading] = useState(false);
  const [targetsError, setTargetsError] = useState(false);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const selectedTarget = targets.find(t => t.id === selectedTargetId) ?? null;
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [invitedId, setInvitedId] = useState<string | null>(null);
  const [inviteSending, setInviteSending] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingInvite, setPendingInvite] = useState<InviteDetail | null>(null);
  const pendingInviteIdRef = useRef<string | null>(null);
  // Auto-start after the opponent accepts: guards against starting twice, and
  // holds the error (with a Retry) if the start request fails.
  const startingRef = useRef(false);
  const [startError, setStartError] = useState<string | null>(null);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 8,
      onPanResponderMove: (_, g) => { if (g.dy > 0) translateY.setValue(g.dy); },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 100) close();
        else Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
      },
    })
  ).current;

  function getSheetHeight(p: Page = page, bm: BattleMode = battleMode) {
    if (p === 'waiting') return SHEET_WAITING;
    if (p === 'invite' || bm === 'gifting') return SHEET_GIFTING;
    return SHEET_NORMAL;
  }

  function open() {
    setPage('setup');
    setInvitedId(null);
    setInviteSuccess(null);
    setSearchQuery('');
    setPendingInvite(null);
    pendingInviteIdRef.current = null;
    startingRef.current = false;
    setStartError(null);
    loadTargets();
    translateY.setValue(SCREEN_H);
    Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 60, friction: 12 }).start();
  }

  function close() {
    Animated.timing(translateY, { toValue: SCREEN_H, duration: 220, useNativeDriver: true }).start(onClose);
  }

  async function loadTargets() {
    setTargetsLoading(true);
    setTargetsError(false);
    try {
      const r = await fetch(`${BASE_URL}/battle-targets`);
      const json = await r.json();
      if (json.success) {
        const list: BattleTarget[] = json.data ?? [];
        setTargets(list);
        // Keep the host's pick if it still exists, else preselect the first
        setSelectedTargetId(prev => (prev && list.some(t => t.id === prev) ? prev : list[0]?.id ?? null));
      } else {
        setTargetsError(true);
      }
    } catch {
      setTargetsError(true);
    }
    setTargetsLoading(false);
  }

  function goInvite() {
    setPage('invite');
    setRooms([]);
    loadRooms();
  }

  async function loadRooms() {
    setLoadingRooms(true);
    try {
      const token = authStore.getToken();
      const r = await fetch(`${BASE_URL}/rooms/public-for-battle?exclude_room_id=${roomId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await r.json();
      if (json.success) setRooms(json.data);
    } catch {}
    setLoadingRooms(false);
  }

  async function sendInvite(toRoomId: string) {
    if (!roomId) return;
    setInviteSending(toRoomId);
    try {
      const token = authStore.getToken();
      const r = await fetch(`${BASE_URL}/battle/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          from_room_id: roomId,
          to_room_id: toRoomId,
          duration_minutes: selectedTime,
          mode: battleMode,
          ...(battleMode === 'gifting' && selectedTarget ? { target_id: selectedTarget.id } : {}),
        }),
      });
      const json = await r.json();
      if (json.success && json.data) {
        const inviteId = json.data.id;
        pendingInviteIdRef.current = inviteId;
        // The invite response already carries room names/images
        setPendingInvite(json.data as InviteDetail);
        setPage('waiting');
        // subscribe to socket events
        const unsubA = onBattleInviteAccepted(({ invite_id, battle }) => {
          if (invite_id !== pendingInviteIdRef.current) return;
          unsubA();
          setPendingInvite(prev => (battle as InviteDetail | undefined) ?? (prev ? { ...prev, status: 'accepted' } : prev));
          // No Start button — the battle begins as soon as the opponent accepts.
          // Started straight from the socket event; /battle/start validates the status.
          startBattle();
        });
        const unsubD = onBattleInviteDeclined(async ({ invite_id }) => {
          if (invite_id !== pendingInviteIdRef.current) return;
          const token2 = authStore.getToken();
          const res = await fetch(`${BASE_URL}/battle/invite/${invite_id}`, {
            headers: token2 ? { Authorization: `Bearer ${token2}` } : {},
          });
          const j = await res.json();
          if (j.success) setPendingInvite(j.data as InviteDetail);
          unsubD();
        });
      } else {
        setInviteSuccess(`Error: ${json.message}`);
      }
    } catch {
      setInviteSuccess('Network error. Please try again.');
    } finally {
      setInviteSending(null);
    }
  }

  async function cancelInvite() {
    if (pendingInviteIdRef.current) {
      try {
        const token = authStore.getToken();
        await fetch(`${BASE_URL}/battle/decline`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ invite_id: pendingInviteIdRef.current }),
        });
      } catch {}
    }
    close();
  }

  async function startBattle() {
    if (!pendingInviteIdRef.current || startingRef.current) return;
    startingRef.current = true;
    setStartError(null);
    try {
      const token = authStore.getToken();
      const r = await fetch(`${BASE_URL}/battle/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ invite_id: pendingInviteIdRef.current }),
      });
      const json = await r.json();
      if (json.success) {
        // Banner + VS bar appear from the battle_started socket event
        close();
        return;
      }
      setStartError(json.message || 'Could not start the battle.');
    } catch {
      setStartError('Network error. Could not start the battle.');
    }
    startingRef.current = false;
  }

  const filteredRooms = rooms.filter(r =>
    r.room_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const currentHeight = page === 'waiting'
    ? SHEET_WAITING
    : page === 'invite' || battleMode === 'gifting'
      ? SHEET_GIFTING
      : SHEET_NORMAL;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={close} onShow={open}>
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={close} />

      <Animated.View
        style={[
          s.sheet,
          // Setup / waiting pages wrap their content (no empty gap at the bottom);
          // the invite page is a scrolling list, so it keeps a fixed height.
          page === 'invite' ? { height: currentHeight } : { maxHeight: SCREEN_H * 0.9 },
          { paddingBottom: insets.bottom + 8, transform: [{ translateY }] },
        ]}>

        {/* Drag handle */}
        <View {...panResponder.panHandlers} style={s.handleArea}>
          <View style={s.handle} />
        </View>

        {/* Header — hidden on waiting page to avoid double heading */}
        {page !== 'waiting' && (
          <View style={s.header}>
            {page === 'invite' ? (
              <TouchableOpacity onPress={() => setPage('setup')} style={s.headerBtn} hitSlop={8}>
                <Ionicons name="arrow-back" size={20} color="#1C1E22" />
              </TouchableOpacity>
            ) : (
              <View style={s.headerBtn} />
            )}
            <Text style={s.title}>
              {page === 'invite' ? 'Invite Room' : 'Battle room'}
            </Text>
            <TouchableOpacity onPress={close} style={s.headerBtn} hitSlop={8}>
              <Ionicons name="close" size={20} color="#7A0EED" />
            </TouchableOpacity>
          </View>
        )}
        {/* Close button only for waiting page */}
        {page === 'waiting' && (
          <TouchableOpacity onPress={close} style={s.waitingClose} hitSlop={8}>
            <Ionicons name="close" size={20} color="#7A0EED" />
          </TouchableOpacity>
        )}

        {inviteSuccess && page !== 'waiting' && (
          <View style={s.toastBanner}>
            <Text style={s.toastText}>{inviteSuccess}</Text>
          </View>
        )}

        {page === 'setup' ? (
          <SetupPage
            selectedTime={selectedTime}
            setSelectedTime={setSelectedTime}
            battleMode={battleMode}
            setBattleMode={setBattleMode}
            targets={targets}
            targetsLoading={targetsLoading}
            targetsError={targetsError}
            onRetryTargets={loadTargets}
            selectedTargetId={selectedTargetId}
            setSelectedTargetId={setSelectedTargetId}
            onStart={goInvite}
            roomImageUrl={roomImageUrl ?? null}
          />
        ) : page === 'invite' ? (
          <InvitePage
            rooms={filteredRooms}
            loading={loadingRooms}
            invitedId={invitedId}
            inviteSending={inviteSending}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onInvite={sendInvite}
          />
        ) : pendingInvite ? (
          <WaitingPage
            invite={pendingInvite}
            onGoBack={() => setPage('invite')}
            onRetryStart={startBattle}
            startError={startError}
            battleMode={battleMode}
            selectedTarget={selectedTarget}
          />
        ) : (
          <View style={{ paddingVertical: 48, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color="#B06EFF" size="large" />
          </View>
        )}
      </Animated.View>
    </Modal>
  );
}

// ── Setup page ────────────────────────────────────────────────────────────────

const H_PAD = 16;      // sheet side padding
const GRID_GAP = 8;    // gap between time chips / target cards

function SetupPage({
  selectedTime, setSelectedTime,
  battleMode, setBattleMode,
  targets, targetsLoading, targetsError, onRetryTargets,
  selectedTargetId, setSelectedTargetId,
  onStart, roomImageUrl,
}: {
  selectedTime: number;
  setSelectedTime: (t: number) => void;
  battleMode: BattleMode;
  setBattleMode: (m: BattleMode) => void;
  targets: BattleTarget[];
  targetsLoading: boolean;
  targetsError: boolean;
  onRetryTargets: () => void;
  selectedTargetId: string | null;
  setSelectedTargetId: (id: string) => void;
  onStart: () => void;
  roomImageUrl: string | null;
}) {
  const { width } = useWindowDimensions();
  // Everything scales with the screen width so it fits small and large phones
  const avatarSize = Math.round(Math.min(72, Math.max(54, width * 0.17)));
  const vsWidth = Math.round(Math.min(96, Math.max(68, width * 0.22)));

  const resolvedImage = resolveUrl(roomImageUrl);
  const selectedTarget = targets.find(t => t.id === selectedTargetId) ?? null;
  const isGifting = battleMode === 'gifting';
  const canStart = !isGifting || !!selectedTarget;

  return (
    <ScrollView
      style={s.setupScroll}
      contentContainerStyle={s.setupWrap}
      showsVerticalScrollIndicator={false}
      bounces={false}>
      {/* ── VS hero ── */}
      <View style={s.vsRow}>
        <View style={s.avatarCol}>
          <View style={[s.avatarRing, { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }]}>
            {resolvedImage ? (
              <Image source={{ uri: resolvedImage }} style={s.avatarImg} resizeMode="cover" />
            ) : (
              <Image source={require('@/assets/images/raralogo.png')} style={s.avatarImg} resizeMode="contain" />
            )}
          </View>
          <View style={s.youBadge}>
            <Text style={s.youBadgeText} numberOfLines={1}>You</Text>
          </View>
        </View>

        <Image
          source={require('@/assets/tabs/chatroom/vsimage.png')}
          style={{ width: vsWidth, height: Math.round(vsWidth * 0.75) }}
          resizeMode="contain"
        />

        <View style={s.avatarCol}>
          <View style={[s.avatarRingDashed, { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }]}>
            <Ionicons name="add" size={Math.round(avatarSize * 0.36)} color="#C084FC" />
          </View>
          <View style={[s.youBadge, s.opponentBadge]}>
            <Text style={s.youBadgeText} numberOfLines={1}>Opponent</Text>
          </View>
        </View>
      </View>

      {/* ── Battle type: two equal segments ── */}
      <View style={s.modeTabs}>
        <DiamondCutTabs
          value={battleMode}
          onChange={setBattleMode}
          tabs={[
            { key: 'normal', label: 'Normal Battle', icon: 'flash', inactiveIcon: 'flash-outline', activeColors: ['#7A0EED', '#A020C8'] },
            { key: 'gifting', label: 'Gifting Battle', icon: 'gift', inactiveIcon: 'gift-outline', activeColors: ['#C0186A', '#EC4899'] },
          ]}
        />
      </View>

      {/* ── Select time: six equal chips in one row ── */}
      <View style={s.sectionRow}>
        <Ionicons name="time-outline" size={15} color="#7A0EED" />
        <Text style={s.sectionTitle}>Select time</Text>
      </View>
      <View style={s.timeRow}>
        {DURATION_OPTIONS.map(t => {
          const active = selectedTime === t;
          return (
            <TouchableOpacity
              key={t}
              onPress={() => setSelectedTime(t)}
              activeOpacity={0.8}
              style={[s.timeChip, active && s.timeChipActive]}
              accessibilityLabel={`${t} minutes`}>
              {active ? (
                <LinearGradient colors={['#7A0EED', '#C0186A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.timeChipFill}>
                  <Text style={[s.timeChipNum, s.timeChipNumActive]}>{t}</Text>
                  <Text style={[s.timeChipUnit, s.timeChipUnitActive]}>min</Text>
                </LinearGradient>
              ) : (
                <View style={s.timeChipFill}>
                  <Text style={s.timeChipNum}>{t}</Text>
                  <Text style={s.timeChipUnit}>min</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Gifting Battle only: admin-configured coin targets ── */}
      {isGifting && (
        <>
          <View style={s.sectionRow}>
            <Ionicons name="gift-outline" size={15} color="#7A0EED" />
            <Text style={s.sectionTitle}>Select coins</Text>
            <Text style={s.sectionSub}>(total gifts target)</Text>
          </View>

          {targetsLoading && targets.length === 0 ? (
            <View style={s.targetState}><ActivityIndicator color="#7A0EED" /></View>
          ) : targetsError && targets.length === 0 ? (
            <TouchableOpacity style={s.targetState} onPress={onRetryTargets} activeOpacity={0.7}>
              <Text style={s.targetStateText}>Couldn't load targets. Tap to retry.</Text>
            </TouchableOpacity>
          ) : targets.length === 0 ? (
            <View style={s.targetState}>
              <Text style={s.targetStateText}>No gift targets are available right now.</Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={s.targetScroll}
              contentContainerStyle={s.targetRow}>
              {targets.map(t => {
                const active = t.id === selectedTargetId;
                const img = resolveUrl(t.image_url);
                return (
                  <TouchableOpacity
                    key={t.id}
                    onPress={() => setSelectedTargetId(t.id)}
                    activeOpacity={0.8}
                    style={[s.targetCard, active && s.targetCardActive]}
                    accessibilityLabel={`${Number(t.coin_amount).toLocaleString()} coins target`}>
                    {active && (
                      <View style={s.targetCheck}>
                        <Ionicons name="checkmark" size={10} color="#fff" />
                      </View>
                    )}
                    {img
                      ? <Image source={{ uri: img }} style={s.targetImg} resizeMode="contain" />
                      : <Text style={s.coinEmoji}>🪙</Text>}
                    <Text style={[s.targetLabel, active && s.targetLabelActive]} numberOfLines={1}>{targetLabel(t)}</Text>
                    <Text style={[s.targetSub, active && s.targetSubActive]}>coins</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {targets.length > 0 && (
            <View style={s.infoRow}>
              <Ionicons name="information-circle-outline" size={14} color="#9B6FE0" />
              <Text style={s.infoText} numberOfLines={2}>
                {selectedTarget?.description || 'First room to reach the target wins.'}
              </Text>
            </View>
          )}
        </>
      )}

      {/* ── Start battle ── */}
      <View style={s.bottomArea}>
        <DiamondCutButton
          label="Start battle"
          onPress={onStart}
          disabled={!canStart}
          colors={['#7A0EED', '#C0186A', '#F5A623']}
          iconNode={<MaterialCommunityIcons name="sword-cross" size={18} color="#FFFFFF" />}
          height={46}
          fontSize={15}
          textStyle={{ color: '#FFFFFF', fontWeight: '900', letterSpacing: 0.3 }}
          style={s.startBtn}
        />
      </View>
    </ScrollView>
  );
}

// ── Invite page ───────────────────────────────────────────────────────────────

function InvitePage({
  rooms, loading, invitedId, inviteSending, searchQuery, onSearchChange, onInvite,
}: {
  rooms: Room[];
  loading: boolean;
  invitedId: string | null;
  inviteSending: string | null;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onInvite: (id: string) => void;
}) {
  return (
    <View style={{ flex: 1 }}>
      <View style={inv.searchWrap}>
        <Ionicons name="search-outline" size={16} color="#ABADB2" />
        <TextInput
          style={inv.searchInput}
          placeholder="Search rooms…"
          placeholderTextColor="#C4C5CC"
          value={searchQuery}
          onChangeText={onSearchChange}
          returnKeyType="search"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => onSearchChange('')} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color="#ABADB2" />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={inv.center}>
          <ActivityIndicator color="#7A0EED" />
          <Text style={inv.emptyText}>Loading online rooms…</Text>
        </View>
      ) : rooms.length === 0 ? (
        <View style={inv.center}>
          <Ionicons name="chatbubbles-outline" size={32} color="#DDDAE8" />
          <Text style={inv.emptyText}>No online rooms available</Text>
        </View>
      ) : (
        <FlatList
          data={rooms}
          keyExtractor={r => r.id}
          contentContainerStyle={inv.list}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={inv.separator} />}
          renderItem={({ item }) => {
            const invited = invitedId === item.id;
            const sending = inviteSending === item.id;
            return (
              <View style={inv.row}>
                <RoomAvatar url={item.room_image_url} name={item.room_name} />
                <Text style={inv.roomName} numberOfLines={1}>{item.room_name}</Text>
                <TouchableOpacity
                  onPress={() => !invited && !sending && onInvite(item.id)}
                  activeOpacity={0.8}
                  style={[inv.inviteBtn, invited && inv.invitedBtn, sending && inv.sendingBtn]}
                  disabled={invited || sending}>
                  {sending ? (
                    <ActivityIndicator size="small" color="#7A0EED" />
                  ) : (
                    <Text style={[inv.inviteBtnText, invited && inv.invitedBtnText]}>
                      {invited ? 'Invited ✓' : 'Invite'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  sheetDark: { backgroundColor: '#0F1225' },
  handleArea: { alignItems: 'center', paddingTop: 10, paddingBottom: 2 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#DDDAE8' },
  handleDark: { backgroundColor: 'rgba(255,255,255,0.15)' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 8,
  },
  headerBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  title: {
    flex: 1, textAlign: 'center',
    fontSize: 16, fontWeight: '800', color: '#1C1E22', letterSpacing: 0.2,
  },
  titleDark: { color: '#FFFFFF' },
  waitingClose: {
    position: 'absolute', top: 14, right: 16, zIndex: 10,
    width: 32, height: 32, alignItems: 'center', justifyContent: 'center',
  },

  toastBanner: {
    marginHorizontal: 16, marginBottom: 8,
    backgroundColor: '#ECFDF5', borderRadius: 10,
    paddingVertical: 8, paddingHorizontal: 14,
    borderWidth: 1, borderColor: '#6EE7B7',
  },
  toastText: { fontSize: 13, fontWeight: '600', color: '#065F46', textAlign: 'center' },

  scrollContent: { paddingHorizontal: 16, paddingBottom: 8 },

  // Scrolls only if a very short screen can't fit everything
  setupScroll: { flexGrow: 0 },
  setupWrap: { paddingHorizontal: H_PAD, paddingBottom: 4 },

  // VS hero — sizes set inline from the screen width
  vsRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-evenly', marginBottom: 14,
  },
  avatarCol: { alignItems: 'center', gap: 6, minWidth: 72 },
  avatarRing: {
    borderWidth: 2, borderColor: '#7A0EED', padding: 3,
    backgroundColor: '#F3EEFF', overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%', borderRadius: 999, backgroundColor: '#7A0EED' },
  avatarRingDashed: {
    borderWidth: 2, borderColor: '#C084FC', borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#FAFAFF',
  },
  youBadge: {
    backgroundColor: '#7A0EED',
    paddingHorizontal: 12, paddingVertical: 3, borderRadius: 20,
  },
  opponentBadge: { backgroundColor: '#EC4899' },
  youBadgeText: { fontSize: 11, fontWeight: '800', color: '#fff', letterSpacing: 0.2 },

  // Battle type — two equal diamond-cut tabs
  modeTabs: { marginBottom: 16 },

  // Section header
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#2C1A4D' },
  sectionSub: { fontSize: 12, color: '#9B6FE0' },

  // Time — six equal chips in one row (flex, so they always fit)
  timeRow: { flexDirection: 'row', gap: GRID_GAP, marginBottom: 16 },
  timeChip: {
    flex: 1, height: 50, borderRadius: 14,
    borderWidth: 1.5, borderColor: '#E8D5FF',
    backgroundColor: '#fff', overflow: 'hidden',
  },
  timeChipActive: {
    borderColor: '#7A0EED',
    shadowColor: '#7A0EED', shadowOpacity: 0.3, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },
  timeChipFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  timeChipNum: { fontSize: 16, fontWeight: '800', color: '#2C2F33', lineHeight: 19 },
  timeChipNumActive: { color: '#fff' },
  timeChipUnit: { fontSize: 10, fontWeight: '600', color: '#9A9CA5', lineHeight: 12 },
  timeChipUnitActive: { color: 'rgba(255,255,255,0.85)' },

  // Targets — one compact row that scrolls sideways; bleeds to the sheet
  // edges so cards slide under them instead of being cut at the padding
  targetScroll: { marginHorizontal: -H_PAD, marginBottom: 10, flexGrow: 0 },
  targetRow: { flexDirection: 'row', gap: 6, paddingHorizontal: H_PAD },
  targetCard: {
    minWidth: 58, paddingVertical: 6, paddingHorizontal: 8,
    borderRadius: 12, borderWidth: 1.5, borderColor: '#E8D5FF',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fff',
  },
  targetCardActive: { borderColor: '#7A0EED', backgroundColor: '#FBF7FF' },
  targetCheck: {
    position: 'absolute', top: 3, right: 3,
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: '#7A0EED', alignItems: 'center', justifyContent: 'center',
  },
  targetImg: { width: 22, height: 22, marginBottom: 2 },
  coinEmoji: { fontSize: 17, lineHeight: 22, marginBottom: 2 },
  targetLabel: { fontSize: 13, fontWeight: '800', color: '#1C1E22' },
  targetLabelActive: { color: '#7A0EED' },
  targetSub: { fontSize: 10, color: '#9A9CA5' },
  targetSubActive: { color: '#9B6FE0' },
  targetState: {
    height: 72, borderRadius: 14, borderWidth: 1, borderColor: '#EFE7FF', borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', marginBottom: 10, paddingHorizontal: 12,
  },
  targetStateText: { fontSize: 13, color: '#8A63D2', textAlign: 'center' },

  infoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#F7F3FF', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  infoText: { fontSize: 12, color: '#6B3FC0', flex: 1 },

  bottomArea: { paddingTop: 16, gap: 8 },
  startBtn: { width: '72%', alignSelf: 'center' },
  fairRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  fairText: { fontSize: 12, color: '#9B6FE0' },
});

const inv = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyText: { fontSize: 14, color: '#ABADB2', fontWeight: '500' },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 10,
    backgroundColor: '#F7F5FF', borderRadius: 12,
    borderWidth: 1, borderColor: '#E8E6F0',
    paddingHorizontal: 12, paddingVertical: 8, gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#1C1E22', paddingVertical: 0 },
  list: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 16 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: '#F0EDF8' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
  roomAvatarFallback: { backgroundColor: '#EDE8F7', alignItems: 'center', justifyContent: 'center' },
  roomAvatarInitial: { fontWeight: '700', color: '#7A0EED' },
  roomName: { flex: 1, fontSize: 14, fontWeight: '600', color: '#1C1E22' },
  inviteBtn: {
    paddingHorizontal: 16, paddingVertical: 7,
    borderRadius: 16, backgroundColor: '#7A0EED',
    minWidth: 72, alignItems: 'center',
  },
  invitedBtn: { backgroundColor: '#F3EEFF', borderWidth: 1, borderColor: '#7A0EED' },
  sendingBtn: { backgroundColor: '#F3EEFF', borderWidth: 1, borderColor: '#7A0EED' },
  inviteBtnText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  invitedBtnText: { color: '#7A0EED' },
});

// ── Waiting page ──────────────────────────────────────────────────────────────

function WaitingPage({
  invite, onRetryStart, startError, onGoBack, battleMode, selectedTarget,
}: {
  invite: InviteDetail;
  /** Only shown if the automatic start after acceptance failed. */
  onRetryStart: () => void;
  startError: string | null;
  onGoBack: () => void;
  battleMode: BattleMode;
  selectedTarget: BattleTarget | null;
}) {
  const flipAnim = useRef(new Animated.Value(0)).current;
  const [countdown, setCountdown] = useState(10);

  // Sand timer flip loop
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(flipAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.delay(400),
        Animated.timing(flipAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
        Animated.delay(400),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [flipAnim]);

  // 10s countdown — auto return to invite page if still pending
  useEffect(() => {
    if (invite.status !== 'pending') return;
    setCountdown(10);
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [invite.status]);

  useEffect(() => {
    if (countdown === 0 && invite.status === 'pending') onGoBack();
  }, [countdown, invite.status]);

  const timerRotate = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });

  const status = invite.status;
  const isPending = status === 'pending';
  const isAccepted = status === 'accepted';
  const isDeclined = status === 'declined';

  const fromImg = resolveUrl(invite.from_room_image_url);
  const toImg = resolveUrl(invite.to_room_image_url);
  const OWN_FRAME  = require('@/assets/tabs/chatroom/battleownframe.png');
  const OPP_FRAME  = require('@/assets/tabs/chatroom/battleaoppfrme.png');

  return (
    <View style={w.outer}>

      {/* ── PENDING badge row ── */}
      <View style={w.badgeRow}>
        <Text style={w.star}>★</Text>
        <View style={[w.badge, isAccepted ? w.badgeAccepted : isDeclined ? w.badgeDeclined : w.badgePending]}>
          <Text style={[w.badgeText, isAccepted ? w.badgeTextAccepted : isDeclined ? w.badgeTextDeclined : null]}>
            {isAccepted ? 'Accepted' : isDeclined ? 'Declined' : 'Pending'}
          </Text>
        </View>
        <Text style={w.star}>★</Text>
      </View>

      {/* ── Title ── */}
      <Text style={w.titleMain}>{invite.duration_minutes} min battle</Text>

      {/* ── Target chip (gifting mode) ── */}
      {battleMode === 'gifting' && selectedTarget && (
        <View style={w.targetChip}>
          <Text style={w.targetChipText}>🪙 {targetLabel(selectedTarget)} coins target</Text>
        </View>
      )}

      {/* ── VS arena ── */}
      <View style={w.vsRow}>
        {/* Left room */}
        <View style={w.roomCol}>
          <View style={w.frameWrap}>
            {fromImg
              ? <Image source={{ uri: fromImg }} style={w.avatarOwn} resizeMode="cover" />
              : <View style={[w.avatarOwn, w.avatarFallbackBlue]}>
                  <Text style={w.avatarInitial}>{(invite.from_room_name ?? '?')[0].toUpperCase()}</Text>
                </View>
            }
            <Image source={OWN_FRAME} style={w.frame} resizeMode="contain" />
          </View>
          <LinearGradient colors={['#1A3BB5', '#1E4FE0']} style={w.ribbon}>
            <Text style={w.ribbonUsername} numberOfLines={1}>{invite.from_room_name}</Text>
            <Text style={w.ribbonSub}>You</Text>
          </LinearGradient>
        </View>

        {/* VS */}
        <Image source={require('@/assets/tabs/chatroom/vsimage.png')} style={w.vsImg} resizeMode="contain" />

        {/* Right room */}
        <View style={w.roomCol}>
          <View style={w.frameWrap}>
            {toImg
              ? <Image source={{ uri: toImg }} style={w.avatarOpponent} resizeMode="cover" />
              : <View style={[w.avatarOpponent, w.avatarFallbackGold]}>
                  <Text style={w.avatarInitial}>{(invite.to_room_name ?? '?')[0].toUpperCase()}</Text>
                </View>
            }
            <Image source={OPP_FRAME} style={w.frame} resizeMode="contain" />
          </View>
          <LinearGradient colors={['#B85C00', '#E07020']} style={w.ribbon}>
            <Text style={w.ribbonUsername} numberOfLines={1}>{invite.to_room_name}</Text>
            <Text style={w.ribbonSub}>Opponent</Text>
          </LinearGradient>
        </View>
      </View>

      {/* ── Status bar ── */}
      <View style={[w.statusBar, isAccepted ? w.statusBarGreen : isDeclined ? w.statusBarRed : w.statusBarDark]}>
        {isPending && (
          <Animated.Text style={[w.timerEmoji, { transform: [{ rotate: timerRotate }] }]}>⏳</Animated.Text>
        )}
        <Text style={[w.statusBarText, isAccepted ? w.statusBarTextGreen : isDeclined ? w.statusBarTextRed : null]}>
          {isPending
            ? 'Waiting for the other room to accept...'
            : isAccepted
              ? (startError ? `⚠️ ${startError}` : '🎉 Accepted! Starting battle…')
              : '❌ Invite was declined.'}
        </Text>
        {isAccepted && !startError && <ActivityIndicator size="small" color="#16A34A" />}
        {isPending && <Text style={w.countdownText}>{countdown}s</Text>}
      </View>

      {/* ── Actions ── */}
      {isAccepted && !!startError && (
        <GradientButton
          label="Retry"
          onPress={onRetryStart}
          colors={['#7A0EED', '#C0186A', '#F5A623']}
          iconNode={<Text style={{ fontSize: 14 }}>⚔️</Text>}
          height={44}
          borderRadius={22}
          fontSize={14}
          textStyle={{ fontWeight: '900', letterSpacing: 0.3 }}
          style={{ marginTop: 4 }}
        />
      )}
      {isDeclined && (
        <TouchableOpacity style={w.closeBtn} onPress={onGoBack} activeOpacity={0.8}>
          <Text style={w.closeBtnText}>Close</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// Battle frame size. The avatar offsets below were measured against a 140px
// frame (see comment in frameWrap); f() scales them so the avatar still lands
// exactly inside the shield at any FRAME size.
const FRAME = 124;
const f = (px: number) => Math.round((px * FRAME) / 140);

const w = StyleSheet.create({
  // full-height container — no background (sheet is dark navy)
  outer: {
    alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12, gap: 12,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // ── PENDING badge row ──
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 28 },
  star: { fontSize: 14, color: '#D97706' },
  badge: { paddingHorizontal: 14, paddingVertical: 4, borderRadius: 20, borderWidth: 1.5 },
  badgePending:  { backgroundColor: '#FFF8EC', borderColor: '#F5A623' },
  badgeAccepted: { backgroundColor: '#ECFDF5', borderColor: '#16A34A' },
  badgeDeclined: { backgroundColor: '#FEF2F2', borderColor: '#DC2626' },
  badgeText: { fontSize: 12, fontWeight: '800', color: '#D97706', letterSpacing: 0.2 },
  badgeTextAccepted: { color: '#16A34A' },
  badgeTextDeclined: { color: '#DC2626' },

  // ── Title ──
  titleMain: { fontSize: 18, fontWeight: '800', color: '#1C1E22', letterSpacing: 0.5 },

  // ── Target chip ──
  targetChip: {
    backgroundColor: '#F3EEFF', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 4,
    borderWidth: 1, borderColor: '#E8D5FF',
  },
  targetChipText: { fontSize: 13, fontWeight: '700', color: '#7A0EED' },

  // ── VS arena row ──
  vsRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', width: '100%',
  },
  roomCol: { alignItems: 'center', gap: 6, flex: 1 },

  // frame + avatar — avatar sits centered, frame overlays on top.
  // battleownframe.png / battleaoppfrme.png are 1024x1024 shield badges, each
  // with its own painted double-line ring — the two are NOT identically
  // sized. Their INNER edges (where the flat fill starts, not the outer
  // decorative trim) were found by edge-detection per frame:
  //   own (blue): ~711x743px, centered ~(514, 482) — a slight ellipse, not
  //   a circle, and vertically off-center (the shield tapers to a point
  //   below it).
  //   opponent (gold): ~732x783px, centered ~(517, 477) — a bit larger.
  // Each avatar box below is an ellipse (different width/height, borderRadius
  // = half the larger side) sized/positioned to land exactly inside its own
  // frame's circle. Verified by compositing same-size placeholder ellipses
  // over both frame PNGs — earlier passes assumed a shared circle radius and
  // measured out to the ring's outer trim, which left a visible gap.
  frameWrap: {
    width: FRAME, height: FRAME,
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  avatarOwn: {
    width: f(97), height: f(102), borderRadius: f(51),
    position: 'absolute', top: f(15), left: f(22), overflow: 'hidden',
  },
  avatarOpponent: {
    width: f(100), height: f(107), borderRadius: f(54),
    position: 'absolute', top: f(12), left: f(21), overflow: 'hidden',
  },
  avatarFallbackBlue:   { backgroundColor: '#1A3BB5', alignItems: 'center', justifyContent: 'center' },
  avatarFallbackPurple: { backgroundColor: '#6D28D9', alignItems: 'center', justifyContent: 'center' },
  avatarFallbackGold:   { backgroundColor: '#B45309', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 22, fontWeight: '800', color: '#FFFFFF' },
  // frame overlays exactly the frameWrap size
  frame: { width: FRAME, height: FRAME, position: 'absolute', top: 0, left: 0 },

  // ribbon
  ribbon: {
    alignSelf: 'stretch', borderRadius: 10,
    paddingVertical: 6, paddingHorizontal: 8,
    alignItems: 'center',
  },
  ribbonUsername: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  ribbonSub: { fontSize: 11, fontWeight: '500', color: 'rgba(255,255,255,0.75)' },

  // VS image
  vsImg: { width: 60, height: 48, marginHorizontal: 2 },

  // ── Status bar ──
  statusBar: {
    marginTop: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, width: '100%', borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  statusBarDark: {
    backgroundColor: '#F3EEFF',
    borderWidth: 1, borderColor: '#E8D5FF',
  },
  statusBarGreen: { backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#6EE7B7' },
  statusBarRed:   { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FCA5A5' },
  statusBarText: {
    fontSize: 13, fontWeight: '500',
    color: '#7A0EED', textAlign: 'center', flex: 1,
  },
  statusBarTextGreen: { color: '#16A34A' },
  statusBarTextRed:   { color: '#DC2626' },
  timerEmoji: { fontSize: 16 },
  countdownText: { fontSize: 14, fontWeight: '800', color: RC.number, minWidth: 30, textAlign: 'right' },

  // ── Decline close button ──
  closeBtn: {
    width: '100%', height: 44, justifyContent: 'center', borderRadius: 22,
    borderWidth: 1.5, borderColor: '#EDE8F7',
    alignItems: 'center', backgroundColor: '#FAFAFF',
  },
  closeBtnText: { fontSize: 14, fontWeight: '700', color: '#60626A' },
});
