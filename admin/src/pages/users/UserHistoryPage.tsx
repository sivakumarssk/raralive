import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api/client';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://192.168.0.8:5000';

type GiftEvent = {
  id: string; gift_name: string; gift_image_url: string | null;
  coins: number; quantity: number; created_at: string;
  room_name: string; recipient_name: string | null; recipient_username: string | null;
};
type User = { id: string; full_name: string | null; username: string | null; phone: string };

function resolveImg(url: string | null) {
  if (!url) return null;
  return url.startsWith('http') ? url : `${API_BASE}/${url.replace(/^\//, '')}`;
}

function monthLabel(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

export function UserHistoryPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();

  const [user, setUser] = useState<User | null>(null);
  const [events, setEvents] = useState<GiftEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const load = async () => {
    if (!userId) return;
    setLoading(true);
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const [uRes, hRes] = await Promise.all([
      api.get<any>(`/admin/wallet/user/${userId}`),
      api.get<any>(`/tasks/admin/gift-history/user/${userId}?${params}`),
    ]);
    if (uRes.ok) setUser(uRes.data.user);
    if (hRes.ok) setEvents((hRes.data as any).data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [userId]);

  // Group by month
  const grouped = events.reduce<Record<string, GiftEvent[]>>((acc, ev) => {
    const key = monthLabel(ev.created_at);
    if (!acc[key]) acc[key] = [];
    acc[key].push(ev);
    return acc;
  }, {});

  const totalCoins = events.reduce((s, e) => s + e.coins * e.quantity, 0);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/users')}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 font-semibold">
          ← Users
        </button>
        <div>
          <h1 className="text-2xl font-black text-gray-900">Gift Spending History</h1>
          {user && (
            <p className="text-sm text-gray-400 mt-0.5">
              {user.full_name ?? ''} {user.username ? `· @${user.username}` : ''} · {user.phone}
            </p>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-gray-500">From</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-gray-500">To</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
        </div>
        <button onClick={load}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700">
          Apply
        </button>
        {(from || to) && (
          <button onClick={() => { setFrom(''); setTo(''); setTimeout(load, 0); }}
            className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-semibold hover:bg-gray-200">
            Clear
          </button>
        )}
        {!loading && (
          <div className="ml-auto text-sm text-gray-500">
            <span className="font-semibold text-gray-900">{events.length}</span> gifts ·
            <span className="font-semibold text-amber-600 ml-1">{totalCoins.toLocaleString()} coins</span> spent
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <svg className="animate-spin w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-16 text-gray-400">No gift history found.</div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([month, evs]) => {
            const monthTotal = evs.reduce((s, e) => s + e.coins * e.quantity, 0);
            return (
              <div key={month} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-100">
                  <p className="font-bold text-gray-800">{month}</p>
                  <p className="text-sm font-semibold text-amber-600">{monthTotal.toLocaleString()} coins</p>
                </div>
                <div className="divide-y divide-gray-50">
                  {evs.map(ev => (
                    <div key={ev.id} className="flex items-center gap-4 px-5 py-3.5">
                      <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center shrink-0">
                        {resolveImg(ev.gift_image_url)
                          ? <img src={resolveImg(ev.gift_image_url)!} className="w-8 h-8 object-contain" />
                          : <span className="text-lg">🎁</span>
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">
                          {ev.gift_name} × {ev.quantity}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {ev.room_name} → {ev.recipient_name || ev.recipient_username || 'host'}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-amber-600">−{(ev.coins * ev.quantity).toLocaleString()}</p>
                        <p className="text-[11px] text-gray-400">
                          {new Date(ev.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}{' '}
                          {new Date(ev.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
