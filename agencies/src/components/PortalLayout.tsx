import { useState } from 'react';
import { NavLink, Outlet, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import raraLogo from '../assets/raralogo.png';

const ICONS: Record<string, string> = {
  dashboard: 'M3 12l9-9 9 9M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10',
  documents: 'M9 12h6m-6 4h6M7 3h7l5 5v12a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z',
  audio: 'M12 3a3 3 0 00-3 3v6a3 3 0 006 0V6a3 3 0 00-3-3zM5 11a7 7 0 0014 0M12 18v3',
  video: 'M15 10l4.5-2.5v9L15 14M4 7h9a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V9a2 2 0 012-2z',
  friends: 'M17 20v-2a4 4 0 00-3-3.9M9 11a4 4 0 100-8 4 4 0 000 8zM1 20v-2a4 4 0 014-4h8a4 4 0 014 4v2M16 3.1a4 4 0 010 7.8',
  wallet: 'M3 7a2 2 0 012-2h13a2 2 0 012 2v1H5a2 2 0 000 4h15v5a2 2 0 01-2 2H5a2 2 0 01-2-2V7zM16 12h.01',
  recharge: 'M12 5v14m-7-7h14',
  history: 'M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z',
  reports: 'M4 20V10m6 10V4m6 16v-7m4 7H2',
  support: 'M18.4 5.6a9 9 0 11-12.7 0M12 8a3 3 0 00-3 3M12 17h.01',
};

// The final portal menu, in order. Wallet items are the agency's alone.
const MENU: { to: string; label: string; icon: string; agencyOnly?: boolean }[] = [
  { to: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { to: 'onboarding', label: 'Onboarding & Documents', icon: 'documents' },
  { to: 'audio-chat-room', label: 'Audio Chat Room', icon: 'audio' },
  { to: 'video-live', label: 'Video Live', icon: 'video' },
  { to: 'friend-zone', label: 'Friend Zone', icon: 'friends' },
  { to: 'coin-wallet', label: 'Coin Wallet', icon: 'wallet', agencyOnly: true },
  { to: 'recharge-user', label: 'Recharge User', icon: 'recharge', agencyOnly: true },
  { to: 'recharge-history', label: 'Recharge History', icon: 'history', agencyOnly: true },
  { to: 'reports', label: 'Reports / Excel', icon: 'reports' },
  { to: 'support', label: 'Support', icon: 'support' },
];

function Icon({ name }: { name: string }) {
  return (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={ICONS[name]} />
    </svg>
  );
}

/** Where the portal lives for this session: /agency/CODE or /poc/AGENCY_ID. */
export function usePortalBase() {
  const { code, agencyId } = useParams<{ code?: string; agencyId?: string }>();
  return code ? `/agency/${code}` : `/poc/${agencyId}`;
}

export function PortalLayout() {
  const { agency, poc, pocAgency, logout, selectPocAgency } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const base = usePortalBase();

  const isPoc = !!poc;
  const name = isPoc ? pocAgency?.agencyName : agency?.agencyName;
  const code = isPoc ? pocAgency?.agentCode : agency?.agentCode;
  const items = MENU.filter(m => !(isPoc && m.agencyOnly));

  const signOut = () => {
    const target = isPoc ? '/poc/login' : `/agency/${agency?.agentCode}`;
    logout();
    navigate(target, { replace: true });
  };

  const sidebar = (
    <aside className="w-64 bg-white border-r border-gray-100 flex flex-col h-full">
      <div className="px-5 py-4 flex items-center gap-3 border-b border-gray-100">
        <img src={raraLogo} alt="RaRa Live" className="w-9 h-9 rounded-lg object-contain" />
        <div className="min-w-0">
          <p className="font-black text-gray-900 text-sm leading-tight truncate">{name || 'Agency'}</p>
          <p className="text-xs text-purple-500 font-semibold font-mono">{code}</p>
        </div>
      </div>
      {isPoc && (
        <div className="px-5 py-2.5 bg-purple-50 text-xs text-purple-700">
          <p className="font-semibold">POC: {poc?.name}</p>
          <button
            onClick={() => { selectPocAgency(null); navigate('/poc/agencies'); }}
            className="underline mt-0.5">
            Switch agency
          </button>
        </div>
      )}
      <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {items.map(item => (
          <NavLink
            key={item.to}
            to={`${base}/${item.to}`}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                isActive ? 'bg-purple-50 text-purple-700' : 'text-gray-600 hover:bg-gray-50'
              }`}>
            <Icon name={item.icon} />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="p-3 border-t border-gray-100">
        <button
          onClick={signOut}
          className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors">
          Sign out
        </button>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <div className="hidden lg:block fixed inset-y-0 left-0 z-20">{sidebar}</div>

      {open && (
        <div className="lg:hidden fixed inset-0 z-30 flex">
          <div className="h-full">{sidebar}</div>
          <button aria-label="Close menu" className="flex-1 bg-black/40" onClick={() => setOpen(false)} />
        </div>
      )}

      <div className="flex-1 min-w-0 lg:ml-64">
        <header className="lg:hidden sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
          <button aria-label="Open menu" onClick={() => setOpen(true)} className="text-gray-700">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <p className="font-bold text-gray-900 text-sm truncate">{name || 'Agency'}</p>
        </header>
        <main className="p-4 sm:p-6 max-w-6xl mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
