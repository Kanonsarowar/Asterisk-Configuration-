import { useState } from 'react';
import { useApi } from '../../hooks/useApi';

export default function TrafficStats() {
  const [hours, setHours] = useState(24);
  const { data, loading } = useApi(`/api/cdr/stats?hours=${hours}`);
  const s = data || {};

  return (
    <div>
      <div className="page-header">
        <h2>Traffic Statistics</h2>
        <select value={hours} onChange={e => setHours(e.target.value)} style={{ width: 160 }}>
          <option value={1}>Last 1 Hour</option>
          <option value={6}>Last 6 Hours</option>
          <option value={24}>Last 24 Hours</option>
          <option value={72}>Last 3 Days</option>
          <option value={168}>Last 7 Days</option>
        </select>
      </div>
      {loading ? <div className="empty">Loading...</div> : (
        <>
          <div className="stat-grid">
            <StatCard label="Total Calls" value={s.total_calls ?? 0} />
            <StatCard label="Answered" value={s.answered ?? 0} color="var(--success)" />
            <StatCard label="Failed" value={s.failed ?? 0} color="var(--danger)" />
            <StatCard label="ASR" value={`${s.asr ?? 0}%`} color="var(--primary)" />
            <StatCard label="ACD" value={`${s.acd ?? 0}s`} />
            <StatCard label="Revenue" value={`$${Number(s.total_revenue ?? 0).toFixed(2)}`} color="var(--success)" />
            <StatCard label="Cost" value={`$${Number(s.total_cost ?? 0).toFixed(2)}`} color="var(--warning)" />
            <StatCard label="Profit" value={`$${Number(s.total_profit ?? 0).toFixed(2)}`} color="var(--primary)" />
          </div>

        
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, color }) {
  return <div className="stat-card"><div className="value" style={color ? { color } : {}}>{value}</div><div className="label">{label}</div></div>;
}
