import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import DataTable from '../../components/shared/DataTable';

export default function CDR() {
  const [prefix, setPrefix] = useState('');
  const { data, loading, refetch } = useApi(`/api/cdr${prefix ? '?prefix=' + prefix : ''}`);
  const { data: stats } = useApi('/api/cdr/stats');

  const columns = [
    { key: 'id', label: 'ID' },
    { key: 'cli', label: 'CLI' },
    { key: 'destination', label: 'Destination' },
    { key: 'start_time', label: 'Start', render: r => r.start_time ? new Date(r.start_time).toLocaleString() : '—' },
    { key: 'duration', label: 'Duration', render: r => `${r.duration}s` },
    { key: 'billed_duration', label: 'Billed', render: r => `${r.billed_duration}s` },
    { key: 'disposition', label: 'Status', render: r => (
      <span className={`badge ${r.disposition === 'ANSWERED' ? 'badge-green' : 'badge-red'}`}>{r.disposition}</span>
    )},
    { key: 'revenue', label: 'Revenue', render: r => `$${Number(r.revenue).toFixed(4)}` },
    { key: 'cost', label: 'Cost', render: r => `$${Number(r.cost).toFixed(4)}` },
    { key: 'profit', label: 'Profit', render: r => {
      const p = Number(r.profit);
      return <span style={{ color: p >= 0 ? 'var(--success)' : 'var(--danger)' }}>${p.toFixed(4)}</span>;
    }},
  ];

  return (
    <div>
      <div className="page-header">
        <h2>Call Detail Records</h2>
        <div className="flex-gap">
          <input placeholder="Filter by prefix..." value={prefix} onChange={e => setPrefix(e.target.value)} style={{ width: 200 }} onKeyDown={e => e.key === 'Enter' && refetch()} />
          <a href={`/api/cdr/export.csv${prefix ? '?prefix=' + prefix : ''}`} className="btn-outline" style={{ padding: '8px 14px', fontSize: 13, borderRadius: 8, textDecoration: 'none' }} target="_blank">Export CSV</a>
        </div>
      </div>
      {stats && (
        <div className="stat-grid">
          <div className="stat-card"><div className="value">{stats.total_calls ?? 0}</div><div className="label">Total Calls</div></div>
          <div className="stat-card"><div className="value">{stats.asr ?? 0}%</div><div className="label">ASR</div></div>
          <div className="stat-card"><div className="value">{stats.average_duration ?? 0}s</div><div className="label">Avg Duration</div></div>
          <div className="stat-card"><div className="value">${Number(stats.total_revenue ?? 0).toFixed(2)}</div><div className="label">Revenue</div></div>
        </div>
      )}
      <div className="card">
        <DataTable columns={columns} rows={data?.rows} loading={loading} />
      </div>
    </div>
  );
}
