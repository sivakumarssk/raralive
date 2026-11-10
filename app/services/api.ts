// Production (use for Play builds):
// export const BASE_URL = 'https://api.raralive.in/api';
// export const MEDIA_BASE = 'https://api.raralive.in';

export const BASE_URL = 'http://192.168.0.7:5000/api';
export const MEDIA_BASE = 'http://192.168.0.7:5000';

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
// 'revoked' = the account was logged out of all devices from somewhere.
type SignOutReason = 'expired' | 'revoked';
let _on401: ((reason: SignOutReason) => void) | null = null;
let _getToken: (() => string | null) = () => null;
export function register401Handler(fn: (reason: SignOutReason) => void, getToken: () => string | null) {
  _on401 = fn;
  _getToken = getToken;
}

/** Signs out locally after the server revoked this session (REST or socket). */
export function triggerSessionRevoked() {
  if (!_getToken()) return;
  _on401?.('revoked');
}
// GET requests are background fetches — a 401 means "no access", not "session expired"
// Only log out on 401 for mutating requests (POST/PUT/PATCH/DELETE)
const TOKEN_ERROR_MSGS = ['invalid or expired token', 'invalid token', 'expired token', 'token expired', 'jwt expired', 'unauthorized'];

function isTokenError(status: number, message: string): boolean {
  if (status === 401) return true;
  return TOKEN_ERROR_MSGS.some(m => message.toLowerCase().includes(m));
}

function handle401(path: string, code?: string) {
  // A revoked session ends everywhere; other /auth/ 401s are wrong-credential replies.
  if (code === 'SESSION_REVOKED') { triggerSessionRevoked(); return; }
  if (path.startsWith('/auth/')) return;
  if (!_getToken()) return;
  _on401?.('expired');
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
    if (isTokenError(res.status, msg)) { handle401(path, json.code); return { ok: false, message: msg || 'Session expired. Please log in again.' }; }
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
    if (isTokenError(res.status, json.message || '')) { handle401(path, json.code); return { ok: false, message: json.message || 'Session expired. Please log in again.' }; }
    if (!res.ok || !json.success) {
      return { ok: false, message: json.message || 'Something went wrong.' };
    }
    return { ok: true, data: json.data };
  } catch {
    return { ok: false, message: 'Network error. Check your connection.' };
  }
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export type RegisterPayload = { phone: string; password?: string; email?: string };
export type RegisterResponse = { userId: string; phone: string };

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
    gender?: string | null;
    preferred_language?: string | null;
  };
};

export async function apiLogin(payload: LoginPayload) {
  return request<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** OTP login, step 1: texts a code to a registered phone. */
export async function apiSendLoginOtp(phone: string) {
  return request<undefined>('/auth/login-otp/send', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  });
}

/** OTP login, step 2: same response as password login. */
export async function apiVerifyLoginOtp(phone: string, code: string) {
  return request<LoginResponse>('/auth/login-otp/verify', {
    method: 'POST',
    body: JSON.stringify({ phone, code }),
  });
}

/** Registration step 1: is this username still free? */
export async function apiCheckUsername(username: string) {
  return request<{ available: boolean }>(`/auth/username-available?username=${encodeURIComponent(username)}`);
}

/** Save the account's app language (PATCH /auth/language). */
/** Revokes every session of this account, the current one included. */
export async function apiLogoutAllDevices(token: string) {
  return request<unknown>('/auth/logout-all', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  });
}

