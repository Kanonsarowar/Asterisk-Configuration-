import { useState } from 'react';
import { useApi } from '../../hooks/useApi';

export default function UsageStats() {
  const [hours, setHours] = useState(24);
  const { data, loading } = useApi(`/api/traffic/summary?hours=${hours}`);
  const s = data?.summary || {};

  return (
    <div>
      <div className="page-header">
        <h2>Usage Statistics</h2>
        <select value={hours} onChange={e => setHours(e.target.value)} style={{ width: 160 }}>
          <option value={1}>Last Hour</option>
          <option value={6}>Last 6 Hours</option>
          <option value={24}>Last 24 Hours</option>
          <option value={72}>Last 3 Days</option>
          <option value={168}>Last 7 Days</option>
        </select>
      </div>
      {loading ? <div className="empty">Loading...</div> : (
        <>
          <div className="stat-grid">
            <SC label="Total Calls" value={s.total_calls ?? 0} />
            <SC label="Answered" value={s.answered ?? 0} color="var(--success)" />
            <SC label="Failed" value={s.failed ?? 0} color="var(--danger)" />
            <SC label="ASR" value={`${s.asr ?? 0}%`} color="var(--primary)" />
            <SC label="ACD" value={`${s.acd ?? 0}s`} />
            <SC label="Total Billed" value={`${s.total_billed_seconds ?? 0}s`} />
            <SC label="Usage Cost" value={`$${Number(s.total_revenue ?? 0).toFixed(2)}`} color="var(--warning)" />
          </div>

          {data?.top_destinations?.length > 0 && (
            <div className="card" style={{ marginBottom: 20 }}>
              <h3 style={{ marginBottom: 12, fontSize: 15 }}>Top Destinations</h3>
              <table>
                <thead><tr><th>Destination</th><th>Calls</th><th>Revenue</th></tr></thead>
                <tbody>
                  {data.top_destinations.slice(0, 15).map((d, i) => (
                    <tr key={i}><td>{d.destination}</td><td>{d.calls}</td><td>${Number(d.revenue).toFixed(4)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data?.per_hour?.length > 0 && (
            <div className="card">
              <h3 style={{ marginBottom: 12, fontSize: 15 }}>Hourly Breakdown</h3>
              <table>
                <thead><tr><th>Hour</th><th>Calls</th><th>Answered</th><th>Revenue</th></tr></thead>
                <tbody>
                  {data.per_hour.map((h, i) => (
                    <tr key={i}><td>{h.hour}</td><td>{h.calls}</td><td>{h.answered}</td><td>${Number(h.revenue).toFixed(2)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SC({ label, value, color }) {
  return <div className="stat-card"><div className="value" style={color ? { color } : {}}>{value}</div><div className="label">{label}</div></div>;
}
