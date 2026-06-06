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

import { GradientButton } from '@/components/ui/gradient-button';
import { ScreenBackground } from '@/components/ui/screen-background';
import { apiResetPassword } from '@/services/api';

type ResetPasswordScreenProps = {
  resetToken: string;
  onBack?: () => void;
  onSuccess?: () => void;
};

export function ResetPasswordScreen({ resetToken, onBack, onSuccess }: ResetPasswordScreenProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState<{ newPassword?: string; confirmPassword?: string; api?: string }>({});
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const validate = () => {
    const next: typeof errors = {};
    if (!newPassword) {
      next.newPassword = 'New password is required.';
    } else if (newPassword.length < 6) {
      next.newPassword = 'Password must be at least 6 characters.';
    }
    if (!confirmPassword) {
      next.confirmPassword = 'Please confirm your password.';
    } else if (newPassword !== confirmPassword) {
      next.confirmPassword = 'Passwords do not match.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleReset = async () => {
    if (!validate()) return;
    setLoading(true);
    setErrors({});

    const result = await apiResetPassword(resetToken, newPassword);
    setLoading(false);

    if (!result.ok) {
      setErrors({ api: result.message });
      return;
    }

    setDone(true);
  };

  if (done) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScreenBackground />
        <View style={styles.successContainer}>
          <View style={styles.successCircle}>
            <Ionicons name="checkmark" size={42} color="#7A0EED" />
          </View>
          <Text style={styles.successTitle}>Password Updated!</Text>
          <Text style={styles.successSubtitle}>Your password has been reset successfully. You can now log in with your new password.</Text>
          <GradientButton
            label="Back to Login"
            style={styles.successBtn}
            onPress={onSuccess}
          />
        </View>
      </SafeAreaView>
    );
  }

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
            <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7} hitSlop={10}>
              <Ionicons name="arrow-back" size={22} color="#7A0EED" />
            </TouchableOpacity>

            <View style={styles.logoHeader}>
              <View style={styles.logoBadge}>
                <View style={styles.logoGradientBlur} />
                <Image source={require('@/assets/images/raralogo.png')} style={styles.logoImage} contentFit="contain" />
              </View>
              <Text style={styles.title}>Set New Password</Text>
              <Text style={styles.description}>Choose a strong password for your account.</Text>
            </View>

            <View style={styles.card}>
              <View style={styles.iconCircle}>
                <Ionicons name="key-outline" size={32} color="#7A0EED" />
              </View>

              {/* New password */}
              <View style={styles.field}>
                <Text style={styles.label}>NEW PASSWORD</Text>
                <View style={[styles.inputBox, errors.newPassword ? styles.inputBoxError : null]}>
                  <Ionicons name="lock-closed-outline" size={15} color="#7A0EED" />
                  <TextInput
                    style={styles.input}
                    placeholder="Min. 6 characters"
                    placeholderTextColor="#ABADB2"
                    secureTextEntry={!showNew}
                    returnKeyType="next"
                    underlineColorAndroid="transparent"
                    value={newPassword}
                    onChangeText={(v) => {
                      setNewPassword(v);
                      if (errors.newPassword) setErrors((p) => ({ ...p, newPassword: undefined }));
                    }}
                  />
                  <TouchableOpacity onPress={() => setShowNew((p) => !p)} hitSlop={8}>
                    <Ionicons name={showNew ? 'eye-off-outline' : 'eye-outline'} size={15} color={showNew ? '#7A0EED' : '#ABADB2'} />
                  </TouchableOpacity>
                </View>
                {errors.newPassword ? <Text style={styles.errorText}>{errors.newPassword}</Text> : null}
              </View>

              {/* Confirm password */}
              <View style={styles.field}>
                <Text style={styles.label}>CONFIRM PASSWORD</Text>
                <View style={[styles.inputBox, errors.confirmPassword ? styles.inputBoxError : null]}>
                  <Ionicons name="lock-closed-outline" size={15} color="#7A0EED" />
                  <TextInput
                    style={styles.input}
                    placeholder="Re-enter password"
                    placeholderTextColor="#ABADB2"
                    secureTextEntry={!showConfirm}
                    returnKeyType="done"
                    underlineColorAndroid="transparent"
                    value={confirmPassword}
                    onChangeText={(v) => {
                      setConfirmPassword(v);
                      if (errors.confirmPassword) setErrors((p) => ({ ...p, confirmPassword: undefined }));
                    }}
                    onSubmitEditing={handleReset}
                  />
                  <TouchableOpacity onPress={() => setShowConfirm((p) => !p)} hitSlop={8}>
                    <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={15} color={showConfirm ? '#7A0EED' : '#ABADB2'} />
                  </TouchableOpacity>
                </View>
                {errors.confirmPassword ? <Text style={styles.errorText}>{errors.confirmPassword}</Text> : null}
              </View>

              {/* Password strength hint */}
              <View style={styles.hintRow}>
                <Ionicons name="information-circle-outline" size={14} color="#ABADB2" />
                <Text style={styles.hintText}>Use at least 6 characters with letters and numbers.</Text>
              </View>

              {errors.api ? (
                <View style={styles.apiErrorCard}>
                  <Ionicons name="alert-circle-outline" size={16} color="#E14C57" />
                  <Text style={styles.apiErrorText}>{errors.api}</Text>
                </View>
              ) : null}

              <GradientButton
                label={loading ? 'Updating…' : 'Update Password'}
                iconNode={loading ? <ActivityIndicator size="small" color="#FFFFFF" /> : undefined}
                style={styles.ctaButton}
                onPress={handleReset}
                disabled={loading}
              />
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
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  logoHeader: { alignItems: 'center', marginBottom: 20 },
  logoBadge: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  logoGradientBlur: { position: 'absolute', width: 72, height: 72, borderRadius: 999, backgroundColor: 'rgba(185, 130, 255, 0.35)' },
  logoImage: { width: 60, height: 60 },
  title: { fontSize: 26, lineHeight: 34, fontWeight: '800', letterSpacing: -0.5, color: '#1C1E22', textAlign: 'center' },
  description: { marginTop: 8, color: '#60626A', fontSize: 13, lineHeight: 20, textAlign: 'center' },
  card: {
    width: '100%', backgroundColor: '#FFFFFF', borderRadius: 24,
    paddingHorizontal: 22, paddingTop: 28, paddingBottom: 24, alignItems: 'center',
    shadowColor: '#7A0EED', shadowOpacity: 0.08, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 4,
    gap: 16,
  },
  iconCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#F0EAFA',
    borderWidth: 2, borderColor: '#DDD5F8',
    alignItems: 'center', justifyContent: 'center',
  },
  field: { width: '100%', gap: 6 },
  label: { color: '#4D4F56', fontSize: 11, lineHeight: 14, fontWeight: '700', letterSpacing: 1.0 },
  inputBox: {
    height: 46, borderRadius: 10, backgroundColor: '#F4F5F8', borderWidth: 1, borderColor: 'transparent',
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 10,
  },
  inputBoxError: { borderColor: '#E14C57' },
  input: { flex: 1, fontSize: 14, lineHeight: 18, color: '#1C1E22', fontWeight: '400' },
  errorText: { marginTop: 2, color: '#E14C57', fontSize: 12, lineHeight: 16, fontWeight: '500' },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  hintText: { color: '#ABADB2', fontSize: 12, lineHeight: 16, flex: 1 },
  apiErrorCard: {
    width: '100%', flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFF0F1', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: '#FFCDD0',
  },
  apiErrorText: { flex: 1, fontSize: 13, color: '#E14C57', fontWeight: '500', lineHeight: 18 },
  ctaButton: { width: '100%' },

  // Success state
  successContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32,
  },
  successCircle: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: '#F0EAFA', borderWidth: 3, borderColor: '#DDD5F8',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 26, fontWeight: '800', color: '#1C1E22',
    letterSpacing: -0.5, textAlign: 'center', marginBottom: 12,
  },
  successSubtitle: {
    fontSize: 14, color: '#60626A', lineHeight: 22,
    textAlign: 'center', marginBottom: 32,
  },
  successBtn: { width: '100%' },
});
