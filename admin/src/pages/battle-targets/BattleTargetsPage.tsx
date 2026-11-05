import { useEffect, useRef, useState } from 'react';
import { api } from '../../api/client';

const MEDIA_BASE = import.meta.env.VITE_API_URL ?? 'http://192.168.0.3:5000';

type BattleTarget = {
  id: string;
  label: string | null;
  coin_amount: string | number;
  image_url: string | null;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
};

type FormState = {
  id: string | null; // null = adding a new target
  label: string;
  coinAmount: string;
  description: string;
  sortOrder: string;
  file: File | null;
  preview: string | null; // new file, or the target's current image when editing
  removeImage: boolean;
};

const EMPTY_FORM: FormState = {
  id: null, label: '', coinAmount: '', description: '', sortOrder: '0', file: null, preview: null, removeImage: false,
};

function resolveImg(url: string) {
  return url.startsWith('http') ? url : `${MEDIA_BASE}/${url.replace(/^\//, '')}`;
}

/** 5000 → "5K", 1500000 → "1.5M" — the label the app shows when none is set. */
function shortCoins(n: number) {
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${+(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function BattleTargetsPage() {
  const [items, setItems] = useState<BattleTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => {
    setLoading(true);
    api.get<BattleTarget[]>('/battle-targets/admin')
      .then(r => { if (r.ok) setItems(r.data); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => { setError(''); setForm({ ...EMPTY_FORM, sortOrder: String(items.length + 1) }); };
  const openEdit = (t: BattleTarget) => {
    setError('');
    setForm({
      id: t.id,
      label: t.label ?? '',
      coinAmount: String(t.coin_amount),
      description: t.description ?? '',
      sortOrder: String(t.sort_order),
      file: null,
      preview: t.image_url ? resolveImg(t.image_url) : null,
      removeImage: false,
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    if (!form || !f) return;
    const reader = new FileReader();
    reader.onloadend = () => setForm(prev => prev && { ...prev, file: f, preview: reader.result as string, removeImage: false });
    reader.readAsDataURL(f);
  };

  const handleSave = async () => {
    if (!form) return;
    const coins = Number(form.coinAmount.replace(/[,\s]/g, ''));
    if (!Number.isInteger(coins) || coins <= 0) { setError('Enter the coin amount as a whole number, e.g. 5000'); return; }
    setSaving(true);
    setError('');

    const body = new FormData();
    body.append('coin_amount', String(coins));
    body.append('label', form.label.trim());
    body.append('description', form.description.trim());
    body.append('sort_order', form.sortOrder || '0');
    if (form.file) body.append('image', form.file);
    else if (form.removeImage) body.append('remove_image', 'true');

    const r = form.id
      ? await api.uploadPatch<BattleTarget>(`/battle-targets/admin/${form.id}`, body)
      : await api.upload<BattleTarget>('/battle-targets/admin', body);
    setSaving(false);
    if (!r.ok) { setError(r.message || 'Could not save'); return; }
    setForm(null);
    load();
  };

  const handleDelete = async (t: BattleTarget) => {
    const name = t.label || shortCoins(Number(t.coin_amount));
    if (!confirm(`Delete the ${name} target? Battles already played keep their target.`)) return;
    const r = await api.delete(`/battle-targets/admin/${t.id}`);
    if (r.ok) setItems(prev => prev.filter(x => x.id !== t.id));
  };

  const handleToggle = async (id: string) => {
    const r = await api.patch<BattleTarget>(`/battle-targets/admin/${id}/toggle`, {});
    if (r.ok) setItems(prev => prev.map(x => x.id === id ? r.data : x));
  };

  const coinsPreview = Number(form?.coinAmount.replace(/[,\s]/g, '') || 0);

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Battle Targets</h1>
          <p className="text-sm text-gray-500 mt-1">
            Coin targets hosts can pick for a Gifting Battle. Only active targets show in the app, in this order.
            Normal Battle doesn't use targets.
          </p>
        </div>
        <button
          onClick={() => (form ? setForm(null) : openAdd())}
          className="shrink-0 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold text-sm shadow-md shadow-purple-200 hover:shadow-lg transition-all">
          {form ? 'Cancel' : '+ Add Target'}
        </button>
      </div>

      {/* Add / edit form */}
      {form && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h3 className="font-bold text-gray-800">{form.id ? 'Edit Target' : 'New Target'}</h3>

          <div className="flex flex-wrap gap-6">
            <div>
              <label className="text-sm font-medium text-gray-600 block mb-1">
                Coin / gift image <span className="text-gray-400 font-normal">(optional, square)</span>
              </label>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
              <button
                onClick={() => fileRef.current?.click()}
                className="w-28 h-28 border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center hover:border-purple-400 transition-colors overflow-hidden">
                {form.preview && !form.removeImage ? (
                  <img src={form.preview} alt="Preview" className="w-full h-full object-contain" />
                ) : (
                  <span className="text-xs text-gray-400 px-2 text-center">Click to upload<br />(coin icon used if empty)</span>
                )}
              </button>
              {form.preview && !form.removeImage && (
                <button
                  onClick={() => setForm({ ...form, file: null, removeImage: true })}
                  className="block mt-1 text-xs text-red-500 hover:underline">
                  Remove image
                </button>
              )}
            </div>

            <div className="flex-1 min-w-[240px] grid grid-cols-1 sm:grid-cols-2 gap-4 content-start">
              <div>
                <label className="text-sm font-medium text-gray-600 block mb-1">Coin amount (target) *</label>
                <input
                  value={form.coinAmount}
                  onChange={e => setForm({ ...form, coinAmount: e.target.value })}
                  inputMode="numeric"
                  placeholder="e.g. 5000"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 block mb-1">Label shown in app</label>
                <input
                  value={form.label}
                  onChange={e => setForm({ ...form, label: e.target.value })}
                  placeholder={coinsPreview > 0 ? `Default: ${shortCoins(coinsPreview)}` : 'e.g. 5K'}
                  maxLength={12}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-gray-600 block mb-1">Details (optional)</label>
                <input
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="e.g. Quick battle for new rooms"
                  maxLength={80}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 block mb-1">Display order</label>
                <input
                  value={form.sortOrder}
                  onChange={e => setForm({ ...form, sortOrder: e.target.value.replace(/\D/g, '') })}
                  inputMode="numeric"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                />
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-red-500 font-medium">{error}</p>}

          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-purple-600 text-white rounded-xl font-semibold text-sm hover:bg-purple-700 disabled:opacity-50 transition-colors">
            {saving ? 'Saving...' : form.id ? 'Save Changes' : 'Add Target'}
          </button>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <p className="text-gray-400 font-medium">No battle targets yet</p>
          <p className="text-xs text-gray-300 mt-1">Hosts can't pick a target for a Gifting Battle until one is added</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {items.map(t => {
            const coins = Number(t.coin_amount);
            return (
              <div key={t.id} className={`bg-white rounded-2xl border shadow-sm p-4 flex flex-col ${t.is_active ? 'border-gray-100' : 'border-gray-100 opacity-60'}`}>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center overflow-hidden shrink-0">
                    {t.image_url
                      ? <img src={resolveImg(t.image_url)} alt="" className="w-full h-full object-contain" />
                      : <span className="text-2xl">🪙</span>}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-gray-900 text-lg leading-tight truncate">{t.label || shortCoins(coins)}</p>
                    <p className="text-xs text-gray-500">{coins.toLocaleString()} coins</p>
                  </div>
                </div>
                {t.description && <p className="text-xs text-gray-500 mt-2 line-clamp-2">{t.description}</p>}
                <p className="text-[11px] text-gray-300 mt-2">Order {t.sort_order}</p>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => handleToggle(t.id)}
                    className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      t.is_active ? 'bg-green-50 text-green-600 hover:bg-green-100' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                    }`}>
                    {t.is_active ? 'Active' : 'Hidden'}
                  </button>
                  <button
                    onClick={() => openEdit(t)}
                    className="px-2 py-1.5 rounded-lg text-xs font-semibold bg-purple-50 text-purple-600 hover:bg-purple-100 transition-colors">
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(t)}
                    className="px-2 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-500 hover:bg-red-100 transition-colors">
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
