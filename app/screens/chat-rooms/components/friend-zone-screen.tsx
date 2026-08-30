import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Image,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { PhotoCarousel } from '@/components/photo-carousel';

const ROW_AVATAR_SIZE = 88;

// ── Types ─────────────────────────────────────────────────────────────────────

export type Friend = {
  id: string;
  name: string;
  age: number;
  location?: string;
  avatarUri?: string;
  isOnline: boolean;
  isVip?: boolean;
  canAudio: boolean;
  canVideo: boolean;
  isVerified?: boolean;
  gender?: string;
  height?: string;
  languages?: string[];
  photos?: string[];
  aboutMe?: string;
};

export type FriendZoneApplicationStatus = 'none' | 'pending' | 'approved' | 'rejected';

export type MyProfile = {
  name: string;
  email?: string;
  avatarUri?: string;
  isOnline: boolean;
  applicationStatus: FriendZoneApplicationStatus;
  rejectionReason?: string | null;
  photos?: string[];
  gender?: string;
  age?: number;
  city?: string;
  language?: string;
  aboutMe?: string;
};

type FriendZoneScreenProps = {
  myProfile: MyProfile;
  onEditProfile?: () => void;
  onJoinPress?: () => void;
  receiveCalls: boolean;
  videoCalls: boolean;
  onReceiveCallsToggle: (v: boolean) => void;
  onVideoCallToggle: (v: boolean) => void;
  friends: Friend[];
  onAudioCall: (friend: Friend) => void;
  onVideoCall: (friend: Friend) => void;
  onFriendPress: (friend: Friend) => void;
  onHistoryPress: () => void;
  // Temporary — jumps straight into the call screen UI with no signaling/
  // Agora, so the gift bar / chat feed / controls can be checked on-device
  // without a second account. Remove once the call UI is fully verified.
  onPreviewCallUi?: () => void;
};

// ── Profile Hero ──────────────────────────────────────────────────────────────

