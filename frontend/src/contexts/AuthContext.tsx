import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import type { User } from '../types';

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!localStorage.getItem('qa-token')) {
      setLoading(false);
      return;
    }
    api.me().then(setUser).catch(() => localStorage.removeItem('qa-token')).finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await api.login(email, password);
    localStorage.setItem('qa-token', response.token);
    setUser(response.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      localStorage.removeItem('qa-token');
      setUser(null);
    }
  }, []);

  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return context;
}
