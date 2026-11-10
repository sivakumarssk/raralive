import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppScreenHeader } from '@/components/ui/app-screen-header';
import { BASE_URL } from '@/services/api';
import { authStore } from '@/store/auth-store';
import type { FeedPost } from '@/screens/home/home-screen';
import { PostTile } from './post-tile';

const PAGE = 30;
const COLS = 3;
const GAP = 4;

/**
 * Posts in one category (or one of its sub categories), newest first, as a
 * 3-column grid that loads more as you scroll. Tap a post to open it.
 * Opened from Explore → All categories.
 */
export function CategoryPostsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { tab, tag, title } = useLocalSearchParams<{ tab: string; tag?: string; title?: string }>();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const total = useRef(Infinity);

  const fetchPage = useCallback(async (offset: number) => {
    const token = authStore.getToken();
    const params = new URLSearchParams({ tab: String(tab ?? ''), limit: String(PAGE), offset: String(offset) });
    if (tag) params.set('tag', String(tag));
    const j = await fetch(`${BASE_URL}/posts/feed?${params}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).then(r => r.json()).catch(() => null);
    if (!j?.success) return [];
    total.current = j.total ?? Infinity;
    return j.data as FeedPost[];
  }, [tab, tag]);

  useEffect(() => {
    fetchPage(0).then(setPosts).finally(() => setLoading(false));
  }, [fetchPage]);

  const loadMore = async () => {
    if (loadingMore || loading || posts.length >= total.current) return;
    setLoadingMore(true);
    const more = await fetchPage(posts.length);
    setPosts(prev => [...prev, ...more.filter(p => !prev.some(x => x.id === p.id))]);
    setLoadingMore(false);
  };

  const tileW = (width - GAP * (COLS + 1)) / COLS;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <AppScreenHeader title={title || 'Posts'} onBack={() => router.back()} />
      {loading ? (
        <ActivityIndicator color="#7A0EED" style={{ marginTop: 40 }} />
      ) : posts.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="images-outline" size={48} color="#D0C8F0" />
          <Text style={s.emptyText}>No posts in this category yet</Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={p => p.id}
          numColumns={COLS}
          contentContainerStyle={s.grid}
          columnWrapperStyle={{ gap: GAP }}
          ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
          renderItem={({ item }) => <PostTile post={item} width={tileW} height={tileW * 1.33} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={loadingMore ? <ActivityIndicator color="#7A0EED" style={{ marginVertical: 16 }} /> : null}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  grid: { padding: GAP, paddingBottom: 24 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyText: { fontSize: 14, color: '#8A8C93' },
});
