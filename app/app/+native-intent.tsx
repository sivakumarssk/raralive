import { authStore } from '@/store/auth-store';
import { pendingLink, sharedLinkPath } from '@/store/pending-link';

/**
 * Every link that opens the app passes through here (expo-router). Shared
 * profile / room / post links open their screen — but only once login is
 * loaded: on a cold start, or when logged out, the app starts normally
 * (splash → login if needed) and opens the link after (see enterApp).
 */
export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }) {
  try {
    const target = sharedLinkPath(path);
    if (!target) return path;
    if (initial || !authStore.getToken()) {
      pendingLink.set(target);
      return '/';
    }
    return target;
  } catch {
    return '/';
  }
}
