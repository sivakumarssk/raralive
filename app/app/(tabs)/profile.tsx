import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useIsFocused } from '@react-navigation/native';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { apiChatUnreadCount, apiLogoutAllDevices, BASE_URL, MEDIA_BASE } from '@/services/api';
import { authStore } from '@/store/auth-store';
import { chatSocketStore } from '@/store/chat-socket-store';
import { friendZoneSocketStore } from '@/store/friend-zone-socket-store';
import { socketStore } from '@/store/socket-store';
import { ImageViewer } from '@/components/ImageViewer';
import { ProfileTags } from '@/components/ProfileTags';
import { GradientButton } from '@/components/ui/gradient-button';
import { BoldIcon } from '@/components/ui/bold-icon';
import { shareProfile } from '@/utils/share';
import { ExitIcon } from '@/components/ui/exit-icon';
import { MenuIcon } from '@/components/ui/menu-icon';
import { useProfileScroll } from '@/hooks/use-profile-scroll';
import { LANGUAGE_PICKER_BG, LanguageGrid, LanguagePickerHeading } from '@/screens/language/language-grid';
import { avatarSource } from '@/utils/default-avatar';

const SCREEN_W = Dimensions.get('window').width;
// Scaled to screen width so proportions stay the same on every device
const COVER_H = Math.round(SCREEN_W * 0.42);
const AVATAR_SIZE = Math.round(SCREEN_W * 0.22);
// How much of the avatar overlaps the cover
const AVATAR_OVERLAP = Math.round(AVATAR_SIZE * 0.3);

/** "+919876543210" → "+91 98765 43210"; anything else is shown as stored. */
function formatPhone(phone: string) {
  const m = phone.match(/^\+91(\d{5})(\d{5})$/);
  return m ? `+91 ${m[1]} ${m[2]}` : phone;
}

type UserProfile = {
  id: string;
  phone: string;
  email: string | null;
  username: string | null;
  full_name: string | null;
  gender: string | null;
  date_of_birth: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  bio: string | null;
  is_phone_verified: boolean;
  created_at: string;
  followers_count: number;
  following_count: number;
  posts_count: number;
  role?: string;
  agency_id?: string | null;
};

type PostMedia = { id: string; media_url: string; media_type: 'photo' | 'video'; sort_order: number };
type FeedPost = { id: string; caption: string | null; likes_count: number; media: PostMedia[] };

const GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say'];

function resolveUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  try { return `${MEDIA_BASE}${new URL(url).pathname}`; }
  catch { return `${MEDIA_BASE}/${url.replace(/^\//, '')}`; }
}

function StatBox({ value, label }: { value: number; label: string }) {
  const display = value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value);
  return (
    <View style={s.statBox}>
      <Text style={s.statValue}>{display}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function PostGrid({ posts, emptyIcon = 'images-outline', emptyText = 'No posts yet' }: {
  posts: FeedPost[];
  emptyIcon?: keyof typeof Ionicons.glyphMap;
  emptyText?: string;
}) {
  const router = useRouter();
  const SIZE = (SCREEN_W - 4) / 3;
  if (posts.length === 0) {
    return (
      <View style={s.emptyGrid}>
        <Ionicons name={emptyIcon} size={48} color="#D0C8F0" />
        <Text style={s.emptyGridText}>{emptyText}</Text>
      </View>
    );
  }
  return (
    <FlatList
      data={posts}
      numColumns={3}
      scrollEnabled={false}
      keyExtractor={p => p.id}
      ItemSeparatorComponent={() => <View style={{ height: 2 }} />}
      columnWrapperStyle={{ gap: 2 }}
      renderItem={({ item }) => {
        const media = item.media?.[0];
        const uri = media ? resolveUrl(media.media_url) : null;
        const isVideo = media?.media_type === 'video';
        return (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push(`/post/${item.id}` as never)}
            style={{ width: SIZE, height: SIZE, backgroundColor: '#EDE8FF' }}>
            {uri ? (
              <Image source={{ uri }} style={{ width: SIZE, height: SIZE }} resizeMode="cover" />
            ) : (
              <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="image-outline" size={24} color="#C4B5F8" />
              </View>
            )}
            {isVideo && (
              <View style={s.videoIcon}>
                <Ionicons name="play" size={14} color="#FFFFFF" />
              </View>
            )}
          </TouchableOpacity>
        );
      }}
    />
  );
}

