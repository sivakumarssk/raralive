import AsyncStorage from '@react-native-async-storage/async-storage';

import { chatroomOwnerStore } from '@/store/chatroom-owner-store';

export type StoredUser = {
  id: string;
  phone: string;
  fullName: string | null;
  username: string | null;
  avatarUrl: string | null;
  isPhoneVerified: boolean;
  gender?: string | null;
  /** null = account has never picked a language. Missing on sessions saved
   *  before this field existed — those are existing accounts, never asked. */
  preferredLanguage?: string | null;
  /** What this session logged in with; sessions saved before this count as phone. */
  loginMethod?: 'phone' | 'email';
};

type AuthState = {
  token: string | null;
  userId: string | null;
  phone: string | null;
  user: StoredUser | null;
  pendingUsername: string | null;
  pendingGender: Gender | null;
  pendingDob: string | null;
  /** Last language picked on this phone (also covers guests with no account). */
  language: string | null;
};

export type Gender = 'male' | 'female' | 'other';

const state: AuthState = {
  token: null,
  userId: null,
  phone: null,
  user: null,
  pendingUsername: null,
  pendingGender: null,
  pendingDob: null,
  language: null,
};

const TOKEN_KEY = 'rara_token';
const USER_KEY = 'rara_user';
const LANGUAGE_KEY = 'rara_language';

export const authStore = {
  setRegistered(userId: string, phone: string) {
    state.userId = userId;
    state.phone = phone;
  },

  /** Username chosen in registration step 1, saved to the profile after OTP. */
  setPendingUsername(username: string) {
    state.pendingUsername = username;
  },
  getPendingUsername() {
    return state.pendingUsername;
  },

  setPendingGender(gender: Gender) {
    state.pendingGender = gender;
  },
  getPendingGender() {
    return state.pendingGender;
  },

  /** Date of birth as YYYY-MM-DD. */
  setPendingDob(dob: string) {
    state.pendingDob = dob;
  },
  getPendingDob() {
    return state.pendingDob;
  },

  setToken(token: string) {
    state.token = token;
    AsyncStorage.setItem(TOKEN_KEY, token).catch(() => {});
  },
  getToken() {
    return state.token;
  },

  setUser(user: StoredUser) {
    state.user = user;
    state.userId = user.id;
    state.phone = user.phone;
    AsyncStorage.setItem(USER_KEY, JSON.stringify(user)).catch(() => {});
  },
  getUser() {
    return state.user;
  },
  isProfileComplete(): boolean {
    const u = state.user;
    if (!u) return false;
    return !!(u.fullName || u.username);
  },

  /** True until this account (or, for a guest, this phone) has picked a language. */
  needsLanguage(): boolean {
    if (state.user) return state.user.preferredLanguage === null;
    return !state.language;
  },
  getLanguage(): string | null {
    return state.user?.preferredLanguage ?? state.language;
  },
  setLanguage(language: string) {
    state.language = language;
    AsyncStorage.setItem(LANGUAGE_KEY, language).catch(() => {});
    if (state.user) authStore.setUser({ ...state.user, preferredLanguage: language });
  },

  getPhone() {
    return state.phone;
  },
  getUserId() {
    return state.userId;
  },

  async hydrate(): Promise<boolean> {
    try {
      const [token, userJson, language] = await Promise.all([
        AsyncStorage.getItem(TOKEN_KEY),
        AsyncStorage.getItem(USER_KEY),
        AsyncStorage.getItem(LANGUAGE_KEY),
        chatroomOwnerStore.hydrate(),
      ]);
      if (token) state.token = token;
      if (language) state.language = language;
      if (userJson) {
        const user: StoredUser = JSON.parse(userJson);
        state.user = user;
        state.userId = user.id;
        state.phone = user.phone;
      }
      return !!token;
    } catch {
      return false;
    }
  },

  clear() {
    state.token = null;
    state.userId = null;
    state.phone = null;
    state.user = null;
    state.pendingUsername = null;
    state.pendingGender = null;
    state.pendingDob = null;
    AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]).catch(() => {});
    chatroomOwnerStore.clear();
  },
};
