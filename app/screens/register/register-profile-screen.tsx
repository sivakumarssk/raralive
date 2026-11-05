import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
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

// ── Main screen ───────────────────────────────────────────────────────────────

type RegisterProfileScreenProps = {
  onSkip?: () => void;
  onComplete?: () => void;
};

const BIO_MAX = 150;

export function RegisterProfileScreen({ onSkip, onComplete }: RegisterProfileScreenProps) {
  const storedUser = authStore.getUser();
  // Username, gender and date of birth come from step 1 (saved right after
  // OTP). The username field only appears here if that save didn't happen,
  // e.g. the name was taken in the meantime.
  const savedUsername = storedUser?.username ?? authStore.getPendingUsername() ?? '';
  const needsUsername = !storedUser?.username;
  const [fullName, setFullName] = useState(storedUser?.fullName ?? '');
  const [username, setUsername] = useState(savedUsername);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [avatarMime, setAvatarMime] = useState('image/jpeg');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [errors, setErrors] = useState<{ fullName?: string; username?: string; api?: string }>({});
  const [loading, setLoading] = useState(false);

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
        // Already saved right after OTP; re-sent in case that save failed.
        gender: authStore.getPendingGender() ?? undefined,
        dateOfBirth: authStore.getPendingDob() ?? undefined,
        avatarUri: avatarUri ?? undefined,
        avatarMimeType: avatarMime,
        bio: bio.trim() || undefined,
        location: location.trim() || undefined,
      },
      token,
    );

    setLoading(false);

    if (!result.ok) {
      setErrors(needsUsername && /username/i.test(result.message)
        ? { username: result.message }
        : { api: result.message });
      return;
    }

    // Update store so isProfileComplete() returns true immediately
    const data = result.data as { id?: string; phone?: string; full_name?: string; username?: string; avatar_url?: string; is_phone_verified?: boolean; gender?: string; preferred_language?: string | null } | undefined;
    const currentUser = authStore.getUser();
    authStore.setUser({
      id: data?.id ?? currentUser?.id ?? authStore.getUserId() ?? '',
      phone: data?.phone ?? currentUser?.phone ?? authStore.getPhone() ?? '',
      fullName: data?.full_name ?? fullName.trim(),
      username: data?.username ?? username.trim(),
      avatarUrl: data?.avatar_url ?? null,
      isPhoneVerified: data?.is_phone_verified ?? currentUser?.isPhoneVerified ?? false,
      gender: data?.gender ?? currentUser?.gender ?? authStore.getPendingGender(),
      preferredLanguage: data?.preferred_language ?? currentUser?.preferredLanguage ?? null,
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
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
          </View>

          {/* Avatar */}
          <TouchableOpacity style={styles.avatarWrap} onPress={pickImage} activeOpacity={0.85}>
            {/* Left empty (no default avatar) so it reads as "add a photo" */}
            <View style={[styles.avatarRing, !avatarUri && styles.avatarEmpty]}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarPrompt}>
                  <Ionicons name="person-add-outline" size={34} color="#7A0EED" />
                  <Text style={styles.avatarPromptText}>Add photo</Text>
                </View>
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
              <Text style={styles.label}>Full name</Text>
              <View style={[styles.inputBox, errors.fullName && styles.inputBoxError]}>
                <TextInput
                  placeholder="How should we call you?"
                  placeholderTextColor="#A9ABB3"
                  style={styles.input}
                  autoCapitalize="words"
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

            {/* Username — fallback only, see needsUsername */}
            {needsUsername && (
            <View style={styles.field}>
              <Text style={styles.label}>Username</Text>
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
            )}

            {/* Bio */}
            <View style={styles.field}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Bio</Text>
                <Text style={styles.counter}>{bio.length}/{BIO_MAX}</Text>
              </View>
              <View style={[styles.inputBox, styles.bioBox]}>
                <TextInput
                  placeholder="Tell people about yourself (optional)"
                  placeholderTextColor="#A9ABB3"
                  style={[styles.input, styles.bioInput]}
                  underlineColorAndroid="transparent"
                  multiline
                  maxLength={BIO_MAX}
                  value={bio}
                  onChangeText={setBio}
                />
              </View>
            </View>

            {/* Location */}
            <View style={styles.field}>
              <Text style={styles.label}>Location</Text>
              <View style={styles.inputBox}>
                <Ionicons name="location-outline" size={20} color="#7A0EED" />
                <TextInput
                  placeholder="City or country (optional)"
                  placeholderTextColor="#A9ABB3"
                  style={styles.input}
                  value={location}
                  returnKeyType="done"
                  onChangeText={setLocation}
                />
              </View>
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

    </SafeAreaView>
  );
}

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
  skipText: { fontSize: 13, lineHeight: 18, fontWeight: '700', color: '#7B7D86', letterSpacing: 0.2 },
  avatarWrap: { alignSelf: 'center', width: 120, height: 120, marginTop: 14 },
  avatarRing: {
    width: 112, height: 112, borderRadius: 56, backgroundColor: '#F8F8FB',
    borderWidth: 3, borderColor: '#FFFFFF', overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarEmpty: { backgroundColor: '#F1E7FF', borderStyle: 'dashed', borderColor: '#B98CF5', borderWidth: 2 },
  avatarPrompt: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  avatarPromptText: { fontSize: 12, fontWeight: '700', color: '#7A0EED' },
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
  label: { color: '#7A0EED', fontSize: 13, lineHeight: 18, fontWeight: '700', letterSpacing: 0.2 },
  inputBox: {
    height: 50, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: 'transparent',
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 10,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  inputBoxError: { borderWidth: 1, borderColor: '#E14C57' },
  input: { flex: 1, fontSize: 14, lineHeight: 18, color: '#2C2F33', fontWeight: '400' },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  counter: { color: '#A9ABB3', fontSize: 11, fontWeight: '600' },
  bioBox: { height: 88, alignItems: 'flex-start', paddingVertical: 10 },
  bioInput: { height: '100%', textAlignVertical: 'top', paddingTop: 0, paddingBottom: 0 },
  ctaButton: { marginTop: 24 },
  errorText: { marginTop: 2, color: '#E14C57', fontSize: 12, lineHeight: 16, fontWeight: '500' },
  apiErrorCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFF0F1', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: '#FFCDD0',
  },
  apiErrorText: { flex: 1, fontSize: 13, color: '#E14C57', fontWeight: '500', lineHeight: 18 },
});
