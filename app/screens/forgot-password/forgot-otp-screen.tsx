import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { apiForgotPassword, apiVerifyResetOtp } from '@/services/api';

const DEV_BYPASS = '1234';
const RESEND_SECONDS = 59;

type ForgotOtpScreenProps = {
  phone: string;
  onBack?: () => void;
  onVerified?: (resetToken: string) => void;
};

export function ForgotOtpScreen({ phone, onBack, onVerified }: ForgotOtpScreenProps) {
  const [otp, setOtp] = useState(['', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(RESEND_SECONDS);

  const inputRefs = useRef<(TextInput | null)[]>([null, null, null, null]);

  useEffect(() => {
    const timer = setTimeout(() => inputRefs.current[0]?.focus(), 300);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const id = setInterval(() => setResendTimer((t) => t - 1), 1000);
    return () => clearInterval(id);
  }, [resendTimer]);

  const handleDigitChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    setOtp((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });
    if (error) setError('');
    if (digit && index < 3) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyPress = (index: number, key: string) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      setOtp((prev) => {
        const next = [...prev];
        next[index - 1] = '';
        return next;
      });
    }
  };

  const handleVerify = async (codeOverride?: string) => {
    const code = codeOverride ?? otp.join('');
    if (code.length !== 4) {
      setError('Enter the 4-digit verification code.');
      return;
    }

    setLoading(true);
    setError('');

    const result = await apiVerifyResetOtp(phone, code);
    setLoading(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    onVerified?.(result.data.resetToken);
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;
    setResendTimer(RESEND_SECONDS);
    setOtp(['', '', '', '']);
    setError('');
    inputRefs.current[0]?.focus();
    await apiForgotPassword(phone);
  };

  const resendLabel = resendTimer > 0
    ? `Resend in 0:${String(resendTimer).padStart(2, '0')}`
    : 'Resend code';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenBackground />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7} hitSlop={10}>
          <Ionicons name="arrow-back" size={22} color="#7A0EED" />
        </TouchableOpacity>

        <View style={styles.content}>
          <View style={styles.logoWrap}>
            <View style={styles.logoGlow} />
            <Image source={require('@/assets/images/raralogo.png')} style={styles.logo} contentFit="contain" />
          </View>

          <Text style={styles.title}>Enter Verification Code</Text>
          <Text style={styles.subtitle}>We've sent a 4-digit code to</Text>
          <Text style={styles.phone}>{phone}</Text>

          {/* OTP boxes */}
          <View style={styles.codeRow}>
            {[0, 1, 2, 3].map((slot) => (
              <TextInput
                key={slot}
                ref={(ref) => { inputRefs.current[slot] = ref; }}
                style={[
                  styles.codeBox,
                  otp[slot] ? styles.codeBoxFilled : null,
                  error ? styles.codeBoxError : null,
                ]}
                keyboardType="number-pad"
                maxLength={1}
                value={otp[slot]}
                onChangeText={(value) => handleDigitChange(slot, value)}
                onKeyPress={({ nativeEvent }) => handleKeyPress(slot, nativeEvent.key)}
                textAlign="center"
                underlineColorAndroid="transparent"
                caretHidden
              />
            ))}
          </View>

          {error ? (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle-outline" size={14} color="#E14C57" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity onPress={handleResend} disabled={resendTimer > 0} activeOpacity={0.7}>
            <Text style={[styles.resend, resendTimer === 0 && styles.resendActive]}>
              {resendLabel}
            </Text>
          </TouchableOpacity>

          <GradientButton
            label={loading ? 'Verifying…' : 'VERIFY & CONTINUE'}
            iconNode={loading ? <ActivityIndicator size="small" color="#FFFFFF" /> : undefined}
            style={styles.ctaButton}
            onPress={() => handleVerify()}
            disabled={loading}
          />

          {__DEV__ && (
            <TouchableOpacity
              onPress={() => {
                setOtp(['1', '2', '3', '4']);
                handleVerify(DEV_BYPASS);
              }}
              style={styles.devBypass}
              activeOpacity={0.7}>
              <Text style={styles.devBypassText}>DEV: Use 1234</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F5F3FA' },
  container: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 20 },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  content: { flex: 1, alignItems: 'center', paddingTop: 20 },
  logoWrap: { width: 70, height: 70, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  logoGlow: { position: 'absolute', width: 72, height: 72, borderRadius: 999, backgroundColor: 'rgba(151, 94, 244, 0.26)' },
  logo: { width: 48, height: 48 },
  title: { color: '#171922', fontSize: 26, lineHeight: 34, fontWeight: '800', letterSpacing: -0.5, textAlign: 'center' },
  subtitle: { marginTop: 6, color: '#4F5260', fontSize: 13, lineHeight: 18, fontWeight: '600', textAlign: 'center' },
  phone: { marginTop: 2, color: '#7A0EED', fontSize: 15, lineHeight: 20, fontWeight: '700' },
  codeRow: { marginTop: 28, flexDirection: 'row', gap: 12 },
  codeBox: {
    width: 58, height: 66, borderRadius: 14,
    backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#E8E8EE',
    textAlign: 'center', color: '#2C2F33', fontSize: 22, fontWeight: '700',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  codeBoxFilled: { borderColor: '#7A0EED', backgroundColor: '#F8F3FF' },
  codeBoxError: { borderColor: '#E14C57', backgroundColor: '#FFF5F5' },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10 },
  errorText: { color: '#E14C57', fontSize: 12, lineHeight: 16, fontWeight: '500' },
  resend: { marginTop: 20, fontSize: 13, lineHeight: 18, fontWeight: '700', color: '#ABADB2' },
  resendActive: { color: '#7A0EED' },
  ctaButton: { width: '92%', marginTop: 32, alignSelf: 'center' },
  devBypass: {
    marginTop: 16, paddingHorizontal: 20, paddingVertical: 8,
    borderRadius: 8, backgroundColor: '#FFF3CD', borderWidth: 1, borderColor: '#FFD54F',
  },
  devBypassText: { fontSize: 12, fontWeight: '600', color: '#E65100' },
});
