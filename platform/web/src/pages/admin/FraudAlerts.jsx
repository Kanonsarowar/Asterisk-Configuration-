import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { api } from '../../api/client';
import DataTable from '../../components/shared/DataTable';

export default function FraudAlerts() {
  const [filter, setFilter] = useState('unresolved');
  const qs = filter === 'unresolved' ? '?resolved=false' : filter === 'resolved' ? '?resolved=true' : '';
  const { data, loading, refetch } = useApi(`/api/fraud-logs${qs}`);
  const { data: stats } = useApi('/api/fraud-logs/stats');

  const resolve = async (id) => {
    try {
      await api(`/api/fraud-logs/${id}/resolve`, { method: 'PUT' });
      refetch();
    } catch (err) { alert(err.message); }
  };

  const columns = [
    { key: 'id', label: 'ID' },
    { key: 'event_type', label: 'Type', render: r => <span className="badge badge-red">{r.event_type}</span> },
    { key: 'severity', label: 'Severity', render: r => (
      <span className={`badge ${r.severity === 'critical' ? 'badge-red' : r.severity === 'high' ? 'badge-yellow' : 'badge-blue'}`}>{r.severity}</span>
    )},
    { key: 'source_ip', label: 'Source IP' },
    { key: 'cli', label: 'CLI' },
    { key: 'destination', label: 'Destination' },
    { key: 'carrier_name', label: 'Carrier' },
    { key: 'customer_name', label: 'Customer' },
    { key: 'created_at', label: 'Time', render: r => new Date(r.created_at).toLocaleString() },
    { key: 'actions', label: '', render: r => !r.resolved && (
      <button className="btn-success btn-sm" onClick={() => resolve(r.id)}>Resolve</button>
    )},
  ];

  return (
    <div>
      <div className="page-header">
        <h2>Fraud Alerts</h2>
        <div className="flex-gap">
          {stats && <span style={{ fontSize: 13, color: 'var(--danger)' }}>{stats.unresolved} unresolved</span>}
          <select value={filter} onChange={e => setFilter(e.target.value)} style={{ width: 140 }}>
            <option value="unresolved">Unresolved</option>
            <option value="resolved">Resolved</option>
            <option value="all">All</option>
          </select>
        </div>
      </div>
      <div className="card">
        <DataTable columns={columns} rows={data?.fraud_logs} loading={loading} empty="No fraud alerts" />
      </div>
    </div>
  );
}
