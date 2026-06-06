import { useRouter } from 'expo-router';
import { useState } from 'react';

import { ForgotOtpScreen } from '@/screens/forgot-password/forgot-otp-screen';
import { ForgotPhoneScreen } from '@/screens/forgot-password/forgot-phone-screen';
import { ResetPasswordScreen } from '@/screens/forgot-password/reset-password-screen';

type Step = 'phone' | 'otp' | 'reset';

export default function ForgotPasswordRoute() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [resetToken, setResetToken] = useState('');

  if (step === 'otp') {
    return (
      <ForgotOtpScreen
        phone={phone}
        onBack={() => setStep('phone')}
        onVerified={(token) => {
          setResetToken(token);
          setStep('reset');
        }}
      />
    );
  }

  if (step === 'reset') {
    return (
      <ResetPasswordScreen
        resetToken={resetToken}
        onBack={() => setStep('otp')}
        onSuccess={() => router.replace('/login')}
      />
    );
  }

  return (
    <ForgotPhoneScreen
      onBack={() => router.back()}
      onOtpSent={(sentPhone) => {
        setPhone(sentPhone);
        setStep('otp');
      }}
    />
  );
}
