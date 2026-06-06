import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BASE_URL, MEDIA_BASE } from '@/services/api';
import { authStore } from '@/store/auth-store';
import { subscribeSocket, getSocketState } from '@/store/socket-store';

// ── Types ──────────────────────────────────────────────────────────────────────

type InviteDetail = {
  id: string;
  duration_minutes: number;
  from_room_id: string;
  to_room_id: string;
  from_room_name: string;
  from_room_image_url: string | null;
  to_room_name: string;
  to_room_image_url: string | null;
  from_host_name: string | null;
  from_host_username: string | null;
  from_host_avatar_url: string | null;
  to_host_name: string | null;
  to_host_username: string | null;
  to_host_avatar_url: string | null;
  from_host_user_id?: string;
  to_host_user_id?: string;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function resolveUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.startsWith('http') ? url : `${MEDIA_BASE}/${url.replace(/^\//, '')}`;
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatCoins(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

// Extract coin/recipient data from an already-parsed gift ChatMessage
function giftCoinsFromMsg(msg: { type: string; giftCoins?: number; giftQty?: number; giftRecipientId?: string }): { recipientId: string; coins: number } | null {
  if (msg.type !== 'gift') return null;
  if (!msg.giftRecipientId || !msg.giftCoins) return null;
  return { recipientId: msg.giftRecipientId, coins: msg.giftCoins * (msg.giftQty ?? 1) };
}

// ── Avatar ─────────────────────────────────────────────────────────────────────

function Avatar({ url, name, size = 72 }: { url: string | null; name: string; size?: number }) {
  const resolved = resolveUrl(url);
  if (resolved) {
    return <Image source={{ uri: resolved }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#EDE8F7', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size * 0.38, fontWeight: '800', color: '#7A0EED' }}>{name[0]?.toUpperCase() ?? '?'}</Text>
    </View>
  );
}

// ── Room panel (live) ──────────────────────────────────────────────────────────

function RoomPanel({
  side, name, hostName, avatarUrl, roomImageUrl, coins, isWinner, isLoser, isFinished,
}: {
  side: 'left' | 'right';
  name: string;
  hostName: string;
  avatarUrl: string | null;
  roomImageUrl: string | null;
  coins: number;
  isWinner: boolean;
  isLoser: boolean;
  isFinished: boolean;
}) {
  const isLeft = side === 'left';
  const accentColor = isLeft ? '#3B82F6' : '#F59E0B';
  const coinScaleAnim = useRef(new Animated.Value(1)).current;
  const prevCoins = useRef(coins);

  useEffect(() => {
    if (coins !== prevCoins.current) {
      prevCoins.current = coins;
      Animated.sequence([
        Animated.timing(coinScaleAnim, { toValue: 1.3, duration: 120, useNativeDriver: true }),
        Animated.timing(coinScaleAnim, { toValue: 1,   duration: 120, useNativeDriver: true }),
      ]).start();
    }
  }, [coins]);

  return (
    <View style={[
      lp.panel,
      { borderColor: accentColor },
      isWinner && lp.panelWinner,
      isLoser  && lp.panelLoser,
    ]}>
      {isWinner && (
        <View style={lp.crownRow}>
          <Text style={lp.crownText}>🏆 WINNER</Text>
        </View>
      )}
      {isLoser && (
        <View style={[lp.crownRow, { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
          <Text style={[lp.crownText, { color: 'rgba(255,255,255,0.4)' }]}>RUNNER UP</Text>
        </View>
      )}

      {/* Room image small badge */}
      <Avatar url={roomImageUrl || avatarUrl} name={name} size={60} />

      <Text style={lp.roomName} numberOfLines={2}>{name}</Text>

      {/* Host avatar + name */}
      <View style={lp.hostRow}>
        <Avatar url={avatarUrl} name={hostName} size={28} />
        <Text style={lp.hostName} numberOfLines={1}>{hostName}</Text>
      </View>

      {/* Coin count */}
      <Animated.View style={[lp.coinBox, { borderColor: accentColor + '66', backgroundColor: accentColor + '22' }, { transform: [{ scale: coinScaleAnim }] }]}>
        <Text style={lp.coinEmoji}>🪙</Text>
        <Text style={[lp.coinCount, { color: accentColor === '#3B82F6' ? '#93C5FD' : '#FCD34D' }]}>
          {formatCoins(coins)}
        </Text>
        <Text style={lp.coinLabel}>coins</Text>
      </Animated.View>
    </View>
  );
}

// ── Summary screen ─────────────────────────────────────────────────────────────

function SummaryScreen({
  invite,
  leftCoins,
  rightCoins,
  duration,
  onClose,
}: {
  invite: InviteDetail;
  leftCoins: number;
  rightCoins: number;
  duration: number;
  onClose: () => void;
}) {
  const tied = leftCoins === rightCoins;
  const leftWins = leftCoins > rightCoins;

  const winnerName  = tied ? 'Both rooms' : leftWins ? invite.from_room_name : invite.to_room_name;
  const winnerHost  = tied ? '' : leftWins ? (invite.from_host_name ?? invite.from_host_username ?? 'Host') : (invite.to_host_name ?? invite.to_host_username ?? 'Host');
  const winnerImg   = tied ? null : leftWins ? invite.from_room_image_url : invite.to_room_image_url;
  const winnerAvatar = tied ? null : leftWins ? invite.from_host_avatar_url : invite.to_host_avatar_url;
  const loserName   = leftWins ? invite.to_room_name   : invite.from_room_name;
  const loserHost   = leftWins ? (invite.to_host_name ?? invite.to_host_username ?? 'Host') : (invite.from_host_name ?? invite.from_host_username ?? 'Host');
  const loserImg    = leftWins ? invite.to_room_image_url : invite.from_room_image_url;
  const loserAvatar  = leftWins ? invite.to_host_avatar_url : invite.from_host_avatar_url;
  const winnerCoins = leftWins ? leftCoins : rightCoins;
  const loserCoins  = leftWins ? rightCoins : leftCoins;

  return (
    <View style={sum.overlay}>
      <ScrollView contentContainerStyle={sum.scroll} showsVerticalScrollIndicator={false}>
        <Text style={sum.title}>{tied ? "It's a Tie! 🤝" : "Battle Over! ⚔️"}</Text>
        <Text style={sum.sub}>Duration: {Math.floor(duration / 60)}m {duration % 60}s</Text>

        {/* Winner card */}
        <View style={sum.winnerCard}>
          <LinearGradient
            colors={['#7A0EED', '#B50357']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={sum.winnerGradient}>
            <Text style={sum.winnerBadge}>{tied ? '🤝 TIE' : '🏆 WINNER'}</Text>
            <Avatar url={winnerImg || winnerAvatar} name={winnerName} size={80} />
            <Text style={sum.winnerName}>{winnerName}</Text>
            {winnerHost ? <Text style={sum.winnerHost}>{winnerHost}</Text> : null}
            <View style={sum.winnerCoinRow}>
              <Text style={sum.winnerCoinEmoji}>🪙</Text>
              <Text style={sum.winnerCoins}>{winnerCoins.toLocaleString()}</Text>
              <Text style={sum.winnerCoinLabel}> coins received</Text>
            </View>
          </LinearGradient>
        </View>

        {/* Loser card (only when not tied) */}
        {!tied && (
          <View style={sum.loserCard}>
            <Text style={sum.loserBadge}>🥈 RUNNER UP</Text>
            <View style={sum.loserRow}>
              <Avatar url={loserImg || loserAvatar} name={loserName} size={52} />
              <View style={sum.loserInfo}>
                <Text style={sum.loserName}>{loserName}</Text>
                <Text style={sum.loserHost}>{loserHost}</Text>
              </View>
              <View style={sum.loserCoinBox}>
                <Text style={sum.loserCoinEmoji}>🪙</Text>
                <Text style={sum.loserCoins}>{loserCoins.toLocaleString()}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Stats row */}
        <View style={sum.statsRow}>
          <View style={sum.statBox}>
            <Text style={sum.statVal}>{(leftCoins + rightCoins).toLocaleString()}</Text>
            <Text style={sum.statLabel}>Total Coins</Text>
          </View>
          <View style={sum.statDivider} />
          <View style={sum.statBox}>
            <Text style={sum.statVal}>{Math.floor(duration / 60)}m</Text>
            <Text style={sum.statLabel}>Duration</Text>
          </View>
          <View style={sum.statDivider} />
          <View style={sum.statBox}>
            <Text style={sum.statVal}>{tied ? '50/50' : leftWins ? `${Math.round(leftCoins / (leftCoins + rightCoins) * 100)}%` : `${Math.round(rightCoins / (leftCoins + rightCoins) * 100)}%`}</Text>
            <Text style={sum.statLabel}>Win Rate</Text>
          </View>
        </View>

        <TouchableOpacity style={sum.closeBtn} onPress={onClose} activeOpacity={0.85}>
          <LinearGradient colors={['#4B00E8', '#B40CF0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={sum.closeBtnGrad}>
            <Text style={sum.closeBtnText}>Back to Room</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────

export function BattleLiveScreen() {
  const { inviteId } = useLocalSearchParams<{ inviteId: string }>();

  const [invite, setInvite]         = useState<InviteDetail | null>(null);
  const [loading, setLoading]       = useState(true);
  const [leftCoins, setLeftCoins]   = useState(0);
  const [rightCoins, setRightCoins] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [showSummary, setShowSummary] = useState(false);

  const pulseAnim  = useRef(new Animated.Value(1)).current;
  const inviteRef  = useRef<InviteDetail | null>(null);
  const seenMsgIds = useRef(new Set<string>());

  // Fetch invite
  useEffect(() => {
    if (!inviteId) return;
    const token = authStore.getToken();
    fetch(`${BASE_URL}/battle/invite/${inviteId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.json())
      .then(json => {
        if (json.success) {
          setInvite(json.data);
          inviteRef.current = json.data;
          const secs = json.data.duration_minutes * 60;
          setSecondsLeft(secs);
          setTotalDuration(secs);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [inviteId]);

  // Listen to socket for gift messages → accumulate coins per side
  useEffect(() => {
    const unsub = subscribeSocket(() => {
      const { messages } = getSocketState();
      const inv = inviteRef.current;
      if (!inv) return;

      messages.forEach(msg => {
        if (seenMsgIds.current.has(msg.id)) return;

        const parsed = giftCoinsFromMsg(msg);
        if (!parsed) return;

        seenMsgIds.current.add(msg.id);

        // Attribute coins to the side whose host received them
        if (inv.from_host_user_id && parsed.recipientId === inv.from_host_user_id) {
          setLeftCoins(n => n + parsed.coins);
        } else if (inv.to_host_user_id && parsed.recipientId === inv.to_host_user_id) {
          setRightCoins(n => n + parsed.coins);
        }
      });
    });
    return unsub;
  }, []);

  // Countdown
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) { clearInterval(id); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [secondsLeft > 0]);

  // Show summary when time runs out
  useEffect(() => {
    if (secondsLeft === 0 && totalDuration > 0 && !loading) {
      const t = setTimeout(() => setShowSummary(true), 600);
      return () => clearTimeout(t);
    }
  }, [secondsLeft, totalDuration, loading]);

  // VS pulse
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.18, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 600, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  const total    = leftCoins + rightCoins;
  const leftPct  = total === 0 ? 0.5 : leftCoins  / total;
  const rightPct = total === 0 ? 0.5 : rightCoins / total;
  const isFinished = secondsLeft === 0 && totalDuration > 0;

  const leftWins  = isFinished && leftCoins  > rightCoins;
  const rightWins = isFinished && rightCoins > leftCoins;
  const tied      = isFinished && leftCoins  === rightCoins;

  const leftName   = invite?.from_room_name ?? 'Challenger';
  const rightName  = invite?.to_room_name   ?? 'Defender';
  const leftHost   = invite?.from_host_name ?? invite?.from_host_username ?? 'Host';
  const rightHost  = invite?.to_host_name   ?? invite?.to_host_username   ?? 'Host';

  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.center}>
          <Text style={s.loadingText}>Loading battle…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color="#7A0EED" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>⚔️  Battle Live</Text>
        {invite ? (
          <TouchableOpacity
            style={s.goChatBtn}
            activeOpacity={0.85}
            hitSlop={6}
            onPress={() => router.replace(`/room/${invite.from_room_id}` as any)}>
            <Ionicons name="chatbubbles-outline" size={14} color="#7A0EED" />
            <Text style={s.goChatText}>Chat</Text>
          </TouchableOpacity>
        ) : (
          <View style={s.backBtn} />
        )}
      </View>

      {/* Timer */}
      <View style={s.timerRow}>
        <View style={[s.timerPill, isFinished && s.timerPillDone]}>
          <Ionicons
            name={isFinished ? 'checkmark-circle' : 'time-outline'}
            size={16}
            color={isFinished ? '#22C55E' : '#7A0EED'}
          />
          <Text style={[s.timerText, isFinished && s.timerTextDone]}>
            {isFinished ? 'FINISHED' : formatTime(secondsLeft)}
          </Text>
        </View>
        {!isFinished && (
          <Text style={s.timerSub}>
            of {Math.floor(totalDuration / 60)}m {totalDuration % 60 > 0 ? `${totalDuration % 60}s` : ''}
          </Text>
        )}
      </View>

      {/* Room panels */}
      <View style={s.panelsRow}>
        <RoomPanel
          side="left"
          name={leftName}
          hostName={leftHost}
          avatarUrl={invite?.from_host_avatar_url ?? null}
          roomImageUrl={invite?.from_room_image_url ?? null}
          coins={leftCoins}
          isWinner={leftWins}
          isLoser={rightWins}
          isFinished={isFinished}
        />

        {/* VS */}
        <View style={s.vsCol}>
          <View style={s.vsLine} />
          <Animated.View style={[s.vsChip, { transform: [{ scale: pulseAnim }] }]}>
            <Text style={s.vsText}>VS</Text>
          </Animated.View>
          <View style={s.vsLine} />
        </View>

        <RoomPanel
          side="right"
          name={rightName}
          hostName={rightHost}
          avatarUrl={invite?.to_host_avatar_url ?? null}
          roomImageUrl={invite?.to_room_image_url ?? null}
          coins={rightCoins}
          isWinner={rightWins}
          isLoser={leftWins}
          isFinished={isFinished}
        />
      </View>

      {/* Progress bar */}
      <View style={s.progressWrap}>
        <View style={s.progressTrack}>
          <View style={[s.progressLeft, { flex: leftPct }]} />
          <View style={s.progressMiddle}>
            <Text style={s.progressEmoji}>⚡</Text>
          </View>
          <View style={[s.progressRight, { flex: rightPct }]} />
        </View>
        <View style={s.progressPcts}>
          <Text style={s.pctLeft}>{Math.round(leftPct * 100)}%</Text>
          <Text style={s.pctRight}>{Math.round(rightPct * 100)}%</Text>
        </View>
      </View>

      {/* Total coins bar */}
      <View style={s.totalRow}>
        <Text style={s.totalLabel}>Total gifts received</Text>
        <View style={s.totalCoins}>
          <Text style={s.totalCoinEmoji}>🪙</Text>
          <Text style={s.totalCoinVal}>{(leftCoins + rightCoins).toLocaleString()}</Text>
        </View>
      </View>

      {/* Live / finished badge */}
      <View style={s.statusRow}>
        {isFinished ? (
          <TouchableOpacity
            style={s.summaryBtn}
            activeOpacity={0.85}
            onPress={() => setShowSummary(true)}>
            <LinearGradient colors={['#4B00E8', '#B40CF0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.summaryBtnGrad}>
              <Text style={s.summaryBtnText}>View Results 🏆</Text>
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <View style={s.livePill}>
            <View style={s.liveDot} />
            <Text style={s.liveText}>Battle in progress</Text>
          </View>
        )}
      </View>

      {/* Summary overlay */}
      {showSummary && invite && (
        <SummaryScreen
          invite={invite}
          leftCoins={leftCoins}
          rightCoins={rightCoins}
          duration={totalDuration}
          onClose={() => { setShowSummary(false); router.back(); }}
        />
      )}
    </SafeAreaView>
  );
}

// ── Room panel styles ──────────────────────────────────────────────────────────
const lp = StyleSheet.create({
  panel: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#EDE8F7',
    padding: 14,
    alignItems: 'center',
    gap: 8,
    overflow: 'hidden',
    shadowColor: '#7A0EED',
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  panelWinner: {
    backgroundColor: '#F4EEFF',
    borderColor: '#A855F7',
  },
  panelLoser: {
    opacity: 0.55,
  },
  crownRow: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: 'rgba(122,14,237,0.12)',
    paddingVertical: 3,
    borderRadius: 8,
    marginBottom: 2,
  },
  crownText: {
    fontSize: 9, fontWeight: '800', color: '#7A0EED', letterSpacing: 0.8,
  },
  roomName: {
    fontSize: 12, fontWeight: '700', color: '#1C1E22', textAlign: 'center', lineHeight: 16,
  },
  hostRow: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
  },
  hostName: {
    fontSize: 10, color: '#ABADB2', fontWeight: '500', flex: 1,
  },
  coinBox: {
    alignItems: 'center',
    borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 10, paddingVertical: 6,
    marginTop: 2,
  },
  coinEmoji: { fontSize: 16 },
  coinCount: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  coinLabel: { fontSize: 9, color: '#ABADB2', fontWeight: '600', letterSpacing: 0.4 },
});

// ── Summary styles ─────────────────────────────────────────────────────────────
const sum = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#F5F3FA',
    zIndex: 20,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 36,
    alignItems: 'center',
    gap: 16,
  },
  title: {
    fontSize: 28, fontWeight: '900', color: '#1C1E22', letterSpacing: -0.5, textAlign: 'center',
  },
  sub: {
    fontSize: 13, color: '#ABADB2', fontWeight: '500',
  },
  winnerCard: {
    width: '100%', borderRadius: 24, overflow: 'hidden',
    shadowColor: '#7A0EED', shadowOpacity: 0.3, shadowRadius: 20, shadowOffset: { width: 0, height: 6 }, elevation: 10,
  },
  winnerGradient: {
    alignItems: 'center', paddingVertical: 24, paddingHorizontal: 20, gap: 8,
  },
  winnerBadge: {
    fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.9)', letterSpacing: 1.2,
    backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 12, paddingVertical: 3, borderRadius: 10,
  },
  winnerName: {
    fontSize: 20, fontWeight: '900', color: '#FFFFFF', textAlign: 'center', letterSpacing: -0.3,
  },
  winnerHost: {
    fontSize: 12, color: 'rgba(255,255,255,0.75)',
  },
  winnerCoinRow: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4,
    backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 6,
  },
  winnerCoinEmoji: { fontSize: 18 },
  winnerCoins: { fontSize: 22, fontWeight: '900', color: '#FFFFFF' },
  winnerCoinLabel: { fontSize: 13, color: 'rgba(255,255,255,0.8)' },

  loserCard: {
    width: '100%', backgroundColor: '#FFFFFF',
    borderRadius: 18, padding: 14, borderWidth: 1, borderColor: '#EDE8F7',
    shadowColor: '#7A0EED', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  loserBadge: {
    fontSize: 10, fontWeight: '700', color: '#ABADB2', letterSpacing: 0.8, marginBottom: 8,
  },
  loserRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  loserInfo: { flex: 1 },
  loserName: { fontSize: 14, fontWeight: '700', color: '#1C1E22' },
  loserHost: { fontSize: 11, color: '#ABADB2' },
  loserCoinBox: { alignItems: 'center' },
  loserCoinEmoji: { fontSize: 14 },
  loserCoins: { fontSize: 16, fontWeight: '800', color: '#60626A' },

  statsRow: {
    width: '100%', flexDirection: 'row',
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#EDE8F7',
    shadowColor: '#7A0EED', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  statBox: { flex: 1, alignItems: 'center', gap: 4 },
  statDivider: { width: 1, backgroundColor: '#EDE8F7' },
  statVal: { fontSize: 18, fontWeight: '900', color: '#1C1E22' },
  statLabel: { fontSize: 10, color: '#ABADB2', fontWeight: '600' },

  closeBtn: { width: '100%', borderRadius: 16, overflow: 'hidden', marginTop: 8 },
  closeBtnGrad: { paddingVertical: 16, alignItems: 'center' },
  closeBtnText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
});

// ── Main screen styles ─────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: '#F5F3FA' },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: '#1C1E22', fontSize: 16, fontWeight: '600' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderBottomColor: '#F0EDF8',
  },
  backBtn:     { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800', color: '#1C1E22' },
  goChatBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F4EEFF', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: '#EDE8F7',
  },
  goChatText: { fontSize: 12, fontWeight: '700', color: '#7A0EED' },

  timerRow: {
    alignItems: 'center', marginTop: 16, marginBottom: 16, gap: 4,
  },
  timerPill: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: '#FFFFFF',
    borderRadius: 24, paddingHorizontal: 20, paddingVertical: 8,
    borderWidth: 1, borderColor: '#EDE8F7',
    shadowColor: '#7A0EED', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  timerPillDone: { backgroundColor: '#F0FDF4', borderColor: '#22C55E' },
  timerText:     { fontSize: 24, fontWeight: '900', color: '#1C1E22', letterSpacing: 3, fontVariant: ['tabular-nums'] },
  timerTextDone: { color: '#22C55E', fontSize: 18 },
  timerSub:      { fontSize: 11, color: '#ABADB2', fontWeight: '500' },

  panelsRow: {
    flexDirection: 'row', paddingHorizontal: 12, gap: 0, marginBottom: 20, alignItems: 'center',
  },

  vsCol: {
    width: 44, alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  vsLine: {
    width: 2, height: 30, backgroundColor: '#EDE8F7', borderRadius: 1,
  },
  vsChip: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#7A0EED',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#7A0EED', shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  vsText: { fontSize: 13, fontWeight: '900', color: '#FFFFFF' },

  progressWrap: { paddingHorizontal: 16, marginBottom: 6 },
  progressTrack: {
    flexDirection: 'row', alignItems: 'center',
    height: 20, borderRadius: 10, overflow: 'hidden',
    backgroundColor: '#EDE8F7',
  },
  progressLeft:   { height: '100%', backgroundColor: '#3B82F6' },
  progressRight:  { height: '100%', backgroundColor: '#F59E0B' },
  progressMiddle: { width: 26, alignItems: 'center', zIndex: 1 },
  progressEmoji:  { fontSize: 14 },
  progressPcts:   { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, paddingHorizontal: 2 },
  pctLeft:        { fontSize: 12, fontWeight: '700', color: '#3B82F6' },
  pctRight:       { fontSize: 12, fontWeight: '700', color: '#F59E0B' },

  totalRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 12, borderRadius: 14, marginBottom: 16,
    borderWidth: 1, borderColor: '#EDE8F7',
    shadowColor: '#7A0EED', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  totalLabel: { fontSize: 12, color: '#ABADB2', fontWeight: '600' },
  totalCoins: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  totalCoinEmoji: { fontSize: 16 },
  totalCoinVal: { fontSize: 18, fontWeight: '900', color: '#1C1E22' },

  statusRow: { alignItems: 'center' },
  livePill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8,
    borderWidth: 1, borderColor: '#EDE8F7',
  },
  liveDot:  { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E' },
  liveText: { fontSize: 13, fontWeight: '600', color: '#1C1E22' },

  summaryBtn: { borderRadius: 14, overflow: 'hidden' },
  summaryBtnGrad: { paddingHorizontal: 32, paddingVertical: 14, alignItems: 'center' },
  summaryBtnText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
});
