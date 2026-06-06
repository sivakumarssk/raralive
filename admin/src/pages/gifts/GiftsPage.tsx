import { useEffect, useRef, useState } from 'react';
import { api } from '../../api/client';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://192.168.0.8:5000';

type Gift = {
  id: string;
  name: string;
  image_url: string | null;
  coins: number;
  bg_color: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function resolveImg(url: string | null) {
  if (!url) return null;
  return url.startsWith('http') ? url : `${API_BASE}/${url.replace(/^\//, '')}`;
}

const BG_PRESETS = [
  '#FFE4EE', '#E4F0FF', '#EDE4FF', '#FFF6D6',
  '#E4FFF0', '#FFE4D6', '#F4E4FF', '#E4FFFA',
];

// ── Gift Preview Chip ──────────────────────────────────────────────────────────

function GiftChip({ gift }: { gift: Gift }) {
  const imgUrl = resolveImg(gift.image_url);
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg" style={{ backgroundColor: gift.bg_color }}>
      {imgUrl ? (
        <img src={imgUrl} alt={gift.name} className="w-6 h-6 object-contain rounded-full" />
      ) : (
        <div className="w-6 h-6 rounded-full bg-white/50" />
      )}
      <span className="text-xs font-bold text-gray-700">{gift.coins}</span>
    </div>
  );
}

// ── Create / Edit Drawer ───────────────────────────────────────────────────────

type DrawerProps = {
  open: boolean;
  editing: Gift | null;
  onClose: () => void;
  onSaved: (gift: Gift, isNew: boolean) => void;
};

