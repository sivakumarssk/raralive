import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BASE_URL, MEDIA_BASE } from '@/services/api';
import { authStore } from '@/store/auth-store';

const SCREEN_W  = Dimensions.get('window').width;
const COVER_H   = 200;
const AVATAR_SZ = 84;
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

  const [profile,   setProfile]   = useState<Profile | null>(null);
  const [posts,     setPosts]     = useState<Post[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [following, setFollowing] = useState(false);
  const [fLoading,  setFLoading]  = useState(false);
  const [error,     setError]     = useState('');

  const token         = authStore.getToken();
  const currentUserId = authStore.getUserId();
  const isOwnProfile  = !!currentUserId && currentUserId === id;
  const authHeaders   = token ? { Authorization: `Bearer ${token}` } : {};

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
  const initials    = displayName.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
  const genderLabel = profile.gender
    ? profile.gender.charAt(0).toUpperCase() + profile.gender.slice(1)
    : null;

  return (
    <View style={s.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 60 }}
        stickyHeaderIndices={[]}
      >
        {/* Cover */}
        <View style={s.coverWrap}>
          {coverUri
            ? <Image source={{ uri: coverUri }} style={s.cover} resizeMode="cover" />
            : <LinearGradient
                colors={['#4B00E8', '#7A04E5', '#B40CF0', '#FF2A76']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={s.cover}
              />}

          {/* Back button over cover */}
          <SafeAreaView style={StyleSheet.absoluteFill} edges={['top']} pointerEvents="box-none">
            <TouchableOpacity style={s.backBtnCover} onPress={() => router.back()} activeOpacity={0.8}>
              <Ionicons name="chevron-back" size={22} color="#FFF" />
            </TouchableOpacity>
          </SafeAreaView>
        </View>

        {/* Avatar + stats row */}
        <View style={s.avatarRow}>
          <View style={s.avatarWrap}>
            {avatarUri
              ? <Image source={{ uri: avatarUri }} style={s.avatar} />
              : <LinearGradient colors={['#7A0EED', '#B50357']} style={s.avatar}>
                  <Text style={s.avatarInit}>{initials}</Text>
                </LinearGradient>}
          </View>
          <View style={s.statsRow}>
            <Stat value={profile.followers_count} label="Followers" />
            <View style={s.statDiv} />
            <Stat value={profile.following_count} label="Following" />
            <View style={s.statDiv} />
            <Stat value={profile.posts_count}     label="Posts" />
          </View>
        </View>

        {/* Name / username / gender / bio */}
        <View style={s.nameBlock}>
          <Text style={s.displayName}>{displayName}</Text>
          {!!profile.username && <Text style={s.username}>@{profile.username}</Text>}
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
          {!!profile.bio && <Text style={s.bio}>{profile.bio}</Text>}
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
                  }
                } catch {}
              }}>
              <Ionicons name="chatbubble-ellipses-outline" size={18} color="#7A0EED" />
            </TouchableOpacity>
            <TouchableOpacity style={s.iconBtn} activeOpacity={0.85}>
              <Ionicons name="share-social-outline" size={18} color="#7A0EED" />
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
      </ScrollView>
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
  cover:     { width: SCREEN_W, height: COVER_H },
  backBtnCover: {
    margin: 14,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },

  // avatar + stats
  avatarRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, marginTop: -(AVATAR_SZ / 2), gap: 12,
  },
  avatarWrap: { width: AVATAR_SZ, height: AVATAR_SZ },
  avatar: {
    width: AVATAR_SZ, height: AVATAR_SZ,
    borderRadius: AVATAR_SZ / 2,
    borderWidth: 3, borderColor: '#FFF',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInit: { fontSize: 28, fontWeight: '800', color: '#FFF' },
  statsRow:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', marginTop: AVATAR_SZ / 2 + 4 },
  statBox:    { alignItems: 'center', flex: 1 },
  statVal:    { fontSize: 18, fontWeight: '800', color: '#1C1E22' },
  statLbl:    { fontSize: 11, color: '#ABADB2', fontWeight: '600', marginTop: 1 },
  statDiv:    { width: 1, height: 28, backgroundColor: '#EBEBEB' },

  // name block
  nameBlock:   { paddingHorizontal: 18, marginTop: 48, gap: 4 },
  displayName: { fontSize: 19, fontWeight: '800', color: '#1C1E22' },
  username:    { fontSize: 13, color: '#7A0EED', fontWeight: '600' },
  genderBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start', backgroundColor: '#F4EEFF',
    borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3,
  },
  genderTxt:   { fontSize: 11, fontWeight: '700', color: '#7A0EED' },
  bio:         { fontSize: 13, color: '#60626A', lineHeight: 19, marginTop: 2 },

  // actions
  actionRow:    { flexDirection: 'row', gap: 10, paddingHorizontal: 18, marginTop: 14 },
  followBtn:    { flex: 1, height: 38, borderRadius: 20, backgroundColor: '#7A0EED', alignItems: 'center', justifyContent: 'center' },
  followingBtn: { backgroundColor: '#FFF', borderWidth: 1.5, borderColor: '#7A0EED' },
  followTxt:    { fontSize: 14, fontWeight: '700', color: '#FFF' },
  followingTxt: { color: '#7A0EED' },
  iconBtn:      { width: 38, height: 38, borderRadius: 20, borderWidth: 1.5, borderColor: '#7A0EED', alignItems: 'center', justifyContent: 'center' },

  // grid
  gridWrap:        { marginTop: 18, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#EBEBEB' },
  gridItem:        { width: GRID_SIZE, height: GRID_SIZE, backgroundColor: '#EDE8FF' },
  gridImg:         { width: GRID_SIZE, height: GRID_SIZE },
  gridPlaceholder: { width: GRID_SIZE, height: GRID_SIZE, alignItems: 'center', justifyContent: 'center' },
  vidBadge:        { position: 'absolute', top: 6, right: 6 },
  emptyWrap:       { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, gap: 10 },
  emptyTxt:        { fontSize: 14, color: '#ABADB2' },
});
