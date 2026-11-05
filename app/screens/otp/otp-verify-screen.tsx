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
import { apiCompleteProfile, apiResendOtp, apiSendLoginOtp, apiVerifyLoginOtp, apiVerifyOtp } from '@/services/api';
import { armSmsOtp, disarmSmsOtp, useSmsOtp } from '@/services/sms-otp';
import { authStore } from '@/store/auth-store';
import { friendZoneSocketStore } from '@/store/friend-zone-socket-store';


const OTP_LENGTH = 4;
const RESEND_SECONDS = 59;

type OtpVerifyScreenProps = {
  /** Set for OTP login; without it this is the registration step. */
  loginPhone?: string;
  onVerifyContinue?: () => void;
};

export function OtpVerifyScreen({ loginPhone, onVerifyContinue }: OtpVerifyScreenProps) {
  const [otp, setOtp] = useState(['', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(RESEND_SECONDS);

  const inputRefs = useRef<(TextInput | null)[]>([null, null, null, null]);

  // Auto-focus first box on mount
  useEffect(() => {
    const timer = setTimeout(() => inputRefs.current[0]?.focus(), 300);
    return () => clearTimeout(timer);
  }, []);

  // Resend countdown
  useEffect(() => {
    if (resendTimer <= 0) return;
    const id = setInterval(() => setResendTimer((t) => t - 1), 1000);
    return () => clearInterval(id);
  }, [resendTimer]);

  const handleDigitChange = (index: number, value: string) => {
    const digits = value.replace(/\D/g, '');

    // Whole code pasted / autofilled from the SMS into one box
    if (digits.length === OTP_LENGTH) {
      setOtp(digits.split(''));
      if (error) setError('');
      inputRefs.current[OTP_LENGTH - 1]?.focus();
      return;
    }

    const digit = digits.slice(-1);

    setOtp((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });

    if (error) setError('');

    if (digit && index < 3) {
      // Move focus forward
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (index: number, key: string) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      // Move focus back when deleting empty box
      inputRefs.current[index - 1]?.focus();
      setOtp((prev) => {
        const next = [...prev];
        next[index - 1] = '';
        return next;
      });
    }
  };

  // Android: once the user Allows the OTP SMS, it fills the boxes and submits
  useSmsOtp((smsCode) => {
    setOtp(smsCode.split(''));
    setError('');
    handleVerify(smsCode);
  });

  const handleVerify = async (autoCode?: string) => {
    const code = autoCode ?? otp.join('');
    if (code.length !== OTP_LENGTH) {
      setError('Enter the 4-digit verification code.');
      return;
    }

    if (loginPhone) {
      setLoading(true);
      setError('');
      const result = await apiVerifyLoginOtp(loginPhone, code);
      setLoading(false);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      const u = result.data.user;
      authStore.setToken(result.data.token);
      authStore.setUser({
        id: u.id,
        phone: u.phone,
        fullName: u.full_name,
        username: u.username,
        avatarUrl: u.avatar_url,
        isPhoneVerified: u.is_phone_verified,
        gender: u.gender ?? null,
        preferredLanguage: u.preferred_language ?? null,
        loginMethod: 'phone',
      });
      friendZoneSocketStore.connect();
      disarmSmsOtp();
      onVerifyContinue?.();
      return;
    }

    const phone = authStore.getPhone();
    if (!phone) {
      setError('Session expired. Please register again.');
      return;
    }

    setLoading(true);
    setError('');

    const result = await apiVerifyOtp({ phone, code });

    setLoading(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    if (result.data.token) {
      authStore.setToken(result.data.token);
      friendZoneSocketStore.connect();
    }
    const userId = authStore.getUserId() ?? '';
    const pendingUsername = authStore.getPendingUsername();
    const pendingGender = authStore.getPendingGender();

    if (pendingUsername && result.data.token) {
      // Save the step-1 details (username, gender, date of birth) to the new
      // account; step 2 adds the full name, photo and bio.
      try {
        const profileResult = await apiCompleteProfile(
          {
            username: pendingUsername,
            gender: pendingGender ?? undefined,
            dateOfBirth: authStore.getPendingDob() ?? undefined,
          },
          result.data.token,
        );
        if (profileResult.ok) {
          const d = profileResult.data as any;
          authStore.setUser({
            id: d?.id ?? userId,
            phone,
            fullName: d?.full_name ?? null,
            username: d?.username ?? pendingUsername,
            avatarUrl: d?.avatar_url ?? null,
            isPhoneVerified: true,
            gender: d?.gender ?? pendingGender,
            preferredLanguage: d?.preferred_language ?? null,
          });
        } else {
          authStore.setUser({ id: userId, phone, fullName: null, username: null, avatarUrl: null, isPhoneVerified: true, gender: pendingGender, preferredLanguage: null });
        }
      } catch {
        authStore.setUser({ id: userId, phone, fullName: null, username: null, avatarUrl: null, isPhoneVerified: true, gender: pendingGender, preferredLanguage: null });
      }
    } else if (phone && userId) {
      authStore.setUser({ id: userId, phone, fullName: null, username: null, avatarUrl: null, isPhoneVerified: true, preferredLanguage: null });
    }

    disarmSmsOtp();
    onVerifyContinue?.();
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;
    const phone = loginPhone ?? authStore.getPhone();
    if (!phone) {
      setError('Session expired. Please register again.');
      return;
    }
    setResendTimer(RESEND_SECONDS);
    setOtp(['', '', '', '']);
    setError('');
    inputRefs.current[0]?.focus();
    armSmsOtp();
    const result = await (loginPhone ? apiSendLoginOtp(phone) : apiResendOtp(phone));
    if (!result.ok) {
      disarmSmsOtp();
      setError(result.message);
      setResendTimer(0);
    }
  };

  const phone = loginPhone ?? authStore.getPhone() ?? '+91 ••••••••••';
  const resendLabel = resendTimer > 0
    ? `Resend in 0:${String(resendTimer).padStart(2, '0')}`
    : 'Resend code';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenBackground />

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <View style={styles.logoWrap}>
            <View style={styles.logoGlow} />
            <Image source={require('@/assets/images/raralogo.png')} style={styles.logo} contentFit="contain" />
          </View>

          <Text style={styles.title}>Verify Your Number</Text>
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
                maxLength={OTP_LENGTH}
                textContentType={slot === 0 ? 'oneTimeCode' : 'none'}
                autoComplete={slot === 0 ? 'sms-otp' : 'off'}
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

          {/* Resend */}
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
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F5F3FA' },
  container: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 58, paddingBottom: 20 },
  content: { flex: 1, alignItems: 'center', paddingTop: 30 },
  logoWrap: { width: 70, height: 70, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  logoGlow: { position: 'absolute', width: 72, height: 72, borderRadius: 999, backgroundColor: 'rgba(151, 94, 244, 0.26)' },
  logo: { width: 48, height: 48 },
  title: { color: '#171922', fontSize: 28, lineHeight: 34, fontWeight: '800', letterSpacing: -0.5, textAlign: 'center' },
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
});
