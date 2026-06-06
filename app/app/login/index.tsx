import { Stack, router } from 'expo-router';

import { LoginScreen } from '../../screens/login/login-screen';

export default function LoginRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <LoginScreen
        onSkip={() => router.push('/language')}
        onRegister={() => router.push('/register')}
        onLogin={() => router.push('/language')}
        onForgotPassword={() => router.push('/forgot-password')}
      />
    </>
  );
}
