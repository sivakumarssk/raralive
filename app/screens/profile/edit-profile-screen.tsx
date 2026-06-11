import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BASE_URL, MEDIA_BASE } from '@/services/api';
import { authStore } from '@/store/auth-store';

const SCREEN_W = Dimensions.get('window').width;
const COVER_H = 200;
const AVATAR_SIZE = 90;

type UserProfile = {
  id: string;
  phone: string;
  username: string | null;
  full_name: string | null;
  gender: string | null;
  date_of_birth: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  bio: string | null;
  location: string | null;
  is_phone_verified: boolean;
  followers_count: number;
  following_count: number;
  posts_count: number;
};

// ── Drum-roll date picker (same as registration) ──────────────────────────────
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHS_LONG  = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const ITEM_H = 48; const VISIBLE = 5;
const PICKER_H = ITEM_H * VISIBLE;

function daysInMonth(month: number, year: number) { return new Date(year, month + 1, 0).getDate(); }

function DrumCol({ items, selectedIndex, onChange }: { items: string[]; selectedIndex: number; onChange: (i: number) => void }) {
  const scrollRef = useRef<ScrollView>(null);
  const isDragging = useRef(false);
  const pad = Math.floor(VISIBLE / 2);
  const padded = [...Array(pad).fill(''), ...items, ...Array(pad).fill('')];
  useEffect(() => { scrollRef.current?.scrollTo({ y: selectedIndex * ITEM_H, animated: false }); }, [selectedIndex]);
  const snap = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.max(0, Math.min(items.length - 1, Math.round(e.nativeEvent.contentOffset.y / ITEM_H)));
    if (idx !== selectedIndex) onChange(idx);
    isDragging.current = false;
  };
  return (
    <View style={{ flex: 1, overflow: 'hidden' }}>
      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} snapToInterval={ITEM_H} decelerationRate="fast"
        onScrollBeginDrag={() => { isDragging.current = true; }}
        onMomentumScrollEnd={snap} onScrollEndDrag={(e) => { if (!isDragging.current) snap(e); }}
        scrollEventThrottle={16} style={{ height: PICKER_H }}>
        {padded.map((label, i) => {
          const ai = i - pad; const sel = ai === selectedIndex;
          return (
            <TouchableOpacity key={i} activeOpacity={label ? 0.7 : 1}
              onPress={() => { if (!label) return; onChange(ai); scrollRef.current?.scrollTo({ y: ai * ITEM_H, animated: true }); }}
              style={{ height: ITEM_H, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: sel ? 20 : 18, fontWeight: sel ? '800' : '500', color: sel ? '#7A0EED' : '#ABADB2' }}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

function DatePickerModal({ visible, initialDate, onConfirm, onClose }: { visible: boolean; initialDate?: Date; onConfirm: (d: Date) => void; onClose: () => void }) {
  const today = new Date(); const maxYear = today.getFullYear() - 13; const minYear = today.getFullYear() - 100;
  const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => String(maxYear - i));
  const [monthIdx, setMonthIdx] = useState(initialDate?.getMonth() ?? today.getMonth());
  const [yearIdx, setYearIdx] = useState(initialDate ? years.indexOf(String(initialDate.getFullYear())) : 0);
  const currentYear = Number(years[yearIdx] ?? maxYear);
  const totalDays = daysInMonth(monthIdx, currentYear);
  const dayItems = Array.from({ length: totalDays }, (_, i) => String(i + 1).padStart(2, '0'));
  const [dayIdx, setDayIdx] = useState(Math.min(initialDate ? initialDate.getDate() - 1 : 0, totalDays - 1));
  useEffect(() => { const max = daysInMonth(monthIdx, currentYear) - 1; if (dayIdx > max) setDayIdx(max); }, [monthIdx, yearIdx]);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={{ backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: Platform.OS === 'ios' ? 36 : 24 }}>
          <Text style={{ fontSize: 17, fontWeight: '800', color: '#1C1E22', textAlign: 'center', marginBottom: 16 }}>Date of Birth</Text>
          <View style={{ flexDirection: 'row', height: PICKER_H, position: 'relative' }}>
            <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: ITEM_H * Math.floor(VISIBLE / 2), height: ITEM_H, backgroundColor: '#F0EAFF', borderRadius: 10 }} />
            <DrumCol items={dayItems} selectedIndex={dayIdx} onChange={setDayIdx} />
            <DrumCol items={MONTHS_SHORT} selectedIndex={monthIdx} onChange={setMonthIdx} />
            <DrumCol items={years} selectedIndex={yearIdx} onChange={setYearIdx} />
          </View>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
            <TouchableOpacity onPress={onClose} style={{ flex: 1, height: 48, borderRadius: 14, borderWidth: 1, borderColor: '#E0DFF5', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: '#60626A' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onConfirm(new Date(currentYear, monthIdx, dayIdx + 1))} style={{ flex: 2, height: 48, borderRadius: 14, backgroundColor: '#7A0EED', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFF' }}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ── helpers ───────────────────────────────────────────────────────────────────
function resolveUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  try { return `${MEDIA_BASE}${new URL(url).pathname}`; }
  catch { return `${MEDIA_BASE}/${url.replace(/^\//, '')}`; }
}

function formatDobDisplay(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
}

const GENDERS = ['Male', 'Female', 'Other'];

// ── screen ────────────────────────────────────────────────────────────────────
export function EditProfileScreen() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // editable fields
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [gender, setGender] = useState('');
  const [dob, setDob] = useState<Date | null>(null);
  const [showDob, setShowDob] = useState(false);

  // image state
  const [avatarUri, setAvatarUri] = useState<string | null>(null); // local URI if newly picked
  const [coverUri, setCoverUri]   = useState<string | null>(null);
  const [avatarMime, setAvatarMime] = useState('image/jpeg');
  const [coverMime, setCoverMime]   = useState('image/jpeg');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = authStore.getToken();
    if (!token) { router.replace('/login' as any); return; }
    fetch(`${BASE_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(json => {
        if (!json.success) return;
        const p: UserProfile = json.data;
        setProfile(p);
        setFullName(p.full_name || '');
        setUsername(p.username || '');
        setBio(p.bio || '');
        setLocation(p.location || '');
        setGender(p.gender ? p.gender.charAt(0).toUpperCase() + p.gender.slice(1) : '');
        if (p.date_of_birth) setDob(new Date(p.date_of_birth));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.85 });
    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
      setAvatarMime(result.assets[0].mimeType ?? 'image/jpeg');
    }
  };

  const pickCover = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [16, 9], quality: 0.85 });
    if (!result.canceled && result.assets[0]) {
      setCoverUri(result.assets[0].uri);
      setCoverMime(result.assets[0].mimeType ?? 'image/jpeg');
    }
  };

  const handleSave = async () => {
    if (!username.trim()) { setError('Username is required.'); return; }
    setSaving(true); setError('');
    try {
      const token = authStore.getToken();
      const form = new FormData();
      form.append('fullName', fullName.trim());
      form.append('username', username.trim());
      form.append('bio', bio.trim());
      form.append('location', location.trim());
      if (gender) form.append('gender', gender.toLowerCase());
      if (dob) {
        const mm = String(dob.getMonth() + 1).padStart(2, '0');
        const dd = String(dob.getDate()).padStart(2, '0');
        form.append('dateOfBirth', `${dob.getFullYear()}-${mm}-${dd}`);
      }
      if (avatarUri) {
        const name = avatarUri.split('/').pop() ?? 'avatar.jpg';
        form.append('avatar', { uri: avatarUri, name, type: avatarMime } as unknown as Blob);
      }
      if (coverUri) {
        const name = coverUri.split('/').pop() ?? 'cover.jpg';
        form.append('cover', { uri: coverUri, name, type: coverMime } as unknown as Blob);
      }
      const res = await fetch(`${BASE_URL}/auth/profile`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const json = await res.json();
      if (!json.success) { setError(json.message || 'Failed to save.'); return; }
      router.back();
    } catch { setError('Network error.'); }
    finally { setSaving(false); }
  };

  if (loading) {
    return (
      <SafeAreaView style={st.safe}>
        <View style={st.centered}><ActivityIndicator size="large" color="#7A0EED" /></View>
      </SafeAreaView>
    );
  }

  const displayAvatarUri = avatarUri ?? resolveUrl(profile?.avatar_url);
  const displayCoverUri  = coverUri  ?? resolveUrl(profile?.cover_url);
  const initials = (fullName || username || '?').split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      {/* Header */}
      <View style={st.header}>
        <TouchableOpacity style={st.headerBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color="#1C1E22" />
        </TouchableOpacity>
        <Text style={st.headerTitle}>Edit Profile</Text>
        <TouchableOpacity style={[st.headerBtn, st.saveHeaderBtn]} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={st.saveHeaderText}>Save</Text>}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">

          {/* Cover */}
          <TouchableOpacity onPress={pickCover} activeOpacity={0.88}>
            <View style={st.coverWrap}>
              {displayCoverUri ? (
                <Image source={{ uri: displayCoverUri }} style={st.cover} resizeMode="cover" />
              ) : (
                <LinearGradient colors={['#4B00E8', '#7A04E5', '#B40CF0', '#FF2A76']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.cover} />
              )}
              {/* dark scrim + edit hint */}
              <View style={st.coverScrim} />
              <View style={st.coverEditHint}>
                <Ionicons name="camera-outline" size={22} color="#FFFFFF" />
                <Text style={st.coverEditText}>Change Cover</Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* Avatar */}
          <View style={st.avatarRow}>
            <TouchableOpacity onPress={pickAvatar} activeOpacity={0.88} style={st.avatarWrap}>
              {displayAvatarUri ? (
                <Image source={{ uri: displayAvatarUri }} style={st.avatar} />
              ) : (
                <LinearGradient colors={['#7A0EED', '#B50357']} style={st.avatar}>
                  <Text style={st.avatarInitials}>{initials}</Text>
                </LinearGradient>
              )}
              <View style={st.cameraBadge}>
                <Ionicons name="camera" size={14} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
          </View>

          {/* Fields */}
          <View style={st.form}>
            <Field label="FULL NAME" icon="person-outline">
              <TextInput style={st.input} value={fullName} onChangeText={setFullName} placeholder="Your full name" placeholderTextColor="#C4C5CC" />
            </Field>

            <Field label="USERNAME *" icon="at-outline">
              <TextInput style={st.input} value={username} onChangeText={setUsername} placeholder="username" placeholderTextColor="#C4C5CC" autoCapitalize="none" />
            </Field>

            <Field label="BIO" icon="document-text-outline">
              <TextInput style={[st.input, { height: 72, textAlignVertical: 'top', paddingTop: 10 }]} value={bio} onChangeText={setBio} placeholder="Tell people about yourself…" placeholderTextColor="#C4C5CC" multiline />
            </Field>

            <Field label="LOCATION" icon="location-outline">
              <TextInput style={st.input} value={location} onChangeText={setLocation} placeholder="City, Country" placeholderTextColor="#C4C5CC" />
            </Field>

            {/* Gender */}
            <View style={st.fieldWrap}>
              <Text style={st.fieldLabel}>GENDER</Text>
              <View style={st.genderRow}>
                {GENDERS.map(g => (
                  <TouchableOpacity key={g}
                    style={[st.genderChip, gender === g && st.genderChipActive]}
                    onPress={() => setGender(gender === g ? '' : g)}
                    activeOpacity={0.8}>
                    <Ionicons
                      name={g === 'Female' ? 'female-outline' : g === 'Male' ? 'male-outline' : 'transgender-outline'}
                      size={16} color={gender === g ? '#7A0EED' : '#ABADB2'} />
                    <Text style={[st.genderChipText, gender === g && st.genderChipTextActive]}>{g}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Date of birth */}
            <View style={st.fieldWrap}>
              <Text style={st.fieldLabel}>DATE OF BIRTH</Text>
              <TouchableOpacity style={st.inputBox} onPress={() => setShowDob(true)} activeOpacity={0.8}>
                <Ionicons name="calendar-outline" size={18} color="#7A0EED" />
                <Text style={[st.input, { flex: 1, color: dob ? '#1C1E22' : '#C4C5CC' }]}>
                  {dob ? formatDobDisplay(dob.toISOString()) : 'Select date of birth'}
                </Text>
                <Ionicons name="chevron-down" size={16} color="#ABADB2" />
              </TouchableOpacity>
            </View>

            {!!error && (
              <View style={st.errorBox}>
                <Ionicons name="alert-circle-outline" size={15} color="#E14C57" />
                <Text style={st.errorText}>{error}</Text>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <DatePickerModal visible={showDob} initialDate={dob ?? undefined} onConfirm={d => { setDob(d); setShowDob(false); }} onClose={() => setShowDob(false)} />
    </SafeAreaView>
  );
}

function Field({ label, icon, children }: { label: string; icon: string; children: React.ReactNode }) {
  return (
    <View style={st.fieldWrap}>
      <Text style={st.fieldLabel}>{label}</Text>
      <View style={st.inputBox}>
        <Ionicons name={icon as any} size={18} color="#7A0EED" />
        {children}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: '#FFFFFF' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F0EDF8' },
  headerBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  saveHeaderBtn: { backgroundColor: '#7A0EED', minWidth: 64 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '800', color: '#1C1E22' },
  saveHeaderText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },

  coverWrap:     { width: SCREEN_W, height: COVER_H, position: 'relative' },
  cover:         { width: SCREEN_W, height: COVER_H },
  coverScrim:    { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.28)' },
  coverEditHint: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  coverEditText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },

  avatarRow:      { paddingHorizontal: 20, marginTop: -(AVATAR_SIZE / 2) },
  avatarWrap:     { position: 'relative', width: AVATAR_SIZE, height: AVATAR_SIZE },
  avatar:         { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2, borderWidth: 3, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { fontSize: 28, fontWeight: '800', color: '#FFFFFF' },
  cameraBadge:    { position: 'absolute', bottom: 2, right: 2, width: 28, height: 28, borderRadius: 14, backgroundColor: '#7A0EED', borderWidth: 2, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },

  form:       { paddingHorizontal: 20, paddingTop: 16, gap: 16 },
  fieldWrap:  { gap: 7 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: '#ABADB2', letterSpacing: 1.1, textTransform: 'uppercase' },
  inputBox:   { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F7F5FF', borderRadius: 14, paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 0 : 2, borderWidth: 1, borderColor: '#E8E5F5', minHeight: 48 },
  input:      { flex: 1, fontSize: 14, color: '#1C1E22', paddingVertical: Platform.OS === 'ios' ? 13 : 10 },

  genderRow:         { flexDirection: 'row', gap: 10 },
  genderChip:        { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: 14, borderWidth: 1.5, borderColor: '#E0DDED', backgroundColor: '#FAFAFA' },
  genderChipActive:  { borderColor: '#7A0EED', backgroundColor: '#F4EEFF' },
  genderChipText:    { fontSize: 13, fontWeight: '600', color: '#60626A' },
  genderChipTextActive: { color: '#7A0EED' },

  errorBox:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF0F1', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#FFCDD0' },
  errorText: { flex: 1, fontSize: 13, color: '#E14C57', fontWeight: '500' },
});
