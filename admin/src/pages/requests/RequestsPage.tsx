import { useSearchParams } from 'react-router-dom';
import { FriendZonePage } from '../friend-zone/FriendZonePage';
import { GoLivePage } from '../go-live/GoLivePage';
import { usePendingRequestCounts, type PendingRequestCounts } from './usePendingRequestCounts';

// All user requests that unlock an account feature, reviewed in one place.
// The active tab lives in the URL (?tab=go-live) so it survives refresh and
// can be linked to directly.

type TabKey = 'friend-zone' | 'go-live';

const TABS: {
  key: TabKey;
  label: string;
  description: string;
  countKey: keyof PendingRequestCounts;
  icon: React.ReactNode;
}[] = [
  {
    key: 'friend-zone',
    label: 'Friend Zone',
    description: 'Users applying to join Friend Zone and receive calls',
    countKey: 'friendZone',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 21C12 21 4 15.5 4 9.5C4 6.5 6.5 4 9.5 4C11 4 12 5 12 5C12 5 13 4 14.5 4C17.5 4 20 6.5 20 9.5C20 15.5 12 21 12 21Z" />
      </svg>
    ),
  },
  {
    key: 'go-live',
    label: 'Go Live',
    description: 'Users asking for permission to broadcast live',
    countKey: 'goLive',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    ),
  },
];

export function RequestsPage() {
  const [params, setParams] = useSearchParams();
  const active: TabKey = params.get('tab') === 'go-live' ? 'go-live' : 'friend-zone';
  const { counts, total, refresh } = usePendingRequestCounts();

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Requests</h1>
          <p className="text-gray-400 text-sm mt-1">Review and approve user applications in one place</p>
        </div>
        <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${total > 0 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
          {total > 0 ? `${total} pending` : 'All caught up'}
        </span>
      </div>

      {/* Tabs — one card per request type, with its pending count */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        {TABS.map(tab => {
          const isActive = tab.key === active;
          const pending = counts[tab.countKey];
          return (
            <button
              key={tab.key}
              onClick={() => setParams({ tab: tab.key }, { replace: true })}
              className={`flex items-center gap-4 text-left px-5 py-4 rounded-2xl border transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 border-transparent text-white shadow-md shadow-purple-200'
                  : 'bg-white border-gray-100 text-gray-700 hover:border-purple-200 hover:shadow-sm'
              }`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isActive ? 'bg-white/20' : 'bg-purple-50 text-purple-600'}`}>
                {tab.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black">{tab.label}</p>
                <p className={`text-xs mt-0.5 truncate ${isActive ? 'text-white/80' : 'text-gray-400'}`}>{tab.description}</p>
              </div>
              {pending > 0 && (
                <span className={`min-w-[28px] h-7 px-2 rounded-full flex items-center justify-center text-xs font-black ${
                  isActive ? 'bg-white text-purple-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {pending}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* key= remounts the list when switching tabs so each starts on "Pending" */}
      {active === 'friend-zone'
        ? <FriendZonePage key="friend-zone" embedded onChanged={refresh} />
        : <GoLivePage key="go-live" embedded onChanged={refresh} />}
    </div>
  );
}