// ── Bottom sheet wrapper ──────────────────────────────────────────────────────
function BottomSheet({ visible, onClose, children, style }: {
  visible: boolean; onClose: () => void; children: React.ReactNode; style?: object;
}) {
  const insets = useSafeAreaInsets();
  const slideY = useRef(new Animated.Value(600)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(slideY, { toValue: 0, duration: 260, useNativeDriver: true }).start();
    } else {
      Animated.timing(slideY, { toValue: 600, duration: 220, useNativeDriver: true }).start();
    }
  }, [visible, slideY]);

  if (!visible) return null;
  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={onClose}>
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose} />
      <Animated.View style={[s.sheet, style, { transform: [{ translateY: slideY }], paddingBottom: insets.bottom + 12 }]}>
        <View style={s.sheetHandle} />
        {children}
      </Animated.View>
    </Modal>
  );
}

// ── Menu sheet (three dots) ───────────────────────────────────────────────────
// Posts / Saved tab icons: as thick on screen as the bottom tab bar's at this size
const TAB_ICON_WEIGHT = 16;

// Opened inside the app (screens/legal), not on the website
const LEGAL_LINKS = [
  { label: 'Privacy Policy',   icon: 'shield-checkmark', color: '#16A34A', route: '/legal/privacy-policy' },
  { label: 'Terms of Service', icon: 'document-text',    color: '#0D9488', route: '/legal/terms' },
  { label: 'Delete Account',   icon: 'trash',            color: '#E14C57', route: '/legal/delete-account' },
] as const;


function MenuSheet({ visible, onClose, onEditProfile, onChangeLanguage, onLogout, onLogoutAll, onAgencyWallet }: {
  visible: boolean; onClose: () => void;
  onEditProfile: () => void; onChangeLanguage: () => void; onLogout: () => void; onLogoutAll: () => void;
  /** Only passed for agency accounts. */
  onAgencyWallet?: () => void;
}) {
  const router = useRouter();
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text style={s.sheetTitle}>More Options</Text>
      <TouchableOpacity style={s.menuItem} onPress={() => { onClose(); onEditProfile(); }} activeOpacity={0.8}>
        <MenuIcon name="person-circle" color="#7A0EED" />
        <Text style={s.menuItemText}>Edit Profile</Text>
        <Ionicons name="chevron-forward" size={15} color="#ABADB2" />
      </TouchableOpacity>
      <TouchableOpacity style={s.menuItem} onPress={() => { onClose(); onChangeLanguage(); }} activeOpacity={0.8}>
        <MenuIcon name="language" color="#1D6FE0" />
        <Text style={s.menuItemText}>Change Language</Text>
        <Ionicons name="chevron-forward" size={15} color="#ABADB2" />
      </TouchableOpacity>
      {onAgencyWallet && (
        <TouchableOpacity style={s.menuItem} onPress={() => { onClose(); onAgencyWallet(); }} activeOpacity={0.8}>
          <MenuIcon name="wallet" color="#F59E0B" />
          <Text style={s.menuItemText}>Agency Wallet</Text>
          <Ionicons name="chevron-forward" size={15} color="#ABADB2" />
        </TouchableOpacity>
      )}
      <View style={s.menuDivider} />
      {LEGAL_LINKS.map(link => (
        <TouchableOpacity key={link.route} style={s.menuItem} onPress={() => { router.push(link.route as never); onClose(); }} activeOpacity={0.8}>
          <MenuIcon name={link.icon} color={link.color} />
          <Text style={s.menuItemText}>{link.label}</Text>
          <Ionicons name="chevron-forward" size={15} color="#ABADB2" />
        </TouchableOpacity>
      ))}
      <View style={s.menuDivider} />
      <TouchableOpacity style={s.menuItem} onPress={() => { onClose(); onLogout(); }} activeOpacity={0.8}>
        <View style={s.menuIconSlot}><ExitIcon size={22} /></View>
        <Text style={[s.menuItemText, { color: '#E14C57' }]}>Log Out</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.menuItem} onPress={() => { onClose(); onLogoutAll(); }} activeOpacity={0.8}>
        <MenuIcon name="power" color="#E14C57" />
        <Text style={[s.menuItemText, { color: '#E14C57' }]}>Log Out of All Devices</Text>
      </TouchableOpacity>
    </BottomSheet>
  );
}

