import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { BASE_URL, MEDIA_BASE } from '@/services/api';
import { authStore } from '@/store/auth-store';
import { formatCoins } from '@/utils/userLevel';

function resolveAvatar(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${MEDIA_BASE}/${url.replace(/^\//, '')}`;
}

type GiftStats = { sent: number; received: number };

const REPORT_REASONS = ['Spam', 'Abuse or harassment', 'Inappropriate content', 'Impersonation', 'Other'];

function ReportPicker({ visible, onClose, onSubmit }: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) {
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={rp.backdrop} />
      </TouchableWithoutFeedback>
      <View style={rp.cardWrap} pointerEvents="box-none">
        <View style={rp.card}>
          <Text style={rp.title}>Report User</Text>
          {REPORT_REASONS.map(reason => (
            <TouchableOpacity key={reason} style={rp.reasonRow} activeOpacity={0.7} onPress={() => onSubmit(reason)}>
              <Text style={rp.reasonText}>{reason}</Text>
              <Ionicons name="chevron-forward" size={16} color="#ABADB2" />
            </TouchableOpacity>
          ))}
          <TouchableOpacity onPress={onClose} style={rp.cancelBtn} activeOpacity={0.75}>
            <Text style={rp.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const rp = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  cardWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  card: {
    width: '100%', backgroundColor: '#FFFFFF', borderRadius: 18, padding: 8,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 16,
  },
  title: { fontSize: 15, fontWeight: '800', color: '#1C1E22', paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6 },
  reasonRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 13,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#F0EDF8',
  },
  reasonText: { fontSize: 14, fontWeight: '600', color: '#1C1E22' },
  cancelBtn: { paddingVertical: 13, alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#F0EDF8' },
  cancelText: { fontSize: 14, fontWeight: '700', color: '#E14C57' },
});

export type UserProfileSheetTarget = {
  userId: string;
  userName: string;
  avatarUrl: string | null;
  isRoomHost: boolean;
  slotIndex?: number;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  roomId: string;
  target: UserProfileSheetTarget | null;
  /** True if the viewer is the room host OR is currently seated on the stage (co-host). */
  canManage: boolean;
  targetIsMuted?: boolean;
  onSendGift: (userId: string, userName: string) => void;
  onBlock: (userId: string) => void;
  onRemoveFromStage: (slotIndex: number) => void;
  onAddToStage: (userId: string) => void;
  onToggleTargetMute: (userId: string, mute: boolean) => void;
};

export function UserProfileSheet({
  visible, onClose, roomId, target, canManage, targetIsMuted, onSendGift, onBlock, onRemoveFromStage,
  onAddToStage, onToggleTargetMute,
}: Props) {
  const router = useRouter();
  const slideAnim = useRef(new Animated.Value(400)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const [giftStats, setGiftStats] = useState<GiftStats | null>(null);
  const [followersCount, setFollowersCount] = useState<number | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 180 }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 400, duration: 220, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  useEffect(() => {
    if (!visible || !target) return;
    const token = authStore.getToken();
    setLoading(true);
    setGiftStats(null);
    setCoverUrl(null);

    Promise.all([
      fetch(`${BASE_URL}/rooms/${roomId}/users/${target.userId}/gift-stats`)
        .then(r => r.json()).catch(() => null),
      fetch(`${BASE_URL}/auth/users/${target.userId}`)
        .then(r => r.json()).catch(() => null),
      token
        ? fetch(`${BASE_URL}/auth/follow/${target.userId}`, { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.json()).catch(() => null)
        : Promise.resolve(null),
    ]).then(([statsJson, profileJson, followJson]) => {
      if (statsJson?.success) setGiftStats(statsJson.data);
      if (profileJson?.success) {
        setFollowersCount(profileJson.data.followers_count ?? null);
        setCoverUrl(profileJson.data.cover_url ?? null);
      }
      if (followJson?.success) setIsFollowing(!!followJson.following);
    }).finally(() => setLoading(false));
  }, [visible, target?.userId, roomId]);

  async function handleToggleFollow() {
    if (!target || followBusy) return;
    const token = authStore.getToken();
    if (!token) return;
    setFollowBusy(true);
    const wasFollowing = isFollowing;
    setIsFollowing(!wasFollowing);
    try {
      await fetch(`${BASE_URL}/auth/follow/${target.userId}`, {
        method: wasFollowing ? 'DELETE' : 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      setIsFollowing(wasFollowing);
    } finally {
      setFollowBusy(false);
    }
  }

  function handleViewProfile() {
    if (!target) return;
    onClose();
    router.push(`/user/${target.userId}` as any);
  }

  async function handleSubmitReport(reason: string) {
    if (!target) return;
    setReportVisible(false);
    const token = authStore.getToken();
    if (!token) return;
    try {
      await fetch(`${BASE_URL}/auth/users/${target.userId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason, roomId }),
      });
    } catch {
      // silent — reporting failures shouldn't block the UI
    }
  }

  if (!target) return null;
  // Viewing your own profile (e.g. tapped your own avatar in the chat): only the
  // stats + View Profile make sense — no gifting/following/reporting/managing yourself.
  const isSelf = target.userId === authStore.getUserId();
  const avatarUri = resolveAvatar(target.avatarUrl);
  const coverUri = resolveAvatar(coverUrl);

  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[ps.backdrop, { opacity: opacityAnim }]}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>
      </Animated.View>

      <Animated.View style={[ps.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <View style={ps.handle} />

        {/* Cover banner */}
        <View style={ps.coverWrap}>
          {coverUri ? (
            <Image source={{ uri: coverUri }} style={ps.cover} resizeMode="cover" />
          ) : (
            <LinearGradient
              colors={['#4B00E8', '#7A04E5', '#B40CF0', '#FF2A76']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={ps.cover}
            />
          )}
        </View>

        {/* Avatar overlapping the banner, left-aligned, name below */}
        <View style={ps.identityRow}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={ps.avatar} />
          ) : (
            <View style={[ps.avatar, ps.avatarFallback]}>
              <Text style={ps.avatarInitial}>{target.userName[0]?.toUpperCase() ?? '?'}</Text>
            </View>
          )}
        </View>

        <View style={ps.banner}>
          <Text style={ps.name} numberOfLines={1}>{target.userName}</Text>
          {target.isRoomHost && (
            <View style={ps.hostPill}>
              <Ionicons name="star" size={11} color="#FFD700" />
              <Text style={ps.hostPillText}>Host</Text>
            </View>
          )}
        </View>

        {loading ? (
          <View style={ps.loadingWrap}>
            <ActivityIndicator size="small" color="#7A0EED" />
          </View>
        ) : (
          <View style={ps.statsRow}>
            <View style={ps.statBox}>
              <Text style={ps.statValue}>{formatCoins(giftStats?.sent ?? 0)}</Text>
              <Text style={ps.statLabel}>Gifts Sent</Text>
            </View>
            <View style={ps.statBox}>
              <Text style={ps.statValue}>{formatCoins(giftStats?.received ?? 0)}</Text>
              <Text style={ps.statLabel}>Gifts Received</Text>
            </View>
            {followersCount != null && (
              <View style={ps.statBox}>
                <Text style={ps.statValue}>{formatCoins(followersCount)}</Text>
                <Text style={ps.statLabel}>Followers</Text>
              </View>
            )}
          </View>
        )}

        {!isSelf && (
        <View style={ps.actionsGrid}>
          <TouchableOpacity
            style={[ps.actionBtn, ps.actionBtnPrimary]}
            activeOpacity={0.85}
            onPress={() => { onClose(); onSendGift(target.userId, target.userName); }}>
            <Ionicons name="gift" size={18} color="#FFFFFF" />
            <Text style={ps.actionBtnPrimaryText}>Send Gift</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[ps.actionBtn, isFollowing ? ps.actionBtnGhost : ps.actionBtnSecondary]}
            activeOpacity={0.85}
            disabled={followBusy}
            onPress={handleToggleFollow}>
            <Ionicons name={isFollowing ? 'checkmark' : 'person-add'} size={18} color={isFollowing ? '#7A0EED' : '#FFFFFF'} />
            <Text style={isFollowing ? ps.actionBtnGhostText : ps.actionBtnSecondaryText}>
              {isFollowing ? 'Following' : 'Follow'}
            </Text>
          </TouchableOpacity>
        </View>
        )}

        <TouchableOpacity style={ps.listRow} activeOpacity={0.7} onPress={handleViewProfile}>
          <Ionicons name="person-circle-outline" size={20} color="#60626A" />
          <Text style={ps.listRowText}>View Profile</Text>
          <Ionicons name="chevron-forward" size={16} color="#D8D3EC" />
        </TouchableOpacity>

        {!isSelf && (
          <TouchableOpacity style={ps.listRow} activeOpacity={0.7} onPress={() => setReportVisible(true)}>
            <Ionicons name="flag-outline" size={20} color="#60626A" />
            <Text style={ps.listRowText}>Report</Text>
            <Ionicons name="chevron-forward" size={16} color="#D8D3EC" />
          </TouchableOpacity>
        )}

        {canManage && !isSelf && (
          <>
            {target.slotIndex == null ? (
              <TouchableOpacity
                style={ps.listRow}
                activeOpacity={0.7}
                onPress={() => { onClose(); onAddToStage(target.userId); }}>
                <Ionicons name="person-add-outline" size={20} color="#60626A" />
                <Text style={ps.listRowText}>Add to Stage</Text>
                <Ionicons name="chevron-forward" size={16} color="#D8D3EC" />
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  style={ps.listRow}
                  activeOpacity={0.7}
                  onPress={() => { onClose(); onToggleTargetMute(target.userId, !targetIsMuted); }}>
                  <Ionicons name={targetIsMuted ? 'mic-off-outline' : 'mic-outline'} size={20} color="#60626A" />
                  <Text style={ps.listRowText}>{targetIsMuted ? 'Unmute' : 'Mute'}</Text>
                  <Ionicons name="chevron-forward" size={16} color="#D8D3EC" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={ps.listRow}
                  activeOpacity={0.7}
                  onPress={() => { onClose(); onRemoveFromStage(target.slotIndex!); }}>
                  <Ionicons name="exit-outline" size={20} color="#E14C57" />
                  <Text style={[ps.listRowText, ps.dangerText]}>Remove from Audio Box</Text>
                  <Ionicons name="chevron-forward" size={16} color="#D8D3EC" />
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity
              style={ps.listRow}
              activeOpacity={0.7}
              onPress={() => { onClose(); onBlock(target.userId); }}>
              <Ionicons name="ban-outline" size={20} color="#E14C57" />
              <Text style={[ps.listRowText, ps.dangerText]}>Block</Text>
              <Ionicons name="chevron-forward" size={16} color="#D8D3EC" />
            </TouchableOpacity>
          </>
        )}
      </Animated.View>

      <ReportPicker
        visible={reportVisible}
        onClose={() => setReportVisible(false)}
        onSubmit={handleSubmitReport}
      />
    </Modal>
  );
}

const ps = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    zIndex: 10,
  },
  sheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 10,
    paddingBottom: 28,
    overflow: 'hidden',
    zIndex: 11,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 24,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#E0DDED',
    alignSelf: 'center',
    marginBottom: 14,
    zIndex: 1,
  },

  // Cover banner — full-bleed, edge to edge
  coverWrap: { width: '100%', height: 110 },
  cover: { width: '100%', height: '100%' },

  // Avatar overlaps the bottom of the banner, left-aligned
  identityRow: { paddingHorizontal: 20, marginTop: -38 },
  avatar: { width: 76, height: 76, borderRadius: 38, borderWidth: 3, borderColor: '#FFFFFF' },
  avatarFallback: { backgroundColor: '#EDE8F7', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 28, fontWeight: '800', color: '#7A0EED' },

  banner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, marginTop: 10, marginBottom: 16 },
  name: { fontSize: 17, fontWeight: '800', color: '#1C1E22', maxWidth: '70%' },
  hostPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FFF8E1', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3,
  },
  hostPillText: { fontSize: 11, fontWeight: '700', color: '#B8860B' },
  loadingWrap: { paddingVertical: 24, alignItems: 'center' },
  statsRow: {
    flexDirection: 'row', justifyContent: 'space-around',
    backgroundColor: '#FAF8FF', borderRadius: 14, paddingVertical: 12, marginHorizontal: 20, marginBottom: 16,
  },
  statBox: { alignItems: 'center', gap: 2 },
  statValue: { fontSize: 15, fontWeight: '800', color: '#1C1E22' },
  statLabel: { fontSize: 11, color: '#60626A', fontWeight: '500' },
  actionsGrid: { flexDirection: 'row', gap: 10, marginBottom: 8, paddingHorizontal: 20 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderRadius: 14, paddingVertical: 12,
  },
  actionBtnPrimary: { backgroundColor: '#7A0EED' },
  actionBtnPrimaryText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  actionBtnSecondary: { backgroundColor: '#B50357' },
  actionBtnSecondaryText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  actionBtnGhost: { backgroundColor: '#F3EFFE', borderWidth: 1, borderColor: '#D8C8F5' },
  actionBtnGhostText: { fontSize: 14, fontWeight: '700', color: '#7A0EED' },
  listRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 20,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#F0EDF8',
  },
  listRowText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#1C1E22' },
  dangerText: { color: '#E14C57' },
});
