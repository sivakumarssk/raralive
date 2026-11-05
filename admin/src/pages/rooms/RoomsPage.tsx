import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { DropdownMenu } from '../../components/ui/DropdownMenu';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://192.168.0.6:5000';

// ── Types ──────────────────────────────────────────────────────────────────────

type Room = {
  id: string;
  room_name: string;
  description: string | null;
  agency_id: string;
  agency_name: string;
  host_id: string;
  host_name: string | null;
  host_username: string | null;
  host_phone: string;
  host_avatar_url: string | null;
  room_image_url: string | null;
  status: 'active' | 'closed' | 'banned';
  created_at: string;
};

// ── Avatar ─────────────────────────────────────────────────────────────────────

function Avatar({ name, phone, avatarUrl, size = 8 }: { name?: string | null; phone?: string; avatarUrl?: string | null; size?: number }) {
  const label = (name || phone || '?').trim();
  const initials = label.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  if (avatarUrl) {
    const url = avatarUrl.startsWith('http') ? avatarUrl : `${API_BASE}/${avatarUrl.replace(/^\//, '')}`;
    return (
      <img
        src={url}
        alt={initials}
        className={`w-${size} h-${size} rounded-full object-cover shrink-0`}
        onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
      />
    );
  }

  const colors = ['from-violet-500 to-purple-700', 'from-pink-500 to-rose-600', 'from-orange-400 to-orange-600', 'from-teal-400 to-emerald-600', 'from-blue-400 to-blue-600'];
  const seed = phone ? phone.charCodeAt(phone.length - 1) : label.charCodeAt(0);
  const color = colors[seed % colors.length];

  return (
    <div className={`w-${size} h-${size} rounded-full bg-gradient-to-br ${color} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
      {initials}
    </div>
  );
}

// ── Status Badge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Room['status'] }) {
  const styles = {
    active: 'bg-emerald-50 text-emerald-600',
    closed: 'bg-gray-100 text-gray-400',
    banned: 'bg-red-50 text-red-500',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${styles[status]}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// ── Room 3-dot menu ────────────────────────────────────────────────────────────

function RoomMenu({ roomId }: { roomId: string }) {
  const navigate = useNavigate();
  return (
    <DropdownMenu items={[
      {
        label: 'Gift History',
        icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 00-2-2H5.5a2.5 2.5 0 000 5H12zm0 0h6.5a2.5 2.5 0 000-5H15a2 2 0 00-2 2v1z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14v3a9 9 0 01-14 0V8z" /></svg>,
        onClick: () => navigate(`/rooms/${roomId}/gifts`),
      },
    ]} />
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [agencyRoomCounts, setAgencyRoomCounts] = useState<Record<string, number>>({});
  const [visibilityTab, setVisibilityTab] = useState<'all' | 'public' | 'private'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'closed' | 'banned'>('all');
  const LIMIT = 50;

  const fetchRooms = async (q = search, p = page, vis = visibilityTab, st = statusFilter) => {
    setLoading(true);
    const params = new URLSearchParams({ search: q, page: String(p), limit: String(LIMIT) });
    if (vis !== 'all') params.set('visibility', vis);
    if (st !== 'all') params.set('status', st);
    const result = await api.get<{
      rooms: Room[];
      agency_room_counts: Record<string, number>;
      pagination: { total: number; pages: number };
    }>(`/admin/rooms?${params}`);
    setLoading(false);
    if (result.ok) {
      setRooms(result.data.rooms);
      setTotal(result.data.pagination.total);
      setAgencyRoomCounts(result.data.agency_room_counts);
    }
  };

  useEffect(() => { fetchRooms(); }, []);
  useEffect(() => { setPage(1); fetchRooms(search, 1, visibilityTab, statusFilter); }, [visibilityTab, statusFilter]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setSearch(q);
    setPage(1);
    fetchRooms(q, 1);
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Chat Rooms</h1>
        <p className="text-gray-400 text-sm mt-1">All rooms created across agencies</p>
      </div>

      {/* Visibility tabs */}
      <div className="flex gap-2 mb-4">
        {(['all', 'public', 'private'] as const).map(v => (
          <button key={v} onClick={() => setVisibilityTab(v)}
            className={`px-5 py-2 rounded-full text-sm font-semibold capitalize transition-colors ${visibilityTab === v ? 'bg-purple-600 text-white shadow-md shadow-purple-200' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}>
            {v}
          </button>
        ))}
        <div className="w-px bg-gray-200 mx-1 self-stretch" />
        {(['all', 'active', 'closed', 'banned'] as const).map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-4 py-2 rounded-full text-sm font-semibold capitalize transition-colors ${statusFilter === s ? 'bg-gray-800 text-white' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}>
            {s}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="relative">
            <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={handleSearch}
              placeholder="Search rooms or agencies…"
              className="pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-100 rounded-lg outline-none focus:border-purple-300 focus:bg-white transition-all w-64"
            />
          </div>
          <span className="text-xs text-gray-400 font-medium">{total.toLocaleString()} {total === 1 ? 'room' : 'rooms'}</span>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <svg className="animate-spin w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          </div>
        ) : rooms.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-pink-50 flex items-center justify-center mb-3">
              <svg className="w-7 h-7 text-pink-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-gray-400">
              {search ? 'No rooms match your search' : 'No rooms yet'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-50">
                    {['Room', 'Agency', 'Host', 'Status', 'Created', ''].map(h => (
                      <th key={h} className="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-widest">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rooms.map(room => (
                    <tr key={room.id} className="hover:bg-gray-50/60 transition-colors">
                      {/* Room */}
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar
                            name={room.room_name}
                            phone={room.host_phone}
                            avatarUrl={room.room_image_url}
                            size={9}
                          />
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-800 truncate">{room.room_name}</p>
                            {room.description && (
                              <p className="text-xs text-gray-400 truncate max-w-[200px]">{room.description}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Agency */}
                      <td className="px-6 py-3">
                        <div>
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-full">
                            {room.agency_name}
                          </span>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {agencyRoomCounts[room.agency_id] ?? 1} {(agencyRoomCounts[room.agency_id] ?? 1) === 1 ? 'room' : 'rooms'}
                          </p>
                        </div>
                      </td>

                      {/* Host */}
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <Avatar name={room.host_name} phone={room.host_phone} avatarUrl={room.host_avatar_url} size={7} />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-700 truncate">
                              {room.host_name || <span className="text-gray-400 italic text-xs">No name</span>}
                            </p>
                            <p className="text-xs text-gray-400 font-mono">{room.host_phone}</p>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-3">
                        <StatusBadge status={room.status} />
                      </td>

                      {/* Created */}
                      <td className="px-6 py-3 text-gray-400 text-xs whitespace-nowrap">
                        {new Date(room.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-3">
                        <RoomMenu roomId={room.id} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-50 flex items-center justify-between">
                <p className="text-xs text-gray-400">
                  Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total.toLocaleString()}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { const p = page - 1; setPage(p); fetchRooms(search, p); }}
                    disabled={page === 1}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                    Previous
                  </button>
                  <span className="text-xs text-gray-400 font-medium">{page} / {totalPages}</span>
                  <button
                    onClick={() => { const p = page + 1; setPage(p); fetchRooms(search, p); }}
                    disabled={page >= totalPages}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

    </div>
  );
}
