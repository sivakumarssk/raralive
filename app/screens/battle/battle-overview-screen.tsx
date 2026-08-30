import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BASE_URL, MEDIA_BASE } from '@/services/api';
import { authStore } from '@/store/auth-store';
import { onBattleInviteAccepted, onBattleInviteDeclined, triggerReopenBattle } from '@/store/socket-store';

type InviteDetail = {
  id: string;
  from_room_id: string;
  to_room_id: string;
  from_user_id: string;
  to_user_id: string;
  duration_minutes: number;
  status: 'pending' | 'accepted' | 'declined' | 'active' | 'finished';
  started_at: string | null;
  from_room_name: string;
  from_room_image_url: string | null;
  to_room_name: string;
  to_room_image_url: string | null;
  from_host_name: string | null;
  from_host_username: string | null;
  to_host_name: string | null;
  to_host_username: string | null;
};

function resolveUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.startsWith('http') ? url : `${MEDIA_BASE}/${url.replace(/^\//, '')}`;
}

function RoomShield({ imageUrl, roomName, label, color }: {
  imageUrl: string | null;
  roomName: string;
  label: string;
  color: string;
}) {
  const resolved = resolveUrl(imageUrl);
  return (
    <View style={shield.wrap}>
      <Text style={shield.label}>{label}</Text>
      <View style={[shield.ring, { borderColor: color }]}>
        {resolved ? (
          <Image source={{ uri: resolved }} style={shield.avatar} />
        ) : (
          <View style={[shield.avatar, { backgroundColor: color + '33', alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={[shield.initial, { color }]}>{roomName[0]?.toUpperCase()}</Text>
          </View>
        )}
      </View>
      <Text style={shield.name} numberOfLines={2}>{roomName}</Text>
    </View>
  );
}

export function BattleOverviewScreen() {
  const { inviteId, fromRoomId } = useLocalSearchParams<{ inviteId: string; fromRoomId?: string }>();
  const currentUserId = authStore.getUserId() ?? '';

  const [invite, setInvite] = useState<InviteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState(10);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const hourglassAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const fetchInvite = useCallback(async () => {
    if (!inviteId) return;
    try {
      const token = authStore.getToken();
      const r = await fetch(`${BASE_URL}/battle/invite/${inviteId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await r.json();
      if (json.success) setInvite(json.data);
    } catch {}
    setLoading(false);
  }, [inviteId]);

  useEffect(() => { fetchInvite(); }, [fetchInvite]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.18, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  useEffect(() => {
    const unsubA = onBattleInviteAccepted(({ invite_id }) => {
      if (invite_id === inviteId) fetchInvite();
    });
    const unsubD = onBattleInviteDeclined(({ invite_id }) => {
      if (invite_id === inviteId) fetchInvite();
    });
    return () => { unsubA(); unsubD(); };
  }, [inviteId, fetchInvite]);

  useEffect(() => {
    if (!invite || invite.status !== 'pending') return;
    setCountdown(10);
    const interval = setInterval(() => {
      setCountdown(prev => prev <= 1 ? 0 : prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [invite?.status]);

  // Hourglass flip animation on each tick
  useEffect(() => {
    if (countdown <= 0 || invite?.status !== 'pending') return;
    Animated.parallel([
      Animated.sequence([
        Animated.timing(hourglassAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(hourglassAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.15, duration: 150, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]),
    ]).start();
  }, [countdown]);

  useEffect(() => {
    if (countdown === 0 && invite?.status === 'pending') {
      triggerReopenBattle();
      router.back();
    }
  }, [countdown]);

  const isInviter = invite?.from_user_id === currentUserId;

  const handleCancel = async () => {
    try {
      const token = authStore.getToken();
      await fetch(`${BASE_URL}/battle/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ invite_id: inviteId }),
      });
    } catch {}
    router.back();
  };

  const handleStart = async () => {
    if (!invite) return;
    try {
      const token = authStore.getToken();
      const r = await fetch(`${BASE_URL}/battle/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ invite_id: invite.id }),
      });
      const json = await r.json();
      // Room's own battle banner picks up the newly-started battle via its polling
      if (json.success) router.back();
    } catch {}
  };

  if (loading) {
    return (
      <SafeAreaView style={s.root} edges={['top']}>
        <ActivityIndicator color="#7A0EED" size="large" style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  const status = invite?.status ?? 'pending';
  const isPending = status === 'pending';
  const isAccepted = status === 'accepted';

  const fromName = invite?.from_room_name ?? '';
  const toName = invite?.to_room_name ?? '';
  const fromImg = invite?.from_room_image_url ?? null;
  const toImg = invite?.to_room_image_url ?? null;
  const duration = invite?.duration_minutes ?? 0;

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.headerBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color="#1C1E22" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Battle</Text>
      </View>

      {/* Stage card */}
      <View style={s.stageCard}>
        {/* Status pill */}
        <View style={[s.statusPill, isPending ? s.pendingPill : isAccepted ? s.acceptedPill : s.declinedPill]}>
          <Text style={[s.statusText, isPending ? s.pendingText : isAccepted ? s.acceptedText : s.declinedText]}>
            {isPending ? 'PENDING' : isAccepted ? 'ACCEPTED' : 'DECLINED'}
          </Text>
        </View>

        {/* Duration */}
        <Text style={s.duration}>{duration} min battle</Text>

        {/* VS row */}
        <View style={s.vsRow}>
          <RoomShield imageUrl={fromImg} roomName={fromName} label="Challenger" color="#3B82F6" />

          <Animated.View style={[s.vsCircle, { transform: [{ scale: pulseAnim }] }]}>
            <LinearGradient colors={['#7A0EED', '#B50357']} style={s.vsGrad}>
              <Text style={s.vsText}>VS</Text>
            </LinearGradient>
          </Animated.View>

          <RoomShield imageUrl={toImg} roomName={toName} label="Defender" color="#F59E0B" />
        </View>

        {/* Waiting timer */}
        {isPending && isInviter && (
          <View style={s.waitWrap}>
            <Animated.View style={[s.timerCircle, {
              transform: [
                { scale: scaleAnim },
                { rotate: hourglassAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) },
              ],
            }]}>
              <Text style={s.timerIcon}>⏳</Text>
            </Animated.View>
            <Text style={s.timerCount}>{countdown}</Text>
            <Text style={s.timerLabel}>seconds remaining</Text>
            <Text style={s.waitText}>Waiting for the other room to accept</Text>
          </View>
        )}
        {isAccepted && isInviter && (
          <Text style={[s.waitText, { color: '#22C55E' }]}>Other room accepted! Start the battle.</Text>
        )}
        {status === 'declined' && (
          <Text style={[s.waitText, { color: '#E14C57' }]}>The invite was declined.</Text>
        )}
      </View>

      {/* Actions — light bg */}
      <View style={s.actions}>
        {isInviter && isAccepted && (
          <TouchableOpacity activeOpacity={0.85} style={s.startBtn} onPress={handleStart}>
            <LinearGradient colors={['#7A0EED', '#B50357']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.startGrad}>
              <Ionicons name="flash" size={18} color="#FFFFFF" />
              <Text style={s.startBtnText}>Start Battle</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {isPending && (
          <TouchableOpacity activeOpacity={0.85} style={s.cancelBtn} onPress={handleCancel}>
            <Text style={s.cancelBtnText}>Cancel Invite</Text>
          </TouchableOpacity>
        )}

        {(status === 'declined' || status === 'finished') && (
          <TouchableOpacity activeOpacity={0.85} style={s.cancelBtn} onPress={() => router.back()}>
            <Text style={s.cancelBtnText}>Go Back</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const shield = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', gap: 10 },
  label: { fontSize: 10, fontWeight: '700', color: '#ABADB2', letterSpacing: 1, textTransform: 'uppercase' },
  ring: {
    width: 84, height: 84, borderRadius: 42, borderWidth: 3,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#7A0EED', shadowOpacity: 0.1, shadowRadius: 10, elevation: 4,
  },
  avatar: { width: 74, height: 74, borderRadius: 37 },
  initial: { fontSize: 28, fontWeight: '900' },
  name: { fontSize: 12, fontWeight: '700', color: '#1C1E22', textAlign: 'center', lineHeight: 16, paddingHorizontal: 4 },
});

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  headerBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#1C1E22' },

  stageCard: {
    marginHorizontal: 16, marginTop: 8,
    paddingTop: 24, paddingBottom: 28, paddingHorizontal: 20,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    shadowColor: '#7A0EED', shadowOpacity: 0.07, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },

  statusPill: {
    paddingHorizontal: 20, paddingVertical: 6,
    borderRadius: 20, marginBottom: 10,
    borderWidth: 1,
  },
  pendingPill: { backgroundColor: '#FFF8E1', borderColor: '#FBBF24' },
  acceptedPill: { backgroundColor: '#ECFDF5', borderColor: '#22C55E' },
  declinedPill: { backgroundColor: '#FEF2F2', borderColor: '#F87171' },
  statusText: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  pendingText: { color: '#B45309' },
  acceptedText: { color: '#16A34A' },
  declinedText: { color: '#DC2626' },

  duration: {
    fontSize: 14, fontWeight: '700', color: '#ABADB2',
    marginBottom: 24, letterSpacing: 0.3,
  },

  vsRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 4, marginBottom: 24,
  },
  vsCircle: {
    width: 52, height: 52, borderRadius: 26, overflow: 'hidden',
    shadowColor: '#7A0EED', shadowOpacity: 0.4, shadowRadius: 12,
    elevation: 8, marginHorizontal: 10,
  },
  vsGrad: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  vsText: { fontSize: 14, fontWeight: '900', color: '#FFFFFF', letterSpacing: 1 },

  waitWrap: { alignItems: 'center', gap: 6 },
  timerCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#F3EFFE',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#EDE8F7',
    marginBottom: 4,
  },
  timerIcon: { fontSize: 30 },
  timerCount: {
    fontSize: 42, fontWeight: '900', color: '#7A0EED',
    letterSpacing: -1, fontVariant: ['tabular-nums' as const],
  },
  timerLabel: { fontSize: 12, fontWeight: '600', color: '#ABADB2', marginBottom: 4 },
  waitText: {
    fontSize: 13, fontWeight: '500', color: '#60626A',
    textAlign: 'center', lineHeight: 18,
  },

  actions: {
    flex: 1, justifyContent: 'flex-end',
    paddingHorizontal: 24, paddingBottom: 32, gap: 12,
  },

  startBtn: {
    borderRadius: 16, overflow: 'hidden',
    shadowColor: '#7A0EED', shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  startGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 16,
  },
  startBtnText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },

  cancelBtn: {
    paddingVertical: 14, borderRadius: 16,
    borderWidth: 1.5, borderColor: '#EDE8F7',
    alignItems: 'center', backgroundColor: '#FFFFFF',
    shadowColor: '#7A0EED', shadowOpacity: 0.06, shadowRadius: 6, elevation: 1,
  },
  cancelBtnText: { fontSize: 15, fontWeight: '700', color: '#60626A' },
});
