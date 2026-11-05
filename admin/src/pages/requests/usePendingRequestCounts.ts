import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';

export type PendingRequestCounts = { friendZone: number; goLive: number };

/** null for a source whose request failed — the previous count is kept. */
async function fetchPendingCounts(): Promise<{ friendZone: number | null; goLive: number | null }> {
  const [fz, gl] = await Promise.all([
    api.get<{ pagination: { total: number } }>('/friend-zone/admin?status=pending&limit=1'),
    api.get<{ pagination: { total: number } }>('/go-live/admin?status=pending&limit=1'),
  ]);
  return {
    friendZone: fz.ok ? fz.data.pagination.total : null,
    goLive: gl.ok ? gl.data.pagination.total : null,
  };
}

/** Pending counts for the Requests tabs and the sidebar badge. */
export function usePendingRequestCounts(refreshKey?: unknown) {
  const [counts, setCounts] = useState<PendingRequestCounts>({ friendZone: 0, goLive: 0 });

  const apply = useCallback((next: { friendZone: number | null; goLive: number | null }) => {
    setCounts(prev => ({
      friendZone: next.friendZone ?? prev.friendZone,
      goLive: next.goLive ?? prev.goLive,
    }));
  }, []);

  const refresh = useCallback(() => { fetchPendingCounts().then(apply); }, [apply]);

  useEffect(() => {
    let cancelled = false;
    fetchPendingCounts().then(next => { if (!cancelled) apply(next); });
    return () => { cancelled = true; };
  }, [apply, refreshKey]);

  return { counts, total: counts.friendZone + counts.goLive, refresh };
}
