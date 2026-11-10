import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { ModalBottomSheet, ModalSafeArea } from '@/components/ModalBottomSheet';
import type { BattleResult } from '@/store/socket-store';
import { avatarSource } from '@/utils/default-avatar';
import { RC } from '../room-ui';
import { resolveUrl } from './battle-result-parts';
import { GiftingBattleResultCard } from './gifting-battle-result';
import { NormalBattleResultCard } from './normal-battle-result';

/*
 * The battle popup: the battle-in-progress sheet, and the result card when a
 * battle ends — normal-battle-result.tsx or gifting-battle-result.tsx by the
 * battle's mode (shared parts in battle-result-parts.tsx).
 */

const COIN_IMG = require('@/assets/tabs/coin.png');

// Battle-in-progress sheet: same side colours as the battle banner (own blue, rival red).
const OWN_COLOR = '#246CDE';
const RIVAL_COLOR = '#DE2850';

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
  /** Not used by the cards (kept for the caller) */
  myUserId?: string;
  onCloseStatus: () => void;
  onCloseResult: () => void;
};

export function BattleOverlay({ status, result, roomId, onCloseStatus, onCloseResult }: BattleOverlayProps) {
  const ResultCard = result?.mode === 'gifting' ? GiftingBattleResultCard : NormalBattleResultCard;
  return (
    <Modal
      visible={!!result || !!status}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={result ? onCloseResult : onCloseStatus}>
      {result
        ? <ResultCard result={result} roomId={roomId} onClose={onCloseResult} />
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
});
