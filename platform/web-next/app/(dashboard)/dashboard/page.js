'use client';

import { useCallback, useState } from 'react';
import { api, getToken } from '@/lib/api';
import { usePolling } from '@/hooks/usePolling';
import { useSession } from '@/hooks/useSession';
import PageHeader from '@/components/dashboard/PageHeader';
import Toggle from '@/components/dashboard/Toggle';
import { isAdminOrReseller } from '@/lib/auth';

export default function DashboardHome() {
  const { user } = useSession({ refresh: true });
  const [summary, setSummary] = useState(null);
  const [err, setErr] = useState('');
  const [live, setLive] = useState(true);
  const staff = isAdminOrReseller(user);

  const load = useCallback(async () => {
    if (!getToken()) return;
    try {
      const data = await api('/api/dashboard/summary');
      setSummary(data);
      setErr('');
    } catch (e) {
      setErr(e.message);
    }
  }, []);

  usePolling(load, staff ? 15000 : 30000, live);

  if (err) return <p style={{ color: '#f87171' }}>{err}</p>;
  if (!summary) return <p style={{ color: 'var(--muted)' }}>Loading summary…</p>;

  const cards = staff
    ? [
        ['Revenue today', summary.revenue_today],
        ['Cost today', summary.cost_today],
        ['Profit today', summary.profit_today],
        ['ASR %', summary.asr_percent],
        ['ACD sec', summary.acd_seconds],
        ['Numbers', summary.total_numbers],
        ['Calls 24h', summary.calls_24h],
        ['Active calls', summary.active_calls ?? '—'],
      ]
    : [
        ['Revenue today', summary.revenue_today],
        ['ASR %', summary.asr_percent],
        ['ACD sec', summary.acd_seconds],
        ['Calls 24h', summary.calls_24h],
      ];

  return (
    <div>
      <PageHeader
        title="Overview"
        subtitle={staff ? 'Platform metrics refresh automatically while live updates are on.' : 'Your usage snapshot.'}
        actions={<Toggle checked={live} onChange={setLive} label="Live updates" />}
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 16 }}>
        {cards.map(([k, v]) => (
          <div key={k} className="card">
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>{k}</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 8 }}>{String(v)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
