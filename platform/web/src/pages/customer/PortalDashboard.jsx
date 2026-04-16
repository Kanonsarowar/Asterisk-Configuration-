import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';

export default function PortalDashboard() {
  const { user } = useAuth();
  const { data: traffic } = useApi('/api/traffic/summary?hours=24');
  const { data: dids } = useApi('/api/did-inventory?limit=5');

  const s = traffic?.summary || {};

  return (
    <div>
      <h2 style={{ marginBottom: 20 }}>Welcome, {user?.username}</h2>
      <div className="stat-grid">
        <div className="stat-card">
          <div className="value" style={{ color: 'var(--success)' }}>${Number(user?.balance ?? 0).toFixed(2)}</div>
          <div className="label">Account Balance</div>
        </div>
        <div className="stat-card"><div className="value">{s.total_calls ?? 0}</div><div className="label">Calls (24h)</div></div>
        <div className="stat-card"><div className="value">{s.asr ?? 0}%</div><div className="label">ASR</div></div>
        <div className="stat-card"><div className="value">{s.acd ?? 0}s</div><div className="label">ACD</div></div>
        <div className="stat-card"><div className="value">${Number(s.total_revenue ?? 0).toFixed(2)}</div><div className="label">Usage (24h)</div></div>
        <div className="stat-card"><div className="value">{dids?.total ?? 0}</div><div className="label">My DIDs</div></div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 12, fontSize: 15 }}>Recent DIDs</h3>
        {dids?.dids?.length > 0 ? (
          <table>
            <thead><tr><th>Number</th><th>Status</th><th>Route</th><th>Billing</th></tr></thead>
            <tbody>
              {dids.dids.map(d => (
                <tr key={d.id}>
                  <td>{d.did_number}</td>
                  <td><span className={`badge ${d.status === 'assigned' ? 'badge-green' : 'badge-blue'}`}>{d.status}</span></td>
                  <td>{d.route_type || '—'}</td>
                  <td>{d.billing_type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div className="empty">No DIDs assigned</div>}
      </div>
    </div>
  );
}
