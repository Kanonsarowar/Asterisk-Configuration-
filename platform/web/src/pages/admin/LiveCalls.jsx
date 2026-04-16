import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import DataTable from '../../components/shared/DataTable';

export default function LiveCalls() {
  const [calls, setCalls] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const [c, s] = await Promise.all([
          api('/api/live/calls'),
          api('/api/traffic/live-stats'),
        ]);
        if (active) { setCalls(c.calls || []); setStats(s); setLoading(false); }
      } catch { if (active) setLoading(false); }
    };
    poll();
    const interval = setInterval(poll, 3000);
    return () => { active = false; clearInterval(interval); };
  }, []);

  const columns = [
    { key: 'uniqueid', label: 'Call ID' },
    { key: 'channel', label: 'Channel' },
    { key: 'cli', label: 'CLI' },
    { key: 'destination', label: 'Destination' },
    { key: 'started_at', label: 'Started', render: r => new Date(r.started_at).toLocaleTimeString() },
    { key: 'duration', label: 'Duration', render: r => {
      const secs = Math.floor((Date.now() - new Date(r.started_at).getTime()) / 1000);
      return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
    }},
  ];

  return (
    <div>
      <div className="page-header"><h2>Live Active Calls</h2></div>
      <div className="stat-grid">
        <div className="stat-card"><div className="value" style={{ color: 'var(--success)' }}>{stats.active_calls ?? 0}</div><div className="label">Active Calls</div></div>
        <div className="stat-card"><div className="value">{stats.current_cps ?? 0}</div><div className="label">Current CPS</div></div>
        <div className="stat-card"><div className="value">{stats.last_5min_calls ?? 0}</div><div className="label">Last 5 min</div></div>
      </div>
      <div className="card">
        <DataTable columns={columns} rows={calls} loading={loading} empty="No active calls" />
      </div>
    </div>
  );
}
