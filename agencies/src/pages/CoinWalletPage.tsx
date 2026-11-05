import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { usePortalBase } from '../components/PortalLayout';
import { Badge, Card, ErrorNote, Loading, PageHeader, Stat, Table, buttonPrimary, coins, dateTime, input } from '../components/ui';

type LedgerRow = {
  transaction_id: string; type: string; direction: 'in' | 'out'; coins: number;
  balance_after: number; party: string; note: string | null; created_at: string;
};
type CoinRequest = { request_code: string; coins: number; extra_coins: number; status: string; admin_note: string | null; created_at: string };
type Wallet = {
  balance: number;
  stats: { received: number; used_today: number; transactions: number };
  low_balance: boolean;
  low_balance_threshold: number;
  request_slabs: number[];
  ledger: LedgerRow[];
  requests: CoinRequest[];
};

export function CoinWalletPage() {
  const base = usePortalBase();
  const [data, setData] = useState<Wallet | null>(null);
  const [error, setError] = useState('');
  const [slab, setSlab] = useState('');
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState('');

  const load = () => api.get<Wallet>('/agency-portal/wallet').then(r => {
    if (r.ok) setData(r.data);
    else setError(r.message);
  });
  useEffect(() => { load(); }, []);

  const requestCoins = async () => {
    if (!slab) return;
    setSending(true);
    setNotice('');
    const r = await api.post<{ request_code: string }>('/agency-portal/wallet/requests', { coins: Number(slab) });
    setSending(false);
    if (r.ok) {
      setNotice(`Request ${r.data.request_code} sent to the Official.`);
      setSlab('');
      load();
    } else setError(r.message);
  };

  if (error) return <ErrorNote text={error} />;
  if (!data) return <Loading />;

  return (
    <>
      <PageHeader
        title="Coin Wallet"
        subtitle="Your agency balance and every coin in and out."
        action={<Link to={`${base}/recharge-user`} className={buttonPrimary}>Recharge User</Link>}
      />

      {data.low_balance && (
        <div className="mb-4">
          <ErrorNote text={`Low balance: under ${coins(data.low_balance_threshold)} coins. Request more below.`} />
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Stat label="Current balance" value={coins(data.balance)} tone={data.low_balance ? 'amber' : 'purple'} />
        <Stat label="Received from Official" value={coins(data.stats.received)} />
        <Stat label="Used today" value={coins(data.stats.used_today)} />
        <Stat label="Recharges" value={coins(data.stats.transactions)} />
      </div>

      <Card title="Wallet ledger" className="mb-4">
        <Table
          rows={data.ledger}
          rowKey={l => l.transaction_id}
          empty="No wallet activity yet"
          columns={[
            { header: 'Date & time', render: l => dateTime(l.created_at) },
            { header: 'Type', render: l => (l.direction === 'in' ? 'Official credit' : 'Recharge to user') },
            { header: 'Party', render: l => l.party },
            { header: 'Coins', align: 'right', render: l => <span className={l.direction === 'in' ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>{l.direction === 'in' ? '+' : '−'}{coins(l.coins)}</span> },
            { header: 'Balance after', align: 'right', render: l => coins(l.balance_after) },
            { header: 'Transaction ID', render: l => <span className="font-mono text-xs">{l.transaction_id}</span> },
          ]}
        />
      </Card>

      <Card title="Request coins from the Official">
        {notice && <p className="text-sm font-medium text-green-700 bg-green-50 rounded-xl px-4 py-3 mb-3">{notice}</p>}
        <div className="flex flex-wrap gap-2 mb-5">
          <select value={slab} onChange={e => setSlab(e.target.value)} className={`${input} sm:w-56`}>
            <option value="">Choose coins</option>
            {data.request_slabs.map(s => <option key={s} value={s}>{coins(s)} coins</option>)}
          </select>
          <button onClick={requestCoins} disabled={!slab || sending} className={buttonPrimary}>
            {sending ? 'Sending…' : 'Send request'}
          </button>
        </div>
        <Table
          rows={data.requests}
          rowKey={r => r.request_code}
          empty="No requests yet"
          columns={[
            { header: 'Requested', render: r => dateTime(r.created_at) },
            { header: 'Request ID', render: r => <span className="font-mono text-xs">{r.request_code}</span> },
            { header: 'Coins', align: 'right', render: r => coins(r.coins + r.extra_coins) },
            { header: 'Status', render: r => <Badge status={r.status} /> },
            { header: 'Note', render: r => r.admin_note ?? '—' },
          ]}
        />
      </Card>
    </>
  );
}
