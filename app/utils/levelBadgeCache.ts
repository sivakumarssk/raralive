import { Image } from 'expo-image';

// Silently warms expo-image's disk cache for a list of remote badge URLs. expo-image
// caches to disk by default, so a successful prefetch means the badge loads instantly
// (no network) every time after. Never surfaces loading/error state to the UI — on
// failure it retries a few times with backoff, then gives up quietly; the badge simply
// falls back to fetching over the network the next time it's actually rendered.
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 4000;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function prefetchWithRetry(url: string) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const ok = await Image.prefetch(url, { cachePolicy: 'disk' });
      if (ok) return;
    } catch {
      // ignore — retry below
    }
    if (attempt < MAX_ATTEMPTS) await delay(RETRY_DELAY_MS * attempt);
  }
}

export function prefetchBadgesInBackground(urls: string[]) {
  // Fire-and-forget: sequential (not Promise.all) so a burst of prefetches doesn't
  // compete with foreground network requests like chat/gifts.
  (async () => {
    for (const url of urls) {
      await prefetchWithRetry(url);
    }
  })();
}
