import { createContext, useContext, useState } from 'react';

type AgencyInfo = {
  id: string;
  agencyName: string;
  agentCode: string;
  phone: string;
};

type PocInfo = { id: string; name: string };
type PocAgency = { id: string; agencyName: string; agentCode: string };

type AuthContextType = {
  token: string | null;
  agency: AgencyInfo | null;
  isDefaultPassword: boolean;
  /** Set when a POC is signed in; agency is null for them. */
  poc: PocInfo | null;
  pocAgency: PocAgency | null;
  login: (token: string, agency: AgencyInfo, isDefault: boolean) => void;
  loginPoc: (token: string, poc: PocInfo) => void;
  selectPocAgency: (agency: PocAgency | null) => void;
  setPasswordChanged: (newToken: string) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

const stored = <T,>(key: string): T | null => {
  const s = sessionStorage.getItem(key);
  return s ? (JSON.parse(s) as T) : null;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem('agency_token'));
  const [agency, setAgency] = useState<AgencyInfo | null>(() => stored<AgencyInfo>('agency_info'));
  const [poc, setPoc] = useState<PocInfo | null>(() => stored<PocInfo>('poc_info'));
  const [pocAgency, setPocAgency] = useState<PocAgency | null>(() => stored<PocAgency>('poc_agency'));
  const [isDefaultPassword, setIsDefaultPassword] = useState<boolean>(
    () => sessionStorage.getItem('agency_is_default') === 'true'
  );

  const login = (t: string, a: AgencyInfo, isDefault: boolean) => {
    sessionStorage.setItem('agency_token', t);
    sessionStorage.setItem('agency_info', JSON.stringify(a));
    sessionStorage.setItem('agency_is_default', String(isDefault));
    sessionStorage.setItem('portal_role', 'AGENCY');
    setToken(t);
    setAgency(a);
    setIsDefaultPassword(isDefault);
  };

  const loginPoc = (t: string, p: PocInfo) => {
    sessionStorage.setItem('agency_token', t);
    sessionStorage.setItem('poc_info', JSON.stringify(p));
    sessionStorage.setItem('portal_role', 'POC');
    setToken(t);
    setPoc(p);
  };

  const selectPocAgency = (a: PocAgency | null) => {
    if (a) {
      sessionStorage.setItem('poc_agency', JSON.stringify(a));
      sessionStorage.setItem('poc_agency_id', a.id);
    } else {
      sessionStorage.removeItem('poc_agency');
      sessionStorage.removeItem('poc_agency_id');
    }
    setPocAgency(a);
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
    setPoc(null);
    setPocAgency(null);
    setIsDefaultPassword(false);
  };

  return (
    <AuthContext.Provider value={{
      token, agency, isDefaultPassword, poc, pocAgency,
      login, loginPoc, selectPocAgency, setPasswordChanged, logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