function GiftDrawer({ open, editing, onClose, onSaved }: DrawerProps) {
  const [name, setName] = useState('');
  const [coins, setCoins] = useState('');
  const [bgColor, setBgColor] = useState('#FFE4EE');
  const [sortOrder, setSortOrder] = useState('0');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setName(''); setCoins(''); setBgColor('#FFE4EE'); setSortOrder('0');
      setFile(null); setPreview(null); setError('');
      return;
    }
    if (editing) {
      setName(editing.name);
      setCoins(String(editing.coins));
      setBgColor(editing.bg_color);
      setSortOrder(String(editing.sort_order));
      setPreview(resolveImg(editing.image_url));
    }
  }, [open, editing]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.type !== 'image/png') { setError('Only PNG images are allowed.'); return; }
    setError('');
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Name is required.'); return; }
    const coinsNum = parseInt(coins, 10);
    if (!coins || isNaN(coinsNum) || coinsNum < 1) { setError('Coins must be a positive number.'); return; }
    if (!editing && !file) { setError('PNG image is required.'); return; }

    setSaving(true);
    setError('');

    const form = new FormData();
    form.append('name', name.trim());
    form.append('coins', String(coinsNum));
    form.append('bg_color', bgColor);
    form.append('sort_order', sortOrder || '0');
    if (file) form.append('image', file);

    const result = editing
      ? await api.uploadPatch<Gift>(`/admin/gifts/${editing.id}`, form)
      : await api.upload<Gift>('/admin/gifts', form);

    setSaving(false);
    if (!result.ok) { setError(result.message); return; }
    onSaved(result.data, !editing);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-[420px] bg-white h-full shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base font-black text-gray-900">{editing ? 'Edit Gift' : 'Add Gift'}</h2>
            <p className="text-xs text-gray-400 mt-0.5">PNG image only · max 2 MB</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Image upload */}
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">
              Gift Image (PNG only) {!editing && '*'}
            </label>
            <div
              onClick={() => fileRef.current?.click()}
              className="cursor-pointer border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center gap-3 py-6 hover:border-purple-300 hover:bg-purple-50/30 transition-all"
              style={preview ? { borderStyle: 'solid', borderColor: '#d8b4fe', padding: 0 } : {}}
            >
              {preview ? (
                <div className="relative w-full">
                  <div
                    className="flex items-center justify-center rounded-2xl overflow-hidden"
                    style={{ backgroundColor: bgColor, height: 140 }}
                  >
                    <img src={preview} alt="preview" className="h-24 w-24 object-contain" />
                  </div>
                  <span className="absolute bottom-2 right-3 text-xs text-purple-500 font-semibold bg-white/80 px-2 py-0.5 rounded-full">
                    Click to change
                  </span>
                </div>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center">
                    <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-gray-600">Click to upload PNG</p>
                    <p className="text-xs text-gray-400 mt-0.5">Transparent background recommended</p>
                  </div>
                </>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/png" className="hidden" onChange={handleFile} />
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">Gift Name *</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Rose, Diamond, Crown…"
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:border-purple-400 transition-colors"
            />
          </div>

          {/* Coins */}
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">Coin Cost *</label>
            <input
              value={coins}
              onChange={e => setCoins(e.target.value.replace(/\D/g, ''))}
              placeholder="e.g. 9"
              inputMode="numeric"
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:border-purple-400 transition-colors"
            />
          </div>

          {/* Background color */}
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-2 uppercase tracking-wide">Background Color</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {BG_PRESETS.map(c => (
                <button
                  key={c}
                  onClick={() => setBgColor(c)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${bgColor === c ? 'border-purple-500 scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="color"
                value={bgColor}
                onChange={e => setBgColor(e.target.value)}
                className="w-9 h-9 rounded-lg border border-gray-200 cursor-pointer p-0.5"
              />
              <span className="text-xs text-gray-400 font-mono">{bgColor}</span>
            </div>
          </div>

          {/* Sort order */}
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">Sort Order</label>
            <input
              value={sortOrder}
              onChange={e => setSortOrder(e.target.value.replace(/\D/g, ''))}
              placeholder="0"
              inputMode="numeric"
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:border-purple-400 transition-colors"
            />
            <p className="text-xs text-gray-400 mt-1">Lower number appears first in the gift bar.</p>
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 text-sm px-3 py-2.5 rounded-xl">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 shrink-0">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 text-white text-sm font-bold hover:from-purple-700 hover:to-violet-700 disabled:opacity-60 transition-all"
          >
            {saving ? (editing ? 'Saving…' : 'Adding…') : (editing ? 'Save Changes' : 'Add Gift')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Delete Confirm Dialog ──────────────────────────────────────────────────────

function DeleteDialog({ gift, onConfirm, onCancel, deleting }: {
  gift: Gift;
  onConfirm: () => void;
  onCancel: () => void;
  deleting: boolean;
}) {
  const imgUrl = resolveImg(gift.image_url);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: gift.bg_color }}>
            {imgUrl
              ? <img src={imgUrl} alt={gift.name} className="w-10 h-10 object-contain" />
              : <div className="w-8 h-8 rounded-full bg-white/50" />}
          </div>
          <div>
            <p className="font-black text-gray-900">{gift.name}</p>
            <p className="text-sm text-gray-400">{gift.coins} coins</p>
          </div>
        </div>
        <p className="text-sm text-gray-600 mb-5">
          Delete this gift? This removes the PNG file and the gift will no longer appear in the app.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-all">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600 disabled:opacity-60 transition-all"
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export function GiftsPage() {
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Gift | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Gift | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toggleLoading, setToggleLoading] = useState<string | null>(null);

  const fetchGifts = async () => {
    setLoading(true);
    const r = await api.get<Gift[]>('/admin/gifts');
    setLoading(false);
    if (r.ok) setGifts(r.data);
  };

  useEffect(() => { fetchGifts(); }, []);

  const handleSaved = (gift: Gift, isNew: boolean) => {
    if (isNew) {
      setGifts(prev => [...prev, gift].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)));
    } else {
      setGifts(prev => prev.map(g => g.id === gift.id ? gift : g));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const r = await api.delete(`/admin/gifts/${deleteTarget.id}`);
    setDeleting(false);
    if (r.ok) setGifts(prev => prev.filter(g => g.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  const handleToggleActive = async (gift: Gift) => {
    setToggleLoading(gift.id);
    const form = new FormData();
    form.append('is_active', String(!gift.is_active));
    const r = await api.uploadPatch<Gift>(`/admin/gifts/${gift.id}`, form);
    setToggleLoading(null);
    if (r.ok) setGifts(prev => prev.map(g => g.id === gift.id ? r.data : g));
  };

  const openEdit = (gift: Gift) => { setEditing(gift); setDrawerOpen(true); };
  const openAdd = () => { setEditing(null); setDrawerOpen(true); };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Page header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Gifts</h1>
          <p className="text-gray-400 text-sm mt-1">Manage the gift bar icons shown inside chat rooms</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 text-white text-sm font-bold hover:from-purple-700 hover:to-violet-700 transition-all shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Gift
        </button>
      </div>

      {/* Gift bar live preview */}
      {gifts.filter(g => g.is_active).length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-6 px-5 py-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Live Preview — Gift Bar</p>
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {gifts.filter(g => g.is_active).map((gift, i) => (
              <div key={gift.id} className="flex items-center shrink-0">
                {i > 0 && <div className="w-px h-7 bg-gray-200 mx-1" />}
                <GiftChip gift={gift} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Table card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">All Gifts</p>
          <span className="text-xs text-gray-400 font-medium">{gifts.length} {gifts.length === 1 ? 'gift' : 'gifts'}</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <svg className="animate-spin w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          </div>
        ) : gifts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-purple-50 flex items-center justify-center mb-3">
              <svg className="w-7 h-7 text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a4 4 0 00-4-4H5.45a4 4 0 00-3.948 3.356M12 8h7.5a4 4 0 010 8H12m0 0H9m3 0v5" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-gray-400">No gifts yet</p>
            <button onClick={openAdd} className="mt-3 text-xs font-semibold text-purple-500 hover:text-purple-700 transition-colors">
              Add your first gift →
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-50">
                  {['Gift', 'Coins', 'Order', 'Status', 'Added', ''].map(h => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {gifts.map(gift => {
                  const imgUrl = resolveImg(gift.image_url);
                  return (
                    <tr key={gift.id} className="hover:bg-gray-50/60 transition-colors group">
                      {/* Gift */}
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                            style={{ backgroundColor: gift.bg_color }}
                          >
                            {imgUrl
                              ? <img src={imgUrl} alt={gift.name} className="w-8 h-8 object-contain" />
                              : <div className="w-6 h-6 rounded-full bg-white/50" />}
                          </div>
                          <span className="font-semibold text-gray-800">{gift.name}</span>
                        </div>
                      </td>

                      {/* Coins */}
                      <td className="px-6 py-3">
                        <span className="inline-flex items-center gap-1.5 text-sm font-bold text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded-full">
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                            <circle cx="10" cy="10" r="10" />
                          </svg>
                          {gift.coins >= 1000 ? `${(gift.coins / 1000).toFixed(1)}K` : gift.coins}
                        </span>
                      </td>

                      {/* Sort order */}
                      <td className="px-6 py-3 text-gray-400 text-xs font-mono">
                        #{gift.sort_order}
                      </td>

                      {/* Status toggle */}
                      <td className="px-6 py-3">
                        <button
                          onClick={() => handleToggleActive(gift)}
                          disabled={toggleLoading === gift.id}
                          className="flex items-center gap-2 text-xs font-semibold transition-all"
                        >
                          <div className={`w-9 h-5 rounded-full transition-colors ${gift.is_active ? 'bg-emerald-400' : 'bg-gray-200'} relative`}>
                            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${gift.is_active ? 'left-4' : 'left-0.5'}`} />
                          </div>
                          <span className={gift.is_active ? 'text-emerald-600' : 'text-gray-400'}>
                            {gift.is_active ? 'Active' : 'Hidden'}
                          </span>
                        </button>
                      </td>

                      {/* Created */}
                      <td className="px-6 py-3 text-gray-400 text-xs whitespace-nowrap">
                        {new Date(gift.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openEdit(gift)}
                            className="p-1.5 rounded-lg hover:bg-purple-50 text-gray-400 hover:text-purple-600 transition-colors"
                            title="Edit"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => setDeleteTarget(gift)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                            title="Delete"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <GiftDrawer
        open={drawerOpen}
        editing={editing}
        onClose={() => { setDrawerOpen(false); setEditing(null); }}
        onSaved={handleSaved}
      />

      {deleteTarget && (
        <DeleteDialog
          gift={deleteTarget}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          deleting={deleting}
        />
      )}
    </div>
  );
}
