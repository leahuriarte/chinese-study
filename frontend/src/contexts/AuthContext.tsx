import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { api } from '../lib/api';
import { applyTheme, getThemeFromSettings } from '../lib/theme';
import type { User, UserSettings } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  updateSettings: (settings: Partial<UserSettings>) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const token = api.getToken();
    if (token) {
      // Fetch the user data from the token
      api.getMe()
        .then((userData) => {
          setUser(userData as User);
          setLoading(false);
        })
        .catch(() => {
          // Token is invalid, clear it
          api.setToken(null);
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    applyTheme(getThemeFromSettings(user?.settings));
  }, [user?.settings]);

  const login = async (email: string, password: string) => {
    const response = await api.login(email, password);
    api.setToken(response.accessToken);
    setUser(response.user);
  };

  const register = async (email: string, password: string) => {
    const response = await api.register(email, password);
    api.setToken(response.accessToken);
    setUser(response.user);
  };

  const updateSettings = async (settings: Partial<UserSettings>) => {
    const updatedUser = await api.updateSettings(settings);
    setUser(updatedUser);
    return updatedUser;
  };

  const logout = () => {
    api.setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, updateSettings, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
