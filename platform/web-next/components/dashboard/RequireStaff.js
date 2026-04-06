'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/hooks/useSession';
import { isAdminOrReseller } from '@/lib/auth';

export default function RequireStaff({ children }) {
  const router = useRouter();
  const { user, loading } = useSession({ refresh: false });

  useEffect(() => {
    if (loading) return;
    if (!isAdminOrReseller(user)) {
      router.replace('/dashboard');
    }
  }, [loading, user, router]);

  if (loading || !isAdminOrReseller(user)) {
    return <p style={{ color: 'var(--muted)' }}>Checking access…</p>;
  }
  return children;
}
