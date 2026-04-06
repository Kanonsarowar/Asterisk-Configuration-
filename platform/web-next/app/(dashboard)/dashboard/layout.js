'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { clearToken, getToken } from '@/lib/api';
import { getStoredUser, setStoredUser, isAdminOrReseller } from '@/lib/auth';
import { useSession } from '@/hooks/useSession';
import Badge from '@/components/dashboard/Badge';

function NavLink({ href, children }) {
  const pathname = usePathname();
  const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href + '/'));
  return (
    <Link
      href={href}
      style={{
        display: 'block',
        padding: '8px 12px',
        borderRadius: 8,
        textDecoration: 'none',
        fontSize: 14,
        fontWeight: active ? 600 : 500,
        color: active ? '#fff' : 'var(--muted)',
        background: active ? 'rgba(59,130,246,0.2)' : 'transparent',
        border: active ? '1px solid rgba(59,130,246,0.35)' : '1px solid transparent',
      }}
    >
      {children}
    </Link>
  );
}

export default function DashboardLayout({ children }) {
  const router = useRouter();
  const { user, refreshUser } = useSession({ refresh: true });

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
    }
  }, [router]);

  function logout() {
    clearToken();
    setStoredUser(null);
    router.replace('/login');
  }

  const staff = isAdminOrReseller(user || getStoredUser());
  const u = user || getStoredUser();
  const cur = u?.billing_currency || 'USD';

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside
        style={{
          width: 240,
          flexShrink: 0,
          borderRight: '1px solid var(--border)',
          padding: '20px 16px',
          background: 'var(--panel)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em', marginBottom: 8 }}>Telecom</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 20 }}>IPRN control panel</div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <NavLink href="/dashboard">Overview</NavLink>
          {staff && (
            <>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', margin: '16px 0 8px' }}>
                Admin
              </div>
              <NavLink href="/dashboard/users">Users</NavLink>
              <NavLink href="/dashboard/suppliers">Suppliers</NavLink>
              <NavLink href="/dashboard/routes">Routes</NavLink>
              <NavLink href="/dashboard/numbers">Numbers</NavLink>
            </>
          )}
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', margin: '16px 0 8px' }}>
            Account
          </div>
          <NavLink href="/dashboard/balance">Balance</NavLink>
          <NavLink href="/dashboard/live">Live calls</NavLink>
          <NavLink href="/dashboard/cdr">CDR</NavLink>
          <NavLink href="/dashboard/invoices">Invoices</NavLink>
        </nav>
        <div style={{ marginTop: 'auto', paddingTop: 24 }}>
          <div
            style={{
              padding: 12,
              borderRadius: 10,
              background: 'rgba(0,0,0,0.25)',
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600 }}>{u?.username || '—'}</div>
            <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Badge tone="muted">{u?.role || '—'}</Badge>
              {u?.balance != null && (
                <span style={{ fontSize: 13, color: 'var(--text)' }}>
                  {Number(u.balance).toFixed(4)} <span style={{ color: 'var(--muted)' }}>{cur}</span>
                </span>
              )}
            </div>
            <button className="btn btn-ghost" style={{ marginTop: 12, width: '100%' }} type="button" onClick={() => refreshUser()}>
              Refresh profile
            </button>
            <button className="btn" style={{ marginTop: 8, width: '100%' }} type="button" onClick={logout}>
              Log out
            </button>
          </div>
        </div>
      </aside>
      <main style={{ flex: 1, padding: '28px 32px', maxWidth: 1400 }}>{children}</main>
    </div>
  );
}
