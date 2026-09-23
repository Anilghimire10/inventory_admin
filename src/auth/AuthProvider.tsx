'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { AdminApi, type AdminInfo, clearToken, getToken, setToken } from '@/lib/api';

interface AuthState {
  admin: AdminInfo | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthState>(null as never);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<AdminInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (getToken()) {
        try {
          setAdmin(await AdminApi.me());
        } catch {
          clearToken();
        }
      }
      setLoading(false);
    })();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await AdminApi.login(email, password);
    setToken(res.accessToken);
    setAdmin(res.admin);
  };

  const logout = () => {
    clearToken();
    setAdmin(null);
    // A full page load, deliberately, not router.push(): signing out has to
    // drop every piece of in-memory state with it -- the React Query cache
    // still holds this admin's businesses, users and audit rows. A soft
    // navigation would leave all of that sitting in memory for whoever signs
    // in next on the same tab.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    location.href = '/login';
  };

  return <Ctx.Provider value={{ admin, loading, login, logout }}>{children}</Ctx.Provider>;
}
