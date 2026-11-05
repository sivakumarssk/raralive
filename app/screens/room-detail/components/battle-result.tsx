import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';

import { ModalBottomSheet, ModalSafeArea } from '@/components/ModalBottomSheet';
import { MEDIA_BASE } from '@/services/api';
import type { BattleGifter, BattleResult, BattleResultSide } from '@/store/socket-store';
import { RC } from '../room-ui';
import { avatarSource } from '@/utils/default-avatar';

const COIN_IMG = require('@/assets/tabs/coin.png');

// Same side colours as the battle banner: own room blue, rival red.
const OWN_COLOR = '#246CDE';
const RIVAL_COLOR = '#DE2850';
const WIN_COLOR = '#F5A623';
const DRAW_COLOR = '#7A0EED';

function resolveUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.startsWith('http') ? url : `${MEDIA_BASE}/${url.replace(/^\//, '')}`;
}

function formatCoins(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 10_000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`;
  return String(n);
}

function Avatar({ uri, name, size, ringColor, person = false }: { uri: string | null; name: string; size: number; ringColor: string; person?: boolean }) {
  const ring = Math.max(2, Math.round(size / 24));
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: ring, borderColor: ringColor, overflow: 'hidden' }}>
      {uri || person ? (
        <ExpoImage source={avatarSource(uri)} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFill, s.avatarFallback]}>
          <Text style={[s.avatarInitial, { fontSize: size * 0.38 }]}>{name.trim()[0]?.toUpperCase() ?? '?'}</Text>
        </View>
      )}
    </View>
  );
}

// ── One modal for both views ────────────────────────────────────────────────
// Cancel Battle goes straight from the status sheet to the result. Two RN
// Modals swapping in the same moment is unreliable on iOS (the second may
// never present), so both views share this one Modal.

type BattleOverlayProps = {
  /** Battle-in-progress sheet, or null when it isn't open */
  status: Omit<BattleStatusSheetProps, 'onClose'> | null;
  result: BattleResult | null;
  roomId: string;
  myUserId: string;
  onCloseStatus: () => void;
  onCloseResult: () => void;
};

export function BattleOverlay({ status, result, roomId, myUserId, onCloseStatus, onCloseResult }: BattleOverlayProps) {
  return (
    <Modal
      visible={!!result || !!status}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={result ? onCloseResult : onCloseStatus}>
      {result
        ? <BattleResultCard result={result} roomId={roomId} myUserId={myUserId} onClose={onCloseResult} />
        : status
          ? <BattleStatusSheet {...status} onClose={onCloseStatus} />
          : null}
    </Modal>
  );
}

// ── Battle in progress: both profiles + Cancel Battle ───────────────────────

export type BattleStatusSide = { name: string; imageUrl: string | null; score: number };

type BattleStatusSheetProps = {
  own: BattleStatusSide;
  rival: BattleStatusSide;
  timeDisplay?: string;
  /** Only the two hosts in the battle may cancel it */
  canCancel: boolean;
  cancelling: boolean;
  onCancel: () => void;
  onClose: () => void;
};

function BattleStatusSheet({ own, rival, timeDisplay, canCancel, cancelling, onCancel, onClose }: BattleStatusSheetProps) {
  return (
    <ModalSafeArea>
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose} />
      <ModalBottomSheet style={s.sheet} minPadding={16}>
        <View style={s.handle} />
        <Text style={s.sheetTitle}>Battle in Progress</Text>
        {!!timeDisplay && (
          <View style={s.timerPill}>
            <MaterialCommunityIcons name="timer-sand" size={13} color="#7A0EED" />
            <Text style={s.timerText}>{timeDisplay} left</Text>
          </View>
        )}

        <View style={s.statusRow}>
          <StatusProfile side={own} color={OWN_COLOR} />
          <Text style={s.vs}>VS</Text>
          <StatusProfile side={rival} color={RIVAL_COLOR} />
        </View>

        {canCancel && (
          <TouchableOpacity
            style={[s.cancelBtn, cancelling && s.btnDisabled]}
            onPress={onCancel}
            disabled={cancelling}
            activeOpacity={0.85}>
            {cancelling
              ? <ActivityIndicator size="small" color="#FFFFFF" />
              : <Text style={s.cancelBtnText}>Cancel Battle</Text>}
          </TouchableOpacity>
        )}
        {canCancel && (
          <Text style={s.cancelHint}>The battle ends now and the higher gifting score wins.</Text>
        )}
        <TouchableOpacity style={s.closeBtn} onPress={onClose} activeOpacity={0.7}>
          <Text style={s.closeBtnText}>Close</Text>
        </TouchableOpacity>
      </ModalBottomSheet>
    </ModalSafeArea>
  );
}

function StatusProfile({ side, color }: { side: BattleStatusSide; color: string }) {
  return (
    <View style={s.statusProfile}>
      <Avatar uri={resolveUrl(side.imageUrl)} name={side.name || 'Room'} size={68} ringColor={color} />
      <Text style={s.profileName} numberOfLines={1}>{side.name || 'Room'}</Text>
      <Score value={side.score} />
    </View>
  );
}

/** Coin icon + count on plain white — same look for every score/coin value */
function Score({ value, small }: { value: number; small?: boolean }) {
  return (
    <View style={s.score}>
      <ExpoImage source={COIN_IMG} style={small ? s.scoreCoinSmall : s.scoreCoin} contentFit="contain" />
      <Text style={small ? s.scoreTextSmall : s.scoreText}>{formatCoins(value)}</Text>
    </View>
  );
}

// ── Result ──────────────────────────────────────────────────────────────────

type BattleResultCardProps = {
  result: BattleResult;
  /** The room being viewed — its side is shown on the left */
  roomId: string;
  myUserId: string;
  onClose: () => void;
};

function BattleResultCard({ result, roomId, myUserId, onClose }: BattleResultCardProps) {
  const { width } = useWindowDimensions();

  const ownIsFrom = result.from.room_id === roomId;
  const own = ownIsFrom ? result.from : result.to;
  const rival = ownIsFrom ? result.to : result.from;
  const isDraw = result.winner === null;
  const ownWon = !isDraw && (result.winner === 'from') === ownIsFrom;
  const winnerSide = isDraw ? null : ownWon ? own : rival;

  // Round tally: the winner takes the round; a draw is 0–0 for both
  const ownPoints = ownWon ? 1 : 0;
  const rivalPoints = !isDraw && !ownWon ? 1 : 0;

  const enderName = result.ended_by === myUserId
    ? 'You'
    : [result.from, result.to].find(x => x.host_user_id === result.ended_by)?.host_name ?? 'A host';
  const cardWidth = Math.min(width - 32, 400);

  return (
    <View style={s.resultOverlay}>
      <View style={[s.card, { width: cardWidth }]}>
        <LinearGradient
          colors={isDraw ? ['#7A0EED', '#A35CF5'] : ['#F5A623', '#FF7A45']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={s.cardHeader}>
          <MaterialCommunityIcons name={isDraw ? 'handshake' : 'trophy'} size={30} color="#FFFFFF" />
          <Text style={s.resultTitle}>{isDraw ? 'Draw' : `${winnerSide!.room_name || 'Room'} Wins!`}</Text>
          <Text style={s.resultSub}>
            {result.reason === 'cancelled'
              ? (enderName === 'You' ? 'You cancelled the battle' : `Battle cancelled by ${enderName}`)
              : "Time's up · Final score"}
          </Text>
        </LinearGradient>

        {/* Profiles side by side, tally in the middle */}
        <View style={s.resultRow}>
          <ResultProfile side={own} color={OWN_COLOR} state={isDraw ? 'draw' : ownWon ? 'win' : 'lose'} />
          <View style={s.tally}>
            <Text style={s.tallyText}>{ownPoints}</Text>
            <Text style={s.tallyDash}>–</Text>
            <Text style={s.tallyText}>{rivalPoints}</Text>
          </View>
          <ResultProfile side={rival} color={RIVAL_COLOR} state={isDraw ? 'draw' : ownWon ? 'lose' : 'win'} />
        </View>

        <Text style={s.supportersTitle}>Top 3 Supporters</Text>
        <View style={s.supportersRow}>
          <SupporterColumn side={own} color={OWN_COLOR} highlight={!isDraw && ownWon} />
          <SupporterColumn side={rival} color={RIVAL_COLOR} highlight={!isDraw && !ownWon} />
        </View>

        {result.provisional && <Text style={s.finalizing}>Confirming final result…</Text>}

        <TouchableOpacity style={s.okBtn} onPress={onClose} activeOpacity={0.85}>
          <Text style={s.okBtnText}>OK</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function ResultProfile({ side, color, state }: { side: BattleResultSide; color: string; state: 'win' | 'lose' | 'draw' }) {
  const ring = state === 'win' ? WIN_COLOR : state === 'draw' ? DRAW_COLOR : '#C9CCD3';
  const badge = state === 'win'
    ? { text: 'Win', bg: WIN_COLOR }
    : state === 'lose'
      ? { text: 'Lose', bg: '#9AA0AB' }
      : { text: 'Draw', bg: DRAW_COLOR };
  return (
    <View style={s.resultProfile}>
      <View style={s.crownSlot}>
        {state === 'win' && <MaterialCommunityIcons name="crown" size={26} color={WIN_COLOR} />}
      </View>
      <Avatar uri={resolveUrl(side.room_image_url)} name={side.room_name || 'Room'} size={76} ringColor={ring} />
      <View style={[s.badge, { backgroundColor: badge.bg }]}>
        <Text style={s.badgeText}>{badge.text}</Text>
      </View>
      <Text style={s.profileName} numberOfLines={1}>{side.room_name || 'Room'}</Text>
      {!!side.host_name && <Text style={s.hostName} numberOfLines={1}>{side.host_name}</Text>}
      <Score value={side.score} />
    </View>
  );
}

function SupporterColumn({ side, color, highlight }: { side: BattleResultSide; color: string; highlight: boolean }) {
  return (
    <View style={[s.supporterCol, highlight && s.supporterColWin]}>
      <Text style={[s.supporterColTitle, { color }]} numberOfLines={1}>{side.room_name || 'Room'}</Text>
      {side.supporters.length === 0 ? (
        <Text style={s.noSupporters}>No supporters</Text>
      ) : (
        side.supporters.map((g, i) => <SupporterRow key={g.id} gifter={g} rank={i + 1} />)
      )}
    </View>
  );
}

function SupporterRow({ gifter, rank }: { gifter: BattleGifter; rank: number }) {
  const name = gifter.full_name || gifter.username || 'User';
  return (
    <View style={s.supporterRow}>
      <Text style={s.supporterRank}>{rank}</Text>
      <Avatar uri={resolveUrl(gifter.avatar_url)} name={name} size={26} ringColor="#FFFFFF" person />
      <View style={s.supporterInfo}>
        <Text style={s.supporterName} numberOfLines={1}>{name}</Text>
        <Score value={Number(gifter.total_coins) || 0} small />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  avatarFallback: { backgroundColor: '#B9BCC4', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#FFFFFF', fontWeight: '800' },

  // Status sheet
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingTop: 10,
    alignItems: 'center',
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#DDDAE8', marginBottom: 14 },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: '#1C1E22' },
  timerPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: 8, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 12, backgroundColor: '#F2EAFE',
  },
  timerText: { fontSize: 12, fontWeight: '700', color: '#7A0EED' },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 20, marginBottom: 22 },
  statusProfile: { width: 120, alignItems: 'center' },
  vs: { fontSize: 22, fontWeight: '900', color: '#7A0EED', marginHorizontal: 10, fontStyle: 'italic' },
  profileName: { marginTop: 8, fontSize: 14, fontWeight: '700', color: '#1C1E22', maxWidth: 120, textAlign: 'center' },
  hostName: { marginTop: 1, fontSize: 11, color: '#8A8F99', maxWidth: 120, textAlign: 'center' },
  score: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  scoreCoin: { width: 14, height: 14 },
  scoreCoinSmall: { width: 10, height: 10 },
  scoreText: { fontSize: 14, fontWeight: '800', color: RC.number },
  scoreTextSmall: { fontSize: 11, fontWeight: '700', color: RC.number },
  cancelBtn: {
    alignSelf: 'stretch', height: 48, borderRadius: 24,
    backgroundColor: RIVAL_COLOR, alignItems: 'center', justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  cancelBtnText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  cancelHint: { marginTop: 8, fontSize: 11, color: '#8A8F99', textAlign: 'center' },
  closeBtn: { paddingVertical: 12, paddingHorizontal: 24, marginTop: 2 },
  closeBtnText: { fontSize: 14, fontWeight: '700', color: '#6B7280' },

  // Result card
  resultOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },
  card: { backgroundColor: '#FFFFFF', borderRadius: 24, overflow: 'hidden', paddingBottom: 18 },
  cardHeader: { alignItems: 'center', paddingVertical: 16, paddingHorizontal: 16 },
  resultTitle: { marginTop: 4, fontSize: 20, fontWeight: '900', color: '#FFFFFF', textAlign: 'center' },
  resultSub: { marginTop: 2, fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.9)', textAlign: 'center' },
  resultRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingTop: 6, paddingHorizontal: 8 },
  resultProfile: { flex: 1, alignItems: 'center', maxWidth: 140 },
  crownSlot: { height: 28, justifyContent: 'flex-end' },
  badge: { marginTop: -10, paddingHorizontal: 10, paddingVertical: 2, borderRadius: 9 },
  badgeText: { fontSize: 11, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.5 },
  tally: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 6, marginTop: 16 },
  tallyText: { fontSize: 30, fontWeight: '900', color: RC.number },
  tallyDash: { fontSize: 26, fontWeight: '900', color: '#B9BCC4', marginHorizontal: 6 },
  supportersTitle: { marginTop: 18, marginBottom: 8, fontSize: 14, fontWeight: '800', color: '#1C1E22', textAlign: 'center' },
  supportersRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 14 },
  supporterCol: {
    flex: 1, borderRadius: 14, padding: 10,
    backgroundColor: '#F6F4FB', borderWidth: 1, borderColor: '#EEEAF7',
  },
  supporterColWin: { backgroundColor: '#FFF7E6', borderColor: WIN_COLOR },
  supporterColTitle: { fontSize: 12, fontWeight: '800', marginBottom: 6 },
  noSupporters: { fontSize: 11, color: '#9AA0AB', paddingVertical: 6 },
  supporterRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  supporterRank: { width: 12, fontSize: 12, fontWeight: '800', color: '#8A8F99' },
  supporterInfo: { flex: 1 },
  supporterName: { fontSize: 12, fontWeight: '700', color: '#333333' },
  finalizing: { marginTop: 10, fontSize: 11, color: '#8A8F99', textAlign: 'center' },
  okBtn: {
    marginTop: 16, marginHorizontal: 16, height: 46, borderRadius: 23,
    backgroundColor: '#7A0EED', alignItems: 'center', justifyContent: 'center',
  },
  okBtnText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
});
