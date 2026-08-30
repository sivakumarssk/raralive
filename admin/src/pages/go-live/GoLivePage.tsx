import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../api/client';

// ── Toast system (same pattern as FriendZonePage) ─────────────────────────────

type ToastType = 'error' | 'success' | 'warning';
type Toast = { id: number; type: ToastType; message: string };

let _toastId = 0;
let _setToasts: React.Dispatch<React.SetStateAction<Toast[]>> | null = null;

function toast(message: string, type: ToastType = 'error') {
  if (!_setToasts) return;
  const id = ++_toastId;
  _setToasts(prev => [...prev, { id, type, message }]);
  setTimeout(() => _setToasts!(prev => prev.filter(t => t.id !== id)), 4000);
}

function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(() => { _setToasts = setToasts; return () => { _setToasts = null; }; }, []);

  if (!toasts.length) return null;
  return createPortal(
    <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium max-w-sm ${
          t.type === 'error'   ? 'bg-red-600 text-white' :
          t.type === 'success' ? 'bg-emerald-600 text-white' :
                                 'bg-amber-500 text-white'
        }`}>
          <span>{t.message}</span>
        </div>
      ))}
    </div>,
    document.body
  );
}

// ── Types ──────────────────────────────────────────────────────────────────────

type GoLiveStatus = 'pending' | 'approved' | 'rejected';

type GoLiveRequest = {
  id: string;
  user_id: string;
  full_name: string;
  date_of_birth: string;
  language: string;
  status: GoLiveStatus;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  user_full_name: string | null;
  user_username: string | null;
  user_avatar_url: string | null;
  user_phone: string;
};

const LANGUAGE_LABELS: Record<string, string> = {
  en: 'English', hi: 'Hindi', mr: 'Marathi', te: 'Telugu',
  ta: 'Tamil', bn: 'Bengali', kn: 'Kannada', ml: 'Malayalam',
};

function ageFromDob(dob: string) {
  const d = new Date(dob);
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
}

// ── Status badge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: GoLiveStatus }) {
  const map: Record<GoLiveStatus, string> = {
    pending: 'bg-amber-50 text-amber-700',
    approved: 'bg-emerald-50 text-emerald-700',
    rejected: 'bg-red-50 text-red-600',
  };
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${map[status]}`}>{status}</span>;
}

// ── Detail drawer ──────────────────────────────────────────────────────────────

