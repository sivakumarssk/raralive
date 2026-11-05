import { useEffect, useState } from 'react';
import { api } from '../../api/client';

const MEDIA_BASE = import.meta.env.VITE_API_URL ?? 'http://192.168.0.3:5000';

type Tab = 'pocs' | 'documents' | 'support' | 'audit';
type AgencyOption = { id: string; agency_name: string; agent_code: string };
type Poc = { id: string; full_name: string; email: string; is_active: boolean; created_at: string; agencies: AgencyOption[] };
type Doc = { id: string; doc_type: string; file_url: string; status: string; note: string | null; created_at: string; reviewed_at: string | null };
type Ticket = { id: string; subject: string; message: string; status: string; admin_reply: string | null; created_at: string; agency_name: string; agent_code: string };
type AuditRow = { id: string; actor_type: string; actor_name: string | null; action: string; details: unknown; ip: string | null; created_at: string; agency_name: string | null };

const TABS: { key: Tab; label: string }[] = [
  { key: 'pocs', label: 'POCs' },
  { key: 'documents', label: 'Documents' },
  { key: 'support', label: 'Support' },
  { key: 'audit', label: 'Audit log' },
];

const inputClass = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none';
const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

function useAgencies() {
  const [agencies, setAgencies] = useState<AgencyOption[]>([]);
  useEffect(() => {
    api.get<{ agencies: AgencyOption[] }>('/admin/agencies?limit=100').then(r => { if (r.ok) setAgencies(r.data.agencies); });
  }, []);
  return agencies;
}

export function AgencyPortalPage() {
  const [tab, setTab] = useState<Tab>('pocs');
  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Agency Portal</h1>
        <p className="text-sm text-gray-500 mt-1">POC accounts, document review, agency support and the audit log.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${tab === t.key ? 'bg-purple-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'pocs' && <PocsTab />}
      {tab === 'documents' && <DocumentsTab />}
      {tab === 'support' && <SupportTab />}
      {tab === 'audit' && <AuditTab />}
    </div>
  );
}

