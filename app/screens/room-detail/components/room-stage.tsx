import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { SeatSlot } from '@/hooks/useRoomSocket';
import { MEDIA_BASE } from '@/services/api';

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

function HostSlot({ hostInfo, isHost, isMuted, onToggleMute, onLayout, coins, showCoins, frameUrl, hasRoomBg }: {
  hostInfo: HostInfo;
  isHost: boolean;
  isMuted?: boolean;
  onToggleMute?: () => void;
  onLayout?: (x: number, y: number) => void;
  coins?: number;
  showCoins?: boolean;
  frameUrl?: string | null;
  hasRoomBg?: boolean;
}) {
  const avatarContent = (
    <>
      {hostInfo.avatarUri ? (
        <Image source={{ uri: hostInfo.avatarUri }} style={stage.hostAvatar} />
      ) : (
        <View style={[stage.hostAvatar, stage.hostAvatarFallback]}>
          <Text style={stage.hostAvatarInitial}>{hostInfo.name[0]?.toUpperCase() ?? '?'}</Text>
        </View>
      )}
      {!hostInfo.isOnline && (
        <View style={stage.offlineMask}>
          <Ionicons name="moon-outline" size={18} color="#FFFFFF" />
        </View>
      )}
      {isMuted && (
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
      {isHost ? (
        <TouchableOpacity ref={measureLayout} onPress={onToggleMute} activeOpacity={0.8} style={ringStyle}>
          {avatarContent}
          {frameUrl && <Image source={{ uri: frameUrl }} style={stage.frameOverlay} resizeMode="contain" />}
        </TouchableOpacity>
      ) : (
        <View ref={measureLayout} style={ringStyle}>
          {avatarContent}
          {frameUrl && <Image source={{ uri: frameUrl }} style={stage.frameOverlay} resizeMode="contain" />}
        </View>
      )}
      <Text style={nameStyle} numberOfLines={1}>
        {hostInfo.isOnline ? hostInfo.name : 'Offline'}
      </Text>
      {showCoins && <CoinBadge coins={coins ?? 0} />}
    </View>
  );
}

function OccupiedSlot({ slot, isMe, isMuted, onToggleMute, onLayout, coins, showCoins, hasRoomBg }: {
  slot: SeatSlot;
  isMe?: boolean;
  isMuted?: boolean;
  onToggleMute?: () => void;
  onLayout?: (x: number, y: number) => void;
  coins?: number;
  showCoins?: boolean;
  hasRoomBg?: boolean;
}) {
  const uri = resolveAvatar(slot.avatarUrl);
  const avatar = uri ? (
    <Image source={{ uri }} style={stage.seatAvatar} />
  ) : (
    <View style={[stage.seatAvatar, stage.seatAvatarFallback]}>
      <Text style={stage.seatInitial}>{slot.userName[0]?.toUpperCase()}</Text>
    </View>
  );

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
      {isMe ? (
        <TouchableOpacity ref={measureLayout} onPress={onToggleMute} activeOpacity={0.8} style={ringStyle}>
          {avatar}
          {isMuted && (
            <View style={stage.muteBadge}>
              <Ionicons name="mic-off" size={10} color="#FFFFFF" />
            </View>
          )}
        </TouchableOpacity>
      ) : (
        <View ref={measureLayout} style={ringStyle}>
          {avatar}
          {isMuted && (
            <View style={stage.muteBadge}>
              <Ionicons name="mic-off" size={10} color="#FFFFFF" />
            </View>
          )}
        </View>
      )}
      <Text style={nameStyle} numberOfLines={1}>{slot.userName}</Text>
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
        <Text style={stage.requestPillText}>REQUEST</Text>
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
      <Text style={[stage.joinLabel, hasRoomBg && stage.joinLabelBg]}>JOIN</Text>
    </View>
  );
}

const MEMBER_INDICES = [1, 2, 3, 4, 5, 6, 7];

export function RoomStage({
  hostInfo, seats, isHost, hideEmptySlots, onRequestSeat,
  myUserId, onToggleMute, isHostMuted, onSlotLayout, hostUserId,
  battleInfo, coinsByUserId, hasRoomBg, rewardFrameUrl,
}: RoomStageProps) {
  const filledMap = new Map(
    seats.filter(s => s.slotIndex !== 0).map(s => [s.slotIndex, s])
  );

  const firstEmptyIndex = MEMBER_INDICES.find(i => !filledMap.has(i)) ?? null;

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
          showCoins={!!battleInfo}
          hasRoomBg={hasRoomBg}
        />
      );
    }
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
          isHost={isHost}
          isMuted={isHost ? isHostMuted : !!(seats.find(s => s.slotIndex === 0)?.isMuted)}
          onToggleMute={isHost ? onToggleMute : undefined}
          onLayout={onSlotLayout && hostUserId ? (x, y) => onSlotLayout(hostUserId, x, y) : undefined}
          coins={hostCoins}
          showCoins={!!battleInfo}
          frameUrl={rewardFrameUrl}
          hasRoomBg={hasRoomBg}
        />
        {row1.map(renderMemberSlot)}
      </View>
      <View style={stage.row}>
        {row2.map(renderMemberSlot)}
      </View>
    </>
  );

  const containerStyle = [stage.container, !!battleInfo && stage.containerWithBattle];

  if (hasRoomBg) {
    return <View style={containerStyle}>{stageContent}</View>;
  }

  return (
    <LinearGradient
      colors={['#DDD5F8', '#EDE8FF', '#F5F2FF']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={containerStyle}>
      {stageContent}
    </LinearGradient>
  );
}

const stage = StyleSheet.create({
  container: {
    paddingVertical: 18,
    paddingHorizontal: 12,
    gap: 12,
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
  hostWrap: {
    alignItems: 'center',
    gap: 2,
    width: 68,
  },
  hostAvatarRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
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
    width: 54,
    height: 54,
    borderRadius: 27,
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
    borderRadius: 30,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  offlineName: {
    color: '#ABADB2',
  },

  // Member slots
  seatWrap: {
    alignItems: 'center',
    gap: 2,
    width: 68,
  },
  occupiedRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#4A90E2',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  seatAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
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
  seatName: {
    fontSize: 10,
    fontWeight: '600',
    color: '#1C1E22',
    textAlign: 'center',
    maxWidth: 66,
  },
  nameOnBg: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  seatCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
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
    fontSize: 10,
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
    color: '#7A0EED',
  },
});
