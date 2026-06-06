import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api/client';

type Transaction = {
  id: string;
  type: 'credit' | 'debit';
  coins: number;
  balance_after: number;
  description: string;
  created_at: string;
};

type User = { id: string; full_name: string | null; username: string | null; phone: string };

function monthLabel(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

export function UserRechargeHistoryPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();

  const [user, setUser] = useState<User | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [totalCoins, setTotalCoins] = useState(0);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const load = async (f = from, t = to) => {
    if (!userId) return;
    setLoading(true);
    const params = new URLSearchParams({ type: 'credit', limit: '500' });
    if (f) params.set('from', f);
    if (t) params.set('to', t);
    const res = await api.get<{
      user: User;
      transactions: Transaction[];
      total: number;
      total_coins: number;
    }>(`/admin/wallet/user/${userId}/transactions?${params}`);
    if (res.ok) {
      setUser(res.data.user);
      setTransactions(res.data.transactions);
      setTotal(res.data.total);
      setTotalCoins(res.data.total_coins);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [userId]);

  const grouped = transactions.reduce<Record<string, Transaction[]>>((acc, tx) => {
    const key = monthLabel(tx.created_at);
    if (!acc[key]) acc[key] = [];
    acc[key].push(tx);
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
        <button onClick={() => navigate('/users')}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 font-semibold">
          ← Users
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-black text-gray-900">Recharge History</h1>
          {user && (
            <p className="text-sm text-gray-400 mt-0.5">
              {user.full_name ?? ''}{user.username ? ` · @${user.username}` : ''} · {user.phone}
            </p>
          )}
        </div>
      </div>

      {/* Stats */}
      {!loading && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl px-5 py-4">
            <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">Total Recharged</p>
            <p className="text-2xl font-black text-emerald-700 mt-1">{totalCoins.toLocaleString()} <span className="text-sm font-semibold">coins</span></p>
          </div>
          <div className="bg-purple-50 border border-purple-100 rounded-2xl px-5 py-4">
            <p className="text-xs font-semibold text-purple-600 uppercase tracking-wide">Total Recharges</p>
            <p className="text-2xl font-black text-purple-700 mt-1">{total.toLocaleString()}</p>
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
      ) : transactions.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          No recharge history found{from || to ? ' for the selected period' : ''}.
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([month, txs]) => {
            const monthTotal = txs.reduce((s, t) => s + t.coins, 0);
            return (
              <div key={month} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-100">
                  <p className="font-bold text-gray-800">{month}</p>
                  <p className="text-sm font-semibold text-emerald-600">+{monthTotal.toLocaleString()} coins</p>
                </div>
                <div className="divide-y divide-gray-50">
                  {txs.map(tx => (
                    <div key={tx.id} className="flex items-center gap-4 px-5 py-3.5">
                      <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                        <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 9v1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{tx.description || 'Coin Recharge'}</p>
                        <p className="text-xs text-gray-400">Balance after: {tx.balance_after.toLocaleString()} coins</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-emerald-600">+{tx.coins.toLocaleString()}</p>
                        <p className="text-[11px] text-gray-400">
                          {new Date(tx.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}{' '}
                          {new Date(tx.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
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
