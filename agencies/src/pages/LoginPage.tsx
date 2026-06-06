import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import raraLogo from '../assets/raralogo.png';

type LoginData = {
  token: string;
  isDefaultPassword: boolean;
  agency: { id: string; agencyName: string; agentCode: string; phone: string };
};

export function LoginPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { login } = useAuth();

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim() || !password) { setError('Phone and password are required.'); return; }
    setLoading(true); setError('');

    const result = await api.post<LoginData>('/agency/login', {
      agentCode: code?.toUpperCase(),
      phone: phone.trim(),
      password,
    });

    setLoading(false);
    if (!result.ok) { setError(result.message); return; }

    const { token, isDefaultPassword, agency } = result.data;
    login(token, agency, isDefaultPassword);

    if (isDefaultPassword) {
      navigate(`/agency/${code?.toUpperCase()}/reset-password`, { replace: true });
    } else {
      navigate(`/agency/${code?.toUpperCase()}/dashboard`, { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#EDE8F7] via-[#F5F2FF] to-[#FFF0F8] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white shadow-lg shadow-purple-100 mb-4 p-2">
            <img src={raraLogo} alt="Rara Live" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Agency Sign In</h1>
          <p className="text-sm text-gray-400 mt-1">
            Code: <span className="font-mono font-bold text-purple-600">{code?.toUpperCase()}</span>
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl shadow-purple-100 p-8">
          <h2 className="text-xl font-bold text-gray-800 mb-1">Welcome back</h2>
          <p className="text-sm text-gray-400 mb-6">Sign in with your registered phone number</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Phone */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Phone Number</label>
              <div className="flex items-center gap-3 bg-gray-50 border border-transparent rounded-xl px-4 h-12 focus-within:border-purple-400 focus-within:bg-white transition-all">
                <svg className="w-4 h-4 text-purple-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => { setPhone(e.target.value); setError(''); }}
                  placeholder="+919876543210"
                  className="flex-1 bg-transparent text-sm text-gray-800 outline-none placeholder-gray-400"
                  autoComplete="tel"
                  autoFocus
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Password</label>
              <div className="flex items-center gap-3 bg-gray-50 border border-transparent rounded-xl px-4 h-12 focus-within:border-purple-400 focus-within:bg-white transition-all">
                <svg className="w-4 h-4 text-purple-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  placeholder="••••••••"
                  className="flex-1 bg-transparent text-sm text-gray-800 outline-none placeholder-gray-400"
                  autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowPass(v => !v)} className="text-gray-400 hover:text-purple-500 transition-colors">
                  {showPass
                    ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-red-600 font-medium">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-[#7A0EED] to-[#B50357] text-white font-bold text-sm tracking-wide shadow-lg shadow-purple-200 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed mt-2">
              {loading
                ? <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Signing in…
                  </span>
                : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">Rara Live Agency Portal · Restricted Access</p>
      </div>
    </div>
  );
}
