// Live "how loud is this person speaking" levels for the chat room stage,
// keyed by userId, 0 (silent) … 1 (loud).
//
// Only people on a seat join the Agora voice channel, so each of them measures
// their OWN mic level and shares it through the room socket; listeners get
// everyone's levels from there. Your own level is also set locally straight
// from Agora so your seat reacts without a network round trip.

type Entry = { level: number; at: number };

const levels = new Map<string, Entry>();
const listeners = new Map<string, Set<(level: number) => void>>();

// A speaker re-sends while talking (heartbeat), so a level that hasn't been
// refreshed for this long means they stopped or left — fade it out.
const STALE_MS = 1300;

function emit(userId: string, level: number) {
  listeners.get(userId)?.forEach(fn => fn(level));
}

let sweeper: ReturnType<typeof setInterval> | null = null;
function ensureSweeper() {
  if (sweeper) return;
  sweeper = setInterval(() => {
    const now = Date.now();
    levels.forEach((e, userId) => {
      if (e.level > 0 && now - e.at > STALE_MS) {
        levels.set(userId, { level: 0, at: now });
        emit(userId, 0);
      }
    });
  }, 400);
}

export const speakingStore = {
  setLevel(userId: string, level: number) {
    const clamped = Math.max(0, Math.min(1, level));
    const prev = levels.get(userId)?.level ?? 0;
    levels.set(userId, { level: clamped, at: Date.now() });
    if (clamped !== prev) emit(userId, clamped);
    ensureSweeper();
  },

  getLevel(userId: string) {
    return levels.get(userId)?.level ?? 0;
  },

  subscribe(userId: string, fn: (level: number) => void) {
    if (!listeners.has(userId)) listeners.set(userId, new Set());
    listeners.get(userId)!.add(fn);
    return () => { listeners.get(userId)?.delete(fn); };
  },

  /** Leaving a room: forget everyone's levels. */
  clear() {
    levels.forEach((_, userId) => emit(userId, 0));
    levels.clear();
  },
};
