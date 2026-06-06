import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
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
import { ScreenBackground } from '@/components/ui/screen-background';
import { apiCompleteProfile } from '@/services/api';
import { authStore } from '@/store/auth-store';

const DEFAULT_AVATAR = require('@/assets/images/default-avatar.png');

// ── Drum-roll date picker ─────────────────────────────────────────────────────

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const ITEM_H = 48;
const VISIBLE = 5; // odd number — centre item is selected
const PICKER_H = ITEM_H * VISIBLE;

function daysInMonth(month: number, year: number) {
  return new Date(year, month + 1, 0).getDate();
}

type DrumColProps = {
  items: string[];
  selectedIndex: number;
  onChange: (idx: number) => void;
};

function DrumCol({ items, selectedIndex, onChange }: DrumColProps) {
  const scrollRef = useRef<ScrollView>(null);
  const isDragging = useRef(false);

  // Pad top/bottom so first/last items can reach centre
  const pad = Math.floor(VISIBLE / 2);
  const padded = [...Array(pad).fill(''), ...items, ...Array(pad).fill('')];

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: selectedIndex * ITEM_H, animated: false });
  }, [selectedIndex]);

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
    const clamped = Math.max(0, Math.min(items.length - 1, idx));
    if (clamped !== selectedIndex) onChange(clamped);
    isDragging.current = false;
  };

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (isDragging.current) return;
    const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
    const clamped = Math.max(0, Math.min(items.length - 1, idx));
    if (clamped !== selectedIndex) onChange(clamped);
  };

  return (
    <View style={drum.col}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        onScrollBeginDrag={() => { isDragging.current = true; }}
        onMomentumScrollEnd={onMomentumEnd}
        onScrollEndDrag={onScrollEnd}
        scrollEventThrottle={16}
        style={{ height: PICKER_H }}
        contentContainerStyle={{ paddingVertical: 0 }}>
        {padded.map((label, i) => {
          const actualIdx = i - pad;
          const isSelected = actualIdx === selectedIndex;
          return (
            <TouchableOpacity
              key={i}
              activeOpacity={label ? 0.7 : 1}
              onPress={() => {
                if (!label) return;
                onChange(actualIdx);
                scrollRef.current?.scrollTo({ y: actualIdx * ITEM_H, animated: true });
              }}
              style={[drum.item, isSelected && drum.itemSelected]}>
              <Text style={[drum.itemText, isSelected && drum.itemTextSelected]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

type DatePickerProps = {
  visible: boolean;
  initialDate?: Date;
  onConfirm: (date: Date) => void;
  onClose: () => void;
};

function DatePickerModal({ visible, initialDate, onConfirm, onClose }: DatePickerProps) {
  const today = new Date();
  const maxYear = today.getFullYear() - 18;
  const minYear = today.getFullYear() - 100;

  const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => String(maxYear - i));

  const [monthIdx, setMonthIdx] = useState(initialDate?.getMonth() ?? today.getMonth());
  const [yearIdx, setYearIdx] = useState(
    initialDate ? years.indexOf(String(initialDate.getFullYear())) : 0
  );

  const currentYear = Number(years[yearIdx] ?? maxYear);
  const totalDays = daysInMonth(monthIdx, currentYear);
  const dayItems = Array.from({ length: totalDays }, (_, i) => String(i + 1).padStart(2, '0'));

  const [dayIdx, setDayIdx] = useState(
    Math.min(initialDate ? initialDate.getDate() - 1 : 0, totalDays - 1)
  );

  // Clamp day when month/year changes
  useEffect(() => {
    const max = daysInMonth(monthIdx, currentYear) - 1;
    if (dayIdx > max) setDayIdx(max);
  }, [monthIdx, yearIdx]);

  const handleConfirm = () => {
    const day = dayIdx + 1;
    const date = new Date(currentYear, monthIdx, day);
    onConfirm(date);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={drum.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={drum.sheet}>
          <Text style={drum.title}>Date of Birth</Text>
          <Text style={drum.hint}>Must be 18 or older</Text>

          <View style={drum.pickerWrap}>
            {/* Selection highlight bar */}
            <View pointerEvents="none" style={drum.selectionBar} />

            {/* Day */}
            <DrumCol items={dayItems} selectedIndex={dayIdx} onChange={setDayIdx} />

            {/* Month */}
            <DrumCol items={MONTHS_SHORT} selectedIndex={monthIdx} onChange={setMonthIdx} />

            {/* Year */}
            <DrumCol items={years} selectedIndex={yearIdx} onChange={setYearIdx} />
          </View>

          <View style={drum.actions}>
            <TouchableOpacity onPress={onClose} style={drum.cancelBtn}>
              <Text style={drum.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleConfirm} style={drum.confirmBtn}>
              <Text style={drum.confirmText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

type RegisterProfileScreenProps = {
  onSkip?: () => void;
  onComplete?: () => void;
};

export function RegisterProfileScreen({ onSkip, onComplete }: RegisterProfileScreenProps) {
  const storedUser = authStore.getUser();
  const [selectedGender, setSelectedGender] = useState<'male' | 'female' | 'other' | null>(null);
  const [fullName, setFullName] = useState(storedUser?.fullName ?? '');
  const [username, setUsername] = useState(storedUser?.username ?? '');
  const [dob, setDob] = useState<Date | null>(null);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [avatarMime, setAvatarMime] = useState('image/jpeg');
  const [showCalendar, setShowCalendar] = useState(false);
  const [errors, setErrors] = useState<{ fullName?: string; username?: string; dob?: string; api?: string }>({});
  const [loading, setLoading] = useState(false);

  const formatDob = (d: Date) => {
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${yyyy}-${mm}-${dd}`;
  };

  const displayDob = (d: Date) => {
    return `${String(d.getDate()).padStart(2, '0')} ${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
      setAvatarMime(result.assets[0].mimeType ?? 'image/jpeg');
    }
  };

  const validate = () => {
    const nextErrors: typeof errors = {};

    if (!fullName.trim()) {
      nextErrors.fullName = 'Full name is required.';
    }
    if (!username.trim()) {
      nextErrors.username = 'Username is required.';
    } else if (!/^[a-zA-Z0-9_]{3,20}$/.test(username.trim())) {
      nextErrors.username = 'Use 3–20 characters (letters, numbers, underscore).';
    }
    if (!dob) {
      nextErrors.dob = 'Date of birth is required.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleCompleteProfile = async () => {
    if (!validate()) return;

    const token = authStore.getToken();
    if (!token) {
      setErrors({ api: 'Session expired. Please log in again.' });
      return;
    }

    setLoading(true);
    setErrors({});

    const result = await apiCompleteProfile(
      {
        fullName: fullName.trim(),
        username: username.trim(),
        gender: selectedGender ?? undefined,
        dateOfBirth: formatDob(dob!),
        avatarUri: avatarUri ?? undefined,
        avatarMimeType: avatarMime,
      },
      token,
    );

    setLoading(false);

    if (!result.ok) {
      setErrors({ api: result.message });
      return;
    }

    // Update store so isProfileComplete() returns true immediately
    const data = result.data as { id?: string; phone?: string; full_name?: string; username?: string; avatar_url?: string; is_phone_verified?: boolean } | undefined;
    const currentUser = authStore.getUser();
    authStore.setUser({
      id: data?.id ?? currentUser?.id ?? authStore.getUserId() ?? '',
      phone: data?.phone ?? currentUser?.phone ?? authStore.getPhone() ?? '',
      fullName: data?.full_name ?? fullName.trim(),
      username: data?.username ?? username.trim(),
      avatarUrl: data?.avatar_url ?? null,
      isPhoneVerified: data?.is_phone_verified ?? currentUser?.isPhoneVerified ?? false,
    });

    onComplete?.();
  };

  const handleSkip = () => {
    onSkip?.();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenBackground />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 10}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>

          <View style={styles.skipRow}>
            <TouchableOpacity activeOpacity={0.85} style={styles.skipButton} onPress={handleSkip}>
              <Text style={styles.skipText}>SKIP</Text>
            </TouchableOpacity>
          </View>

          {/* Avatar */}
          <TouchableOpacity style={styles.avatarWrap} onPress={pickImage} activeOpacity={0.85}>
            <View style={styles.avatarRing}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
              ) : fullName.trim() ? (
                <View style={styles.avatarInitialWrap}>
                  <Text style={styles.avatarInitial}>{fullName.trim()[0].toUpperCase()}</Text>
                </View>
              ) : (
                <Image source={DEFAULT_AVATAR} style={styles.avatarImage} />
              )}
            </View>
            <View style={styles.addBadge}>
              <Ionicons name="camera" size={16} color="#FFFFFF" />
            </View>
          </TouchableOpacity>

          <Text style={styles.title}>Complete Your Profile</Text>
          <Text style={styles.subtitle}>Update your details or skip for now.</Text>

          <View style={styles.form}>
            {/* Full name */}
            <View style={styles.field}>
              <Text style={styles.label}>FULL NAME</Text>
              <View style={[styles.inputBox, errors.fullName && styles.inputBoxError]}>
                <TextInput
                  placeholder="How should we call you?"
                  placeholderTextColor="#A9ABB3"
                  style={styles.input}
                  underlineColorAndroid="transparent"
                  value={fullName}
                  returnKeyType="next"
                  onChangeText={(v) => {
                    setFullName(v);
                    if (errors.fullName) setErrors((p) => ({ ...p, fullName: undefined }));
                  }}
                />
                <Ionicons name="person-outline" size={20} color="#7A0EED" />
              </View>
              {errors.fullName ? <Text style={styles.errorText}>{errors.fullName}</Text> : null}
            </View>

            {/* Username */}
            <View style={styles.field}>
              <Text style={styles.label}>USERNAME</Text>
              <View style={[styles.inputBox, errors.username && styles.inputBoxError]}>
                <TextInput
                  placeholder="Pick a unique handle"
                  placeholderTextColor="#A9ABB3"
                  style={styles.input}
                  autoCapitalize="none"
                  underlineColorAndroid="transparent"
                  value={username}
                  returnKeyType="done"
                  onChangeText={(v) => {
                    setUsername(v);
                    if (errors.username) setErrors((p) => ({ ...p, username: undefined }));
                  }}
                />
                <Ionicons name="at-outline" size={20} color="#7A0EED" />
              </View>
              {errors.username ? <Text style={styles.errorText}>{errors.username}</Text> : null}
            </View>

            {/* Gender */}
            <View style={styles.field}>
              <Text style={styles.label}>GENDER IDENTITY</Text>
              <View style={styles.genderRow}>
                {(['male', 'female', 'other'] as const).map((g) => (
                  <TouchableOpacity
                    key={g}
                    activeOpacity={0.9}
                    onPress={() => setSelectedGender(g)}
                    style={[styles.genderOption, selectedGender === g && styles.genderOptionActive]}>
                    <Ionicons
                      name={g === 'male' ? 'male-outline' : g === 'female' ? 'female-outline' : 'transgender-outline'}
                      size={20}
                      color={selectedGender === g ? '#7A0EED' : '#878A95'}
                    />
                    <Text style={[styles.genderText, selectedGender === g && styles.genderTextActive]}>
                      {g.charAt(0).toUpperCase() + g.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Date of birth — tappable, opens calendar modal */}
            <View style={styles.field}>
              <Text style={styles.label}>DATE OF BIRTH</Text>
              <TouchableOpacity
                onPress={() => setShowCalendar(true)}
                activeOpacity={0.8}
                style={[styles.inputBox, errors.dob && styles.inputBoxError]}>
                <Ionicons name="calendar-outline" size={20} color={dob ? '#7A0EED' : '#B4B6BE'} />
                <Text style={[styles.dobText, !dob && styles.dobPlaceholder]}>
                  {dob ? displayDob(dob) : 'Select your date of birth'}
                </Text>
                <Ionicons name="chevron-down" size={16} color="#B4B6BE" />
              </TouchableOpacity>
              <Text style={styles.hint}>You must be 18 or older to join.</Text>
              {errors.dob ? <Text style={styles.errorText}>{errors.dob}</Text> : null}
            </View>

            {/* API error */}
            {errors.api ? (
              <View style={styles.apiErrorCard}>
                <Ionicons name="alert-circle-outline" size={16} color="#E14C57" />
                <Text style={styles.apiErrorText}>{errors.api}</Text>
              </View>
            ) : null}
          </View>

          <GradientButton
            label={loading ? 'Saving…' : 'Complete Profile'}
            iconNode={loading ? <ActivityIndicator size="small" color="#FFFFFF" /> : undefined}
            iconName={loading ? undefined : 'checkmark-circle-outline'}
            style={styles.ctaButton}
            onPress={handleCompleteProfile}
            disabled={loading}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <DatePickerModal
        visible={showCalendar}
        initialDate={dob ?? undefined}
        onConfirm={(date) => {
          setDob(date);
          setShowCalendar(false);
          if (errors.dob) setErrors((p) => ({ ...p, dob: undefined }));
        }}
        onClose={() => setShowCalendar(false)}
      />
    </SafeAreaView>
  );
}

// ── Drum-roll picker styles ───────────────────────────────────────────────────
const drum = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: -4 }, elevation: 10,
  },
  title: { fontSize: 17, fontWeight: '800', color: '#1C1E22', textAlign: 'center', letterSpacing: -0.2 },
  hint: { fontSize: 12, color: '#ABADB2', textAlign: 'center', marginTop: 2, marginBottom: 12 },
  pickerWrap: {
    flexDirection: 'row', height: PICKER_H,
    borderRadius: 16, overflow: 'hidden',
    position: 'relative',
  },
  selectionBar: {
    position: 'absolute',
    left: 0, right: 0,
    top: ITEM_H * Math.floor(VISIBLE / 2),
    height: ITEM_H,
    backgroundColor: '#F0EAFF',
    borderRadius: 10,
    zIndex: 0,
  },
  col: {
    flex: 1, overflow: 'hidden',
  },
  item: {
    height: ITEM_H,
    alignItems: 'center', justifyContent: 'center',
  },
  itemSelected: {},
  itemText: { fontSize: 18, fontWeight: '500', color: '#ABADB2' },
  itemTextSelected: { fontSize: 20, fontWeight: '800', color: '#7A0EED' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  cancelBtn: {
    flex: 1, height: 48, borderRadius: 14, borderWidth: 1, borderColor: '#E0DFF5',
    alignItems: 'center', justifyContent: 'center',
  },
  cancelText: { fontSize: 15, fontWeight: '600', color: '#60626A' },
  confirmBtn: {
    flex: 2, height: 48, borderRadius: 14, backgroundColor: '#7A0EED',
    alignItems: 'center', justifyContent: 'center',
  },
  confirmText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});

// ── Screen styles ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F5F3FA' },
  keyboardView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 58, paddingBottom: 32 },
  skipRow: { alignItems: 'flex-end' },
  skipButton: {
    height: 40, minWidth: 76, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.65)',
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18,
  },
  skipText: { fontSize: 13, lineHeight: 18, fontWeight: '700', color: '#7B7D86', letterSpacing: 0.6 },
  avatarWrap: { alignSelf: 'center', width: 120, height: 120, marginTop: 14 },
  avatarRing: {
    width: 112, height: 112, borderRadius: 56, backgroundColor: '#F8F8FB',
    borderWidth: 3, borderColor: '#FFFFFF', overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarInitialWrap: {
    width: '100%', height: '100%', borderRadius: 999,
    backgroundColor: '#7A0EED', alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { fontSize: 42, fontWeight: '800', color: '#FFFFFF', lineHeight: 50 },
  addBadge: {
    position: 'absolute', right: 0, bottom: 12, width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#7A0EED', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#7A0EED', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  title: { marginTop: 16, textAlign: 'center', fontSize: 24, lineHeight: 30, fontWeight: '800', color: '#1C1E22', letterSpacing: -0.4 },
  subtitle: { marginTop: 6, textAlign: 'center', fontSize: 13, lineHeight: 18, color: '#5E616B', fontWeight: '600' },
  form: { marginTop: 22, gap: 16 },
  field: { gap: 8 },
  label: { color: '#7A0EED', fontSize: 13, lineHeight: 18, fontWeight: '700', letterSpacing: 1.5 },
  inputBox: {
    height: 50, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: 'transparent',
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 10,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  inputBoxError: { borderWidth: 1, borderColor: '#E14C57' },
  input: { flex: 1, fontSize: 14, lineHeight: 18, color: '#2C2F33', fontWeight: '400' },
  dobText: { flex: 1, fontSize: 14, color: '#2C2F33', fontWeight: '500' },
  dobPlaceholder: { color: '#A9ABB3', fontWeight: '400' },
  genderRow: { flexDirection: 'row', gap: 10 },
  genderOption: {
    flex: 1, height: 74, borderRadius: 16, backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  genderOptionActive: {
    borderColor: '#7A0EED',
    shadowColor: '#7A0EED', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  genderText: { color: '#2C2F33', fontSize: 14, lineHeight: 18, fontWeight: '600' },
  genderTextActive: { color: '#7A0EED' },
  hint: { color: '#7A7D87', fontSize: 11, lineHeight: 16, fontStyle: 'italic' },
  ctaButton: { marginTop: 24 },
  errorText: { marginTop: 2, color: '#E14C57', fontSize: 12, lineHeight: 16, fontWeight: '500' },
  apiErrorCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFF0F1', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: '#FFCDD0',
  },
  apiErrorText: { flex: 1, fontSize: 13, color: '#E14C57', fontWeight: '500', lineHeight: 18 },
});
