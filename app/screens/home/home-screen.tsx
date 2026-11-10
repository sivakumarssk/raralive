import { Ionicons } from '@expo/vector-icons';
import { cacheDirectory, downloadAsync } from 'expo-file-system/legacy';
import { LinearGradient } from 'expo-linear-gradient';
import * as MediaLibrary from 'expo-media-library';
import { useVideoPlayer, VideoView } from 'expo-video';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppScreenHeader } from '@/components/ui/app-screen-header';
import { BoldIcon } from '@/components/ui/bold-icon';
import { sharePost } from '@/utils/share';
import { apiPostTags, apiTrendingPostTags, BASE_URL, MEDIA_BASE, type PostTag } from '@/services/api';
import { authStore } from '@/store/auth-store';
import { earningsConfigStore } from '@/store/earnings-config-store';
import { BannerCarousel, fetchBanners, type Banner } from '@/screens/chat-rooms/components/banner-carousel';
import { avatarSource } from '@/utils/default-avatar';

// Post action icons drawn as thick as the bottom tab bar's (same line weight
// on screen at these smaller sizes) — size unchanged.
export const POST_ICON_WEIGHT = 12;

const { width: SCREEN_W } = Dimensions.get('window');

// ── Types ─────────────────────────────────────────────────────────────────────

type PostMedia = {
  id: string;
  media_url: string;
  media_type: 'photo' | 'video';
  sort_order: number;
};

