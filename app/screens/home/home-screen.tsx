import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as MediaLibrary from 'expo-media-library';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppScreenHeader } from '@/components/ui/app-screen-header';
import { BASE_URL, MEDIA_BASE } from '@/services/api';
import { authStore } from '@/store/auth-store';

const COIN_IMG = require('@/assets/tabs/coin.png') as number;
const { width: SCREEN_W } = Dimensions.get('window');
const POST_IMG_H = SCREEN_W * 0.62;

// ── Types ─────────────────────────────────────────────────────────────────────

type PostMedia = {
  id: string;
  media_url: string;
  media_type: 'photo' | 'video';
  sort_order: number;
};

type FeedPost = {
  id: string;
  caption: string | null;
  allow_comments: boolean;
  likes_count: number;
  comments_count: number;
  created_at: string;
  user_id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  media: PostMedia[];
};

type Comment = {
  id: string;
  text: string;
  created_at: string;
  user_id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveMedia(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${MEDIA_BASE}/${url.replace(/^\/+/, '')}`;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const AVATAR_COLORS = ['#7A0EED', '#B50357', '#F97316', '#0EA5E9', '#22C55E', '#EF4444'];
function avatarColor(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function formatCount(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

const TABS = ['Trending', 'Nearby', 'Following'] as const;
type HomeTab = typeof TABS[number];

// ── Header right ──────────────────────────────────────────────────────────────

function HeaderRight() {
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnread = useCallback(async () => {
    try {
      const token = authStore.getToken();
      if (!token) return;
      const r = await fetch(`${BASE_URL}/battle/notifications/unread-count`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await r.json();
      if (json.success) setUnreadCount(json.data.count ?? 0);
    } catch {}
  }, []);

  useEffect(() => {
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, [fetchUnread]);

  const badgeLabel = unreadCount >= 10 ? '9+' : String(unreadCount);

  return (
    <View style={hdr.row}>
      <TouchableOpacity style={hdr.iconBtn} activeOpacity={0.75} onPress={() => router.push('/wallet' as any)}>
        <Image source={COIN_IMG} style={hdr.coinImg} resizeMode="contain" />
      </TouchableOpacity>
      <TouchableOpacity
        style={hdr.iconBtn}
        activeOpacity={0.75}
        onPress={() => router.push('/notifications' as any)}>
        <Ionicons name="notifications-outline" size={24} color="#1C1E22" />
        {unreadCount > 0 && (
          <View style={hdr.badge}>
            <Text style={hdr.badgeText}>{badgeLabel}</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

// ── Tab bar ───────────────────────────────────────────────────────────────────

function HomeTabs({ active, onChange }: { active: HomeTab; onChange: (t: HomeTab) => void }) {
  return (
    <View style={tabs.container}>
      {TABS.map((tab) => {
        const isActive = tab === active;
        return (
          <TouchableOpacity key={tab} onPress={() => onChange(tab)} activeOpacity={0.8} style={tabs.tab}>
            <Text style={[tabs.label, isActive && tabs.labelActive]}>{tab}</Text>
            {isActive && (
              <LinearGradient
                colors={['#7A0EED', '#B50357']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={tabs.underline}
              />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ initial, color, size = 42, uri }: {
  initial: string; color: string; size?: number; uri?: string | null;
}) {
  return (
    <View style={{ width: size, height: size }}>
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
      ) : (
        <View style={[av.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
          <Text style={[av.initial, { fontSize: size * 0.38 }]}>{initial}</Text>
        </View>
      )}
    </View>
  );
}

// ── Caption with Read More ────────────────────────────────────────────────────

function Caption({ displayName, text }: { displayName: string; text: string }) {
  const [expanded, setExpanded] = useState(false);
  const full = `${displayName} ${text}`;
  // Measure whether text is long enough to need "Read more"
  // We show 2 lines collapsed, full text expanded
  return (
    <View style={cap.wrap}>
      <Text style={cap.text} numberOfLines={expanded ? undefined : 2}>
        <Text style={cap.name}>{displayName} </Text>
        {text}
      </Text>
      {!expanded && full.length > 100 && (
        <TouchableOpacity onPress={() => setExpanded(true)} hitSlop={8} activeOpacity={0.7}>
          <Text style={cap.readMore}>Read more</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Comments sheet — single instance at screen level, slides up from app bottom
type CommentsSheetProps = {
  visible: boolean;
  postId: string | null;
  allowComments: boolean;
  onClose: () => void;
  onCountChange: (postId: string, n: number) => void;
};

function CommentsSheet({ visible, postId, allowComments, onClose, onCountChange }: CommentsSheetProps) {
  const insets = useSafeAreaInsets();
  const { height: SCREEN_H } = Dimensions.get('window');
  const SHEET_H = SCREEN_H * 0.72;
  const slideY = useRef(new Animated.Value(SHEET_H)).current;

  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const countRef = useRef(0);
  const loadedPostId = useRef<string | null>(null);

  // Animate in when visible, reset + load when postId changes
  useEffect(() => {
    if (!visible || !postId) return;
    // slide in
    slideY.setValue(SHEET_H);
    Animated.spring(slideY, { toValue: 0, useNativeDriver: true, tension: 68, friction: 12 }).start();

    if (loadedPostId.current === postId) return;
    loadedPostId.current = postId;
    setComments([]);
    setText('');
    setLoading(true);
    fetch(`${BASE_URL}/posts/${postId}/comments?limit=50`)
      .then(r => r.json())
      .then(j => {
        if (j.success) {
          setComments(j.data);
          countRef.current = j.data.length;
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [visible, postId, SHEET_H, slideY]);

  const dismiss = () => {
    Animated.timing(slideY, { toValue: SHEET_H, duration: 240, useNativeDriver: true }).start(() => {
      loadedPostId.current = null;
      onClose();
    });
  };

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed || posting || !postId) return;
    setText('');
    setPosting(true);
    const temp: Comment = {
      id: `temp_${Date.now()}`,
      text: trimmed,
      created_at: new Date().toISOString(),
      user_id: authStore.getUserId() ?? 'me',
      full_name: authStore.getUser()?.fullName ?? null,
      username: authStore.getUser()?.username ?? null,
      avatar_url: authStore.getUser()?.avatarUrl ?? null,
    };
    setComments(prev => [...prev, temp]);
    countRef.current += 1;
    onCountChange(postId, countRef.current);
    try {
      const token = authStore.getToken();
      const r = await fetch(`${BASE_URL}/posts/${postId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ text: trimmed }),
      });
      const j = await r.json();
      if (j.success) setComments(prev => prev.map(c => c.id === temp.id ? j.data : c));
    } catch { /* silent */ } finally {
      setPosting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={dismiss} statusBarTranslucent>
      <TouchableOpacity style={cmt.backdrop} activeOpacity={1} onPress={dismiss} />
      <Animated.View style={[cmt.sheet, { height: SHEET_H, paddingBottom: insets.bottom + 4, transform: [{ translateY: slideY }] }]}>
        {/* Drag handle */}
        <View style={cmt.handleWrap}>
          <View style={cmt.handle} />
        </View>

        {/* Header row */}
        <View style={cmt.headerRow}>
          <Text style={cmt.title}>Comments</Text>
          <TouchableOpacity onPress={dismiss} hitSlop={10}>
            <Ionicons name="close" size={22} color="#60626A" />
          </TouchableOpacity>
        </View>

        {/* Comment list */}
        {loading ? (
          <ActivityIndicator color="#7A0EED" style={{ marginVertical: 40 }} />
        ) : comments.length === 0 ? (
          <View style={cmt.empty}>
            <Ionicons name="chatbubbles-outline" size={48} color="#D0C8F0" />
            <Text style={cmt.emptyText}>No comments yet. Be the first!</Text>
          </View>
        ) : (
          <FlatList
            data={comments}
            keyExtractor={c => c.id}
            showsVerticalScrollIndicator={false}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12 }}
            renderItem={({ item }) => {
              const name = item.username ?? item.full_name ?? 'User';
              const uri = resolveMedia(item.avatar_url);
              return (
                <View style={cmt.row}>
                  <Avatar initial={name[0]?.toUpperCase() ?? '?'} color={avatarColor(item.user_id)} size={36} uri={uri} />
                  <View style={cmt.bubble}>
                    <Text style={cmt.commentName}>
                      {name} <Text style={cmt.commentText}>{item.text}</Text>
                    </Text>
                    <Text style={cmt.commentTime}>{timeAgo(item.created_at)}</Text>
                  </View>
                </View>
              );
            }}
          />
        )}

        {/* Input */}
        {allowComments ? (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={cmt.inputRow}>
              <TextInput
                style={cmt.input}
                placeholder="Add a comment…"
                placeholderTextColor="#C4C5CC"
                value={text}
                onChangeText={setText}
                returnKeyType="send"
                onSubmitEditing={submit}
                multiline
              />
              <TouchableOpacity
                style={[cmt.sendBtn, (!text.trim() || posting) && cmt.sendBtnDisabled]}
                onPress={submit}
                activeOpacity={0.85}>
                {posting
                  ? <ActivityIndicator size="small" color="#FFFFFF" />
                  : <Ionicons name="send" size={16} color="#FFFFFF" />}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        ) : (
          <View style={cmt.disabledBar}>
            <Ionicons name="lock-closed-outline" size={14} color="#ABADB2" />
            <Text style={cmt.disabledText}>Comments are turned off</Text>
          </View>
        )}
      </Animated.View>
    </Modal>
  );
}