function PocsTab() {
  const agencies = useAgencies();
  const [pocs, setPocs] = useState<Poc[]>([]);
  const [form, setForm] = useState({ fullName: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => api.get<Poc[]>('/agency-portal/admin/pocs').then(r => { if (r.ok) setPocs(r.data); });
  useEffect(() => { load(); }, []);

  const create = async () => {
    setSaving(true);
    setError('');
    const r = await api.post<Poc>('/agency-portal/admin/pocs', form);
    setSaving(false);
    if (r.ok) { setForm({ fullName: '', email: '', password: '' }); load(); }
    else setError(r.message);
  };

  const update = async (id: string, body: { isActive?: boolean; agencyIds?: string[] }) => {
    const r = await api.patch(`/agency-portal/admin/pocs/${id}`, body);
    if (r.ok) load();
    else setError(r.message);
  };

  const toggleAgency = (poc: Poc, agencyId: string) => {
    const ids = poc.agencies.map(a => a.id);
    update(poc.id, { agencyIds: ids.includes(agencyId) ? ids.filter(x => x !== agencyId) : [...ids, agencyId] });
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
        <h3 className="font-bold text-gray-800">New POC</h3>
        <p className="text-xs text-gray-500">
          POCs sign in at the agency portal's /poc/login. They see assigned agencies only, with no wallet, recharge or admin access.
        </p>
        <div className="grid sm:grid-cols-3 gap-3">
          <input value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} placeholder="Full name" className={inputClass} />
          <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="Email" className={inputClass} />
          <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Password (8+ characters)" className={inputClass} />
        </div>
        {error && <p className="text-sm text-red-500 font-medium">{error}</p>}
        <button onClick={create} disabled={saving} className="px-5 py-2 bg-purple-600 text-white rounded-xl font-semibold text-sm hover:bg-purple-700 disabled:opacity-50">
          {saving ? 'Creating...' : 'Create POC'}
        </button>
      </div>

      {pocs.length === 0 ? (
        <p className="text-center py-10 text-gray-400 bg-white rounded-2xl border border-gray-100">No POCs yet</p>
      ) : pocs.map(poc => (
        <div key={poc.id} className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-5 ${poc.is_active ? '' : 'opacity-60'}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-bold text-gray-900">{poc.full_name}</p>
              <p className="text-xs text-gray-500">{poc.email}</p>
            </div>
            <button
              onClick={() => update(poc.id, { isActive: !poc.is_active })}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${poc.is_active ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
              {poc.is_active ? 'Active' : 'Inactive'}
            </button>
          </div>
          <p className="text-xs font-semibold text-gray-500 mt-3 mb-1.5">Assigned agencies</p>
          <div className="flex flex-wrap gap-1.5">
            {agencies.map(a => {
              const on = poc.agencies.some(x => x.id === a.id);
              return (
                <button
                  key={a.id}
                  onClick={() => toggleAgency(poc, a.id)}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${on ? 'bg-purple-600 border-purple-600 text-white' : 'border-gray-200 text-gray-600'}`}>
                  {a.agency_name}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function DocumentsTab() {
  const agencies = useAgencies();
  const [agencyId, setAgencyId] = useState('');
  const [docs, setDocs] = useState<Doc[]>([]);

  const load = (id: string) => api.get<Doc[]>(`/agency-portal/admin/agencies/${id}/documents`).then(r => { if (r.ok) setDocs(r.data); });
  useEffect(() => { if (agencyId) load(agencyId); else setDocs([]); }, [agencyId]);

  const review = async (doc: Doc, status: 'verified' | 'rejected') => {
    const note = status === 'rejected' ? window.prompt('Reason shown to the agency') : null;
    if (status === 'rejected' && !note) return;
    const r = await api.patch(`/agency-portal/admin/documents/${doc.id}`, { status, note });
    if (r.ok) load(agencyId);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
      <select value={agencyId} onChange={e => setAgencyId(e.target.value)} className={`${inputClass} max-w-sm`}>
        <option value="">Select an agency</option>
        {agencies.map(a => <option key={a.id} value={a.id}>{a.agency_name} ({a.agent_code})</option>)}
      </select>
      {agencyId && docs.length === 0 && <p className="text-sm text-gray-400">No documents</p>}
      {docs.map(d => (
        <div key={d.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-50 pt-3">
          <div>
            <p className="font-semibold text-sm text-gray-900 capitalize">{d.doc_type}</p>
            <p className="text-xs text-gray-500">{d.status}{d.note ? ` · ${d.note}` : ''} · submitted {when(d.created_at)}</p>
          </div>
          <div className="flex gap-2">
            <a href={`${MEDIA_BASE}/${d.file_url}`} target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-50 text-gray-600">View</a>
            <button onClick={() => review(d, 'verified')} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-50 text-green-600">Verify</button>
            <button onClick={() => review(d, 'rejected')} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-500">Reject</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function SupportTab() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [replies, setReplies] = useState<Record<string, string>>({});

  const load = () => api.get<Ticket[]>('/agency-portal/admin/tickets').then(r => { if (r.ok) setTickets(r.data); });
  useEffect(() => { load(); }, []);

  const resolve = async (id: string) => {
    const r = await api.patch(`/agency-portal/admin/tickets/${id}`, { reply: replies[id] });
    if (r.ok) load();
  };

  if (tickets.length === 0) return <p className="text-center py-10 text-gray-400 bg-white rounded-2xl border border-gray-100">No support requests</p>;

  return (
    <div className="space-y-3">
      {tickets.map(t => (
        <div key={t.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex flex-wrap justify-between gap-2">
            <p className="font-bold text-gray-900">{t.subject}</p>
            <span className={`text-xs font-semibold ${t.status === 'open' ? 'text-blue-600' : 'text-green-600'}`}>{t.status}</span>
          </div>
          <p className="text-xs text-gray-500">{t.agency_name} ({t.agent_code}) · {when(t.created_at)}</p>
          <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{t.message}</p>
          {t.admin_reply ? (
            <p className="text-sm text-gray-700 mt-2 bg-purple-50 rounded-lg px-3 py-2 whitespace-pre-wrap">{t.admin_reply}</p>
          ) : (
            <div className="flex gap-2 mt-3">
              <input
                value={replies[t.id] ?? ''}
                onChange={e => setReplies({ ...replies, [t.id]: e.target.value })}
                placeholder="Reply and resolve"
                className={inputClass}
              />
              <button onClick={() => resolve(t.id)} disabled={!replies[t.id]?.trim()} className="px-4 py-2 bg-purple-600 text-white rounded-lg font-semibold text-sm disabled:opacity-50">Send</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function AuditTab() {
  const agencies = useAgencies();
  const [agencyId, setAgencyId] = useState('');
  const [rows, setRows] = useState<AuditRow[]>([]);

  useEffect(() => {
    api.get<AuditRow[]>(`/agency-portal/admin/audit${agencyId ? `?agencyId=${agencyId}` : ''}`).then(r => { if (r.ok) setRows(r.data); });
  }, [agencyId]);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
      <select value={agencyId} onChange={e => setAgencyId(e.target.value)} className={`${inputClass} max-w-sm`}>
        <option value="">All agencies</option>
        {agencies.map(a => <option key={a.id} value={a.id}>{a.agency_name}</option>)}
      </select>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
              <th className="pb-2 pr-4">When</th><th className="pb-2 pr-4">Who</th><th className="pb-2 pr-4">Agency</th>
              <th className="pb-2 pr-4">Action</th><th className="pb-2 pr-4">Details</th><th className="pb-2">IP</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-b border-gray-50 align-top">
                <td className="py-2 pr-4 whitespace-nowrap">{when(r.created_at)}</td>
                <td className="py-2 pr-4 whitespace-nowrap">{r.actor_type}{r.actor_name ? ` · ${r.actor_name}` : ''}</td>
                <td className="py-2 pr-4 whitespace-nowrap">{r.agency_name ?? '—'}</td>
                <td className="py-2 pr-4 whitespace-nowrap font-semibold">{r.action.replace(/_/g, ' ')}</td>
                <td className="py-2 pr-4 text-xs text-gray-500 max-w-xs truncate">{r.details ? JSON.stringify(r.details) : '—'}</td>
                <td className="py-2 text-xs text-gray-500">{r.ip ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="text-sm text-gray-400 text-center py-6">Nothing logged yet</p>}
      </div>
    </div>
  );
}