export async function apiSetLanguage(language: string, token: string) {
  return request<unknown>('/auth/language', {
    method: 'PATCH',
    // Full headers: request() lets options.headers replace its defaults
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ language }),
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

export async function apiResendOtp(phone: string) {
  return request<undefined>('/auth/resend-otp', {
    method: 'POST',
    body: JSON.stringify({ phone }),
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
  /** Topic tags picked at creation (labels from ROOM_TAGS). */
  tags?: string[];
  /** Host's gender — picks the default avatar when room_image_url is null. */
  host_gender?: string | null;
  created_at: string;
};

export async function apiMyRooms(token: string) {
  return request<MyRoom[]>('/rooms/my', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
}

/** Host deletes their own private room (soft delete on the server). */
export async function apiDeleteRoom(roomId: string, token: string) {
  return request<unknown>(`/rooms/${roomId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export type PublicRoom = {
  id: string;
  room_name: string;
  room_image_url: string | null;
  current_level: number;
  city: string | null;
  state: string | null;
  district: string | null;
  /** The host's current app language (rooms follow their host). */
  language?: string;
  tags?: string[];
  host_gender?: string | null;
};

/**
 * Public rooms in the viewer's language. Logged-in users are matched on their
 * account's language server-side; `language` covers guests (phone's choice).
 */
export async function apiPublicRooms(token?: string | null, language?: string | null) {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const query = language ? `?language=${encodeURIComponent(language)}` : '';
  return request<PublicRoom[]>(`/rooms/public${query}`, { headers });
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
  pinned?: boolean;
  /** Only on the single-conversation endpoint — whether I've blocked this peer. */
  blocked_by_me?: boolean;
  /** Only on the single-conversation endpoint — whether this peer has blocked me. */
  blocked_by_peer?: boolean;
};

export type BlockedUser = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  blocked_at: string;
  conversation_id: string | null;
};

/** Users I've blocked (chat list ⋮ → Blocked Users). */
export async function apiChatBlockedUsers(token: string) {
  return request<BlockedUser[]>('/chat/blocks', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function apiChatUnblockUser(userId: string, token: string) {
  return request<{ message: string }>(`/chat/blocks/${userId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

/** A pending conversation someone else started — shown with Accept / Remove / Block. */
export function isIncomingChatRequest(conversation: ChatConversation, myUserId: string | null) {
  return conversation.status === 'pending' && conversation.initiated_by !== myUserId;
}

export async function apiChatConversations(token: string) {
  return request<ChatConversation[]>('/chat/conversations', {
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

export async function apiChatBlock(conversationId: string, token: string) {
  return request<{ message: string }>(`/chat/conversations/${conversationId}/block`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function apiChatUnblock(conversationId: string, token: string) {
  return request<{ message: string }>(`/chat/conversations/${conversationId}/block`, {
    method: 'DELETE',
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

export async function apiChatMarkUnread(conversationId: string, token: string) {
  return request<{ message: string }>(`/chat/conversations/${conversationId}/unread`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function apiChatPin(conversationId: string, token: string) {
  return request<{ message: string }>(`/chat/conversations/${conversationId}/pin`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function apiChatUnpin(conversationId: string, token: string) {
  return request<{ message: string }>(`/chat/conversations/${conversationId}/pin`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function apiChatDeleteConversation(conversationId: string, token: string) {
  return request<{ message: string }>(`/chat/conversations/${conversationId}`, {
    method: 'DELETE',
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

// ── Agency Coin Wallet (agency accounts only) ─────────────────────────────────

export type AgencyWalletTxn = {
  id: string;
  txn_code: string;
  agency_id: string;
  agency_name: string;
  type: 'official_credit' | 'user_recharge';
  coins: number;
  slab_coins: number;
  extra_coins: number;
  balance_after: number;
  user_id: string | null;
  user_handle: string | null;
  user_name: string | null;
  request_id: string | null;
  note: string | null;
  created_at: string;
};

export type AgencyCoinRequest = {
  id: string;
  request_code: string;
  coins: number;
  status: 'pending' | 'approved' | 'rejected';
  extra_coins: number;
  admin_note: string | null;
  processed_at: string | null;
  created_at: string;
};

export type AgencyWalletOverview = {
  agency: { id: string; agency_name: string; agent_code: string };
  balance: number;
  stats: { received: number; used_today: number; transactions: number };
  recharge_slabs: number[];
  request_slabs: number[];
  low_balance_threshold: number;
};

export type AgencyRechargeUser = { id: string; username: string | null; full_name: string | null; avatar_url: string | null };

export async function apiAgencyWallet(token: string) {
  return request<AgencyWalletOverview>('/agency-wallet/me', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function apiAgencyWalletTransactions(token: string) {
  return request<AgencyWalletTxn[]>('/agency-wallet/transactions', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function apiAgencyWalletLookup(query: string, token: string) {
  return request<AgencyRechargeUser>(`/agency-wallet/lookup?q=${encodeURIComponent(query)}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function apiAgencyWalletRecharge(
  payload: { userId: string; slabCoins: number; extraCoins: number; idempotencyKey: string },
  token: string,
) {
  return request<{ transaction: AgencyWalletTxn; balance: number; duplicate: boolean }>('/agency-wallet/recharge', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}

export async function apiAgencyWalletRequests(token: string) {
  return request<AgencyCoinRequest[]>('/agency-wallet/requests', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function apiAgencyWalletCreateRequest(coins: number, token: string) {
  return request<AgencyCoinRequest>('/agency-wallet/requests', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ coins }),
  });
}

// ── India locations (chatroom location picker) ────────────────────────────────

export async function apiLocationStates(token: string) {
  return request<string[]>('/locations/states', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function apiLocationCities(state: string, token: string) {
  return request<string[]>(`/locations/cities?state=${encodeURIComponent(state)}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ── Post tags (admin-managed Home tabs + sub tags) ────────────────────────────

export type PostTag = { id: string; name: string; parent_id: string | null; children?: PostTag[] };

/** Active Home tabs (top-level tags) with their sub tags. */
export async function apiPostTags() {
  return request<PostTag[]>('/post-tags', { method: 'GET' });
}

/** "Trending Now" chips — tags used most in the last 7 days. */
export async function apiTrendingPostTags() {
  return request<PostTag[]>('/post-tags/trending', { method: 'GET' });
}
