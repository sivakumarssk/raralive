import { useEffect, useState } from 'react';
import { api } from '../api/client';
import {
  Badge, Card, CopyLink, DateFilter, ErrorNote, Loading, PageHeader, Stat, Table,
  buttonSecondary, coins, dateOnly, monthRange, timeOnly,
} from '../components/ui';
import type { Range } from '../components/ui';

type Recharge = {
  transaction_id: string; user_name: string; handle: string; uid: string | null; profile_link: string | null;
  coins: number; created_at: string; status: string;
};

export function RechargeHistoryPage() {
  const [range, setRange] = useState<Range>(monthRange);
  const [rows, setRows] = useState<Recharge[] | null>(null);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  const query = `from=${range.from}&to=${range.to}`;

  useEffect(() => {
    setRows(null);
    api.get<Recharge[]>(`/agency-portal/wallet/recharges?${query}`).then(r => {
      if (r.ok) setRows(r.data);
      else setError(r.message);
    });
  }, [query]);

  const exportExcel = async () => {
    setExporting(true);
    const r = await api.download(`/agency-portal/reports/recharge/export?${query}`, `recharges-${range.from}-to-${range.to}.xlsx`);
    setExporting(false);
    if (!r.ok) setError(r.message);
  };

  if (error) return <ErrorNote text={error} />;

  return (
    <>
      <PageHeader
        title="Recharge History"
        subtitle="Every coin recharge your agency has sent to a user."
        action={<button onClick={exportExcel} disabled={exporting} className={buttonSecondary}>{exporting ? 'Preparing…' : 'Export Excel'}</button>}
      />
      <div className="mb-4"><DateFilter value={range} onChange={setRange} /></div>

      {rows && (
        <div className="grid grid-cols-2 gap-3 mb-4 max-w-md">
          <Stat label="Recharges" value={coins(rows.length)} />
          <Stat label="Coins sent" value={coins(rows.reduce((sum, r) => sum + r.coins, 0))} tone="purple" />
        </div>
      )}

      <Card>
        {!rows ? <Loading /> : (
          <Table
            rows={rows}
            rowKey={r => r.transaction_id}
            empty="No recharges in this period"
            columns={[
              { header: 'User Name', render: r => <span className="font-semibold text-gray-900">{r.user_name}</span> },
              { header: 'Handle', render: r => r.handle },
              { header: 'UID', render: r => (r.uid ? <span className="font-mono text-xs" title={r.uid}>{r.uid.slice(0, 8)}…</span> : '—') },
              { header: 'Profile Link', render: r => (r.profile_link ? <CopyLink value={r.profile_link} /> : '—') },
              { header: 'Coins', align: 'right', render: r => coins(r.coins) },
              { header: 'Date', render: r => dateOnly(r.created_at) },
              { header: 'Time', render: r => timeOnly(r.created_at) },
              { header: 'Status', render: r => <Badge status={r.status} /> },
              { header: 'Transaction ID', render: r => <span className="font-mono text-xs">{r.transaction_id}</span> },
            ]}
          />
        )}
      </Card>
    </>
  );
}
