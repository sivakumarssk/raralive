/**
 * MSG91 OTP delivery.
 *
 * We generate and verify the OTP ourselves (otp_codes table) and only use
 * MSG91 to deliver it — the code is passed via the `otp` param so MSG91 drops
 * it into the ##OTP## placeholder of the DLT-approved template.
 *
 * Env:
 *   MSG91_AUTH_KEY        — MSG91 → Authkey
 *   MSG91_OTP_TEMPLATE_ID — MSG91 → OTP → template id (template must contain ##OTP##)
 *
 * Without MSG91_AUTH_KEY outside production, the code is printed to the
 * server console instead of sent, so local dev works without SMS credits.
 */

const MSG91_OTP_URL = 'https://control.msg91.com/api/v5/otp';

class SmsError extends Error {}

/** "+91 98765-43210" / "9876543210" → "919876543210" (MSG91 wants country code, no +). */
function toMsg91Mobile(phone) {
  const digits = String(phone).replace(/\D/g, '');
  return digits.length === 10 ? `91${digits}` : digits;
}

async function sendOtpSms(phone, code, expiryMinutes) {
  const authKey = process.env.MSG91_AUTH_KEY;
  const templateId = process.env.MSG91_OTP_TEMPLATE_ID;

  if (!authKey || !templateId) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[msg91:dev] MSG91 not configured — OTP for ${phone}: ${code}`);
      return;
    }
    throw new SmsError('SMS service is not configured.');
  }

  const params = new URLSearchParams({
    template_id: templateId,
    mobile: toMsg91Mobile(phone),
    otp: code,
    otp_length: String(code.length),
    otp_expiry: String(expiryMinutes),
  });

  let json;
  try {
    const res = await fetch(`${MSG91_OTP_URL}?${params}`, {
      method: 'POST',
      headers: { authkey: authKey, 'Content-Type': 'application/json' },
      body: '{}',
      signal: AbortSignal.timeout(15000),
    });
    json = await res.json().catch(() => ({}));
    if (!res.ok || json.type !== 'success') {
      console.error('[msg91] send failed:', res.status, json);
      throw new SmsError('Could not send OTP. Please try again.');
    }
  } catch (error) {
    if (error instanceof SmsError) throw error;
    console.error('[msg91] request error:', error.message);
    throw new SmsError('Could not send OTP. Please try again.');
  }
}

module.exports = { sendOtpSms, SmsError };
