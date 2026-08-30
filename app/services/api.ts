// export const BASE_URL = 'https://api.raralive.in/api';
// export const MEDIA_BASE = 'https://api.raralive.in';

export const BASE_URL = 'http://192.168.0.9:5000/api';
export const MEDIA_BASE = 'http://192.168.0.9:5000';

export type ApiResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; message: string };

export function resolveImageUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const path = new URL(url).pathname;
    return `${MEDIA_BASE}${path}`;
  } catch {
    return `${MEDIA_BASE}/${url.replace(/^\//, '')}`;
  }
}

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
  method: 'POST' | 'PATCH' = 'PATCH',
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
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

// ── Friend Zone ───────────────────────────────────────────────────────────────

export type FriendZoneStatus = 'pending' | 'approved' | 'rejected';

export type FriendZoneApplication = {
  id: string;
  user_id: string;
  photos: string[];
  full_name: string;
  gender: string;
  date_of_birth: string;
  city: string;
  language: string;
  about_me: string | null;
  status: FriendZoneStatus;
  rejection_reason: string | null;
  receive_calls: boolean;
  video_calls: boolean;
  created_at: string;
  updated_at: string;
};

export type FriendZoneApplyPayload = {
  fullName: string;
  gender: string;
  dateOfBirth: string;
  city: string;
  language: string;
  aboutMe?: string;
  photoUris: string[];
};

function appendFriendZoneFields(form: FormData, payload: FriendZoneApplyPayload) {
  form.append('fullName', payload.fullName);
  form.append('gender', payload.gender);
  form.append('dateOfBirth', payload.dateOfBirth);
  form.append('city', payload.city);
  form.append('language', payload.language);
  if (payload.aboutMe) form.append('aboutMe', payload.aboutMe);
}

export async function apiFriendZoneApply(payload: FriendZoneApplyPayload, token: string) {
  const form = new FormData();
  appendFriendZoneFields(form, payload);
  payload.photoUris.forEach((uri, i) => {
    const filename = uri.split('/').pop() ?? `photo${i}.jpg`;
    form.append('photos', { uri, name: filename, type: 'image/jpeg' } as unknown as Blob);
  });
  return requestMultipart<FriendZoneApplication>('/friend-zone/apply', form, token, 'POST');
}

export async function apiFriendZoneMyStatus(token: string) {
  return request<FriendZoneApplication | null>('/friend-zone/my-status', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export type FriendZoneUpdatePayload = FriendZoneApplyPayload & {
  existingPhotoUrls: string[];
  newPhotoUris: string[];
};

export async function apiFriendZoneUpdateApplication(payload: FriendZoneUpdatePayload, token: string) {
  const form = new FormData();
  appendFriendZoneFields(form, payload);
  payload.existingPhotoUrls.forEach(url => form.append('existingPhotos', url));
  payload.newPhotoUris.forEach((uri, i) => {
    const filename = uri.split('/').pop() ?? `photo${i}.jpg`;
    form.append('photos', { uri, name: filename, type: 'image/jpeg' } as unknown as Blob);
  });
  return requestMultipart<FriendZoneApplication>('/friend-zone/my-application', form, token, 'PATCH');
}

export async function apiFriendZoneUpdateToggles(receiveCalls: boolean, videoCalls: boolean, token: string) {
  return request<FriendZoneApplication>('/friend-zone/my-toggles', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ receiveCalls, videoCalls }),
  });
}

export type FriendZonePublicFriend = {
  id: string;
  user_id: string;
  photos: string[];
  full_name: string;
  gender: string;
  date_of_birth: string;
  city: string;
  language: string;
  about_me: string | null;
  receive_calls: boolean;
  video_calls: boolean;
  is_online: boolean;
};

