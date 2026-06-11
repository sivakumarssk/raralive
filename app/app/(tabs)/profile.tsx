import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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

import { BASE_URL, MEDIA_BASE } from '@/services/api';
import { authStore } from '@/store/auth-store';

const SCREEN_W = Dimensions.get('window').width;
const COVER_H = 180;
const AVATAR_SIZE = 84;

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
};

type PostMedia = { id: string; media_url: string; media_type: 'photo' | 'video'; sort_order: number };
type FeedPost = { id: string; caption: string | null; likes_count: number; media: PostMedia[] };

const LANGUAGES = [
  { id: 'en', label: 'English',    native: 'English' },
  { id: 'hi', label: 'Hindi',      native: 'हिंदी' },
  { id: 'mr', label: 'Marathi',    native: 'मराठी' },
  { id: 'te', label: 'Telugu',     native: 'తెలుగు' },
  { id: 'ta', label: 'Tamil',      native: 'தமிழ்' },
  { id: 'bn', label: 'Bengali',    native: 'বাংলা' },
  { id: 'kn', label: 'Kannada',    native: 'ಕನ್ನಡ' },
  { id: 'ml', label: 'Malayalam',  native: 'മലയാളം' },
];

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

function PostGrid({ posts }: { posts: FeedPost[] }) {
  const SIZE = (SCREEN_W - 4) / 3;
  if (posts.length === 0) {
    return (
      <View style={s.emptyGrid}>
        <Ionicons name="images-outline" size={48} color="#D0C8F0" />
        <Text style={s.emptyGridText}>No posts yet</Text>
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
          <View style={{ width: SIZE, height: SIZE, backgroundColor: '#EDE8FF' }}>
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
          </View>
        );
      }}
    />
  );
}

// ── Bottom sheet wrapper ──────────────────────────────────────────────────────
function BottomSheet({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: React.ReactNode }) {
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
      <Animated.View style={[s.sheet, { transform: [{ translateY: slideY }], paddingBottom: insets.bottom + 12 }]}>
        <View style={s.sheetHandle} />
        {children}
      </Animated.View>
    </Modal>
  );
}

// ── Menu sheet (three dots) ───────────────────────────────────────────────────
function MenuSheet({ visible, onClose, onEditProfile, onChangeLanguage, onLogout }: {
  visible: boolean; onClose: () => void;
  onEditProfile: () => void; onChangeLanguage: () => void; onLogout: () => void;
}) {
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text style={s.sheetTitle}>More Options</Text>
      <TouchableOpacity style={s.menuItem} onPress={() => { onClose(); onEditProfile(); }} activeOpacity={0.8}>
        <View style={s.menuIcon}><Ionicons name="person-outline" size={18} color="#7A0EED" /></View>
        <Text style={s.menuItemText}>Edit Profile</Text>
        <Ionicons name="chevron-forward" size={16} color="#ABADB2" />
      </TouchableOpacity>
      <TouchableOpacity style={s.menuItem} onPress={() => { onClose(); onChangeLanguage(); }} activeOpacity={0.8}>
        <View style={s.menuIcon}><Ionicons name="language-outline" size={18} color="#7A0EED" /></View>
        <Text style={s.menuItemText}>Change Language</Text>
        <Ionicons name="chevron-forward" size={16} color="#ABADB2" />
      </TouchableOpacity>
      <View style={s.menuDivider} />
      <TouchableOpacity style={s.menuItem} onPress={() => { onClose(); onLogout(); }} activeOpacity={0.8}>
        <View style={[s.menuIcon, { backgroundColor: '#FFF5F5' }]}><Ionicons name="log-out-outline" size={18} color="#E14C57" /></View>
        <Text style={[s.menuItemText, { color: '#E14C57' }]}>Log Out</Text>
      </TouchableOpacity>
    </BottomSheet>
  );
}

