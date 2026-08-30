import { Ionicons } from '@expo/vector-icons';
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BASE_URL, MEDIA_BASE } from '@/services/api';
import { authStore } from '@/store/auth-store';
import { GradientButton } from '@/components/ui/gradient-button';
import { onBattleInviteAccepted, onBattleInviteDeclined } from '@/store/socket-store';

const { height: SCREEN_H } = Dimensions.get('window');
const SHEET_NORMAL  = SCREEN_H * 0.60;
const SHEET_GIFTING = SCREEN_H * 0.78;
const SHEET_WAITING = SCREEN_H * 0.80;
const TIME_OPTIONS = [10, 15, 20, 30, 45];
const TARGET_OPTIONS = [
  { label: '5K',   value: 5_000 },
  { label: '20K',  value: 20_000 },
  { label: '50K',  value: 50_000 },
  { label: '100K', value: 100_000 },
  { label: '200K', value: 200_000 },
];

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
  const [selectedTarget, setSelectedTarget] = useState(5_000);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [invitedId, setInvitedId] = useState<string | null>(null);
  const [inviteSending, setInviteSending] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingInvite, setPendingInvite] = useState<InviteDetail | null>(null);
  const pendingInviteIdRef = useRef<string | null>(null);

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
    translateY.setValue(SHEET_NORMAL);
    Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 60, friction: 12 }).start();
  }

  function close() {
    Animated.timing(translateY, { toValue: getSheetHeight(), duration: 220, useNativeDriver: true }).start(onClose);
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
        }),
      });
      const json = await r.json();
      if (json.success && json.data) {
        const inviteId = json.data.id;
        pendingInviteIdRef.current = inviteId;
        // Fetch full invite (with room names) since createInvite returns raw row
        const fullRes = await fetch(`${BASE_URL}/battle/invite/${inviteId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const fullJson = await fullRes.json();
        if (fullJson.success) setPendingInvite(fullJson.data as InviteDetail);
        setPage('waiting');
        // subscribe to socket events
        const unsubA = onBattleInviteAccepted(async ({ invite_id }) => {
          if (invite_id !== pendingInviteIdRef.current) return;
          const token2 = authStore.getToken();
          const res = await fetch(`${BASE_URL}/battle/invite/${invite_id}`, {
            headers: token2 ? { Authorization: `Bearer ${token2}` } : {},
          });
          const j = await res.json();
          if (j.success) setPendingInvite(j.data as InviteDetail);
          unsubA();
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
    if (!pendingInviteIdRef.current) return;
    try {
      const token = authStore.getToken();
      const r = await fetch(`${BASE_URL}/battle/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ invite_id: pendingInviteIdRef.current }),
      });
      const json = await r.json();
      if (json.success) {
        // Battle banner in the room picks up the newly-started battle via its own polling
        close();
      }
    } catch {}
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
          // white bg for waiting page
          { height: currentHeight, paddingBottom: insets.bottom + 8, transform: [{ translateY }] },
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
              {page === 'invite' ? 'Invite Room' : 'BATTLE ROOM'}
            </Text>
            <TouchableOpacity onPress={close} style={s.headerBtn} hitSlop={8}>
              <Ionicons name="close" size={22} color="#7A0EED" />
            </TouchableOpacity>
          </View>
        )}
        {/* Close button only for waiting page */}
        {page === 'waiting' && (
          <TouchableOpacity onPress={close} style={s.waitingClose} hitSlop={8}>
            <Ionicons name="close" size={22} color="#7A0EED" />
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
            selectedTarget={selectedTarget}
            setSelectedTarget={setSelectedTarget}
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
            onStart={startBattle}
            battleMode={battleMode}
            selectedTarget={selectedTarget}
          />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color="#B06EFF" size="large" />
          </View>
        )}
      </Animated.View>
    </Modal>
  );
}

// ── Setup page ────────────────────────────────────────────────────────────────

