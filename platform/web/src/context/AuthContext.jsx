import { createContext, useContext, useState, useCallback } from 'react';
import { api, setToken, setUser, clearToken, getToken, getUser } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUserState] = useState(() => getUser());
  const [token, setTokenState] = useState(() => getToken());

  const login = useCallback(async (username, password) => {
    const data = await api('/login', { method: 'POST', body: { username, password } });
    setToken(data.token);
    setUser(data.user);
    setTokenState(data.token);
    setUserState(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setTokenState(null);
    setUserState(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAdmin: user?.role === 'admin', isReseller: user?.role === 'reseller' }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }
