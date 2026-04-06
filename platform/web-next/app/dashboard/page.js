'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function DashboardHome() {
  const [summary, setSummary] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api('/api/dashboard/summary')
      .then(setSummary)
      .catch((e) => setErr(e.message));
  }, []);

  if (err) return <p style={{ color: '#f87171' }}>{err}</p>;
  if (!summary) return <p>Loading summary…</p>;

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Overview</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 16 }}>
        {[
          ['Revenue today', summary.revenue_today],
          ['Cost today', summary.cost_today],
          ['Profit today', summary.profit_today],
          ['ASR %', summary.asr_percent],
          ['ACD sec', summary.acd_seconds],
          ['Numbers', summary.total_numbers],
          ['Calls 24h', summary.calls_24h],
          ['Active calls', summary.active_calls ?? '—'],
        ].map(([k, v]) => (
          <div key={k} className="card">
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>{k}</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 8 }}>{String(v)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
