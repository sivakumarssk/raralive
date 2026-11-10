import { Link } from 'react-router-dom';
import raraLogo from '../assets/raralogo.png';

/** The portal's bare address when nobody is signed in. */
export function PortalHome() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#EDE8F7] via-[#F5F2FF] to-[#FFF0F8] flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-lg shadow-purple-100 p-8 max-w-sm w-full text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white shadow-md shadow-purple-100 p-2 mb-4">
          <img src={raraLogo} alt="Rara Live" className="w-full h-full object-contain" />
        </div>
        <h1 className="text-lg font-bold text-gray-900">Rara Live Agency Portal</h1>
        <p className="text-sm text-gray-500 mt-2">
          Agencies sign in from their own agency link (it looks like <span className="font-mono">/agency/AGTRARA-001</span>).
          Ask your admin if you don't have it.
        </p>
        <Link
          to="/poc/login"
          className="mt-6 block w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold text-sm">
          POC sign in
        </Link>
      </div>
    </div>
  );
}
