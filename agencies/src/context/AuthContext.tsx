import { createContext, useContext, useState } from 'react';

type AgencyInfo = {
  id: string;
  agencyName: string;
  agentCode: string;
  phone: string;
};

type AuthContextType = {
  token: string | null;
  agency: AgencyInfo | null;
  isDefaultPassword: boolean;
  login: (token: string, agency: AgencyInfo, isDefault: boolean) => void;
  setPasswordChanged: (newToken: string) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem('agency_token'));
  const [agency, setAgency] = useState<AgencyInfo | null>(() => {
    const s = sessionStorage.getItem('agency_info');
    return s ? JSON.parse(s) : null;
  });
  const [isDefaultPassword, setIsDefaultPassword] = useState<boolean>(
    () => sessionStorage.getItem('agency_is_default') === 'true'
  );

  const login = (t: string, a: AgencyInfo, isDefault: boolean) => {
    sessionStorage.setItem('agency_token', t);
    sessionStorage.setItem('agency_info', JSON.stringify(a));
    sessionStorage.setItem('agency_is_default', String(isDefault));
    setToken(t);
    setAgency(a);
    setIsDefaultPassword(isDefault);
  };

  const setPasswordChanged = (newToken: string) => {
    sessionStorage.setItem('agency_token', newToken);
    sessionStorage.setItem('agency_is_default', 'false');
    setToken(newToken);
    setIsDefaultPassword(false);
  };

  const logout = () => {
    sessionStorage.clear();
    setToken(null);
    setAgency(null);
    setIsDefaultPassword(false);
  };

  return (
    <AuthContext.Provider value={{ token, agency, isDefaultPassword, login, setPasswordChanged, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
