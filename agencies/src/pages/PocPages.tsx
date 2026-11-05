import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Badge, Empty, ErrorNote, Loading, buttonPrimary, input } from '../components/ui';
import raraLogo from '../assets/raralogo.png';

export function PocLoginPage() {
  const { loginPoc } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const r = await api.post<{ token: string; poc: { id: string; name: string } }>('/agency-portal/poc/login', { email, password });
    setBusy(false);
    if (r.ok) {
      loginPoc(r.data.token, r.data.poc);
      navigate('/poc/agencies', { replace: true });
    } else setError(r.message);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <form onSubmit={submit} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 w-full max-w-sm space-y-3">
        <div className="text-center mb-2">
          <img src={raraLogo} alt="RaRa Live" className="w-12 h-12 mx-auto object-contain" />
          <h1 className="text-xl font-black text-gray-900 mt-2">POC sign in</h1>
          <p className="text-sm text-gray-500">Access your assigned agencies.</p>
        </div>
        {error && <ErrorNote text={error} />}
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" required className={input} />
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" required className={input} />
        <button type="submit" disabled={busy} className={`${buttonPrimary} w-full`}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  );
}

type AssignedAgency = { id: string; agency_name: string; agent_code: string; status: string };

export function PocAgenciesPage() {
  const { poc, selectPocAgency, logout } = useAuth();
  const navigate = useNavigate();
  const [agencies, setAgencies] = useState<AssignedAgency[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<AssignedAgency[]>('/agency-portal/poc/agencies').then(r => {
      if (r.ok) setAgencies(r.data);
      else setError(r.message);
    });
  }, []);

  const open = (a: AssignedAgency) => {
    selectPocAgency({ id: a.id, agencyName: a.agency_name, agentCode: a.agent_code });
    navigate(`/poc/${a.id}/dashboard`);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-black text-gray-900">Assigned agencies</h1>
            <p className="text-sm text-gray-500">Signed in as {poc?.name}</p>
          </div>
          <button
            onClick={() => { logout(); navigate('/poc/login', { replace: true }); }}
            className="text-sm font-semibold text-gray-500 hover:text-red-600">
            Sign out
          </button>
        </div>
        {error && <ErrorNote text={error} />}
        {!agencies ? (!error && <Loading />) : agencies.length === 0 ? (
          <Empty text="No agencies assigned to you yet" />
        ) : (
          <ul className="space-y-2">
            {agencies.map(a => (
              <li key={a.id}>
                <button
                  onClick={() => open(a)}
                  className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center justify-between gap-3 text-left hover:border-purple-300 transition-colors">
                  <div className="min-w-0">
                    <p className="font-bold text-gray-900 truncate">{a.agency_name}</p>
                    <p className="text-xs text-purple-500 font-mono">{a.agent_code}</p>
                  </div>
                  <Badge status={a.status} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
