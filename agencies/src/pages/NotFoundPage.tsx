import raraLogo from '../assets/raralogo.png';

export function NotFoundPage({ message }: { message?: string }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#EDE8F7] via-[#F5F2FF] to-[#FFF0F8] flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-white shadow-xl shadow-purple-100 mb-6 p-3">
          <img src={raraLogo} alt="Rara Live" className="w-full h-full object-contain" />
        </div>
        <div className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#7A0EED] to-[#B50357] mb-4">
          404
        </div>
        {/* <h1 className="text-2xl font-black text-gray-900 mb-2">Agency Not Found</h1>
        <p className="text-gray-500 text-sm leading-relaxed">
          {message || 'This agency link is invalid or does not exist. Please contact your administrator for the correct link.'}
        </p> */}
        {/* <div className="mt-8 inline-flex items-center gap-2 text-xs text-gray-400">
          <img src={raraLogo} alt="" className="w-4 h-4 object-contain opacity-50" />
          Rara Live — Agency Portal
        </div> */}
      </div>
    </div>
  );
}
