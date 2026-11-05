import { useEffect, useState } from 'react';
import { api } from '../api/client';
import {
  Badge, Card, CopyLink, DateFilter, ErrorNote, Loading, PageHeader, Stat, Table,
  buttonSecondary, coins, dateOnly, dateTime, inr, monthRange,
} from '../components/ui';
import type { Column, Range } from '../components/ui';

export type Service = 'chatroom' | 'live' | 'friendzone';

type Profile = { id: string; name: string; handle: string; avatar_url: string | null; link: string };
type Item = {
  id: string; title: string; status: string; host: string; link: string; created_at: string;
  code?: string; visibility?: string; level?: number; coins?: number; online?: number; host_online?: boolean;
  ended_at?: string | null; duration_seconds?: number | null; calls?: number; last_call?: string | null;
};
type Activity = { profiles: Profile[]; items: Item[] };
type Period = { period: string; coins: number; gems: number; amount: number };
type ProfileRow = { id: string; name: string; handle: string; link: string; coins: number; gems: number; amount: number };
type Gifting = { totals: { coins: number; gems: number; amount: number }; rows: Period[]; by_profile: ProfileRow[] };

const PAGES: Record<Service, { title: string; subtitle: string; itemsTitle: string; empty: string }> = {
  chatroom: { title: 'Audio Chat Room', subtitle: 'Your rooms, their links and gifting.', itemsTitle: 'Groups / Rooms', empty: 'No rooms created yet' },
  live: { title: 'Video Live', subtitle: 'Live sessions by your agency profiles, and gifting.', itemsTitle: 'Live activity', empty: 'No live sessions yet' },
  friendzone: { title: 'Friend Zone', subtitle: 'Friend Zone profiles from your agency, and gifting.', itemsTitle: 'Friend Zone profiles', empty: 'No Friend Zone profiles yet' },
};

const duration = (s?: number | null) => {
  if (s == null) return 'Live now';
  const m = Math.floor(s / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m ${s % 60}s`;
};

function itemColumns(service: Service): Column<Item>[] {
  const link: Column<Item> = { header: 'Link', render: i => <CopyLink value={i.link} /> };
  if (service === 'chatroom') {
    return [
      { header: 'Room', render: i => <span className="font-semibold text-gray-900">{i.title}</span> },
      { header: 'Code', render: i => <span className="font-mono text-xs">{i.code}</span> },
      { header: 'Host', render: i => i.host },
      { header: 'Status', render: i => <Badge status={i.status} /> },
      { header: 'Host on stage', render: i => (i.host_online ? 'Yes' : 'No') },
      { header: 'Online', align: 'right', render: i => i.online ?? 0 },
      { header: 'Level', align: 'right', render: i => i.level ?? 0 },
      { header: 'Total coins', align: 'right', render: i => coins(i.coins ?? 0) },
      { header: 'Created', render: i => dateOnly(i.created_at) },
      link,
    ];
  }
  if (service === 'live') {
    return [
      { header: 'Host', render: i => <span className="font-semibold text-gray-900">{i.host}</span> },
      { header: 'Status', render: i => <Badge status={i.status} /> },
      { header: 'Started', render: i => dateTime(i.created_at) },
      { header: 'Duration', render: i => duration(i.duration_seconds) },
      link,
    ];
  }
  return [
    { header: 'Profile', render: i => <span className="font-semibold text-gray-900">{i.title}</span> },
    { header: 'Handle', render: i => i.host },
    { header: 'Status', render: i => <Badge status={i.status} /> },
    { header: 'Calls', align: 'right', render: i => i.calls ?? 0 },
    { header: 'Last call', render: i => (i.last_call ? dateTime(i.last_call) : '—') },
    { header: 'Applied', render: i => dateOnly(i.created_at) },
    link,
  ];
}

const money: Column<{ coins: number; gems: number; amount: number }>[] = [
  { header: 'Coins', align: 'right', render: r => coins(r.coins) },
  { header: 'Gems', align: 'right', render: r => coins(r.gems) },
  { header: 'Amount', align: 'right', render: r => inr(r.amount) },
];

export function ServicePage({ service }: { service: Service }) {
  const page = PAGES[service];
  const [activity, setActivity] = useState<Activity | null>(null);
  const [gifting, setGifting] = useState<Gifting | null>(null);
  const [range, setRange] = useState<Range>(monthRange);
  const [group, setGroup] = useState<'day' | 'month'>('day');
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setActivity(null);
    api.get<Activity>(`/agency-portal/services/${service}`).then(r => {
      if (r.ok) setActivity(r.data);
      else setError(r.message);
    });
  }, [service]);

  const query = `from=${range.from}&to=${range.to}&group=${group}`;

  useEffect(() => {
    setGifting(null);
    api.get<Gifting>(`/agency-portal/services/${service}/gifting?${query}`).then(r => {
      if (r.ok) setGifting(r.data);
      else setError(r.message);
    });
  }, [service, query]);

  const exportExcel = async () => {
    setExporting(true);
    const r = await api.download(`/agency-portal/reports/${service}/export?${query}`, `${service}-${range.from}-to-${range.to}.xlsx`);
    setExporting(false);
    if (!r.ok) setError(r.message);
  };

  if (error) return <ErrorNote text={error} />;

  return (
    <>
      <PageHeader title={page.title} subtitle={page.subtitle} />

      <Card title={page.itemsTitle} className="mb-4">
        {!activity ? <Loading /> : (
          <Table rows={activity.items} rowKey={i => i.id} empty={page.empty} columns={itemColumns(service)} />
        )}
      </Card>

      <Card title="Agency profiles" className="mb-4">
        {!activity ? <Loading /> : (
          <Table
            rows={activity.profiles}
            rowKey={p => p.id}
            empty="No profiles yet"
            columns={[
              { header: 'Name', render: p => <span className="font-semibold text-gray-900">{p.name}</span> },
              { header: 'Handle', render: p => p.handle },
              { header: 'Profile link', render: p => <CopyLink value={p.link} /> },
            ]}
          />
        )}
      </Card>

      <Card
        title="Gifting summary"
        action={
          <button onClick={exportExcel} disabled={exporting} className={buttonSecondary}>
            {exporting ? 'Preparing…' : 'Export Excel'}
          </button>
        }>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <DateFilter value={range} onChange={setRange} />
          <select value={group} onChange={e => setGroup(e.target.value as 'day' | 'month')} className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white">
            <option value="day">Date-wise</option>
            <option value="month">Month-wise</option>
          </select>
        </div>

        {!gifting ? <Loading /> : (
          <>
            <div className="grid grid-cols-3 gap-3 mb-5">
              <Stat label="Coins" value={coins(gifting.totals.coins)} />
              <Stat label="Gems" value={coins(gifting.totals.gems)} />
              <Stat label="Amount" value={inr(gifting.totals.amount)} tone="green" />
            </div>
            <div className="grid lg:grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">{group === 'month' ? 'Month-wise' : 'Date-wise'}</p>
                <Table
                  rows={gifting.rows}
                  rowKey={r => r.period}
                  empty="No gifting in this period"
                  columns={[{ header: group === 'month' ? 'Month' : 'Date', render: (r: Period) => r.period }, ...money]}
                />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">By profile</p>
                <Table
                  rows={gifting.by_profile}
                  rowKey={r => r.id}
                  empty="No gifting in this period"
                  columns={[{ header: 'Profile', render: (r: ProfileRow) => r.name }, ...money]}
                />
              </div>
            </div>
          </>
        )}
      </Card>
    </>
  );
}
