import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { api } from '../../api/client';
import { DropdownMenu } from '../../components/ui/DropdownMenu';

// ── Toast system ───────────────────────────────────────────────────────────────

type ToastType = 'error' | 'success' | 'warning';
type Toast = { id: number; type: ToastType; message: string };

let _toastId = 0;
let _setToasts: React.Dispatch<React.SetStateAction<Toast[]>> | null = null;

export function toast(message: string, type: ToastType = 'error') {
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
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium max-w-sm animate-[slideIn_0.2s_ease-out] ${
          t.type === 'error'   ? 'bg-red-600 text-white' :
          t.type === 'success' ? 'bg-emerald-600 text-white' :
                                 'bg-amber-500 text-white'
        }`}>
          <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {t.type === 'success'
              ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />}
          </svg>
          <span>{t.message}</span>
        </div>
      ))}
    </div>,
    document.body
  );
}

const AGENCY_BASE_URL = `${import.meta.env.VITE_AGENCY_URL ?? 'http://localhost:5174'}/agency`;

// ── Types ──────────────────────────────────────────────────────────────────────

type Agency = {
  id: string;
  agency_name: string;
  person_name: string;
  age: number;
  email: string;
  phone: string;
  address: string;
  aadhar_number: string;
  pan_number: string;
  bank_account: string;
  bank_ifsc: string | null;
  doc_aadhar_url: string | null;
  doc_pan_url: string | null;
  doc_bank_url: string | null;
  agent_code: string;
  plain_password: string;
  status: 'active' | 'suspended' | 'pending';
  created_at: string;
  updated_at?: string;
};

type AgencyRow = Pick<Agency, 'id' | 'agency_name' | 'person_name' | 'age' | 'email' | 'phone' | 'agent_code' | 'status' | 'created_at'>;

type CreatedAgency = Agency & { defaultPassword: string; agentCode: string };

type FormData = {
  agencyName: string; personName: string; age: string; email: string;
  phone: string; address: string; aadharNumber: string; panNumber: string;
  bankAccount: string; bankIfsc: string; bankHolderName: string; bankName: string;
};

const EMPTY_FORM: FormData = {
  agencyName: '', personName: '', age: '', email: '', phone: '',
  address: '', aadharNumber: '', panNumber: '', bankAccount: '', bankIfsc: '',
  bankHolderName: '', bankName: '',
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function agencyLink(code: string) { return `${AGENCY_BASE_URL}/${code}`; }

function formatCopyMessage(a: Agency): string {
  return [
    `🏢 Agency: ${a.agency_name}`,
    // `👤 Person: ${a.person_name}  |  Age: ${a.age}`,
    `📞 Phone: ${a.phone}`,
    `📧 Email: ${a.email}`,
    // `📍 Address: ${a.address}`,
    ``,
    `🔑 Agent Code: ${a.agent_code}`,
    `🔒 Password: ${a.plain_password}`,
    ``,
    `🔗 Agency Link: ${agencyLink(a.agent_code)}`,
    ``,
    // `🏦 Bank Account: ${a.bank_account}${a.bank_ifsc ? `  |  IFSC: ${a.bank_ifsc}` : ''}`,
    // `🪪 Aadhar: ${a.aadhar_number}  |  PAN: ${a.pan_number}`,
  ].join('\n');
}

// ── Shared sub-components ──────────────────────────────────────────────────────

function Field({ label, value, onChange, placeholder, type = 'text', disabled }: {
  label: string; value: string; onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string; type?: string; disabled?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">{label}</p>
      <input
        type={type} value={value} onChange={onChange} placeholder={placeholder} disabled={disabled}
        className={`w-full border rounded-xl px-4 h-11 text-sm text-gray-800 outline-none transition-all
          ${disabled ? 'bg-gray-100 border-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-50 border-gray-200 focus:border-purple-400 focus:bg-white'}`}
      />
    </div>
  );
}

function FilePill({ label, name, file, onChange }: {
  label: string; name: string; file: File | null;
  onChange: (name: string, file: File | null) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">{label}</p>
      <div
        onClick={() => ref.current?.click()}
        className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed cursor-pointer transition-all
          ${file ? 'border-purple-300 bg-purple-50' : 'border-gray-200 bg-gray-50 hover:border-purple-200 hover:bg-purple-50/40'}`}>
        <svg className={`w-5 h-5 shrink-0 ${file ? 'text-purple-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {file
            ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />}
        </svg>
        <p className={`text-sm font-medium truncate flex-1 ${file ? 'text-purple-700' : 'text-gray-400'}`}>
          {file ? file.name : 'Click to upload (PDF, JPG, PNG — max 10 MB)'}
        </p>
        {file && (
          <button type="button" onClick={e => { e.stopPropagation(); onChange(name, null); if (ref.current) ref.current.value = ''; }}
            className="text-gray-400 hover:text-red-500 transition-colors shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      <input ref={ref} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden"
        onChange={e => onChange(name, e.target.files?.[0] || null)} />
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handle = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handle}
      className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-all
        ${copied ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500 hover:bg-purple-50 hover:text-purple-600'}`}>
      {copied
        ? <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Copied</>
        : <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>{label || 'Copy'}</>}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: 'bg-emerald-50 text-emerald-700', suspended: 'bg-red-50 text-red-600', pending: 'bg-amber-50 text-amber-700',
  };
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${map[status] || 'bg-gray-50 text-gray-500'}`}>{status}</span>;
}

// ── Create Drawer ──────────────────────────────────────────────────────────────

function CreateDrawer({ open, onClose, onCreated }: {
  open: boolean; onClose: () => void; onCreated: (a: CreatedAgency) => void;
}) {
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [files, setFiles] = useState<Record<string, File | null>>({ docAadhar: null, docPan: null, docBank: null });
  const [loading, setLoading] = useState(false);

  const set = (f: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [f]: e.target.value }));

  const validate = (): boolean => {
    const required: [keyof FormData, string][] = [
      ['agencyName',     'Agency Name is required'],
      ['personName',     'Person Name is required'],
      ['age',            'Age is required'],
      ['email',          'Email is required'],
      ['phone',          'Phone is required'],
      ['address',        'Address is required'],
      ['aadharNumber',   'Aadhar Number is required'],
      ['panNumber',      'PAN Number is required'],
      ['bankAccount',    'Bank Account Number is required'],
      ['bankHolderName', 'Bank Account Holder Name is required'],
      ['bankName',       'Bank Name is required'],
    ];
    for (const [field, msg] of required) {
      if (!form[field].trim()) { toast(msg); return false; }
    }
    const age = parseInt(form.age, 10);
    if (isNaN(age) || age < 18 || age > 120) {
      toast('Age must be between 18 and 120'); return false;
    }
    if (!files.docAadhar) { toast('Aadhar document is required'); return false; }
    if (!files.docPan)    { toast('PAN document is required');    return false; }
    if (!files.docBank)   { toast('Bank document is required');   return false; }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    if (files.docAadhar) fd.append('docAadhar', files.docAadhar);
    if (files.docPan)    fd.append('docPan',    files.docPan);
    if (files.docBank)   fd.append('docBank',   files.docBank);
    const result = await api.upload<CreatedAgency>('/admin/agencies', fd);
    setLoading(false);
    if (!result.ok) { toast(result.message); return; }
    setForm(EMPTY_FORM);
    setFiles({ docAadhar: null, docPan: null, docBank: null });
    onCreated(result.data);
  };

  useEffect(() => {
    if (!open) { setForm(EMPTY_FORM); setFiles({ docAadhar: null, docPan: null, docBank: null }); }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative ml-auto w-full max-w-2xl bg-white h-full flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-black text-gray-900">Create Agency</h2>
            <p className="text-xs text-gray-400 mt-0.5">Agent code &amp; password are auto-generated</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <form id="create-form" onSubmit={handleSubmit} className="space-y-6">

            <Section title="Agency Details">
              <Field label="Agency Name *" value={form.agencyName} onChange={set('agencyName')} placeholder="Stars Talent Agency" />
              <div className="grid grid-cols-2 gap-4">
                <Field label="Person Name *" value={form.personName} onChange={set('personName')} placeholder="Priya Sharma" />
                <Field label="Age *" value={form.age} onChange={set('age')} placeholder="28" type="number" />
              </div>
              <Field label="Email *" value={form.email} onChange={set('email')} placeholder="agency@example.com" type="email" />
              <Field label="Phone *" value={form.phone} onChange={set('phone')} placeholder="+919876543210" />
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Address *</p>
                <textarea value={form.address} onChange={set('address')} placeholder="123 MG Road, Bengaluru, Karnataka 560001"
                  rows={2} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 outline-none focus:border-purple-400 focus:bg-white transition-all resize-none" />
              </div>
            </Section>

            <Section title="KYC Details">
              <Field label="Aadhar Number *" value={form.aadharNumber} onChange={set('aadharNumber')} placeholder="1234 5678 9012" />
              <Field label="PAN Number *" value={form.panNumber} onChange={set('panNumber')} placeholder="ABCDE1234F" />
            </Section>

            <Section title="Bank Details">
              <Field label="Account Holder Name *" value={form.bankHolderName} onChange={set('bankHolderName')} placeholder="Priya Sharma" />
              <Field label="Bank Name *" value={form.bankName} onChange={set('bankName')} placeholder="State Bank of India" />
              <div className="grid grid-cols-2 gap-4">
                <Field label="Account Number *" value={form.bankAccount} onChange={set('bankAccount')} placeholder="012345678901" />
                <Field label="IFSC Code" value={form.bankIfsc} onChange={set('bankIfsc')} placeholder="SBIN0001234" />
              </div>
            </Section>

            <Section title="Document Uploads (all mandatory)">
              <FilePill label="Aadhar Document *" name="docAadhar" file={files.docAadhar} onChange={(n, f) => setFiles(p => ({ ...p, [n]: f }))} />
              <FilePill label="PAN Document *"    name="docPan"    file={files.docPan}    onChange={(n, f) => setFiles(p => ({ ...p, [n]: f }))} />
              <FilePill label="Bank Passbook / Statement *" name="docBank" file={files.docBank} onChange={(n, f) => setFiles(p => ({ ...p, [n]: f }))} />
            </Section>

          </form>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 h-11 rounded-xl border border-gray-200 text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-all">Cancel</button>
          <button form="create-form" type="submit" disabled={loading}
            className="flex-1 h-11 rounded-xl bg-gradient-to-r from-[#7A0EED] to-[#B50357] text-white font-bold text-sm shadow-md shadow-purple-200 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed">
            {loading ? <Spinner label="Creating…" /> : 'Create Agency'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Agency Detail / Edit Drawer ────────────────────────────────────────────────

function AgencyDrawer({ agency: initial, onClose, onUpdated }: {
  agency: Agency; onClose: () => void; onUpdated: (a: Agency) => void;
}) {
  const [agency, setAgency] = useState<Agency>(initial);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ personName: '', age: '', email: '', phone: '', address: '', bankIfsc: '' });
  const [saving, setSaving] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [copyAll, setCopyAll] = useState(false);
  const [resettingPass, setResettingPass] = useState(false);
  const [resetResult, setResetResult] = useState<{ newDefaultPassword: string } | null>(null);

  // Fetch fresh data on open so plain_password reflects any change made via the agency portal
  useEffect(() => {
    api.get<Agency>(`/admin/agencies/${initial.id}`).then(result => {
      if (result.ok) setAgency(result.data);
    });
  }, [initial.id]);

  const startEdit = () => {
    setEditForm({
      personName: agency.person_name,
      age: String(agency.age),
      email: agency.email,
      phone: agency.phone,
      address: agency.address,
      bankIfsc: agency.bank_ifsc || '',
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    setSaving(true);
    const result = await api.patch<Agency>(`/admin/agencies/${agency.id}`, {
      personName: editForm.personName, age: editForm.age, email: editForm.email,
      phone: editForm.phone, address: editForm.address, bankIfsc: editForm.bankIfsc,
    });
    setSaving(false);
    if (!result.ok) { toast(result.message); return; }
    setAgency(a => ({ ...a, ...result.data }));
    onUpdated({ ...agency, ...result.data });
    setEditing(false);
  };

  const setStatus = async (status: string) => {
    setStatusLoading(true);
    const result = await api.patch<{ status: string }>(`/admin/agencies/${agency.id}/status`, { status });
    setStatusLoading(false);
    if (result.ok) {
      setAgency(a => ({ ...a, status: status as Agency['status'] }));
      onUpdated({ ...agency, status: status as Agency['status'] });
    }
  };

  const handleCopyAll = () => {
    navigator.clipboard.writeText(formatCopyMessage(agency));
    setCopyAll(true);
    setTimeout(() => setCopyAll(false), 2500);
  };

  const handleResetPassword = async () => {
    if (!confirm(`Reset the login password for "${agency.agency_name}"? A new default password will be generated.`)) return;
    setResettingPass(true);
    const result = await api.post<{ agentCode: string; newDefaultPassword: string }>(
      `/admin/agencies/${agency.id}/reset-password`, {}
    );
    setResettingPass(false);
    if (!result.ok) return;
    setResetResult(result.data);
    setAgency(a => ({ ...a, plain_password: result.data.newDefaultPassword }));
    onUpdated({ ...agency, plain_password: result.data.newDefaultPassword });
  };

  const setEdit = (f: keyof typeof editForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setEditForm(p => ({ ...p, [f]: e.target.value }));
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative ml-auto w-full max-w-xl bg-white h-full flex flex-col shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-lg font-black text-gray-900 truncate">{agency.agency_name}</h2>
                <StatusBadge status={agency.status} />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-md">{agency.agent_code}</span>
                <span className="text-xs text-gray-400">·</span>
                <a href={agencyLink(agency.agent_code)} target="_blank" rel="noreferrer"
                  className="text-xs text-purple-500 hover:underline truncate max-w-[220px]">{agencyLink(agency.agent_code)}</a>
              </div>
            </div>
            <button onClick={onClose} className="ml-3 p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          {/* Action bar */}
          <div className="flex items-center gap-2 mt-4 flex-wrap">
            {/* Copy all */}
            <button onClick={handleCopyAll}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition-all
                ${copyAll ? 'bg-emerald-50 text-emerald-600' : 'bg-purple-50 text-purple-600 hover:bg-purple-100'}`}>
              {copyAll
                ? <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Copied!</>
                : <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>Copy All Details</>}
            </button>

            {/* Edit */}
            {!editing && (
              <button onClick={startEdit}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                Edit Details
              </button>
            )}

            {/* Reset password */}
            {!editing && (
              <button onClick={handleResetPassword} disabled={resettingPass}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 transition-all disabled:opacity-50">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                {resettingPass ? 'Resetting…' : 'Reset Password'}
              </button>
            )}

            {/* Status toggle */}
            {!statusLoading ? (
              agency.status === 'active'
                ? <button onClick={() => setStatus('suspended')}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-all">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                    Suspend
                  </button>
                : <button onClick={() => setStatus('active')}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-all">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Activate
                  </button>
            ) : (
              <span className="text-xs text-gray-400 px-3 py-2">Updating…</span>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">

          {/* Credentials block */}
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-4 space-y-3 border border-purple-100">
            <div className="flex items-center justify-between">
              <p className="text-xs font-black text-purple-500 uppercase tracking-widest">Login Credentials</p>
              {resetResult && (
                <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg">Password reset ✓</span>
              )}
            </div>
            <InfoRow label="Phone (Login ID)" value={agency.phone} copyable />
            <InfoRow label="Agent Code" value={agency.agent_code} copyable mono />
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Password</p>
              <div className="flex items-center justify-between bg-white rounded-xl px-4 py-2.5 border border-purple-100">
                <span className={`text-sm font-bold text-gray-800 font-mono tracking-widest ${!showPass ? 'blur-sm select-none' : ''}`}>
                  {agency.plain_password}
                </span>
                <div className="flex items-center gap-2 ml-3 shrink-0">
                  <button onClick={() => setShowPass(v => !v)}
                    className="text-gray-400 hover:text-purple-500 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {showPass
                        ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        : <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></>}
                    </svg>
                  </button>
                  <CopyButton text={agency.plain_password} />
                </div>
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Agency Link</p>
              <div className="flex items-center justify-between bg-white rounded-xl px-4 py-2.5 border border-purple-100 gap-3">
                <a href={agencyLink(agency.agent_code)} target="_blank" rel="noreferrer"
                  className="text-sm text-purple-600 font-medium hover:underline truncate">{agencyLink(agency.agent_code)}</a>
                <CopyButton text={agencyLink(agency.agent_code)} label="Copy link" />
              </div>
            </div>
          </div>

          {/* Editable details */}
          {editing ? (
            <div className="space-y-4">
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Editing Details</p>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Person Name" value={editForm.personName} onChange={setEdit('personName')} />
                <Field label="Age" value={editForm.age} onChange={setEdit('age')} type="number" />
              </div>
              <Field label="Email" value={editForm.email} onChange={setEdit('email')} type="email" />
              <Field label="Phone" value={editForm.phone} onChange={setEdit('phone')} />
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Address</p>
                <textarea value={editForm.address} onChange={setEdit('address')} rows={2}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 outline-none focus:border-purple-400 focus:bg-white transition-all resize-none" />
              </div>
              <Field label="IFSC Code" value={editForm.bankIfsc} onChange={setEdit('bankIfsc')} placeholder="SBIN0001234" />
              <div className="flex gap-3">
                <button onClick={() => setEditing(false)} className="flex-1 h-10 rounded-xl border border-gray-200 text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-all">Cancel</button>
                <button onClick={saveEdit} disabled={saving}
                  className="flex-1 h-10 rounded-xl bg-gradient-to-r from-[#7A0EED] to-[#B50357] text-white font-bold text-sm hover:opacity-90 transition-all disabled:opacity-60">
                  {saving ? <Spinner label="Saving…" /> : 'Save Changes'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Contact Details</p>
              <div className="grid grid-cols-2 gap-3">
                <InfoRow label="Person Name" value={agency.person_name} />
                <InfoRow label="Age" value={String(agency.age)} />
              </div>
              <InfoRow label="Email" value={agency.email} copyable />
              <InfoRow label="Phone" value={agency.phone} copyable />
              <InfoRow label="Address" value={agency.address} />
            </div>
          )}

          {/* KYC — always read-only */}
          {!editing && (
            <div className="space-y-3">
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest">KYC & Banking</p>
              <InfoRow label="Aadhar Number" value={agency.aadhar_number} copyable />
              <InfoRow label="PAN Number" value={agency.pan_number} copyable />
              <InfoRow label="Bank Account" value={agency.bank_account} copyable />
              {agency.bank_ifsc && <InfoRow label="IFSC Code" value={agency.bank_ifsc} copyable />}

              {/* Documents */}
              {(agency.doc_aadhar_url || agency.doc_pan_url || agency.doc_bank_url) && (
                <div className="space-y-2 pt-1">
                  <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Documents</p>
                  {agency.doc_aadhar_url && <DocLink label="Aadhar Document" url={agency.doc_aadhar_url} />}
                  {agency.doc_pan_url && <DocLink label="PAN Document" url={agency.doc_pan_url} />}
                  {agency.doc_bank_url && <DocLink label="Bank Document" url={agency.doc_bank_url} />}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, copyable, mono }: { label: string; value: string; copyable?: boolean; mono?: boolean }) {
  return (
    <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs text-gray-400 font-medium">{label}</p>
        <p className={`text-sm font-semibold text-gray-800 mt-0.5 break-words ${mono ? 'font-mono tracking-widest' : ''}`}>{value || '—'}</p>
      </div>
      {copyable && <CopyButton text={value} />}
    </div>
  );
}

function DocLink({ label, url }: { label: string; url: string }) {
  const fullUrl = url.startsWith('http') ? url : `${import.meta.env.VITE_API_URL ?? 'http://192.168.0.12:5000'}/${url}`;
  return (
    <a href={fullUrl} target="_blank" rel="noreferrer"
      className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 hover:bg-purple-50 transition-colors group">
      <svg className="w-4 h-4 text-gray-400 group-hover:text-purple-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
      <span className="text-sm font-medium text-gray-600 group-hover:text-purple-600 flex-1 truncate">{label}</span>
      <svg className="w-3.5 h-3.5 text-gray-400 group-hover:text-purple-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
    </a>
  );
}

// ── Post-creation credentials modal ───────────────────────────────────────────

function CreatedModal({ agency, onClose }: { agency: CreatedAgency; onClose: () => void }) {
  const [copyAll, setCopyAll] = useState(false);
  const handleCopyAll = () => {
    navigator.clipboard.writeText(formatCopyMessage({ ...agency, plain_password: agency.defaultPassword }));
    setCopyAll(true);
    setTimeout(() => setCopyAll(false), 2500);
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-8">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white shadow-md">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <div>
            <h3 className="text-lg font-black text-gray-900">Agency Created!</h3>
            <p className="text-xs text-gray-400">Credentials are saved — accessible anytime from admin</p>
          </div>
        </div>

        <div className="space-y-3 mb-5">
          <SimpleCredRow label="Agency" value={agency.agency_name} />
          <SimpleCredRow label="Agent Code" value={agency.agentCode} mono />
          <SimpleCredRow label="Password" value={agency.defaultPassword} mono />
          <SimpleCredRow label="Phone (Login ID)" value={agency.phone} />
          <div className="bg-gray-50 rounded-xl px-4 py-3">
            <p className="text-xs text-gray-400 font-medium mb-1">Agency Link</p>
            <a href={agencyLink(agency.agentCode)} target="_blank" rel="noreferrer"
              className="text-sm font-semibold text-purple-600 hover:underline break-all">{agencyLink(agency.agentCode)}</a>
          </div>
        </div>

        <button onClick={handleCopyAll}
          className={`w-full h-11 rounded-xl font-bold text-sm shadow-md transition-all mb-3
            ${copyAll ? 'bg-emerald-500 text-white shadow-emerald-200' : 'bg-gradient-to-r from-[#7A0EED] to-[#B50357] text-white shadow-purple-200 hover:opacity-90'}`}>
          {copyAll ? '✓ Copied to clipboard!' : 'Copy All as Message'}
        </button>
        <button onClick={onClose} className="w-full h-10 rounded-xl border border-gray-200 text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-all">
          Done
        </button>
      </div>
    </div>
  );
}

function SimpleCredRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs text-gray-400 font-medium">{label}</p>
        <p className={`text-sm font-bold text-gray-800 mt-0.5 ${mono ? 'font-mono tracking-widest' : ''}`}>{value}</p>
      </div>
      <CopyButton text={value} />
    </div>
  );
}

// ── Tiny shared components ─────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">{title}</p>
      <div className="grid grid-cols-1 gap-4">{children}</div>
    </div>
  );
}


