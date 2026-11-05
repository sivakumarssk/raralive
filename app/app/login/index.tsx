import { Stack, router } from 'expo-router';

import { authStore } from '@/store/auth-store';
import { LoginScreen } from '../../screens/login/login-screen';

// Language picker shows once: only for an account (or guest phone) that has
// never chosen one. Everyone else goes straight to Home.
const goHomeOrLanguage = () => router.replace(authStore.needsLanguage() ? '/language' : '/(tabs)');

export default function LoginRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <LoginScreen
        onSkip={goHomeOrLanguage}
        onRegister={() => router.push('/register')}
        onOtpSent={(phone) => router.push({ pathname: '/otp-verify', params: { mode: 'login', phone } } as never)}
        // Password login — disabled, the app signs in with OTP:
        // onForgotPassword={() => router.push('/forgot-password')}
      />
    </>
  );
}
