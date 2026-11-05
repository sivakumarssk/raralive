import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api/client';

// ── Toast system (same pattern as GoLivePage) ─────────────────────────────────

type ToastType = 'error' | 'success';
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
        <div key={t.id} className={`pointer-events-auto px-4 py-3 rounded-xl shadow-lg text-sm font-medium max-w-sm ${
          t.type === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'
        }`}>{t.message}</div>
      ))}
    </div>,
    document.body
  );
}

// ── Types ──────────────────────────────────────────────────────────────────────

type RequestStatus = 'pending' | 'approved' | 'rejected';

type CoinRequest = {
  id: string;
  request_code: string;
  agency_id: string;
  coins: number;
  status: RequestStatus;
  extra_coins: number;
  admin_note: string | null;
  processed_at: string | null;
  created_at: string;
  agency_name: string;
  agent_code: string;
  agency_phone: string | null;
  requested_by_name: string | null;
  requested_by_username: string | null;
};

type WalletTxn = {
  id: string;
  txn_code: string;
  agency_id: string;
  agency_name: string;
  type: 'official_credit' | 'user_recharge';
  coins: number;
  slab_coins: number;
  extra_coins: number;
  balance_after: number;
  user_id: string | null;
  user_handle: string | null;
  user_name: string | null;
  note: string | null;
  created_at: string;
};

type AgencyWallet = {
  agency: { id: string; agency_name: string; agent_code: string; phone: string | null; status: string };
  balance: number;
  stats: { received: number; used_today: number; transactions: number };
};

// ── Helpers ────────────────────────────────────────────────────────────────────

const fmt = (n: number) => Number(n).toLocaleString('en-IN');
const dateTime = (d: string) => new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