// ── Language sheet ────────────────────────────────────────────────────────────
// Same two-column picker as the login language screen: tap a card to select
// it, then Continue to save.
function LanguageSheet({ visible, onClose, currentLang, onSelect }: {
  visible: boolean; onClose: () => void; currentLang: string; onSelect: (id: string) => void;
}) {
  const [selected, setSelected] = useState(currentLang);
  useEffect(() => { if (visible) setSelected(currentLang); }, [visible, currentLang]);
  return (
    <BottomSheet visible={visible} onClose={onClose} style={s.langSheet}>
      <View style={s.langSheetBody}>
        <LanguagePickerHeading />
        <LanguageGrid selected={selected} onSelect={setSelected} />
        <View style={s.langSheetFooter}>
          <GradientButton
            label="Continue"
            iconName="arrow-forward"
            onPress={() => { if (selected) onSelect(selected); onClose(); }}
          />
        </View>
      </View>
    </BottomSheet>
  );
}

// ── Edit profile sheet ────────────────────────────────────────────────────────
function EditProfileSheet({ visible, onClose, profile, onSaved }: {
  visible: boolean; onClose: () => void; profile: UserProfile; onSaved: (updated: UserProfile) => void;
}) {
  const [fullName, setFullName] = useState(profile.full_name || '');
  const [username, setUsername] = useState(profile.username || '');
  const [bio, setBio] = useState(profile.bio || '');
  const [gender, setGender] = useState(profile.gender || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // reset when opened
  useEffect(() => {
    if (visible) {
      setFullName(profile.full_name || '');
      setUsername(profile.username || '');
      setBio(profile.bio || '');
      setGender(profile.gender || '');
      setError('');
    }
  }, [visible, profile]);

  const save = async () => {
    if (!username.trim()) { setError('Username is required.'); return; }
    setSaving(true);
    setError('');
    try {
      const token = authStore.getToken();
      const form = new FormData();
      form.append('fullName', fullName.trim());
      form.append('username', username.trim());
      form.append('bio', bio.trim());
      if (gender) form.append('gender', gender.toLowerCase());
      const res = await fetch(`${BASE_URL}/auth/profile`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const json = await res.json();
      if (!json.success) { setError(json.message || 'Failed to save.'); return; }
      // Fetch updated profile with stats
      const meRes = await fetch(`${BASE_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
      const meJson = await meRes.json();
      if (meJson.success) onSaved(meJson.data);
      onClose();
    } catch { setError('Network error.'); }
    finally { setSaving(false); }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text style={s.sheetTitle}>Edit Profile</Text>
      <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 480 }} keyboardShouldPersistTaps="handled">
        <View style={{ paddingHorizontal: 20, gap: 14, paddingBottom: 8 }}>
          <View style={s.fieldWrap}>
            <Text style={s.fieldLabel}>Full name</Text>
            <TextInput style={s.fieldInput} value={fullName} onChangeText={setFullName} placeholder="Your name" placeholderTextColor="#C4C5CC" />
          </View>
          <View style={s.fieldWrap}>
            <Text style={s.fieldLabel}>Username <Text style={{ color: '#E14C57' }}>*</Text></Text>
            <TextInput style={s.fieldInput} value={username} onChangeText={setUsername} placeholder="username" placeholderTextColor="#C4C5CC" autoCapitalize="none" />
          </View>
          <View style={s.fieldWrap}>
            <Text style={s.fieldLabel}>Bio</Text>
            <TextInput style={[s.fieldInput, { height: 72, textAlignVertical: 'top' }]} value={bio} onChangeText={setBio} placeholder="About you…" placeholderTextColor="#C4C5CC" multiline />
          </View>
          <View style={s.fieldWrap}>
            <Text style={s.fieldLabel}>Gender</Text>
            <View style={s.genderRow}>
              {GENDERS.map(g => (
                <TouchableOpacity
                  key={g}
                  style={[s.genderChip, gender.toLowerCase() === g.toLowerCase() && s.genderChipActive]}
                  onPress={() => setGender(g === gender ? '' : g)}
                  activeOpacity={0.8}>
                  <Text style={[s.genderChipText, gender.toLowerCase() === g.toLowerCase() && s.genderChipTextActive]}>{g}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          {!!error && <Text style={{ color: '#E14C57', fontSize: 13 }}>{error}</Text>}
          <TouchableOpacity style={s.saveBtn} onPress={save} disabled={saving} activeOpacity={0.85}>
            {saving
              ? <ActivityIndicator color="#FFFFFF" size="small" />
              : <Text style={s.saveBtnText}>Save Changes</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </BottomSheet>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [redirecting, setRedirecting] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'saved'>('posts');
  const [savedPosts, setSavedPosts] = useState<FeedPost[]>([]);
  const [showMenu, setShowMenu] = useState(false);
  const [showLang, setShowLang] = useState(false);
  const [currentLang, setCurrentLang] = useState('en');
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [viewing, setViewing] = useState<'avatar' | 'cover' | null>(null);
  const scroll = useProfileScroll(COVER_H);

  const fetchData = useCallback(async (showSpinner: boolean) => {
    const token = authStore.getToken();
    if (!token) {
      setRedirecting(true);
      setTimeout(() => router.replace('/login' as never), 100);
      return;
    }
    if (showSpinner) setLoading(true);
    try {
      const [profileRes, postsRes] = await Promise.all([
        fetch(`${BASE_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
        fetch(`${BASE_URL}/posts/my`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      ]);
      const msg: string = profileRes.message || '';
      if (msg.toLowerCase().includes('token') || msg.toLowerCase().includes('unauthorized')) {
        authStore.clear(); setRedirecting(true);
        setTimeout(() => router.replace('/login' as never), 100);
        return;
      }
      if (profileRes.success) {
        setProfile(profileRes.data);
        if (profileRes.data?.preferred_language) setCurrentLang(profileRes.data.preferred_language);
      }
      if (postsRes.success) setPosts(postsRes.data);
    } catch {}
    finally { if (showSpinner) setLoading(false); }
  }, []);

  const fetchUnreadChatCount = useCallback(async () => {
    const token = authStore.getToken();
    if (!token) return;
    const res = await apiChatUnreadCount(token);
    if (res.ok) setUnreadChatCount(res.data.count);
  }, []);

  // Saved tab: fetched each time it's opened or the profile regains focus
  // (re-runs on tab change too, since the callback changes with activeTab)
  const loadSavedPosts = useCallback(() => {
    const token = authStore.getToken();
    if (!token) return;
    fetch(`${BASE_URL}/posts/saved`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(j => { if (j.success) setSavedPosts(j.data); })
      .catch(() => {});
  }, []);
  useFocusEffect(useCallback(() => { if (activeTab === 'saved') loadSavedPosts(); }, [activeTab, loadSavedPosts]));

  // Initial load with spinner
  useEffect(() => { fetchData(true); fetchUnreadChatCount(); }, []);

  // Refresh silently when returning from edit (no spinner, no flicker) — also
  // catches returning from the chat list after reading messages there.
  const isMounted = useRef(false);
  useFocusEffect(useCallback(() => {
    if (!isMounted.current) { isMounted.current = true; return; }
    fetchData(false);
    fetchUnreadChatCount();
  }, [fetchData, fetchUnreadChatCount]));

  const handleLogout = () => {
    authStore.clear();
    // Drop the old user's sockets so the next login connects with its own token.
    friendZoneSocketStore.disconnect();
    chatSocketStore.disconnect();
    socketStore.leave();
    router.replace('/login' as never);
  };

  const logoutAllDevices = async () => {
    const token = authStore.getToken();
    if (!token) return;
    // Close this device's sockets first so the server's "session revoked"
    // notice reaches only the other devices.
    friendZoneSocketStore.disconnect();
    chatSocketStore.disconnect();
    const res = await apiLogoutAllDevices(token);
    if (res.ok) { handleLogout(); return; }
    if (!authStore.getToken()) return; // already signed out by the 401 handler
    friendZoneSocketStore.connect();
    chatSocketStore.connect();
    Alert.alert("Couldn't log out", res.message);
  };

  const confirmLogoutAll = () => {
    Alert.alert(
      'Log out of all devices?',
      'You will be logged out everywhere your account is signed in, including this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log Out', style: 'destructive', onPress: logoutAllDevices },
      ],
    );
  };

  const handleLanguageSelect = async (langId: string) => {
    setCurrentLang(langId);
    authStore.setLanguage(langId);
    try {
      const token = authStore.getToken();
      await fetch(`${BASE_URL}/auth/language`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: langId }),
      });
    } catch {}
  };

  if (redirecting || loading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.centered}><ActivityIndicator size="large" color="#7A0EED" /></View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.centered}>
          <Ionicons name="alert-circle-outline" size={40} color="#ABADB2" />
          <Text style={s.errorText}>Failed to load profile.</Text>
          <TouchableOpacity onPress={handleLogout} style={s.logoutBtnSmall}>
            <Text style={s.logoutBtnSmallText}>Log Out</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const avatarUri = resolveUrl(profile.avatar_url);
  const coverUri = resolveUrl(profile.cover_url);
  const displayName = profile.full_name || profile.username || profile.phone;
  // What this account logged in with — own profile only, never shown to others
  const showEmail = authStore.getUser()?.loginMethod === 'email' && !!profile.email;

  return (
    <View style={s.safe}>
      {/* White status bar icons over the cover — only while this tab is focused */}
      {isFocused && <StatusBar style="light" />}
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40, minHeight: scroll.contentMinHeight }}
        onScroll={scroll.onScroll}
        scrollEventThrottle={16}>

        {/* Cover — extends up behind the status bar; tap to view it full screen */}
        <Animated.View style={[s.coverWrap, { height: COVER_H + insets.top }, scroll.coverStyle]}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={0.9}
            disabled={!coverUri}
            onPress={() => setViewing('cover')}
            accessibilityLabel="View cover photo">
            {coverUri ? (
              <Image source={{ uri: coverUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            ) : (
              <LinearGradient colors={['#4B00E8', '#7A04E5', '#B40CF0', '#FF2A76']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            )}
          </TouchableOpacity>
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, s.coverDim, scroll.coverDimStyle]} />
        </Animated.View>

        {/* Everything below the cover slides up over it on scroll */}
        <View style={s.profileBody}>
        <View style={s.profileBodyBg} />

        {/* Avatar + stats */}
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
            {profile.username && <Text style={s.username} numberOfLines={1}>@{profile.username}</Text>}
            <View style={s.statsRow}>
              <StatBox value={profile.followers_count} label="Followers" />
              <View style={s.statDivider} />
              <StatBox value={profile.following_count} label="Following" />
              <View style={s.statDivider} />
              <StatBox value={profile.posts_count} label="Posts" />
            </View>
          </View>
        </View>

        {/* Name / bio */}
        <View style={s.nameBlock}>
          <Text style={s.displayName}>{displayName}</Text>
          {profile.bio ? (
            <Text style={s.bio}>{profile.bio}</Text>
          ) : (
            <TouchableOpacity style={s.addBio} onPress={() => router.push('/profile/edit' as any)} activeOpacity={0.7}>
              <Ionicons name="add-circle-outline" size={14} color="#7A0EED" />
              <Text style={s.addBioText}>Add bio</Text>
            </TouchableOpacity>
          )}
          <View style={s.contactRow}>
            <Ionicons name={showEmail ? 'mail' : 'call'} size={13} color="#7A0EED" />
            <Text style={s.contactText} numberOfLines={1}>{showEmail ? profile.email : formatPhone(profile.phone)}</Text>
          </View>
        </View>

        <ProfileTags isAgency={profile.role === 'agency'} gender={profile.gender} />

        {/* Edit + chat + share */}
        <View style={s.actionRow}>
          <TouchableOpacity style={s.editBtn} onPress={() => router.push('/profile/edit' as any)} activeOpacity={0.85}>
            <Text style={s.editBtnText}>Edit Profile</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.shareBtn} onPress={() => router.push('/chat' as any)} activeOpacity={0.85}>
            <BoldIcon name="chatbubble-ellipses-outline" size={17} color="#7A0EED" weight={20} />
            {unreadChatCount > 0 && (
              <View style={s.chatBadge}>
                <Text style={s.chatBadgeText}>{unreadChatCount > 10 ? '10+' : unreadChatCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={s.shareBtn} activeOpacity={0.85} onPress={() => shareProfile({ id: profile.id, name: displayName })} accessibilityLabel="Share profile">
            <BoldIcon name="arrow-redo-outline" size={18} color="#7A0EED" weight={20} />
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={s.tabRow}>
          <TouchableOpacity style={[s.tab, activeTab === 'posts' && s.tabActive]} onPress={() => setActiveTab('posts')} activeOpacity={0.8}>
            <BoldIcon name="grid-outline" size={19} color={activeTab === 'posts' ? '#7A0EED' : '#ABADB2'} weight={TAB_ICON_WEIGHT} />
          </TouchableOpacity>
          <TouchableOpacity style={[s.tab, activeTab === 'saved' && s.tabActive]} onPress={() => setActiveTab('saved')} activeOpacity={0.8}>
            <BoldIcon name={activeTab === 'saved' ? 'bookmark' : 'bookmark-outline'} size={19} color={activeTab === 'saved' ? '#7A0EED' : '#ABADB2'} weight={TAB_ICON_WEIGHT} />
          </TouchableOpacity>
        </View>

        {activeTab === 'posts'
          ? <PostGrid posts={posts} />
          : <PostGrid posts={savedPosts} emptyIcon="bookmark-outline" emptyText="No saved posts" />}
      </View>
      </Animated.ScrollView>

      {/* Pinned, so back and the menu stay reachable while the page scrolls */}
      <TouchableOpacity style={[s.backBtn, { top: insets.top + 8 }]} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
      </TouchableOpacity>
      <TouchableOpacity style={[s.menuBtn, { top: insets.top + 8 }]} onPress={() => setShowMenu(true)}>
        <Ionicons name="ellipsis-horizontal" size={22} color="#FFFFFF" />
      </TouchableOpacity>

      <ImageViewer
        uri={viewing === 'cover' ? coverUri ?? null : viewing === 'avatar' ? avatarUri ?? null : null}
        title={viewing === 'cover' ? 'Cover photo' : 'Profile photo'}
        subtitle={displayName}
        onClose={() => setViewing(null)}
      />

      {/* Sheets */}
      <MenuSheet
        visible={showMenu}
        onClose={() => setShowMenu(false)}
        onEditProfile={() => router.push('/profile/edit' as any)}
        onChangeLanguage={() => setShowLang(true)}
        onLogout={handleLogout}
        onLogoutAll={confirmLogoutAll}
        onAgencyWallet={profile.role === 'agency' && profile.agency_id ? () => router.push('/agency-wallet' as any) : undefined}
      />
      <LanguageSheet
        visible={showLang}
        onClose={() => setShowLang(false)}
        currentLang={currentLang}
        onSelect={handleLanguageSelect}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: '#FFFFFF' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { fontSize: 14, color: '#ABADB2' },

  coverWrap: { width: SCREEN_W, height: COVER_H },
  backBtn:   { position: 'absolute', top: 10, left: 12, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  menuBtn:   { position: 'absolute', top: 10, right: 12, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },

  coverDim:      { backgroundColor: '#000000' },
  // Overlaps the cover by the avatar's overhang; the white panel starts below
  // that, so the avatar sits half on the cover and the page slides over it
  profileBody:   { marginTop: -AVATAR_OVERLAP },
  profileBodyBg: { position: 'absolute', top: AVATAR_OVERLAP, left: 0, right: 0, bottom: -40, backgroundColor: '#FFFFFF', borderTopLeftRadius: 18, borderTopRightRadius: 18 },
  avatarRow:      { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 14, gap: 10 },
  avatarWrap:     { position: 'relative', width: AVATAR_SIZE, height: AVATAR_SIZE, transformOrigin: 'left bottom' },
  avatar:         { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2, borderWidth: 2.5, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { fontSize: 24, fontWeight: '800', color: '#FFFFFF' },

  infoCol:     { flex: 1, marginTop: AVATAR_OVERLAP + 6, gap: 6 },
  username:    { fontSize: 15, color: '#7A0EED', fontWeight: '700' },
  statsRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  statBox:     { alignItems: 'center', flex: 1 },
  statValue:   { fontSize: 16, fontWeight: '700', color: '#1C1E22' },
  statLabel:   { fontSize: 12, color: '#8A8C93', fontWeight: '500' },
  statDivider: { width: 1, height: 22, backgroundColor: '#EBEBEB' },

  nameBlock:   { paddingHorizontal: 16, marginTop: 8, gap: 2 },
  displayName: { fontSize: 18, fontWeight: '800', color: '#1C1E22' },
  bio:         { fontSize: 14, color: '#3A3C42', lineHeight: 20, marginTop: 2 },
  contactRow:  { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 },
  contactText: { flexShrink: 1, fontSize: 13, fontWeight: '500', color: '#60626A' },
  addBio:      { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: 2 },
  addBioText:  { fontSize: 13, fontWeight: '600', color: '#7A0EED' },

  actionRow:   { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginTop: 10 },
  editBtn:     { flex: 1, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: '#7A0EED', alignItems: 'center', justifyContent: 'center' },
  editBtnText: { fontSize: 13.5, fontWeight: '700', color: '#7A0EED' },
  shareBtn:    { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: '#7A0EED', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  chatBadge: {
    position: 'absolute', top: -4, right: -4,
    minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4,
    backgroundColor: '#FF2A76', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#FFFFFF',
  },
  chatBadgeText: { fontSize: 10, fontWeight: '700', color: '#FFFFFF' },

  tabRow:    { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#EBEBEB', marginTop: 10 },
  tab:       { flex: 1, height: 40, alignItems: 'center', justifyContent: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#7A0EED' },

  emptyGrid:     { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, gap: 10 },
  emptyGridText: { fontSize: 14, color: '#ABADB2' },
  videoIcon:     { position: 'absolute', top: 6, right: 6 },

  // Bottom sheet
  backdrop:    { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet:       { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFFFFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingTop: 8, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 20, elevation: 20 },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#E0DDF5', alignSelf: 'center', marginBottom: 10 },
  sheetTitle:  { fontSize: 16, fontWeight: '800', color: '#1C1E22', paddingHorizontal: 16, marginBottom: 6 },

  // Menu items
  // Same 32px slot as MenuIcon, for the drawn icons
  menuIconSlot: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  menuItem:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  menuItemText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#1C1E22' },
  menuDivider:  { height: StyleSheet.hairlineWidth, backgroundColor: '#F0EDF8', marginHorizontal: 16, marginVertical: 4 },

  // Language items
  // Language sheet — the login language screen's background, which its cards are designed on
  langSheet:       { backgroundColor: LANGUAGE_PICKER_BG },
  langSheetBody:   { paddingHorizontal: 20 },
  langSheetFooter: { marginTop: 6 },

  // Edit profile fields
  fieldWrap:  { gap: 6 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#ABADB2', letterSpacing: 0.4, },
  fieldInput: { backgroundColor: '#F7F5FF', borderRadius: 14, paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 12 : 9, fontSize: 14, color: '#1C1E22', borderWidth: 1, borderColor: '#E8E5F5' },

  genderRow:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  genderChip:        { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: '#E0DDED', backgroundColor: '#FAFAFA' },
  genderChipActive:  { borderColor: '#7A0EED', backgroundColor: '#F4EEFF' },
  genderChipText:    { fontSize: 13, fontWeight: '600', color: '#60626A' },
  genderChipTextActive: { color: '#7A0EED' },

  saveBtn:     { height: 46, borderRadius: 24, backgroundColor: '#7A0EED', alignItems: 'center', justifyContent: 'center', marginTop: 6, marginBottom: 8 },
  saveBtnText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },

  logoutBtnSmall:     { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 12, backgroundColor: '#FFF5F5' },
  logoutBtnSmallText: { fontSize: 14, fontWeight: '700', color: '#E14C57' },
});
