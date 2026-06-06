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
import { apiForgotPassword } from '@/services/api';

type ForgotPhoneScreenProps = {
  onBack?: () => void;
  onOtpSent?: (phone: string) => void;
};

export function ForgotPhoneScreen({ onBack, onOtpSent }: ForgotPhoneScreenProps) {
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const digits = phone.trim().replace(/\D/g, '');
    if (!phone.trim()) {
      setError('Phone number is required.');
      return false;
    }
    if (digits.length < 8) {
      setError('Enter a valid phone number.');
      return false;
    }
    return true;
  };

  const handleSend = async () => {
    if (!validate()) return;
    setLoading(true);
    setError('');

    const result = await apiForgotPassword(phone.trim());
    setLoading(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    onOtpSent?.(phone.trim());
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
            {/* Back button */}
            <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7} hitSlop={10}>
              <Ionicons name="arrow-back" size={22} color="#7A0EED" />
            </TouchableOpacity>

            <View style={styles.logoHeader}>
              <View style={styles.logoBadge}>
                <View style={styles.logoGradientBlur} />
                <Image source={require('@/assets/images/raralogo.png')} style={styles.logoImage} contentFit="contain" />
              </View>
              <Text style={styles.title}>Forgot Password?</Text>
              <Text style={styles.description}>
                Enter the phone number linked to your account. We'll send a verification code to reset your password.
              </Text>
            </View>

            <View style={styles.card}>
              <View style={styles.iconCircle}>
                <Ionicons name="lock-open-outline" size={32} color="#7A0EED" />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>PHONE NUMBER</Text>
                <View style={[styles.inputBox, error ? styles.inputBoxError : null]}>
                  <Ionicons name="call-outline" size={15} color="#7A0EED" />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your phone number"
                    placeholderTextColor="#ABADB2"
                    keyboardType="phone-pad"
                    returnKeyType="done"
                    autoCapitalize="none"
                    underlineColorAndroid="transparent"
                    value={phone}
                    onChangeText={(v) => {
                      setPhone(v);
                      if (error) setError('');
                    }}
                    onSubmitEditing={handleSend}
                  />
                </View>
                {error ? (
                  <View style={styles.errorRow}>
                    <Ionicons name="alert-circle-outline" size={13} color="#E14C57" />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                ) : null}
              </View>

              <GradientButton
                label={loading ? 'Sending…' : 'Send OTP'}
                iconNode={loading ? <ActivityIndicator size="small" color="#FFFFFF" /> : undefined}
                style={styles.ctaButton}
                onPress={handleSend}
                disabled={loading}
              />

              <TouchableOpacity onPress={onBack} activeOpacity={0.7} style={styles.backLink}>
                <Ionicons name="arrow-back-outline" size={14} color="#7A0EED" />
                <Text style={styles.backLinkText}>Back to Login</Text>
              </TouchableOpacity>
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
  description: { marginTop: 8, paddingHorizontal: 10, color: '#60626A', fontSize: 13, lineHeight: 20, textAlign: 'center' },
  card: {
    width: '100%', backgroundColor: '#FFFFFF', borderRadius: 24,
    paddingHorizontal: 22, paddingTop: 28, paddingBottom: 24, alignItems: 'center',
    shadowColor: '#7A0EED', shadowOpacity: 0.08, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 4,
    gap: 20,
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
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  errorText: { color: '#E14C57', fontSize: 12, lineHeight: 16, fontWeight: '500' },
  ctaButton: { width: '100%' },
  backLink: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  backLinkText: { color: '#7A0EED', fontSize: 13, fontWeight: '600' },
});
