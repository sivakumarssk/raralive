import { useEffect, useRef, useState } from 'react';
import { api } from '../../api/client';

const MEDIA_BASE = import.meta.env.VITE_API_URL ?? 'http://192.168.0.3:5000';

type Banner = {
  id: string;
  title: string | null;
  image_url: string;
  link_url: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
};

function resolveImg(url: string) {
  return url.startsWith('http') ? url : `${MEDIA_BASE}/${url.replace(/^\//, '')}`;
}

export function BannersPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => {
    setLoading(true);
    api.get<Banner[]>('/banners/admin')
      .then(r => { if (r.ok) setBanners(r.data); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    if (f) {
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string);
      reader.readAsDataURL(f);
    } else {
      setPreview(null);
    }
  };

  const handleCreate = async () => {
    if (!file) { setError('Please select an image'); return; }
    setSaving(true);
    setError('');
    try {
      const form = new FormData();
      form.append('image', file);
      if (title) form.append('title', title);
      if (linkUrl) form.append('link_url', linkUrl);
      form.append('sort_order', sortOrder);

      const r = await api.upload<Banner>('/banners/admin', form);
      if (r.ok) {
        setBanners(prev => [r.data, ...prev]);
        setShowForm(false);
        setTitle(''); setLinkUrl(''); setSortOrder('0'); setFile(null); setPreview(null);
      } else {
        setError(r.message || 'Failed to create');
      }
    } catch {
      setError('Network error');
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this banner?')) return;
    await api.delete(`/banners/admin/${id}`);
    setBanners(prev => prev.filter(b => b.id !== id));
  };

  const handleToggle = async (id: string) => {
    const r = await api.patch<Banner>(`/banners/admin/${id}/toggle`, {});
    if (r.ok) {
      setBanners(prev => prev.map(b => b.id === id ? r.data : b));
    }
  };

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Banners</h1>
          <p className="text-sm text-gray-500 mt-1">Manage carousel banners shown in the app</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold text-sm shadow-md shadow-purple-200 hover:shadow-lg transition-all">
          {showForm ? 'Cancel' : '+ Add Banner'}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h3 className="font-bold text-gray-800">New Banner</h3>

          {/* Image upload */}
          <div>
            <label className="text-sm font-medium text-gray-600 block mb-1">Banner Image *</label>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center hover:border-purple-400 transition-colors overflow-hidden"
              style={{ aspectRatio: '16/7' }}>
              {preview ? (
                <img src={preview} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center">
                  <svg className="w-8 h-8 mx-auto text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm text-gray-400">Click to upload image</p>
                </div>
              )}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-600 block mb-1">Title (optional)</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Banner title"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600 block mb-1">Link URL (optional)</label>
              <input
                value={linkUrl}
                onChange={e => setLinkUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600 block mb-1">Sort Order</label>
              <input
                type="number"
                value={sortOrder}
                onChange={e => setSortOrder(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-500 font-medium">{error}</p>}

          <button
            onClick={handleCreate}
            disabled={saving}
            className="px-6 py-2.5 bg-purple-600 text-white rounded-xl font-semibold text-sm hover:bg-purple-700 disabled:opacity-50 transition-colors">
            {saving ? 'Uploading...' : 'Create Banner'}
          </button>
        </div>
      )}

      {/* Banner list */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : banners.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <svg className="w-12 h-12 mx-auto text-gray-200 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-gray-400 font-medium">No banners yet</p>
          <p className="text-xs text-gray-300 mt-1">Click "Add Banner" to create one</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {banners.map(banner => (
            <div key={banner.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="relative">
                <img
                  src={resolveImg(banner.image_url)}
                  alt={banner.title || 'Banner'}
                  className="w-full object-cover"
                  style={{ aspectRatio: '16/7' }}
                />
                {!banner.is_active && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <span className="text-white font-bold text-sm bg-red-500 px-3 py-1 rounded-full">Inactive</span>
                  </div>
                )}
                <div className="absolute top-2 right-2 bg-black/50 px-2 py-0.5 rounded-lg">
                  <span className="text-white text-xs font-bold">#{banner.sort_order}</span>
                </div>
              </div>
              <div className="p-4">
                <p className="font-semibold text-gray-800 text-sm truncate">{banner.title || 'No title'}</p>
                {banner.link_url && (
                  <p className="text-xs text-gray-400 truncate mt-1">{banner.link_url}</p>
                )}
                <p className="text-xs text-gray-300 mt-1">
                  {new Date(banner.created_at).toLocaleDateString()}
                </p>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => handleToggle(banner.id)}
                    className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      banner.is_active
                        ? 'bg-green-50 text-green-600 hover:bg-green-100'
                        : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                    }`}>
                    {banner.is_active ? 'Active' : 'Inactive'}
                  </button>
                  <button
                    onClick={() => handleDelete(banner.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-500 hover:bg-red-100 transition-colors">
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
