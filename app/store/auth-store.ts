import AsyncStorage from '@react-native-async-storage/async-storage';

export type StoredUser = {
  id: string;
  phone: string;
  fullName: string | null;
  username: string | null;
  avatarUrl: string | null;
  isPhoneVerified: boolean;
};

type AuthState = {
  token: string | null;
  userId: string | null;
  phone: string | null;
  user: StoredUser | null;
  pendingName: string | null;
};

const state: AuthState = {
  token: null,
  userId: null,
  phone: null,
  user: null,
  pendingName: null,
};

const TOKEN_KEY = 'rara_token';
const USER_KEY = 'rara_user';

export const authStore = {
  setRegistered(userId: string, phone: string) {
    state.userId = userId;
    state.phone = phone;
  },

  setPendingName(name: string) {
    state.pendingName = name;
  },
  getPendingName() {
    return state.pendingName;
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

  getPhone() {
    return state.phone;
  },
  getUserId() {
    return state.userId;
  },

  async hydrate(): Promise<boolean> {
    try {
      const [token, userJson] = await Promise.all([
        AsyncStorage.getItem(TOKEN_KEY),
        AsyncStorage.getItem(USER_KEY),
      ]);
      if (token) state.token = token;
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
    state.pendingName = null;
    AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]).catch(() => {});
  },
};