export type FeedPost = {
  id: string;
  caption: string | null;
  allow_comments: boolean;
  likes_count: number;
  comments_count: number;
  /** Video views — counted once someone watches at least half the video */
  views_count?: number;
  downloads_count?: number;
  created_at: string;
  user_id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  media: PostMedia[];
  /** Admin tags on the post (sub tags carry their tab's id in parent_id). */
  tag_list?: { id: string; name: string; parent_id: string | null }[];
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

export function timeAgo(dateStr: string) {
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

export function formatCount(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

// Trending / Video / Following are fixed; admin Home tabs (Admin → Post Tags)
// follow them. `key` is what the feed API filters on (a tag id for admin tabs).
type HomeTab = { key: string; label: string };
const DEFAULT_TABS: HomeTab[] = [
  { key: 'trending', label: 'Trending' },
  { key: 'video', label: 'Video' },
  { key: 'following', label: 'Following' },
];

// ── Header right ──────────────────────────────────────────────────────────────

function HeaderRight() {
  const [unreadCount, setUnreadCount] = useState(0);
  const user = authStore.getUser();
  const avatarUrl = user?.avatarUrl
    ? (user.avatarUrl.startsWith('http') ? user.avatarUrl : `${MEDIA_BASE}/${user.avatarUrl.replace(/^\//, '')}`)
    : null;

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
      <TouchableOpacity style={hdr.iconBtn} activeOpacity={0.75} hitSlop={8} onPress={() => router.push('/search' as never)} accessibilityLabel="Search">
        <BoldIcon name="search-outline" size={24} color="#1C1E22" weight={7} />
      </TouchableOpacity>
      <TouchableOpacity
        style={hdr.iconBtn}
        activeOpacity={0.75}
        hitSlop={8}
        onPress={() => router.push('/notifications' as any)}>
        {/* Weight 7 at this size = the bottom tab bar's line thickness */}
        <BoldIcon name="notifications-outline" size={24} color="#1C1E22" weight={7} />
        {unreadCount > 0 && (
          <View style={hdr.badge}>
            <Text style={hdr.badgeText}>{badgeLabel}</Text>
          </View>
        )}
      </TouchableOpacity>
      <TouchableOpacity
        style={hdr.avatarBtn}
        activeOpacity={0.85}
        onPress={() => router.push('/(tabs)/profile' as any)}>
        <Image source={avatarSource(avatarUrl, user?.gender)} style={hdr.avatar} />
      </TouchableOpacity>
    </View>
  );
}

// ── Tab bar ───────────────────────────────────────────────────────────────────

function HomeTabs({ items, active, onChange }: { items: HomeTab[]; active: string; onChange: (key: string) => void }) {
  return (
    <View style={tabs.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={tabs.scroll}>
        {items.map((tab) => {
          const isActive = tab.key === active;
          return (
            <TouchableOpacity key={tab.key} onPress={() => onChange(tab.key)} activeOpacity={0.8} style={tabs.tab}>
              <Text style={[tabs.label, isActive && tabs.labelActive]} numberOfLines={1}>{tab.label}</Text>
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
      </ScrollView>
    </View>
  );
}

// "Trending Now" / sub-tag chip box shown at the top of the feed (scrolls with it)
function TagChips({ title, chips, selected, onSelect }: {
  title: string;
  chips: { id: string; name: string }[];
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  if (!chips.length) return null;
  return (
    <View style={chipBox.wrap}>
      <Text style={chipBox.title}>{title}</Text>
      <View style={chipBox.row}>
        {chips.map(c => {
          const active = c.id === selected;
          return (
            <TouchableOpacity
              key={c.id}
              activeOpacity={0.8}
              onPress={() => onSelect(active ? null : c.id)}
              style={[chipBox.chip, active && chipBox.chipActive]}>
              <Text style={[chipBox.chipText, active && chipBox.chipTextActive]}>{c.name}</Text>
              {active && <Ionicons name="close" size={13} color="#7A0EED" />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ── Avatar ────────────────────────────────────────────────────────────────────

export function Avatar({ initial, color, size = 42, uri }: {
  initial: string; color: string; size?: number; uri?: string | null;
}) {
  return (
    <View style={{ width: size, height: size }}>
      <Image source={avatarSource(uri)} style={{ width: size, height: size, borderRadius: size / 2 }} />
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

export function CommentsSheet({ visible, postId, allowComments, onClose, onCountChange }: CommentsSheetProps) {
  const insets = useSafeAreaInsets();
  const { height: SCREEN_H } = Dimensions.get('window');
  // Half the screen; the comment list scrolls inside it
  const SHEET_H = SCREEN_H * 0.5;
  const slideY = useRef(new Animated.Value(SHEET_H)).current;

  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const countRef = useRef(0);
  const loadedPostId = useRef<string | null>(null);

  // Keyboard handling: lift the whole sheet by however much the keyboard
  // actually overlaps the modal root. The overlap is re-measured whenever the
  // root's layout changes too, so if Android resizes the modal window for the
  // keyboard (after keyboardDidShow) the lift drops back to 0 instead of being
  // applied twice and pushing the sheet up past the status bar.
  const rootRef = useRef<View>(null);
  const kbTopRef = useRef<number | null>(null);
  const [kbLift, setKbLift] = useState(0);
  const [rootH, setRootH] = useState(SCREEN_H);

  const measureLift = useCallback(() => {
    const kbTop = kbTopRef.current;
    if (kbTop == null) { setKbLift(0); return; }
    rootRef.current?.measureInWindow((_x, y, _w, h) => {
      setKbLift(Math.max(0, Math.round(y + h - kbTop)));
    });
  }, []);

  useEffect(() => {
    if (!visible) { kbTopRef.current = null; setKbLift(0); return; }
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      e => { kbTopRef.current = e.endCoordinates.screenY; measureLift(); },
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => { kbTopRef.current = null; setKbLift(0); },
    );
    return () => { show.remove(); hide.remove(); };
  }, [visible, measureLift]);

  // Never taller than the space between the status bar and the keyboard
  const sheetH = Math.max(160, Math.min(SHEET_H, rootH - kbLift - insets.top - 12));

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
      <View ref={rootRef} style={{ flex: 1 }} onLayout={e => { setRootH(e.nativeEvent.layout.height); measureLift(); }}>
        <TouchableOpacity style={cmt.backdrop} activeOpacity={1} onPress={dismiss} />
        <Animated.View style={[cmt.sheet, {
          height: sheetH,
          bottom: kbLift,
          // the home-indicator inset is under the keyboard while it's open
          paddingBottom: kbLift > 0 ? 4 : insets.bottom + 4,
          transform: [{ translateY: slideY }],
        }]}>
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
            <ActivityIndicator color="#7A0EED" style={{ flex: 1 }} />
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
          ) : (
            <View style={cmt.disabledBar}>
              <Ionicons name="lock-closed-outline" size={14} color="#ABADB2" />
              <Text style={cmt.disabledText}>Comments are turned off</Text>
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

// ── Post card ─────────────────────────────────────────────────────────────────

const VIDEO_H   = SCREEN_W * 1.25; // fixed 4:5 portrait for all videos (Instagram-style)
const MAX_IMG_H = SCREEN_W * 1.25; // image cap at 4:5 portrait
const MIN_IMG_H = SCREEN_W * 0.5;  // image floor at 2:1 landscape

// Calls into an expo-video player that may already have been released
// (component unmounting); a released player throws, which is safe to ignore.
function safePlayer(fn: () => void) {
  try { fn(); } catch { /* player already released */ }
}

/**
 * Everything a post does — like, save, follow, download, double-tap heart,
 * video play/pause/autoplay — shared by the feed card (PostCard) and the
 * full-screen post page (PostReel), so both behave the same.
 */
// A counted view is shared with every card showing that post (the Home feed
// card stays mounted while the post page counts the view).
const viewCountListeners = new Set<(postId: string, views: number) => void>();
function publishViewCount(postId: string, views: number) {
  viewCountListeners.forEach(fn => fn(postId, views));
}

export function usePostInteractions(post: FeedPost, { currentUserId, following, onFollowChange, onOpenPost, autoPlay = false }: {
  currentUserId: string;
  following: boolean;
  onFollowChange: (userId: string, nowFollowing: boolean) => void;
  /** Single tap on the media opens the post's own page (instead of play/pause). */
  onOpenPost?: () => void;
  /** A video starts playing as soon as its screen is in view. */
  autoPlay?: boolean;
}) {
  const firstMedia = post.media?.[0];
  const mediaUri = firstMedia ? resolveMedia(firstMedia.media_url) : null;
  const isVideo = firstMedia?.media_type === 'video';

  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likes_count);
  const [commentsCount] = useState(post.comments_count);
  const [downloading, setDownloading] = useState(false);
  const [mediaError, setMediaError] = useState(false);
  const [mediaHeight, setMediaHeight] = useState(isVideo ? VIDEO_H : SCREEN_W);
  const [followLoading, setFollowLoading] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const likeScale = useRef(new Animated.Value(1)).current;
  const initDone = useRef(false);
  // Double-tap-to-like: big heart that pops over the media
  const bigHeartScale = useRef(new Animated.Value(0)).current;
  const bigHeartOpacity = useRef(new Animated.Value(0)).current;
  const lastTapRef = useRef(0);
  const singleTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (singleTapTimer.current) clearTimeout(singleTapTimer.current); }, []);

  const isOwnPost = !!currentUserId && post.user_id === currentUserId;
  const displayName = post.username ?? post.full_name ?? 'User';
  const initial = displayName[0]?.toUpperCase() ?? '?';
  const color = avatarColor(post.user_id);
  const avatarUri = resolveMedia(post.avatar_url);

  const videoPlayer = useVideoPlayer(isVideo && mediaUri ? { uri: mediaUri } : null, p => {
    p.loop = true;
    p.muted = false;
    p.timeUpdateEventInterval = 0.5; // for the view count below
  });

  // A view counts once someone has watched at least half the video. Seconds
  // actually played are added up (seeking / the jump back on loop don't
  // count); at half the length the view is sent once. The server counts it
  // once per person per day.
  const [viewsCount, setViewsCount] = useState(post.views_count ?? 0);
  useEffect(() => {
    const onCount = (postId: string, views: number) => { if (postId === post.id) setViewsCount(views); };
    viewCountListeners.add(onCount);
    return () => { viewCountListeners.delete(onCount); };
  }, [post.id]);
  const watchedRef = useRef(0);
  const lastTimeRef = useRef<number | null>(null);
  const viewSentRef = useRef(false);
  useEffect(() => {
    if (!isVideo || !videoPlayer) return;
    const sub = videoPlayer.addListener('timeUpdate', ({ currentTime }) => {
      const last = lastTimeRef.current;
      lastTimeRef.current = currentTime;
      if (last == null || viewSentRef.current) return;
      const step = currentTime - last;
      if (step > 0 && step < 2) watchedRef.current += step;
      let duration = 0;
      try { duration = videoPlayer.duration; } catch { /* released */ }
      if (duration > 0 && watchedRef.current >= duration / 2) {
        viewSentRef.current = true;
        const token = authStore.getToken();
        fetch(`${BASE_URL}/posts/${post.id}/view`, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
          .then(r => r.json())
          .then(j => { if (j.success) publishViewCount(post.id, j.data.views_count); })
          .catch(() => {});
      }
    });
    return () => sub.remove();
  }, [isVideo, videoPlayer, post.id]);

  // Measure actual image size and fit height to natural aspect ratio
  useEffect(() => {
    if (!mediaUri || isVideo) return;
    Image.getSize(
      mediaUri,
      (w, h) => {
        if (!w || !h) return;
        const natural = SCREEN_W * (h / w);
        setMediaHeight(Math.min(MAX_IMG_H, Math.max(MIN_IMG_H, natural)));
      },
      () => {},
    );
  }, [mediaUri, isVideo]);

  // autoPlay: start the video when the screen comes into view (the post page).
  // Pause video when user switches away from this tab. This cleanup also runs
  // when the card unmounts (reload, list recycling), and by then
  // useVideoPlayer may already have released the native player — calling
  // pause() on it throws "shared object already released", so guard it.
  useFocusEffect(
    useCallback(() => {
      if (autoPlay && isVideo && videoPlayer) {
        safePlayer(() => videoPlayer.play());
        setVideoPlaying(true);
      }
      return () => {
        if (isVideo && videoPlayer) {
          safePlayer(() => videoPlayer.pause());
          setVideoPlaying(false);
        }
      };
    }, [autoPlay, isVideo, videoPlayer]),
  );

  // Fetch liked state once on mount
  useEffect(() => {
    if (initDone.current) return;
    initDone.current = true;
    const token = authStore.getToken();
    if (!token) return;
    fetch(`${BASE_URL}/posts/${post.id}/liked`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(j => { if (j.success) { setLiked(j.data.liked); setSaved(!!j.data.saved); } })
      .catch(() => {});
  }, [post.id]);

  const handleFollow = async () => {
    if (followLoading || isOwnPost) return;
    const token = authStore.getToken();
    if (!token) return;
    const wasFollowing = following;
    onFollowChange(post.user_id, !wasFollowing);
    setFollowLoading(true);
    try {
      await fetch(`${BASE_URL}/auth/follow/${post.user_id}`, {
        method: wasFollowing ? 'DELETE' : 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      onFollowChange(post.user_id, wasFollowing);
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

  // Saved posts show in your profile's Saved tab. Optimistic, like the like button.
  const handleSave = () => {
    const token = authStore.getToken();
    if (!token) return;
    const wasSaved = saved;
    setSaved(!wasSaved);
    fetch(`${BASE_URL}/posts/${post.id}/save`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(j => { if (j.success) setSaved(j.data.saved); else setSaved(wasSaved); })
      .catch(() => setSaved(wasSaved));
  };

  const toggleVideo = () => {
    if (videoPlaying) {
      safePlayer(() => videoPlayer.pause());
      setVideoPlaying(false);
    } else {
      safePlayer(() => videoPlayer.play());
      setVideoPlaying(true);
    }
  };

  const popBigHeart = () => {
    bigHeartScale.setValue(0);
    bigHeartOpacity.setValue(1);
    Animated.sequence([
      Animated.spring(bigHeartScale, { toValue: 1, friction: 4, tension: 140, useNativeDriver: true }),
      Animated.delay(350),
      Animated.parallel([
        Animated.timing(bigHeartScale, { toValue: 1.3, duration: 200, useNativeDriver: true }),
        Animated.timing(bigHeartOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]),
    ]).start();
  };

  // Double tap = like (never unlikes, like Instagram) + heart pop. On videos a
  // single tap still plays/pauses, but only after the double-tap window has
  // passed so a double tap doesn't also toggle playback.
  const DOUBLE_TAP_MS = 280;
  const handleMediaTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < DOUBLE_TAP_MS) {
      lastTapRef.current = 0;
      if (singleTapTimer.current) { clearTimeout(singleTapTimer.current); singleTapTimer.current = null; }
      popBigHeart();
      if (!liked) handleLike();
      return;
    }
    lastTapRef.current = now;
    if (onOpenPost) {
      // Single tap → the post's page (after the double-tap window, so a
      // double tap still only likes). A playing video stops first.
      singleTapTimer.current = setTimeout(() => {
        singleTapTimer.current = null;
        if (isVideo && videoPlaying) {
          safePlayer(() => videoPlayer.pause());
          setVideoPlaying(false);
        }
        onOpenPost();
      }, DOUBLE_TAP_MS);
      return;
    }
    if (isVideo && !mediaError) {
      singleTapTimer.current = setTimeout(() => {
        singleTapTimer.current = null;
        toggleVideo();
      }, DOUBLE_TAP_MS);
    }
  };

  const handleDownload = async () => {
    if (!mediaUri || downloading) return;
    setDownloading(true);
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync(true);
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow gallery access to save the file.');
        return;
      }
      const ext = isVideo ? 'mp4' : 'jpg';
      const destUri = `${cacheDirectory}rara_${post.id}.${ext}`;
      const result = await downloadAsync(mediaUri, destUri);
      if (result.status === 200) {
        await MediaLibrary.saveToLibraryAsync(destUri);
        Alert.alert('Saved!', `${isVideo ? 'Video' : 'Image'} saved to your gallery.`);
        // Counts toward Trending (once per person)
        const token = authStore.getToken();
        if (token) {
          fetch(`${BASE_URL}/posts/${post.id}/download`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
        }
      } else {
        Alert.alert('Error', 'Could not download the file.');
      }
    } catch {
      Alert.alert('Error', 'Could not save the file.');
    } finally {
      setDownloading(false);
    }
  };

  return {
    mediaUri, isVideo, mediaError, setMediaError, mediaHeight,
    liked, saved, likesCount, commentsCount, viewsCount, downloading, followLoading, videoPlaying,
    likeScale, bigHeartScale, bigHeartOpacity,
    isOwnPost, displayName, initial, color, avatarUri, videoPlayer,
    handleFollow, handleLike, handleSave, handleMediaTap, handleDownload,
  };
}

export function PostCard({ post, currentUserId, onOpenComments, following, onFollowChange, onTagPress, onOpenPost, autoPlay = false }: {
  post: FeedPost;
  currentUserId: string;
  onOpenComments: (postId: string, allowComments: boolean) => void;
  following: boolean;
  onFollowChange: (userId: string, nowFollowing: boolean) => void;
  onTagPress?: (tag: { id: string; parent_id: string | null }) => void;
  /** Single tap on the media opens the post's own page (the feed passes it;
   *  the post page itself doesn't, so there a tap plays/pauses a video). */
  onOpenPost?: () => void;
  /** A video starts playing as soon as its screen is in view (the post page). */
  autoPlay?: boolean;
}) {
  const {
    mediaUri, isVideo, mediaError, setMediaError, mediaHeight,
    liked, saved, likesCount, commentsCount, viewsCount, downloading, followLoading, videoPlaying,
    likeScale, bigHeartScale, bigHeartOpacity,
    isOwnPost, displayName, initial, color, avatarUri, videoPlayer,
    handleFollow, handleLike, handleSave, handleMediaTap, handleDownload,
  } = usePostInteractions(post, { currentUserId, following, onFollowChange, onOpenPost, autoPlay });

  return (
    <View style={card.container}>
      {/* Card header */}
      <View style={card.header}>
        <TouchableOpacity
          style={card.avatarNameRow}
          onPress={() => router.push(`/user/${post.user_id}` as any)}
          activeOpacity={0.8}>
          <Avatar initial={initial} color={color} uri={avatarUri} />
          <View style={card.headerText}>
            <Text style={card.username}>{displayName}</Text>
            <Text style={card.time}>{timeAgo(post.created_at)}</Text>
          </View>
        </TouchableOpacity>
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

      {/* Admin tags, e.g. "#📺 తెలుగు టీవీ షోస్ #Janmashtami" — tap to open that tab */}
      {!!post.tag_list?.length && (
        <View style={card.tagRow}>
          {post.tag_list.map(t => (
            <Text key={t.id} style={card.tagText} onPress={() => onTagPress?.(t)}>#{t.name}</Text>
          ))}
        </View>
      )}

      {/* Media */}
      <View style={[card.media, { height: mediaHeight }]}>
        {mediaUri && !mediaError ? (
          isVideo ? (
            <VideoView
              player={videoPlayer}
              style={{ width: SCREEN_W, height: mediaHeight }}
              contentFit="cover"
              nativeControls={false}
            />
          ) : (
            <Image
              source={{ uri: mediaUri }}
              style={{ width: SCREEN_W, height: mediaHeight }}
              resizeMode="cover"
              onError={() => setMediaError(true)}
            />
          )
        ) : (
          <View style={[card.mediaPlaceholder, { height: mediaHeight }]}>
            <Ionicons name={isVideo ? 'videocam-outline' : 'image-outline'} size={40} color="rgba(255,255,255,0.3)" />
          </View>
        )}
        {/* Tap layer sits ON TOP of the media: the native video surface
            swallows touches on Android, so a wrapper around it never sees them */}
        <Pressable style={StyleSheet.absoluteFill} onPress={handleMediaTap} />
        {isVideo && !mediaError && (
          <View style={card.viewsBadge} pointerEvents="none">
            <Ionicons name="eye" size={12} color="#FFFFFF" />
            <Text style={card.viewsText}>{formatCount(viewsCount)} {viewsCount === 1 ? 'view' : 'views'}</Text>
          </View>
        )}
        {isVideo && !mediaError && (
          <View style={card.playOverlay} pointerEvents="none">
            {!videoPlaying && (
              <View style={card.playCircle}>
                <Ionicons name="play" size={28} color="#FFFFFF" style={{ paddingLeft: 3 }} />
              </View>
            )}
          </View>
        )}
        <View style={card.bigHeartWrap} pointerEvents="none">
          <Animated.View style={{ opacity: bigHeartOpacity, transform: [{ scale: bigHeartScale }] }}>
            <Ionicons name="heart" size={96} color="#E14C57" style={card.bigHeart} />
          </Animated.View>
        </View>
      </View>

      {/* Actions */}
      <View style={card.actions}>
        <View style={card.actionsLeft}>
          <TouchableOpacity style={card.actionBtn} onPress={handleLike} activeOpacity={0.8}>
            <Animated.View style={{ transform: [{ scale: likeScale }] }}>
              <BoldIcon
                name={liked ? 'heart' : 'heart-outline'}
                size={22}
                color={liked ? '#E14C57' : '#60626A'}
                weight={POST_ICON_WEIGHT}
              />
            </Animated.View>
            <Text style={[card.actionCount, liked && { color: '#E14C57' }]}>{formatCount(likesCount)}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={card.actionBtn} onPress={() => onOpenComments(post.id, post.allow_comments)} activeOpacity={0.8}>
            <BoldIcon name="chatbubble-outline" size={20} color="#60626A" weight={POST_ICON_WEIGHT} />
            <Text style={card.actionCount}>{formatCount(commentsCount)}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={card.actionBtn}
            activeOpacity={0.8}
            onPress={() => sharePost({ id: post.id, authorName: displayName, caption: post.caption })}
            accessibilityLabel="Share post">
            <BoldIcon name="arrow-redo-outline" size={21} color="#60626A" weight={POST_ICON_WEIGHT} />
          </TouchableOpacity>
        </View>

        <View style={card.actionsRight}>
          <TouchableOpacity style={card.actionBtn} onPress={handleSave} activeOpacity={0.8} accessibilityLabel={saved ? 'Remove from saved' : 'Save post'}>
            <BoldIcon name={saved ? 'bookmark' : 'bookmark-outline'} size={21} color={saved ? '#7A0EED' : '#60626A'} weight={POST_ICON_WEIGHT} />
          </TouchableOpacity>
          <TouchableOpacity style={card.actionBtn} onPress={handleDownload} disabled={downloading} activeOpacity={0.8}>
            {downloading
              ? <ActivityIndicator size="small" color="#7A0EED" />
              : <BoldIcon name="download-outline" size={22} color="#60626A" weight={POST_ICON_WEIGHT} />}
          </TouchableOpacity>
        </View>
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

  // Earning slabs / gem value (admin-managed) — loaded quietly so the wallet
  // has them ready; the wallet retries if this fails.
  useEffect(() => { earningsConfigStore.load(); }, []);
  const bottomInset    = Platform.OS === 'android' ? Math.max(insets.bottom, 12) : 0;
  const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 80 : 56 + bottomInset;

  const currentUserId = authStore.getUserId() ?? '';
  const [activeTab, setActiveTab] = useState<string>('trending');
  // Sub-tag chip selected under the current tab (null = whole tab)
  const [activeChip, setActiveChip] = useState<string | null>(null);
  const [tagTabs, setTagTabs] = useState<PostTag[]>([]);
  const [trendingChips, setTrendingChips] = useState<PostTag[]>([]);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Admin → Banners → Home
  const [banners, setBanners] = useState<Banner[]>([]);
  useEffect(() => { fetchBanners('home').then(setBanners); }, []);

  // Follow state shared across all posts — keyed by userId
  const [followMap, setFollowMap] = useState<Record<string, boolean>>({});

  const handleFollowChange = useCallback((userId: string, nowFollowing: boolean) => {
    setFollowMap(prev => ({ ...prev, [userId]: nowFollowing }));
  }, []);

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

  const loadTags = useCallback(() => {
    apiPostTags().then(r => { if (r.ok) setTagTabs(r.data); });
    apiTrendingPostTags().then(r => { if (r.ok) setTrendingChips(r.data); });
  }, []);
  useEffect(() => { loadTags(); }, [loadTags]);

  const homeTabs: HomeTab[] = [...DEFAULT_TABS, ...tagTabs.map(t => ({ key: t.id, label: t.name }))];
  const currentTagTab = tagTabs.find(t => t.id === activeTab) ?? null;
  // Chips under the tab: Trending → most-used tags; admin tab → its sub tags
  const chips = activeTab === 'trending' ? trendingChips : currentTagTab?.children ?? [];
  const chipTitle = activeTab === 'trending' ? 'Trending Now' : currentTagTab?.name ?? '';

  // An admin tab removed in the admin panel falls back to Trending
  useEffect(() => {
    if (!DEFAULT_TABS.some(t => t.key === activeTab) && tagTabs.length && !currentTagTab) {
      setActiveTab('trending'); setActiveChip(null);
    }
  }, [tagTabs, activeTab, currentTagTab]);

  const changeTab = useCallback((key: string) => { setActiveTab(key); setActiveChip(null); }, []);

  // #tag on a post → open its tab (sub tag also selects that chip)
  const openTag = useCallback((tag: { id: string; parent_id: string | null }) => {
    if (tag.parent_id) { setActiveTab(tag.parent_id); setActiveChip(tag.id); }
    else { setActiveTab(tag.id); setActiveChip(null); }
  }, []);

  const loadFeed = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '30', tab: activeTab });
      if (activeChip) params.set('tag', activeChip);
      const token = authStore.getToken();
      const r = await fetch(`${BASE_URL}/posts/feed?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const j = await r.json();
      if (j.success) {
        const feedPosts: FeedPost[] = j.data;
        setPosts(feedPosts);
        // Batch-fetch follow state for all unique post authors (except self)
        const token = authStore.getToken();
        if (token) {
          const userIds = [...new Set(feedPosts.map(p => p.user_id).filter(id => id !== currentUserId))];
          const map: Record<string, boolean> = {};
          await Promise.all(userIds.map(uid =>
            fetch(`${BASE_URL}/auth/follow/${uid}`, { headers: { Authorization: `Bearer ${token}` } })
              .then(r2 => r2.json())
              .then(j2 => { if (j2.success) map[uid] = j2.following; })
              .catch(() => {})
          ));
          setFollowMap(prev => ({ ...prev, ...map }));
        }
      }
    } catch { /* silent */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUserId, activeTab, activeChip]);

  useEffect(() => { loadFeed(); }, [loadFeed]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppScreenHeader title="RaRa Live" right={<HeaderRight />} backgroundColor="#FFFFFF" noBottomShadow />
      <View style={styles.headerGap} />
      <View style={styles.screenBody}>
        <BannerCarousel banners={banners} />
        <HomeTabs items={homeTabs} active={activeTab} onChange={changeTab} />

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
            onRefresh={() => { setRefreshing(true); loadFeed(true); loadTags(); fetchBanners('home').then(setBanners); }}
            ListHeaderComponent={
              <TagChips title={chipTitle} chips={chips} selected={activeChip} onSelect={setActiveChip} />
            }
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Ionicons name={activeTab === 'following' ? 'people-outline' : activeTab === 'video' ? 'videocam-outline' : 'images-outline'} size={56} color="#D0C8F0" />
                <Text style={styles.emptyTitle}>
                  {activeTab === 'following' ? 'No posts from people you follow'
                    : activeTab === 'video' ? 'No videos yet'
                    : activeChip ? 'No posts with this tag yet' : 'No posts yet'}
                </Text>
                <Text style={styles.emptySub}>
                  {activeTab === 'following' ? 'Follow people to see their posts here' : 'Posts you and others share will appear here'}
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <PostCard
                post={item}
                currentUserId={currentUserId}
                onOpenComments={openComments}
                following={!!followMap[item.user_id]}
                onFollowChange={handleFollowChange}
                onTagPress={openTag}
                onOpenPost={() => router.push(`/post/${item.id}` as never)}
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
  // Each box exactly as wide as its 24px icon, so the one 12px gap is the
  // visible space between search, bell and avatar; hitSlop keeps taps easy.
  row:      { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBtn:  { width: 24, height: 38, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  badge: {
    position: 'absolute', top: 4, right: -4,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: '#E14C57', borderWidth: 1.5, borderColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    fontSize: 9, fontWeight: '800', color: '#FFFFFF', lineHeight: 11,
  },
  avatarBtn: {
    width: 34, height: 34, borderRadius: 17,
    overflow: 'hidden', borderWidth: 2, borderColor: '#7A0EED',
  },
  avatar: { width: '100%', height: '100%' },
  avatarFallback: {
    width: '100%', height: '100%',
    backgroundColor: '#EDE8F7', alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { fontSize: 14, fontWeight: '800', color: '#7A0EED' },
});

const tabs = StyleSheet.create({
  container:   { backgroundColor: '#FFFFFF', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E0DDED' },
  scroll:      { paddingHorizontal: 20 },
  tab:         { paddingVertical: 10, marginRight: 28, alignItems: 'center', position: 'relative' },
  label:       { fontSize: 15, fontWeight: '600', color: '#ABADB2' },
  labelActive: { color: '#7A0EED', fontWeight: '700' },
  underline:   { position: 'absolute', bottom: 0, left: 0, right: 0, height: 2.5, borderRadius: 2 },
});

const chipBox = StyleSheet.create({
  wrap:           { backgroundColor: '#F1F0F6', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16, marginBottom: 10 },
  title:          { fontSize: 15, fontWeight: '800', color: '#1C1E22', marginBottom: 10 },
  row:            { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FFFFFF', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 9,
    borderWidth: 1, borderColor: '#E6E3EE',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  chipActive:     { borderColor: '#7A0EED', backgroundColor: '#F4EEFF' },
  chipText:       { fontSize: 13.5, color: '#1C1E22', fontWeight: '500' },
  chipTextActive: { color: '#7A0EED', fontWeight: '700' },
});


const cap = StyleSheet.create({
  wrap:     { paddingHorizontal: 16, paddingBottom: 14 },
  text:     { fontSize: 13, color: '#3C3F4A', lineHeight: 19 },
  name:     { fontWeight: '700', color: '#1C1E22' },
  readMore: { fontSize: 12, color: '#7A0EED', fontWeight: '600', marginTop: 2 },
});

const card = StyleSheet.create({
  viewsBadge: {
    position: 'absolute', left: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.5)',
  },
  viewsText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  container:  { backgroundColor: '#FFFFFF', shadowColor: '#4A0099', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  header:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  avatarNameRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  headerText: { flex: 1 },
  username:   { fontSize: 14, fontWeight: '700', color: '#1C1E22' },
  time:       { fontSize: 12, color: '#ABADB2', marginTop: 1 },
  followBtn:     { height: 32, paddingHorizontal: 18, borderRadius: 999, backgroundColor: '#7A0EED', alignItems: 'center', justifyContent: 'center', shadowColor: '#7A0EED', shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  followingBtn:  { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: '#7A0EED', shadowOpacity: 0, elevation: 0 },
  followText:    { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  followingText: { color: '#7A0EED' },
  tagRow:        { flexDirection: 'row', flexWrap: 'wrap', columnGap: 8, rowGap: 2, paddingHorizontal: 16, paddingBottom: 10 },
  tagText:       { fontSize: 14, fontWeight: '600', color: '#3B6FE0' },

  media:            { width: SCREEN_W, overflow: 'hidden' },
  mediaPlaceholder: { width: SCREEN_W, backgroundColor: '#0D0D1A', alignItems: 'center', justifyContent: 'center' },
  bigHeartWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  // same red as the liked heart in the action row; soft dark glow keeps it visible on red/bright media
  bigHeart: { textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 14, textShadowOffset: { width: 0, height: 2 } },
  playOverlay:      { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  playCircle:       { width: 62, height: 62, borderRadius: 31, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)' },

  actions:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  actionsLeft:{ flexDirection: 'row', alignItems: 'center', gap: 18 },
  actionsRight:{ flexDirection: 'row', alignItems: 'center', gap: 16 },
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
  // flex: 1 like the comment list, so the input stays pinned to the bottom of the sheet
  empty:           { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 48 },
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