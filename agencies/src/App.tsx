import { BrowserRouter, Routes, Route, Navigate, Outlet, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { PortalLayout } from './components/PortalLayout';
import { AgencyEntryPage } from './pages/AgencyEntryPage';
import { LoginPage } from './pages/LoginPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { DashboardPage } from './pages/DashboardPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { ServicePage } from './pages/ServicePage';
import { CoinWalletPage } from './pages/CoinWalletPage';
import { RechargeUserPage } from './pages/RechargeUserPage';
import { RechargeHistoryPage } from './pages/RechargeHistoryPage';
import { ReportsPage } from './pages/ReportsPage';
import { SupportPage } from './pages/SupportPage';
import { PocAgenciesPage, PocLoginPage } from './pages/PocPages';
import { NotFoundPage } from './pages/NotFoundPage';
import { PortalHome } from './pages/PortalHome';

// Guard: must be logged in. If default password, force reset. Otherwise allow through.
function RequireAuth() {
  const { code } = useParams<{ code: string }>();
  const { token, agency, isDefaultPassword } = useAuth();
  if (!token || !agency) return <Navigate to={`/agency/${code}`} replace />;
  if (isDefaultPassword) return <Navigate to={`/agency/${code}/reset-password`} replace />;
  return <Outlet />;
}

// Guard: must be logged in with default password to access reset page
function RequireDefaultPassword({ children }: { children: React.ReactNode }) {
  const { code } = useParams<{ code: string }>();
  const { token, isDefaultPassword } = useAuth();
  if (!token) return <Navigate to={`/agency/${code}/login`} replace />;
  if (!isDefaultPassword) return <Navigate to={`/agency/${code}/dashboard`} replace />;
  return <>{children}</>;
}

// Guard: if already logged in, redirect away from login page
function RedirectIfAuth({ children }: { children: React.ReactNode }) {
  const { code } = useParams<{ code: string }>();
  const { token, isDefaultPassword } = useAuth();
  if (token) {
    if (isDefaultPassword) return <Navigate to={`/agency/${code}/reset-password`} replace />;
    return <Navigate to={`/agency/${code}/dashboard`} replace />;
  }
  return <>{children}</>;
}

// The bare site address: send a signed-in session back to its portal. Agencies
// sign in from their own link, so with no session there's nothing to open here
// except the POC sign-in.
function HomeRedirect() {
  const { token, agency, poc, pocAgency, isDefaultPassword } = useAuth();
  if (token && agency) {
    return <Navigate to={`/agency/${agency.agentCode}/${isDefaultPassword ? 'reset-password' : 'dashboard'}`} replace />;
  }
  if (token && poc) return <Navigate to={pocAgency ? `/poc/${pocAgency.id}/dashboard` : '/poc/agencies'} replace />;
  return <PortalHome />;
}

function RequirePoc() {
  const { token, poc } = useAuth();
  if (!token || !poc) return <Navigate to="/poc/login" replace />;
  return <Outlet />;
}

// A POC works inside one agency they picked; a URL for any other goes back to
// the list (the server refuses unassigned agencies regardless).
function RequirePocAgency() {
  const { agencyId } = useParams<{ agencyId: string }>();
  const { pocAgency } = useAuth();
  if (pocAgency?.id !== agencyId) return <Navigate to="/poc/agencies" replace />;
  return <Outlet />;
}

// Shared by the agency portal and the POC view (minus the wallet)
const operationsRoutes = (
  <Route element={<PortalLayout />}>
    <Route path="dashboard" element={<DashboardPage />} />
    <Route path="onboarding" element={<OnboardingPage />} />
    <Route path="audio-chat-room" element={<ServicePage service="chatroom" />} />
    <Route path="video-live" element={<ServicePage service="live" />} />
    <Route path="friend-zone" element={<ServicePage service="friendzone" />} />
    <Route path="reports" element={<ReportsPage />} />
    <Route path="support" element={<SupportPage />} />
  </Route>
);

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<HomeRedirect />} />

          {/* Agency entry — validates code, shows 404 or landing */}
          <Route path="/agency/:code" element={<AgencyEntryPage />} />

          {/* Login */}
          <Route path="/agency/:code/login" element={
            <RedirectIfAuth><LoginPage /></RedirectIfAuth>
          } />

          {/* Force reset password on first login */}
          <Route path="/agency/:code/reset-password" element={
            <RequireDefaultPassword><ResetPasswordPage /></RequireDefaultPassword>
          } />

          {/* Agency portal — authenticated, password changed */}
          <Route path="/agency/:code" element={<RequireAuth />}>
            {operationsRoutes}
            <Route element={<PortalLayout />}>
              <Route path="coin-wallet" element={<CoinWalletPage />} />
              <Route path="recharge-user" element={<RechargeUserPage />} />
              <Route path="recharge-history" element={<RechargeHistoryPage />} />
            </Route>
          </Route>

          {/* POC: assigned agencies only, no wallet */}
          <Route path="/poc/login" element={<PocLoginPage />} />
          <Route path="/poc" element={<RequirePoc />}>
            <Route path="agencies" element={<PocAgenciesPage />} />
            <Route path=":agencyId" element={<RequirePocAgency />}>
              {operationsRoutes}
            </Route>
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
