import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

// Whether the logged-in user has created a chatroom — only chatroom owners
// see the creator options (Go Live, Friend Zone call toggles). The server
// pushes this over the app-wide socket ('my_chatroom_status', see
// friend-zone-socket-store.ts) and the value is cached in AsyncStorage so it's
// available immediately on the next app start, until the user logs out.

const STORAGE_KEY = 'rara_has_chatroom';

const state = { hasChatroom: false };

const listeners = new Set<() => void>();
function notify() { listeners.forEach(fn => fn()); }

export const chatroomOwnerStore = {
  /** Load the cached flag (if any) — called from authStore.hydrate(). */
  async hydrate() {
    try {
      const cached = await AsyncStorage.getItem(STORAGE_KEY);
      if (cached !== null) {
        state.hasChatroom = cached === 'true';
        notify();
      }
    } catch {}
  },

  set(hasChatroom: boolean) {
    AsyncStorage.setItem(STORAGE_KEY, String(hasChatroom)).catch(() => {});
    if (state.hasChatroom === hasChatroom) return;
    state.hasChatroom = hasChatroom;
    notify();
  },

  get() {
    return state.hasChatroom;
  },

  clear() {
    state.hasChatroom = false;
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
    notify();
  },
};

export function useHasChatroom() {
  const [hasChatroom, setHasChatroom] = useState(state.hasChatroom);
  useEffect(() => {
    const update = () => setHasChatroom(state.hasChatroom);
    update(); // catch a change between first render and subscribing
    listeners.add(update);
    return () => { listeners.delete(update); };
  }, []);
  return hasChatroom;
}
