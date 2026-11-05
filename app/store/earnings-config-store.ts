import { useEffect, useState } from 'react';

import { BASE_URL } from '@/services/api';
import type { EarningSource } from '@/screens/wallet/earnings-shared';

// Admin-managed earning settings (gem value, bonus %, slabs) for every
// earning service. Loaded in the background when Home opens; the wallet
// re-requests it if it still isn't there. Nothing here has built-in defaults —
// a service the admin hasn't configured is `null`.

export type EarningSlabConfig = { name: string; gems: number; payout: number; bonus: number; total: number };

export type SourceConfig = {
  effective_month: string;
  gems_per_coin: number;
  bonus_pct: number;
  slabs: EarningSlabConfig[];
};

export type EarningsConfig = {
  month: string;
  sources: Partial<Record<EarningSource, SourceConfig | null>>;
};

let config: EarningsConfig | null = null;
let inFlight: Promise<EarningsConfig | null> | null = null;
const listeners = new Set<() => void>();

function notify() { listeners.forEach(fn => fn()); }

export const earningsConfigStore = {
  get: () => config,

  /** Fetches the settings (one request at a time). `force` re-fetches even if loaded. */
  load(force = false): Promise<EarningsConfig | null> {
    if (config && !force) return Promise.resolve(config);
    if (inFlight) return inFlight;
    inFlight = fetch(`${BASE_URL}/tasks/earnings/config`)
      .then(r => r.json())
      .then(j => {
        if (j.success) { config = j.data; notify(); }
        return config;
      })
      .catch(() => config)
      .finally(() => { inFlight = null; });
    return inFlight;
  },

  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  },
};

/** Current settings; loads them if they aren't there yet (e.g. Home's background load failed). */
export function useEarningsConfig() {
  const [value, setValue] = useState(earningsConfigStore.get());
  useEffect(() => {
    const unsub = earningsConfigStore.subscribe(() => setValue(earningsConfigStore.get()));
    if (!earningsConfigStore.get()) earningsConfigStore.load();
    return unsub;
  }, []);
  return value;
}
