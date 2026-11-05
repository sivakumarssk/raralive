import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { usePortalBase } from '../components/PortalLayout';
import { Badge, Card, Empty, ErrorNote, Loading, PageHeader, Stat, coins, dateOnly, dateTime } from '../components/ui';

type Notification = { kind: 'credit' | 'warning' | 'info'; text: string; at: string };
type Dashboard = {
  role: 'AGENCY' | 'POC';
  agency: { name: string; code: string; owner: string; status: string; services: string[]; onboarded_at: string };
  balance?: number;
  low_balance?: boolean;
  low_balance_threshold?: number;
  stats: { rooms: number; profiles: number; open_tickets: number; received?: number; used_today?: number; transactions?: number };
  notifications: Notification[];
};

const LINKS: { to: string; label: string; hint: string; agencyOnly?: boolean }[] = [
  { to: 'audio-chat-room', label: 'Audio Chat Room', hint: 'Rooms and gifting' },
  { to: 'video-live', label: 'Video Live', hint: 'Live activity and gifting' },
  { to: 'friend-zone', label: 'Friend Zone', hint: 'Profiles and gifting' },
  { to: 'coin-wallet', label: 'Coin Wallet', hint: 'Balance and ledger', agencyOnly: true },
  { to: 'reports', label: 'Reports', hint: 'Daily, monthly, Excel' },
];

const DOT = { credit: 'bg-green-500', warning: 'bg-amber-500', info: 'bg-blue-500' };

export function DashboardPage() {
  const base = usePortalBase();
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<Dashboard>('/agency-portal/dashboard').then(r => {
      if (r.ok) setData(r.data);
      else setError(r.message);
    });
  }, []);

  if (error) return <ErrorNote text={error} />;
  if (!data) return <Loading />;

  const { agency, stats } = data;
  const isAgency = data.role === 'AGENCY';

  return (
    <>
      <PageHeader title="Dashboard" subtitle={`Welcome, ${agency.name}`} />

      {data.low_balance && (
        <div className="mb-4">
          <ErrorNote text={`Low balance: ${coins(data.balance ?? 0)} coins left. Request more from Coin Wallet.`} />
        </div>
      )}

      <Card className="mb-4">
        <dl className="grid grid-cols-2 lg:grid-cols-5 gap-4 text-sm">
          <Info label="Agency Name" value={agency.name} />
          <Info label="Agency ID" value={agency.code} />
          <Info label="Owner Name" value={agency.owner} />
          <Info label="Onboarding Date" value={dateOnly(agency.onboarded_at)} />
          <div>
            <dt className="text-xs font-semibold text-gray-500">Status</dt>
            <dd className="mt-1"><Badge status={agency.status} /></dd>
          </div>
        </dl>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {isAgency && <Stat label="Coin Wallet" value={coins(data.balance ?? 0)} tone={data.low_balance ? 'amber' : 'purple'} />}
        {isAgency && <Stat label="Used today" value={coins(stats.used_today ?? 0)} />}
        <Stat label="Rooms" value={stats.rooms} />
        <Stat label="Agency profiles" value={stats.profiles} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card title="Quick links" className="lg:col-span-2">
          <div className="grid sm:grid-cols-2 gap-2">
            {LINKS.filter(l => isAgency || !l.agencyOnly).map(l => (
              <Link key={l.to} to={`${base}/${l.to}`} className="rounded-xl border border-gray-100 px-4 py-3 hover:border-purple-300 transition-colors">
                <p className="font-semibold text-sm text-gray-900">{l.label}</p>
                <p className="text-xs text-gray-500">{l.hint}</p>
              </Link>
            ))}
            <Link to={`${base}/support`} className="rounded-xl border border-gray-100 px-4 py-3 hover:border-purple-300 transition-colors">
              <p className="font-semibold text-sm text-gray-900">Help & Support</p>
              <p className="text-xs text-gray-500">{stats.open_tickets ? `${stats.open_tickets} open` : 'Contact the Official'}</p>
            </Link>
          </div>
        </Card>

        <Card title="Notifications">
          {data.notifications.length === 0 ? <Empty text="No notifications yet" /> : (
            <ul className="space-y-3">
              {data.notifications.map(n => (
                <li key={`${n.at}-${n.text}`} className="flex gap-2.5">
                  <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${DOT[n.kind]}`} />
                  <div className="min-w-0">
                    <p className="text-sm text-gray-700 break-words">{n.text}</p>
                    <p className="text-xs text-gray-400">{dateTime(n.at)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold text-gray-500">{label}</dt>
      <dd className="font-semibold text-gray-900 mt-1 truncate">{value}</dd>
    </div>
  );
}
