import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppScreenHeader } from '@/components/ui/app-screen-header';
import { BASE_URL, MEDIA_BASE } from '@/services/api';
import { authStore } from '@/store/auth-store';

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

function RoomCard({
  imageUrl,
  roomName,
  hostName,
  side,
}: {
  imageUrl: string | null;
  roomName: string;
  hostName: string | null;
  side: 'left' | 'right';
}) {
  const resolved = imageUrl
    ? imageUrl.startsWith('http') ? imageUrl : `${MEDIA_BASE}/${imageUrl.replace(/^\//, '')}`
    : null;

  const color = side === 'left' ? '#3B82F6' : '#F59E0B';
  const label = side === 'left' ? 'Challenger' : 'Defender';

  return (
    <View style={[styles.roomCard, { borderColor: color }]}>
      <View style={[styles.roomCardBadge, { backgroundColor: color }]}>
        <Text style={styles.roomCardBadgeText}>{label}</Text>
      </View>
      {resolved ? (
        <Image source={{ uri: resolved }} style={styles.roomAvatar} />
      ) : (
        <View style={[styles.roomAvatar, styles.roomAvatarFallback, { backgroundColor: color + '22' }]}>
          <Text style={[styles.roomAvatarInitial, { color }]}>{roomName[0]?.toUpperCase()}</Text>
        </View>
      )}
      <Text style={styles.roomName} numberOfLines={2}>{roomName}</Text>
      <Text style={styles.hostName} numberOfLines={1}>
        {hostName ?? 'Host'}
      </Text>
    </View>
  );
}

