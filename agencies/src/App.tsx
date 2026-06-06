import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AgencyEntryPage } from './pages/AgencyEntryPage';
import { LoginPage } from './pages/LoginPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { DashboardPage } from './pages/DashboardPage';
import { NotFoundPage } from './pages/NotFoundPage';

// Guard: must be logged in. If default password, force reset. Otherwise allow through.
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { code } = useParams<{ code: string }>();
  const { token, isDefaultPassword } = useAuth();
  if (!token) return <Navigate to={`/agency/${code}`} replace />;
  if (isDefaultPassword) return <Navigate to={`/agency/${code}/reset-password`} replace />;
  return <>{children}</>;
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

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
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

          {/* Dashboard — authenticated, password changed */}
          <Route path="/agency/:code/dashboard" element={
            <RequireAuth><DashboardPage /></RequireAuth>
          } />

          {/* Catch-all */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