function ProfileHero({
  profile, onEdit, onJoinPress, receiveCalls, videoCalls, onReceiveCallsToggle, onVideoCallToggle,
}: {
  profile: MyProfile;
  onEdit?: () => void;
  onJoinPress?: () => void;
  receiveCalls: boolean;
  videoCalls: boolean;
  onReceiveCallsToggle: (v: boolean) => void;
  onVideoCallToggle: (v: boolean) => void;
}) {
  if (profile.applicationStatus === 'pending') {
    return (
      <View style={[hero.joinBannerStandalone, hero.pendingBanner]}>
        <View style={hero.joinBannerIconLight}>
          <Ionicons name="time-outline" size={18} color="#B8860B" />
        </View>
        <View style={hero.joinBannerTextWrap}>
          <Text style={hero.pendingTitle}>Application Under Review</Text>
          <Text style={hero.pendingSubtitle}>We'll notify you once it's approved</Text>
        </View>
      </View>
    );
  }

  if (profile.applicationStatus === 'rejected') {
    return (
      <TouchableOpacity style={[hero.joinBannerStandalone, hero.rejectedBanner]} onPress={onJoinPress} activeOpacity={0.88}>
        <View style={hero.joinBannerIconLight}>
          <Ionicons name="close-circle-outline" size={18} color="#E14C57" />
        </View>
        <View style={hero.joinBannerTextWrap}>
          <Text style={hero.rejectedTitle}>Application Rejected</Text>
          <Text style={hero.rejectedSubtitle}>Tap to see the reason and reapply</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#E14C57" />
      </TouchableOpacity>
    );
  }

  if (profile.applicationStatus === 'none') {
    return (
      <TouchableOpacity style={hero.joinBannerStandalone} onPress={onJoinPress} activeOpacity={0.88}>
        <LinearGradient
          colors={['#7A0EED', '#B50357']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={hero.joinBannerGrad}>
          <View style={hero.joinBannerIcon}>
            <Ionicons name="people" size={18} color="#FFFFFF" />
          </View>
          <View style={hero.joinBannerTextWrap}>
            <Text style={hero.joinBannerTitle}>Join Friend Zone</Text>
            <Text style={hero.joinBannerSubtitle}>Complete your profile to receive calls</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.85)" />
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  const coverPhoto = profile.photos?.[0] ?? profile.avatarUri;

  return (
    <View style={hero.card}>
      <View style={hero.topRow}>
        <View style={hero.photoBox}>
          {coverPhoto ? (
            <Image source={{ uri: coverPhoto }} style={hero.photo} resizeMode="contain" />
          ) : (
            <View style={[hero.photo, hero.avatarFallback]}>
              <Text style={hero.avatarInitial}>{profile.name[0]?.toUpperCase()}</Text>
            </View>
          )}
          {profile.isOnline && <View style={hero.onlineDot} />}
        </View>

        <View style={hero.info}>
          <View style={hero.nameRow}>
            <Text style={hero.name} numberOfLines={1}>{profile.name}</Text>
            <View style={hero.youPill}>
              <Text style={hero.youPillText}>You</Text>
            </View>
          </View>
          {!!profile.email && (
            <Text style={hero.email} numberOfLines={1}>{profile.email}</Text>
          )}
          <View style={[hero.statusPill, profile.isOnline ? hero.statusPillOnline : hero.statusPillOffline]}>
            <View style={[hero.statusDot, profile.isOnline ? hero.statusDotOnline : hero.statusDotOffline]} />
            <Text style={[hero.statusPillText, profile.isOnline ? hero.statusTextOnline : hero.statusTextOffline]}>
              {profile.isOnline ? 'Online' : 'Offline'}
            </Text>
          </View>
        </View>

        <TouchableOpacity onPress={onEdit} activeOpacity={0.75} style={hero.editBtn} hitSlop={8}>
          <Ionicons name="pencil-outline" size={16} color="#7A0EED" />
        </TouchableOpacity>
      </View>

      <View style={hero.toggleRow}>
        <View style={[hero.togglePill, receiveCalls && hero.togglePillActive]}>
          <Ionicons name="mic" size={14} color={receiveCalls ? '#7A0EED' : '#8B8D96'} />
          <Text style={[hero.togglePillLabel, receiveCalls && hero.togglePillLabelActive]}>
            Audio {receiveCalls ? 'On' : 'Off'}
          </Text>
          <Switch
            value={receiveCalls}
            onValueChange={onReceiveCallsToggle}
            trackColor={{ false: '#E0DDED', true: '#7A0EED' }}
            thumbColor="#FFFFFF"
            ios_backgroundColor="#E0DDED"
            style={hero.togglePillSwitch}
          />
        </View>

        <View style={[hero.togglePill, videoCalls && hero.togglePillActive]}>
          <Ionicons name="videocam" size={14} color={videoCalls ? '#7A0EED' : '#8B8D96'} />
          <Text style={[hero.togglePillLabel, videoCalls && hero.togglePillLabelActive]}>
            Video {videoCalls ? 'On' : 'Off'}
          </Text>
          <Switch
            value={videoCalls}
            onValueChange={onVideoCallToggle}
            trackColor={{ false: '#E0DDED', true: '#7A0EED' }}
            thumbColor="#FFFFFF"
            ios_backgroundColor="#E0DDED"
            style={hero.togglePillSwitch}
          />
        </View>
      </View>
    </View>
  );
}

// ── Friend Row ────────────────────────────────────────────────────────────────

function FriendRow({ friend, onAudio, onVideo, onPress }: {
  friend: Friend;
  onAudio: () => void;
  onVideo: () => void;
  onPress: () => void;
}) {
  const photos = friend.photos && friend.photos.length > 0
    ? friend.photos
    : friend.avatarUri
      ? [friend.avatarUri]
      : [];

  return (
    <View style={row.container}>
      <TouchableOpacity style={row.pressArea} onPress={onPress} activeOpacity={0.75}>
        <View style={row.avatarWrap}>
          {photos.length > 0 ? (
            <PhotoCarousel photos={photos} width={ROW_AVATAR_SIZE} height={ROW_AVATAR_SIZE} showDots={false} style={row.avatar} />
          ) : (
            <View style={[row.avatar, row.avatarFallback]}>
              <Text style={row.avatarInitial}>{friend.name[0]?.toUpperCase()}</Text>
            </View>
          )}
          {friend.isOnline && <View style={row.onlineDot} />}
        </View>

        <View style={row.info}>
          <Text style={row.name} numberOfLines={1}>{friend.name}</Text>
          <Text style={row.meta} numberOfLines={1}>
            {friend.age}Y{friend.location ? `  ·  ${friend.location}` : ''}
          </Text>
          <Text style={[row.status, friend.isOnline ? row.statusOnline : row.statusOffline]}>
            {friend.isOnline ? 'Online' : 'Offline'}
          </Text>
        </View>
      </TouchableOpacity>

      <View style={row.actions}>
        {friend.canAudio && (
          <TouchableOpacity onPress={onAudio} activeOpacity={0.85} style={row.actionBtn}>
            <LinearGradient colors={['#7A0EED', '#B50357']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={row.actionGrad}>
              <Ionicons name="call" size={14} color="#FFFFFF" />
            </LinearGradient>
          </TouchableOpacity>
        )}
        {friend.canVideo && (
          <TouchableOpacity onPress={onVideo} activeOpacity={0.85} style={row.actionBtn}>
            <LinearGradient colors={['#7A0EED', '#B50357']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={row.actionGrad}>
              <Ionicons name="videocam" size={14} color="#FFFFFF" />
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export function FriendZoneScreen({
  myProfile, onEditProfile, onJoinPress,
  receiveCalls, videoCalls,
  onReceiveCallsToggle, onVideoCallToggle,
  friends, onAudioCall, onVideoCall, onFriendPress, onHistoryPress,
  onPreviewCallUi,
}: FriendZoneScreenProps) {
  return (
    <ScrollView
      style={s.scroll}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}>

      {/* Logged-in user hero */}
      <ProfileHero
        profile={myProfile}
        onEdit={onEditProfile}
        onJoinPress={onJoinPress}
        receiveCalls={receiveCalls}
        videoCalls={videoCalls}
        onReceiveCallsToggle={onReceiveCallsToggle}
        onVideoCallToggle={onVideoCallToggle}
      />

      {/* Temporary test entry point — jumps straight into the video call
          screen UI (gift bar, chat feed, controls) with no real signaling
          or Agora connection, so the UI can be checked on-device without a
          second account. Remove once the call UI is fully verified. */}
      {onPreviewCallUi && (
        <TouchableOpacity style={s.previewBtn} onPress={onPreviewCallUi} activeOpacity={0.85}>
          <Ionicons name="flask-outline" size={16} color="#7A0EED" />
          <Text style={s.previewBtnText}>Preview Video Call UI (test only)</Text>
        </TouchableOpacity>
      )}

      {/* Section header */}
      <View style={s.sectionHeader}>
        <Text style={s.sectionTitle}>Friends ({friends.length})</Text>
        <View style={s.sectionActions}>
          <TouchableOpacity onPress={onHistoryPress} activeOpacity={0.75} style={s.historyBtn}>
            <Ionicons name="time-outline" size={16} color="#7A0EED" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Friends list */}
      {friends.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="people-outline" size={36} color="#D8D3EC" />
          <Text style={s.emptyText}>No active friends right now</Text>
        </View>
      ) : (
        <View style={s.listCard}>
          {friends.map((f, i) => (
            <View key={f.id}>
              {i > 0 && <View style={s.rowDivider} />}
              <FriendRow
                friend={f}
                onAudio={() => onAudioCall(f)}
                onVideo={() => onVideoCall(f)}
                onPress={() => onFriendPress(f)}
              />
            </View>
          ))}
        </View>
      )}

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#F5F3FA' },
  content: { paddingTop: 12, paddingHorizontal: 16 },
  previewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F4EEFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0D2FF',
    borderStyle: 'dashed',
    paddingVertical: 10,
    marginBottom: 16,
  },
  previewBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7A0EED',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1E22',
    letterSpacing: -0.2,
  },
  sectionActions: {
    flexDirection: 'row',
    gap: 8,
  },
  historyBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F0EAFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#7A0EED',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#F0EDF8',
    marginLeft: 114,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  emptyText: {
    fontSize: 13,
    color: '#B0AEC0',
    fontWeight: '500',
  },
});

const hero = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#7A0EED',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  photoBox: {
    position: 'relative',
    width: 84,
    height: 84,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#F5F3FA',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EDE8F7',
  },
  avatarInitial: {
    fontSize: 32,
    fontWeight: '700',
    color: '#7A0EED',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 11,
    height: 11,
    borderRadius: 5.5,
    backgroundColor: '#22C55E',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  info: {
    flex: 1,
    gap: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  name: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1C1E22',
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  youPill: {
    backgroundColor: '#7A0EED',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  youPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  email: {
    fontSize: 12,
    fontWeight: '500',
    color: '#60626A',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  statusPillOnline: { backgroundColor: '#EAFBF1' },
  statusPillOffline: { backgroundColor: '#FFF0F1' },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusDotOnline: { backgroundColor: '#22C55E' },
  statusDotOffline: { backgroundColor: '#E14C57' },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusTextOnline: { color: '#22C55E' },
  statusTextOffline: { color: '#E14C57' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  togglePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F5F3FA',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  togglePillActive: {
    backgroundColor: '#F4EEFF',
  },
  togglePillLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#8B8D96',
  },
  togglePillLabelActive: {
    color: '#1C1E22',
  },
  togglePillSwitch: {
    transform: [{ scale: 0.8 }],
  },
  editBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0EAFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinBannerStandalone: {
    marginBottom: 16,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#7A0EED',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  joinBannerGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  joinBannerIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinBannerTextWrap: {
    flex: 1,
    gap: 1,
  },
  joinBannerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.1,
  },
  joinBannerSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.85)',
  },
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#FFF8E1',
    borderWidth: 1,
    borderColor: '#F5E1A4',
  },
  rejectedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#FFF0F1',
    borderWidth: 1,
    borderColor: '#FFCDD0',
  },
  joinBannerIconLight: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#8A6D1F',
    letterSpacing: -0.1,
  },
  pendingSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: '#A78A3D',
  },
  rejectedTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#E14C57',
    letterSpacing: -0.1,
  },
  rejectedSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: '#C25861',
  },
});

const row = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 12,
  },
  pressArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarWrap: {
    position: 'relative',
    width: ROW_AVATAR_SIZE,
    height: ROW_AVATAR_SIZE,
  },
  avatar: {
    width: ROW_AVATAR_SIZE,
    height: ROW_AVATAR_SIZE,
    borderRadius: 16,
    overflow: 'hidden',
  },
  avatarFallback: {
    backgroundColor: '#EDE8F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 30,
    fontWeight: '700',
    color: '#7A0EED',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 13,
    height: 13,
    borderRadius: 6.5,
    backgroundColor: '#22C55E',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1C1E22',
    letterSpacing: -0.1,
  },
  meta: {
    fontSize: 11,
    fontWeight: '500',
    color: '#ABADB2',
  },
  status: {
    fontSize: 11,
    fontWeight: '600',
  },
  statusOnline: {
    color: '#22C55E',
  },
  statusOffline: {
    color: '#E14C57',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#7A0EED',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  actionGrad: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
