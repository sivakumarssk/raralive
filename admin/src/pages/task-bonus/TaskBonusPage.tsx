import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../api/client';

// Daily Task "Bonus Payment" slabs — an extra bonus for Audio Chat Rooms,
// separate from the Earning Slabs' own payout + bonus. Only two things are
// editable: each slab's gem target and its bonus amount (₹). When someone's
// Audio Chat gems for the month cross a target, that amount is credited to
// their Earnings wallet as "Extra Bonus". Every change is saved straight away
// and shows in the app's Daily Task → Bonus Payment tab automatically.

type Slab = { gems: number; amount: number };
type BonusConfig = { month: string; slabs: Slab[] };
type SlabForm = { gems: string; amount: string };

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

  const gems = Number(form.gems);
  const errors = {
    gems: !(Number.isInteger(gems) && gems > 0) ? 'Enter a whole number of gems above 0'
      : existing.includes(gems) ? 'Another slab already uses this gem target' : '',
    amount: form.amount === '' || !(Number(form.amount) >= 0) ? 'Enter a bonus amount (0 or more)' : '',
  };
  const valid = !errors.gems && !errors.amount;

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
          <label className="text-xs font-bold text-gray-500">Slab (gems to reach)</label>
          <input autoFocus type="number" min="1" step="1" value={form.gems} onChange={e => set('gems', e.target.value)}
            placeholder="50000" className={`${fieldCls(errors.gems)} mt-1`} />
          {touched && errors.gems && <p className="text-xs text-red-500 mt-1">{errors.gems}</p>}
        </div>
        <div>
          <label className="text-xs font-bold text-gray-500">Bonus amount (₹)</label>
          <input type="number" min="0" step="any" value={form.amount} onChange={e => set('amount', e.target.value)}
            placeholder="100" className={`${fieldCls(errors.amount)} mt-1`} />
          {touched && errors.amount && <p className="text-xs text-red-500 mt-1">{errors.amount}</p>}
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

export function TaskBonusPage() {
  const [slabs, setSlabs] = useState<Slab[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // null = closed; index -1 = adding a new slab
  const [editing, setEditing] = useState<{ index: number; form: SlabForm } | null>(null);

  const load = () => api.get<BonusConfig>('/tasks/admin/task-bonus')
    .then(r => { if (r.ok) setSlabs(r.data.slabs); else toast(r.message, 'error'); })
    .finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  /** Saves the whole slab list in one request. */
  const persist = async (next: Slab[], message: string) => {
    setSaving(true);
    const r = await api.put<BonusConfig>('/tasks/admin/task-bonus', {
      slabs: next.map(s => ({ gems: s.gems, amount: s.amount })),
    });
    setSaving(false);
    if (!r.ok) { toast(r.message, 'error'); return false; }
    setSlabs(r.data.slabs);
    toast(message);
    return true;
  };

  const saveSlab = async (form: SlabForm) => {
    if (!editing) return;
    const slab = { gems: Number(form.gems), amount: Number(form.amount) };
    const next = editing.index === -1
      ? [...slabs, slab]
      : slabs.map((s, i) => (i === editing.index ? slab : s));
    if (await persist(next, editing.index === -1 ? 'Slab added.' : 'Slab updated.')) setEditing(null);
  };

  const deleteSlab = async (index: number) => {
    const slab = slabs[index];
    if (!window.confirm(`Delete the ${num(slab.gems)} gems slab?`)) return;
    await persist(slabs.filter((_, i) => i !== index), 'Slab deleted.');
  };

  const openAdd = () => {
    const last = slabs[slabs.length - 1];
    setEditing({ index: -1, form: { gems: last ? String(last.gems * 2) : '', amount: '' } });
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <ToastContainer />
      <h1 className="text-2xl font-black text-gray-900 tracking-tight">Daily Task Bonus</h1>
      <p className="text-sm text-gray-500 mt-1 mb-6">
        Extra bonus for Audio Chat Rooms, separate from the Earning Slabs. When a user&apos;s Audio Chat gems for the
        month reach a slab, its bonus amount is credited to their wallet as <b>Extra Bonus</b>. Shown in the app under
        Daily Task → Bonus Payment.
      </p>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading…</div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-4">
            <span className="text-sm font-bold text-gray-700">
              {slabs.length} {slabs.length === 1 ? 'slab' : 'slabs'}
            </span>
            <button onClick={openAdd} disabled={saving}
              className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 shadow-sm disabled:opacity-50">
              + Add slab
            </button>
          </div>

          {slabs.length === 0 ? (
            <div className="py-14 text-center text-sm font-semibold text-gray-400">No bonus slabs yet</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-50 text-left text-xs font-bold text-gray-400 uppercase tracking-widest">
                  <th className="px-6 py-3 w-16">#</th>
                  <th className="px-6 py-3">Slab (gems)</th>
                  <th className="px-6 py-3">Bonus amount</th>
                  <th className="px-6 py-3 w-32" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {slabs.map((s, i) => (
                  <tr key={s.gems} className="hover:bg-gray-50/60">
                    <td className="px-6 py-3.5">
                      <span className="w-7 h-7 rounded-full bg-purple-50 text-purple-700 text-xs font-black flex items-center justify-center">{i + 1}</span>
                    </td>
                    <td className="px-6 py-3.5 font-semibold text-gray-800">💎 {num(s.gems)}</td>
                    <td className="px-6 py-3.5 font-black text-emerald-600">{inr(s.amount)}</td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button disabled={saving}
                          onClick={() => setEditing({ index: i, form: { gems: String(s.gems), amount: String(s.amount) } })}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold text-purple-600 hover:bg-purple-50 disabled:opacity-50">Edit</button>
                        <button disabled={saving} onClick={() => deleteSlab(i)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold text-red-500 hover:bg-red-50 disabled:opacity-50">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {editing && (
        <SlabModal
          key={editing.index}
          title={editing.index === -1 ? 'Add bonus slab' : 'Edit bonus slab'}
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
