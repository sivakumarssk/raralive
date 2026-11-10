import { router } from 'expo-router';

import { authStore } from '@/store/auth-store';

// A shared link (profile / room / post) that arrived before the app was ready
// to show it — a cold start (login not loaded yet) or a logged-out user. It's
// opened once the user is in the app; see app/+native-intent.tsx.
let pending: string | null = null;

export const pendingLink = {
  set(path: string) { pending = path; },
  take(): string | null { const p = pending; pending = null; return p; },
};

/** In-app path for a shared link, or null for any other URL. */
export function sharedLinkPath(url: string): string | null {
  // https://raralive.in/post/ID, rara-live://room/CODE, or a bare /user/ID
  const rest = url.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
  const m = rest.match(/(?:^|\/)(user|room|post)\/([A-Za-z0-9-]+)\/?(?:[?#].*)?$/);
  return m ? `/${m[1]}/${m[2]}` : null;
}

/**
 * Leave login/splash for the app: the language picker if still needed,
 * otherwise Home — then the shared link waiting to open, on top of Home so
 * back returns there.
 */
export function enterApp() {
  if (authStore.needsLanguage()) { router.replace('/language'); return; }
  router.replace('/(tabs)');
  const path = pendingLink.take();
  if (path) setTimeout(() => router.push(path as never), 50);
}