function Spinner({ label }: { label: string }) {
  return (
    <span className="flex items-center justify-center gap-2">
      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
      </svg>
      {label}
    </span>
  );
}

// ── Agency 3-dot menu ──────────────────────────────────────────────────────────

function AgencyThreeDotMenu({ agencyId, onViewEdit }: { agencyId: string; onViewEdit: () => void }) {
  const navigate = useNavigate();
  return (
    <DropdownMenu items={[
      {
        label: 'View / Edit',
        icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>,
        onClick: onViewEdit,
      },
      {
        label: 'View Rooms',
        icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>,
        onClick: () => navigate(`/agencies/${agencyId}/rooms`),
      },
      {
        label: 'Coin History',
        icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 9v1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
        onClick: () => navigate(`/agencies/${agencyId}/coins`),
      },
    ]} />
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export function AgenciesPage() {
  const [agencies, setAgencies] = useState<AgencyRow[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [created, setCreated] = useState<CreatedAgency | null>(null);
  const [selectedAgency, setSelectedAgency] = useState<Agency | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchAgencies = async (q = search) => {
    setLoading(true);
    const result = await api.get<{ agencies: AgencyRow[]; pagination: { total: number } }>(
      `/admin/agencies?search=${encodeURIComponent(q)}&limit=50`
    );
    setLoading(false);
    if (result.ok) { setAgencies(result.data.agencies); setTotal(result.data.pagination.total); }
  };

  useEffect(() => { fetchAgencies(); }, []);

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    const result = await api.get<Agency>(`/admin/agencies/${id}`);
    setDetailLoading(false);
    if (result.ok) setSelectedAgency(result.data);
  };

  const handleUpdated = (updated: Agency) => {
    setAgencies(prev => prev.map(a => a.id === updated.id ? { ...a, ...updated } : a));
    setSelectedAgency(updated);
  };

  const handleCreated = (agency: CreatedAgency) => {
    setCreateOpen(false);
    setCreated(agency);
    fetchAgencies();
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <ToastContainer />
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Agencies</h1>
          <p className="text-gray-400 text-sm mt-1">Manage talent agencies and their agent credentials</p>
        </div>
        <button onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#7A0EED] to-[#B50357] text-white text-sm font-bold shadow-md shadow-purple-200 hover:opacity-90 active:scale-[0.98] transition-all">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          New Agency
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="relative">
            <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" value={search}
              onChange={e => { setSearch(e.target.value); fetchAgencies(e.target.value); }}
              placeholder="Search agencies…"
              className="pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-100 rounded-lg outline-none focus:border-purple-300 focus:bg-white transition-all w-64" />
          </div>
          <span className="text-xs text-gray-400 font-medium">{total} {total === 1 ? 'agency' : 'agencies'}</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <svg className="animate-spin w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          </div>
        ) : agencies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-purple-50 flex items-center justify-center mb-3">
              <svg className="w-7 h-7 text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-gray-400">No agencies yet</p>
            <p className="text-xs text-gray-300 mt-1">Click "New Agency" to create the first one</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-50">
                  {['Agency', 'Person', 'Phone', 'Agent Code', 'Status', 'Created', ''].map((h, i) => (
                    <th key={i} className="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {agencies.map(a => (
                  <tr key={a.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-gray-800">{a.agency_name}</p>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{a.person_name}</td>
                    <td className="px-6 py-4 text-gray-600">{a.phone}</td>
                    <td className="px-6 py-4">
                      <span className="font-mono font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-md text-xs">{a.agent_code}</span>
                    </td>
                    <td className="px-6 py-4"><StatusBadge status={a.status} /></td>
                    <td className="px-6 py-4 text-gray-400 text-xs">
                      {new Date(a.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-6 py-4">
                      <AgencyThreeDotMenu agencyId={a.id} onViewEdit={() => openDetail(a.id)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {detailLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
          <div className="bg-white rounded-2xl p-6 shadow-xl">
            <svg className="animate-spin w-8 h-8 text-purple-500 mx-auto" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          </div>
        </div>
      )}

      <CreateDrawer open={createOpen} onClose={() => setCreateOpen(false)} onCreated={handleCreated} />
      {created && <CreatedModal agency={created} onClose={() => setCreated(null)} />}
      {selectedAgency && (
        <AgencyDrawer agency={selectedAgency} onClose={() => setSelectedAgency(null)} onUpdated={handleUpdated} />
      )}
    </div>
  );
}
