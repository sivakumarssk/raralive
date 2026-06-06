import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { SeatSlot } from '@/hooks/useRoomSocket';
import { MEDIA_BASE } from '@/services/api';

export type HostInfo = {
  name: string;
  avatarUri?: string;
  isOnline: boolean;
};

export type SlotLayoutMap = Map<string, { x: number; y: number }>; // userId → screen center

export type BattleStageInfo = {
  ownRoomName: string;
  ownRoomImageUrl: string | null;
  rivalRoomName: string;
  rivalRoomImageUrl: string | null;
  timeDisplay: string; // formatted MM:SS
  isFinished: boolean;
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
  // battle
  battleInfo?: BattleStageInfo | null;
  coinsByUserId?: Map<string, number>; // userId → coins received as gifts
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
      <Text style={stage.coinBadgeEmoji}>🪙</Text>
      <Text style={stage.coinBadgeText}>{formatCoins(coins)}</Text>
    </View>
  );
}


function HostSlot({ hostInfo, isHost, isMuted, onToggleMute, onLayout, coins, showCoins }: {
  hostInfo: HostInfo;
  isHost: boolean;
  isMuted?: boolean;
  onToggleMute?: () => void;
  onLayout?: (x: number, y: number) => void;
  coins?: number;
  showCoins?: boolean;
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
      {isHost && isMuted && (
        <View style={stage.muteBadge}>
          <Ionicons name="mic-off" size={10} color="#FFFFFF" />
        </View>
      )}
    </>
  );

  const ringStyle = [stage.hostAvatarRing, !hostInfo.isOnline && stage.hostAvatarRingOffline];
  const measureLayout = (ref: View | null) => {
    if (!ref || !onLayout) return;
    ref.measureInWindow((x, y, w, h) => onLayout(x + w / 2, y + h / 2));
  };

  return (
    <View style={stage.hostWrap}>
      {isHost ? (
        <TouchableOpacity
          ref={measureLayout}
          onPress={onToggleMute}
          activeOpacity={0.8}
          style={ringStyle}>
          {avatarContent}
        </TouchableOpacity>
      ) : (
        <View ref={measureLayout} style={ringStyle}>
          {avatarContent}
        </View>
      )}
      <Text style={[stage.seatName, !hostInfo.isOnline && stage.offlineName]}>
        {hostInfo.isOnline ? hostInfo.name : 'Offline'}
      </Text>
      {showCoins && <CoinBadge coins={coins ?? 0} />}
    </View>
  );
}

function OccupiedSlot({ slot, isMe, isMuted, onToggleMute, onLayout, coins, showCoins }: {
  slot: SeatSlot;
  isMe?: boolean;
  isMuted?: boolean;
  onToggleMute?: () => void;
  onLayout?: (x: number, y: number) => void;
  coins?: number;
  showCoins?: boolean;
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

  return (
    <View style={stage.seatWrap}>
      {isMe ? (
        <TouchableOpacity ref={measureLayout} onPress={onToggleMute} activeOpacity={0.8} style={stage.occupiedRing}>
          {avatar}
          {isMuted && (
            <View style={stage.muteBadge}>
              <Ionicons name="mic-off" size={10} color="#FFFFFF" />
            </View>
          )}
        </TouchableOpacity>
      ) : (
        <View ref={measureLayout} style={stage.occupiedRing}>
          {avatar}
        </View>
      )}
      <Text style={stage.seatName} numberOfLines={1}>{slot.userName}</Text>
      {showCoins && <CoinBadge coins={coins ?? 0} />}
    </View>
  );
}

function RequestableSlot({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={stage.seatWrap}>
      <View style={[stage.seatCircle, stage.seatCircleRequest]}>
        <Ionicons name="add" size={26} color="#7A0EED" />
      </View>
      <View style={stage.requestPill}>
        <Text style={stage.requestPillText}>REQUEST</Text>
      </View>
    </TouchableOpacity>
  );
}

function LockedSlot() {
  return (
    <View style={stage.seatWrap}>
      <View style={stage.seatCircle}>
        <Ionicons name="add" size={24} color="#BDBDBD" />
      </View>
      <Text style={stage.joinLabel}>JOIN</Text>
    </View>
  );
}

// 7 member slots (indices 1–7), fixed positions — 8 total including host
const MEMBER_INDICES = [1, 2, 3, 4, 5, 6, 7];

export function RoomStage({
  hostInfo, seats, isHost, hideEmptySlots, onRequestSeat,
  myUserId, isMuted, onToggleMute, isHostMuted, onSlotLayout, hostUserId,
  battleInfo, coinsByUserId,
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
          isMuted={isMuted}
          onToggleMute={onToggleMute}
          onLayout={onSlotLayout ? (x, y) => onSlotLayout(occupied.userId, x, y) : undefined}
          coins={coins}
          showCoins={!!battleInfo}
        />
      );
    }
    if (hideEmptySlots || isHost) return <LockedSlot key={slotIndex} />;
    if (firstEmptyIndex === null) return null;
    if (slotIndex === firstEmptyIndex) {
      return <RequestableSlot key={slotIndex} onPress={() => onRequestSeat(slotIndex)} />;
    }
    return <LockedSlot key={slotIndex} />;
  }

  const row1 = MEMBER_INDICES.slice(0, 3); // 1,2,3
  const row2 = MEMBER_INDICES.slice(3, 7); // 4,5,6,7

  const hostCoins = hostUserId ? coinsByUserId?.get(hostUserId) : undefined;

  return (
    <LinearGradient
      colors={['#DDD5F8', '#EDE8FF', '#F5F2FF']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={stage.container}>

      {/* Row 1: host + slots 1,2,3 */}
      <View style={stage.row}>
        <HostSlot
          hostInfo={hostInfo}
          isHost={isHost}
          isMuted={isHostMuted}
          onToggleMute={isHost ? onToggleMute : undefined}
          onLayout={onSlotLayout && hostUserId ? (x, y) => onSlotLayout(hostUserId, x, y) : undefined}
          coins={hostCoins}
          showCoins={!!battleInfo}
        />
        {row1.map(renderMemberSlot)}
      </View>

      {/* Row 2: slots 4,5,6,7 */}
      <View style={stage.row}>
        {row2.map(renderMemberSlot)}
      </View>

    </LinearGradient>
  );
}

const stage = StyleSheet.create({
  container: {
    paddingVertical: 18,
    paddingHorizontal: 12,
    gap: 12,
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
    width: 72,
  },
  hostAvatarRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 3,
    borderColor: '#7A0EED',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  hostAvatarRingOffline: {
    borderColor: '#ABADB2',
  },
  hostAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  hostAvatarFallback: {
    backgroundColor: '#EDE8F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hostAvatarInitial: {
    fontSize: 22,
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
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#7A0EED',
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
    fontSize: 18,
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
  seatCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#BDBDBD',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  seatCircleRequest: {
    borderColor: '#7A0EED',
    borderStyle: 'solid',
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
  joinLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ABADB2',
    letterSpacing: 0.4,
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

  // Coin badge below name
  coinBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(122,14,237,0.15)',
  },
  coinBadgeEmoji: { fontSize: 9 },
  coinBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#7A0EED',
  },

});
