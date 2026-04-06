'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, getToken } from '@/lib/api';
import { getStoredUser, setStoredUser } from '@/lib/auth';

/**
 * Sync user from localStorage; optionally refresh profile from API (balance, currency).
 */
export function useSession({ refresh = true } = {}) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const local = getStoredUser();
    setUser(local);
    if (!refresh || !getToken()) {
      setLoading(false);
      return local;
    }
    try {
      const data = await api('/api/users/me');
      const next = { ...local, ...data.user, balance: data.user?.balance };
      setUser(next);
      setStoredUser(next);
      return next;
    } catch {
      setUser(local);
      return local;
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  return { user, loading, refreshUser };
}
