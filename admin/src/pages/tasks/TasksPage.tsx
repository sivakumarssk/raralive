import { useEffect, useRef, useState } from 'react';
import { api } from '../../api/client';
import coinImg from '../../assets/coin.png';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://192.168.0.8:5000';

type Task = {
  id: string; title: string; description: string; type: 'daily';
  target_coins: number | null; target_gift_id: string | null; target_count: number;
  reward_gems: number; icon_type: 'emoji' | 'image'; icon_value: string;
  min_level: number; max_level: number; sort_order: number; is_active: boolean;
  gift_name: string | null; gift_image_url: string | null;
};
type Gift = { id: string; name: string; image_url: string | null; coins: number };

function resolveImg(url: string | null) {
  if (!url) return null;
  return url.startsWith('http') ? url : `${API_BASE}/${url.replace(/^\//, '')}`;
}

// ── Drawer ──────────────────────────────────────────────────────────────────

function TaskDrawer({ open, editing, gifts, onClose, onSaved }: {
  open: boolean; editing: Task | null; gifts: Gift[];
  onClose: () => void; onSaved: (t: Task, isNew: boolean) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type] = useState<'daily'>('daily');
  const [targetCoins, setTargetCoins] = useState('');
  const [targetGiftId, setTargetGiftId] = useState('');
  const [targetCount, setTargetCount] = useState('1');
  const [rewardGems, setRewardGems] = useState('0');
  const [iconType, setIconType] = useState<'emoji' | 'image'>('emoji');
  const [iconValue, setIconValue] = useState('🎁');
  const [sortOrder, setSortOrder] = useState('0');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const selectedGift = gifts.find(g => g.id === targetGiftId) ?? null;

  useEffect(() => {
    if (editing) {
      setTitle(editing.title); setDescription(editing.description);
      setTargetCoins(editing.target_coins ? String(editing.target_coins) : '');
      setTargetGiftId(editing.target_gift_id ?? '');
      setTargetCount(String(editing.target_count));
      setRewardGems(String(editing.reward_gems));
      setIconType(editing.icon_type); setIconValue(editing.icon_value);
      setSortOrder(String(editing.sort_order));
    } else {
      setTitle(''); setDescription('');
      setTargetCoins(''); setTargetGiftId(''); setTargetCount('1');
      setRewardGems('0'); setIconType('emoji'); setIconValue('🎁');
      setSortOrder('0');
    }
    setFile(null); setError('');
  }, [editing, open]);

  const save = async () => {
    if (!title.trim() || !description.trim()) { setError('Title and description required.'); return; }
    setSaving(true); setError('');
    const form = new FormData();
    form.append('title', title.trim()); form.append('description', description.trim());
    form.append('type', type); form.append('target_count', targetCount);
    form.append('reward_gems', rewardGems); form.append('sort_order', sortOrder);
    // keep min/max level as fixed defaults so backend doesn't break
    form.append('min_level', '0'); form.append('max_level', '100');
    if (targetCoins) form.append('target_coins', targetCoins);
    if (targetGiftId) form.append('target_gift_id', targetGiftId);
    if (targetGiftId && selectedGift) {
      // Gift selected → use gift image as icon automatically
      form.append('icon_type', 'image');
      form.append('icon_value', selectedGift.image_url ?? '');
    } else if (file) {
      form.append('icon_image', file);
    } else if (iconType === 'emoji' && iconValue === '__coin__') {
      // Coin quick-pick — store as a special emoji marker the app renders as the coin image
      form.append('icon_type', 'emoji');
      form.append('icon_value', '🪙');
    } else {
      form.append('icon_type', iconType);
      form.append('icon_value', iconValue);
    }

    const res = editing
      ? await api.uploadPatch<Task>(`/tasks/admin/${editing.id}`, form)
      : await api.upload<Task>('/tasks/admin', form);
    setSaving(false);
    if (!res.ok) { setError(res.message); return; }
    onSaved(res.data, !editing);
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-[420px] bg-white h-full shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">{editing ? 'Edit Task' : 'New Task'}</h2>
          <button onClick={onClose} className="text-gray-400 text-xl font-bold">×</button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Title *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Gift Master"
              className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Description *</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
              placeholder="e.g. Receive 5,000 coins worth of gifts in your chatroom"
              className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none" />
          </div>

          <div className="p-3 bg-gray-50 rounded-xl space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Target (pick one)</p>
            {/* Coin target */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Coin target (total coins gifted)</label>
              <input type="number" min="1" value={targetCoins}
                onChange={e => { setTargetCoins(e.target.value); if (e.target.value) setTargetGiftId(''); }}
                placeholder="e.g. 5000"
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
            </div>

            {/* Specific gift — with image preview */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Specific gift</label>
              <div className="flex items-center gap-2">
                {/* Gift image preview */}
                <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center shrink-0 border border-purple-100">
                  {selectedGift && resolveImg(selectedGift.image_url)
                    ? <img src={resolveImg(selectedGift.image_url)!} className="w-7 h-7 object-contain" />
                    : <span className="text-lg">🎁</span>
                  }
                </div>
                <select value={targetGiftId}
                  onChange={e => { setTargetGiftId(e.target.value); if (e.target.value) setTargetCoins(''); }}
                  className="flex-1 border border-gray-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400">
                  <option value="">— Any gift —</option>
                  {gifts.map(g => (
                    <option key={g.id} value={g.id}>{g.name} ({g.coins} coins)</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Count needed</label>
              <input type="number" min="1" value={targetCount} onChange={e => setTargetCount(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Reward Gems</label>
              <input type="number" min="0" value={rewardGems} onChange={e => setRewardGems(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Sort Order</label>
              <input type="number" min="0" value={sortOrder} onChange={e => setSortOrder(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
            </div>
          </div>

          {/* Icon — auto-filled when a gift is selected */}
          {targetGiftId ? (
            <div className="flex items-center gap-3 p-3 bg-purple-50 border border-purple-100 rounded-xl">
              <div className="w-12 h-12 rounded-xl bg-white border border-purple-200 flex items-center justify-center shrink-0">
                {selectedGift && resolveImg(selectedGift.image_url)
                  ? <img src={resolveImg(selectedGift.image_url)!} className="w-9 h-9 object-contain" />
                  : <span className="text-2xl">🎁</span>
                }
              </div>
              <div>
                <p className="text-sm font-semibold text-purple-700">Icon auto-set from gift</p>
                <p className="text-xs text-purple-400">The selected gift image will be used as the task icon</p>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-2">Icon</label>

              {/* Quick-pick emoji buttons */}
              <div className="flex items-center gap-2 mb-3">
                <p className="text-xs text-gray-400">Quick pick:</p>
                {/* Gift box */}
                <button
                  onClick={() => { setIconType('emoji'); setIconValue('🎁'); setFile(null); }}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl border-2 transition-all ${iconType === 'emoji' && iconValue === '🎁' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-purple-200'}`}>
                  🎁
                </button>
                {/* Coin image — same as app */}
                <button
                  onClick={() => { setIconType('emoji'); setIconValue('__coin__'); setFile(null); }}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center border-2 transition-all ${iconType === 'emoji' && iconValue === '__coin__' ? 'border-amber-400 bg-amber-50' : 'border-gray-200 hover:border-amber-200'}`}>
                  <img src={coinImg} className="w-7 h-7 object-contain" />
                </button>
              </div>

              {/* Emoji / Image toggle */}
              <div className="flex gap-3 mb-2">
                <button onClick={() => setIconType('emoji')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold border ${iconType === 'emoji' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-200 text-gray-500'}`}>
                  Emoji
                </button>
                <button onClick={() => { setIconType('image'); fileRef.current?.click(); }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold border ${iconType === 'image' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-200 text-gray-500'}`}>
                  Upload Image
                </button>
              </div>

              {iconType === 'emoji' && iconValue !== '__coin__' && (
                <input value={iconValue} onChange={e => setIconValue(e.target.value)} placeholder="🎁" maxLength={4}
                  className="w-24 border border-gray-200 rounded-xl px-3.5 py-2.5 text-2xl text-center focus:outline-none focus:ring-2 focus:ring-purple-400" />
              )}
              {iconType === 'emoji' && iconValue === '__coin__' && (
                <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl w-fit">
                  <img src={coinImg} className="w-7 h-7 object-contain" />
                  <span className="text-xs font-semibold text-amber-700">Coin icon selected</span>
                </div>
              )}
              {iconType === 'image' && (
                <div className="flex items-center gap-3">
                  {file && <img src={URL.createObjectURL(file)} className="w-12 h-12 object-contain rounded-lg" />}
                  {!file && editing?.icon_type === 'image' && resolveImg(editing.icon_value) && (
                    <img src={resolveImg(editing.icon_value)!} className="w-12 h-12 object-contain rounded-lg" />
                  )}
                  <button onClick={() => fileRef.current?.click()} className="text-sm text-purple-600 font-semibold">
                    {file ? 'Change image' : 'Choose image'}
                  </button>
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/png,image/gif" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) { setFile(f); setIconType('image'); } }} />
            </div>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
        <div className="px-6 py-5 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={save} disabled={saving} className="flex-1 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50">
            {saving ? 'Saving…' : editing ? 'Save' : 'Create Task'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<'all' | 'daily'>('all');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<Task[]>('/tasks/admin'),
      api.get<Gift[]>('/admin/gifts'),
    ]).then(([t, g]) => {
      if (t.ok) setTasks(t.data);
      if (g.ok) setGifts(g.data);
      setLoading(false);
    });
  }, []);

  const toggleActive = async (task: Task) => {
    const form = new FormData();
    form.append('is_active', String(!task.is_active));
    const res = await api.uploadPatch<Task>(`/tasks/admin/${task.id}`, form);
    if (res.ok) setTasks(prev => prev.map(t => t.id === task.id ? res.data : t));
  };

  const deleteTask = async (id: string) => {
    if (!confirm('Delete this task?')) return;
    await api.delete(`/tasks/admin/${id}`);
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const filtered = filterType === 'all' ? tasks : tasks.filter(t => t.type === filterType);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Tasks</h1>
          <p className="text-sm text-gray-400 mt-0.5">Daily &amp; weekly tasks shown in the app</p>
        </div>
        <button onClick={() => { setEditing(null); setDrawerOpen(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl text-sm font-semibold hover:opacity-90 shadow-md shadow-purple-200">
          + New Task
        </button>
      </div>

      <div className="flex gap-2 mb-4">
        {(['all', 'daily'] as const).map(f => (
          <button key={f} onClick={() => setFilterType(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold capitalize ${filterType === f ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
            {f} {f !== 'all' && `(${tasks.filter(t => t.type === f).length})`}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-50 bg-gray-50">
              {['Task', 'Target', 'Reward', 'Status', ''].map(h => (
                <th key={h} className="px-5 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={5} className="text-center py-12 text-gray-400">Loading…</td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan={5} className="text-center py-12 text-gray-400">No tasks yet.</td></tr>}
            {filtered.map(task => {
              // If task targets a specific gift, show the gift image as the icon
              const iconImgUrl = task.target_gift_id
                ? resolveImg(task.gift_image_url)
                : task.icon_type === 'image' ? resolveImg(task.icon_value) : null;
              const giftImg = task.target_gift_id ? resolveImg(task.gift_image_url) : null;
              return (
                <tr key={task.id} className={`border-b border-gray-50 hover:bg-gray-50 group ${!task.is_active ? 'opacity-50' : ''}`}>
                  {/* Task icon + title */}
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center shrink-0">
                        {iconImgUrl
                          ? <img src={iconImgUrl} className="w-8 h-8 object-contain" />
                          : <span className="text-xl">{task.icon_value}</span>}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{task.title}</p>
                        <p className="text-xs text-gray-400 truncate max-w-[180px]">{task.description}</p>
                      </div>
                    </div>
                  </td>

                  {/* Target — show gift image or coin icon */}
                  <td className="px-5 py-3">
                    {task.target_gift_id ? (
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center border border-purple-100 shrink-0">
                          {giftImg
                            ? <img src={giftImg} className="w-6 h-6 object-contain" />
                            : <span className="text-base">🎁</span>}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-700">{task.gift_name}</p>
                          <p className="text-[10px] text-gray-400">× {task.target_count}</p>
                        </div>
                      </div>
                    ) : task.target_coins ? (
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center border border-amber-100 shrink-0">
                          <span className="text-base">🪙</span>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-700">{task.target_coins.toLocaleString()}</p>
                          <p className="text-[10px] text-gray-400">coins</p>
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>

                  {/* Reward */}
                  <td className="px-5 py-3">
                    <span className="text-xs font-bold text-purple-600">💎 {task.reward_gems} gems</span>
                  </td>

                  {/* Toggle */}
                  <td className="px-5 py-3">
                    <button onClick={() => toggleActive(task)}
                      className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${task.is_active ? 'bg-purple-500' : 'bg-gray-200'}`}>
                      <span className={`inline-block w-4 h-4 rounded-full bg-white shadow mt-0.5 transition-transform ${task.is_active ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                  </td>

                  {/* Actions */}
                  <td className="px-5 py-3">
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditing(task); setDrawerOpen(true); }} className="text-xs font-semibold text-purple-600 hover:bg-purple-50 px-2 py-1 rounded-lg">Edit</button>
                      <button onClick={() => deleteTask(task.id)} className="text-xs font-semibold text-red-500 hover:bg-red-50 px-2 py-1 rounded-lg">Del</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <TaskDrawer open={drawerOpen} editing={editing} gifts={gifts}
        onClose={() => { setDrawerOpen(false); setEditing(null); }}
        onSaved={(task, isNew) => {
          setTasks(prev => isNew ? [...prev, task] : prev.map(t => t.id === task.id ? task : t));
          setDrawerOpen(false); setEditing(null);
        }} />
    </div>
  );
}
