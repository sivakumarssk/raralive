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
import { apiRegister } from '@/services/api';
import { authStore } from '@/store/auth-store';

type RegisterScreenProps = {
  onCreateAccount?: () => void;
};

export function RegisterScreen({ onCreateAccount }: RegisterScreenProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<{ fullName?: string; phone?: string; password?: string; email?: string; api?: string }>({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const nextErrors: typeof errors = {};

    if (!fullName.trim()) {
      nextErrors.fullName = 'Full name is required.';
    }

    const phoneDigits = phone.replace(/\D/g, '');
    if (!phoneDigits) {
      nextErrors.phone = 'Phone number is required.';
    } else if (phoneDigits.length < 10) {
      nextErrors.phone = 'Enter a valid 10-digit phone number.';
    }

    if (!password.trim()) {
      nextErrors.password = 'Password is required.';
    } else if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      nextErrors.password = 'Use at least 8 characters with letters and numbers.';
    }

    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      nextErrors.email = 'Enter a valid email address.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleCreateAccount = async () => {
    if (!validate()) return;
    setLoading(true);
    setErrors({});

    const phoneDigits = phone.replace(/\D/g, '');
    const normalized = phoneDigits.length === 10 ? `+91${phoneDigits}` : `+${phoneDigits}`;

    const result = await apiRegister({
      phone: normalized,
      password,
      email: email.trim() || undefined,
    });

    setLoading(false);

    if (!result.ok) {
      setErrors({ api: result.message });
      return;
    }

    authStore.setRegistered(result.data.userId, normalized);
    authStore.setPendingName(fullName.trim());
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
            <Text style={styles.subtitle}>Step 1 of 2: Your name & credentials</Text>

            <View style={styles.form}>
              {/* Full Name */}
              <View style={styles.field}>
                <Text style={styles.label}>Full Name</Text>
                <View style={[styles.inputBox, errors.fullName && styles.inputBoxError]}>
                  <Ionicons name="person-outline" size={16} color="#7A7A8A" />
                  <TextInput
                    style={styles.input}
                    placeholder="Your full name"
                    placeholderTextColor="#ABADB2"
                    autoCapitalize="words"
                    underlineColorAndroid="transparent"
                    returnKeyType="next"
                    value={fullName}
                    onChangeText={(value) => {
                      setFullName(value);
                      if (errors.fullName) setErrors((prev) => ({ ...prev, fullName: undefined }));
                    }}
                  />
                </View>
                {errors.fullName ? <Text style={styles.errorText}>{errors.fullName}</Text> : null}
              </View>

              {/* Phone */}
              <View style={styles.field}>
                <Text style={styles.label}>Phone Number</Text>
                <View style={[styles.inputBox, errors.phone && styles.inputBoxError]}>
                  <Ionicons name="phone-portrait-outline" size={16} color="#7A7A8A" />
                  <TextInput
                    style={styles.input}
                    placeholder="+91 9876543210"
                    placeholderTextColor="#ABADB2"
                    keyboardType="phone-pad"
                    autoCapitalize="none"
                    underlineColorAndroid="transparent"
                    value={phone}
                    onChangeText={(value) => {
                      setPhone(value);
                      if (errors.phone) setErrors((prev) => ({ ...prev, phone: undefined }));
                    }}
                  />
                </View>
                {errors.phone ? <Text style={styles.errorText}>{errors.phone}</Text> : null}
              </View>

              {/* Password */}
              <View style={styles.field}>
                <Text style={styles.label}>Password</Text>
                <View style={[styles.inputBox, errors.password && styles.inputBoxError]}>
                  <Ionicons name="lock-closed-outline" size={16} color="#7A7A8A" />
                  <TextInput
                    style={styles.input}
                    placeholder="············"
                    placeholderTextColor="#ABADB2"
                    secureTextEntry={!showPassword}
                    underlineColorAndroid="transparent"
                    value={password}
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
              </View>

              {/* Email (optional) */}
              <View style={styles.field}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>Email Address</Text>
                  <View style={styles.optionalBadge}>
                    <Text style={styles.optionalText}>OPTIONAL</Text>
                  </View>
                </View>
                <View style={[styles.inputBox, errors.email && styles.inputBoxError]}>
                  <Ionicons name="at-outline" size={16} color="#7A7A8A" />
                  <TextInput
                    style={styles.input}
                    placeholder="hello@example.com"
                    placeholderTextColor="#ABADB2"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    underlineColorAndroid="transparent"
                    value={email}
                    onChangeText={(value) => {
                      setEmail(value);
                      if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
                    }}
                  />
                </View>
                {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
              </View>

              {/* API error */}
              {errors.api ? (
                <View style={styles.apiErrorCard}>
                  <Ionicons name="alert-circle-outline" size={16} color="#E14C57" />
                  <Text style={styles.apiErrorText}>{errors.api}</Text>
                </View>
              ) : null}

              {/* Security info card */}
              <View style={styles.infoCard}>
                <View style={styles.infoIconWrap}>
                  <Ionicons name="shield-checkmark-outline" size={22} color="#7A0EED" />
                </View>
                <View style={styles.infoText}>
                  <Text style={styles.infoTitle}>Safe & Secure</Text>
                  <Text style={styles.infoBody}>
                    We use industry-standard encryption to keep your personal data and chats completely private.
                  </Text>
                </View>
              </View>
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
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: 13, fontWeight: '600', color: '#1C1E22' },
  optionalBadge: { backgroundColor: '#EDE8F7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  optionalText: { fontSize: 10, fontWeight: '700', color: '#7A0EED', letterSpacing: 0.6 },
  inputBox: {
    height: 50, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: 'transparent',
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 10,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  inputBoxError: { borderWidth: 1, borderColor: '#E14C57' },
  input: { flex: 1, fontSize: 14, color: '#2C2F33' },
  apiErrorCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFF0F1', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: '#FFCDD0',
  },
  apiErrorText: { flex: 1, fontSize: 13, color: '#E14C57', fontWeight: '500', lineHeight: 18 },
  infoCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: '#FFFFFF',
    borderRadius: 14, padding: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  infoIconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F0EAFF', alignItems: 'center', justifyContent: 'center' },
  infoText: { flex: 1, gap: 2 },
  infoTitle: { fontSize: 14, fontWeight: '700', color: '#1C1E22' },
  infoBody: { fontSize: 12, color: '#60626A', lineHeight: 17 },
  ctaButton: { marginTop: 28 },
  errorText: { marginTop: 2, color: '#E14C57', fontSize: 12, lineHeight: 16, fontWeight: '500' },
  rocketIcon: { fontSize: 16 },
});
