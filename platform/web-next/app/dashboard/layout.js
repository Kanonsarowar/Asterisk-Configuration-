'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { clearToken, getToken } from '@/lib/api';

export default function DashboardLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    try {
      setUser(JSON.parse(localStorage.getItem('iprn_user') || 'null'));
    } catch {
      setUser(null);
    }
  }, [router]);

  function logout() {
    clearToken();
    localStorage.removeItem('iprn_user');
    router.replace('/login');
  }

  const admin = user?.role === 'admin';
  const reseller = user?.role === 'reseller';

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside
        style={{
          width: 220,
          borderRight: '1px solid var(--border)',
          padding: 20,
          background: 'var(--panel)',
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 16 }}>IPRN</div>
        <nav className="nav" style={{ flexDirection: 'column' }}>
          <Link href="/dashboard">Overview</Link>
          {(admin || reseller) && <Link href="/dashboard/numbers">Numbers</Link>}
          {(admin || reseller) && <Link href="/dashboard/suppliers">Suppliers</Link>}
          {(admin || reseller) && <Link href="/dashboard/routes">Routes</Link>}
          {(admin || reseller) && <Link href="/dashboard/users">Users</Link>}
          <Link href="/dashboard/cdr">CDR</Link>
          <Link href="/dashboard/live">Live calls</Link>
          <Link href="/dashboard/invoices">Invoices</Link>
        </nav>
        <div style={{ marginTop: 24, fontSize: 13, color: 'var(--muted)' }}>
          {user?.username} ({user?.role})
          {user?.balance != null && (
            <div style={{ marginTop: 8 }}>Balance: {Number(user.balance).toFixed(4)}</div>
          )}
        </div>
        <button className="btn" style={{ marginTop: 16, width: '100%' }} type="button" onClick={logout}>
          Log out
        </button>
      </aside>
      <main style={{ flex: 1, padding: 24 }}>{children}</main>
    </div>
  );
}
