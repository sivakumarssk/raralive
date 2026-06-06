import { useEffect, useState } from 'react';
import { api } from '../../api/client';

type CoinPackage = {
  id: string;
  coins: number;
  price: string;
  original_price: string | null;
  discount: string;
  highlighted: boolean;
  sort_order: number;
  is_active: boolean;
  created_at: string;
};

// ── Drawer ─────────────────────────────────────────────────────────────────────

type DrawerProps = {
  open: boolean;
  editing: CoinPackage | null;
  onClose: () => void;
  onSaved: (pkg: CoinPackage, isNew: boolean) => void;
};

function PackageDrawer({ open, editing, onClose, onSaved }: DrawerProps) {
  const [coins, setCoins] = useState('');
  const [price, setPrice] = useState('');
  const [originalPrice, setOriginalPrice] = useState('');
  const [discount, setDiscount] = useState('0');
  const [highlighted, setHighlighted] = useState(false);
  const [sortOrder, setSortOrder] = useState('0');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (editing) {
      setCoins(String(editing.coins));
      setPrice(editing.price);
      setOriginalPrice(editing.original_price ?? '');
      setDiscount(editing.discount);
      setHighlighted(editing.highlighted);
      setSortOrder(String(editing.sort_order));
    } else {
      setCoins(''); setPrice(''); setOriginalPrice('');
      setDiscount('0'); setHighlighted(false); setSortOrder('0');
    }
    setError('');
  }, [editing, open]);

  const handleSave = async () => {
    if (!coins || !price) { setError('Coins and price are required.'); return; }
    setSaving(true); setError('');
    const body = {
      coins: parseInt(coins, 10),
      price: parseFloat(price),
      original_price: originalPrice ? parseFloat(originalPrice) : null,
      discount: parseFloat(discount || '0'),
      highlighted,
      sort_order: parseInt(sortOrder || '0', 10),
    };
    const result = editing
      ? await api.patch<CoinPackage>(`/admin/coin-packages/${editing.id}`, body)
      : await api.post<CoinPackage>('/admin/coin-packages', body);
    setSaving(false);
    if (!result.ok) { setError(result.message); return; }
    onSaved(result.data, !editing);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-96 bg-white h-full shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">{editing ? 'Edit Package' : 'New Package'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold">×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Coins *</label>
            <input
              type="number" min="1" value={coins} onChange={e => setCoins(e.target.value)}
              placeholder="e.g. 300"
              className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Price (₹) *</label>
              <input
                type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)}
                placeholder="e.g. 90"
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Original Price (₹)</label>
              <input
                type="number" min="0" step="0.01" value={originalPrice} onChange={e => setOriginalPrice(e.target.value)}
                placeholder="e.g. 100"
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Discount (%)</label>
              <input
                type="number" min="0" max="100" step="0.1" value={discount} onChange={e => setDiscount(e.target.value)}
                placeholder="e.g. 10"
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Sort Order</label>
              <input
                type="number" min="0" value={sortOrder} onChange={e => setSortOrder(e.target.value)}
                placeholder="0"
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div
              onClick={() => setHighlighted(h => !h)}
              className={`w-11 h-6 rounded-full transition-colors flex items-center px-0.5 ${highlighted ? 'bg-purple-600' : 'bg-gray-200'}`}>
              <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${highlighted ? 'translate-x-5' : 'translate-x-0'}`} />
            </div>
            <span className="text-sm font-semibold text-gray-700">Highlighted (featured)</span>
          </label>

          {/* Live preview */}
          <div className="rounded-2xl border border-gray-100 p-4 bg-gray-50">
            <p className="text-xs font-semibold text-gray-400 mb-3">Preview</p>
            <div className={`flex items-center justify-between bg-white rounded-xl px-4 py-3.5 shadow-sm ${highlighted ? 'ring-2 ring-purple-500' : ''}`}>
              <div className="flex flex-col gap-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-black text-gray-900">{coins || '—'}</span>
                  <span className="text-xs font-semibold text-gray-400 uppercase">COINS</span>
                </div>
                {parseFloat(discount || '0') > 0 && (
                  <span className="text-xs font-bold text-white bg-pink-500 px-2 py-0.5 rounded self-start">
                    -{discount}%
                  </span>
                )}
              </div>
              <div className={`flex items-baseline gap-1 px-4 py-2 rounded-full ${highlighted ? 'bg-purple-600 text-white' : 'bg-purple-50 text-gray-900'}`}>
                <span className="font-bold">₹{price || '—'}</span>
                {originalPrice && (
                  <span className={`text-xs line-through ${highlighted ? 'text-white/60' : 'text-gray-400'}`}>₹{originalPrice}</span>
                )}
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <div className="px-6 py-5 border-t border-gray-100 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50">
            {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Package'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Delete dialog ──────────────────────────────────────────────────────────────

function DeleteDialog({ pkg, onConfirm, onCancel }: { pkg: CoinPackage; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-80 flex flex-col gap-4">
        <h3 className="text-base font-bold text-gray-900">Delete Package?</h3>
        <p className="text-sm text-gray-500">
          This will permanently delete the <strong>{pkg.coins} coins / ₹{pkg.price}</strong> package.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={onConfirm} className="flex-1 px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-semibold hover:bg-red-600">Delete</button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export function CoinPackagesPage() {
  const [packages, setPackages] = useState<CoinPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<CoinPackage | null>(null);
  const [deleting, setDeleting] = useState<CoinPackage | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const result = await api.get<CoinPackage[]>('/admin/coin-packages');
    if (result.ok) setPackages(result.data);
    setLoading(false);
  }

  const handleSaved = (pkg: CoinPackage, isNew: boolean) => {
    setPackages(prev => isNew ? [...prev, pkg] : prev.map(p => p.id === pkg.id ? pkg : p));
    setDrawerOpen(false);
    setEditing(null);
  };

  const handleToggleActive = async (pkg: CoinPackage) => {
    const result = await api.patch<CoinPackage>(`/admin/coin-packages/${pkg.id}`, { is_active: !pkg.is_active });
    if (result.ok) setPackages(prev => prev.map(p => p.id === pkg.id ? result.data : p));
  };

  const handleDelete = async () => {
    if (!deleting) return;
    await api.delete(`/admin/coin-packages/${deleting.id}`);
    setPackages(prev => prev.filter(p => p.id !== deleting.id));
    setDeleting(null);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Coin Packages</h1>
          <p className="text-sm text-gray-400 mt-0.5">Manage wallet coin packages shown to users</p>
        </div>
        <button
          onClick={() => { setEditing(null); setDrawerOpen(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl text-sm font-semibold hover:opacity-90 shadow-md shadow-purple-200">
          <span className="text-lg leading-none">+</span> New Package
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Coins</th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Price</th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Discount</th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Order</th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Status</th>
              <th className="px-5 py-3.5" />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="text-center py-16 text-gray-400 text-sm">Loading…</td></tr>
            )}
            {!loading && packages.length === 0 && (
              <tr><td colSpan={6} className="text-center py-16 text-gray-400 text-sm">No packages yet. Create one.</td></tr>
            )}
            {packages.map(pkg => (
              <tr key={pkg.id} className="border-b border-gray-50 hover:bg-gray-50 group transition-colors">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-black text-gray-900">{pkg.coins.toLocaleString()}</span>
                    <span className="text-xs text-gray-400 font-semibold uppercase">coins</span>
                    {pkg.highlighted && (
                      <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">Featured</span>
                    )}
                  </div>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-bold text-gray-900">₹{parseFloat(pkg.price).toFixed(0)}</span>
                    {pkg.original_price && (
                      <span className="text-xs text-gray-400 line-through">₹{parseFloat(pkg.original_price).toFixed(0)}</span>
                    )}
                  </div>
                </td>
                <td className="px-5 py-4">
                  {parseFloat(pkg.discount) > 0 ? (
                    <span className="text-xs font-bold text-white bg-pink-500 px-2 py-1 rounded-full">-{parseFloat(pkg.discount).toFixed(0)}%</span>
                  ) : (
                    <span className="text-xs text-gray-300">—</span>
                  )}
                </td>
                <td className="px-5 py-4 text-sm text-gray-500">{pkg.sort_order}</td>
                <td className="px-5 py-4">
                  <button
                    onClick={() => handleToggleActive(pkg)}
                    className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${pkg.is_active ? 'bg-purple-500' : 'bg-gray-200'}`}>
                    <span className={`inline-block w-4 h-4 rounded-full bg-white shadow mt-0.5 transition-transform ${pkg.is_active ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                    <button
                      onClick={() => { setEditing(pkg); setDrawerOpen(true); }}
                      className="px-3 py-1.5 text-xs font-semibold text-purple-600 hover:bg-purple-50 rounded-lg">
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleting(pkg)}
                      className="px-3 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-50 rounded-lg">
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <PackageDrawer
        open={drawerOpen}
        editing={editing}
        onClose={() => { setDrawerOpen(false); setEditing(null); }}
        onSaved={handleSaved}
      />

      {deleting && (
        <DeleteDialog
          pkg={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