// ── Post card ─────────────────────────────────────────────────────────────────

const MAX_IMG_H = SCREEN_W * 1.25; // max ~5:4 tall
const MIN_IMG_H = SCREEN_W * 0.56; // min ~16:9 wide

function PostCard({ post, currentUserId, onOpenComments }: {
  post: FeedPost;
  currentUserId: string;
  onOpenComments: (postId: string, allowComments: boolean) => void;
}) {
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likes_count);
  const [commentsCount] = useState(post.comments_count);
  const [downloading, setDownloading] = useState(false);
  const [mediaError, setMediaError] = useState(false);
  const [mediaHeight, setMediaHeight] = useState(POST_IMG_H);
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const likeScale = useRef(new Animated.Value(1)).current;
  const initDone = useRef(false);

  const isOwnPost = !!currentUserId && post.user_id === currentUserId;
  const displayName = post.username ?? post.full_name ?? 'User';
  const initial = displayName[0]?.toUpperCase() ?? '?';
  const color = avatarColor(post.user_id);
  const avatarUri = resolveMedia(post.avatar_url);
  const firstMedia = post.media?.[0];
  const mediaUri = firstMedia ? resolveMedia(firstMedia.media_url) : null;
  const isVideo = firstMedia?.media_type === 'video';

  // Measure actual image size and fit height to aspect ratio
  useEffect(() => {
    if (!mediaUri || isVideo) return;
    Image.getSize(
      mediaUri,
      (w, h) => {
        if (!w || !h) return;
        const ratio = h / w;
        const computed = SCREEN_W * ratio;
        setMediaHeight(Math.min(MAX_IMG_H, Math.max(MIN_IMG_H, computed)));
      },
      () => {},
    );
  }, [mediaUri, isVideo]);

  // Fetch liked + follow state once on mount
  useEffect(() => {
    if (initDone.current) return;
    initDone.current = true;
    const token = authStore.getToken();
    if (!token) return;
    fetch(`${BASE_URL}/posts/${post.id}/liked`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(j => { if (j.success) setLiked(j.data.liked); })
      .catch(() => {});
    if (!isOwnPost) {
      fetch(`${BASE_URL}/auth/follow/${post.user_id}`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(j => { if (j.success) setFollowing(j.following); })
        .catch(() => {});
    }
  }, [post.id, post.user_id, isOwnPost]);

  const handleFollow = async () => {
    if (followLoading || isOwnPost) return;
    const token = authStore.getToken();
    if (!token) return;
    const wasFollowing = following;
    setFollowing(!wasFollowing);
    setFollowLoading(true);
    try {
      await fetch(`${BASE_URL}/auth/follow/${post.user_id}`, {
        method: wasFollowing ? 'DELETE' : 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      setFollowing(wasFollowing);
    } finally {
      setFollowLoading(false);
    }
  };

  const handleLike = () => {
    // Instant optimistic — no await, fire and forget
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikesCount(n => wasLiked ? Math.max(0, n - 1) : n + 1);
    Animated.sequence([
      Animated.timing(likeScale, { toValue: 1.4, duration: 100, useNativeDriver: true }),
      Animated.timing(likeScale, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
    // Silent background API call — update count from server response quietly
    const token = authStore.getToken();
    fetch(`${BASE_URL}/posts/${post.id}/like`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.json())
      .then(j => {
        if (j.success) {
          setLiked(j.data.liked);
          setLikesCount(j.data.likes_count);
        }
      })
      .catch(() => {
        // Revert on network failure
        setLiked(wasLiked);
        setLikesCount(n => wasLiked ? n + 1 : Math.max(0, n - 1));
      });
  };

  const handleDownload = async () => {
    if (!mediaUri || downloading) return;
    setDownloading(true);
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync(false);
      if (status !== 'granted') return;
      const ext = isVideo ? 'mp4' : 'jpg';
      const { File, Paths } = await import('expo-file-system');
      const destFile = new File(Paths.cache, `rara_${post.id}.${ext}`);
      await File.downloadFileAsync(mediaUri, destFile);
      await MediaLibrary.saveToLibraryAsync(destFile.uri);
    } catch { /* silent */ } finally {
      setDownloading(false);
    }
  };

  return (
    <View style={card.container}>
      {/* Card header */}
      <View style={card.header}>
        <Avatar initial={initial} color={color} uri={avatarUri} />
        <View style={card.headerText}>
          <Text style={card.username}>{displayName}</Text>
          <Text style={card.time}>{timeAgo(post.created_at)}</Text>
        </View>
        {!isOwnPost && (
          <TouchableOpacity
            style={[card.followBtn, following && card.followingBtn]}
            activeOpacity={0.85}
            onPress={handleFollow}
            disabled={followLoading}>
            {followLoading
              ? <ActivityIndicator size="small" color={following ? '#7A0EED' : '#FFFFFF'} />
              : <Text style={[card.followText, following && card.followingText]}>
                  {following ? 'Following' : 'Follow'}
                </Text>}
          </TouchableOpacity>
        )}
      </View>

      {/* Media */}
      <View style={[card.media, { height: mediaHeight, backgroundColor: '#0D0D1A' }]}>
        {mediaUri && !mediaError ? (
          <Image
            source={{ uri: mediaUri }}
            style={{ width: SCREEN_W, height: mediaHeight }}
            resizeMode="contain"
            onError={() => setMediaError(true)}
          />
        ) : (
          <View style={[card.mediaPlaceholder, { height: mediaHeight }]}>
            <Ionicons name={isVideo ? 'videocam-outline' : 'image-outline'} size={40} color="rgba(255,255,255,0.3)" />
          </View>
        )}
        {isVideo && !mediaError && (
          <View style={card.playOverlay}>
            <View style={card.playCircle}>
              <Ionicons name="play" size={28} color="#FFFFFF" style={{ paddingLeft: 3 }} />
            </View>
          </View>
        )}
      </View>

      {/* Actions */}
      <View style={card.actions}>
        <View style={card.actionsLeft}>
          <TouchableOpacity style={card.actionBtn} onPress={handleLike} activeOpacity={0.8}>
            <Animated.View style={{ transform: [{ scale: likeScale }] }}>
              <Ionicons
                name={liked ? 'heart' : 'heart-outline'}
                size={22}
                color={liked ? '#E14C57' : '#60626A'}
              />
            </Animated.View>
            <Text style={[card.actionCount, liked && { color: '#E14C57' }]}>{formatCount(likesCount)}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={card.actionBtn} onPress={() => onOpenComments(post.id, post.allow_comments)} activeOpacity={0.8}>
            <Ionicons name="chatbubble-outline" size={20} color="#60626A" />
            <Text style={card.actionCount}>{formatCount(commentsCount)}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={card.actionBtn} activeOpacity={0.8}>
            <Ionicons name="share-social-outline" size={21} color="#60626A" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={card.actionBtn} onPress={handleDownload} disabled={downloading} activeOpacity={0.8}>
          {downloading
            ? <ActivityIndicator size="small" color="#7A0EED" />
            : <Ionicons name="download-outline" size={22} color="#60626A" />}
        </TouchableOpacity>
      </View>

      {/* Caption with read more */}
      {post.caption ? (
        <Caption displayName={displayName} text={post.caption} />
      ) : null}
    </View>
  );
}

// ── Main Home Screen ──────────────────────────────────────────────────────────

export function HomeScreen() {
  const insets = useSafeAreaInsets();
  const bottomInset    = Platform.OS === 'android' ? Math.max(insets.bottom, 12) : 0;
  const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 80 : 56 + bottomInset;

  const currentUserId = authStore.getUserId() ?? '';
  const [activeTab, setActiveTab] = useState<HomeTab>('Trending');
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Sheet state — single instance for all posts
  const [sheetPostId, setSheetPostId] = useState<string | null>(null);
  const [sheetAllowComments, setSheetAllowComments] = useState(true);

  const openComments = useCallback((postId: string, allowComments: boolean) => {
    setSheetPostId(postId);
    setSheetAllowComments(allowComments);
  }, []);

  const closeComments = useCallback(() => {
    setSheetPostId(null);
  }, []);

  const handleCountChange = useCallback((postId: string, n: number) => {
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments_count: n } : p));
  }, []);

  const loadFeed = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const r = await fetch(`${BASE_URL}/posts/feed?limit=30`);
      const j = await r.json();
      if (j.success) setPosts(j.data);
    } catch { /* silent */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadFeed(); }, [loadFeed]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppScreenHeader title="Rara Live" right={<HeaderRight />} backgroundColor="#FFFFFF" noBottomShadow />
      <View style={styles.headerGap} />
      <View style={styles.screenBody}>
        <HomeTabs active={activeTab} onChange={setActiveTab} />

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color="#7A0EED" size="large" />
          </View>
        ) : (
          <FlatList
            data={posts}
            keyExtractor={p => p.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={
              posts.length === 0
                ? styles.emptyContent
                : { paddingBottom: TAB_BAR_HEIGHT + 12 }
            }
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadFeed(true); }}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Ionicons name="images-outline" size={56} color="#D0C8F0" />
                <Text style={styles.emptyTitle}>No posts yet</Text>
                <Text style={styles.emptySub}>Posts you and others share will appear here</Text>
              </View>
            }
            renderItem={({ item }) => (
              <PostCard
                post={item}
                currentUserId={currentUserId}
                onOpenComments={openComments}
              />
            )}
          />
        )}
      </View>

      <CommentsSheet
        visible={!!sheetPostId}
        postId={sheetPostId}
        allowComments={sheetAllowComments}
        onClose={closeComments}
        onCountChange={handleCountChange}
      />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: '#FFFFFF' },
  headerGap:    { height: 8, backgroundColor: '#F5F3FA' },
  screenBody:   { flex: 1, backgroundColor: '#F5F3FA' },
  separator:    { height: 10 },
  loadingWrap:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyContent: { flex: 1 },
  emptyWrap:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 40, marginTop: 80 },
  emptyTitle:   { fontSize: 18, fontWeight: '700', color: '#1C1E22' },
  emptySub:     { fontSize: 13, color: '#ABADB2', textAlign: 'center', lineHeight: 20 },
});

