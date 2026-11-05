import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { SeatSlot } from '@/hooks/useRoomSocket';
import { MEDIA_BASE } from '@/services/api';

import { SpeakingWaves } from './speaking-waves';
import { RC } from '../room-ui';
import { avatarSource } from '@/utils/default-avatar';

const COIN_IMG = require('@/assets/tabs/coin.png');

export type HostInfo = {
  name: string;
  avatarUri?: string;
  isOnline: boolean;
};

export type SlotLayoutMap = Map<string, { x: number; y: number }>;

export type BattleStageInfo = {
  inviteId: string;
  ownRoomName: string;
  ownRoomImageUrl: string | null;
  rivalRoomName: string;
  rivalRoomImageUrl: string | null;
  timeDisplay: string;
  isFinished: boolean;
  fromRoomId?: string;
  toRoomId?: string;
  fromHostUserId?: string;
  toHostUserId?: string;
  /** 'gifting' battles show each stage profile's coin total; 'normal' battles don't. */
  mode?: 'normal' | 'gifting';
};

type RoomStageProps = {
  hostInfo: HostInfo;
  seats: SeatSlot[];
  isHost: boolean;
  hideEmptySlots: boolean;
  onRequestSeat: (slotIndex: number) => void;
  myUserId?: string;
  isMuted?: boolean;
  onToggleMute?: () => void;
  isHostMuted?: boolean;
  onSlotLayout?: (userId: string, x: number, y: number) => void;
  hostUserId?: string;
  battleInfo?: BattleStageInfo | null;
  coinsByUserId?: Map<string, number>;
  hasRoomBg?: boolean;
  rewardFrameUrl?: string | null;
  /** Parent paints the background (gradient continues up behind the header). */
  transparentBg?: boolean;
  onAvatarPress?: (userId: string, userName: string, avatarUrl: string | null, isRoomHost: boolean, slotIndex?: number) => void;
};

function resolveAvatar(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  try { return `${MEDIA_BASE}${new URL(url).pathname}`; }
  catch { return `${MEDIA_BASE}/${url.replace(/^\//, '')}`; }
}

