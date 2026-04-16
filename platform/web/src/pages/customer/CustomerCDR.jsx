import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import DataTable from '../../components/shared/DataTable';

export default function CustomerCDR() {
  const [prefix, setPrefix] = useState('');
  const { data, loading, refetch } = useApi(`/api/cdr${prefix ? '?prefix=' + prefix : ''}`);
  const { data: stats } = useApi('/api/cdr/stats');

  const columns = [
    { key: 'cli', label: 'CLI' },
    { key: 'destination', label: 'Destination' },
    { key: 'start_time', label: 'Start', render: r => r.start_time ? new Date(r.start_time).toLocaleString() : '—' },
    { key: 'duration', label: 'Duration', render: r => {
      const m = Math.floor(r.duration / 60);
      const s = r.duration % 60;
      return `${m}:${String(s).padStart(2, '0')}`;
    }},
    { key: 'billed_duration', label: 'Billed', render: r => `${r.billed_duration}s` },
    { key: 'disposition', label: 'Result', render: r => (
      <span className={`badge ${r.disposition === 'ANSWERED' ? 'badge-green' : 'badge-red'}`}>{r.disposition}</span>
    )},
    { key: 'revenue', label: 'Charge', render: r => `$${Number(r.revenue).toFixed(4)}` },
  ];

  return (
    <div>
      <div className="page-header">
        <h2>CDR Reports</h2>
        <div className="flex-gap">
          <input placeholder="Filter by prefix..." value={prefix} onChange={e => setPrefix(e.target.value)} style={{ width: 200 }} onKeyDown={e => e.key === 'Enter' && refetch()} />
          <a href={`/api/cdr/export.csv${prefix ? '?prefix=' + prefix : ''}`} className="btn-outline" style={{ padding: '8px 14px', fontSize: 13, borderRadius: 8 }} target="_blank" rel="noreferrer">Export CSV</a>
        </div>
      </div>
      {stats && (
        <div className="stat-grid">
          <div className="stat-card"><div className="value">{stats.total_calls ?? 0}</div><div className="label">Total Calls</div></div>
          <div className="stat-card"><div className="value">{stats.asr ?? 0}%</div><div className="label">ASR</div></div>
          <div className="stat-card"><div className="value">{stats.average_duration ?? 0}s</div><div className="label">Avg Duration</div></div>
          <div className="stat-card"><div className="value">${Number(stats.total_revenue ?? 0).toFixed(2)}</div><div className="label">Total Usage</div></div>
        </div>
      )}
      <div className="card">
        <DataTable columns={columns} rows={data?.rows} loading={loading} />
      </div>
    </div>
  );
}