const hdr = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconBtn:  { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  coinImg:  { width: 28, height: 28 },
  badge: {
    position: 'absolute', top: 4, right: 4,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: '#E14C57', borderWidth: 1.5, borderColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    fontSize: 9, fontWeight: '800', color: '#FFFFFF', lineHeight: 11,
  },
});

const tabs = StyleSheet.create({
  container:   { flexDirection: 'row', backgroundColor: '#FFFFFF', paddingHorizontal: 20, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E0DDED' },
  tab:         { paddingVertical: 10, marginRight: 28, alignItems: 'center', position: 'relative' },
  label:       { fontSize: 15, fontWeight: '600', color: '#ABADB2' },
  labelActive: { color: '#7A0EED', fontWeight: '700' },
  underline:   { position: 'absolute', bottom: 0, left: 0, right: 0, height: 2.5, borderRadius: 2 },
});

const av = StyleSheet.create({
  circle:  { alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  initial: { color: '#FFFFFF', fontWeight: '800' },
});

const cap = StyleSheet.create({
  wrap:     { paddingHorizontal: 16, paddingBottom: 14 },
  text:     { fontSize: 13, color: '#3C3F4A', lineHeight: 19 },
  name:     { fontWeight: '700', color: '#1C1E22' },
  readMore: { fontSize: 12, color: '#7A0EED', fontWeight: '600', marginTop: 2 },
});

const card = StyleSheet.create({
  container:  { backgroundColor: '#FFFFFF', shadowColor: '#4A0099', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  header:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  headerText: { flex: 1 },
  username:   { fontSize: 14, fontWeight: '700', color: '#1C1E22' },
  time:       { fontSize: 12, color: '#ABADB2', marginTop: 1 },
  followBtn:     { height: 32, paddingHorizontal: 18, borderRadius: 999, backgroundColor: '#7A0EED', alignItems: 'center', justifyContent: 'center', shadowColor: '#7A0EED', shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  followingBtn:  { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: '#7A0EED', shadowOpacity: 0, elevation: 0 },
  followText:    { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  followingText: { color: '#7A0EED' },

  media:            { width: SCREEN_W, overflow: 'hidden' },
  mediaPlaceholder: { width: SCREEN_W, backgroundColor: '#0D0D1A', alignItems: 'center', justifyContent: 'center' },
  playOverlay:      { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  playCircle:       { width: 62, height: 62, borderRadius: 31, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)' },

  actions:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  actionsLeft:{ flexDirection: 'row', alignItems: 'center', gap: 18 },
  actionBtn:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionCount:{ fontSize: 13, fontWeight: '600', color: '#60626A' },
});

const cmt = StyleSheet.create({
  backdrop:        { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet:           { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 20, shadowOffset: { width: 0, height: -4 }, elevation: 24 },
  handleWrap:      { alignItems: 'center', paddingTop: 10, paddingBottom: 6 },
  handle:          { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E0DFF5' },
  headerRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F0EFF5' },
  title:           { fontSize: 16, fontWeight: '800', color: '#1C1E22' },
  empty:           { alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 48 },
  emptyText:       { fontSize: 14, color: '#ABADB2' },
  row:             { flexDirection: 'row', gap: 10, marginBottom: 16, alignItems: 'flex-start' },
  bubble:          { flex: 1 },
  commentName:     { fontSize: 13, fontWeight: '700', color: '#1C1E22', lineHeight: 19 },
  commentText:     { fontWeight: '400', color: '#3C3F4A' },
  commentTime:     { fontSize: 11, color: '#ABADB2', marginTop: 2 },
  inputRow:        { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#F0EFF5' },
  input:           { flex: 1, minHeight: 40, maxHeight: 100, backgroundColor: '#F7F5FF', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: '#1C1E22', borderWidth: 1, borderColor: '#E8E6F0' },
  sendBtn:         { width: 38, height: 38, borderRadius: 19, backgroundColor: '#7A0EED', alignItems: 'center', justifyContent: 'center', shadowColor: '#7A0EED', shadowOpacity: 0.35, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  sendBtnDisabled: { backgroundColor: '#C8B0F5', shadowOpacity: 0, elevation: 0 },
  disabledBar:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#F0EFF5' },
  disabledText:    { fontSize: 13, color: '#ABADB2' },
});