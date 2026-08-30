import { useEffect, useState } from 'react';
import { api } from '../../api/client';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://192.168.0.9:5000';

// ── Types ──────────────────────────────────────────────────────────────────────

type CallGift = {
  id: string;
  call_id: string;
  gift_name: string;
  gift_image_url: string | null;
  coins: number;
  quantity: number;
  total_coins: number;
  created_at: string;
  call_type: 'audio' | 'video';
  sender_id: string;
  sender_name: string | null;
  sender_username: string | null;
  sender_avatar_url: string | null;
  recipient_id: string;
  recipient_name: string | null;
  recipient_username: string | null;
  recipient_avatar_url: string | null;
};

function resolveImg(url: string | null) {
  if (!url) return null;
  return url.startsWith('http') ? url : `${API_BASE}/${url.replace(/^\//, '')}`;
}

function personLabel(name: string | null, username: string | null): string {
  return name || username || 'Unknown';
}

function TypeBadge({ callType }: { callType: 'audio' | 'video' }) {
  const map: Record<'audio' | 'video', string> = {
    audio: 'bg-purple-50 text-purple-700',
    video: 'bg-indigo-50 text-indigo-700',
  };
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${map[callType]}`}>{callType}</span>;
}

// ── Main page ──────────────────────────────────────────────────────────────────

export function FriendZoneGiftsPage() {
  const [gifts, setGifts] = useState<CallGift[]>([]);
  const [total, setTotal] = useState(0);
  const [totalCoins, setTotalCoins] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchGifts = async () => {
    setLoading(true);
    const result = await api.get<{ gifts: CallGift[]; pagination: { total: number }; totalCoins: number }>(
      `/friend-zone/admin/gifts?limit=100`
    );
    setLoading(false);
    if (result.ok) {
      setGifts(result.data.gifts);
      setTotal(result.data.pagination.total);
      setTotalCoins(result.data.totalCoins);
    }
  };

  useEffect(() => { fetchGifts(); }, []);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Friend Zone Call Gifts</h1>
          <p className="text-gray-400 text-sm mt-1">Every gift sent during a 1:1 audio/video call — who sent it, to whom, and coins spent</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-widest">Total Coins Spent</p>
          <p className="text-2xl font-black text-purple-600">{totalCoins.toLocaleString()}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-700">All Call Gifts</span>
          <span className="text-xs text-gray-400 font-medium">{total} {total === 1 ? 'gift' : 'gifts'}</span>
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
            <p className="text-sm font-semibold text-gray-400">No call gifts sent yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-50">
                  {['Gift', 'Sender', 'Recipient', 'Call Type', 'Qty', 'Coins', 'Date'].map((h, i) => (
                    <th key={i} className="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {gifts.map(g => (
                  <tr key={g.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {resolveImg(g.gift_image_url) ? (
                          <img src={resolveImg(g.gift_image_url)!} className="w-8 h-8 object-contain" alt={g.gift_name} />
                        ) : (
                          <div className="w-8 h-8 rounded-md bg-gray-100" />
                        )}
                        <span className="font-semibold text-gray-800">{g.gift_name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-semibold text-gray-800">{personLabel(g.sender_name, g.sender_username)}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-semibold text-gray-800">{personLabel(g.recipient_name, g.recipient_username)}</p>
                    </td>
                    <td className="px-6 py-4"><TypeBadge callType={g.call_type} /></td>
                    <td className="px-6 py-4 text-gray-600 font-mono text-xs">x{g.quantity}</td>
                    <td className="px-6 py-4 text-gray-700 font-semibold">{g.total_coins}</td>
                    <td className="px-6 py-4 text-gray-400 text-xs">
                      {new Date(g.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
