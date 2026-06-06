import { useEffect, useState } from 'react';

type MinimizedRoom = {
  roomId: string;
  roomName: string;
  avatarUri?: string;
};

type RoomStoreState = {
  minimized: MinimizedRoom | null;
};

const state: RoomStoreState = { minimized: null };
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach(fn => fn());
}

export const roomStore = {
  minimize(room: MinimizedRoom) {
    state.minimized = room;
    notify();
  },
  clear() {
    state.minimized = null;
    notify();
  },
  getMinimized() {
    return state.minimized;
  },
};

export function useMinimizedRoom() {
  const [minimized, setMinimized] = useState(state.minimized);
  useEffect(() => {
    const update = () => setMinimized(state.minimized);
    listeners.add(update);
    return () => { listeners.delete(update); };
  }, []);
  return minimized;
}
