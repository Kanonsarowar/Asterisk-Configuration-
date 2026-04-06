'use client';

import { useSession } from '@/hooks/useSession';
import PageHeader from '@/components/dashboard/PageHeader';
import Badge from '@/components/dashboard/Badge';

export default function BalancePage() {
  const { user, loading, refreshUser } = useSession({ refresh: true });

  if (loading && !user) {
    return <p style={{ color: 'var(--muted)' }}>Loading…</p>;
  }

  const cur = user?.billing_currency || 'USD';

  return (
    <div>
      <PageHeader
        title="Balance"
        subtitle="Wallet balance is debited on billed CDR (revenue). Values are in your billing currency."
        actions={
          <button className="btn" type="button" onClick={() => refreshUser()}>
            Refresh
          </button>
        }
      />
      <div className="card" style={{ maxWidth: 480 }}>
        <div style={{ fontSize: 14, color: 'var(--muted)' }}>Current balance</div>
        <div style={{ fontSize: 36, fontWeight: 800, marginTop: 8, letterSpacing: '-0.02em' }}>
          {user?.balance != null ? Number(user.balance).toFixed(6) : '—'}{' '}
          <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--muted)' }}>{cur}</span>
        </div>
        <div style={{ marginTop: 20, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Badge>{user?.username}</Badge>
          <Badge tone="muted">{user?.role}</Badge>
        </div>
      </div>
    </div>
  );
}
