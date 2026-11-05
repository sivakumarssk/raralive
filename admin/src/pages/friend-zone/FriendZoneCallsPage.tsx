import { Fragment, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api/client';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://192.168.0.9:5000';

// One place for Friend Zone 1:1 call history (replaces the separate Calls and
// Gifts pages): Audio / Video tabs, who called whom, duration, coins spent on
// the call and on in-call gifts, gems the receiver earned, and the gifts
// themselves in an expandable row.

// ── Types ──────────────────────────────────────────────────────────────────────

type CallStatus = 'ringing' | 'accepted' | 'rejected' | 'missed' | 'ended' | 'failed';
type CallType = 'audio' | 'video';

type CallGift = {
  id: string;
  gift_name: string;
  gift_image_url: string | null;
  quantity: number;
  total_coins: number;
  gems_earned: number;
  sender_id: string;
  created_at: string;
};

type Call = {
  id: string;
  call_type: CallType;
  status: CallStatus;
  duration_seconds: number;
  coins_charged: number;
  gems_earned: number;
  end_reason: string | null;
  created_at: string;
  caller_id: string;
  caller_name: string | null;
  caller_username: string | null;
  caller_avatar_url: string | null;
  callee_id: string;
  callee_name: string | null;
  callee_username: string | null;
  callee_avatar_url: string | null;
  gift_count: number;
  gift_coins: number;
  gift_gems: number;
  gifts: CallGift[];
};

type Summary = { total_seconds: number; call_coins: number; call_gems: number; gift_coins: number; gift_gems: number };

type CallsResponse = {
  calls: Call[];
  pagination: { total: number };
  summary: Summary;
  counts: Record<CallType, number>;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;
const fmt = (n: number) => Number(n || 0).toLocaleString('en-IN');

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const mmss = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return h ? `${h}:${mmss}` : mmss;
}

function formatTotalTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m ${seconds % 60}s`;
}

function resolveImg(url: string | null) {
  if (!url) return null;
  return url.startsWith('http') ? url : `${API_BASE}/${url.replace(/^\//, '')}`;
}

function dateTime(d: string) {
  return new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ── Small components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: CallStatus }) {
  const map: Record<CallStatus, string> = {
    ringing: 'bg-amber-50 text-amber-700',
    accepted: 'bg-blue-50 text-blue-700',
    ended: 'bg-emerald-50 text-emerald-700',
    rejected: 'bg-red-50 text-red-600',
    missed: 'bg-gray-100 text-gray-500',
    failed: 'bg-red-50 text-red-600',
  };
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${map[status]}`}>{status}</span>;
}

function CopyId({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      title="Copy user ID"
      onClick={e => {
        e.stopPropagation();
        navigator.clipboard.writeText(id).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1200); });
      }}
      className="group flex items-center gap-1 mt-0.5 font-mono text-[10.5px] text-gray-400 hover:text-purple-600 text-left break-all">
      <span>ID: {id}</span>
      <span className="shrink-0 text-[10px] font-sans font-semibold text-purple-500 opacity-0 group-hover:opacity-100">
        {copied ? 'Copied' : 'Copy'}
      </span>
    </button>
  );
}

function Person({ id, name, username, avatarUrl, role }: {
  id: string; name: string | null; username: string | null; avatarUrl: string | null; role: string;
}) {
  const label = name || username || 'Unknown';
  const img = resolveImg(avatarUrl);
  return (
    <div className="flex items-start gap-2.5 min-w-0">
      {img ? (
        <img src={img} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
      ) : (
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-white text-xs font-bold flex items-center justify-center shrink-0">
          {label.slice(0, 2).toUpperCase()}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{role}</p>
        <p className="font-semibold text-gray-800 truncate">{label}</p>
        {username && <p className="text-xs text-gray-500 truncate">@{username}</p>}
        <CopyId id={id} />
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">{label}</p>
      <p className={`text-2xl font-black mt-1 ${tone}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

const TYPE_TABS: { key: CallType; label: string; icon: React.ReactNode }[] = [
  {
    key: 'audio', label: 'Audio Calls',
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>,
  },
  {
    key: 'video', label: 'Video Calls',
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>,
  },
];

const STATUS_FILTERS: { key: CallStatus | ''; label: string }[] = [
  { key: '', label: 'All' },
  { key: 'ended', label: 'Completed' },
  { key: 'missed', label: 'Missed' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'failed', label: 'Failed' },
];

export function FriendZoneCallsPage() {
  const [params, setParams] = useSearchParams();
  const callType: CallType = params.get('type') === 'video' ? 'video' : 'audio';
  const [statusFilter, setStatusFilter] = useState<CallStatus | ''>('');
  const [calls, setCalls] = useState<Call[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [counts, setCounts] = useState<Record<CallType, number>>({ audio: 0, video: 0 });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const query = (offset: number) =>
    api.get<CallsResponse>(`/friend-zone/admin/calls?callType=${callType}&status=${statusFilter}&limit=${PAGE_SIZE}&offset=${offset}`);

  useEffect(() => {
    let cancelled = false;
    query(0).then(result => {
      if (cancelled) return;
      setLoading(false);
      if (!result.ok) return;
      setCalls(result.data.calls);
      setTotal(result.data.pagination.total);
      setSummary(result.data.summary);
      setCounts(result.data.counts);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callType, statusFilter]);

  const switchType = (t: CallType) => {
    if (t === callType) return;
    setLoading(true); setExpanded(null);
    setParams({ type: t }, { replace: true });
  };
  const switchStatus = (st: CallStatus | '') => {
    if (st === statusFilter) return;
    setLoading(true); setExpanded(null);
    setStatusFilter(st);
  };

  const loadMore = async () => {
    setLoadingMore(true);
    const result = await query(calls.length);
    setLoadingMore(false);
    if (result.ok) setCalls(prev => [...prev, ...result.data.calls]);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Friend Zone Calls</h1>
        <p className="text-gray-400 text-sm mt-1">Every 1:1 call — who called whom, how long, coins spent on the call and gifts, and gems earned</p>
      </div>

      {/* Audio / Video tabs */}
      <div className="flex gap-2 mb-5">
        {TYPE_TABS.map(tab => {
          const active = tab.key === callType;
          return (
            <button key={tab.key} onClick={() => switchType(tab.key)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                active
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md shadow-purple-200'
                  : 'bg-white text-gray-500 border border-gray-100 hover:border-purple-200'
              }`}>
              {tab.icon}
              {tab.label}
              <span className={`min-w-[24px] px-1.5 h-5 rounded-full text-[11px] font-black flex items-center justify-center ${active ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-500'}`}>
                {fmt(counts[tab.key])}
              </span>
            </button>
          );
        })}
      </div>

      {/* Totals for the current tab + filter */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <StatCard label="Calls" value={fmt(total)} sub={`Total talk time ${formatTotalTime(summary.total_seconds)}`} tone="text-gray-900" />
          <StatCard label="Call Coins" value={fmt(summary.call_coins)} sub="Charged to callers per minute" tone="text-amber-600" />
          <StatCard label="Gift Coins" value={fmt(summary.gift_coins)} sub="Spent on gifts during calls" tone="text-pink-600" />
          <StatCard label="Gems Earned" value={fmt(summary.call_gems + summary.gift_gems)}
            sub={`${fmt(summary.call_gems)} from calls · ${fmt(summary.gift_gems)} from gifts`} tone="text-purple-600" />
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            {STATUS_FILTERS.map(f => (
              <button key={f.key} onClick={() => switchStatus(f.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  statusFilter === f.key ? 'bg-purple-600 text-white' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                }`}>
                {f.label}
              </button>
            ))}
          </div>
          <span className="text-xs text-gray-400 font-medium">Showing {fmt(calls.length)} of {fmt(total)} {total === 1 ? 'call' : 'calls'}</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <svg className="animate-spin w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          </div>
        ) : calls.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm font-semibold text-gray-400">No {callType} calls found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-50">
                  {['Caller', 'Receiver', 'Duration', 'Coins Spent', 'Gems Earned', 'Gifts', 'Status', 'Date & Time'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {calls.map(c => {
                  const isOpen = expanded === c.id;
                  const totalCoins = c.coins_charged + c.gift_coins;
                  const totalGems = c.gems_earned + c.gift_gems;
                  return (
                    <Fragment key={c.id}>
                      <tr className={`align-top transition-colors ${c.gift_count ? 'cursor-pointer' : ''} ${isOpen ? 'bg-purple-50/40' : 'hover:bg-gray-50/60'}`}
                        onClick={() => c.gift_count && setExpanded(isOpen ? null : c.id)}>
                        <td className="px-4 py-4 max-w-[240px]">
                          <Person role="Caller" id={c.caller_id} name={c.caller_name} username={c.caller_username} avatarUrl={c.caller_avatar_url} />
                        </td>
                        <td className="px-4 py-4 max-w-[240px]">
                          <Person role="Receiver" id={c.callee_id} name={c.callee_name} username={c.callee_username} avatarUrl={c.callee_avatar_url} />
                        </td>
                        <td className="px-4 py-4 font-mono text-gray-700 whitespace-nowrap">{formatDuration(c.duration_seconds)}</td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <p className="font-black text-amber-600">🪙 {fmt(totalCoins)}</p>
                          <p className="text-xs text-gray-400 mt-0.5">Call {fmt(c.coins_charged)} · Gifts {fmt(c.gift_coins)}</p>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <p className="font-black text-purple-600">💎 {fmt(totalGems)}</p>
                          <p className="text-xs text-gray-400 mt-0.5">Call {fmt(c.gems_earned)} · Gifts {fmt(c.gift_gems)}</p>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          {c.gift_count ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-pink-600">
                              🎁 {fmt(c.gift_count)}
                              <svg className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </span>
                          ) : <span className="text-xs text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-4"><StatusBadge status={c.status} /></td>
                        <td className="px-4 py-4 text-gray-500 text-xs whitespace-nowrap">{dateTime(c.created_at)}</td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-purple-50/40">
                          <td colSpan={8} className="px-4 pb-4">
                            <div className="bg-white rounded-xl border border-purple-100 divide-y divide-gray-50">
                              {c.gifts.map(g => {
                                const img = resolveImg(g.gift_image_url);
                                const fromCaller = g.sender_id === c.caller_id;
                                return (
                                  <div key={g.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                                    {img ? <img src={img} alt="" className="w-8 h-8 object-contain" /> : <div className="w-8 h-8 rounded-md bg-gray-100" />}
                                    <p className="font-semibold text-gray-800 flex-1">{g.gift_name} <span className="text-gray-400 font-mono text-xs">x{g.quantity}</span></p>
                                    <p className="text-xs text-gray-500 w-44">
                                      {fromCaller ? 'Caller → Receiver' : 'Receiver → Caller'}
                                    </p>
                                    <p className="font-bold text-amber-600 w-24 text-right">🪙 {fmt(g.total_coins)}</p>
                                    <p className="font-bold text-purple-600 w-24 text-right">💎 {fmt(g.gems_earned)}</p>
                                    <p className="text-xs text-gray-400 w-40 text-right">{dateTime(g.created_at)}</p>
                                  </div>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && calls.length < total && (
          <div className="px-6 py-4 border-t border-gray-100 flex justify-center">
            <button onClick={loadMore} disabled={loadingMore}
              className="px-5 py-2 rounded-xl text-sm font-bold text-purple-600 bg-purple-50 hover:bg-purple-100 disabled:opacity-50">
              {loadingMore ? 'Loading…' : `Load more (${fmt(total - calls.length)} left)`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
