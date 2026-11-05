import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator,
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
import { apiCheckUsername, apiRegister } from '@/services/api';
import { armSmsOtp, disarmSmsOtp } from '@/services/sms-otp';
import { authStore, type Gender } from '@/store/auth-store';
import { DatePickerModal, displayDob, formatDob } from './dob-picker';

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

// Password — disabled, the app signs in with OTP:
// // Password rules — shown in the "?" checklist and enforced on submit.
// const PASSWORD_RULES: { label: string; test: (pw: string) => boolean }[] = [
//   { label: 'At least 8 characters', test: pw => pw.length >= 8 },
//   { label: 'At least one letter (a–z)', test: pw => /[A-Za-z]/.test(pw) },
//   { label: 'At least one number (0–9)', test: pw => /\d/.test(pw) },
// ];

const GENDERS: { value: Gender; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'male', label: 'Male', icon: 'male-outline' },
  { value: 'female', label: 'Female', icon: 'female-outline' },
  { value: 'other', label: 'Other', icon: 'transgender-outline' },
];

type RegisterScreenProps = {
  onCreateAccount?: () => void;
};

export function RegisterScreen({ onCreateAccount }: RegisterScreenProps) {
  // Password — disabled, the app signs in with OTP:
  // const [showPassword, setShowPassword] = useState(false);
  // const [showPasswordHelp, setShowPasswordHelp] = useState(false);
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  // const [password, setPassword] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [dob, setDob] = useState<Date | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [errors, setErrors] = useState<{ username?: string; gender?: string; dob?: string; phone?: string; password?: string; api?: string }>({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const nextErrors: typeof errors = {};

    if (!username.trim()) {
      nextErrors.username = 'Username is required.';
    } else if (!USERNAME_RE.test(username.trim())) {
      nextErrors.username = 'Use 3–20 characters (letters, numbers, underscore).';
    }

    if (!gender) {
      nextErrors.gender = 'Gender is required.';
    }

    if (!dob) {
      nextErrors.dob = 'Date of birth is required.';
    }

    const phoneDigits = phone.replace(/\D/g, '');
    if (!phoneDigits) {
      nextErrors.phone = 'Phone number is required.';
    } else if (phoneDigits.length !== 10) {
      nextErrors.phone = 'Enter a valid 10-digit phone number.';
    }

    // if (!password.trim()) {
    //   nextErrors.password = 'Password is required.';
    // } else if (!PASSWORD_RULES.every(rule => rule.test(password))) {
    //   nextErrors.password = 'Use at least 8 characters with letters and numbers.';
    // }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  // Step 1 creates the account (then OTP verifies the phone and saves the
  // username, gender and date of birth), so skipping step 2 still leaves a
  // complete, working account.
  const handleCreateAccount = async () => {
    if (!validate()) return;
    setLoading(true);
    setErrors({});

    // Catch a taken username now, before the account is created.
    const check = await apiCheckUsername(username.trim());
    if (!check.ok || !check.data.available) {
      setLoading(false);
      setErrors({ username: check.ok ? 'That username is already taken.' : check.message });
      return;
    }

    const normalized = `+91${phone.replace(/\D/g, '')}`;

    armSmsOtp();
    const result = await apiRegister({
      phone: normalized,
      // password,
    });

    setLoading(false);

    if (!result.ok) {
      disarmSmsOtp();
      setErrors({ api: result.message });
      return;
    }

    authStore.setRegistered(result.data.userId, normalized);
    authStore.setPendingUsername(username.trim());
    authStore.setPendingGender(gender!);
    authStore.setPendingDob(formatDob(dob!));
    onCreateAccount?.();
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

          <View style={styles.container}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Step 1 of 2: Your account details</Text>

            <View style={styles.form}>
              {/* Username */}
              <View style={styles.field}>
                <Text style={styles.label}>Username</Text>
                <View style={[styles.inputBox, errors.username && styles.inputBoxError]}>
                  <Ionicons name="at-outline" size={16} color="#7A7A8A" />
                  <TextInput
                    style={styles.input}
                    placeholder="Pick a unique username"
                    placeholderTextColor="#ABADB2"
                    autoCapitalize="none"
                    autoCorrect={false}
                    maxLength={20}
                    underlineColorAndroid="transparent"
                    returnKeyType="next"
                    value={username}
                    onChangeText={(value) => {
                      setUsername(value.replace(/\s/g, ''));
                      if (errors.username) setErrors((prev) => ({ ...prev, username: undefined }));
                    }}
                  />
                </View>
                {errors.username ? (
                  <Text style={styles.errorText}>{errors.username}</Text>
                ) : (
                  <Text style={styles.hint}>3–20 letters, numbers or underscores.</Text>
                )}
              </View>

              {/* Gender */}
              <View style={styles.field}>
                <Text style={styles.label}>Gender</Text>
                <View style={styles.genderRow}>
                  {GENDERS.map((g) => {
                    const active = gender === g.value;
                    return (
                      <TouchableOpacity
                        key={g.value}
                        activeOpacity={0.9}
                        onPress={() => {
                          setGender(g.value);
                          if (errors.gender) setErrors((prev) => ({ ...prev, gender: undefined }));
                        }}
                        style={[styles.genderOption, errors.gender && styles.inputBoxError, active && styles.genderOptionActive]}>
                        <Ionicons name={g.icon} size={18} color={active ? '#7A0EED' : '#7A7A8A'} />
                        <Text style={[styles.genderText, active && styles.genderTextActive]}>{g.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {errors.gender ? <Text style={styles.errorText}>{errors.gender}</Text> : null}
              </View>

              {/* Date of birth — opens the drum-roll picker */}
              <View style={styles.field}>
                <Text style={styles.label}>Date of Birth</Text>
                <TouchableOpacity
                  onPress={() => setShowCalendar(true)}
                  activeOpacity={0.8}
                  style={[styles.inputBox, errors.dob && styles.inputBoxError]}>
                  <Ionicons name="calendar-outline" size={16} color={dob ? '#7A0EED' : '#7A7A8A'} />
                  <Text style={[styles.dobText, !dob && styles.dobPlaceholder]}>
                    {dob ? displayDob(dob) : 'Select your date of birth'}
                  </Text>
                  <Ionicons name="chevron-down" size={14} color="#7A7A8A" />
                </TouchableOpacity>
                {errors.dob ? (
                  <Text style={styles.errorText}>{errors.dob}</Text>
                ) : (
                  <Text style={styles.hint}>You must be 18 or older to join.</Text>
                )}
              </View>

              {/* Phone */}
              <View style={styles.field}>
                <Text style={styles.label}>Phone Number</Text>
                <View style={[styles.inputBox, styles.phoneBox, errors.phone && styles.inputBoxError]}>
                  <View style={styles.countryCode}>
                    <Text style={styles.flag}>🇮🇳</Text>
                    <Text style={styles.dialCode}>+91</Text>
                    <Ionicons name="chevron-down" size={14} color="#7A7A8A" />
                  </View>
                  <View style={styles.phoneDivider} />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter phone number"
                    placeholderTextColor="#ABADB2"
                    keyboardType="number-pad"
                    autoCapitalize="none"
                    maxLength={10}
                    underlineColorAndroid="transparent"
                    value={phone}
                    onChangeText={(value) => {
                      setPhone(value.replace(/\D/g, ''));
                      if (errors.phone) setErrors((prev) => ({ ...prev, phone: undefined }));
                    }}
                  />
                </View>
                {errors.phone ? <Text style={styles.errorText}>{errors.phone}</Text> : null}
              </View>

              {/* Password — disabled, the app signs in with OTP:
              <View style={styles.field}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>Password</Text>
                  <TouchableOpacity
                    onPress={() => setShowPasswordHelp(v => !v)}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel="Password rules">
                    <Ionicons
                      name={showPasswordHelp ? 'help-circle' : 'help-circle-outline'}
                      size={18}
                      color="#7A0EED"
                    />
                  </TouchableOpacity>
                </View>
                <View style={[styles.inputBox, errors.password && styles.inputBoxError]}>
                  <Ionicons name="lock-closed-outline" size={16} color="#7A7A8A" />
                  <TextInput
                    style={styles.input}
                    placeholder="············"
                    placeholderTextColor="#ABADB2"
                    secureTextEntry={!showPassword}
                    underlineColorAndroid="transparent"
                    value={password}
                    onFocus={() => setShowPasswordHelp(true)}
                    onChangeText={(value) => {
                      setPassword(value);
                      if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
                    }}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(v => !v)} hitSlop={8}>
                    <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={16} color={showPassword ? '#7A0EED' : '#ABADB2'} />
                  </TouchableOpacity>
                </View>
                {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}
                {showPasswordHelp ? (
                  // Ticks each rule as it's met while typing
                  <View style={styles.pwHelp}>
                    <Text style={styles.pwHelpTitle}>Create a strong password</Text>
                    {PASSWORD_RULES.map(rule => {
                      const ok = rule.test(password);
                      return (
                        <View key={rule.label} style={styles.pwRule}>
                          <Ionicons
                            name={ok ? 'checkmark-circle' : 'ellipse-outline'}
                            size={14}
                            color={ok ? '#16A34A' : '#ABADB2'}
                          />
                          <Text style={[styles.pwRuleText, ok && styles.pwRuleOk]}>{rule.label}</Text>
                        </View>
                      );
                    })}
                  </View>
                ) : !errors.password ? (
                  <Text style={styles.hint}>Use 8+ characters with letters and numbers.</Text>
                ) : null}
              </View>
              */}

              {/* API error */}
              {errors.api ? (
                <View style={styles.apiErrorCard}>
                  <Ionicons name="alert-circle-outline" size={16} color="#E14C57" />
                  <Text style={styles.apiErrorText}>{errors.api}</Text>
                </View>
              ) : null}
            </View>

            <GradientButton
              label={loading ? 'Creating…' : 'Create Account'}
              iconNode={loading ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.rocketIcon}>🚀</Text>}
              style={styles.ctaButton}
              onPress={handleCreateAccount}
              disabled={loading}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <DatePickerModal
        visible={showCalendar}
        initialDate={dob ?? undefined}
        onConfirm={(date) => {
          setDob(date);
          setShowCalendar(false);
          if (errors.dob) setErrors((prev) => ({ ...prev, dob: undefined }));
        }}
        onClose={() => setShowCalendar(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F5F3FA' },
  keyboardView: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 58, paddingBottom: 24 },
  title: { fontSize: 26, fontWeight: '800', color: '#1C1E22', letterSpacing: -0.4, textAlign: 'center' },
  subtitle: { marginTop: 4, fontSize: 13, color: '#60626A', lineHeight: 18, textAlign: 'center' },
  form: { marginTop: 24, gap: 18 },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: '#1C1E22' },
  inputBox: {
    height: 50, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: 'transparent',
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 10,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  inputBoxError: { borderWidth: 1, borderColor: '#E14C57' },
  input: { flex: 1, fontSize: 14, color: '#2C2F33' },
  dobText: { flex: 1, fontSize: 14, color: '#2C2F33' },
  dobPlaceholder: { color: '#ABADB2' },
  hint: { marginTop: 2, color: '#7A7D87', fontSize: 11, lineHeight: 16 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pwHelp: {
    marginTop: 4, padding: 10, gap: 5, borderRadius: 10,
    backgroundColor: '#F7F2FF', borderWidth: 1, borderColor: '#EADDFF',
  },
  pwHelpTitle: { fontSize: 12, fontWeight: '700', color: '#4A1E99', marginBottom: 1 },
  pwRule: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pwRuleText: { fontSize: 12, color: '#60626A' },
  pwRuleOk: { color: '#16A34A', fontWeight: '600' },
  phoneBox: { gap: 12 },
  countryCode: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  flag: { fontSize: 20 },
  dialCode: { fontSize: 14, fontWeight: '600', color: '#1C1E22' },
  phoneDivider: { width: 1, alignSelf: 'stretch', marginVertical: -1, backgroundColor: '#ECEAF2' },
  apiErrorCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFF0F1', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: '#FFCDD0',
  },
  apiErrorText: { flex: 1, fontSize: 13, color: '#E14C57', fontWeight: '500', lineHeight: 18 },
  genderRow: { flexDirection: 'row', gap: 10 },
  genderOption: {
    flex: 1, height: 50, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: 'transparent',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  genderOptionActive: { borderColor: '#7A0EED', backgroundColor: '#F7F2FF' },
  genderText: { fontSize: 14, fontWeight: '600', color: '#2C2F33' },
  genderTextActive: { color: '#7A0EED' },
  ctaButton: { marginTop: 28 },
  errorText: { marginTop: 2, color: '#E14C57', fontSize: 12, lineHeight: 16, fontWeight: '500' },
  rocketIcon: { fontSize: 16 },
});
