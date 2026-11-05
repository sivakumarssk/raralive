import { useEffect, useState } from 'react';
import { api } from '../../api/client';

type SupportRequest = {
  id: string;
  type: 'help' | 'report';
  message: string;
  status: 'open' | 'resolved';
  created_at: string;
  room_id: string | null;
  room_name: string | null;
  user_id: string | null;
  full_name: string | null;
  username: string | null;
  phone: string | null;
};

type StatusFilter = 'open' | 'resolved' | 'all';
type TypeFilter = 'help' | 'report' | 'all';

const TYPE_LABEL: Record<SupportRequest['type'], string> = {
  help: 'Help & Support',
  report: 'Report Chatroom',
};

export function SupportPage() {
  const [items, setItems] = useState<SupportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StatusFilter>('open');
  const [type, setType] = useState<TypeFilter>('all');

  const load = () => {
    setLoading(true);
    const q = new URLSearchParams();
    if (status !== 'all') q.set('status', status);
    if (type !== 'all') q.set('type', type);
    api.get<SupportRequest[]>(`/support/admin?${q.toString()}`)
      .then(r => { if (r.ok) setItems(r.data); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [status, type]);

  const setItemStatus = async (id: string, next: SupportRequest['status']) => {
    const r = await api.patch<{ id: string; status: SupportRequest['status'] }>(`/support/admin/${id}/status`, { status: next });
    if (!r.ok) return;
    // Drop it from a filtered list it no longer belongs to
    setItems(prev => status !== 'all' && status !== next
      ? prev.filter(i => i.id !== id)
      : prev.map(i => i.id === id ? { ...i, status: next } : i));
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this message?')) return;
    const r = await api.delete(`/support/admin/${id}`);
    if (r.ok) setItems(prev => prev.filter(i => i.id !== id));
  };

  const chip = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
      active ? 'bg-purple-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
    }`;

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Support</h1>
        <p className="text-sm text-gray-500 mt-1">Chatroom Help &amp; Support and Report Chatroom messages sent from the app</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {(['open', 'resolved', 'all'] as StatusFilter[]).map(s => (
          <button key={s} onClick={() => setStatus(s)} className={chip(status === s)}>
            {s === 'all' ? 'All statuses' : s === 'open' ? 'Open' : 'Resolved'}
          </button>
        ))}
        <span className="w-px h-5 bg-gray-200 mx-1" />
        {(['all', 'help', 'report'] as TypeFilter[]).map(t => (
          <button key={t} onClick={() => setType(t)} className={chip(type === t)}>
            {t === 'all' ? 'All types' : TYPE_LABEL[t]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <p className="text-gray-400 font-medium">No messages</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <div key={item.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${
                  item.type === 'report' ? 'bg-red-50 text-red-600' : 'bg-purple-50 text-purple-700'
                }`}>
                  {TYPE_LABEL[item.type] ?? item.type}
                </span>
                <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${
                  item.status === 'open' ? 'bg-amber-50 text-amber-600' : 'bg-green-50 text-green-600'
                }`}>
                  {item.status === 'open' ? 'Open' : 'Resolved'}
                </span>
                <span className="text-xs text-gray-400 ml-auto">{new Date(item.created_at).toLocaleString()}</span>
              </div>

              <p className="mt-3 text-sm text-gray-800 whitespace-pre-wrap break-words">{item.message}</p>

              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500">
                <span>
                  <span className="text-gray-400">From: </span>
                  {item.full_name || item.username || 'Unknown user'}
                  {item.username && item.full_name ? ` (@${item.username})` : ''}
                  {item.phone ? ` · ${item.phone}` : ''}
                </span>
                {(item.room_name || item.room_id) && (
                  <span><span className="text-gray-400">Chatroom: </span>{item.room_name ?? item.room_id}</span>
                )}
              </div>

              <div className="flex gap-2 mt-3">
                {item.status === 'open' ? (
                  <button
                    onClick={() => setItemStatus(item.id, 'resolved')}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-50 text-green-600 hover:bg-green-100 transition-colors">
                    Mark resolved
                  </button>
                ) : (
                  <button
                    onClick={() => setItemStatus(item.id, 'open')}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors">
                    Reopen
                  </button>
                )}
                <button
                  onClick={() => handleDelete(item.id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-500 hover:bg-red-100 transition-colors">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
