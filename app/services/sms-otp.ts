import { requireOptionalNativeModule } from 'expo';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

// Reads the login/registration OTP on Android through Google's SMS User
// Consent API (modules/sms-consent): no SMS permission and no change to the
// DLT template. When an SMS with a code arrives, Android asks the user to
// Allow it once; the code then fills in by itself. Android can't filter before
// asking (see the native module), so an approved SMS is only used if it's ours.

const OTP_PATTERN = /\b\d{4}\b/;
const OUR_SMS = /rara\s*live/i;

type SmsConsentModule = {
  start: () => void;
  stop: () => void;
  addListener: (event: 'onSms', fn: (e: { message: string }) => void) => { remove: () => void };
};

// Optional: null on iOS and on a build made before this module was added
const SmsConsent = Platform.OS === 'android'
  ? requireOptionalNativeModule<SmsConsentModule>('SmsConsent')
  : null;

type Listener = (code: string) => void;

let listener: Listener | null = null;
let pendingCode: string | null = null;

SmsConsent?.addListener('onSms', ({ message }) => {
  const code = OUR_SMS.test(message) ? message.match(OTP_PATTERN)?.[0] : undefined;
  if (!code) return;
  if (listener) listener(code);
  else pendingCode = code;
});

/**
 * Starts listening (for 5 minutes). Call just BEFORE requesting the OTP — only
 * messages arriving after this count, and the SMS can beat the OTP screen
 * opening. A code that arrives early waits for useSmsOtp.
 */
export function armSmsOtp() {
  pendingCode = null;
  SmsConsent?.start();
}

/** Stops listening, so a later SMS can't raise the Allow popup. */
export function disarmSmsOtp() {
  pendingCode = null;
  SmsConsent?.stop();
}

/** Calls onCode when the OTP arrives, including one that arrived before this screen opened. */
export function useSmsOtp(onCode: Listener) {
  const latest = useRef(onCode);
  useEffect(() => { latest.current = onCode; });

  useEffect(() => {
    const deliver: Listener = code => latest.current(code);
    listener = deliver;
    if (pendingCode) {
      const code = pendingCode;
      pendingCode = null;
      deliver(code);
    }
    return () => {
      if (listener === deliver) listener = null;
      disarmSmsOtp();
    };
  }, []);
}
