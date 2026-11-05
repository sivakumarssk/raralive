import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useIsFocused } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { BASE_URL, MEDIA_BASE } from '@/services/api';
import { authStore } from '@/store/auth-store';
import { ImageViewer } from '@/components/ImageViewer';
import { UserLevelBadge } from '@/components/UserLevel';
import { useProfileScroll } from '@/hooks/use-profile-scroll';
import { getUserLevel } from '@/utils/userLevel';
import { REPORT_GUIDANCE, ReportReasonModal, USER_REPORT_REASONS } from '@/screens/room-detail/components/report-reason-modal';
import { avatarSource } from '@/utils/default-avatar';

const SCREEN_W  = Dimensions.get('window').width;
// Scaled to screen width so proportions stay the same on every device
const COVER_H   = Math.round(SCREEN_W * 0.42);
const AVATAR_SZ = Math.round(SCREEN_W * 0.22);
// How much of the avatar overlaps the cover
const AVATAR_OVERLAP = Math.round(AVATAR_SZ * 0.3);
const GRID_SIZE = (SCREEN_W - 4) / 3;

type Profile = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  bio: string | null;
  gender: string | null;
  followers_count: number;
  following_count: number;
  posts_count: number;
  coins_gifted: number;
};

type PostMedia = { id: string; media_url: string; media_type: 'photo' | 'video' };
type Post = { id: string; likes_count: number; media: PostMedia[] };

function resolveUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  try { return `${MEDIA_BASE}${new URL(url).pathname}`; }
  catch { return `${MEDIA_BASE}/${url.replace(/^\//, '')}`; }
}

function Stat({ value, label }: { value: number; label: string }) {
  const n = value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value);
  return (
    <View style={s.statBox}>
      <Text style={s.statVal}>{n}</Text>
      <Text style={s.statLbl}>{label}</Text>
    </View>
  );
}

