import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BASE_URL, MEDIA_BASE } from '@/services/api';
import { authStore } from '@/store/auth-store';

type BattleInfo = {
  inviteId: string;
  fromRoomId: string;
  fromRoomName: string;
  fromRoomImageUrl: string | null;
  toRoomId: string;
  toRoomName: string;
  toRoomImageUrl: string | null;
  endsAt: string | null;        // ISO timestamp if backend sends it
  startedAt?: string | null;    // fallback: started_at from invite
  durationMinutes?: number;     // fallback: duration_minutes from invite
};

function resolveUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.startsWith('http') ? url : `${MEDIA_BASE}/${url.replace(/^\//, '')}`;
}

function RoomAvatar({ url, name, size = 40 }: { url: string | null; name: string; size?: number }) {
  const resolved = resolveUrl(url);
  if (resolved) {
    return <Image source={{ uri: resolved }} style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: '#FFFFFF' }} />;
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: 'rgba(255,255,255,0.25)', borderWidth: 2, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size * 0.38, fontWeight: '800', color: '#FFFFFF' }}>{name[0]?.toUpperCase() ?? '?'}</Text>
    </View>
  );
}

function resolveEndsAt(info: BattleInfo): number | null {
  if (info.endsAt) return new Date(info.endsAt).getTime();
  if (info.startedAt && info.durationMinutes) {
    return new Date(info.startedAt).getTime() + info.durationMinutes * 60 * 1000;
  }
  return null;
}

function useCountdown(endsAtMs: number | null) {
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!endsAtMs) return;
    const tick = () => {
      const diff = Math.max(0, Math.floor((endsAtMs - Date.now()) / 1000));
      setSecondsLeft(diff);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endsAtMs]);

  const m = Math.floor(secondsLeft / 60);
  const s = secondsLeft % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

type Props = { roomId: string };

function mapApiData(data: Record<string, unknown>): BattleInfo {
  return {
    inviteId:          (data.invite_id ?? data.id ?? data.inviteId) as string,
    fromRoomId:        (data.from_room_id ?? data.fromRoomId) as string,
    fromRoomName:      (data.from_room_name ?? data.fromRoomName ?? '') as string,
    fromRoomImageUrl:  (data.from_room_image_url ?? data.fromRoomImageUrl ?? null) as string | null,
    toRoomId:          (data.to_room_id ?? data.toRoomId) as string,
    toRoomName:        (data.to_room_name ?? data.toRoomName ?? '') as string,
    toRoomImageUrl:    (data.to_room_image_url ?? data.toRoomImageUrl ?? null) as string | null,
    endsAt:            (data.ends_at ?? data.endsAt ?? null) as string | null,
    startedAt:         (data.started_at ?? data.startedAt ?? null) as string | null,
    durationMinutes:   (data.duration_minutes ?? data.durationMinutes ?? null) as number | undefined,
  };
}

export function BattleBanner({ roomId }: Props) {
  const [battle, setBattle] = useState<BattleInfo | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const endsAtMs = battle ? resolveEndsAt(battle) : null;
  const timeDisplay = useCountdown(endsAtMs);

  // Fetch active battle via notifications → invite detail (same pattern as room-detail-screen)
  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;
    const fetchBattle = async () => {
      const token = authStore.getToken();
      if (!token) return;
      try {
        const nr = await fetch(`${BASE_URL}/battle/notifications`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const nj = await nr.json();
        if (cancelled || !nj.success) return;

        const notifs: Array<{ type: string; data: Record<string, string> | null }> = nj.data ?? [];
        const match = notifs.find(n =>
          (n.type === 'battle_invite' || n.type === 'battle_accepted' || n.type === 'battle_started') &&
          n.data?.invite_id
        );
        if (!match?.data?.invite_id) { if (!cancelled) setBattle(null); return; }

        const ir = await fetch(`${BASE_URL}/battle/invite/${match.data.invite_id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const ij = await ir.json();
        if (cancelled || !ij.success || !ij.data) return;

        const d = ij.data;
        if (d.status !== 'active') { if (!cancelled) setBattle(null); return; }
        if (d.from_room_id !== roomId && d.to_room_id !== roomId) { if (!cancelled) setBattle(null); return; }

        if (!cancelled) setBattle(mapApiData({ ...d, invite_id: match.data.invite_id }));
      } catch { if (!cancelled) setBattle(null); }
    };
    fetchBattle();
    const id = setInterval(fetchBattle, 15_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [roomId]);

  // VS pulse animation
  useEffect(() => {
    if (!battle) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.25, duration: 500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 500, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [battle, pulseAnim]);

  if (!battle) return null;

  const isFrom     = battle.fromRoomId === roomId;
  const ownName    = isFrom ? battle.fromRoomName     : battle.toRoomName;
  const ownImage   = isFrom ? battle.fromRoomImageUrl : battle.toRoomImageUrl;
  const rivalName  = isFrom ? battle.toRoomName       : battle.fromRoomName;
  const rivalImage = isFrom ? battle.toRoomImageUrl   : battle.fromRoomImageUrl;

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={() => router.push(`/battle/live?inviteId=${battle.inviteId}` as any)}
      style={b.wrapper}>
      <LinearGradient
        colors={['#3B00C4', '#7A0EED', '#B50357']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={b.gradient}>

        {/* Left — own room */}
        <View style={b.side}>
          <RoomAvatar url={ownImage} name={ownName} size={38} />
          <Text style={b.roomName} numberOfLines={1}>{ownName}</Text>
        </View>

        {/* Center — LIVE badge + VS + timer */}
        <View style={b.center}>
          {/* <View style={b.liveBadge}>
            <View style={b.timerDot} />
            <Text style={b.liveBadgeText}>LIVE ⚔️</Text>
          </View> */}
          <Animated.View style={[b.vsChip, { transform: [{ scale: pulseAnim }] }]}>
            <Text style={b.vsText}>VS</Text>
          </Animated.View>
          <Text style={b.timerText}>{timeDisplay}</Text>
        </View>

        {/* Right — rival room */}
        <View style={[b.side, b.sideRight]}>
          <RoomAvatar url={rivalImage} name={rivalName} size={38} />
          <Text style={[b.roomName, b.roomNameRight]} numberOfLines={1}>{rivalName}</Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const b = StyleSheet.create({
  wrapper: {
    marginHorizontal: 0,
    shadowColor: '#7A0EED',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    overflow: 'hidden',
  },

  side: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sideRight: {
    flexDirection: 'row-reverse',
  },
  roomName: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.1,
  },
  roomNameRight: {
    textAlign: 'right',
  },

  center: {
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
  },
  vsChip: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  vsText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#7A0EED',
    letterSpacing: 0.5,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  liveBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  timerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22C55E',
  },
  timerText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 2,
    fontVariant: ['tabular-nums'],
  },
});
