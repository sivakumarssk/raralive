import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api/client';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://192.168.0.6:5000';

type GiftEvent = {
  id: string;
  coins: number;
  quantity: number;
  gift_name: string;
  gift_image_url: string | null;
  created_at: string;
  sender_name: string | null;
  sender_username: string | null;
  sender_avatar: string | null;
  recipient_name: string | null;
  recipient_username: string | null;
};

type RoomInfo = {
  id: string;
  room_name: string;
  agency_name: string;
};

function resolveImg(url: string | null) {
  if (!url) return null;
  return url.startsWith('http') ? url : `${API_BASE}/${url.replace(/^\//, '')}`;
}

function monthLabel(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

export function RoomGiftHistoryPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();

  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [events, setEvents] = useState<GiftEvent[]>([]);
  const [totalCoins, setTotalCoins] = useState(0);
  const [totalGifts, setTotalGifts] = useState(0);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const load = async (f = from, t = to) => {
    if (!roomId) return;
    setLoading(true);
    const params = new URLSearchParams({ limit: '500' });
    if (f) params.set('from', f);
    if (t) params.set('to', t);
    const res = await api.get<any>(`/tasks/admin/gift-history/room/${roomId}?${params}`);
    if (res.ok) {
      const evs: GiftEvent[] = (res.data as any).data ?? [];
      // Client-side date filter (backend may not support from/to yet)
      const filtered = evs.filter(e => {
        if (f && new Date(e.created_at) < new Date(f)) return false;
        if (t && new Date(e.created_at) > new Date(t + 'T23:59:59')) return false;
        return true;
      });
      setEvents(filtered);
      setTotalCoins(filtered.reduce((s, e) => s + e.coins * e.quantity, 0));
      setTotalGifts(filtered.reduce((s, e) => s + e.quantity, 0));
    }
    setLoading(false);
  };

  // Fetch room info from the rooms list
  useEffect(() => {
    if (!roomId) return;
    api.get<any>(`/admin/rooms?limit=200`).then(r => {
      if (r.ok) {
        const found = (r.data as any).rooms?.find((rm: any) => rm.id === roomId);
        if (found) setRoom({ id: found.id, room_name: found.room_name, agency_name: found.agency_name });
      }
    });
    load();
  }, [roomId]);

  const grouped = events.reduce<Record<string, GiftEvent[]>>((acc, ev) => {
    const key = monthLabel(ev.created_at);
    if (!acc[key]) acc[key] = [];
    acc[key].push(ev);
    return acc;
  }, {});

  const applyQuick = (months: number) => {
    const now = new Date();
    const t = now.toISOString().slice(0, 10);
    now.setMonth(now.getMonth() - months);
    const f = now.toISOString().slice(0, 10);
    setFrom(f);
    setTo(t);
    load(f, t);
  };

  const clearFilters = () => {
    setFrom('');
    setTo('');
    load('', '');
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/rooms')}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 font-semibold">
          ← Rooms
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-black text-gray-900">Gift History</h1>
          {room && (
            <p className="text-sm text-gray-400 mt-0.5">
              {room.room_name}{room.agency_name ? ` · ${room.agency_name}` : ''}
            </p>
          )}
        </div>
      </div>

      {/* Stats */}
      {!loading && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-amber-50 border border-amber-100 rounded-2xl px-5 py-4">
            <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide">Total Coins Received</p>
            <p className="text-2xl font-black text-amber-700 mt-1">{totalCoins.toLocaleString()}</p>
          </div>
          <div className="bg-purple-50 border border-purple-100 rounded-2xl px-5 py-4">
            <p className="text-xs font-semibold text-purple-600 uppercase tracking-wide">Total Gifts</p>
            <p className="text-2xl font-black text-purple-700 mt-1">{totalGifts.toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* Quick month filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {[
          { label: 'This month', months: 0 },
          { label: 'Last month', months: 1 },
          { label: 'Last 3 months', months: 3 },
          { label: 'Last 6 months', months: 6 },
        ].map(q => (
          <button key={q.label} onClick={() => applyQuick(q.months)}
            className="px-4 py-1.5 rounded-full text-sm font-semibold bg-gray-100 text-gray-600 hover:bg-purple-50 hover:text-purple-700 transition-colors">
            {q.label}
          </button>
        ))}
      </div>

      {/* Date range filter */}
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
        <button onClick={() => load()}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700">
          Apply
        </button>
        {(from || to) && (
          <button onClick={clearFilters}
            className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-semibold hover:bg-gray-200">
            Clear
          </button>
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
        <div className="text-center py-16 text-gray-400">
          No gift history found{from || to ? ' for the selected period' : ''}.
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([month, evs]) => {
            const monthCoins = evs.reduce((s, e) => s + e.coins * e.quantity, 0);
            const monthGifts = evs.reduce((s, e) => s + e.quantity, 0);
            return (
              <div key={month} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Month header */}
                <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-100">
                  <p className="font-bold text-gray-800">{month}</p>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400">{monthGifts} gifts</span>
                    <span className="text-sm font-semibold text-amber-600">+{monthCoins.toLocaleString()} coins</span>
                  </div>
                </div>

                {/* Gift rows */}
                <div className="divide-y divide-gray-50">
                  {evs.map(ev => (
                    <div key={ev.id} className="flex items-center gap-4 px-5 py-3.5">
                      {/* Gift image / emoji */}
                      <div className="w-11 h-11 rounded-xl bg-purple-50 flex items-center justify-center shrink-0 border border-purple-100">
                        {resolveImg(ev.gift_image_url)
                          ? <img src={resolveImg(ev.gift_image_url)!} className="w-8 h-8 object-contain" alt={ev.gift_name} />
                          : <span className="text-xl">🎁</span>
                        }
                      </div>

                      {/* Gift details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-bold text-gray-900">{ev.gift_name}</p>
                          {ev.quantity > 1 && (
                            <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-full">×{ev.quantity}</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">
                          <span className="font-semibold text-gray-700">
                            {ev.sender_name || (ev.sender_username ? `@${ev.sender_username}` : 'Unknown')}
                          </span>
                          {' → '}
                          <span className="font-semibold text-gray-700">
                            {ev.recipient_name || (ev.recipient_username ? `@${ev.recipient_username}` : 'host')}
                          </span>
                        </p>
                      </div>

                      {/* Coins + time */}
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-amber-600">+{(ev.coins * ev.quantity).toLocaleString()}</p>
                        <p className="text-[10px] text-gray-400">
                          {ev.coins.toLocaleString()} × {ev.quantity}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-0.5">
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
