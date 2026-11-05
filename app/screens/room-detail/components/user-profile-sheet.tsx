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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import { USER_LEVEL_IMAGES, formatCoins, getUserLevel } from '@/utils/userLevel';
import { REPORT_GUIDANCE, ReportReasonModal, USER_REPORT_REASONS } from './report-reason-modal';
import { avatarSource } from '@/utils/default-avatar';

function resolveAvatar(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${MEDIA_BASE}/${url.replace(/^\//, '')}`;
}

type GiftStats = { sent: number; received: number };

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
  /** Your own mic state, for the Mute/Unmute row on your own card. */
  selfIsMuted?: boolean;
  /** You're in the voice channel (host, or on a seat) — show Mute/Unmute. */
  selfOnStage?: boolean;
  /** You're on the stage and can step off it. */
  canExitStage?: boolean;
  onToggleSelfMute?: () => void;
  onExitStage?: () => void;
  /** You're the host and off the stage — shows the way back. */
  onReturnToStage?: () => void;
};

export function UserProfileSheet({
  visible, onClose, roomId, target, canManage, targetIsMuted, onSendGift, onBlock, onRemoveFromStage,
  onAddToStage, onToggleTargetMute,
  selfIsMuted, selfOnStage, canExitStage, onToggleSelfMute, onExitStage, onReturnToStage,
}: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(400)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const [giftStats, setGiftStats] = useState<GiftStats | null>(null);
  const [followersCount, setFollowersCount] = useState<number | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [level, setLevel] = useState<number | null>(null);
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
    setUsername(null);
    setLevel(null);

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
        setUsername(profileJson.data.username ?? null);
        if (profileJson.data.coins_gifted != null) setLevel(getUserLevel(Number(profileJson.data.coins_gifted) || 0));
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

  // Resolves to null on success, else an error message for the report popup
  async function handleSubmitReport(reason: string): Promise<string | null> {
    if (!target) return 'Something went wrong.';
    const token = authStore.getToken();
    if (!token) return 'Please log in again.';
    try {
      const res = await fetch(`${BASE_URL}/auth/users/${target.userId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason, roomId }),
      });
      const json = await res.json().catch(() => ({}));
      return res.ok && json.success !== false ? null : (json.message || 'Could not send. Please try again.');
    } catch {
      return 'Network error. Please try again.';
    }
  }

  if (!target) return null;
  // Viewing your own profile (your seat or your chat avatar): stats, View Profile,
  // and — when you're on stage — Mute/Unmute and Exit Stage. No gifting /
  // following / reporting / managing yourself.
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

      <Animated.View style={[ps.sheet, { paddingBottom: Math.max(insets.bottom, 12) + 8, transform: [{ translateY: slideAnim }] }]}>
        {/* Cover, full width */}
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
          <View style={ps.handle} />
        </View>

        {/* Avatar overlapping the cover (level badge on it) · name + @username beside it */}
        <View style={ps.identityRow}>
          <View style={ps.avatarWrap}>
            <Image source={avatarSource(avatarUri)} style={ps.avatar} />
          </View>
          <View style={ps.nameBlock}>
            <View style={ps.nameRow}>
              <Text style={ps.name} numberOfLines={1}>{target.userName}</Text>
              {level != null && (
                <ExpoImage
                  source={USER_LEVEL_IMAGES[Math.min(level, 100)]}
                  style={ps.levelBadge}
                  contentFit="contain"
                />
              )}
              {target.isRoomHost && (
                <View style={ps.hostPill}>
                  <Ionicons name="star" size={10} color="#FFB800" />
                  <Text style={ps.hostPillText}>Host</Text>
                </View>
              )}
            </View>
            {!!username && <Text style={ps.username} numberOfLines={1}>@{username}</Text>}
          </View>
        </View>

        {/* Stats */}
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

        <View style={ps.divider} />

        {/* Actions — one rounded row each; Send Gifts highlighted */}
        <View style={ps.actions}>
          {!isSelf && (
            <ActionRow
              icon="gift" iconColor="#E8944A" label="Send Gifts"
              onPress={() => { onClose(); onSendGift(target.userId, target.userName); }}
            />
          )}
          {/* Your own card: mic + leave the seat */}
          {isSelf && selfOnStage && onToggleSelfMute && (
            <ActionRow
              icon={selfIsMuted ? 'mic' : 'mic-off'}
              iconColor={selfIsMuted ? '#7A0EED' : '#E14C57'}
              label={selfIsMuted ? 'Unmute' : 'Mute'}
              onPress={() => { onClose(); onToggleSelfMute(); }}
            />
          )}
          {isSelf && canExitStage && onExitStage && (
            <ActionRow icon="exit" label="Exit Audio" danger onPress={() => { onClose(); onExitStage(); }} />
          )}
          {isSelf && onReturnToStage && (
            <ActionRow icon="mic" iconColor="#7A0EED" label="Join Audio" onPress={() => { onClose(); onReturnToStage(); }} />
          )}
          <ActionRow icon="person" label="View Profile" onPress={handleViewProfile} />
          {!isSelf && (
            <ActionRow
              icon={isFollowing ? 'checkmark-circle' : 'person-add'}
              iconColor={isFollowing ? '#7A0EED' : undefined}
              label={isFollowing ? 'Following' : 'Follow'}
              disabled={followBusy}
              onPress={handleToggleFollow}
            />
          )}

          {canManage && !isSelf && (
            target.slotIndex == null ? (
              <ActionRow
                icon="mic-circle" label="Add to Stage"
                onPress={() => { onClose(); onAddToStage(target.userId); }}
              />
            ) : (
              <>
                <ActionRow
                  icon={targetIsMuted ? 'mic' : 'mic-off'}
                  iconColor={targetIsMuted ? '#7A0EED' : '#E14C57'}
                  label={targetIsMuted ? 'Unmute' : 'Mute'}
                  onPress={() => { onClose(); onToggleTargetMute(target.userId, !targetIsMuted); }}
                />
                <ActionRow
                  icon="exit" label="Remove from Audio Box" danger
                  onPress={() => { onClose(); onRemoveFromStage(target.slotIndex!); }}
                />
              </>
            )
          )}

          {!isSelf && (
            <ActionRow icon="warning" label="Report" onPress={() => setReportVisible(true)} />
          )}
          {canManage && !isSelf && (
            <ActionRow icon="ban" label="Block" danger onPress={() => { onClose(); onBlock(target.userId); }} />
          )}
        </View>
      </Animated.View>

      <ReportReasonModal
        visible={reportVisible}
        title="Report User"
        subtitle={`Why are you reporting ${target.userName}?`}
        notice={REPORT_GUIDANCE}
        reasons={USER_REPORT_REASONS}
        onClose={() => setReportVisible(false)}
        onSubmit={handleSubmitReport}
      />
    </Modal>
  );
}

function ActionRow({ icon, iconColor, label, onPress, danger, disabled }: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  label: string;
  onPress: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.75}
      disabled={disabled}
      onPress={onPress}
      style={ps.actionRow}>
      <Ionicons name={icon} size={20} color={danger ? '#E14C57' : iconColor ?? '#1C1E22'} />
      <Text style={[ps.actionText, danger && ps.dangerText]}>{label}</Text>
    </TouchableOpacity>
  );
}

const AVATAR = 72;

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
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    overflow: 'hidden',
    zIndex: 11,
    elevation: 24,
  },

  // Cover — full-bleed; the drag handle sits on it
  coverWrap: { width: '100%', height: 110 },
  cover: { width: '100%', height: '100%' },
  handle: {
    position: 'absolute', top: 8, alignSelf: 'center',
    width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.85)',
  },

  // Avatar overlaps the cover's bottom edge; the name block starts just below the
  // cover (never over it), however many lines it has
  identityRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 16, marginTop: -AVATAR / 2 },
  avatarWrap: { width: AVATAR, alignItems: 'center' },
  avatar: { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, borderWidth: 3, borderColor: '#FFFFFF', backgroundColor: '#FFFFFF' },
  avatarFallback: { backgroundColor: '#EDE8F7', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 24, fontWeight: '800', color: '#7A0EED' },
  // Small level pill on the name line (same size as in chat messages)
  levelBadge: { width: 44, height: 16 },
  nameBlock: { flex: 1, paddingTop: AVATAR / 2 + 6, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { flexShrink: 1, fontSize: 16, fontWeight: '700', color: '#1C1E22' },
  username: { fontSize: 12, color: '#8A8C93' },
  hostPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#FFF6DC', borderRadius: 9, paddingHorizontal: 7, paddingVertical: 2,
  },
  hostPillText: { fontSize: 11, fontWeight: '700', color: '#B8860B' },

  loadingWrap: { paddingVertical: 22, alignItems: 'center' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12 },
  statBox: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { fontSize: 18, fontWeight: '700', color: '#1C1E22' },
  statLabel: { fontSize: 12, color: '#8A8C93' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#ECE9F4', marginHorizontal: 16, marginBottom: 12 },

  // Action rows — plain, straight on the white sheet
  actions: { paddingHorizontal: 16 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 14, height: 46, paddingHorizontal: 4 },
  actionText: { fontSize: 14, fontWeight: '600', color: '#1C1E22' },
  dangerText: { color: '#E14C57' },
});
