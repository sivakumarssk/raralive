import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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

import { GradientButton } from '@/components/ui/gradient-button';
import { MEDIA_BASE, apiFriendZoneApply, apiFriendZoneUpdateApplication, type FriendZoneApplication } from '@/services/api';
import { authStore } from '@/store/auth-store';

const MAX_PHOTOS = 3;

// ── Language options (same list used app-wide, see language-selection-screen) ─
const LANGUAGE_OPTIONS = [
  { id: 'en', label: 'English' },
  { id: 'hi', label: 'Hindi' },
  { id: 'mr', label: 'Marathi' },
  { id: 'te', label: 'Telugu' },
  { id: 'ta', label: 'Tamil' },
  { id: 'bn', label: 'Bengali' },
  { id: 'kn', label: 'Kannada' },
  { id: 'ml', label: 'Malayalam' },
];

// ── Drum-roll date picker (same pattern as register-profile-screen) ──────────
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const ITEM_H = 48;
const VISIBLE = 5;
const PICKER_H = ITEM_H * VISIBLE;

function daysInMonth(month: number, year: number) {
  return new Date(year, month + 1, 0).getDate();
}

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
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        onScrollBeginDrag={() => { isDragging.current = true; }}
        onMomentumScrollEnd={snap}
        onScrollEndDrag={(e) => { if (!isDragging.current) snap(e); }}
        scrollEventThrottle={16}
        style={{ height: PICKER_H }}>
        {padded.map((label, i) => {
          const ai = i - pad;
          const sel = ai === selectedIndex;
          return (
            <TouchableOpacity
              key={i}
              activeOpacity={label ? 0.7 : 1}
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
  const today = new Date();
  const maxYear = today.getFullYear() - 18;
  const minYear = today.getFullYear() - 100;
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
      <TouchableOpacity style={dp.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={dp.sheet}>
          <Text style={dp.title}>Date of Birth</Text>
          <View style={dp.pickerWrap}>
            <View pointerEvents="none" style={dp.selectionBar} />
            <DrumCol items={dayItems} selectedIndex={dayIdx} onChange={setDayIdx} />
            <DrumCol items={MONTHS_SHORT} selectedIndex={monthIdx} onChange={setMonthIdx} />
            <DrumCol items={years} selectedIndex={yearIdx} onChange={setYearIdx} />
          </View>
          <View style={dp.actions}>
            <TouchableOpacity onPress={onClose} style={dp.cancelBtn}>
              <Text style={dp.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onConfirm(new Date(currentYear, monthIdx, dayIdx + 1))} style={dp.confirmBtn}>
              <Text style={dp.confirmText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ── Language picker modal ─────────────────────────────────────────────────────

function LanguagePickerModal({ visible, selectedId, onSelect, onClose }: {
  visible: boolean;
  selectedId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={dp.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={dp.sheet}>
          <Text style={dp.title}>Select Language</Text>
          {LANGUAGE_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.id}
              style={lp.row}
              activeOpacity={0.75}
              onPress={() => { onSelect(opt.id); onClose(); }}>
              <Text style={lp.rowText}>{opt.label}</Text>
              {opt.id === selectedId && <Ionicons name="checkmark-circle" size={20} color="#7A0EED" />}
            </TouchableOpacity>
          ))}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const GENDERS = ['Male', 'Female', 'Other'];

function formatDobDisplay(d: Date | null) {
  if (!d) return '';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function formatDobIso(d: Date) {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// ── Field wrapper ──────────────────────────────────────────────────────────────

function Field({ label, icon, children, onPress }: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  children: React.ReactNode;
  onPress?: () => void;
}) {
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <View style={f.wrap}>
      <Text style={f.label}>{label}</Text>
      <Wrapper style={f.inputBox} activeOpacity={0.8} {...(onPress ? { onPress } : {})}>
        <Ionicons name={icon} size={18} color="#7A0EED" />
        {children}
      </Wrapper>
    </View>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function resolvePhotoUrl(url: string): string {
  if (url.startsWith('http') || url.startsWith('file:') || url.startsWith('content:')) return url;
  return `${MEDIA_BASE}/${url.replace(/^\//, '')}`;
}

// A "photo" while editing is either a remote URL (already uploaded) or a local
// file URI (freshly picked, still needs upload) — distinguished at submit time.
type PhotoItem = { uri: string; isRemote: boolean; remoteUrl?: string };

// ── Main Screen ───────────────────────────────────────────────────────────────

type FriendZoneApplyScreenProps = {
  existingApplication?: FriendZoneApplication;
};

export function FriendZoneApplyScreen({ existingApplication }: FriendZoneApplyScreenProps) {
  const isEditMode = !!existingApplication;

  const [photos, setPhotos] = useState<PhotoItem[]>(() =>
    existingApplication?.photos.map(url => ({ uri: resolvePhotoUrl(url), isRemote: true, remoteUrl: url })) ?? []
  );
  const [fullName, setFullName] = useState(existingApplication?.full_name ?? '');
  const [gender, setGender] = useState(existingApplication?.gender ?? '');
  const [dob, setDob] = useState<Date | null>(existingApplication ? new Date(existingApplication.date_of_birth) : null);
  const [showDob, setShowDob] = useState(false);
  const [city, setCity] = useState(existingApplication?.city ?? '');
  const [aboutMe, setAboutMe] = useState(existingApplication?.about_me ?? '');
  const [languageId, setLanguageId] = useState(existingApplication?.language ?? '');
  const [showLanguage, setShowLanguage] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const selectedLanguage = LANGUAGE_OPTIONS.find(l => l.id === languageId);

  const pickPhoto = async () => {
    if (photos.length >= MAX_PHOTOS) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.85 });
    if (!result.canceled && result.assets[0]) {
      setPhotos(prev => [...prev, { uri: result.assets[0].uri, isRemote: false }]);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleApply = async () => {
    if (!fullName.trim()) { setError('Full name is required.'); return; }
    if (!gender) { setError('Please select your gender.'); return; }
    if (!dob) { setError('Please select your date of birth.'); return; }
    if (!city.trim()) { setError('City is required.'); return; }
    if (!languageId) { setError('Please select a language.'); return; }
    if (photos.length < 1) { setError('At least one photo is required.'); return; }

    const token = authStore.getToken();
    if (!token) { setError('Session expired. Please log in again.'); return; }

    setError('');
    setSubmitting(true);

    const result = isEditMode
      ? await apiFriendZoneUpdateApplication({
          fullName: fullName.trim(),
          gender,
          dateOfBirth: formatDobIso(dob),
          city: city.trim(),
          language: languageId,
          aboutMe: aboutMe.trim() || undefined,
          photoUris: [],
          existingPhotoUrls: photos.filter(p => p.isRemote).map(p => p.remoteUrl!),
          newPhotoUris: photos.filter(p => !p.isRemote).map(p => p.uri),
        }, token)
      : await apiFriendZoneApply({
          fullName: fullName.trim(),
          gender,
          dateOfBirth: formatDobIso(dob),
          city: city.trim(),
          language: languageId,
          aboutMe: aboutMe.trim() || undefined,
          photoUris: photos.map(p => p.uri),
        }, token);

    setSubmitting(false);

    if (!result.ok) { setError(result.message); return; }
    router.back();
  };

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      {/* Header */}
      <View style={st.header}>
        <TouchableOpacity style={st.headerBtn} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color="#1C1E22" />
        </TouchableOpacity>
        <Text style={st.headerTitle}>{isEditMode ? 'Edit Friend Zone Profile' : 'Join Friend Zone'}</Text>
      </View>

      {isEditMode && (
        <View style={st.editNotice}>
          <Ionicons name="information-circle-outline" size={15} color="#7A0EED" />
          <Text style={st.editNoticeText}>Saving changes will resend your profile for admin review.</Text>
        </View>
      )}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={st.scrollContent} keyboardShouldPersistTaps="handled">

          {/* Photos */}
          <Text style={st.sectionTitle}>Photos ({photos.length}/{MAX_PHOTOS})</Text>
          <View style={st.photoRow}>
            {photos.map((photo, i) => (
              <View key={photo.uri + i} style={st.photoWrap}>
                <Image source={{ uri: photo.uri }} style={st.photo} />
                <TouchableOpacity style={st.photoRemove} onPress={() => removePhoto(i)} hitSlop={6}>
                  <Ionicons name="close" size={13} color="#60626A" />
                </TouchableOpacity>
              </View>
            ))}
            {Array.from({ length: MAX_PHOTOS - photos.length }).map((_, i) => (
              <TouchableOpacity key={`empty-${i}`} style={st.photoEmpty} onPress={pickPhoto} activeOpacity={0.75}>
                <Ionicons name="image-outline" size={22} color="#D8D3EC" />
              </TouchableOpacity>
            ))}
          </View>
          <Text style={st.photoHint}>At least 1 photo is required.</Text>

          {photos.length < MAX_PHOTOS && (
            <TouchableOpacity style={st.addPhotoBtn} onPress={pickPhoto} activeOpacity={0.8}>
              <Text style={st.addPhotoText}>+ Add Photo</Text>
            </TouchableOpacity>
          )}

          {/* Basic Information */}
          <Text style={[st.sectionTitle, { marginTop: 22 }]}>Basic Information</Text>

          <Field label="Full Name *" icon="person-outline">
            <TextInput style={f.input} value={fullName} onChangeText={setFullName} placeholder="Your full name" placeholderTextColor="#C4C5CC" />
          </Field>

          <View style={f.wrap}>
            <Text style={f.label}>Gender *</Text>
            <View style={st.genderRow}>
              {GENDERS.map(g => (
                <TouchableOpacity
                  key={g}
                  style={[st.genderChip, gender === g && st.genderChipActive]}
                  onPress={() => setGender(gender === g ? '' : g)}
                  activeOpacity={0.8}>
                  <Ionicons
                    name={g === 'Female' ? 'female-outline' : g === 'Male' ? 'male-outline' : 'transgender-outline'}
                    size={16}
                    color={gender === g ? '#7A0EED' : '#ABADB2'}
                  />
                  <Text style={[st.genderChipText, gender === g && st.genderChipTextActive]}>{g}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <Field label="Date of Birth *" icon="calendar-outline" onPress={() => setShowDob(true)}>
            <Text style={[f.input, { color: dob ? '#1C1E22' : '#C4C5CC' }]}>
              {dob ? formatDobDisplay(dob) : 'Select date of birth'}
            </Text>
            <Ionicons name="chevron-down" size={16} color="#ABADB2" />
          </Field>

          <Field label="City *" icon="location-outline">
            <TextInput style={f.input} value={city} onChangeText={setCity} placeholder="Your city" placeholderTextColor="#C4C5CC" />
          </Field>

          <View style={f.wrap}>
            <Text style={f.label}>About Me</Text>
            <View style={[f.inputBox, { alignItems: 'flex-start', paddingVertical: 10 }]}>
              <TextInput
                style={[f.input, { height: 60, textAlignVertical: 'top' }]}
                value={aboutMe}
                onChangeText={(v) => setAboutMe(v.slice(0, 100))}
                placeholder="Good vibes only"
                placeholderTextColor="#C4C5CC"
                multiline
                maxLength={100}
              />
            </View>
            <Text style={st.charCount}>{aboutMe.length}/100</Text>
          </View>

          <Field label="Language *" icon="language-outline" onPress={() => setShowLanguage(true)}>
            <Text style={[f.input, { color: selectedLanguage ? '#1C1E22' : '#C4C5CC' }]}>
              {selectedLanguage ? selectedLanguage.label : 'Select language'}
            </Text>
            <Ionicons name="chevron-down" size={16} color="#ABADB2" />
          </Field>

          {!!error && (
            <View style={st.errorBox}>
              <Ionicons name="alert-circle-outline" size={15} color="#E14C57" />
              <Text style={st.errorText}>{error}</Text>
            </View>
          )}

          <GradientButton
            label={submitting ? 'Submitting…' : 'Apply'}
            iconNode={submitting ? <ActivityIndicator size="small" color="#FFFFFF" /> : undefined}
            onPress={handleApply}
            disabled={submitting}
            style={{ marginTop: 8 }}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <DatePickerModal
        visible={showDob}
        initialDate={dob ?? undefined}
        onConfirm={(d) => { setDob(d); setShowDob(false); }}
        onClose={() => setShowDob(false)}
      />

      <LanguagePickerModal
        visible={showLanguage}
        selectedId={languageId}
        onSelect={setLanguageId}
        onClose={() => setShowLanguage(false)}
      />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F0EDF8',
  },
  editNotice: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F4EEFF', paddingHorizontal: 16, paddingVertical: 10,
  },
  editNoticeText: { flex: 1, fontSize: 12, fontWeight: '500', color: '#5B3B99' },
  headerBtn: { minWidth: 38, height: 38, alignItems: 'center', justifyContent: 'center', marginLeft: -8 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#1C1E22', letterSpacing: -0.2 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 40 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#1C1E22', marginBottom: 12 },
  photoRow: { flexDirection: 'row', gap: 10 },
  photoWrap: { position: 'relative', width: 92, height: 92 },
  photo: { width: 92, height: 92, borderRadius: 14 },
  photoRemove: {
    position: 'absolute', top: -6, right: -6,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2,
  },
  photoEmpty: {
    width: 92, height: 92, borderRadius: 14,
    backgroundColor: '#F7F5FF', borderWidth: 1, borderColor: '#E8E5F5', borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
  },
  photoHint: { fontSize: 11, color: '#ABADB2', marginTop: 6 },
  addPhotoBtn: {
    marginTop: 12, height: 48, borderRadius: 14,
    borderWidth: 1.5, borderColor: '#D8CCF5', backgroundColor: '#FAF8FF',
    alignItems: 'center', justifyContent: 'center',
  },
  addPhotoText: { fontSize: 14, fontWeight: '700', color: '#7A0EED' },
  genderRow: { flexDirection: 'row', gap: 10 },
  genderChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 44, borderRadius: 14, borderWidth: 1.5, borderColor: '#E0DDED', backgroundColor: '#FAFAFA',
  },
  genderChipActive: { borderColor: '#7A0EED', backgroundColor: '#F4EEFF' },
  genderChipText: { fontSize: 13, fontWeight: '600', color: '#60626A' },
  genderChipTextActive: { color: '#7A0EED' },
  charCount: { alignSelf: 'flex-end', fontSize: 11, color: '#ABADB2', marginTop: 4 },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFF0F1', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: '#FFCDD0', marginBottom: 16,
  },
  errorText: { flex: 1, fontSize: 13, color: '#E14C57', fontWeight: '500' },
});

const f = StyleSheet.create({
  wrap: { gap: 7, marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#1C1E22' },
  inputBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#F7F5FF', borderRadius: 14, paddingHorizontal: 14,
    borderWidth: 1, borderColor: '#E8E5F5', minHeight: 48,
  },
  input: { flex: 1, fontSize: 14, color: '#1C1E22', paddingVertical: Platform.OS === 'ios' ? 13 : 10 },
});

const dp = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  title: { fontSize: 17, fontWeight: '800', color: '#1C1E22', textAlign: 'center', marginBottom: 16 },
  pickerWrap: { flexDirection: 'row', height: PICKER_H, position: 'relative' },
  selectionBar: {
    position: 'absolute', left: 0, right: 0,
    top: ITEM_H * Math.floor(VISIBLE / 2), height: ITEM_H,
    backgroundColor: '#F0EAFF', borderRadius: 10,
  },
  actions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  cancelBtn: {
    flex: 1, height: 48, borderRadius: 14, borderWidth: 1, borderColor: '#E0DFF5',
    alignItems: 'center', justifyContent: 'center',
  },
  cancelText: { fontSize: 15, fontWeight: '600', color: '#60626A' },
  confirmBtn: { flex: 2, height: 48, borderRadius: 14, backgroundColor: '#7A0EED', alignItems: 'center', justifyContent: 'center' },
  confirmText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
});

const lp = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F0EDF8',
  },
  rowText: { fontSize: 15, fontWeight: '600', color: '#1C1E22' },
});
