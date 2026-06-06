import { useEffect, useRef, useState } from 'react';
import { api } from '../../api/client';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://192.168.0.8:5000';

type Category = { id: string; name: string; sort_order: number; is_active: boolean };
type ShopGift = {
  id: string; name: string; image_url: string | null; coins: number;
  bg_color: string; sort_order: number; is_active: boolean;
  category_id: string | null; category_name: string | null;
};

function resolveImg(url: string | null) {
  if (!url) return null;
  return url.startsWith('http') ? url : `${API_BASE}/${url.replace(/^\//, '')}`;
}

// ── Category drawer ────────────────────────────────────────────────────────────

function CategoryDrawer({ open, editing, onClose, onSaved }: {
  open: boolean; editing: Category | null;
  onClose: () => void; onSaved: (c: Category, isNew: boolean) => void;
}) {
  const [name, setName] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (editing) { setName(editing.name); setSortOrder(String(editing.sort_order)); }
    else { setName(''); setSortOrder('0'); }
    setError('');
  }, [editing, open]);

  const save = async () => {
    if (!name.trim()) { setError('Name is required.'); return; }
    setSaving(true); setError('');
    const body = { name: name.trim(), sort_order: parseInt(sortOrder || '0', 10) };
    const res = editing
      ? await api.patch<Category>(`/admin/shop-gifts/categories/${editing.id}`, body)
      : await api.post<Category>('/admin/shop-gifts/categories', body);
    setSaving(false);
    if (!res.ok) { setError(res.message); return; }
    onSaved(res.data, !editing);
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-80 bg-white h-full shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">{editing ? 'Edit Category' : 'New Category'}</h2>
          <button onClick={onClose} className="text-gray-400 text-xl font-bold">×</button>
        </div>
        <div className="flex-1 px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Tab Name *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Hot, FUN, Special"
              className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Sort Order</label>
            <input type="number" value={sortOrder} onChange={e => setSortOrder(e.target.value)} placeholder="0"
              className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
        <div className="px-6 py-5 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={save} disabled={saving} className="flex-1 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50">
            {saving ? 'Saving…' : editing ? 'Save' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Gift drawer ────────────────────────────────────────────────────────────────

const BG_PRESETS = ['#FFE4EE','#E4F0FF','#EDE4FF','#FFF6D6','#E4FFF0','#FFE4D6','#F4E4FF','#E4FFFA'];

function GiftDrawer({ open, editing, categories, onClose, onSaved }: {
  open: boolean; editing: ShopGift | null; categories: Category[];
  onClose: () => void; onSaved: (g: ShopGift, isNew: boolean) => void;
}) {
  const [name, setName] = useState('');
  const [coins, setCoins] = useState('');
  const [bgColor, setBgColor] = useState('#FFE4EE');
  const [sortOrder, setSortOrder] = useState('0');
  const [categoryId, setCategoryId] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setName(editing.name); setCoins(String(editing.coins));
      setBgColor(editing.bg_color); setSortOrder(String(editing.sort_order));
      setCategoryId(editing.category_id ?? '');
      setPreview(resolveImg(editing.image_url));
    } else {
      setName(''); setCoins(''); setBgColor('#FFE4EE'); setSortOrder('0'); setCategoryId('');
      setPreview(null);
    }
    setFile(null); setError('');
  }, [editing, open]);

  const save = async () => {
    if (!name.trim() || !coins) { setError('Name and coins are required.'); return; }
    setSaving(true); setError('');
    const form = new FormData();
    form.append('name', name.trim());
    form.append('coins', coins);
    form.append('bg_color', bgColor);
    form.append('sort_order', sortOrder || '0');
    if (categoryId) form.append('category_id', categoryId);
    if (file) form.append('image', file);

    const res = editing
      ? await api.uploadPatch<ShopGift>(`/admin/shop-gifts/${editing.id}`, form)
      : await api.upload<ShopGift>('/admin/shop-gifts', form);
    setSaving(false);
    if (!res.ok) { setError(res.message); return; }
    onSaved(res.data, !editing);
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-96 bg-white h-full shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">{editing ? 'Edit Gift' : 'New Gift'}</h2>
          <button onClick={onClose} className="text-gray-400 text-xl font-bold">×</button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* Image upload */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-2">Image (PNG or GIF)</label>
            <div
              onClick={() => fileRef.current?.click()}
              className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl py-5 cursor-pointer hover:border-purple-300 transition-colors"
              style={{ backgroundColor: bgColor }}>
              {preview
                ? <img src={preview} alt="preview" className="w-20 h-20 object-contain rounded-full" />
                : <span className="text-3xl">🎁</span>
              }
              <p className="text-xs text-gray-400 mt-2">Click to upload PNG or GIF</p>
            </div>
            <input ref={fileRef} type="file" accept="image/png,image/gif" className="hidden"
              onChange={e => {
                const f = e.target.files?.[0];
                if (!f) return;
                setFile(f);
                setPreview(URL.createObjectURL(f));
              }} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Gift Name *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Crown"
              className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Coins *</label>
            <input type="number" min="1" value={coins} onChange={e => setCoins(e.target.value)} placeholder="e.g. 500"
              className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Category Tab</label>
            <select value={categoryId} onChange={e => setCategoryId(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400">
              <option value="">— No category —</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-2">Background Color</label>
            <div className="flex flex-wrap gap-2">
              {BG_PRESETS.map(c => (
                <button key={c} onClick={() => setBgColor(c)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${bgColor === c ? 'border-purple-500 scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }} />
              ))}
              <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)}
                className="w-8 h-8 rounded-full border-2 border-gray-200 cursor-pointer" title="Custom color" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Sort Order</label>
            <input type="number" min="0" value={sortOrder} onChange={e => setSortOrder(e.target.value)} placeholder="0"
              className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
        <div className="px-6 py-5 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={save} disabled={saving} className="flex-1 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50">
            {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Gift'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export function ShopGiftsPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [gifts, setGifts] = useState<ShopGift[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState<string>('all');

  const [catDrawer, setCatDrawer] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [giftDrawer, setGiftDrawer] = useState(false);
  const [editingGift, setEditingGift] = useState<ShopGift | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [cr, gr] = await Promise.all([
      api.get<Category[]>('/admin/shop-gifts/categories'),
      api.get<ShopGift[]>('/admin/shop-gifts'),
    ]);
    if (cr.ok) setCategories(cr.data);
    if (gr.ok) setGifts(gr.data);
    setLoading(false);
  }

  const toggleCatActive = async (cat: Category) => {
    const res = await api.patch<Category>(`/admin/shop-gifts/categories/${cat.id}`, { is_active: !cat.is_active });
    if (res.ok) setCategories(prev => prev.map(c => c.id === cat.id ? res.data : c));
  };

  const toggleGiftActive = async (gift: ShopGift) => {
    const form = new FormData();
    form.append('is_active', String(!gift.is_active));
    const res = await api.uploadPatch<ShopGift>(`/admin/shop-gifts/${gift.id}`, form);
    if (res.ok) setGifts(prev => prev.map(g => g.id === gift.id ? res.data : g));
  };

  const deleteGift = async (id: string) => {
    await api.delete(`/admin/shop-gifts/${id}`);
    setGifts(prev => prev.filter(g => g.id !== id));
  };

  const filteredGifts = activeCat === 'all' ? gifts : gifts.filter(g => g.category_id === activeCat);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Gift Shop</h1>
          <p className="text-sm text-gray-400 mt-0.5">Manage categories (tabs) and gifts shown in the gift shop</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => { setEditingCat(null); setCatDrawer(true); }}
            className="px-4 py-2.5 border border-purple-200 text-purple-600 rounded-xl text-sm font-semibold hover:bg-purple-50">
            + Category
          </button>
          <button onClick={() => { setEditingGift(null); setGiftDrawer(true); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl text-sm font-semibold hover:opacity-90 shadow-md shadow-purple-200">
            + New Gift
          </button>
        </div>
      </div>

      {/* Categories */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Categories / Tabs</p>
        {categories.length === 0
          ? <p className="text-sm text-gray-400 italic">No categories yet. Create one to group gifts into tabs.</p>
          : (
            <div className="flex flex-wrap gap-2">
              {categories.map(cat => (
                <div key={cat.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-semibold ${cat.is_active ? 'border-purple-200 bg-purple-50 text-purple-700' : 'border-gray-200 bg-gray-50 text-gray-400'}`}>
                  <span>{cat.name}</span>
                  <button onClick={() => toggleCatActive(cat)} className="text-[10px] opacity-60 hover:opacity-100">
                    {cat.is_active ? '●' : '○'}
                  </button>
                  <button onClick={() => { setEditingCat(cat); setCatDrawer(true); }} className="text-[11px] opacity-50 hover:opacity-100">✎</button>
                </div>
              ))}
            </div>
          )
        }
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        <button onClick={() => setActiveCat('all')}
          className={`px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap ${activeCat === 'all' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
          All ({gifts.length})
        </button>
        {categories.map(cat => (
          <button key={cat.id} onClick={() => setActiveCat(cat.id)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap ${activeCat === cat.id ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
            {cat.name} ({gifts.filter(g => g.category_id === cat.id).length})
          </button>
        ))}
      </div>

      {/* Gift grid */}
      {loading ? (
        <div className="flex justify-center py-16">
          <svg className="animate-spin w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
        </div>
      ) : filteredGifts.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">No gifts yet. Create one.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {filteredGifts.map(gift => {
            const imgUrl = resolveImg(gift.image_url);
            return (
              <div key={gift.id} className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col items-center gap-3 group ${!gift.is_active ? 'opacity-50' : ''}`}>
                <div className="w-16 h-16 rounded-full flex items-center justify-center overflow-hidden" style={{ backgroundColor: gift.bg_color }}>
                  {imgUrl
                    ? <img src={imgUrl} alt={gift.name} className="w-14 h-14 object-contain" />
                    : <span className="text-3xl">🎁</span>
                  }
                </div>
                <div className="text-center">
                  <p className="font-bold text-gray-900 text-sm truncate max-w-[100px]">{gift.name}</p>
                  <p className="text-xs text-amber-500 font-semibold">{gift.coins.toLocaleString()} coins</p>
                  {gift.category_name && <p className="text-[10px] text-purple-500 mt-0.5">{gift.category_name}</p>}
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => toggleGiftActive(gift)}
                    className={`px-2 py-1 text-[10px] font-bold rounded-lg ${gift.is_active ? 'bg-gray-100 text-gray-500' : 'bg-emerald-50 text-emerald-600'}`}>
                    {gift.is_active ? 'Hide' : 'Show'}
                  </button>
                  <button onClick={() => { setEditingGift(gift); setGiftDrawer(true); }}
                    className="px-2 py-1 text-[10px] font-bold rounded-lg bg-purple-50 text-purple-600">Edit</button>
                  <button onClick={() => { if (confirm('Delete this gift?')) deleteGift(gift.id); }}
                    className="px-2 py-1 text-[10px] font-bold rounded-lg bg-red-50 text-red-500">Del</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CategoryDrawer
        open={catDrawer} editing={editingCat}
        onClose={() => setCatDrawer(false)}
        onSaved={(cat, isNew) => {
          setCategories(prev => isNew ? [...prev, cat] : prev.map(c => c.id === cat.id ? cat : c));
          setCatDrawer(false);
        }}
      />

      <GiftDrawer
        open={giftDrawer} editing={editingGift} categories={categories}
        onClose={() => setGiftDrawer(false)}
        onSaved={(gift, isNew) => {
          setGifts(prev => isNew ? [...prev, gift] : prev.map(g => g.id === gift.id ? gift : g));
          setGiftDrawer(false);
        }}
      />
    </div>
  );
}
