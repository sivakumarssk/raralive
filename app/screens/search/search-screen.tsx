import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BASE_URL, resolveImageUrl } from '@/services/api';
import { authStore } from '@/store/auth-store';
import { avatarSource } from '@/utils/default-avatar';
import { CommentsSheet, PostCard, type FeedPost } from '@/screens/home/home-screen';

type SearchUser = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  gender: string | null;
  followers_count: number;
};
type SearchTag = { id: string; name: string; parent_id: string | null; posts_count: number };
type SearchResult = { users: SearchUser[]; tags: SearchTag[]; posts: FeedPost[] };

const RECENT_KEY = 'search_recent';
const MAX_RECENT = 10;
const EMPTY: SearchResult = { users: [], tags: [], posts: [] };

async function fetchSearch(q: string, suggest: boolean): Promise<SearchResult> {
  const token = authStore.getToken();
  const params = new URLSearchParams({ q, ...(suggest ? { suggest: '1' } : {}) });
  const r = await fetch(`${BASE_URL}/posts/search?${params}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const j = await r.json();
  return j.success ? j.data : EMPTY;
}

// Recent searches live on the device only
async function loadRecent(): Promise<string[]> {
  try { return JSON.parse((await AsyncStorage.getItem(RECENT_KEY)) ?? '[]'); } catch { return []; }
}
function saveRecent(list: string[]) {
  AsyncStorage.setItem(RECENT_KEY, JSON.stringify(list)).catch(() => {});
}

function UserRow({ user, onPress }: { user: SearchUser; onPress: () => void }) {
  const name = user.full_name || user.username || 'User';
  return (
    <TouchableOpacity style={s.row} onPress={onPress} activeOpacity={0.7}>
      <Image source={avatarSource(resolveImageUrl(user.avatar_url), user.gender)} style={s.avatar} />
      <View style={s.rowText}>
        <Text style={s.rowTitle} numberOfLines={1}>{name}</Text>
        <Text style={s.rowSub} numberOfLines={1}>
          {user.username ? `@${user.username} · ` : ''}{user.followers_count} follower{user.followers_count === 1 ? '' : 's'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

/**
 * Search page, YouTube style: recent searches and suggestions while typing;
 * submitting (or picking a tag) shows the results — people, then posts.
 */
export function SearchScreen() {
  const router = useRouter();
  // Opened with a search already chosen (e.g. a #tag tapped on a post)
  const { q: initialQuery } = useLocalSearchParams<{ q?: string }>();
  const inputRef = useRef<TextInput>(null);
  const currentUserId = authStore.getUserId() ?? '';

  const [query, setQuery] = useState('');
  // The query whose results are on screen; null = still typing (suggestions)
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<SearchResult>(EMPTY);
  const [results, setResults] = useState<SearchResult>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [followMap, setFollowMap] = useState<Record<string, boolean>>({});
  const [sheetPostId, setSheetPostId] = useState<string | null>(null);
  const [sheetAllowComments, setSheetAllowComments] = useState(true);

  useEffect(() => { loadRecent().then(setRecent); }, []);

  // Suggestions while typing, debounced
  useEffect(() => {
    if (submitted !== null) return;
    const q = query.trim();
    if (!q) { setSuggestions(EMPTY); return; }
    let cancelled = false;
    const t = setTimeout(() => {
      fetchSearch(q, true).then(d => { if (!cancelled) setSuggestions(d); }).catch(() => {});
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query, submitted]);

  const remember = useCallback((term: string) => {
    setRecent(prev => {
      const next = [term, ...prev.filter(r => r.toLowerCase() !== term.toLowerCase())].slice(0, MAX_RECENT);
      saveRecent(next);
      return next;
    });
  }, []);

  const runSearch = useCallback(async (term: string) => {
    const q = term.trim();
    if (!q) return;
    Keyboard.dismiss();
    setQuery(q);
    setSubmitted(q);
    remember(q);
    setLoading(true);
    try {
      const data = await fetchSearch(q, false);
      setResults(data);
      // Follow buttons on the post cards
      const token = authStore.getToken();
      if (token) {
        const ids = [...new Set(data.posts.map(p => p.user_id).filter(id => id !== currentUserId))];
        const map: Record<string, boolean> = {};
        await Promise.all(ids.map(uid =>
          fetch(`${BASE_URL}/auth/follow/${uid}`, { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.json()).then(j => { if (j.success) map[uid] = j.following; }).catch(() => {})));
        setFollowMap(prev => ({ ...prev, ...map }));
      }
    } catch {
      setResults(EMPTY);
    } finally {
      setLoading(false);
    }
  }, [currentUserId, remember]);

  useEffect(() => {
    if (initialQuery) runSearch(initialQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openUser = useCallback((user: SearchUser) => {
    remember(user.username ? `@${user.username}` : user.full_name ?? '');
    router.push(`/user/${user.id}` as never);
  }, [remember, router]);

  const editQuery = (text: string) => {
    setQuery(text);
    if (submitted !== null) setSubmitted(null); // typing again → back to suggestions
  };

  const clearQuery = () => {
    setQuery('');
    setSubmitted(null);
    inputRef.current?.focus();
  };

  const removeRecent = (term: string) => {
    setRecent(prev => { const next = prev.filter(r => r !== term); saveRecent(next); return next; });
  };
  const clearRecent = () => { setRecent([]); saveRecent([]); };

  const typed = query.trim();

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {/* Search bar */}
      <View style={s.bar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} style={s.backBtn}>
          <Ionicons name="chevron-back" size={26} color="#1C1E22" />
        </TouchableOpacity>
        <View style={s.inputWrap}>
          <Ionicons name="search" size={18} color="#8A8C93" />
          <TextInput
            ref={inputRef}
            style={s.input}
            value={query}
            onChangeText={editQuery}
            placeholder="Search people or #tags"
            placeholderTextColor="#ABADB2"
            autoFocus={!initialQuery}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => runSearch(query)}
            underlineColorAndroid="transparent"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={clearQuery} hitSlop={10}>
              <Ionicons name="close-circle" size={18} color="#ABADB2" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {submitted === null ? (
        // ── Before submitting: recent searches, or suggestions while typing ──
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.listPad}>
          {!typed ? (
            recent.length > 0 ? (
              <>
                <View style={s.sectionHead}>
                  <Text style={s.sectionTitle}>Recent searches</Text>
                  <TouchableOpacity onPress={clearRecent} hitSlop={8}><Text style={s.clearAll}>Clear all</Text></TouchableOpacity>
                </View>
                {recent.map(term => (
                  <View key={term} style={s.row}>
                    <TouchableOpacity style={s.suggestMain} onPress={() => runSearch(term)} activeOpacity={0.7}>
                      <Ionicons name="time-outline" size={20} color="#8A8C93" />
                      <Text style={s.suggestText} numberOfLines={1}>{term}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => removeRecent(term)} hitSlop={10}>
                      <Ionicons name="close" size={18} color="#ABADB2" />
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            ) : (
              <View style={s.empty}>
                <Ionicons name="search" size={44} color="#D0C8F0" />
                <Text style={s.emptyText}>Search for people by name or @username,{'\n'}or posts by #tag</Text>
              </View>
            )
          ) : (
            <>
              {/* Search for exactly what's typed */}
              <TouchableOpacity style={s.row} onPress={() => runSearch(typed)} activeOpacity={0.7}>
                <Ionicons name="search" size={20} color="#8A8C93" />
                <Text style={s.suggestText} numberOfLines={1}>{typed}</Text>
              </TouchableOpacity>
              {suggestions.tags.map(tag => (
                <TouchableOpacity key={tag.id} style={s.row} onPress={() => runSearch(`#${tag.name}`)} activeOpacity={0.7}>
                  <View style={s.tagIcon}><Text style={s.tagHash}>#</Text></View>
                  <View style={s.rowText}>
                    <Text style={s.rowTitle} numberOfLines={1}>{tag.name}</Text>
                    <Text style={s.rowSub}>{tag.posts_count} post{tag.posts_count === 1 ? '' : 's'}</Text>
                  </View>
                </TouchableOpacity>
              ))}
              {suggestions.users.map(u => <UserRow key={u.id} user={u} onPress={() => openUser(u)} />)}
            </>
          )}
        </ScrollView>
      ) : loading ? (
        <View style={s.center}><ActivityIndicator color="#7A0EED" /></View>
      ) : (
        // ── Results: people first, then posts as in the Home feed ──
        <FlatList
          data={results.posts}
          keyExtractor={p => p.id}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <>
              {results.users.length > 0 && (
                <View style={s.peopleBlock}>
                  <Text style={[s.sectionTitle, s.blockTitle]}>People</Text>
                  {results.users.map(u => <UserRow key={u.id} user={u} onPress={() => openUser(u)} />)}
                </View>
              )}
              {results.posts.length > 0 && <Text style={[s.sectionTitle, s.blockTitle, s.postsTitle]}>Posts</Text>}
            </>
          }
          ListEmptyComponent={results.users.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="search-outline" size={44} color="#D0C8F0" />
              <Text style={s.emptyText}>No results for “{submitted}”</Text>
            </View>
          ) : null}
          renderItem={({ item }) => (
            <PostCard
              post={item}
              currentUserId={currentUserId}
              onOpenComments={(postId, allow) => { setSheetPostId(postId); setSheetAllowComments(allow); }}
              following={!!followMap[item.user_id]}
              onFollowChange={(uid, now) => setFollowMap(prev => ({ ...prev, [uid]: now }))}
              onTagPress={tag => {
                const name = item.tag_list?.find(t => t.id === tag.id)?.name;
                if (name) runSearch(`#${name}`);
              }}
            />
          )}
        />
      )}

      <CommentsSheet
        visible={!!sheetPostId}
        postId={sheetPostId}
        allowComments={sheetAllowComments}
        onClose={() => setSheetPostId(null)}
        onCountChange={(postId, n) => setResults(prev => ({
          ...prev, posts: prev.posts.map(p => p.id === postId ? { ...p, comments_count: n } : p),
        }))}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8 },
  backBtn: { padding: 2 },
  inputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    height: 42, borderRadius: 21, backgroundColor: '#F4F5F8', paddingHorizontal: 14,
  },
  input: { flex: 1, fontSize: 15, color: '#1C1E22', padding: 0 },
  listPad: { paddingBottom: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#1C1E22' },
  clearAll: { fontSize: 13, fontWeight: '600', color: '#7A0EED' },
  blockTitle: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  postsTitle: { paddingBottom: 8 },
  peopleBlock: { borderBottomWidth: 6, borderBottomColor: '#F4F5F8', paddingBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  suggestMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  suggestText: { flex: 1, fontSize: 15, color: '#1C1E22' },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#EDE8F7' },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 15, fontWeight: '700', color: '#1C1E22' },
  rowSub: { fontSize: 12, color: '#8A8C93', marginTop: 1 },
  tagIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F4EEFF', alignItems: 'center', justifyContent: 'center' },
  tagHash: { fontSize: 20, fontWeight: '800', color: '#7A0EED' },
  empty: { alignItems: 'center', paddingTop: 80, gap: 10, paddingHorizontal: 32 },
  emptyText: { fontSize: 14, color: '#8A8C93', textAlign: 'center', lineHeight: 20 },
});
