import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { NotFoundPage } from './NotFoundPage';
import raraLogo from '../assets/raralogo.png';

type ValidateResult = {
  agentCode: string;
  agencyName: string;
};

type State = 'loading' | 'valid' | 'invalid' | 'suspended';

export function AgencyEntryPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<State>('loading');
  const [agencyName, setAgencyName] = useState('');
  const [suspendedMsg, setSuspendedMsg] = useState('');

  useEffect(() => {
    if (!code) { setState('invalid'); return; }

    api.get<ValidateResult>(`/agency/validate/${code.toUpperCase()}`).then(result => {
      if (!result.ok) {
        if (result.message.includes('suspended')) {
          setSuspendedMsg(result.message);
          setState('suspended');
        } else {
          setState('invalid');
        }
        return;
      }
      setAgencyName(result.data.agencyName);
      setState('valid');
    });
  }, [code]);

  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#EDE8F7] via-[#F5F2FF] to-[#FFF0F8] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-white shadow-lg shadow-purple-100 p-2 flex items-center justify-center">
            <img src={raraLogo} alt="Rara Live" className="w-full h-full object-contain" />
          </div>
          <svg className="animate-spin w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
        </div>
      </div>
    );
  }

  if (state === 'invalid') return <NotFoundPage />;

  if (state === 'suspended') {
    return <NotFoundPage message={suspendedMsg} />;
  }

  // valid — show the landing with "Sign In" button
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#EDE8F7] via-[#F5F2FF] to-[#FFF0F8] flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Logo + branding */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-white shadow-xl shadow-purple-100 mb-5 p-3">
            <img src={raraLogo} alt="Rara Live" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Rara Live</h1>
          <p className="text-sm text-gray-500 mt-1 font-medium">Agency Portal</p>
        </div>

        {/* Agency card */}
        <div className="bg-white rounded-3xl shadow-xl shadow-purple-100 p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>

          <h2 className="text-xl font-black text-gray-900 mb-1">{agencyName}</h2>
          <p className="text-xs text-gray-400 font-medium mb-1">
            <span className="font-mono bg-purple-50 text-purple-600 px-2 py-0.5 rounded-md">{code?.toUpperCase()}</span>
          </p>
          <p className="text-sm text-gray-400 mt-3 mb-7">
            Welcome to your agency portal. Sign in with your phone number and password to continue.
          </p>

          <button
            onClick={() => navigate(`/agency/${code?.toUpperCase()}/login`)}
            className="w-full h-12 rounded-xl bg-gradient-to-r from-[#7A0EED] to-[#B50357] text-white font-bold text-sm tracking-wide shadow-lg shadow-purple-200 hover:opacity-90 active:scale-[0.98] transition-all">
            Sign In to Agency Portal
          </button>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">Rara Live Agency Portal · Restricted Access</p>
      </div>
    </div>
  );
}