function StatusBadge({ status }: { status: RequestStatus }) {
  const map: Record<RequestStatus, string> = {
    pending: 'bg-amber-50 text-amber-700',
    approved: 'bg-emerald-50 text-emerald-700',
    rejected: 'bg-red-50 text-red-600',
  };
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${map[status]}`}>{status}</span>;
}

function TypeBadge({ type }: { type: WalletTxn['type'] }) {
  return type === 'official_credit'
    ? <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">Official → Agency</span>
    : <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700">Agency → User</span>;
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <svg className="animate-spin w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
      </svg>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <div className="flex items-center justify-center py-16 text-sm font-semibold text-gray-400">{text}</div>;
}

const inputCls = 'w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-purple-300 focus:bg-white transition-all';

// ── Request drawer (approve with extra coins / reject) ────────────────────────

function RequestDrawer({ request, onClose, onUpdated }: {
  request: CoinRequest; onClose: () => void; onUpdated: (r: CoinRequest) => void;
}) {
  const navigate = useNavigate();
  const [extra, setExtra] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const extraCoins = Math.max(0, parseInt(extra, 10) || 0);

  const process = async (status: 'approved' | 'rejected') => {
    if (status === 'rejected' && !note.trim()) { toast('Add a note explaining the rejection.'); return; }
    setSaving(true);
    const result = await api.patch<CoinRequest>(`/agency-wallet/admin/requests/${request.id}`, {
      status, extraCoins: status === 'approved' ? extraCoins : 0, note: note.trim() || undefined,
    });
    setSaving(false);
    if (!result.ok) { toast(result.message); return; }
    onUpdated(result.data);
    toast(status === 'approved'
      ? `${fmt(result.data.coins + result.data.extra_coins)} coins credited to ${result.data.agency_name}.`
      : 'Request rejected.', 'success');
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative ml-auto w-full max-w-xl bg-white h-full flex flex-col shadow-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg font-black text-gray-900">{fmt(request.coins)} Coins</h2>
              <StatusBadge status={request.status} />
            </div>
            <p className="text-xs text-gray-400">{request.request_code}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          <div className="grid grid-cols-2 gap-3">
            <InfoRow label="Agency" value={request.agency_name} />
            <InfoRow label="Agent Code" value={request.agent_code} />
            <InfoRow label="Agency Phone" value={request.agency_phone || '—'} />
            <InfoRow label="Requested By" value={request.requested_by_name || (request.requested_by_username ? `@${request.requested_by_username}` : '—')} />
            <InfoRow label="Requested At" value={dateTime(request.created_at)} />
            {request.processed_at && <InfoRow label="Processed At" value={dateTime(request.processed_at)} />}
            {request.status === 'approved' && <InfoRow label="Extra Coins" value={fmt(request.extra_coins)} />}
            {request.status === 'approved' && <InfoRow label="Total Credited" value={`${fmt(request.coins + request.extra_coins)} Coins`} />}
          </div>
          {request.admin_note && (
            <div className="bg-gray-50 rounded-xl px-4 py-3">
              <p className="text-xs text-gray-400 font-medium">Note</p>
              <p className="text-sm text-gray-800 mt-0.5">{request.admin_note}</p>
            </div>
          )}

          {request.status === 'pending' && (
            <div className="space-y-3 border border-gray-100 rounded-2xl p-4">
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Process Request</p>
              <div>
                <label className="text-xs font-semibold text-gray-500">Extra coins (bonus, optional)</label>
                <input value={extra} onChange={e => setExtra(e.target.value.replace(/[^0-9]/g, ''))} placeholder="0" className={`${inputCls} mt-1`} />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500">Note (required to reject)</label>
                <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="e.g. Paid via UPI ref 1234…" className={`${inputCls} mt-1 resize-none`} />
              </div>
              <div className="flex items-center justify-between text-sm font-bold bg-amber-50 text-amber-800 rounded-xl px-4 py-3">
                <span>Credit to agency wallet</span>
                <span>{fmt(request.coins + extraCoins)} Coins</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => process('rejected')} disabled={saving}
                  className="flex-1 h-10 rounded-xl bg-red-50 text-red-600 text-sm font-bold hover:bg-red-100 disabled:opacity-50">Reject</button>
                <button onClick={() => process('approved')} disabled={saving}
                  className="flex-1 h-10 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-bold disabled:opacity-50">
                  {saving ? 'Saving…' : 'Approve & Credit'}
                </button>
              </div>
            </div>
          )}

          <button onClick={() => navigate(`/agencies/${request.agency_id}/wallet`)}
            className="text-sm font-semibold text-purple-600 hover:underline">Open {request.agency_name}'s wallet →</button>
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

// ── Transaction table (shared) ─────────────────────────────────────────────────

function TxnTable({ txns, showAgency, onSelect }: { txns: WalletTxn[]; showAgency: boolean; onSelect: (t: WalletTxn) => void }) {
  if (!txns.length) return <EmptyRow text="No transactions yet" />;
  const headers = ['Transaction', ...(showAgency ? ['Agency'] : []), 'User', 'Slab', 'Extra', 'Total', 'Balance After', 'Date'];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-50">
            {headers.map(h => <th key={h} className="px-5 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {txns.map(t => {
            const credit = t.type === 'official_credit';
            return (
              <tr key={t.id} className="hover:bg-gray-50/60 cursor-pointer" onClick={() => onSelect(t)}>
                <td className="px-5 py-3">
                  <p className="font-mono text-xs text-gray-700">{t.txn_code}</p>
                  <div className="mt-1"><TypeBadge type={t.type} /></div>
                </td>
                {showAgency && <td className="px-5 py-3 font-semibold text-gray-800">{t.agency_name}</td>}
                <td className="px-5 py-3 text-gray-600">{credit ? '—' : (t.user_handle || t.user_name || '—')}</td>
                <td className="px-5 py-3 text-gray-600">{fmt(t.slab_coins)}</td>
                <td className="px-5 py-3 text-gray-600">{t.extra_coins ? fmt(t.extra_coins) : '—'}</td>
                <td className={`px-5 py-3 font-bold ${credit ? 'text-emerald-600' : 'text-red-600'}`}>{credit ? '+' : '-'}{fmt(t.coins)}</td>
                <td className="px-5 py-3 text-gray-600">{fmt(t.balance_after)}</td>
                <td className="px-5 py-3 text-xs text-gray-400 whitespace-nowrap">{dateTime(t.created_at)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TxnDetailModal({ txn, onClose }: { txn: WalletTxn; onClose: () => void }) {
  const credit = txn.type === 'official_credit';
  const rows: [string, string][] = [
    ['Transaction ID', txn.txn_code],
    ['Type', credit ? 'Official → Agency Coin Credit' : 'Agency → User Recharge'],
    ['Agency', txn.agency_name],
    ...(!credit ? [
      ['User Name', txn.user_name || '—'] as [string, string],
      ['Handle', txn.user_handle || '—'] as [string, string],
      ['UID', txn.user_id || '—'] as [string, string],
    ] : []),
    [credit ? 'Coins' : 'Selected Slab', `${fmt(txn.slab_coins)} Coins`],
    ['Extra Coins', `${fmt(txn.extra_coins)} Coins`],
    [credit ? 'Credited to Agency Wallet' : 'Credited to User / Deducted from Agency', `${fmt(txn.coins)} Coins`],
    ['Agency Wallet Balance After', `${fmt(txn.balance_after)} Coins`],
    ['Date & Time', dateTime(txn.created_at)],
    ...(txn.note ? [['Note', txn.note] as [string, string]] : []),
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6">
        <h2 className="text-lg font-black text-gray-900">Transaction Details</h2>
        <p className="text-xs text-gray-400 mb-4">Complete recharge record</p>
        <div className="divide-y divide-gray-50 bg-gray-50 rounded-xl px-4">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 py-2.5 text-sm">
              <span className="text-gray-400">{k}</span>
              <span className="font-semibold text-gray-800 text-right break-all">{v}</span>
            </div>
          ))}
        </div>
        <button onClick={onClose} className="mt-5 w-full h-10 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-bold">Done</button>
      </div>
    </div>
  );
}

// ── Main page: requests + all recharge history ─────────────────────────────────

const REQUEST_TABS: { key: RequestStatus | ''; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: '', label: 'All' },
];

const TXN_TYPES: { key: WalletTxn['type'] | ''; label: string }[] = [
  { key: '', label: 'All' },
  { key: 'official_credit', label: 'Official → Agency' },
  { key: 'user_recharge', label: 'Agency → User' },
];

export function AgencyWalletPage() {
  const [view, setView] = useState<'requests' | 'history'>('requests');
  const [requests, setRequests] = useState<CoinRequest[]>([]);
  const [requestTotal, setRequestTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<RequestStatus | ''>('pending');
  const [txns, setTxns] = useState<WalletTxn[]>([]);
  const [typeFilter, setTypeFilter] = useState<WalletTxn['type'] | ''>('');
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<CoinRequest | null>(null);
  const [selectedTxn, setSelectedTxn] = useState<WalletTxn | null>(null);

  const loadRequests = async () => {
    setLoading(true);
    const result = await api.get<{ requests: CoinRequest[]; total: number }>(`/agency-wallet/admin/requests?status=${statusFilter}`);
    setLoading(false);
    if (result.ok) { setRequests(result.data.requests); setRequestTotal(result.data.total); }
    else toast(result.message);
  };

  const loadTxns = async () => {
    setLoading(true);
    const result = await api.get<WalletTxn[]>(`/agency-wallet/admin/transactions?type=${typeFilter}`);
    setLoading(false);
    if (result.ok) setTxns(result.data);
    else toast(result.message);
  };

  useEffect(() => { if (view === 'requests') loadRequests(); }, [view, statusFilter]);
  useEffect(() => { if (view === 'history') loadTxns(); }, [view, typeFilter]);

  const handleUpdated = (updated: CoinRequest) => {
    setRequests(prev => statusFilter && updated.status !== statusFilter
      ? prev.filter(r => r.id !== updated.id)
      : prev.map(r => r.id === updated.id ? updated : r));
    setSelectedRequest(null);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <ToastContainer />
      <div className="mb-8">
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Agency Coin Wallet</h1>
        <p className="text-gray-400 text-sm mt-1">Agency coin requests, official credits and agency → user recharge history</p>
      </div>

      <div className="flex gap-2 mb-4">
        {([['requests', 'Coin Requests'], ['history', 'Recharge History']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setView(key)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${view === key ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md shadow-purple-200' : 'bg-white text-gray-500 border border-gray-100 hover:bg-gray-50'}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {view === 'requests'
              ? REQUEST_TABS.map(tab => (
                <button key={tab.key} onClick={() => setStatusFilter(tab.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${statusFilter === tab.key ? 'bg-purple-600 text-white' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>
                  {tab.label}
                </button>
              ))
              : TXN_TYPES.map(tab => (
                <button key={tab.key} onClick={() => setTypeFilter(tab.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${typeFilter === tab.key ? 'bg-purple-600 text-white' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>
                  {tab.label}
                </button>
              ))}
          </div>
          <span className="text-xs text-gray-400 font-medium">
            {view === 'requests' ? `${requestTotal} ${requestTotal === 1 ? 'request' : 'requests'}` : `${txns.length} transactions`}
          </span>
        </div>

        {loading ? <Spinner /> : view === 'requests' ? (
          requests.length === 0 ? <EmptyRow text="No requests found" /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-50">
                    {['Request', 'Agency', 'Coins', 'Status', 'Requested', ''].map((h, i) => (
                      <th key={i} className="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-widest">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {requests.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50/60 cursor-pointer" onClick={() => setSelectedRequest(r)}>
                      <td className="px-6 py-4 font-mono text-xs text-gray-600">{r.request_code}</td>
                      <td className="px-6 py-4">
                        <p className="font-semibold text-gray-800">{r.agency_name}</p>
                        <p className="text-xs text-gray-400">{r.agent_code}{r.agency_phone ? ` · ${r.agency_phone}` : ''}</p>
                      </td>
                      <td className="px-6 py-4 font-bold text-amber-600">
                        {fmt(r.coins)}
                        {r.extra_coins > 0 && <span className="text-xs text-emerald-600 font-semibold"> +{fmt(r.extra_coins)}</span>}
                      </td>
                      <td className="px-6 py-4"><StatusBadge status={r.status} /></td>
                      <td className="px-6 py-4 text-xs text-gray-400">{dateTime(r.created_at)}</td>
                      <td className="px-6 py-4">
                        <button onClick={e => { e.stopPropagation(); setSelectedRequest(r); }} className="text-xs font-semibold text-purple-600 hover:underline">
                          {r.status === 'pending' ? 'Review' : 'View'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <TxnTable txns={txns} showAgency onSelect={setSelectedTxn} />
        )}
      </div>

      {selectedRequest && <RequestDrawer request={selectedRequest} onClose={() => setSelectedRequest(null)} onUpdated={handleUpdated} />}
      {selectedTxn && <TxnDetailModal txn={selectedTxn} onClose={() => setSelectedTxn(null)} />}
    </div>
  );
}

// ── Per-agency wallet page: balance, direct credit, history, requests ─────────

export function AgencyWalletDetailPage() {
  const { agencyId } = useParams<{ agencyId: string }>();
  const navigate = useNavigate();
  const [wallet, setWallet] = useState<AgencyWallet | null>(null);
  const [txns, setTxns] = useState<WalletTxn[]>([]);
  const [requests, setRequests] = useState<CoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [coins, setCoins] = useState('');
  const [extra, setExtra] = useState('');
  const [note, setNote] = useState('');
  const [crediting, setCrediting] = useState(false);
  const [selectedTxn, setSelectedTxn] = useState<WalletTxn | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<CoinRequest | null>(null);

  const load = async () => {
    if (!agencyId) return;
    const [w, t, r] = await Promise.all([
      api.get<AgencyWallet>(`/agency-wallet/admin/agencies/${agencyId}`),
      api.get<WalletTxn[]>(`/agency-wallet/admin/transactions?agencyId=${agencyId}`),
      api.get<{ requests: CoinRequest[] }>(`/agency-wallet/admin/requests?agencyId=${agencyId}`),
    ]);
    if (w.ok) setWallet(w.data); else toast(w.message);
    if (t.ok) setTxns(t.data);
    if (r.ok) setRequests(r.data.requests);
    setLoading(false);
  };

  useEffect(() => { load(); }, [agencyId]);

  const coinsN = parseInt(coins, 10) || 0;
  const extraN = parseInt(extra, 10) || 0;

  const credit = async () => {
    if (coinsN <= 0) { toast('Enter the coins to credit.'); return; }
    if (!window.confirm(`Credit ${fmt(coinsN + extraN)} coins to ${wallet?.agency.agency_name}?`)) return;
    setCrediting(true);
    const result = await api.post<WalletTxn>(`/agency-wallet/admin/agencies/${agencyId}/credit`, {
      coins: coinsN, extraCoins: extraN, note: note.trim() || undefined,
    });
    setCrediting(false);
    if (!result.ok) { toast(result.message); return; }
    toast(`${fmt(result.data.coins)} coins credited.`, 'success');
    setCoins(''); setExtra(''); setNote('');
    load();
  };

  if (loading) return <div className="p-6"><Spinner /></div>;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <ToastContainer />
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/agencies')} className="text-sm text-gray-500 hover:text-gray-800 font-semibold">← Agencies</button>
        <div>
          <h1 className="text-2xl font-black text-gray-900">Agency Coin Wallet</h1>
          {wallet && <p className="text-sm text-gray-400 mt-0.5">{wallet.agency.agency_name} · {wallet.agency.agent_code}</p>}
        </div>
      </div>

      {wallet && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1 rounded-2xl p-5 text-white bg-gradient-to-br from-purple-600 to-pink-600 shadow-md shadow-purple-200">
            <p className="text-xs font-bold tracking-widest opacity-80">AGENCY COINS WALLET</p>
            <p className="text-3xl font-black mt-1">{fmt(wallet.balance)} <span className="text-sm font-semibold opacity-80">Coins</span></p>
            <div className="grid grid-cols-3 gap-2 mt-4">
              {[['Received', wallet.stats.received], ['Used Today', wallet.stats.used_today], ['Transactions', wallet.stats.transactions]].map(([label, v]) => (
                <div key={label as string} className="bg-white/15 rounded-xl px-2 py-2">
                  <p className="text-sm font-black">{fmt(v as number)}</p>
                  <p className="text-[10px] opacity-80">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="md:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
            <p className="text-sm font-black text-gray-900">Credit Coins (Official → Agency)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500">Coins</label>
                <input value={coins} onChange={e => setCoins(e.target.value.replace(/[^0-9]/g, ''))} placeholder="100000" className={`${inputCls} mt-1`} />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500">Extra coins (bonus)</label>
                <input value={extra} onChange={e => setExtra(e.target.value.replace(/[^0-9]/g, ''))} placeholder="0" className={`${inputCls} mt-1`} />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500">Note (optional)</label>
              <input value={note} onChange={e => setNote(e.target.value)} placeholder="Payment reference…" className={`${inputCls} mt-1`} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-amber-700">Total: {fmt(coinsN + extraN)} Coins</span>
              <button onClick={credit} disabled={crediting || coinsN <= 0}
                className="px-5 h-10 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-bold disabled:opacity-50">
                {crediting ? 'Crediting…' : 'Credit Wallet'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100"><p className="text-sm font-black text-gray-900">Coin Requests</p></div>
        {requests.length === 0 ? <EmptyRow text="No coin requests from this agency" /> : (
          <div className="divide-y divide-gray-50">
            {requests.map(r => (
              <button key={r.id} onClick={() => setSelectedRequest(r)} className="w-full flex items-center justify-between px-6 py-3 hover:bg-gray-50/60 text-left">
                <div>
                  <p className="font-bold text-amber-600 text-sm">{fmt(r.coins)} Coins{r.extra_coins > 0 && <span className="text-emerald-600"> +{fmt(r.extra_coins)}</span>}</p>
                  <p className="text-xs text-gray-400">{r.request_code} · {dateTime(r.created_at)}</p>
                </div>
                <StatusBadge status={r.status} />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100"><p className="text-sm font-black text-gray-900">Wallet Ledger & Recharge History</p></div>
        <TxnTable txns={txns} showAgency={false} onSelect={setSelectedTxn} />
      </div>

      {selectedTxn && <TxnDetailModal txn={selectedTxn} onClose={() => setSelectedTxn(null)} />}
      {selectedRequest && (
        <RequestDrawer request={selectedRequest} onClose={() => setSelectedRequest(null)}
          onUpdated={() => { setSelectedRequest(null); load(); }} />
      )}
    </div>
  );
}