// ── Language sheet ────────────────────────────────────────────────────────────
function LanguageSheet({ visible, onClose, currentLang, onSelect }: {
  visible: boolean; onClose: () => void; currentLang: string; onSelect: (id: string) => void;
}) {
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text style={s.sheetTitle}>Choose Language</Text>
      {LANGUAGES.map(lang => (
        <TouchableOpacity key={lang.id} style={s.langItem} onPress={() => { onSelect(lang.id); onClose(); }} activeOpacity={0.8}>
          <View style={{ flex: 1 }}>
            <Text style={s.langLabel}>{lang.label}</Text>
            <Text style={s.langNative}>{lang.native}</Text>
          </View>
          {currentLang === lang.id && <Ionicons name="checkmark-circle" size={22} color="#7A0EED" />}
        </TouchableOpacity>
      ))}
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
            <Text style={s.fieldLabel}>Full Name</Text>
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
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [redirecting, setRedirecting] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'liked'>('posts');
  const [showMenu, setShowMenu] = useState(false);
  const [showLang, setShowLang] = useState(false);
  const [currentLang, setCurrentLang] = useState('en');

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
      if (profileRes.success) setProfile(profileRes.data);
      if (postsRes.success) setPosts(postsRes.data);
    } catch {}
    finally { if (showSpinner) setLoading(false); }
  }, []);

  // Initial load with spinner
  useEffect(() => { fetchData(true); }, []);

  // Refresh silently when returning from edit (no spinner, no flicker)
  const isMounted = useRef(false);
  useFocusEffect(useCallback(() => {
    if (!isMounted.current) { isMounted.current = true; return; }
    fetchData(false);
  }, [fetchData]));

  const handleLogout = () => { authStore.clear(); router.replace('/login' as never); };

  const handleLanguageSelect = async (langId: string) => {
    setCurrentLang(langId);
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
  const initials = displayName.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
  const genderLabel = profile.gender ? profile.gender.charAt(0).toUpperCase() + profile.gender.slice(1) : null;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* Cover */}
        <View style={s.coverWrap}>
          {coverUri ? (
            <Image source={{ uri: coverUri }} style={s.cover} resizeMode="cover" />
          ) : (
            <LinearGradient colors={['#4B00E8', '#7A04E5', '#B40CF0', '#FF2A76']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.cover} />
          )}
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity style={s.menuBtn} onPress={() => setShowMenu(true)}>
            <Ionicons name="ellipsis-horizontal" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Avatar + stats */}
        <View style={s.avatarRow}>
          <View style={s.avatarWrap}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={s.avatar} />
            ) : (
              <LinearGradient colors={['#7A0EED', '#B50357']} style={s.avatar}>
                <Text style={s.avatarInitials}>{initials}</Text>
              </LinearGradient>
            )}
            {profile.is_phone_verified && (
              <View style={s.verifiedDot}>
                <Ionicons name="checkmark" size={9} color="#FFFFFF" />
              </View>
            )}
          </View>
          <View style={s.statsRow}>
            <StatBox value={profile.followers_count} label="Followers" />
            <View style={s.statDivider} />
            <StatBox value={profile.following_count} label="Following" />
            <View style={s.statDivider} />
            <StatBox value={profile.posts_count} label="Posts" />
          </View>
        </View>

        {/* Name / username / gender / bio */}
        <View style={s.nameBlock}>
          <Text style={s.displayName}>{displayName}</Text>
          {profile.username && <Text style={s.username}>@{profile.username}</Text>}
          {genderLabel && (
            <View style={s.genderBadge}>
              <Ionicons name={genderLabel === 'Female' ? 'female-outline' : genderLabel === 'Male' ? 'male-outline' : 'person-outline'} size={12} color="#7A0EED" />
              <Text style={s.genderBadgeText}>{genderLabel}</Text>
            </View>
          )}
          {profile.bio ? <Text style={s.bio}>{profile.bio}</Text> : null}
        </View>

        {/* Edit + share */}
        <View style={s.actionRow}>
          <TouchableOpacity style={s.editBtn} onPress={() => router.push('/profile/edit' as any)} activeOpacity={0.85}>
            <Text style={s.editBtnText}>Edit Profile</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.shareBtn} activeOpacity={0.85}>
            <Ionicons name="share-social-outline" size={18} color="#7A0EED" />
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={s.tabRow}>
          <TouchableOpacity style={[s.tab, activeTab === 'posts' && s.tabActive]} onPress={() => setActiveTab('posts')} activeOpacity={0.8}>
            <Ionicons name="grid-outline" size={20} color={activeTab === 'posts' ? '#7A0EED' : '#ABADB2'} />
          </TouchableOpacity>
          <TouchableOpacity style={[s.tab, activeTab === 'liked' && s.tabActive]} onPress={() => setActiveTab('liked')} activeOpacity={0.8}>
            <Ionicons name="heart-outline" size={20} color={activeTab === 'liked' ? '#7A0EED' : '#ABADB2'} />
          </TouchableOpacity>
        </View>

        {activeTab === 'posts' ? <PostGrid posts={posts} /> : (
          <View style={s.emptyGrid}>
            <Ionicons name="heart-outline" size={48} color="#D0C8F0" />
            <Text style={s.emptyGridText}>No liked posts</Text>
          </View>
        )}
      </ScrollView>

      {/* Sheets */}
      <MenuSheet
        visible={showMenu}
        onClose={() => setShowMenu(false)}
        onEditProfile={() => router.push('/profile/edit' as any)}
        onChangeLanguage={() => setShowLang(true)}
        onLogout={handleLogout}
      />
      <LanguageSheet
        visible={showLang}
        onClose={() => setShowLang(false)}
        currentLang={currentLang}
        onSelect={handleLanguageSelect}
      />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: '#FFFFFF' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { fontSize: 14, color: '#ABADB2' },

  coverWrap: { width: SCREEN_W, height: COVER_H },
  cover:     { width: SCREEN_W, height: COVER_H },
  backBtn:   { position: 'absolute', top: 14, left: 14, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  menuBtn:   { position: 'absolute', top: 14, right: 14, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },

  avatarRow:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginTop: -(AVATAR_SIZE / 2), gap: 12 },
  avatarWrap:     { position: 'relative' },
  avatar:         { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2, borderWidth: 3, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { fontSize: 28, fontWeight: '800', color: '#FFFFFF' },
  verifiedDot:    { position: 'absolute', bottom: 4, right: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: '#059669', borderWidth: 2, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },

  statsRow:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', marginTop: AVATAR_SIZE / 2 + 4 },
  statBox:     { alignItems: 'center', flex: 1 },
  statValue:   { fontSize: 18, fontWeight: '800', color: '#1C1E22' },
  statLabel:   { fontSize: 11, color: '#ABADB2', fontWeight: '600', marginTop: 1 },
  statDivider: { width: 1, height: 28, backgroundColor: '#EBEBEB' },

  nameBlock:   { paddingHorizontal: 18, marginTop: 12, gap: 4 },
  displayName: { fontSize: 19, fontWeight: '800', color: '#1C1E22' },
  username:    { fontSize: 13, color: '#7A0EED', fontWeight: '600' },
  genderBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: '#F4EEFF', borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3 },
  genderBadgeText: { fontSize: 11, fontWeight: '700', color: '#7A0EED' },
  bio:         { fontSize: 13, color: '#60626A', lineHeight: 19, marginTop: 2 },

  actionRow:   { flexDirection: 'row', gap: 10, paddingHorizontal: 18, marginTop: 14 },
  editBtn:     { flex: 1, height: 38, borderRadius: 20, borderWidth: 1.5, borderColor: '#7A0EED', alignItems: 'center', justifyContent: 'center' },
  editBtnText: { fontSize: 14, fontWeight: '700', color: '#7A0EED' },
  shareBtn:    { width: 38, height: 38, borderRadius: 20, borderWidth: 1.5, borderColor: '#7A0EED', alignItems: 'center', justifyContent: 'center' },

  tabRow:    { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#EBEBEB', marginTop: 18 },
  tab:       { flex: 1, height: 44, alignItems: 'center', justifyContent: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#7A0EED' },

  emptyGrid:     { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, gap: 10 },
  emptyGridText: { fontSize: 14, color: '#ABADB2' },
  videoIcon:     { position: 'absolute', top: 6, right: 6 },

  // Bottom sheet
  backdrop:    { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet:       { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFFFFF', borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingTop: 8, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 20, elevation: 20 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E0DDF5', alignSelf: 'center', marginBottom: 12 },
  sheetTitle:  { fontSize: 16, fontWeight: '800', color: '#1C1E22', paddingHorizontal: 20, marginBottom: 12 },

  // Menu items
  menuItem:     { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 14 },
  menuIcon:     { width: 36, height: 36, borderRadius: 12, backgroundColor: '#F4EEFF', alignItems: 'center', justifyContent: 'center' },
  menuItemText: { flex: 1, fontSize: 15, fontWeight: '600', color: '#1C1E22' },
  menuDivider:  { height: StyleSheet.hairlineWidth, backgroundColor: '#F0EDF8', marginHorizontal: 20, marginVertical: 4 },

  // Language items
  langItem:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F5F3FA' },
  langLabel:  { fontSize: 14, fontWeight: '700', color: '#1C1E22' },
  langNative: { fontSize: 12, color: '#ABADB2', marginTop: 1 },

  // Edit profile fields
  fieldWrap:  { gap: 6 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#ABADB2', letterSpacing: 0.4, textTransform: 'uppercase' },
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
