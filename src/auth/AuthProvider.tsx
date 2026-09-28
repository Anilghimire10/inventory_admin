'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { AdminApi, type AdminInfo, clearToken, getToken, setToken } from '@/lib/api';

interface AuthState {
  admin: AdminInfo | null;
  loading: boolean;
  login: (email: string, password: string, code?: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Re-read who is signed in, e.g. after turning two-factor on. */
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthState>(null as never);
export const useAuth = () => useContext(Ctx);

/**
 * Whether the signed-in admin may change things. SUPPORT accounts are
 * read-only (the API refuses their writes); this only hides the buttons.
 */
export const useCanEdit = () => useContext(Ctx).admin?.role !== 'SUPPORT';

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

  const login = async (email: string, password: string, code?: string) => {
    const res = await AdminApi.login(email, password, code);
    setToken(res.accessToken);
    setAdmin(res.admin);
    // Login's answer doesn't say whether two-factor is required and missing;
    // /me does, and the layout sends such an admin to set it up.
    try {
      setAdmin(await AdminApi.me());
    } catch {
      // Keep what login returned; the next request will say if it matters.
    }
  };

  const logout = async () => {
    // End the session on the server too, so a copied token is dead at once --
    // not just forgotten by this tab. Best effort: signing out must work even
    // if the API can't be reached.
    try {
      await AdminApi.logout();
    } catch {
      // The token will still expire on its own.
    }
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

  const refresh = async () => {
    try {
      setAdmin(await AdminApi.me());
    } catch {
      // A failed refresh leaves the current state; a 401 signs out anyway.
    }
  };

  return <Ctx.Provider value={{ admin, loading, login, logout, refresh }}>{children}</Ctx.Provider>;
}
