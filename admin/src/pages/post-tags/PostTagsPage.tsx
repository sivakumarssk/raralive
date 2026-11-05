import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../api/client';

// Post tags for the app's Home feed. Each main tag is a Home tab; its sub tags
// are the chips under that tab. Users pick from these when creating a post.

type Tag = {
  id: string;
  parent_id: string | null;
  name: string;
  sort_order: number;
  is_active: boolean;
  post_count: number;
  children?: Tag[];
};

type FormState = { mode: 'add-tab' | 'add-sub' | 'edit'; tag?: Tag; parent?: Tag; name: string; sort: string; active: boolean };

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

// ── Add / edit popup ───────────────────────────────────────────────────────────

function TagModal({ form, saving, onChange, onClose, onSave }: {
  form: FormState; saving: boolean;
  onChange: (f: FormState) => void; onClose: () => void; onSave: () => void;
}) {
  const title = form.mode === 'add-tab' ? 'Add Home tab'
    : form.mode === 'add-sub' ? `Add sub tag to “${form.parent?.name}”`
    : form.tag?.parent_id ? 'Edit sub tag' : 'Edit Home tab';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !saving && onClose()} />
      <form onSubmit={e => { e.preventDefault(); onSave(); }} className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 space-y-4">
        <h2 className="text-lg font-black text-gray-900">{title}</h2>
        <div>
          <label className="text-xs font-bold text-gray-500">Name</label>
          <input autoFocus value={form.name} maxLength={60} onChange={e => onChange({ ...form, name: e.target.value })}
            placeholder={form.mode === 'add-tab' ? 'e.g. Janmashtami' : 'e.g. 🌅 శుభోదయం'}
            className="mt-1 w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-purple-500" />
          <p className="text-[11px] text-gray-400 mt-1">Emojis and any language are fine.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-gray-500">Order</label>
            <input type="number" value={form.sort} onChange={e => onChange({ ...form, sort: e.target.value })}
              className="mt-1 w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-purple-500" />
            <p className="text-[11px] text-gray-400 mt-1">Lower shows first</p>
          </div>
          <label className="flex items-center gap-2 mt-6 cursor-pointer select-none">
            <input type="checkbox" checked={form.active} onChange={e => onChange({ ...form, active: e.target.checked })} className="w-4 h-4 accent-purple-600" />
            <span className="text-sm font-semibold text-gray-700">Visible in app</span>
          </label>
        </div>
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} disabled={saving}
            className="flex-1 h-11 rounded-xl text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 disabled:opacity-50">Cancel</button>
          <button type="submit" disabled={saving || !form.name.trim()}
            className="flex-1 h-11 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export function PostTagsPage() {
  const [tabs, setTabs] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => api.get<Tag[]>('/post-tags/admin')
    .then(r => { if (r.ok) setTabs(r.data); else toast(r.message, 'error'); })
    .finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const nextSort = (list: Tag[]) => (list.length ? Math.max(...list.map(t => t.sort_order)) + 1 : 0);

  const save = async () => {
    if (!form) return;
    const body = { name: form.name.trim(), sort_order: Number(form.sort) || 0, is_active: form.active };
    setSaving(true);
    const r = form.mode === 'edit'
      ? await api.patch(`/post-tags/admin/${form.tag!.id}`, body)
      : await api.post('/post-tags/admin', { ...body, parent_id: form.mode === 'add-sub' ? form.parent!.id : null });
    setSaving(false);
    if (!r.ok) { toast(r.message, 'error'); return; }
    toast(form.mode === 'edit' ? 'Saved.' : `“${body.name}” added.`);
    setForm(null);
    load();
  };

  const toggle = async (tag: Tag) => {
    const r = await api.patch(`/post-tags/admin/${tag.id}`, { is_active: !tag.is_active });
    if (!r.ok) { toast(r.message, 'error'); return; }
    toast(tag.is_active ? `“${tag.name}” hidden from the app.` : `“${tag.name}” is visible again.`);
    load();
  };

  const remove = async (tag: Tag) => {
    const subs = tag.children?.length ?? 0;
    const msg = `Delete “${tag.name}”?` +
      (subs ? ` Its ${subs} sub tag${subs > 1 ? 's' : ''} will be deleted too.` : '') +
      ' Posts keep existing but lose this tag.';
    if (!window.confirm(msg)) return;
    const r = await api.delete(`/post-tags/admin/${tag.id}`);
    if (!r.ok) { toast(r.message, 'error'); return; }
    toast(`“${tag.name}” deleted.`);
    load();
  };

  const edit = (tag: Tag) => setForm({ mode: 'edit', tag, name: tag.name, sort: String(tag.sort_order), active: tag.is_active });

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <ToastContainer />
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Post Tags</h1>
          <p className="text-gray-400 text-sm mt-1">Main tags are Home tabs · sub tags show as chips under them · users pick these when posting</p>
        </div>
        <button onClick={() => setForm({ mode: 'add-tab', name: '', sort: String(nextSort(tabs)), active: true })}
          className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 shadow-sm">
          + Add Home tab
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading…</div>
      ) : tabs.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 py-14 text-center">
          <p className="text-sm font-semibold text-gray-500">No tags yet</p>
          <p className="text-xs text-gray-400 mt-1">Add a Home tab (e.g. “Janmashtami”), then add sub tags under it.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {tabs.map(tab => (
            <section key={tab.id} className={`bg-white rounded-2xl border shadow-sm ${tab.is_active ? 'border-gray-100' : 'border-dashed border-gray-300 opacity-70'}`}>
              <div className="px-5 py-4 flex items-center justify-between gap-3 flex-wrap border-b border-gray-50">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-[10px] font-black uppercase tracking-widest text-purple-600 bg-purple-50 px-2 py-1 rounded-md">Home tab</span>
                  <p className="text-base font-black text-gray-900 truncate">{tab.name}</p>
                  {!tab.is_active && <span className="text-[11px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">Hidden</span>}
                  <span className="text-xs text-gray-400">{tab.post_count} posts · order {tab.sort_order}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => edit(tab)} className="px-3 py-1.5 rounded-lg text-xs font-bold text-purple-600 hover:bg-purple-50">Edit</button>
                  <button onClick={() => toggle(tab)} className="px-3 py-1.5 rounded-lg text-xs font-bold text-gray-600 hover:bg-gray-100">{tab.is_active ? 'Hide' : 'Show'}</button>
                  <button onClick={() => remove(tab)} className="px-3 py-1.5 rounded-lg text-xs font-bold text-red-500 hover:bg-red-50">Delete</button>
                </div>
              </div>

              <div className="px-5 py-4 flex flex-wrap gap-2 items-center">
                {(tab.children ?? []).map(sub => (
                  <div key={sub.id}
                    className={`group flex items-center gap-1.5 pl-3.5 pr-1.5 py-1.5 rounded-full border text-sm ${sub.is_active ? 'bg-white border-gray-200 shadow-sm' : 'bg-gray-50 border-dashed border-gray-300 text-gray-400'}`}>
                    <span className="font-semibold">{sub.name}</span>
                    <span className="text-[11px] text-gray-400">{sub.post_count}</span>
                    <button onClick={() => edit(sub)} title="Edit" className="w-6 h-6 rounded-full text-gray-400 hover:text-purple-600 hover:bg-purple-50 flex items-center justify-center">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2a2 2 0 01.586-1.414z" /></svg>
                    </button>
                    <button onClick={() => toggle(sub)} title={sub.is_active ? 'Hide' : 'Show'} className="w-6 h-6 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 flex items-center justify-center">
                      {sub.is_active
                        ? <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>}
                    </button>
                    <button onClick={() => remove(sub)} title="Delete" className="w-6 h-6 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                ))}
                <button onClick={() => setForm({ mode: 'add-sub', parent: tab, name: '', sort: String(nextSort(tab.children ?? [])), active: true })}
                  className="px-3.5 py-1.5 rounded-full border border-dashed border-purple-300 text-sm font-bold text-purple-600 hover:bg-purple-50">
                  + Add sub tag
                </button>
              </div>
            </section>
          ))}
        </div>
      )}

      {form && <TagModal form={form} saving={saving} onChange={setForm} onClose={() => setForm(null)} onSave={save} />}
    </div>
  );
}
