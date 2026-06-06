import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
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

import { GradientWordmark } from '@/components/gradient-wordmark';
import { GradientButton } from '@/components/ui/gradient-button';
import { OutlineButton } from '@/components/ui/outline-button';
import { ScreenBackground } from '@/components/ui/screen-background';
import { apiLogin } from '@/services/api';
import { authStore } from '@/store/auth-store';

type LoginScreenProps = {
  onSkip?: () => void;
  onRegister?: () => void;
  onLogin?: () => void;
  onForgotPassword?: () => void;
};

export function LoginScreen({ onSkip, onRegister, onLogin, onForgotPassword }: LoginScreenProps) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ identifier?: string; password?: string; api?: string }>({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const nextErrors: typeof errors = {};
    const trimmedIdentifier = identifier.trim();

    if (!trimmedIdentifier) {
      nextErrors.identifier = 'Phone or email is required.';
    } else {
      const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedIdentifier);
      const phoneDigits = trimmedIdentifier.replace(/\D/g, '');
      if (!emailValid && phoneDigits.length < 8) {
        nextErrors.identifier = 'Enter a valid email or phone number.';
      }
    }

    if (!password.trim()) {
      nextErrors.password = 'Password is required.';
    } else if (password.trim().length < 6) {
      nextErrors.password = 'Password must be at least 6 characters.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true);
    setErrors({});

    const result = await apiLogin({ identifier: identifier.trim(), password });

    setLoading(false);

    if (!result.ok) {
      setErrors({ api: result.message });
      return;
    }

    authStore.setToken(result.data.token);
    authStore.setUser({
      id: result.data.user.id,
      phone: result.data.user.phone,
      fullName: result.data.user.full_name,
      username: result.data.user.username,
      avatarUrl: result.data.user.avatar_url,
      isPhoneVerified: result.data.user.is_phone_verified,
    });
    onLogin?.();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenBackground />
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.container}>
            <View style={styles.logoHeader}>
              <View style={styles.logoBadge}>
                <View style={styles.logoGradientBlur} />
                <Image source={require('@/assets/images/raralogo.png')} style={styles.logoImage} contentFit="contain" />
              </View>

              <View style={styles.titleWrapper}>
                <Text style={styles.title}>Welcome</Text>
                <GradientWordmark
                  text="Rara Live"
                  containerStyle={styles.logoText}
                  fontSize={32}
                  lineHeight={36}
                  fontWeight="900"
                  letterSpacing={-0.5}
                  includeFontPadding={false}
                />
              </View>
              <Text style={styles.description}>Enter your credentials to access your account.</Text>
            </View>

            <View style={styles.skipWrap}>
              <TouchableOpacity onPress={onSkip} activeOpacity={0.8} style={styles.skipButton}>
                <Text style={styles.skipText}>Skip for now</Text>
                <Ionicons name="chevron-forward" size={14} color="#595C60" />
              </TouchableOpacity>
            </View>

            <View style={styles.card}>
              <View style={styles.form}>
                <View style={styles.field}>
                  <Text style={styles.label}>PHONE OR EMAIL</Text>
                  <View style={[styles.inputBox, errors.identifier && styles.inputBoxError]}>
                    <Ionicons name="person-outline" size={15} color="#7A0EED" />
                    <TextInput
                      placeholder="Enter your details"
                      placeholderTextColor="#ABADB2"
                      style={styles.input}
                      autoCapitalize="none"
                      underlineColorAndroid="transparent"
                      value={identifier}
                      returnKeyType="next"
                      onChangeText={(value) => {
                        setIdentifier(value);
                        if (errors.identifier) setErrors((prev) => ({ ...prev, identifier: undefined }));
                      }}
                    />
                  </View>
                  {errors.identifier ? <Text style={styles.errorText}>{errors.identifier}</Text> : null}
                </View>

                <View style={styles.field}>
                  <View style={styles.passwordLabelRow}>
                    <Text style={styles.label}>PASSWORD</Text>
                    <TouchableOpacity onPress={onForgotPassword} activeOpacity={0.7}>
                      <Text style={styles.forgot}>Forgot?</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={[styles.inputBox, errors.password && styles.inputBoxError]}>
                    <Ionicons name="lock-closed-outline" size={15} color="#7A0EED" />
                    <TextInput
                      placeholder="********"
                      placeholderTextColor="#ABADB2"
                      style={styles.input}
                      secureTextEntry={!showPassword}
                      underlineColorAndroid="transparent"
                      returnKeyType="done"
                      value={password}
                      onChangeText={(value) => {
                        setPassword(value);
                        if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
                      }}
                      onSubmitEditing={handleLogin}
                    />
                    <TouchableOpacity onPress={() => setShowPassword((prev) => !prev)} hitSlop={8}>
                      <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={15} color={showPassword ? '#7A0EED' : '#ABADB2'} />
                    </TouchableOpacity>
                  </View>
                  {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}
                </View>

                {/* API error */}
                {errors.api ? (
                  <View style={styles.apiErrorCard}>
                    <Ionicons name="alert-circle-outline" size={16} color="#E14C57" />
                    <Text style={styles.apiErrorText}>{errors.api}</Text>
                  </View>
                ) : null}

                <GradientButton
                  label={loading ? 'Signing in…' : 'Login'}
                  iconNode={loading ? <ActivityIndicator size="small" color="#FFFFFF" /> : undefined}
                  style={styles.loginButton}
                  onPress={handleLogin}
                  disabled={loading}
                />
              </View>

              <View style={styles.dividerWrap}>
                <View style={styles.dividerLine} />
                <View style={styles.dividerTextBg}>
                  <Text style={styles.continueText}>OR CONTINUE WITH</Text>
                </View>
              </View>

              <View style={styles.socialWrap}>
                <OutlineButton
                  label="Register"
                  iconName="person-add-outline"
                  iconColor="#7A0EED"
                  iconSize={22}
                  onPress={onRegister}
                />
                <OutlineButton
                  label="Google"
                  iconName="logo-google"
                  iconColor="#4285F4"
                  iconSize={20}
                />
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#EDE8F7' },
  keyboardView: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  container: {
    flex: 1, width: '100%', maxWidth: 430, alignSelf: 'center',
    paddingHorizontal: 20, paddingTop: 36, paddingBottom: 16,
  },
  logoHeader: { alignItems: 'center', marginBottom: 4 },
  logoBadge: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center' },
  logoGradientBlur: { position: 'absolute', width: 72, height: 72, borderRadius: 999, backgroundColor: 'rgba(185, 130, 255, 0.35)' },
  logoImage: { width: 60, height: 60 },
  title: { fontSize: 28, lineHeight: 36, fontWeight: '800', letterSpacing: -0.5, color: '#1C1E22', textAlign: 'center' },
  titleWrapper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 14, alignSelf: 'center' },
  logoText: { width: 155, height: 36 },
  description: { marginTop: 6, paddingHorizontal: 16, color: '#60626A', fontSize: 13, lineHeight: 18, textAlign: 'center' },
  skipWrap: { alignSelf: 'stretch', paddingVertical: 10 },
  skipButton: { alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', gap: 2, paddingRight: 2 },
  skipText: { color: '#595C60', fontSize: 13, lineHeight: 18, fontWeight: '500' },
  card: {
    width: '100%', backgroundColor: '#FFFFFF', borderRadius: 24,
    paddingHorizontal: 22, paddingTop: 24, paddingBottom: 24,
    shadowColor: '#7A0EED', shadowOpacity: 0.08, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 4,
  },
  form: { gap: 16 },
  field: { gap: 6 },
  label: { color: '#4D4F56', fontSize: 11, lineHeight: 14, fontWeight: '700', letterSpacing: 1.0 },
  inputBox: {
    height: 46, borderRadius: 10, backgroundColor: '#F4F5F8', borderWidth: 1, borderColor: 'transparent',
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 10,
  },
  inputBoxError: { borderWidth: 1, borderColor: '#E14C57' },
  input: { flex: 1, fontSize: 14, lineHeight: 18, color: '#8D9099', fontWeight: '400' },
  passwordLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  forgot: { color: '#7A0EED', fontSize: 12, lineHeight: 14, fontWeight: '600' },
  loginButton: { marginTop: 6 },
  apiErrorCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFF0F1', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: '#FFCDD0',
  },
  apiErrorText: { flex: 1, fontSize: 13, color: '#E14C57', fontWeight: '500', lineHeight: 18 },
  dividerWrap: { marginTop: 22, height: 16, justifyContent: 'center' },
  dividerLine: { position: 'absolute', left: 0, right: 0, top: 7.5, borderTopWidth: 1, borderTopColor: '#E6E8EE' },
  dividerTextBg: { alignSelf: 'center', backgroundColor: '#FFFFFF', paddingHorizontal: 14, height: 16, justifyContent: 'center' },
  continueText: { color: '#ABADB2', fontSize: 11, lineHeight: 14, fontWeight: '600', letterSpacing: 1.0 },
  socialWrap: { marginTop: 16, gap: 12 },
  errorText: { marginTop: 2, color: '#E14C57', fontSize: 12, lineHeight: 16, fontWeight: '500' },
});
