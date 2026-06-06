import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { DropdownMenu } from '../../components/ui/DropdownMenu';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://192.168.0.8:5000';

type User = {
  id: string;
  phone: string;
  email: string | null;
  username: string | null;
  full_name: string | null;
  gender: string | null;
  avatar_url: string | null;
  is_phone_verified: boolean;
  created_at: string;
};

type CoinPackage = {
  id: string;
  coins: number;
  price: string;
  original_price: string | null;
  discount: string;
  highlighted: boolean;
};

type WalletInfo = {
  user: { id: string; full_name: string | null; username: string | null; phone: string };
  coins: number;
  recent_transactions: Transaction[];
};

type Transaction = {
  id: string;
  type: 'credit' | 'debit';
  coins: number;
  balance_after: number;
  description: string;
  created_at: string;
};

// ── Avatar ─────────────────────────────────────────────────────────────────────

function Avatar({ user }: { user: User }) {
  const initials = (user.full_name || user.username || user.phone)
    .trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  if (user.avatar_url) {
    const url = user.avatar_url.startsWith('http')
      ? user.avatar_url
      : `${API_BASE}/${user.avatar_url.replace(/^\//, '')}`;
    return (
      <img src={url} alt={initials}
        className="w-8 h-8 rounded-full object-cover shrink-0"
        onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
    );
  }

  const colors = ['from-violet-500 to-purple-700', 'from-pink-500 to-rose-600',
    'from-orange-400 to-orange-600', 'from-teal-400 to-emerald-600', 'from-blue-400 to-blue-600'];
  const color = colors[user.phone.charCodeAt(user.phone.length - 1) % colors.length];
  return (
    <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${color} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
      {initials}
    </div>
  );
}

// ── Recharge Modal ─────────────────────────────────────────────────────────────

type GiftEvent = {
  id: string; gift_name: string; gift_image_url: string | null;
  coins: number; quantity: number; created_at: string;
  room_name: string; recipient_name: string | null; recipient_username: string | null;
};

