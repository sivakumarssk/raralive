import { Ionicons } from '@expo/vector-icons';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Image as ExpoImage } from 'expo-image';
import { apiPostTags, apiTrendingPostTags, BASE_URL, MEDIA_BASE, type PostTag } from '@/services/api';
import { avatarSource } from '@/utils/default-avatar';
import { authStore } from '@/store/auth-store';
import type { FeedPost } from '@/screens/home/home-screen';
import { PostTile } from './post-tile';

type TopSearch = { term: string; display: string; searches: number };
type FollowedPerson = {
  id: string; full_name: string | null; username: string | null; avatar_url: string | null;
  gender: string | null; followers_count: number;
};
type ExploreData = {
  top_searches: TopSearch[];
  most_liked: FeedPost[];
  most_saved: FeedPost[];
  /** likes + saves + downloads, recent first */
  trending?: FeedPost[];
  most_followed?: FollowedPerson[];
  /** videos, by views (counted after half the video is watched) */
  most_viewed?: FeedPost[];
};

// Category card accents, picked by position
const ACCENTS: [string, string][] = [
  ['#7A0EED', '#B26BFF'], ['#E91E7F', '#FF7AB8'], ['#1D6FE0', '#62A5FF'],
  ['#F59E0B', '#FFC861'], ['#0D9488', '#4FD1C5'], ['#DC2626', '#FF7A7A'],
];

const TILE_W = 118;
const TILE_H = 158;

/**
 * Explore: search bar (opens Search, same as Home), today's most searched
 * terms, every category with its sub categories (tap → that category's
 * posts), and the most liked / most saved posts.
 */