export async function apiFriendZoneFriends(token: string) {
  return request<FriendZonePublicFriend[]>('/friend-zone/friends', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export type FriendZoneCallHistoryEntry = {
  id: string;
  channel_name: string;
  call_type: 'audio' | 'video';
  status: 'ringing' | 'accepted' | 'rejected' | 'missed' | 'ended' | 'failed';
  duration_seconds: number;
  coins_charged: number;
  gems_earned: number;
  end_reason: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  direction: 'incoming' | 'outgoing';
  peer_user_id: string;
  peer_name: string | null;
  peer_username: string | null;
  peer_avatar_url: string | null;
};

export async function apiFriendZoneCallHistory(token: string) {
  return request<FriendZoneCallHistoryEntry[]>('/friend-zone/call-history', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ── Go Live ───────────────────────────────────────────────────────────────────

export type GoLiveStatus = 'pending' | 'approved' | 'rejected';

export type GoLiveRequest = {
  id: string;
  user_id: string;
  full_name: string;
  date_of_birth: string;
  language: string;
  status: GoLiveStatus;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type GoLiveApplyPayload = {
  fullName: string;
  dateOfBirth: string;
  language: string;
};

export async function apiGoLiveApply(payload: GoLiveApplyPayload, token: string) {
  return request<GoLiveRequest>('/go-live/apply', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}

export async function apiGoLiveMyStatus(token: string) {
  return request<GoLiveRequest | null>('/go-live/my-status', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export type LiveBroadcastSession = {
  broadcastId: string;
  roomId: string;
  channelName: string;
  maxCohosts?: number;
};

export async function apiStartBroadcast(token: string) {
  return request<LiveBroadcastSession>('/go-live/broadcast/start', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function apiEndBroadcast(token: string) {
  return request<{ id: string }>('/go-live/broadcast/end', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export type ActiveBroadcast = {
  id: string;
  room_id: string;
  channel_name: string;
  started_at: string;
  room_name: string;
  room_image_url: string | null;
  host_user_id: string;
  host_name: string | null;
  host_username: string | null;
  host_avatar_url: string | null;
};

export async function apiActiveBroadcasts(token: string) {
  return request<ActiveBroadcast[]>('/go-live/broadcast/active', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ── Rooms ─────────────────────────────────────────────────────────────────────

export type MyRoom = {
  id: string;
  room_name: string;
  description: string | null;
  room_image_url: string | null;
  visibility: 'public' | 'private';
  status: 'active' | 'closed' | 'banned';
  city: string | null;
  state: string | null;
  district: string | null;
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

export async function apiPublicRooms(token?: string | null) {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  return request<PublicRoom[]>('/rooms/public', { headers });
}

export async function apiOnlineCounts() {
  return request<Record<string, number>>('/rooms/online-counts');
}

// ── Chat (1:1 direct messages) ────────────────────────────────────────────────

export type ChatMessageType = 'text' | 'image' | 'audio' | 'video' | 'file' | 'sticker';

export type DirectMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  type: ChatMessageType;
  text: string | null;
  media_url: string | null;
  media_name: string | null;
  media_mime: string | null;
  media_duration_ms: number | null;
  sticker_id: string | null;
  read_at: string | null;
  created_at: string;
};

export type ChatConversation = {
  id: string;
  user_a_id: string;
  user_b_id: string;
  initiated_by: string;
  status: 'pending' | 'accepted';
  last_message_at: string | null;
  last_message_preview: string | null;
  created_at: string;
  updated_at: string;
  peer_id: string;
  peer_name: string | null;
  peer_username: string | null;
  peer_avatar_url: string | null;
  unread_count?: number;
};

export async function apiChatConversations(token: string) {
  return request<ChatConversation[]>('/chat/conversations', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function apiChatRequests(token: string) {
  return request<ChatConversation[]>('/chat/requests', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function apiChatUnreadCount(token: string) {
  return request<{ count: number }>('/chat/unread-count', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function apiChatStartConversation(peerId: string, token: string) {
  return request<ChatConversation>('/chat/conversations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ peerId }),
  });
}

export async function apiChatConversation(conversationId: string, token: string) {
  return request<ChatConversation>(`/chat/conversations/${conversationId}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function apiChatAcceptConversation(conversationId: string, token: string) {
  return request<ChatConversation>(`/chat/conversations/${conversationId}/accept`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function apiChatRejectConversation(conversationId: string, token: string) {
  return request<{ message: string }>(`/chat/conversations/${conversationId}/reject`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function apiChatMessages(conversationId: string, token: string, before?: string) {
  const qs = before ? `?before=${encodeURIComponent(before)}` : '';
  return request<DirectMessage[]>(`/chat/conversations/${conversationId}/messages${qs}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function apiChatMarkRead(conversationId: string, token: string) {
  return request<{ message: string }>(`/chat/conversations/${conversationId}/read`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export type ChatMediaPayload = {
  uri: string;
  name: string;
  mimeType: string;
  type: 'image' | 'audio' | 'video' | 'file';
  durationMs?: number;
};

export async function apiChatSendMedia(conversationId: string, payload: ChatMediaPayload, token: string) {
  const form = new FormData();
  form.append('type', payload.type);
  if (payload.durationMs) form.append('durationMs', String(payload.durationMs));
  form.append('file', { uri: payload.uri, name: payload.name, type: payload.mimeType } as unknown as Blob);
  return requestMultipart<DirectMessage>(`/chat/conversations/${conversationId}/media`, form, token, 'POST');
}