function RechargeModal({ user, onClose }: { user: User; onClose: () => void }) {
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);
  const [packages, setPackages] = useState<CoinPackage[]>([]);
  const [selectedPkg, setSelectedPkg] = useState<CoinPackage | null>(null);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [giftHistory, setGiftHistory] = useState<GiftEvent[]>([]);
  const [activeTab, setActiveTab] = useState<'recharge' | 'gifts'>('recharge');

  useEffect(() => {
    Promise.all([
      api.get<WalletInfo>(`/admin/wallet/user/${user.id}`),
      api.get<CoinPackage[]>('/admin/coin-packages'),
      api.get<{ data: GiftEvent[] }>(`/tasks/admin/gift-history/user/${user.id}`),
    ]).then(([w, p, g]) => {
      if (w.ok) setWalletInfo(w.data);
      if (p.ok) setPackages(p.data.filter(pkg => pkg));
      if (g.ok) setGiftHistory((g.data as any).data ?? []);
      setLoading(false);
    });
  }, [user.id]);

  const handleRecharge = async () => {
    setError(''); setSuccess('');
    if (!selectedPkg) { setError('Select a package to recharge.'); return; }
    setSaving(true);
    const result = await api.post<{ coins_added: number; balance_after: number }>('/admin/wallet/recharge', {
      user_id: user.id,
      package_id: selectedPkg.id,
      description: description || undefined,
    });
    setSaving(false);
    if (!result.ok) { setError(result.message); return; }
    setSuccess(`✓ Added ${result.data.coins_added} coins. New balance: ${result.data.balance_after}`);
    if (walletInfo) setWalletInfo({ ...walletInfo, coins: result.data.balance_after });
    setSelectedPkg(null); setDescription('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-[520px] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">User Wallet</h2>
              <p className="text-sm text-gray-400 mt-0.5">
                {user.full_name && <span>{user.full_name} · </span>}
                {user.username ? <span className="text-purple-500">@{user.username}</span> : user.phone}
              </p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl font-bold leading-none">×</button>
          </div>
          <div className="flex gap-1 mt-3">
            {(['recharge', 'gifts'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold capitalize transition-colors ${activeTab === tab ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                {tab === 'recharge' ? 'Recharge' : 'Gift History'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {loading ? (
            <div className="flex justify-center py-10">
              <svg className="animate-spin w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
            </div>
          ) : activeTab === 'gifts' ? (
            /* Gift spending history */
            <div className="space-y-2">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                Coin Spending History ({giftHistory.length} gifts)
              </p>
              {giftHistory.length === 0 && <p className="text-sm text-gray-400 italic">No gifts sent yet.</p>}
              {giftHistory.map(ev => (
                <div key={ev.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                    {ev.gift_image_url
                      ? <img src={`${import.meta.env.VITE_API_URL ?? ''}/${ev.gift_image_url.replace(/^\//, '')}`} className="w-8 h-8 object-contain" />
                      : <span className="text-lg">🎁</span>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{ev.gift_name} × {ev.quantity}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {ev.room_name} → {ev.recipient_name || ev.recipient_username || 'host'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-amber-600">-{(ev.coins * ev.quantity).toLocaleString()} coins</p>
                    <p className="text-[10px] text-gray-400">{new Date(ev.created_at).toLocaleDateString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* Current balance */}
              <div className="flex items-center justify-between bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl px-4 py-3.5">
                <div>
                  <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Current Balance</p>
                  <p className="text-2xl font-black text-gray-900 mt-0.5">
                    {walletInfo?.coins.toLocaleString() ?? 0}
                    <span className="text-sm font-semibold text-gray-400 ml-1">coins</span>
                  </p>
                </div>
                <div className="text-xs text-gray-400 text-right space-y-0.5">
                  <p className="font-mono text-[10px] text-gray-300 select-all">{user.id}</p>
                  <p>{user.phone}</p>
                </div>
              </div>

              {/* Package selection */}
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Select Package</p>
                {packages.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">No packages available. Create some in Coin Packages.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2.5">
                    {packages.map(pkg => {
                      const price = parseFloat(pkg.price);
                      const isSelected = selectedPkg?.id === pkg.id;
                      return (
                        <button
                          key={pkg.id}
                          onClick={() => setSelectedPkg(isSelected ? null : pkg)}
                          className={`flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all text-left ${
                            isSelected ? 'border-purple-500 bg-purple-50' : 'border-gray-100 hover:border-purple-200 bg-white'
                          }`}>
                          <div>
                            <p className="font-black text-gray-900">{pkg.coins.toLocaleString()}</p>
                            <p className="text-[11px] text-gray-400 font-semibold uppercase">coins</p>
                          </div>
                          <div className={`text-sm font-bold px-3 py-1 rounded-full ${
                            pkg.highlighted ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700'
                          }`}>
                            ₹{price.toFixed(0)}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Note */}
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Note (optional)</p>
                <input
                  type="text"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="e.g. Bonus for active user"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
              </div>

              {/* Recent transactions */}
              {walletInfo && walletInfo.recent_transactions.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Recent Transactions</p>
                  <div className="space-y-1.5">
                    {walletInfo.recent_transactions.map(tx => (
                      <div key={tx.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50">
                        <div className="flex items-center gap-2">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                            tx.type === 'credit' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-500'
                          }`}>
                            {tx.type === 'credit' ? '+' : '-'}
                          </span>
                          <p className="text-xs text-gray-600 truncate max-w-[220px]">{tx.description}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`text-xs font-bold ${tx.type === 'credit' ? 'text-emerald-600' : 'text-red-500'}`}>
                            {tx.type === 'credit' ? '+' : '-'}{tx.coins}
                          </p>
                          <p className="text-[10px] text-gray-400">{new Date(tx.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {error && <p className="text-sm text-red-500 font-medium">{error}</p>}
              {success && <p className="text-sm text-emerald-600 font-semibold">{success}</p>}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">
            Close
          </button>
          <button
            onClick={handleRecharge}
            disabled={saving || loading || !selectedPkg}
            className="flex-1 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-40">
            {saving ? 'Adding…' : selectedPkg ? `Add ${selectedPkg.coins.toLocaleString()} Coins` : 'Select a Package'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

function ThreeDotMenu({ user, onRecharge }: { user: User; onRecharge: () => void }) {
  const navigate = useNavigate();
  return (
    <DropdownMenu items={[
      {
        label: 'Recharge Wallet',
        icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 9v1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
        onClick: onRecharge,
      },
      {
        label: 'Recharge History',
        icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>,
        onClick: () => navigate(`/users/${user.id}/recharge`),
      },
      {
        label: 'Gift History',
        icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>,
        onClick: () => navigate(`/users/${user.id}/history`),
      },
    ]} />
  );
}

export function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [rechargeUser, setRechargeUser] = useState<User | null>(null);
  const LIMIT = 50;

  const fetchUsers = async (q = search, p = page) => {
    setLoading(true);
    const result = await api.get<{ users: User[]; pagination: { total: number; pages: number } }>(
      `/admin/users?search=${encodeURIComponent(q)}&page=${p}&limit=${LIMIT}`
    );
    setLoading(false);
    if (result.ok) { setUsers(result.data.users); setTotal(result.data.pagination.total); }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value; setSearch(q); setPage(1); fetchUsers(q, 1);
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Users</h1>
        <p className="text-gray-400 text-sm mt-1">All registered users on Rara Live</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="relative">
            <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" value={search} onChange={handleSearch}
              placeholder="Search name, @username, phone…"
              className="pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-100 rounded-lg outline-none focus:border-purple-300 focus:bg-white transition-all w-72" />
          </div>
          <span className="text-xs text-gray-400 font-medium">{total.toLocaleString()} {total === 1 ? 'user' : 'users'}</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <svg className="animate-spin w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm font-semibold text-gray-400">{search ? 'No users match your search' : 'No users yet'}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-50">
                    {['User', 'User ID', 'Phone', 'Username', 'Verified', 'Joined', ''].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-widest">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-gray-50/60 transition-colors group">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar user={u} />
                          <p className="font-semibold text-gray-800 truncate max-w-[130px]">
                            {u.full_name || <span className="text-gray-400 font-normal italic">No name</span>}
                          </p>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className="font-mono text-[10px] text-gray-300 select-all">{u.id}</span>
                      </td>
                      <td className="px-5 py-3 text-gray-600 font-mono text-xs">{u.phone}</td>
                      <td className="px-5 py-3">
                        {u.username
                          ? <span className="text-purple-600 font-semibold text-xs">@{u.username}</span>
                          : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="px-5 py-3">
                        {u.is_phone_verified
                          ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                              Verified
                            </span>
                          : <span className="text-xs font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Unverified</span>}
                      </td>
                      <td className="px-5 py-3 text-gray-400 text-xs whitespace-nowrap">
                        {new Date(u.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-5 py-3">
                        <ThreeDotMenu user={u} onRecharge={() => setRechargeUser(u)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-50 flex items-center justify-between">
                <p className="text-xs text-gray-400">
                  Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total.toLocaleString()}
                </p>
                <div className="flex items-center gap-2">
                  <button onClick={() => { const p = page - 1; setPage(p); fetchUsers(search, p); }}
                    disabled={page === 1}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                    Previous
                  </button>
                  <span className="text-xs text-gray-400 font-medium">{page} / {totalPages}</span>
                  <button onClick={() => { const p = page + 1; setPage(p); fetchUsers(search, p); }}
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

      {rechargeUser && (
        <RechargeModal user={rechargeUser} onClose={() => setRechargeUser(null)} />
      )}
    </div>
  );
}
