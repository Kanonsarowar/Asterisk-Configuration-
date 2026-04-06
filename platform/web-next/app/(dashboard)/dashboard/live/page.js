'use client';

import { useCallback, useState } from 'react';
import { api, getToken } from '@/lib/api';
import { usePolling } from '@/hooks/usePolling';
import PageHeader from '@/components/dashboard/PageHeader';
import FilterBar from '@/components/dashboard/FilterBar';
import TableCard from '@/components/dashboard/TableCard';
import Toggle from '@/components/dashboard/Toggle';
import Badge from '@/components/dashboard/Badge';

export default function LivePage() {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState('');
  const [live, setLive] = useState(true);
  const [destQ, setDestQ] = useState('');

  const load = useCallback(async () => {
    if (!getToken()) return;
    try {
      const data = await api('/api/live/calls?limit=100');
      let list = data.calls || [];
      const q = destQ.trim();
      if (q) {
        list = list.filter((c) => String(c.destination || '').includes(q));
      }
      setRows(list);
      setErr('');
    } catch (e) {
      setErr(e.message);
    }
  }, [destQ]);

  usePolling(load, 4000, live);

  return (
    <div>
      <PageHeader
        title="Live calls"
        subtitle="Populated by the AMI listener (platform/api npm run ami). Polls every 4s when live updates are on."
        actions={<Toggle checked={live} onChange={setLive} label="Live updates" />}
      />
      {err && <p style={{ color: '#f87171' }}>{err}</p>}
      <FilterBar>
        <div className="field" style={{ minWidth: 200, maxWidth: 320 }}>
          <span className="field-label">Destination contains</span>
          <input value={destQ} onChange={(e) => setDestQ(e.target.value)} placeholder="Filter client-side" />
        </div>
        <button className="btn" type="button" onClick={load} style={{ alignSelf: 'flex-end' }}>
          Refresh
        </button>
      </FilterBar>
      <TableCard>
        <table>
          <thead>
            <tr>
              <th>Uniqueid</th>
              <th>Direction</th>
              <th>State</th>
              <th>CLI</th>
              <th>Destination</th>
              <th>Context</th>
              <th>Started</th>
              <th>Last seen</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>{c.uniqueid}</td>
                <td>
                  <Badge tone={c.direction === 'outbound' ? 'default' : c.direction === 'inbound' ? 'success' : 'muted'}>
                    {c.direction || 'unknown'}
                  </Badge>
                </td>
                <td>{c.state || '—'}</td>
                <td style={{ fontFamily: 'ui-monospace, monospace' }}>{c.cli}</td>
                <td style={{ fontFamily: 'ui-monospace, monospace' }}>{c.destination}</td>
                <td style={{ fontSize: 12 }}>{c.dialplan_context || '—'}</td>
                <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{c.started_at}</td>
                <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{c.last_seen_at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableCard>
    </div>
  );
}
