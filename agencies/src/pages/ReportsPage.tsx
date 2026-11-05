import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Card, DateFilter, ErrorNote, Loading, PageHeader, Stat, Table, buttonPrimary, coins, inr, monthRange } from '../components/ui';
import type { Range } from '../components/ui';

type Column = { key: string; header: string; format?: string };
type Sheet = { name: string; columns: Column[]; rows: Record<string, string | number | null>[] };
type Report = {
  title: string;
  totals: { coins: number; gems?: number; amount?: number; transactions?: number };
  sheets: Sheet[];
};

const REPORTS = [
  { type: 'chatroom', label: 'Audio Chat Room' },
  { type: 'live', label: 'Video Live' },
  { type: 'friendzone', label: 'Friend Zone' },
  { type: 'recharge', label: 'Coin Recharge', agencyOnly: true },
];

function cell(value: string | number | null, column: Column) {
  if (value === null || value === undefined) return '—';
  if (column.key === 'amount') return inr(Number(value));
  if (typeof value === 'number') return coins(value);
  return value;
}

export function ReportsPage() {
  const { poc } = useAuth();
  const types = REPORTS.filter(r => !(poc && r.agencyOnly));
  const [type, setType] = useState(types[0].type);
  const [range, setRange] = useState<Range>(monthRange);
  const [group, setGroup] = useState<'day' | 'month'>('day');
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  const query = `from=${range.from}&to=${range.to}&group=${group}`;

  useEffect(() => {
    setReport(null);
    setError('');
    api.get<Report>(`/agency-portal/reports/${type}?${query}`).then(r => {
      if (r.ok) setReport(r.data);
      else setError(r.message);
    });
  }, [type, query]);

  const exportExcel = async () => {
    setExporting(true);
    const r = await api.download(`/agency-portal/reports/${type}/export?${query}`, `${type}-report-${range.from}-to-${range.to}.xlsx`);
    setExporting(false);
    if (!r.ok) setError(r.message);
  };

  return (
    <>
      <PageHeader
        title="Reports / Excel"
        subtitle="Your agency's own data, ready to view or download."
        action={<button onClick={exportExcel} disabled={exporting} className={buttonPrimary}>{exporting ? 'Preparing…' : 'Export Excel'}</button>}
      />

      <div className="flex flex-wrap gap-2 mb-4">
        {types.map(r => (
          <button
            key={r.type}
            onClick={() => setType(r.type)}
            className={`px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${
              type === r.type ? 'bg-purple-600 text-white' : 'bg-white border border-gray-200 text-gray-600'
            }`}>
            {r.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <DateFilter value={range} onChange={setRange} />
        {type !== 'recharge' && (
          <select value={group} onChange={e => setGroup(e.target.value as 'day' | 'month')} className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white">
            <option value="day">Date-wise</option>
            <option value="month">Month-wise</option>
          </select>
        )}
      </div>

      {error && <div className="mb-4"><ErrorNote text={error} /></div>}
      {!report ? (!error && <Loading />) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
            {report.totals.transactions !== undefined && <Stat label="Recharges" value={coins(report.totals.transactions)} />}
            <Stat label="Coins" value={coins(report.totals.coins)} tone="purple" />
            {report.totals.gems !== undefined && <Stat label="Gems" value={coins(report.totals.gems)} />}
            {report.totals.amount !== undefined && <Stat label="Amount" value={inr(report.totals.amount)} tone="green" />}
          </div>
          <div className="space-y-4">
            {report.sheets.map(sheet => (
              <Card key={sheet.name} title={sheet.name}>
                <Table
                  rows={sheet.rows}
                  rowKey={row => String(row.transaction_id ?? row.period ?? row.id)}
                  empty="No data in this period"
                  columns={sheet.columns.filter(c => c.key !== 'link' && c.key !== 'profile_link').map(c => ({
                    header: c.header,
                    align: c.format ? ('right' as const) : undefined,
                    render: (row: Sheet['rows'][number]) => cell(row[c.key], c),
                  }))}
                />
              </Card>
            ))}
          </div>
        </>
      )}
    </>
  );
}
