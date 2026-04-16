import { useApi } from '../../hooks/useApi';

export default function AdminDashboard() {
  const { data, loading } = useApi('/api/dashboard/summary');

  if (loading) return <div className="empty">Loading dashboard...</div>;

  const s = data || {};

  return (
    <div>
      <h2 style={{ marginBottom: 20 }}>Admin Dashboard</h2>
      <div className="stat-grid">
        <StatCard label="Active Calls" value={s.active_calls ?? 0} color="var(--success)" />
        <StatCard label="Total Calls (24h)" value={s.total_calls_24h ?? 0} />
        <StatCard label="ASR" value={`${s.asr ?? 0}%`} color="var(--primary)" />
        <StatCard label="ACD" value={`${s.acd ?? 0}s`} />
        <StatCard label="Revenue (24h)" value={`$${Number(s.revenue_24h ?? 0).toFixed(2)}`} color="var(--success)" />
        <StatCard label="Profit (24h)" value={`$${Number(s.profit_24h ?? 0).toFixed(2)}`} color="var(--warning)" />
        <StatCard label="DIDs" value={s.total_dids ?? 0} />
        <StatCard label="Customers" value={s.total_clients ?? 0} />
        <StatCard label="Providers" value={s.active_providers ?? 0} />
        <StatCard label="Open Tickets" value={s.open_tickets ?? 0} />
      </div>
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div className="stat-card">
      <div className="value" style={color ? { color } : {}}>{value}</div>
      <div className="label">{label}</div>
    </div>
  );
}
