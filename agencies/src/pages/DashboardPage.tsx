import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import raraLogo from '../assets/raralogo.png';

export function DashboardPage() {
  const { code } = useParams<{ code: string }>();
  const { agency, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate(`/agency/${code?.toUpperCase()}`, { replace: true });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-100 shadow-sm px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={raraLogo} alt="Rara Live" className="w-8 h-8 rounded-lg object-contain" />
          <div>
            <p className="font-black text-gray-900 text-base leading-none tracking-tight">
              {agency?.agencyName || 'Agency'}
            </p>
            <p className="text-xs text-purple-500 font-semibold mt-0.5 font-mono">{agency?.agentCode}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-red-500 font-medium transition-colors px-3 py-2 rounded-lg hover:bg-red-50">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sign out
        </button>
      </header>

      {/* Content */}
      <main className="p-6 max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">
            Welcome, <span className="text-purple-600 font-semibold">{agency?.agencyName}</span>
          </p>
        </div>

        {/* Placeholder */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-purple-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <p className="text-base font-bold text-gray-400">Agency Dashboard</p>
          <p className="text-sm text-gray-300 mt-1">More features coming soon</p>
        </div>
      </main>
    </div>
  );
}
