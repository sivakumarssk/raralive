import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { apiGoLiveApply, type GoLiveRequest } from '@/services/api';
import { authStore } from '@/store/auth-store';

// ── Language options (same list used across the app) ─────────────────────────
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

// ── Drum-roll date picker (same pattern as friend-zone-apply-screen) ─────────
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ITEM_H = 44;
const VISIBLE = 5;
const PICKER_H = ITEM_H * VISIBLE;

function daysInMonth(month: number, year: number) {
  return new Date(year, month + 1, 0).getDate();
}

function ageFromDob(dob: Date): number {
  const diff = Date.now() - dob.getTime();
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
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
              <Text style={{ fontSize: sel ? 18 : 16, fontWeight: sel ? '800' : '500', color: sel ? '#7A0EED' : '#ABADB2' }}>{label}</Text>
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

function formatDobDisplay(d: Date | null) {
  if (!d) return '';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function formatDobIso(d: Date) {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// ── Main Sheet ────────────────────────────────────────────────────────────────

type GoLiveSheetProps = {
  visible: boolean;
  onClose: () => void;
  request: GoLiveRequest | null;
  onSubmitted: (request: GoLiveRequest) => void;
};

export function GoLiveSheet({ visible, onClose, request, onSubmitted }: GoLiveSheetProps) {
  const insets = useSafeAreaInsets();

  const isReapply = request?.status === 'rejected';
  const showForm = !request || isReapply;

  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState<Date | null>(null);
  const [showDob, setShowDob] = useState(false);
  const [languageId, setLanguageId] = useState('');
  const [showLanguage, setShowLanguage] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible && isReapply && request) {
      setFullName(request.full_name);
      setDob(new Date(request.date_of_birth));
      setLanguageId(request.language);
    } else if (visible && !request) {
      setFullName('');
      setDob(null);
      setLanguageId('');
    }
    setError('');
  }, [visible, isReapply, request]);

  const selectedLanguage = LANGUAGE_OPTIONS.find(l => l.id === languageId);

  const handleSubmit = async () => {
    if (!fullName.trim()) { setError('Full name is required.'); return; }
    if (!dob) { setError('Please select your date of birth.'); return; }
    if (ageFromDob(dob) < 18) { setError('You must be at least 18 years old.'); return; }
    if (!languageId) { setError('Please select a language.'); return; }

    const token = authStore.getToken();
    if (!token) { setError('Session expired. Please log in again.'); return; }

    setError('');
    setSubmitting(true);
    const result = await apiGoLiveApply({
      fullName: fullName.trim(),
      dateOfBirth: formatDobIso(dob),
      language: languageId,
    }, token);
    setSubmitting(false);

    if (!result.ok) { setError(result.message); return; }
    onSubmitted(result.data);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={sheet.overlay} activeOpacity={1} onPress={onClose} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={sheet.kavWrapper}>
        <View style={[sheet.container, { paddingBottom: insets.bottom + 16 }]}>

          <View style={sheet.handle} />

          <View style={sheet.headerRow}>
            <Text style={sheet.headerTitle}>
              {showForm ? (isReapply ? 'Reapply to Go Live' : 'Go Live') : 'Go Live Request'}
            </Text>
            <TouchableOpacity onPress={onClose} style={sheet.closeBtn} hitSlop={8}>
              <Ionicons name="close" size={20} color="#60626A" />
            </TouchableOpacity>
          </View>

          {!showForm && request?.status === 'pending' && (
            <View style={sheet.statusBlock}>
              <View style={[sheet.statusIconWrap, sheet.statusIconPending]}>
                <Ionicons name="time-outline" size={26} color="#B8860B" />
              </View>
              <Text style={sheet.statusTitle}>Request Under Review</Text>
              <Text style={sheet.statusSubtitle}>
                We've received your Go Live request. An admin will review it shortly — we'll let you know once it's approved.
              </Text>
            </View>
          )}

          {!showForm && request?.status === 'approved' && (
            <View style={sheet.statusBlock}>
              <View style={[sheet.statusIconWrap, sheet.statusIconApproved]}>
                <Ionicons name="checkmark-circle-outline" size={26} color="#1FAF6B" />
              </View>
              <Text style={sheet.statusTitle}>You're Approved!</Text>
              <Text style={sheet.statusSubtitle}>
                Your Go Live request has been approved. Tap "Go Live" again to start your broadcast.
              </Text>
            </View>
          )}

          {showForm && (
            <>
              {isReapply && (
                <View style={sheet.rejectedBanner}>
                  <Ionicons name="close-circle-outline" size={15} color="#E14C57" />
                  <Text style={sheet.rejectedBannerText} numberOfLines={2}>
                    {request?.rejection_reason || 'Your previous request was rejected.'}
                  </Text>
                </View>
              )}

              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={sheet.scrollContent}>

                <View style={sheet.field}>
                  <Text style={sheet.label}>FULL NAME</Text>
                  <View style={sheet.inputBox}>
                    <Ionicons name="person-outline" size={18} color="#7A0EED" />
                    <TextInput
                      style={sheet.input}
                      placeholder="Your full name"
                      placeholderTextColor="#ABADB2"
                      value={fullName}
                      onChangeText={setFullName}
                      returnKeyType="done"
                      underlineColorAndroid="transparent"
                    />
                  </View>
                </View>

                <View style={sheet.field}>
                  <Text style={sheet.label}>DATE OF BIRTH</Text>
                  <TouchableOpacity style={sheet.inputBox} activeOpacity={0.8} onPress={() => setShowDob(true)}>
                    <Ionicons name="calendar-outline" size={18} color="#7A0EED" />
                    <Text style={[sheet.input, { color: dob ? '#1C1E22' : '#ABADB2' }]}>
                      {dob ? formatDobDisplay(dob) : 'Select date of birth'}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color="#ABADB2" />
                  </TouchableOpacity>
                  {dob && <Text style={sheet.hint}>Age: {ageFromDob(dob)}</Text>}
                </View>

                <View style={sheet.field}>
                  <Text style={sheet.label}>LANGUAGE</Text>
                  <TouchableOpacity style={sheet.inputBox} activeOpacity={0.8} onPress={() => setShowLanguage(true)}>
                    <Ionicons name="language-outline" size={18} color="#7A0EED" />
                    <Text style={[sheet.input, { color: selectedLanguage ? '#1C1E22' : '#ABADB2' }]}>
                      {selectedLanguage ? selectedLanguage.label : 'Select language'}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color="#ABADB2" />
                  </TouchableOpacity>
                </View>

                {error ? (
                  <View style={sheet.apiErrorCard}>
                    <Ionicons name="alert-circle-outline" size={16} color="#E14C57" />
                    <Text style={sheet.apiErrorText}>{error}</Text>
                  </View>
                ) : null}
              </ScrollView>

              <TouchableOpacity onPress={handleSubmit} activeOpacity={0.9} style={sheet.submitBtn} disabled={submitting}>
                <LinearGradient
                  colors={['#7A0EED', '#B50357']}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={sheet.submitBtnGradient}>
                  {submitting
                    ? <ActivityIndicator size="small" color="#FFFFFF" />
                    : <Ionicons name="videocam" size={18} color="#FFFFFF" />}
                  <Text style={sheet.submitBtnLabel}>{submitting ? 'Submitting…' : 'Submit Request'}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}
        </View>
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
    </Modal>
  );
}

const sheet = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  kavWrapper: { flex: 1, justifyContent: 'flex-end' },
  container: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: '92%',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -6 },
    elevation: 20,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E0DDED', alignSelf: 'center', marginBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#1C1E22', letterSpacing: -0.3 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F4F5F8', alignItems: 'center', justifyContent: 'center' },
  scrollContent: { gap: 20, paddingBottom: 12 },
  field: { gap: 8 },
  label: { fontSize: 11, fontWeight: '700', color: '#7A0EED', letterSpacing: 1.2 },
  inputBox: {
    height: 50, borderRadius: 12, backgroundColor: '#F7F5FF',
    borderWidth: 1, borderColor: 'transparent',
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 10,
  },
  input: { flex: 1, fontSize: 14, color: '#1C1E22' },
  hint: { fontSize: 11, color: '#ABADB2', fontWeight: '500' },
  apiErrorCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFF0F1', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: '#FFCDD0',
  },
  apiErrorText: { flex: 1, fontSize: 13, color: '#E14C57', fontWeight: '500', lineHeight: 18 },
  rejectedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFF0F1', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#FFCDD0', marginBottom: 16,
  },
  rejectedBannerText: { flex: 1, fontSize: 12, color: '#E14C57', fontWeight: '500', lineHeight: 17 },
  submitBtn: {
    marginTop: 12, borderRadius: 48, overflow: 'hidden',
    shadowColor: '#7A0EED', shadowOpacity: 0.28, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  submitBtnGradient: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  submitBtnLabel: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  statusBlock: { alignItems: 'center', paddingVertical: 20, paddingHorizontal: 8, gap: 10 },
  statusIconWrap: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  statusIconPending: { backgroundColor: '#FFF8E1' },
  statusIconApproved: { backgroundColor: '#E9FBF2' },
  statusTitle: { fontSize: 16, fontWeight: '800', color: '#1C1E22', letterSpacing: -0.2 },
  statusSubtitle: { fontSize: 13, color: '#60626A', textAlign: 'center', lineHeight: 19 },
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