function formatCoins(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function CoinBadge({ coins }: { coins: number }) {
  return (
    <View style={stage.coinBadge}>
      <Image source={COIN_IMG} style={stage.coinBadgeImg} resizeMode="contain" />
      <Text style={stage.coinBadgeText}>{formatCoins(coins)}</Text>
    </View>
  );
}

function HostSlot({ hostInfo, hostUserId, isHost, isMuted, onToggleMute, onLayout, coins, showCoins, frameUrl, hasRoomBg, onPress }: {
  hostInfo: HostInfo;
  hostUserId?: string;
  isHost: boolean;
  isMuted?: boolean;
  onToggleMute?: () => void;
  onLayout?: (x: number, y: number) => void;
  coins?: number;
  showCoins?: boolean;
  frameUrl?: string | null;
  hasRoomBg?: boolean;
  onPress?: () => void;
}) {
  const avatarContent = (
    <>
      <Image source={avatarSource(hostInfo.avatarUri)} style={stage.hostAvatar} />
      {!hostInfo.isOnline && (
        // Light overlay with a centred lock — the host photo stays visible behind it
        <View style={stage.offlineMask}>
          <Ionicons name="lock-closed" size={18} color="#FFFFFF" style={stage.offlineLock} />
        </View>
      )}
      {/* No mic state while the host is offline — only the lock shows */}
      {isMuted && hostInfo.isOnline && (
        <View style={stage.muteBadge}>
          <Ionicons name="mic-off" size={10} color="#FFFFFF" />
        </View>
      )}
    </>
  );

  const ringStyle = [
    stage.hostAvatarRing,
    hasRoomBg ? stage.hostAvatarRingActive : stage.hostAvatarRingMuted,
    !hostInfo.isOnline && stage.hostAvatarRingOffline,
  ];
  const measureLayout = (ref: View | null) => {
    if (!ref || !onLayout) return;
    ref.measureInWindow((x, y, w, h) => onLayout(x + w / 2, y + h / 2));
  };

  const nameStyle = [
    stage.seatName,
    !hostInfo.isOnline && stage.offlineName,
    hasRoomBg && stage.nameOnBg,
  ];

  return (
    <View style={stage.hostWrap}>
      <View style={stage.ringWrap}>
        {hostUserId && hostInfo.isOnline && (
          <SpeakingWaves userId={hostUserId} size={SEAT_RING} color={waveColor(hasRoomBg)} />
        )}
        {isHost ? (
          <TouchableOpacity ref={measureLayout} onPress={onPress ?? onToggleMute} activeOpacity={0.8} style={ringStyle}>
            {avatarContent}
            {frameUrl && <Image source={{ uri: frameUrl }} style={stage.frameOverlay} resizeMode="contain" />}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity ref={measureLayout} onPress={onPress} activeOpacity={onPress ? 0.8 : 1} disabled={!onPress} style={ringStyle}>
            {avatarContent}
            {frameUrl && <Image source={{ uri: frameUrl }} style={stage.frameOverlay} resizeMode="contain" />}
          </TouchableOpacity>
        )}
      </View>
      <Text style={nameStyle} numberOfLines={1} ellipsizeMode="tail">
        {hostInfo.isOnline ? hostInfo.name : 'Offline'}
      </Text>
      {showCoins && <CoinBadge coins={coins ?? 0} />}
    </View>
  );
}

function OccupiedSlot({ slot, isMe, isMuted, onToggleMute, onLayout, coins, showCoins, hasRoomBg, onPress }: {
  slot: SeatSlot;
  isMe?: boolean;
  isMuted?: boolean;
  onToggleMute?: () => void;
  onLayout?: (x: number, y: number) => void;
  coins?: number;
  showCoins?: boolean;
  hasRoomBg?: boolean;
  onPress?: () => void;
}) {
  const uri = resolveAvatar(slot.avatarUrl);
  const avatar = <Image source={avatarSource(uri)} style={stage.seatAvatar} />;

  const measureLayout = (ref: View | null) => {
    if (!ref || !onLayout) return;
    ref.measureInWindow((x, y, w, h) => onLayout(x + w / 2, y + h / 2));
  };

  const ringStyle = [
    stage.occupiedRing,
    hasRoomBg ? stage.hostAvatarRingActive : stage.hostAvatarRingMuted,
  ];
  const nameStyle = [stage.seatName, hasRoomBg && stage.nameOnBg];

  return (
    <View style={stage.seatWrap}>
      <View style={stage.ringWrap}>
        <SpeakingWaves userId={slot.userId} size={SEAT_RING} color={waveColor(hasRoomBg)} />
        {isMe ? (
          <TouchableOpacity ref={measureLayout} onPress={onPress ?? onToggleMute} activeOpacity={0.8} style={ringStyle}>
            {avatar}
            {isMuted && (
              <View style={stage.muteBadge}>
                <Ionicons name="mic-off" size={10} color="#FFFFFF" />
              </View>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity ref={measureLayout} onPress={onPress} activeOpacity={onPress ? 0.8 : 1} disabled={!onPress} style={ringStyle}>
            {avatar}
            {isMuted && (
              <View style={stage.muteBadge}>
                <Ionicons name="mic-off" size={10} color="#FFFFFF" />
              </View>
            )}
          </TouchableOpacity>
        )}
      </View>
      <Text style={nameStyle} numberOfLines={1} ellipsizeMode="tail">{slot.userName}</Text>
      {showCoins && <CoinBadge coins={coins ?? 0} />}
    </View>
  );
}

function RequestableSlot({ onPress, hasRoomBg }: { onPress: () => void; hasRoomBg?: boolean }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={stage.seatWrap}>
      <View style={[stage.seatCircle, hasRoomBg ? stage.seatCircleGold : stage.seatCircleDefault]}>
        <Ionicons name={hasRoomBg ? 'mic-outline' : 'add'} size={hasRoomBg ? 22 : 26} color={hasRoomBg ? '#FFD700' : '#7A0EED'} />
      </View>
      <View style={stage.requestPill}>
        <Text style={stage.requestPillText}>Request</Text>
      </View>
    </TouchableOpacity>
  );
}

function LockedSlot({ hasRoomBg }: { hasRoomBg?: boolean }) {
  return (
    <View style={stage.seatWrap}>
      <View style={[stage.seatCircle, hasRoomBg ? stage.seatCircleGold : stage.seatCircleDefault]}>
        <Ionicons name={hasRoomBg ? 'mic-outline' : 'add'} size={hasRoomBg ? 22 : 24} color={hasRoomBg ? '#FFD700' : '#BDBDBD'} />
      </View>
      <Text style={[stage.joinLabel, hasRoomBg && stage.joinLabelBg]}>Join</Text>
    </View>
  );
}

// Host offline: seat can't be requested or joined — just a lock
function HostOfflineSlot({ hasRoomBg }: { hasRoomBg?: boolean }) {
  return (
    <View style={stage.seatWrap}>
      <View style={[stage.seatCircle, stage.seatCircleLocked, hasRoomBg && stage.seatCircleLockedBg]}>
        <Ionicons name="lock-closed" size={22} color={hasRoomBg ? '#FFFFFF' : '#ABADB2'} />
      </View>
    </View>
  );
}

// Default stage background — also used by the room screen to continue it up
// behind the header and status bar.
export const STAGE_GRADIENT = ['#DDD5F8', '#EDE8FF', '#F5F2FF'] as const;

const MEMBER_INDICES = [1, 2, 3, 4, 5, 6, 7];

export function RoomStage({
  hostInfo, seats, isHost, hideEmptySlots, onRequestSeat,
  myUserId, onToggleMute, isHostMuted, onSlotLayout, hostUserId,
  battleInfo, coinsByUserId, hasRoomBg, rewardFrameUrl, onAvatarPress, transparentBg,
}: RoomStageProps) {
  const filledMap = new Map(
    seats.filter(s => s.slotIndex !== 0).map(s => [s.slotIndex, s])
  );

  const firstEmptyIndex = MEMBER_INDICES.find(i => !filledMap.has(i)) ?? null;
  // Per-profile coin totals only make sense in a gifting battle — a normal
  // battle scores by total room coins (shown in the VS banner), not by user.
  const showCoins = !!battleInfo && battleInfo.mode === 'gifting';

  function renderMemberSlot(slotIndex: number) {
    const occupied = filledMap.get(slotIndex);
    if (occupied) {
      const isMe = !!myUserId && occupied.userId === myUserId;
      const coins = coinsByUserId?.get(occupied.userId);
      return (
        <OccupiedSlot
          key={slotIndex}
          slot={occupied}
          isMe={isMe}
          isMuted={!!occupied.isMuted}
          onToggleMute={onToggleMute}
          onLayout={onSlotLayout ? (x, y) => onSlotLayout(occupied.userId, x, y) : undefined}
          coins={coins}
          showCoins={showCoins}
          hasRoomBg={hasRoomBg}
          onPress={onAvatarPress ? () => onAvatarPress(occupied.userId, occupied.userName, occupied.avatarUrl, false, slotIndex) : undefined}
        />
      );
    }
    if (!hostInfo.isOnline) return <HostOfflineSlot key={slotIndex} hasRoomBg={hasRoomBg} />;
    if (hideEmptySlots || isHost) return <LockedSlot key={slotIndex} hasRoomBg={hasRoomBg} />;
    if (firstEmptyIndex === null) return null;
    if (slotIndex === firstEmptyIndex) {
      return <RequestableSlot key={slotIndex} onPress={() => onRequestSeat(slotIndex)} hasRoomBg={hasRoomBg} />;
    }
    return <LockedSlot key={slotIndex} hasRoomBg={hasRoomBg} />;
  }

  const row1 = MEMBER_INDICES.slice(0, 3);
  const row2 = MEMBER_INDICES.slice(3, 7);
  const hostCoins = hostUserId ? coinsByUserId?.get(hostUserId) : undefined;

  const stageContent = (
    <>
      <View style={stage.row}>
        <HostSlot
          hostInfo={hostInfo}
          hostUserId={hostUserId}
          isHost={isHost}
          isMuted={isHost ? isHostMuted : !!(seats.find(s => s.slotIndex === 0)?.isMuted)}
          onToggleMute={isHost ? onToggleMute : undefined}
          onLayout={onSlotLayout && hostUserId ? (x, y) => onSlotLayout(hostUserId, x, y) : undefined}
          coins={hostCoins}
          showCoins={showCoins}
          frameUrl={rewardFrameUrl}
          hasRoomBg={hasRoomBg}
          onPress={onAvatarPress && hostUserId ? () => onAvatarPress(hostUserId, hostInfo.name, hostInfo.avatarUri ?? null, true, undefined) : undefined}
        />
        {row1.map(renderMemberSlot)}
      </View>
      <View style={stage.row}>
        {row2.map(renderMemberSlot)}
      </View>
    </>
  );

  const containerStyle = [stage.container, !!battleInfo && stage.containerWithBattle];

  if (hasRoomBg || transparentBg) {
    return <View style={containerStyle}>{stageContent}</View>;
  }

  return (
    <LinearGradient
      colors={STAGE_GRADIENT}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={containerStyle}>
      {stageContent}
    </LinearGradient>
  );
}

// Seat ring diameter — the speaking waves are drawn behind a circle this size
const SEAT_RING = 56;
// Waves: soft purple on the default light stage, warm gold over a background image
const waveColor = (hasRoomBg?: boolean) => (hasRoomBg ? '#FFD966' : '#9B5CFF');

// Seat circle (56) + gap (3) + label line (name / REQUEST pill / JOIN ≈ 17).
// Every slot reserves this, so the stage height doesn't jump when the host
// goes offline and the seats show only a lock (no label).
const SEAT_MIN_H = 76;

// Space between the top and bottom seat rows. A speaking user's waves spread
// up to ~1.55× the ring (≈15px past it, plus a soft glow), so the bottom row's
// waves / frames need this much room to stay clear of the top row's names.
const ROW_GAP = 24;

const stage = StyleSheet.create({
  container: {
    paddingTop: 14,
    paddingBottom: 16,
    paddingHorizontal: 8,
    gap: ROW_GAP,
    overflow: 'hidden',
  },
  // Extra bottom room so the overlapping battle banner doesn't crowd the seat rows
  containerWithBattle: {
    paddingBottom: 44,
  },
  frameOverlay: {
    position: 'absolute',
    top: -4, left: -4, right: -4, bottom: -4,
    width: undefined, height: undefined,
    zIndex: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
  },

  // Host slot
  // Holds the seat ring + the speaking waves layered behind it
  ringWrap: { width: SEAT_RING, height: SEAT_RING, alignItems: 'center', justifyContent: 'center' },
  hostWrap: {
    alignItems: 'center',
    gap: 3,
    width: 72,
    minHeight: SEAT_MIN_H,
  },
  hostAvatarRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#4A90E2',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  hostAvatarRingActive: {
    borderColor: '#FFD700',
  },
  hostAvatarRingMuted: {
    borderColor: '#4A90E2',
  },
  hostAvatarRingOffline: {
    borderColor: '#ABADB2',
  },
  hostAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  hostAvatarFallback: {
    backgroundColor: '#EDE8F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hostAvatarInitial: {
    fontSize: 20,
    fontWeight: '800',
    color: '#7A0EED',
  },
  offlineMask: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Soft shadow keeps the white lock readable on light photos
  offlineLock: {
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  offlineName: {
    color: '#ABADB2',
  },

  // Member slots
  seatWrap: {
    alignItems: 'center',
    gap: 3,
    width: 72,
    minHeight: SEAT_MIN_H,
  },
  occupiedRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#4A90E2',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  seatAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  seatAvatarFallback: {
    backgroundColor: '#EDE8F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  seatInitial: {
    fontSize: 20,
    fontWeight: '700',
    color: '#7A0EED',
  },
  // Subtle under the picture: small, regular weight, one line (long names end
  // in "…" within the seat's width instead of spilling into the next seat)
  seatName: {
    fontSize: 10.5,
    lineHeight: 14,
    fontWeight: '400',
    color: '#3A3C42',
    textAlign: 'center',
    maxWidth: 64,
  },
  nameOnBg: {
    color: 'rgba(255,255,255,0.92)',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  seatCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  seatCircleDefault: {
    borderColor: '#BDBDBD',
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  seatCircleGold: {
    borderColor: '#FFD700',
    backgroundColor: 'rgba(255,215,0,0.08)',
  },
  // Same dashed outline as a normal empty seat
  seatCircleLocked: {
    borderStyle: 'dashed',
    borderColor: '#D5D3DC',
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  seatCircleLockedBg: {
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  requestPill: {
    backgroundColor: '#7A0EED',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  requestPillText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  requestPillGold: {
    backgroundColor: 'rgba(255,215,0,0.2)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  requestPillGoldText: {
    color: '#FFD700',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  joinLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ABADB2',
    letterSpacing: 0.4,
  },
  joinLabelBg: {
    color: 'rgb(255, 255, 255)',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  muteBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#E14C57',
    alignItems: 'center',
    justifyContent: 'center',
  },

  coinBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(122,14,237,0.15)',
  },
  coinBadgeImg: { width: 14, height: 14 },
  coinBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: RC.number,
  },
});
