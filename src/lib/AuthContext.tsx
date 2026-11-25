import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface User {
  id: string;
  username: string;
  avatar: string;
  subscribers?: number;
  isPremium?: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => Promise<void>;
  updateUser: (patch: Partial<User>) => void;
  authFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isAuthLoading: true,
  login: () => {},
  logout: async () => {},
  updateUser: () => {},
  authFetch: (input, init) => fetch(input, init),
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch('/api/auth/me', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        if (data?.user && data?.token) {
          setUser(data.user);
          setToken(data.token);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setIsAuthLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback((newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-Requested-With': 'OseiTV' },
      });
    } catch {
      // Ignore network errors on logout
    }
    setToken(null);
    setUser(null);
  }, []);

  const updateUser = useCallback((patch: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const authFetch = useCallback(
    (input: RequestInfo | URL, init: RequestInit = {}) => {
      const headers = new Headers(init.headers);
      headers.set('X-Requested-With', 'OseiTV');
      if (token && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      return fetch(input, {
        ...init,
        headers,
        credentials: 'include',
      });
    },
    [token]
  );

  return (
    <AuthContext.Provider value={{ user, token, isAuthLoading, login, logout, updateUser, authFetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
