import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api/client';

type Room = {
  id: string; room_name: string; room_code: string;
  visibility: 'public' | 'private'; status: 'active' | 'closed' | 'banned';
  total_coins_received: number; current_level: number; created_at: string;
  host_name: string | null; host_username: string | null; host_phone: string;
};

export function AgencyRoomsPage() {
  const { agencyId } = useParams<{ agencyId: string }>();
  const navigate = useNavigate();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibility, setVisibility] = useState<'all' | 'public' | 'private'>('all');
  const [status, setStatus] = useState<'all' | 'active' | 'closed' | 'banned'>('all');
  const [agencyName, setAgencyName] = useState('');

  const load = async () => {
    if (!agencyId) return;
    setLoading(true);
    const params = new URLSearchParams();
    if (visibility !== 'all') params.set('visibility', visibility);
    if (status !== 'all') params.set('status', status);
    const res = await api.get<Room[]>(`/admin/agencies/${agencyId}/rooms?${params}`);
    if (res.ok) setRooms(res.data);
    setLoading(false);
  };

  useEffect(() => { load(); }, [agencyId, visibility, status]);

  // Try to get agency name from first room or from agencies list
  useEffect(() => {
    api.get<any[]>('/admin/agencies').then(r => {
      if (r.ok) {
        const found = (r.data as any[]).find((a: any) => a.id === agencyId);
        if (found) setAgencyName(found.agency_name);
      }
    });
  }, [agencyId]);

  const statusColor: Record<string, string> = {
    active: 'bg-emerald-50 text-emerald-700',
    closed: 'bg-gray-100 text-gray-500',
    banned: 'bg-red-50 text-red-600',
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/agencies')}
          className="text-sm text-gray-500 hover:text-gray-800 font-semibold">
          ← Agencies
        </button>
        <div>
          <h1 className="text-2xl font-black text-gray-900">Rooms</h1>
          {agencyName && <p className="text-sm text-gray-400 mt-0.5">{agencyName}</p>}
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={() => navigate(`/agencies/${agencyId}/coins`)}
            className="px-4 py-2 border border-purple-200 text-purple-600 rounded-xl text-sm font-semibold hover:bg-purple-50">
            Coin History
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {(['all', 'public', 'private'] as const).map(v => (
          <button key={v} onClick={() => setVisibility(v)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold capitalize ${visibility === v ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
            {v}
          </button>
        ))}
        <div className="w-px bg-gray-200 mx-1" />
        {(['all', 'active', 'closed', 'banned'] as const).map(s => (
          <button key={s} onClick={() => setStatus(s)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold capitalize ${status === s ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
            {s}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-50 bg-gray-50">
              {['Room', 'Code', 'Host', 'Visibility', 'Status', 'Level', 'Coins', 'Created'].map(h => (
                <th key={h} className="px-5 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={8} className="text-center py-12 text-gray-400">Loading…</td></tr>}
            {!loading && rooms.length === 0 && <tr><td colSpan={8} className="text-center py-12 text-gray-400">No rooms found.</td></tr>}
            {rooms.map(room => (
              <tr key={room.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-5 py-3 font-semibold text-gray-900 max-w-[160px] truncate">{room.room_name}</td>
                <td className="px-5 py-3 font-mono text-xs text-gray-500">{room.room_code}</td>
                <td className="px-5 py-3 text-gray-600 text-xs">{room.host_name || room.host_username || room.host_phone}</td>
                <td className="px-5 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${room.visibility === 'public' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                    {room.visibility}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusColor[room.status]}`}>
                    {room.status}
                  </span>
                </td>
                <td className="px-5 py-3 text-gray-700 font-semibold">Lv {room.current_level}</td>
                <td className="px-5 py-3 text-amber-600 font-semibold text-xs">{room.total_coins_received.toLocaleString()}</td>
                <td className="px-5 py-3 text-gray-400 text-xs">
                  {new Date(room.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