export function ExploreScreen() {
  const router = useRouter();
  const tabBarHeight = useBottomTabBarHeight();
  const [data, setData] = useState<ExploreData | null>(null);
  const [categories, setCategories] = useState<PostTag[]>([]);
  const [trending, setTrending] = useState<PostTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const token = authStore.getToken();
    const [explore, tags, trend] = await Promise.all([
      fetch(`${BASE_URL}/posts/explore`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
        .then(r => r.json()).catch(() => null),
      apiPostTags(),
      apiTrendingPostTags(),
    ]);
    if (explore?.success) setData(explore.data);
    if (tags.ok) setCategories(tags.data);
    if (trend.ok) setTrending(trend.data);
  }, []);

  // Refresh each time the tab is opened — "most searched today" keeps changing
  useFocusEffect(useCallback(() => {
    load().finally(() => setLoading(false));
  }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const search = (q?: string) =>
    router.push((q ? { pathname: '/search', params: { q } } : '/search') as never);

  const openCategory = (main: PostTag, sub?: PostTag) =>
    router.push({
      pathname: '/category-posts',
      params: { tab: main.id, ...(sub ? { tag: sub.id } : {}), title: sub ? sub.name : main.name },
    } as never);

  const topSearches = data?.top_searches ?? [];
  const mostLiked = data?.most_liked ?? [];
  const mostSaved = data?.most_saved ?? [];
  const trendingPosts = data?.trending ?? [];
  const mostFollowed = data?.most_followed ?? [];
  const mostViewed = data?.most_viewed ?? [];

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Text style={s.title}>Explore</Text>
        {/* Same search as the Home page's search icon */}
        <Pressable style={s.searchBar} onPress={() => search()} accessibilityRole="search" accessibilityLabel="Search">
          <Ionicons name="search" size={18} color="#8A8C93" />
          <RotatingPlaceholder />
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color="#7A0EED" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: tabBarHeight + 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7A0EED" colors={['#7A0EED']} />}>

          {/* Most searched today — or what's trending if nobody has searched yet */}
          {topSearches.length > 0 ? (
            <Section title="Most searched today" icon="flame">
              <View style={s.chipWrap}>
                {topSearches.map((t, i) => (
                  <TouchableOpacity key={t.term} style={s.searchChip} onPress={() => search(t.display)} activeOpacity={0.8}>
                    <View style={[s.rank, i < 3 && s.rankTop]}>
                      <Text style={[s.rankText, i < 3 && s.rankTextTop]}>{i + 1}</Text>
                    </View>
                    <Text style={s.searchChipText} numberOfLines={1}>{t.display}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Section>
          ) : trending.length > 0 ? (
            <Section title="Trending now" icon="trending-up">
              <View style={s.chipWrap}>
                {trending.map(t => (
                  <TouchableOpacity key={t.id} style={s.searchChip} onPress={() => search(`#${t.name}`)} activeOpacity={0.8}>
                    <Text style={s.hash}>#</Text>
                    <Text style={s.searchChipText} numberOfLines={1}>{t.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Section>
          ) : null}

          {trendingPosts.length > 0 && (
            <Section title="Trending" icon="flame">
              <PostStrip posts={trendingPosts} badge={() => ({ icon: 'flame' })} />
            </Section>
          )}

          {mostFollowed.length > 0 && (
            <Section title="Most followed people" icon="people">
              <FlatList
                horizontal
                data={mostFollowed}
                keyExtractor={u => u.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.strip}
                renderItem={({ item }) => <PersonCard person={item} />}
              />
            </Section>
          )}

          {/* Categories with their sub categories */}
          {categories.length > 0 && (
            <Section title="All categories" icon="grid">
              {categories.map((cat, i) => {
                const [c1, c2] = ACCENTS[i % ACCENTS.length];
                const subs = cat.children ?? [];
                return (
                  <View key={cat.id} style={s.catCard}>
                    <TouchableOpacity style={s.catHead} onPress={() => openCategory(cat)} activeOpacity={0.8}>
                      <LinearGradient colors={[c1, c2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.catIcon}>
                        <Text style={s.catIconText}>{cat.name.trim().charAt(0).toUpperCase()}</Text>
                      </LinearGradient>
                      <View style={{ flex: 1 }}>
                        <Text style={s.catName} numberOfLines={1}>{cat.name}</Text>
                        <Text style={s.catSub}>{subs.length ? `${subs.length} sub categories` : 'View posts'}</Text>
                      </View>
                      <Text style={[s.seeAll, { color: c1 }]}>See all</Text>
                      <Ionicons name="chevron-forward" size={15} color={c1} />
                    </TouchableOpacity>
                    {subs.length > 0 && (
                      <View style={s.subWrap}>
                        {subs.map(sub => (
                          <TouchableOpacity
                            key={sub.id}
                            style={[s.subChip, { borderColor: `${c1}40`, backgroundColor: `${c1}10` }]}
                            onPress={() => openCategory(cat, sub)}
                            activeOpacity={0.8}>
                            <Text style={[s.subChipText, { color: c1 }]} numberOfLines={1}>{sub.name}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })}
            </Section>
          )}

          {mostViewed.length > 0 && (
            <Section title="Most viewed" icon="eye">
              <PostStrip posts={mostViewed} badge={p => ({ icon: 'eye', count: p.views_count ?? 0 })} />
            </Section>
          )}

          {mostLiked.length > 0 && (
            <Section title="Most liked" icon="heart">
              <PostStrip posts={mostLiked} badge={p => ({ icon: 'heart', count: p.likes_count })} />
            </Section>
          )}

          {mostSaved.length > 0 && (
            <Section title="Most saved" icon="bookmark">
              <PostStrip posts={mostSaved} badge={() => ({ icon: 'bookmark' })} />
            </Section>
          )}

          {!topSearches.length && !trending.length && !categories.length && !mostLiked.length && !mostSaved.length
            && !trendingPosts.length && !mostFollowed.length && !mostViewed.length && (
            <View style={s.empty}>
              <Ionicons name="compass-outline" size={48} color="#D0C8F0" />
              <Text style={s.emptyText}>Nothing to explore yet</Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// "Search posts" → "Search profiles" → … — the word scrolls up every couple of seconds
const PLACEHOLDER_WORDS = ['posts', 'profiles', '#tags', 'videos', 'categories'];
const PLACEHOLDER_LINE = 20;

function RotatingPlaceholder() {
  const [index, setIndex] = useState(0);
  const slide = useRef(new Animated.Value(0)).current;   // 0 = shown, -1 = gone up, 1 = coming from below

  useEffect(() => {
    const timer = setInterval(() => {
      // Current word slides up and out, the next one slides up into place
      Animated.timing(slide, { toValue: -1, duration: 220, useNativeDriver: true }).start(() => {
        setIndex(i => (i + 1) % PLACEHOLDER_WORDS.length);
        slide.setValue(1);
        Animated.timing(slide, { toValue: 0, duration: 220, useNativeDriver: true }).start();
      });
    }, 2200);
    return () => clearInterval(timer);
  }, [slide]);

  return (
    <View style={s.placeholderRow}>
      <Text style={s.searchPlaceholder}>Search </Text>
      <View style={s.placeholderWindow}>
        <Animated.Text
          style={[
            s.searchPlaceholder,
            s.placeholderWord,
            {
              opacity: slide.interpolate({ inputRange: [-1, 0, 1], outputRange: [0, 1, 0] }),
              transform: [{ translateY: slide.interpolate({ inputRange: [-1, 1], outputRange: [-PLACEHOLDER_LINE, PLACEHOLDER_LINE] }) }],
            },
          ]}
          numberOfLines={1}>
          {PLACEHOLDER_WORDS[index]}
        </Animated.Text>
      </View>
    </View>
  );
}

function Section({ title, icon, children }: { title: string; icon: keyof typeof Ionicons.glyphMap; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <View style={s.sectionHead}>
        <Ionicons name={icon} size={16} color="#7A0EED" />
        <Text style={s.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function followersLabel(n: number) {
  const short = n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
    : n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K` : String(n);
  return `${short} ${n === 1 ? 'follower' : 'followers'}`;
}

/** Avatar, name and follower count — tap opens their profile. */
function PersonCard({ person }: { person: FollowedPerson }) {
  const router = useRouter();
  const name = person.username ?? person.full_name ?? 'User';
  const uri = person.avatar_url
    ? (person.avatar_url.startsWith('http') ? person.avatar_url : `${MEDIA_BASE}/${person.avatar_url.replace(/^\//, '')}`)
    : null;
  return (
    <TouchableOpacity style={s.person} onPress={() => router.push(`/user/${person.id}` as never)} activeOpacity={0.8}>
      <View style={s.personRing}>
        <ExpoImage source={avatarSource(uri, person.gender)} style={s.personAvatar} contentFit="cover" />
      </View>
      <Text style={s.personName} numberOfLines={1}>{name}</Text>
      <Text style={s.personFollowers} numberOfLines={1}>{followersLabel(person.followers_count)}</Text>
    </TouchableOpacity>
  );
}

function PostStrip({ posts, badge }: {
  posts: FeedPost[];
  badge: (p: FeedPost) => { icon: 'heart' | 'bookmark' | 'eye' | 'flame'; count?: number };
}) {
  return (
    <FlatList
      horizontal
      data={posts}
      keyExtractor={p => p.id}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.strip}
      renderItem={({ item }) => <PostTile post={item} width={TILE_W} height={TILE_H} badge={badge(item)} />}
    />
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10, gap: 10 },
  title: { fontSize: 22, fontWeight: '800', color: '#1C1E22' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8, height: 42, paddingHorizontal: 14,
    borderRadius: 21, backgroundColor: '#F4F2FA', borderWidth: 1, borderColor: '#ECE8F6',
  },
  searchPlaceholder: { fontSize: 14, lineHeight: PLACEHOLDER_LINE, color: '#8A8C93' },
  placeholderRow: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  // Clips the word as it scrolls in and out
  placeholderWindow: { height: PLACEHOLDER_LINE, overflow: 'hidden', justifyContent: 'center' },
  placeholderWord: { fontWeight: '600', color: '#7A0EED' },

  section: { marginTop: 14 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#1C1E22' },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16 },
  searchChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%',
    paddingLeft: 6, paddingRight: 12, height: 34, borderRadius: 17,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#ECE8F6',
  },
  rank: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#F1EEF8', alignItems: 'center', justifyContent: 'center' },
  rankTop: { backgroundColor: '#7A0EED' },
  rankText: { fontSize: 11, fontWeight: '800', color: '#8A8C93' },
  rankTextTop: { color: '#FFFFFF' },
  hash: { marginLeft: 6, fontSize: 14, fontWeight: '800', color: '#7A0EED' },
  searchChipText: { flexShrink: 1, fontSize: 13, fontWeight: '600', color: '#1C1E22' },

  catCard: {
    marginHorizontal: 16, marginBottom: 10, padding: 12, borderRadius: 16,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EFECF7',
  },
  catHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  catIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  catIconText: { fontSize: 17, fontWeight: '900', color: '#FFFFFF' },
  catName: { fontSize: 15, fontWeight: '800', color: '#1C1E22' },
  catSub: { marginTop: 1, fontSize: 12, color: '#8A8C93' },
  seeAll: { fontSize: 12, fontWeight: '700' },
  subWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  subChip: { paddingHorizontal: 12, height: 30, borderRadius: 15, borderWidth: 1, justifyContent: 'center', maxWidth: '100%' },
  subChipText: { fontSize: 12, fontWeight: '700' },

  strip: { paddingHorizontal: 16, gap: 8 },

  person: { width: 84, alignItems: 'center' },
  personRing: { padding: 2, borderRadius: 36, borderWidth: 2, borderColor: '#7A0EED' },
  personAvatar: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#EEE9F8' },
  personName: { marginTop: 6, fontSize: 12, fontWeight: '700', color: '#1C1E22', maxWidth: 84 },
  personFollowers: { marginTop: 1, fontSize: 11, color: '#8A8C93' },

  empty: { alignItems: 'center', gap: 10, paddingTop: 60 },
  emptyText: { fontSize: 14, color: '#8A8C93' },
});
