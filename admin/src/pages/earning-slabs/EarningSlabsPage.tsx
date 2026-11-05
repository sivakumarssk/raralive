import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../api/client';

// Earning settings per service: gem value (gems per received coin) and the
// monthly slabs. Each slab has its own bonus; total = payout + bonus.
// Every change (gem value, add/edit/delete slab) is saved straight away.

type Source = 'chatroom' | 'live' | 'private' | 'friendzone' | 'views';

const SOURCES: { key: Source; label: string; emoji: string }[] = [
  { key: 'chatroom', label: 'Audio Chat Rooms', emoji: '🎙️' },
  { key: 'live', label: 'Video Live', emoji: '📹' },
  { key: 'private', label: 'Private Video Live', emoji: '🔒' },
  { key: 'friendzone', label: 'Friend Zone', emoji: '💞' },
  { key: 'views', label: 'Video Views', emoji: '👀' },
];

type Slab = { name: string; gems: number; payout: number; bonus: number; total: number };

type Config = { effective_month: string; gems_per_coin: number; slabs: Slab[] };

type AdminConfig = {
  month: string;
  sources: Record<Source, { current: Config | null; history: { effective_month: string; updated_at: string }[] }>;
};

type SlabForm = { name: string; gems: string; payout: string; bonus: string };

const inr = (n: number) => `₹${(Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const num = (n: number) => (Number(n) || 0).toLocaleString('en-IN');

// ── Toast ──────────────────────────────────────────────────────────────────────

type Toast = { id: number; type: 'error' | 'success'; message: string };
let _toastId = 0;
let _setToasts: React.Dispatch<React.SetStateAction<Toast[]>> | null = null;
function toast(message: string, type: Toast['type'] = 'success') {
  if (!_setToasts) return;
  const id = ++_toastId;
  _setToasts(prev => [...prev, { id, type, message }]);
  setTimeout(() => _setToasts?.(prev => prev.filter(t => t.id !== id)), 3500);
}
function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(() => { _setToasts = setToasts; return () => { _setToasts = null; }; }, []);
  if (!toasts.length) return null;
  return createPortal(
    <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`px-4 py-3 rounded-xl shadow-lg text-sm font-medium max-w-sm text-white ${t.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'}`}>
          {t.message}
        </div>
      ))}
    </div>,
    document.body,
  );
}

// ── Add / edit slab popup ──────────────────────────────────────────────────────

function FieldError({ show, msg }: { show: boolean; msg: string }) {
  return show && msg ? <p className="text-xs text-red-500 mt-1">{msg}</p> : null;
}

