import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { login as apiLogin, logout as apiLogout, getProfile } from '../api/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  // Load user from stored token on mount
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      getProfile()
        .then((res) => setUser(res.data))
        .catch(() => {
          localStorage.clear();
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (username, password) => {
    const res = await apiLogin(username, password);
    const { access, refresh, user: userData } = res.data;
    localStorage.setItem('access_token', access);
    localStorage.setItem('refresh_token', refresh);
    // Fetch full profile after login
    const profile = await getProfile();
    setUser(profile.data);
    return profile.data;
  }, []);

  const logout = useCallback(async () => {
    const refresh = localStorage.getItem('refresh_token');
    try { await apiLogout(refresh); } catch { /* ignore */ }
    localStorage.clear();
    setUser(null);
  }, []);

  // Re-fetch the logged-in user's profile and update context state.
  // Call this after saving profile details or uploading a photo so the
  // sidebar name and avatar update immediately without a page refresh.
  const refreshUser = useCallback(async () => {
    try {
      const profile = await getProfile();
      setUser(profile.data);
      return profile.data;
    } catch {
      /* ignore — user stays as-is if request fails */
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
