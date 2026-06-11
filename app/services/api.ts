// export const BASE_URL = 'https://api.raralive.in/api';
// export const MEDIA_BASE = 'https://api.raralive.in';

export const BASE_URL = 'http://192.168.0.6:5000/api';
export const MEDIA_BASE = 'http://192.168.0.6:5000';

export type ApiResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; message: string };

// Called when an authenticated request gets a 401 (token expired/invalid)
let _on401: (() => void) | null = null;
let _getToken: (() => string | null) = () => null;
export function register401Handler(fn: () => void, getToken: () => string | null) {
  _on401 = fn;
  _getToken = getToken;
}
// GET requests are background fetches — a 401 means "no access", not "session expired"
// Only log out on 401 for mutating requests (POST/PUT/PATCH/DELETE)
const TOKEN_ERROR_MSGS = ['invalid or expired token', 'invalid token', 'expired token', 'token expired', 'jwt expired', 'unauthorized'];

function isTokenError(status: number, message: string): boolean {
  if (status === 401) return true;
  return TOKEN_ERROR_MSGS.some(m => message.toLowerCase().includes(m));
}

function handle401(path: string) {
  if (path.startsWith('/auth/')) return;
  if (!_getToken()) return;
  _on401?.();
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
    });
    const json = await res.json().catch(() => ({}));
    const msg = json.message || '';
    if (isTokenError(res.status, msg)) { handle401(path); return { ok: false, message: msg || 'Session expired. Please log in again.' }; }
    if (!res.ok || !json.success) {
      return { ok: false, message: msg || 'Something went wrong.' };
    }
    return { ok: true, data: json.data };
  } catch {
    return { ok: false, message: 'Network error. Check your connection.' };
  }
}

async function requestMultipart<T>(
  path: string,
  formData: FormData,
  token: string,
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const json = await res.json().catch(() => ({}));
    if (isTokenError(res.status, json.message || '')) { handle401(path); return { ok: false, message: json.message || 'Session expired. Please log in again.' }; }
    if (!res.ok || !json.success) {
      return { ok: false, message: json.message || 'Something went wrong.' };
    }
    return { ok: true, data: json.data };
  } catch {
    return { ok: false, message: 'Network error. Check your connection.' };
  }
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export type RegisterPayload = { phone: string; password: string; email?: string };
export type RegisterResponse = { userId: string; phone: string; devOtp?: string };

export async function apiRegister(payload: RegisterPayload) {
  return request<RegisterResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export type LoginPayload = { identifier: string; password: string };
export type LoginResponse = {
  token: string;
  user: {
    id: string;
    phone: string;
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
    is_phone_verified: boolean;
  };
};

export async function apiLogin(payload: LoginPayload) {
  return request<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export type VerifyOtpPayload = { phone: string; code: string; purpose?: string };
export type VerifyOtpResponse = { token: string | null; user: Record<string, unknown> | null };

export async function apiVerifyOtp(payload: VerifyOtpPayload) {
  return request<VerifyOtpResponse>('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ purpose: 'register', ...payload }),
  });
}

// ── Forgot Password ───────────────────────────────────────────────────────────

export async function apiForgotPassword(phone: string) {
  return request<{ message: string }>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  });
}

export type VerifyResetOtpResponse = { resetToken: string };

export async function apiVerifyResetOtp(phone: string, code: string) {
  return request<VerifyResetOtpResponse>('/auth/verify-reset-otp', {
    method: 'POST',
    body: JSON.stringify({ phone, code }),
  });
}

export async function apiResetPassword(resetToken: string, newPassword: string) {
  return request<{ message: string }>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ resetToken, newPassword }),
  });
}

export type ProfilePayload = {
  fullName?: string;
  username?: string;
  gender?: string;
  dateOfBirth?: string;
  avatarUri?: string;
  avatarMimeType?: string;
  bio?: string;
  location?: string;
};

export async function apiCompleteProfile(payload: ProfilePayload, token: string) {
  const form = new FormData();
  if (payload.fullName) form.append('fullName', payload.fullName);
  if (payload.username) form.append('username', payload.username);
  if (payload.gender) form.append('gender', payload.gender);
  if (payload.dateOfBirth) form.append('dateOfBirth', payload.dateOfBirth);
  if (payload.bio !== undefined) form.append('bio', payload.bio);
  if (payload.location !== undefined) form.append('location', payload.location);
  if (payload.avatarUri) {
    const filename = payload.avatarUri.split('/').pop() ?? 'avatar.jpg';
    const mime = payload.avatarMimeType ?? 'image/jpeg';
    form.append('avatar', { uri: payload.avatarUri, name: filename, type: mime } as unknown as Blob);
  }
  return requestMultipart('/auth/profile', form, token);
}

// ── Rooms ─────────────────────────────────────────────────────────────────────

export type MyRoom = {
  id: string;
  room_name: string;
  description: string | null;
  room_image_url: string | null;
  visibility: 'public' | 'private';
  status: 'active' | 'closed' | 'banned';
  agency_name: string;
  current_level: number;
  created_at: string;
};

export async function apiMyRooms(token: string) {
  return request<MyRoom[]>('/rooms/my', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export type PublicRoom = {
  id: string;
  room_name: string;
  room_image_url: string | null;
  current_level: number;
};

export async function apiPublicRooms() {
  return request<PublicRoom[]>('/rooms/public');
}

export async function apiOnlineCounts() {
  return request<Record<string, number>>('/rooms/online-counts');
}