function RequestDrawer({ request: initial, onClose, onUpdated }: {
  request: GoLiveRequest; onClose: () => void; onUpdated: (r: GoLiveRequest) => void;
}) {
  const [request, setRequest] = useState<GoLiveRequest>(initial);
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<GoLiveRequest>(`/go-live/admin/${initial.id}`).then(result => {
      if (result.ok) setRequest(result.data);
    });
  }, [initial.id]);

  const handleApprove = async () => {
    setSaving(true);
    const result = await api.patch<GoLiveRequest>(`/go-live/admin/${request.id}/status`, { status: 'approved' });
    setSaving(false);
    if (!result.ok) { toast(result.message); return; }
    setRequest(result.data);
    onUpdated(result.data);
    toast('Request approved.', 'success');
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) { toast('A rejection reason is required.'); return; }
    setSaving(true);
    const result = await api.patch<GoLiveRequest>(`/go-live/admin/${request.id}/status`, {
      status: 'rejected', rejectionReason: rejectionReason.trim(),
    });
    setSaving(false);
    if (!result.ok) { toast(result.message); return; }
    setRequest(result.data);
    onUpdated(result.data);
    setRejectMode(false);
    setRejectionReason('');
    toast('Request rejected.', 'success');
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative ml-auto w-full max-w-xl bg-white h-full flex flex-col shadow-2xl overflow-hidden">

        <div className="px-6 py-5 border-b border-gray-100">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-lg font-black text-gray-900 truncate">{request.full_name}</h2>
                <StatusBadge status={request.status} />
              </div>
              <p className="text-xs text-gray-400">
                Account: {request.user_full_name || request.user_username || 'Unknown'} · {request.user_phone}
              </p>
            </div>
            <button onClick={onClose} className="ml-3 p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          {request.status === 'pending' && !rejectMode && (
            <div className="flex items-center gap-2 mt-4">
              <button onClick={handleApprove} disabled={saving}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-all disabled:opacity-50">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Approve
              </button>
              <button onClick={() => setRejectMode(true)} disabled={saving}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-all disabled:opacity-50">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                Reject
              </button>
            </div>
          )}

          {rejectMode && (
            <div className="mt-4 space-y-2">
              <textarea
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                placeholder="Reason for rejection (shown to the user)…"
                rows={3}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 outline-none focus:border-red-300 focus:bg-white transition-all resize-none"
              />
              <div className="flex gap-2">
                <button onClick={() => { setRejectMode(false); setRejectionReason(''); }}
                  className="flex-1 h-9 rounded-lg border border-gray-200 text-xs font-semibold text-gray-500 hover:bg-gray-50 transition-all">Cancel</button>
                <button onClick={handleReject} disabled={saving}
                  className="flex-1 h-9 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition-all disabled:opacity-60">
                  {saving ? 'Rejecting…' : 'Confirm Reject'}
                </button>
              </div>
            </div>
          )}

          {request.status === 'rejected' && request.rejection_reason && (
            <div className="mt-4 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              <p className="text-xs font-bold text-red-500 uppercase tracking-widest mb-1">Rejection Reason</p>
              <p className="text-sm text-red-700">{request.rejection_reason}</p>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          <div className="space-y-3">
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Request Details</p>
            <div className="grid grid-cols-2 gap-3">
              <InfoRow label="Age" value={String(ageFromDob(request.date_of_birth))} />
              <InfoRow label="Date of Birth" value={new Date(request.date_of_birth).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} />
              <InfoRow label="Language" value={LANGUAGE_LABELS[request.language] || request.language} />
            </div>
          </div>

          <div>
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Submitted</p>
            <p className="text-sm text-gray-600">
              {new Date(request.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-xl px-4 py-3">
      <p className="text-xs text-gray-400 font-medium">{label}</p>
      <p className="text-sm font-semibold text-gray-800 mt-0.5 break-words">{value}</p>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

const TABS: { key: GoLiveStatus | ''; label: string }[] = [
  { key: '', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

export function GoLivePage() {
  const [requests, setRequests] = useState<GoLiveRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<GoLiveStatus | ''>('pending');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<GoLiveRequest | null>(null);

  const fetchRequests = async (status = statusFilter) => {
    setLoading(true);
    const result = await api.get<{ requests: GoLiveRequest[]; pagination: { total: number } }>(
      `/go-live/admin?status=${status}&limit=50`
    );
    setLoading(false);
    if (result.ok) { setRequests(result.data.requests); setTotal(result.data.pagination.total); }
  };

  useEffect(() => { fetchRequests(); }, [statusFilter]);

  const handleUpdated = (updated: GoLiveRequest) => {
    setRequests(prev => {
      if (statusFilter && updated.status !== statusFilter) {
        return prev.filter(r => r.id !== updated.id);
      }
      return prev.map(r => r.id === updated.id ? updated : r);
    });
    setSelected(updated);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <ToastContainer />
      <div className="mb-8">
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Go Live Requests</h1>
        <p className="text-gray-400 text-sm mt-1">Review and approve user requests to broadcast live</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {TABS.map(tab => (
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
          <span className="text-xs text-gray-400 font-medium">{total} {total === 1 ? 'request' : 'requests'}</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <svg className="animate-spin w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          </div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm font-semibold text-gray-400">No requests found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-50">
                  {['Applicant', 'Language', 'Status', 'Submitted', ''].map((h, i) => (
                    <th key={i} className="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {requests.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50/60 transition-colors cursor-pointer" onClick={() => setSelected(r)}>
                    <td className="px-6 py-4">
                      <p className="font-semibold text-gray-800">{r.full_name}</p>
                      <p className="text-xs text-gray-400">{ageFromDob(r.date_of_birth)}y</p>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{LANGUAGE_LABELS[r.language] || r.language}</td>
                    <td className="px-6 py-4"><StatusBadge status={r.status} /></td>
                    <td className="px-6 py-4 text-gray-400 text-xs">
                      {new Date(r.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-6 py-4">
                      <button onClick={e => { e.stopPropagation(); setSelected(r); }}
                        className="text-xs font-semibold text-purple-600 hover:underline">View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <RequestDrawer request={selected} onClose={() => setSelected(null)} onUpdated={handleUpdated} />
      )}
    </div>
  );
}