function SlabModal({ initial, title, existing, saving, onClose, onSave }: {
  initial: SlabForm;
  title: string;
  /** Other slabs' gem targets — a new/edited slab can't reuse one. */
  existing: number[];
  saving: boolean;
  onClose: () => void;
  onSave: (form: SlabForm) => void;
}) {
  const [form, setForm] = useState<SlabForm>(initial);
  const [touched, setTouched] = useState(false);
  const set = (k: keyof SlabForm, v: string) => setForm(f => ({ ...f, [k]: v }));

  const errors = {
    name: !form.name.trim() ? 'Enter a slab name' : '',
    gems: !(Number(form.gems) > 0) ? 'Enter gems above 0'
      : existing.includes(Number(form.gems)) ? 'Another slab already uses this gems target' : '',
    payout: form.payout === '' || !(Number(form.payout) >= 0) ? 'Enter a payout (0 or more)' : '',
    bonus: form.bonus !== '' && !(Number(form.bonus) >= 0) ? 'Bonus must be 0 or more' : '',
  };
  const valid = !Object.values(errors).some(Boolean);
  const total = (Number(form.payout) || 0) + (Number(form.bonus) || 0);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (valid) onSave(form);
  };

  const fieldCls = (bad: string) =>
    `w-full px-3 py-2.5 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
      touched && bad ? 'border-red-300 bg-red-50' : 'border-gray-200'
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !saving && onClose()} />
      <form onSubmit={submit} className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-gray-900">{title}</h2>
          <button type="button" onClick={onClose} disabled={saving} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div>
          <label className="text-xs font-bold text-gray-500">Slab name</label>
          <input autoFocus value={form.name} onChange={e => set('name', e.target.value)} placeholder="Slab 1" className={`${fieldCls(errors.name)} mt-1`} />
          <FieldError show={touched} msg={errors.name} />
        </div>
        <div>
          <label className="text-xs font-bold text-gray-500">Gems to reach</label>
          <input type="number" min="1" value={form.gems} onChange={e => set('gems', e.target.value)} placeholder="100000" className={`${fieldCls(errors.gems)} mt-1`} />
          <FieldError show={touched} msg={errors.gems} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-gray-500">Payout (₹)</label>
            <input type="number" min="0" step="any" value={form.payout} onChange={e => set('payout', e.target.value)} placeholder="300" className={`${fieldCls(errors.payout)} mt-1`} />
            <FieldError show={touched} msg={errors.payout} />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500">Bonus (₹)</label>
            <input type="number" min="0" step="any" value={form.bonus} onChange={e => set('bonus', e.target.value)} placeholder="0" className={`${fieldCls(errors.bonus)} mt-1`} />
            <FieldError show={touched} msg={errors.bonus} />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-3">
          <span className="text-sm font-semibold text-emerald-800">Total</span>
          <span className="text-lg font-black text-emerald-700">{inr(total)}</span>
        </div>

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} disabled={saving}
            className="flex-1 h-11 rounded-xl text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 disabled:opacity-50">Cancel</button>
          <button type="submit" disabled={saving}
            className="flex-1 h-11 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export function EarningSlabsPage() {
  const [data, setData] = useState<AdminConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<Source>('chatroom');
  const [gemValue, setGemValue] = useState('');
  const [saving, setSaving] = useState(false);
  // null = closed; index -1 = adding a new slab
  const [editing, setEditing] = useState<{ index: number; form: SlabForm } | null>(null);

  const load = () => api.get<AdminConfig>('/tasks/admin/earning-config')
    .then(r => { if (r.ok) setData(r.data); else toast(r.message, 'error'); })
    .finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const current = data?.sources[source]?.current ?? null;
  const slabs = current?.slabs ?? [];
  const savedGemValue = current ? String(current.gems_per_coin) : '';

  // Reset the gem value field whenever the service or saved settings change
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setGemValue(savedGemValue); }, [source, savedGemValue]);

  /** Saves the whole config for this service (gem value + slabs) in one request. */
  const persist = async (gemsPerCoin: number, nextSlabs: Omit<Slab, 'total'>[], message: string) => {
    if (!(gemsPerCoin > 0)) { toast('Set the gem value first.', 'error'); return false; }
    setSaving(true);
    const r = await api.put<Config>(`/tasks/admin/earning-config/${source}`, {
      gems_per_coin: gemsPerCoin,
      slabs: nextSlabs.map(s => ({ name: s.name, gems: s.gems, payout: s.payout, bonus: s.bonus })),
    });
    setSaving(false);
    if (!r.ok) { toast(r.message, 'error'); return false; }
    toast(message);
    await load();
    return true;
  };

  const saveGemValue = () => persist(Number(gemValue), slabs, 'Gem value saved.');

  const saveSlab = async (form: SlabForm) => {
    if (!editing) return;
    const slab = { name: form.name.trim(), gems: Number(form.gems), payout: Number(form.payout), bonus: Number(form.bonus) || 0 };
    const next = editing.index === -1
      ? [...slabs, slab]
      : slabs.map((s, i) => (i === editing.index ? slab : s));
    const gems = Number(savedGemValue || gemValue);
    if (await persist(gems, next, editing.index === -1 ? `“${slab.name}” added.` : `“${slab.name}” updated.`)) setEditing(null);
  };

  const deleteSlab = async (index: number) => {
    const slab = slabs[index];
    if (!window.confirm(`Delete “${slab.name}”?`)) return;
    await persist(Number(savedGemValue), slabs.filter((_, i) => i !== index), `“${slab.name}” deleted.`);
  };

  const openAdd = () => {
    if (!(Number(savedGemValue || gemValue) > 0)) { toast('Set and save the gem value first.', 'error'); return; }
    const last = slabs[slabs.length - 1];
    setEditing({ index: -1, form: { name: `Slab ${slabs.length + 1}`, gems: last ? String(last.gems * 2) : '', payout: '', bonus: '0' } });
  };

  const gemDirty = gemValue !== savedGemValue;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <ToastContainer />
      <h1 className="text-2xl font-black text-gray-900 tracking-tight mb-6">Earning Slabs</h1>

      {/* Service picker */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {SOURCES.map(s => {
          const active = s.key === source;
          const cfg = data?.sources[s.key]?.current;
          return (
            <button key={s.key} onClick={() => setSource(s.key)}
              className={`text-left px-4 py-3 rounded-2xl border transition-all ${
                active
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 border-transparent text-white shadow-md shadow-purple-200'
                  : 'bg-white border-gray-100 hover:border-purple-200'
              }`}>
              <p className="text-lg leading-none">{s.emoji}</p>
              <p className={`text-sm font-bold mt-2 ${active ? 'text-white' : 'text-gray-800'}`}>{s.label}</p>
              <p className={`text-xs mt-0.5 font-semibold ${active ? 'text-white/80' : cfg ? 'text-emerald-600' : 'text-amber-600'}`}>
                {cfg ? `${cfg.slabs.length} ${cfg.slabs.length === 1 ? 'slab' : 'slabs'}` : 'Not set up'}
              </p>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading…</div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          {/* Gem value + add */}
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-gray-700">Gem value:</span>
              <span className="text-sm text-gray-500">1 Coin =</span>
              <input type="number" min="0" step="any" value={gemValue} onChange={e => setGemValue(e.target.value)}
                placeholder="5"
                className="w-24 px-3 py-2 border border-gray-200 rounded-lg text-sm font-bold text-center outline-none focus:ring-2 focus:ring-purple-500" />
              <span className="text-sm text-gray-500">Gems</span>
              {gemDirty && (
                <>
                  <button onClick={saveGemValue} disabled={saving}
                    className="ml-1 px-3 py-2 rounded-lg text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50">
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  <button onClick={() => setGemValue(savedGemValue)} disabled={saving}
                    className="px-3 py-2 rounded-lg text-xs font-bold text-gray-500 hover:bg-gray-100">Cancel</button>
                </>
              )}
            </div>
            <button onClick={openAdd} disabled={saving}
              className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 shadow-sm disabled:opacity-50">
              + Add slab
            </button>
          </div>

          {/* Slab list */}
          {slabs.length === 0 ? (
            <div className="py-14 text-center text-sm font-semibold text-gray-400">No slabs yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-50 text-left text-xs font-bold text-gray-400 uppercase tracking-widest">
                    <th className="px-6 py-3 w-16">Level</th>
                    <th className="px-6 py-3">Slab name</th>
                    <th className="px-6 py-3">Gems to reach</th>
                    <th className="px-6 py-3">Payout</th>
                    <th className="px-6 py-3">Bonus</th>
                    <th className="px-6 py-3">Total</th>
                    <th className="px-6 py-3 w-32" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {slabs.map((s, i) => (
                    <tr key={`${s.name}-${s.gems}`} className="hover:bg-gray-50/60">
                      <td className="px-6 py-3.5">
                        <span className="w-7 h-7 rounded-full bg-purple-50 text-purple-700 text-xs font-black flex items-center justify-center">{i + 1}</span>
                      </td>
                      <td className="px-6 py-3.5 font-semibold text-gray-800">{s.name}</td>
                      <td className="px-6 py-3.5 text-gray-700">💎 {num(s.gems)}</td>
                      <td className="px-6 py-3.5 text-gray-700">{inr(s.payout)}</td>
                      <td className="px-6 py-3.5 text-gray-700">{inr(s.bonus)}</td>
                      <td className="px-6 py-3.5 font-black text-emerald-600">{inr(s.total)}</td>
                      <td className="px-6 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <button disabled={saving}
                            onClick={() => setEditing({ index: i, form: { name: s.name, gems: String(s.gems), payout: String(s.payout), bonus: String(s.bonus) } })}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold text-purple-600 hover:bg-purple-50 disabled:opacity-50">Edit</button>
                          <button disabled={saving} onClick={() => deleteSlab(i)}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold text-red-500 hover:bg-red-50 disabled:opacity-50">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {editing && (
        <SlabModal
          key={editing.index}
          title={editing.index === -1 ? 'Add slab' : 'Edit slab'}
          initial={editing.form}
          existing={slabs.filter((_, i) => i !== editing.index).map(s => s.gems)}
          saving={saving}
          onClose={() => setEditing(null)}
          onSave={saveSlab}
        />
      )}
    </div>
  );
}
