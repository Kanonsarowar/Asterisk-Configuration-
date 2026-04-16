import { useApi } from '../../hooks/useApi';

export default function AdminDashboard() {
  const { data, loading } = useApi('/api/dashboard/summary');
  const { data: traffic } = useApi('/api/traffic/summary?hours=24');

  if (loading) return <div className="empty">Loading dashboard...</div>;

  const s = data || {};
  const t = traffic?.summary || {};

  return (
    <div>
      <h2 style={{ marginBottom: 20 }}>Admin Dashboard</h2>
      <div className="stat-grid">
        <StatCard label="Active Calls" value={s.active_calls ?? 0} color="var(--success)" />
        <StatCard label="Total Calls (24h)" value={t.total_calls ?? s.total_calls ?? 0} />
        <StatCard label="ASR" value={`${t.asr ?? s.asr ?? 0}%`} color="var(--primary)" />
        <StatCard label="ACD" value={`${t.acd ?? s.acd ?? 0}s`} />
        <StatCard label="Revenue (24h)" value={`$${Number(t.total_revenue ?? s.revenue_24h ?? 0).toFixed(2)}`} color="var(--success)" />
        <StatCard label="Profit (24h)" value={`$${Number(t.total_profit ?? 0).toFixed(2)}`} color="var(--warning)" />
        <StatCard label="DIDs" value={s.total_numbers ?? 0} />
        <StatCard label="Customers" value={s.total_customers ?? 0} />
      </div>

      {traffic?.top_destinations?.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ marginBottom: 12, fontSize: 15 }}>Top Destinations (24h)</h3>
          <table>
            <thead><tr><th>Destination</th><th>Calls</th><th>Revenue</th></tr></thead>
            <tbody>
              {traffic.top_destinations.slice(0, 10).map((d, i) => (
                <tr key={i}>
                  <td>{d.destination}</td>
                  <td>{d.calls}</td>
                  <td>${Number(d.revenue).toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