export function BattleOverviewScreen() {
  const { inviteId } = useLocalSearchParams<{ inviteId: string }>();
  const currentUserId = authStore.getUserId() ?? '';

  const [invite, setInvite] = useState<InviteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInvite = useCallback(async () => {
    if (!inviteId) return;
    setLoading(true);
    setError(null);
    try {
      const token = authStore.getToken();
      const r = await fetch(`${BASE_URL}/battle/invite/${inviteId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await r.json();
      if (json.success) {
        setInvite(json.data);
      } else {
        setError(json.message ?? 'Failed to load invite.');
      }
    } catch {
      setError('Network error. Please try again.');
    }
    setLoading(false);
  }, [inviteId]);

  useEffect(() => {
    fetchInvite();
  }, [fetchInvite]);

  const handleAccept = async () => {
    if (!invite) return;
    setActionLoading(true);
    try {
      const token = authStore.getToken();
      const r = await fetch(`${BASE_URL}/battle/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ invite_id: invite.id }),
      });
      const json = await r.json();
      if (json.success) {
        setInvite(prev => prev ? { ...prev, status: 'accepted' } : prev);
      }
    } catch {}
    setActionLoading(false);
  };

  const handleDecline = async () => {
    if (!invite) return;
    setActionLoading(true);
    try {
      const token = authStore.getToken();
      const r = await fetch(`${BASE_URL}/battle/decline`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ invite_id: invite.id }),
      });
      const json = await r.json();
      if (json.success) {
        router.back();
      }
    } catch {}
    setActionLoading(false);
  };

  const handleStart = async () => {
    if (!invite) return;
    setActionLoading(true);
    try {
      const token = authStore.getToken();
      const r = await fetch(`${BASE_URL}/battle/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ invite_id: invite.id }),
      });
      const json = await r.json();
      if (json.success) {
        router.replace(`/battle/live?inviteId=${invite.id}` as any);
      }
    } catch {}
    setActionLoading(false);
  };

  const isInviter  = invite?.from_user_id === currentUserId;
  const isInvitee  = invite?.to_user_id   === currentUserId;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppScreenHeader
        title="Battle"
        onBack={() => router.back()}
        backgroundColor="#F5F3FA"
      />

      {loading ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator color="#7A0EED" size="large" />
        </View>
      ) : error ? (
        <View style={styles.centerWrap}>
          <Ionicons name="alert-circle-outline" size={48} color="#E14C57" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchInvite}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : invite ? (
        <View style={styles.body}>
          {/* Status chip */}
          <View style={[styles.statusChip, statusChipColor(invite.status)]}>
            <Text style={styles.statusChipText}>{invite.status.toUpperCase()}</Text>
          </View>

          {/* Duration */}
          <Text style={styles.durationLabel}>{invite.duration_minutes} min battle</Text>

          {/* Rooms side by side */}
          <View style={styles.vsRow}>
            <RoomCard
              imageUrl={invite.from_room_image_url}
              roomName={invite.from_room_name}
              hostName={invite.from_host_name ?? invite.from_host_username}
              side="left"
            />

            {/* VS chip */}
            <View style={styles.vsChip}>
              <View style={styles.vsLine} />
              <LinearGradient
                colors={['#7A0EED', '#B50357']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.vsCircle}>
                <Text style={styles.vsText}>VS</Text>
              </LinearGradient>
              <View style={styles.vsLine} />
            </View>

            <RoomCard
              imageUrl={invite.to_room_image_url}
              roomName={invite.to_room_name}
              hostName={invite.to_host_name ?? invite.to_host_username}
              side="right"
            />
          </View>

          {/* Action area */}
          <View style={styles.actionArea}>
            {/* Inviter actions */}
            {isInviter && invite.status === 'accepted' && (
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: '#7A0EED' }]}
                activeOpacity={0.85}
                onPress={handleStart}
                disabled={actionLoading}>
                {actionLoading
                  ? <ActivityIndicator color="#FFFFFF" />
                  : <Text style={styles.primaryBtnText}>Start Battle ⚔️</Text>}
              </TouchableOpacity>
            )}

            {isInviter && invite.status === 'pending' && (
              <View style={styles.waitingWrap}>
                <ActivityIndicator color="#7A0EED" style={{ marginBottom: 8 }} />
                <Text style={styles.waitingText}>Waiting for the other room to accept…</Text>
              </View>
            )}

            {/* Invitee actions */}
            {isInvitee && invite.status === 'pending' && (
              <View style={styles.inviteeActions}>
                <TouchableOpacity
                  style={[styles.primaryBtn, { backgroundColor: '#3B82F6', flex: 1 }]}
                  activeOpacity={0.85}
                  onPress={handleAccept}
                  disabled={actionLoading}>
                  {actionLoading
                    ? <ActivityIndicator color="#FFFFFF" />
                    : <Text style={styles.primaryBtnText}>Accept ✅</Text>}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.secondaryBtn, { flex: 1 }]}
                  activeOpacity={0.85}
                  onPress={handleDecline}
                  disabled={actionLoading}>
                  <Text style={styles.secondaryBtnText}>Decline</Text>
                </TouchableOpacity>
              </View>
            )}

            {isInvitee && invite.status === 'accepted' && (
              <View style={styles.waitingWrap}>
                <Text style={styles.waitingText}>You accepted! Waiting for the host to start…</Text>
              </View>
            )}

            {invite.status === 'active' && (
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: '#7A0EED' }]}
                activeOpacity={0.85}
                onPress={() => router.replace(`/battle/live?inviteId=${invite.id}` as any)}>
                <Text style={styles.primaryBtnText}>Join Live Battle ⚔️</Text>
              </TouchableOpacity>
            )}

            {(invite.status === 'declined' || invite.status === 'finished') && (
              <View style={styles.waitingWrap}>
                <Text style={styles.waitingText}>
                  {invite.status === 'declined' ? 'This battle was declined.' : 'This battle has finished.'}
                </Text>
              </View>
            )}
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function statusChipColor(status: string) {
  switch (status) {
    case 'pending':  return { backgroundColor: '#FEF3C7' };
    case 'accepted': return { backgroundColor: '#DCFCE7' };
    case 'active':   return { backgroundColor: '#DBEAFE' };
    case 'declined': return { backgroundColor: '#FEE2E2' };
    case 'finished': return { backgroundColor: '#F3F4F6' };
    default:         return { backgroundColor: '#F3F4F6' };
  }
}

const styles = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: '#F5F3FA' },
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  errorText:  { fontSize: 15, color: '#E14C57', textAlign: 'center', fontWeight: '600' },
  retryBtn:   { paddingHorizontal: 28, paddingVertical: 10, borderRadius: 20, backgroundColor: '#7A0EED' },
  retryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

  body: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    alignItems: 'center',
  },

  statusChip: {
    paddingHorizontal: 14, paddingVertical: 5,
    borderRadius: 20, marginBottom: 8,
  },
  statusChipText: {
    fontSize: 11, fontWeight: '800', color: '#374151', letterSpacing: 0.8,
  },

  durationLabel: {
    fontSize: 22, fontWeight: '900', color: '#1C1E22', marginBottom: 28,
    letterSpacing: -0.4,
  },

  vsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 8,
    marginBottom: 36,
  },

  roomCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 2,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#4A0099',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
    position: 'relative',
    overflow: 'hidden',
  },
  roomCardBadge: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    paddingVertical: 4,
    alignItems: 'center',
  },
  roomCardBadgeText: {
    fontSize: 9, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.6,
  },
  roomAvatar: {
    width: 72, height: 72, borderRadius: 36, marginTop: 20,
  },
  roomAvatarFallback: {
    alignItems: 'center', justifyContent: 'center',
  },
  roomAvatarInitial: {
    fontSize: 28, fontWeight: '800',
  },
  roomName: {
    fontSize: 13, fontWeight: '700', color: '#1C1E22', textAlign: 'center',
  },
  hostName: {
    fontSize: 11, color: '#ABADB2', fontWeight: '500',
  },

  vsChip: {
    alignItems: 'center',
    gap: 4,
    zIndex: 1,
  },
  vsLine: {
    width: 2, height: 28, backgroundColor: '#D8D3EE', borderRadius: 1,
  },
  vsCircle: {
    width: 50, height: 50, borderRadius: 25,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#7A0EED', shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 6,
  },
  vsText: {
    fontSize: 14, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.8,
  },

  actionArea: {
    width: '100%',
  },

  primaryBtn: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#7A0EED',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  primaryBtnText: {
    fontSize: 16, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.3,
  },

  secondaryBtn: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E14C57',
    marginBottom: 12,
  },
  secondaryBtnText: {
    fontSize: 16, fontWeight: '700', color: '#E14C57',
  },

  inviteeActions: {
    flexDirection: 'row',
    gap: 12,
  },

  waitingWrap: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  waitingText: {
    fontSize: 14, color: '#60626A', textAlign: 'center', fontWeight: '500',
  },
});