function SetupPage({
  selectedTime, setSelectedTime,
  battleMode, setBattleMode,
  selectedTarget, setSelectedTarget,
  onStart, roomImageUrl,
}: {
  selectedTime: number;
  setSelectedTime: (t: number) => void;
  battleMode: BattleMode;
  setBattleMode: (m: BattleMode) => void;
  selectedTarget: number;
  setSelectedTarget: (v: number) => void;
  onStart: () => void;
  roomImageUrl: string | null;
}) {
  const resolvedImage = roomImageUrl
    ? roomImageUrl.startsWith('http') ? roomImageUrl : `${MEDIA_BASE}/${roomImageUrl.replace(/^\//, '')}`
    : null;

  return (
    <View style={s.setupWrap}>
      {/* ── VS hero ── */}
      <View style={s.vsRow}>
        <View style={s.avatarCol}>
          <View style={s.avatarRing}>
            <View style={s.avatar}>
              {resolvedImage ? (
                <Image source={{ uri: resolvedImage }} style={s.avatarImg} resizeMode="cover" />
              ) : (
                <Image source={require('@/assets/images/raralogo.png')} style={s.avatarImg} resizeMode="contain" />
              )}
            </View>
          </View>
          <View style={s.youBadge}>
            <Text style={s.youBadgeText}>YOU</Text>
          </View>
        </View>

        <Image
          source={require('@/assets/tabs/chatroom/vsimage.png')}
          style={{ width: 100, height: 80 }}
          resizeMode="contain"
        />

        <View style={s.avatarCol}>
          <View style={s.avatarRingDashed}>
            <Text style={s.plusSign}>+</Text>
          </View>
          <View style={[s.youBadge, s.opponentBadge]}>
            <Text style={s.youBadgeText}>OPPONENT</Text>
          </View>
        </View>
      </View>

      {/* ── Battle mode tabs ── */}
      <View style={s.modeTabRow}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => setBattleMode('normal')}
          style={s.modeTab}>
          {battleMode === 'normal' ? (
            <LinearGradient colors={['#7A0EED', '#A020C8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.modeTabInner}>
              <Text style={[s.modeTabText, s.modeTabTextActive]}>NORMAL BATTLE</Text>
            </LinearGradient>
          ) : (
            <View style={s.modeTabInnerInactive}>
              <Text style={s.modeTabText}>NORMAL BATTLE</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => setBattleMode('gifting')}
          style={s.modeTab}>
          {battleMode === 'gifting' ? (
            <LinearGradient colors={['#C0186A', '#EC4899']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.modeTabInner}>
              <Text style={s.giftEmoji}>🎁</Text>
              <Text style={[s.modeTabText, s.modeTabTextActive]}>GIFTING BATTLE</Text>
            </LinearGradient>
          ) : (
            <View style={s.modeTabInnerInactive}>
              <Text style={s.modeTabText}>GIFTING BATTLE</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Select Time ── */}
      <View style={s.sectionRow}>
        <Ionicons name="time-outline" size={15} color="#7A0EED" />
        <Text style={s.sectionTitle}>SELECT TIME</Text>
      </View>
      <View style={s.timeRow}>
        {TIME_OPTIONS.map(t => {
          const active = selectedTime === t;
          return (
            <TouchableOpacity
              key={t}
              onPress={() => setSelectedTime(t)}
              activeOpacity={0.8}
              style={[s.timeChip, active && s.timeChipActive]}>
              {active ? (
                <LinearGradient
                  colors={['#7A0EED', '#C0186A']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={s.timeChipGradient}>
                  <Text style={[s.timeChipNum, s.timeChipNumActive]}>{t}</Text>
                  <Text style={[s.timeChipUnit, s.timeChipUnitActive]}>Mins</Text>
                </LinearGradient>
              ) : (
                <>
                  <Text style={s.timeChipNum}>{t}</Text>
                  <Text style={s.timeChipUnit}>Mins</Text>
                </>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Gifting battle: Select Target ── */}
      {battleMode === 'gifting' && (
        <>
          <View style={s.sectionRow}>
            <Text style={s.sectionIcon}>🎁</Text>
            <Text style={s.sectionTitle}>SELECT TARGET</Text>
            <Text style={s.sectionSub}> (Total Gifts Target)</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.targetRow}>
            {TARGET_OPTIONS.map(opt => {
              const isActive = selectedTarget === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => setSelectedTarget(opt.value)}
                  activeOpacity={0.8}
                  style={[s.targetChip, isActive && s.targetChipActive]}>
                  {isActive && (
                    <View style={s.targetCheck}>
                      <Ionicons name="checkmark" size={9} color="#fff" />
                    </View>
                  )}
                  <Text style={s.coinEmoji}>🪙</Text>
                  <Text style={[s.targetLabel, isActive && s.targetLabelActive]}>{opt.label}</Text>
                  <Text style={[s.targetSub, isActive && s.targetSubActive]}>Coins</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <View style={s.infoRow}>
            <Ionicons name="information-circle-outline" size={13} color="#9B6FE0" />
            <Text style={s.infoText}>First player to reach the target wins.</Text>
          </View>
        </>
      )}

      {/* ── Start Battle button ── */}
      <View style={s.bottomArea}>
        <GradientButton
          label="START BATTLE"
          onPress={onStart}
          colors={['#7A0EED', '#C0186A', '#F5A623']}
          iconNode={<Text style={{ fontSize: 18 }}>⚔️</Text>}
          height={52}
          borderRadius={14}
          fontSize={16}
          textStyle={{ fontWeight: '900', letterSpacing: 1.2 }}
        />
        <View style={s.fairRow}>
          <Ionicons name="shield-checkmark-outline" size={13} color="#9B6FE0" />
          <Text style={s.fairText}>Fair Battle System  •  Real-time Results</Text>
        </View>
      </View>
    </View>
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
          <Ionicons name="chatbubbles-outline" size={40} color="#DDDAE8" />
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
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  sheetDark: { backgroundColor: '#0F1225' },
  handleArea: { alignItems: 'center', paddingTop: 10, paddingBottom: 2 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#DDDAE8' },
  handleDark: { backgroundColor: 'rgba(255,255,255,0.15)' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 8,
  },
  headerBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: {
    flex: 1, textAlign: 'center',
    fontSize: 18, fontWeight: '900', color: '#1C1E22', letterSpacing: 1.5,
  },
  titleDark: { color: '#FFFFFF' },
  waitingClose: {
    position: 'absolute', top: 14, right: 16, zIndex: 10,
    width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
  },

  toastBanner: {
    marginHorizontal: 20, marginBottom: 8,
    backgroundColor: '#ECFDF5', borderRadius: 10,
    paddingVertical: 8, paddingHorizontal: 14,
    borderWidth: 1, borderColor: '#6EE7B7',
  },
  toastText: { fontSize: 13, fontWeight: '600', color: '#065F46', textAlign: 'center' },

  scrollContent: { paddingHorizontal: 16, paddingBottom: 8 },

  setupWrap: { flex: 1, paddingHorizontal: 16, justifyContent: 'space-between' },

  // VS hero
  vsRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', marginBottom: 10, gap: 20
  },
  avatarCol: { alignItems: 'center', gap: 5 },
  avatarRing: {
    width: 68, height: 68, borderRadius: 34,
    borderWidth: 2, borderColor: '#7A0EED',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F3EEFF',
  },
  avatar: {
    width: 58, height: 58, borderRadius: 29,
    overflow: 'hidden', backgroundColor: '#7A0EED',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarImg: { width: 58, height: 58 },
  avatarRingDashed: {
    width: 68, height: 68, borderRadius: 34,
    borderWidth: 2, borderColor: '#C084FC',
    borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FAFAFF',
  },
  plusSign: { fontSize: 26, color: '#C084FC', fontWeight: '300' },
  youBadge: {
    backgroundColor: '#7A0EED',
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20,
  },
  opponentBadge: { backgroundColor: '#EC4899' },
  youBadgeText: { fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },

  // Mode tabs
  modeTabRow: {
    flexDirection: 'row', backgroundColor: '#F3EEFF',
    borderRadius: 12, padding: 3, marginBottom: 12,
  },
  modeTab: { flex: 1, borderRadius: 10, overflow: 'hidden' },
  modeTabInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingVertical: 10, borderRadius: 10,
    shadowColor: '#7A0EED', shadowOpacity: 0.3, shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  modeTabInnerInactive: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingVertical: 10, borderRadius: 10,
  },
  modeTabActive: {},
  modeTabGiftingActive: {},
  modeTabText: { fontSize: 11, fontWeight: '700', color: '#9B6FE0', letterSpacing: 0.3 },
  modeTabTextActive: { color: '#FFFFFF' },
  giftEmoji: { fontSize: 12 },

  // Section header
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
  sectionIcon: { fontSize: 14 },
  sectionTitle: { fontSize: 12, fontWeight: '800', color: '#7A0EED', letterSpacing: 0.5 },
  sectionSub: { fontSize: 11, fontWeight: '500', color: '#9B6FE0' },

  // Time chips — bigger, more readable
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  timeChip: {
    width: 58, height: 58, borderRadius: 29,
    borderWidth: 1.5, borderColor: '#E8D5FF',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fff', overflow: 'hidden',
  },
  timeChipActive: {
    borderColor: '#7A0EED',
    shadowColor: '#7A0EED', shadowOpacity: 0.4, shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 }, elevation: 5,
  },
  timeChipGradient: {
    width: 58, height: 58, borderRadius: 29,
    alignItems: 'center', justifyContent: 'center',
  },
  timeChipNum: { fontSize: 16, fontWeight: '800', color: '#333', lineHeight: 20 },
  timeChipNumActive: { color: '#fff' },
  timeChipUnit: { fontSize: 9, fontWeight: '600', color: '#ABADB2', lineHeight: 11 },
  timeChipUnitActive: { color: 'rgba(255,255,255,0.8)' },

  // Target row (horizontal scroll) — shorter chips
  targetRow: { flexDirection: 'row', gap: 8, paddingBottom: 4, paddingHorizontal: 2 },
  targetChip: {
    width: 66, paddingVertical: 7, paddingHorizontal: 4,
    borderRadius: 10, borderWidth: 1.5, borderColor: '#E8D5FF',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fff', position: 'relative',
  },
  targetChipActive: { borderColor: '#7A0EED', borderWidth: 2 },
  targetCheck: {
    position: 'absolute', top: 4, right: 4,
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: '#7A0EED', alignItems: 'center', justifyContent: 'center',
  },
  coinEmoji: { fontSize: 18, marginBottom: 2 },
  targetCustomIcon: { fontSize: 18, marginBottom: 2 },
  targetLabel: { fontSize: 12, fontWeight: '800', color: '#1C1E22' },
  targetLabelActive: { color: '#7A0EED' },
  targetSub: { fontSize: 10, fontWeight: '500', color: '#ABADB2' },
  targetSubActive: { color: '#9B6FE0' },

  infoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#F7F3FF', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 7, marginBottom: 0,
  },
  infoText: { fontSize: 11, color: '#7A0EED', fontWeight: '500', flex: 1 },

  // Bottom area — tight, no extra gap
  bottomArea: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, gap: 8 },
  fairRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  fairText: { fontSize: 11, color: '#9B6FE0', fontWeight: '500' },
});

const inv = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyText: { fontSize: 14, color: '#ABADB2', fontWeight: '500' },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 20, marginBottom: 10,
    backgroundColor: '#F7F5FF', borderRadius: 12,
    borderWidth: 1, borderColor: '#E8E6F0',
    paddingHorizontal: 12, paddingVertical: 8, gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#1C1E22', paddingVertical: 0 },
  list: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 16 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: '#F0EDF8' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  roomAvatarFallback: { backgroundColor: '#EDE8F7', alignItems: 'center', justifyContent: 'center' },
  roomAvatarInitial: { fontWeight: '700', color: '#7A0EED' },
  roomName: { flex: 1, fontSize: 14, fontWeight: '600', color: '#1C1E22' },
  inviteBtn: {
    paddingHorizontal: 18, paddingVertical: 8,
    borderRadius: 20, backgroundColor: '#7A0EED',
    minWidth: 72, alignItems: 'center',
  },
  invitedBtn: { backgroundColor: '#F3EEFF', borderWidth: 1, borderColor: '#7A0EED' },
  sendingBtn: { backgroundColor: '#F3EEFF', borderWidth: 1, borderColor: '#7A0EED' },
  inviteBtnText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  invitedBtnText: { color: '#7A0EED' },
});

// ── Waiting page ──────────────────────────────────────────────────────────────

function WaitingPage({
  invite, onStart, onGoBack, battleMode, selectedTarget,
}: {
  invite: InviteDetail;
  onStart: () => void;
  onGoBack: () => void;
  battleMode: BattleMode;
  selectedTarget: number;
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
  const targetLabel = selectedTarget >= 1000 ? `${selectedTarget / 1000}K` : String(selectedTarget);
  const OWN_FRAME  = require('@/assets/tabs/chatroom/battleownframe.png');
  const OPP_FRAME  = require('@/assets/tabs/chatroom/battleaoppfrme.png');

  return (
    <View style={w.outer}>

      {/* ── PENDING badge row ── */}
      <View style={w.badgeRow}>
        <Text style={w.star}>★</Text>
        <View style={[w.badge, isAccepted ? w.badgeAccepted : isDeclined ? w.badgeDeclined : w.badgePending]}>
          <Text style={[w.badgeText, isAccepted ? w.badgeTextAccepted : isDeclined ? w.badgeTextDeclined : null]}>
            {isAccepted ? 'ACCEPTED' : isDeclined ? 'DECLINED' : 'PENDING'}
          </Text>
        </View>
        <Text style={w.star}>★</Text>
      </View>

      {/* ── Title ── */}
      <Text style={w.titleMain}>{invite.duration_minutes} MIN BATTLE</Text>

      {/* ── Target chip (gifting mode) ── */}
      {battleMode === 'gifting' && (
        <View style={w.targetChip}>
          <Text style={w.targetChipText}>🪙 {targetLabel} Coins Target</Text>
        </View>
      )}

      {/* ── VS arena ── */}
      <View style={w.vsRow}>
        {/* Left room */}
        <View style={w.roomCol}>
          <View style={w.frameWrap}>
            {fromImg
              ? <Image source={{ uri: fromImg }} style={w.avatar} />
              : <View style={[w.avatar, w.avatarFallbackBlue]}>
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
              ? <Image source={{ uri: toImg }} style={w.avatar} />
              : <View style={[w.avatar, w.avatarFallbackGold]}>
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
              ? '🎉 Accepted! Ready to start.'
              : '❌ Invite was declined.'}
        </Text>
        {isPending && <Text style={w.countdownText}>{countdown}s</Text>}
      </View>

      {/* ── Actions ── */}
      {isAccepted && (
        <GradientButton
          label="START BATTLE"
          onPress={onStart}
          colors={['#7A0EED', '#C0186A', '#F5A623']}
          iconNode={<Text style={{ fontSize: 16 }}>⚔️</Text>}
          height={52}
          borderRadius={14}
          fontSize={16}
          textStyle={{ fontWeight: '900', letterSpacing: 1 }}
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

const w = StyleSheet.create({
  // full-height container — no background (sheet is dark navy)
  outer: {
    flex: 1, alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12, gap: 12,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // ── PENDING badge row ──
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 44 },
  star: { fontSize: 14, color: '#D97706' },
  badge: { paddingHorizontal: 16, paddingVertical: 5, borderRadius: 20, borderWidth: 1.5 },
  badgePending:  { backgroundColor: '#FFF8EC', borderColor: '#F5A623' },
  badgeAccepted: { backgroundColor: '#ECFDF5', borderColor: '#16A34A' },
  badgeDeclined: { backgroundColor: '#FEF2F2', borderColor: '#DC2626' },
  badgeText: { fontSize: 13, fontWeight: '900', color: '#D97706', letterSpacing: 1.5 },
  badgeTextAccepted: { color: '#16A34A' },
  badgeTextDeclined: { color: '#DC2626' },

  // ── Title ──
  titleMain: { fontSize: 24, fontWeight: '900', color: '#1C1E22', letterSpacing: 1 },

  // ── Target chip ──
  targetChip: {
    backgroundColor: '#F3EEFF', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 5,
    borderWidth: 1, borderColor: '#E8D5FF',
  },
  targetChipText: { fontSize: 13, fontWeight: '700', color: '#7A0EED' },

  // ── VS arena row ──
  vsRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', width: '100%',
  },
  roomCol: { alignItems: 'center', gap: 6, flex: 1 },

  // frame + avatar — avatar sits centered, frame overlays on top
  frameWrap: {
    width: 140, height: 140,
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  // avatar sits in upper portion of the shield frame
  avatar: { width: 100, height: 110, borderRadius: 50, position: 'absolute', top: 12 },
  avatarFallbackBlue:   { backgroundColor: '#1A3BB5', alignItems: 'center', justifyContent: 'center' },
  avatarFallbackPurple: { backgroundColor: '#6D28D9', alignItems: 'center', justifyContent: 'center' },
  avatarFallbackGold:   { backgroundColor: '#B45309', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 32, fontWeight: '900', color: '#FFFFFF' },
  // frame overlays exactly the frameWrap size
  frame: { width: 140, height: 140, position: 'absolute', top: 0, left: 0 },

  // ribbon
  ribbon: {
    alignSelf: 'stretch', borderRadius: 10,
    paddingVertical: 8, paddingHorizontal: 10,
    alignItems: 'center',
  },
  ribbonUsername: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
  ribbonSub: { fontSize: 11, fontWeight: '500', color: 'rgba(255,255,255,0.75)' },

  // VS image
  vsImg: { width: 70, height: 56, marginHorizontal: 2 },

  // ── Status bar ──
  statusBar: {
    marginTop: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, width: '100%', borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 12,
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
  timerEmoji: { fontSize: 22 },
  countdownText: { fontSize: 14, fontWeight: '900', color: '#D97706', minWidth: 30, textAlign: 'right' },

  // ── Decline close button ──
  closeBtn: {
    width: '100%', paddingVertical: 14, borderRadius: 14,
    borderWidth: 1.5, borderColor: '#EDE8F7',
    alignItems: 'center', backgroundColor: '#FAFAFF',
  },
  closeBtnText: { fontSize: 14, fontWeight: '700', color: '#60626A' },
});
