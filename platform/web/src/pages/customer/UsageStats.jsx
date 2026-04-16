import { useState } from 'react';
import { useApi } from '../../hooks/useApi';

export default function UsageStats() {
  const [hours, setHours] = useState(24);
  const { data, loading } = useApi(`/api/cdr/stats?hours=${hours}`);
  const s = data || {};

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

        
        </>
      )}
    </div>
  );
}

function SC({ label, value, color }) {
  return <div className="stat-card"><div className="value" style={color ? { color } : {}}>{value}</div><div className="label">{label}</div></div>;
}
