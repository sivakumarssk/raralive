import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BASE_URL } from '@/services/api';
import { authStore } from '@/store/auth-store';
import { CommentsSheet, type FeedPost } from '@/screens/home/home-screen';
import { PostReel } from './post-reel';

/**
 * One post on its own page — opened from the Home feed, a shared link or a
 * profile grid. Full screen on black, reel style (PostReel), with the
 * comments sheet.
 */
export function PostScreen({ postId }: { postId: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const currentUserId = authStore.getUserId() ?? '';
  const [post, setPost] = useState<FeedPost | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading');
  const [following, setFollowing] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);

  useEffect(() => {
    const token = authStore.getToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
    fetch(`${BASE_URL}/posts/${postId}`, { headers })
      .then(r => r.json())
      .then(j => {
        if (!j.success) { setState('missing'); return; }
        setPost(j.data);
        setState('ready');
        if (token && j.data.user_id !== currentUserId) {
          fetch(`${BASE_URL}/auth/follow/${j.data.user_id}`, { headers })
            .then(r => r.json()).then(f => { if (f.success) setFollowing(!!f.following); }).catch(() => {});
        }
      })
      .catch(() => setState('missing'));
  }, [postId, currentUserId]);

  const goBack = useCallback(
    () => (router.canGoBack() ? router.back() : router.replace('/(tabs)' as never)),
    [router],
  );

  // Tag on the post → search that tag
  const openTag = useCallback((tag: { id: string }) => {
    const name = post?.tag_list?.find(t => t.id === tag.id)?.name;
    if (name) router.push({ pathname: '/search', params: { q: `#${name}` } } as never);
  }, [post, router]);

  return (
    <View style={s.root}>
      <StatusBar style="light" />
      {state === 'ready' && post ? (
        <PostReel
          post={post}
          currentUserId={currentUserId}
          following={following}
          onFollowChange={(_, now) => setFollowing(now)}
          onOpenComments={() => setCommentsOpen(true)}
          onTagPress={openTag}
          onBack={goBack}
        />
      ) : (
        <>
          <View style={s.center}>
            {state === 'loading' ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="image-outline" size={48} color="rgba(255,255,255,0.35)" />
                <Text style={s.missingText}>This post isn&apos;t available any more.</Text>
              </>
            )}
          </View>
          <TouchableOpacity style={[s.back, { top: insets.top + 6 }]} onPress={goBack} hitSlop={12} accessibilityLabel="Back">
            <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
          </TouchableOpacity>
        </>
      )}

      <CommentsSheet
        visible={commentsOpen}
        postId={post?.id ?? null}
        allowComments={post?.allow_comments ?? true}
        onClose={() => setCommentsOpen(false)}
        onCountChange={(_, n) => setPost(p => (p ? { ...p, comments_count: n } : p))}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 32 },
  missingText: { fontSize: 14, color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
  back: { position: 'absolute', left: 10, padding: 4 },
});
