import { useEffect, useState } from 'react';
import { api } from '../../api/client';

// ── Types ──────────────────────────────────────────────────────────────────────

type CallStatus = 'ringing' | 'accepted' | 'rejected' | 'missed' | 'ended' | 'failed';
type CallType = 'audio' | 'video';

type Call = {
  id: string;
  channel_name: string;
  call_type: CallType;
  status: CallStatus;
  duration_seconds: number;
  coins_charged: number;
  gems_earned: number;
  end_reason: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  caller_id: string;
  caller_name: string | null;
  caller_username: string | null;
  caller_avatar_url: string | null;
  callee_id: string;
  callee_name: string | null;
  callee_username: string | null;
  callee_avatar_url: string | null;
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function personLabel(name: string | null, username: string | null): string {
  return name || username || 'Unknown';
}

// ── Badges ─────────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: CallStatus }) {
  const map: Record<CallStatus, string> = {
    ringing: 'bg-amber-50 text-amber-700',
    accepted: 'bg-blue-50 text-blue-700',
    ended: 'bg-emerald-50 text-emerald-700',
    rejected: 'bg-red-50 text-red-600',
    missed: 'bg-gray-100 text-gray-500',
    failed: 'bg-red-50 text-red-600',
  };
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${map[status]}`}>{status}</span>;
}

function TypeBadge({ callType }: { callType: CallType }) {
  const map: Record<CallType, string> = {
    audio: 'bg-purple-50 text-purple-700',
    video: 'bg-indigo-50 text-indigo-700',
  };
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${map[callType]}`}>{callType}</span>;
}

// ── Main page ──────────────────────────────────────────────────────────────────

const STATUS_TABS: { key: CallStatus | ''; label: string }[] = [
  { key: '', label: 'All' },
  { key: 'ended', label: 'Ended' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'missed', label: 'Missed' },
  { key: 'failed', label: 'Failed' },
];

export function FriendZoneCallsPage() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<CallStatus | ''>('');
  const [loading, setLoading] = useState(true);

  const fetchCalls = async (status = statusFilter) => {
    setLoading(true);
    const result = await api.get<{ calls: Call[]; pagination: { total: number } }>(
      `/friend-zone/admin/calls?status=${status}&limit=50`
    );
    setLoading(false);
    if (result.ok) { setCalls(result.data.calls); setTotal(result.data.pagination.total); }
  };

  useEffect(() => { fetchCalls(); }, [statusFilter]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Friend Zone Calls</h1>
        <p className="text-gray-400 text-sm mt-1">All 1:1 audio/video calls — who called whom, duration, and coins/gems moved</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {STATUS_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  statusFilter === tab.key ? 'bg-purple-600 text-white' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                }`}>
                {tab.label}
              </button>
            ))}
          </div>
          <span className="text-xs text-gray-400 font-medium">{total} {total === 1 ? 'call' : 'calls'}</span>
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
            <p className="text-sm font-semibold text-gray-400">No calls found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-50">
                  {['Caller', 'Callee', 'Type', 'Duration', 'Coins Charged', 'Gems Earned', 'Status', 'Date'].map((h, i) => (
                    <th key={i} className="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {calls.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-gray-800">{personLabel(c.caller_name, c.caller_username)}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-semibold text-gray-800">{personLabel(c.callee_name, c.callee_username)}</p>
                    </td>
                    <td className="px-6 py-4"><TypeBadge callType={c.call_type} /></td>
                    <td className="px-6 py-4 text-gray-600 font-mono text-xs">{formatDuration(c.duration_seconds)}</td>
                    <td className="px-6 py-4 text-gray-700 font-semibold">{c.coins_charged}</td>
                    <td className="px-6 py-4 text-gray-700 font-semibold">{c.gems_earned}</td>
                    <td className="px-6 py-4"><StatusBadge status={c.status} /></td>
                    <td className="px-6 py-4 text-gray-400 text-xs">
                      {new Date(c.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
