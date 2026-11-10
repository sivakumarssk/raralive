import { Stack, router } from 'expo-router';

import { enterApp } from '@/store/pending-link';
import { LoginScreen } from '../../screens/login/login-screen';

// Language picker shows once: only for an account (or guest phone) that has
// never chosen one. Everyone else goes straight to Home.
// (enterApp also opens a shared link that was waiting for login.)
const goHomeOrLanguage = enterApp;

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
