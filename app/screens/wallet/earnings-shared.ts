// Shared by the wallet Earnings tab and the per-service slab screen.

export type EarningSource = 'chatroom' | 'live' | 'private' | 'friendzone' | 'views';

export type EarningSourceMeta = {
  key: EarningSource; label: string; short: string; icon: string; color: string; tint: string;
  /** Listed in the overview but not tracked yet — no slab screen to open. */
  comingSoon?: boolean;
};

export const EARNING_SOURCES: EarningSourceMeta[] = [
  { key: 'chatroom',   label: 'Audio Chat Rooms',   short: 'Audio Chat',   icon: 'mic',         color: '#E91E7F', tint: '#FDE8F3' },
  { key: 'live',       label: 'Video Live',         short: 'Video Live',   icon: 'videocam',    color: '#1D6FE0', tint: '#E4EFFD' },
  { key: 'private',    label: 'Private Video Live', short: 'Private Live', icon: 'lock-closed', color: '#7A0EED', tint: '#F3EFFE' },
  { key: 'friendzone', label: 'Friend Zone',        short: 'Friend Zone',  icon: 'people',      color: '#F59E0B', tint: '#FFF4E0' },
  { key: 'views',      label: 'Video Views',        short: 'Video Views',  icon: 'eye',         color: '#0D9488', tint: '#E0F5F3' },
];

export const SOURCE_BY_KEY = Object.fromEntries(EARNING_SOURCES.map(src => [src.key, src])) as Record<EarningSource, EarningSourceMeta>;

export function formatInr(n: number): string {
  return `₹ ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Money one gem is worth at a slab: the slab's full amount (payout + bonus —
 * slab amounts are cumulative, this is what reaching it pays in total) divided
 * by its gem target. Uses the slab reached this month, else the first slab.
 */
export function gemValue(
  slabs: { name: string; gems: number; payout: number; bonus: number }[],
  currentSlab: string | null,
): number | null {
  const slab = slabs.find(sl => sl.name === currentSlab) ?? slabs[0];
  if (!slab || slab.gems <= 0) return null;
  return (slab.payout + slab.bonus) / slab.gems;
}

/** "₹0.025 / gem" — one format everywhere a gem value is shown. */
export function formatGemValue(value: number | null): string {
  if (value == null) return '—';
  return `₹${value >= 0.01 ? value.toFixed(3) : value.toFixed(4)} / gem`;
}

export function formatN(n: number): string {
  return n.toLocaleString('en-IN');
}

export function formatCallDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export function formatTxnTime(d: Date): string {
  const now = new Date();
  const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return `Today, ${time}`;
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday, ${time}`;
  return `${d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}, ${time}`;
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

/** 'YYYY-MM' (IST month from the API) → "This Month" / "Last Month" / "August 2026". */
export function monthLabel(key: string): string {
  const now = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  const y = now.getUTCFullYear(), m = now.getUTCMonth() + 1;
  const current = `${y}-${String(m).padStart(2, '0')}`;
  const last = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
  if (key === current) return 'This Month';
  if (key === last) return 'Last Month';
  const [ky, km] = key.split('-').map(Number);
  return `${MONTH_NAMES[km - 1]} ${ky}`;
}