export default function UserProfilePage() {
  const router = useRouter();
  const { id }  = useLocalSearchParams<{ id: string }>();
  const insets  = useSafeAreaInsets();
  const [viewing, setViewing] = useState<'avatar' | 'cover' | null>(null);
  const scroll = useProfileScroll(COVER_H);
  const isFocused = useIsFocused();

  const [profile,   setProfile]   = useState<Profile | null>(null);
  const [posts,     setPosts]     = useState<Post[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [following, setFollowing] = useState(false);
  const [fLoading,  setFLoading]  = useState(false);
  const [error,     setError]     = useState('');
  const [reportVisible, setReportVisible] = useState(false);

  const token         = authStore.getToken();
  const currentUserId = authStore.getUserId();
  const isOwnProfile  = !!currentUserId && currentUserId === id;
  const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  useEffect(() => {
    if (!id) { setError('No user ID'); setLoading(false); return; }

    const load = async () => {
      try {
        const [profRes, postsRes] = await Promise.all([
          fetch(`${BASE_URL}/auth/users/${id}`, { headers: authHeaders }).then(r => r.json()),
          fetch(`${BASE_URL}/posts/user/${id}`,  { headers: authHeaders }).then(r => r.json()),
        ]);

        if (profRes.success && profRes.data) {
          setProfile(profRes.data);
        } else {
          setError(profRes.message || 'User not found');
        }

        if (postsRes.success) setPosts(postsRes.data ?? []);

        // check follow status separately so profile loads even if this fails
        if (token && !isOwnProfile) {
          fetch(`${BASE_URL}/auth/follow/${id}`, { headers: authHeaders })
            .then(r => r.json())
            .then(j => { if (j.success) setFollowing(j.following); })
            .catch(() => {});
        }
      } catch (e: any) {
        setError('Network error');
      } finally {
        setLoading(false);
      }
    };

    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleFollow = async () => {
    if (!id || fLoading || !token) return;
    setFLoading(true);
    const was = following;
    setFollowing(!was);
    try {
      const res  = await fetch(`${BASE_URL}/auth/follow/${id}`, {
        method: was ? 'DELETE' : 'POST',
        headers: authHeaders,
      });
      const json = await res.json();
      if (!json.success) {
        setFollowing(was);
      } else {
        setProfile(p => p ? { ...p, followers_count: p.followers_count + (was ? -1 : 1) } : p);
      }
    } catch {
      setFollowing(was);
    } finally {
      setFLoading(false);
    }
  };

  // Resolves to null on success, else an error message for the report popup
  const handleSubmitReport = async (reason: string): Promise<string | null> => {
    if (!token) return 'Please log in again.';
    try {
      const res  = await fetch(`${BASE_URL}/auth/users/${id}/report`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const json = await res.json().catch(() => ({}));
      return res.ok && json.success !== false ? null : (json.message || 'Could not send. Please try again.');
    } catch {
      return 'Network error. Please try again.';
    }
  };

  if (loading) {
    return (
      <View style={s.root}>
        <SafeAreaView style={s.safe} edges={['top']}>
          <View style={s.backRow}>
            <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={22} color="#1C1E22" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
        <View style={s.center}><ActivityIndicator size="large" color="#7A0EED" /></View>
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={s.root}>
        <SafeAreaView style={s.safe} edges={['top']}>
          <View style={s.backRow}>
            <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={22} color="#1C1E22" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
        <View style={s.center}>
          <Ionicons name="person-outline" size={48} color="#D0C8F0" />
          <Text style={s.errTxt}>{error || 'User not found'}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => router.back()}>
            <Text style={s.retryTxt}>Go back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const avatarUri   = resolveUrl(profile.avatar_url);
  const coverUri    = resolveUrl(profile.cover_url);
  const displayName = profile.full_name || profile.username || 'User';
  const genderLabel = profile.gender
    ? profile.gender.charAt(0).toUpperCase() + profile.gender.slice(1)
    : null;

  return (
    <View style={s.root}>
      {/* White status bar icons over the cover — only while this screen is focused */}
      {isFocused && <StatusBar style="light" />}
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 60, minHeight: scroll.contentMinHeight }}
        stickyHeaderIndices={[]}
        onScroll={scroll.onScroll}
        scrollEventThrottle={16}
      >
        {/* Cover — extends up behind the status bar, same as own profile; tap to view it */}
        <Animated.View style={[s.coverWrap, { height: COVER_H + insets.top }, scroll.coverStyle]}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={0.9}
            disabled={!coverUri}
            onPress={() => setViewing('cover')}
            accessibilityLabel="View cover photo">
            {coverUri
              ? <Image source={{ uri: coverUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              : <LinearGradient
                  colors={['#4B00E8', '#7A04E5', '#B40CF0', '#FF2A76']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />}
          </TouchableOpacity>
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, s.coverDim, scroll.coverDimStyle]} />
        </Animated.View>

        {/* Everything below the cover slides up over it on scroll */}
        <View style={s.profileBody}>
        <View style={s.profileBodyBg} />

        {/* Avatar + stats row */}
        <View style={s.avatarRow}>
          <Animated.View style={[s.avatarWrap, scroll.avatarStyle]}>
            <TouchableOpacity
              activeOpacity={0.9}
              disabled={!avatarUri}
              onPress={() => setViewing('avatar')}
              accessibilityLabel="View profile photo">
              <Image source={avatarSource(avatarUri, profile.gender)} style={s.avatar} />
            </TouchableOpacity>
          </Animated.View>
          {/* @username on top, stats below — beside the avatar */}
          <View style={s.infoCol}>
            {!!profile.username && <Text style={s.username} numberOfLines={1}>@{profile.username}</Text>}
            <View style={s.statsRow}>
              <Stat value={profile.followers_count} label="Followers" />
              <View style={s.statDiv} />
              <Stat value={profile.following_count} label="Following" />
              <View style={s.statDiv} />
              <Stat value={profile.posts_count}     label="Posts" />
            </View>
          </View>
        </View>

        {/* Name / gender / bio */}
        <View style={s.nameBlock}>
          <Text style={s.displayName}>{displayName}</Text>
          {!!profile.bio && <Text style={s.bio}>{profile.bio}</Text>}
          {genderLabel && (
            <View style={s.genderBadge}>
              <Ionicons
                name={
                  genderLabel === 'Female' ? 'female-outline'
                  : genderLabel === 'Male' ? 'male-outline'
                  : 'person-outline'
                }
                size={12} color="#7A0EED"
              />
              <Text style={s.genderTxt}>{genderLabel}</Text>
            </View>
          )}
        </View>

        {/* Level badge — above the action buttons, same as own profile */}
        <View style={s.chipRow}>
          <UserLevelBadge size="pill" level={getUserLevel(profile.coins_gifted)} />
        </View>

        {/* Action buttons */}
        {!isOwnProfile && (
          <View style={s.actionRow}>
            <TouchableOpacity
              style={[s.followBtn, following && s.followingBtn]}
              onPress={handleFollow}
              disabled={fLoading}
              activeOpacity={0.85}>
              {fLoading
                ? <ActivityIndicator size="small" color={following ? '#7A0EED' : '#FFF'} />
                : <Text style={[s.followTxt, following && s.followingTxt]}>
                    {following ? 'Following' : 'Follow'}
                  </Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={s.iconBtn}
              activeOpacity={0.85}
              onPress={async () => {
                if (!token) return;
                try {
                  const res  = await fetch(`${BASE_URL}/chat/conversations`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ peerId: id }),
                  });
                  const json = await res.json();
                  if (json.success && json.data?.id) {
                    router.push(`/chat/${json.data.id}` as any);
                  } else {
                    Alert.alert('Could not open chat', json.message || 'Something went wrong.');
                  }
                } catch {
                  Alert.alert('Could not open chat', 'Network error. Check your connection.');
                }
              }}>
              <Ionicons name="chatbubble-ellipses-outline" size={17} color="#7A0EED" />
            </TouchableOpacity>
            <TouchableOpacity style={s.iconBtn} activeOpacity={0.85}>
              <Ionicons name="share-social-outline" size={17} color="#7A0EED" />
            </TouchableOpacity>
            <TouchableOpacity style={[s.iconBtn, s.reportBtn]} activeOpacity={0.85} onPress={() => setReportVisible(true)}>
              <Ionicons name="flag-outline" size={16} color="#E14C57" />
            </TouchableOpacity>
          </View>
        )}

        {/* Posts grid */}
        <View style={s.gridWrap}>
          {posts.length === 0
            ? (
              <View style={s.emptyWrap}>
                <Ionicons name="images-outline" size={48} color="#D0C8F0" />
                <Text style={s.emptyTxt}>No posts yet</Text>
              </View>
            )
            : (
              <FlatList
                data={posts}
                numColumns={3}
                scrollEnabled={false}
                keyExtractor={p => p.id}
                ItemSeparatorComponent={() => <View style={{ height: 2 }} />}
                columnWrapperStyle={{ gap: 2 }}
                renderItem={({ item }) => {
                  const media  = item.media?.[0];
                  const uri    = media ? resolveUrl(media.media_url) : null;
                  const isVid  = media?.media_type === 'video';
                  return (
                    <View style={s.gridItem}>
                      {uri
                        ? <Image source={{ uri }} style={s.gridImg} resizeMode="cover" />
                        : <View style={s.gridPlaceholder}>
                            <Ionicons name="image-outline" size={24} color="#C4B5F8" />
                          </View>}
                      {isVid && (
                        <View style={s.vidBadge}>
                          <Ionicons name="play" size={12} color="#FFF" />
                        </View>
                      )}
                    </View>
                  );
                }}
              />
            )}
        </View>
        </View>
      </Animated.ScrollView>

      {/* Pinned, so back stays reachable while the page scrolls */}
      <TouchableOpacity style={[s.backBtnCover, { top: insets.top + 8 }]} onPress={() => router.back()} activeOpacity={0.8}>
        <Ionicons name="chevron-back" size={22} color="#FFF" />
      </TouchableOpacity>

      <ImageViewer
        uri={viewing === 'cover' ? coverUri ?? null : viewing === 'avatar' ? avatarUri ?? null : null}
        title={viewing === 'cover' ? 'Cover photo' : 'Profile photo'}
        subtitle={displayName}
        onClose={() => setViewing(null)}
      />

      <ReportReasonModal
        visible={reportVisible}
        title="Report User"
        subtitle={`Why are you reporting ${displayName}?`}
        notice={REPORT_GUIDANCE}
        reasons={USER_REPORT_REASONS}
        onClose={() => setReportVisible(false)}
        onSubmit={handleSubmitReport}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFF' },
  safe: { backgroundColor: 'transparent' },

  // loading/error states
  backRow: { paddingHorizontal: 14, paddingTop: 8 },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#F5F3FA',
    alignItems: 'center', justifyContent: 'center',
  },
  center:   { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errTxt:   { fontSize: 14, color: '#ABADB2', textAlign: 'center' },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 9, borderRadius: 20, backgroundColor: '#F4EEFF' },
  retryTxt: { fontSize: 14, fontWeight: '700', color: '#7A0EED' },

  // cover
  coverWrap: { width: SCREEN_W, height: COVER_H },
  backBtnCover: {
    position: 'absolute', top: 10, left: 12,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },

  // avatar + stats
  coverDim: { backgroundColor: '#000' },
  // Overlaps the cover by the avatar's overhang; the white panel starts below
  // that, so the avatar sits half on the cover and the page slides over it
  profileBody: { marginTop: -AVATAR_OVERLAP },
  profileBodyBg: {
    position: 'absolute', top: AVATAR_OVERLAP, left: 0, right: 0, bottom: -60,
    backgroundColor: '#FFF', borderTopLeftRadius: 18, borderTopRightRadius: 18,
  },
  avatarRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: 14, gap: 10,
  },
  avatarWrap: { position: 'relative', width: AVATAR_SZ, height: AVATAR_SZ, transformOrigin: 'left bottom' },
  avatar: {
    width: AVATAR_SZ, height: AVATAR_SZ,
    borderRadius: AVATAR_SZ / 2,
    borderWidth: 2.5, borderColor: '#FFF',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInit: { fontSize: 24, fontWeight: '800', color: '#FFF' },
  infoCol:    { flex: 1, marginTop: AVATAR_OVERLAP + 6, gap: 6 },
  username:   { fontSize: 15, color: '#7A0EED', fontWeight: '700' },
  statsRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  statBox:    { alignItems: 'center', flex: 1 },
  statVal:    { fontSize: 16, fontWeight: '700', color: '#1C1E22' },
  statLbl:    { fontSize: 12, color: '#8A8C93', fontWeight: '500' },
  statDiv:    { width: 1, height: 22, backgroundColor: '#EBEBEB' },

  // name block
  nameBlock:   { paddingHorizontal: 16, marginTop: 8, gap: 2 },
  chipRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, marginTop: 8 },
  displayName: { fontSize: 18, fontWeight: '800', color: '#1C1E22' },
  genderBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    alignSelf: 'flex-start', backgroundColor: '#F4EEFF',
    borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2, marginTop: 3,
  },
  genderTxt:   { fontSize: 11, fontWeight: '700', color: '#7A0EED' },
  bio:         { fontSize: 14, color: '#3A3C42', lineHeight: 20, marginTop: 2 },

  // actions
  actionRow:    { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginTop: 10 },
  followBtn:    { flex: 1, height: 34, borderRadius: 17, backgroundColor: '#7A0EED', alignItems: 'center', justifyContent: 'center' },
  followingBtn: { backgroundColor: '#FFF', borderWidth: 1.5, borderColor: '#7A0EED' },
  followTxt:    { fontSize: 13.5, fontWeight: '700', color: '#FFF' },
  followingTxt: { color: '#7A0EED' },
  iconBtn:      { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: '#7A0EED', alignItems: 'center', justifyContent: 'center' },
  reportBtn:    { borderColor: '#E14C57' },

  // grid
  gridWrap:        { marginTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#EBEBEB' },
  gridItem:        { width: GRID_SIZE, height: GRID_SIZE, backgroundColor: '#EDE8FF' },
  gridImg:         { width: GRID_SIZE, height: GRID_SIZE },
  gridPlaceholder: { width: GRID_SIZE, height: GRID_SIZE, alignItems: 'center', justifyContent: 'center' },
  vidBadge:        { position: 'absolute', top: 6, right: 6 },
  emptyWrap:       { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, gap: 10 },
  emptyTxt:        { fontSize: 14, color: '#ABADB2' },
});
