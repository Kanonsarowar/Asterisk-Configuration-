'use client';

import { useCallback, useMemo, useState } from 'react';
import { api, getToken } from '@/lib/api';
import { usePolling } from '@/hooks/usePolling';
import PageHeader from '@/components/dashboard/PageHeader';
import FilterBar from '@/components/dashboard/FilterBar';
import TableCard from '@/components/dashboard/TableCard';
import Toggle from '@/components/dashboard/Toggle';
import { useSession } from '@/hooks/useSession';
import { isAdmin as roleIsAdmin } from '@/lib/auth';

export default function CdrPage() {
  const { user } = useSession({ refresh: false });
  const [rows, setRows] = useState([]);
  const [prefix, setPrefix] = useState('');
  const [disp, setDisp] = useState('');
  const [err, setErr] = useState('');
  const [live, setLive] = useState(true);
  const [adminUserId, setAdminUserId] = useState('');

  const load = useCallback(async () => {
    if (!getToken()) return;
    try {
      let path = '/api/cdr?limit=150';
      if (prefix.trim()) path += `&prefix=${encodeURIComponent(prefix.trim())}`;
      if (roleIsAdmin(user) && adminUserId.trim()) path += `&user_id=${encodeURIComponent(adminUserId.trim())}`;
      const data = await api(path);
      let list = data.cdr || [];
      if (disp.trim()) {
        const d = disp.trim().toLowerCase();
        list = list.filter((c) => String(c.disposition || '').toLowerCase().includes(d));
      }
      setRows(list);
      setErr('');
    } catch (e) {
      setErr(e.message);
    }
  }, [prefix, disp, user, adminUserId]);

  usePolling(load, 12000, live);

  const stats = useMemo(() => {
    const n = rows.length;
    const rev = rows.reduce((a, c) => a + (Number(c.revenue) || 0), 0);
    return { n, rev };
  }, [rows]);

  return (
    <div>
      <PageHeader
        title="CDR"
        subtitle="Call detail records — destination prefix filter hits the API; disposition filter is client-side on the loaded page."
        actions={
          <>
            <Toggle checked={live} onChange={setLive} label="Auto-refresh" />
            <button className="btn" type="button" onClick={load}>
              Refresh now
            </button>
          </>
        }
      />
      {err && <p style={{ color: '#f87171' }}>{err}</p>}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="card" style={{ margin: 0, padding: '12px 16px' }}>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Rows (this page)</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{stats.n}</div>
        </div>
        <div className="card" style={{ margin: 0, padding: '12px 16px' }}>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Σ revenue (visible)</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{stats.rev.toFixed(4)}</div>
        </div>
      </div>
      <FilterBar>
        <div className="field" style={{ minWidth: 160, maxWidth: 200 }}>
          <span className="field-label">Dest. prefix</span>
          <input value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="44" />
        </div>
        <div className="field" style={{ minWidth: 160, maxWidth: 220 }}>
          <span className="field-label">Disposition</span>
          <input value={disp} onChange={(e) => setDisp(e.target.value)} placeholder="ANSWER" />
        </div>
        {roleIsAdmin(user) && (
          <div className="field" style={{ minWidth: 120, maxWidth: 160 }}>
            <span className="field-label">User ID</span>
            <input value={adminUserId} onChange={(e) => setAdminUserId(e.target.value)} placeholder="optional" />
          </div>
        )}
        <button className="btn" type="button" onClick={load} style={{ alignSelf: 'flex-end' }}>
          Apply
        </button>
      </FilterBar>
      <TableCard>
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>CLI</th>
              <th>Destination</th>
              <th>Prefix</th>
              <th>Dur</th>
              <th>Billed</th>
              <th>Cost</th>
              <th>Revenue</th>
              <th>Disp.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td style={{ whiteSpace: 'nowrap', fontSize: 13 }}>{c.created_at}</td>
                <td style={{ fontFamily: 'ui-monospace, monospace' }}>{c.cli}</td>
                <td style={{ fontFamily: 'ui-monospace, monospace' }}>{c.destination}</td>
                <td>{c.matched_prefix || '—'}</td>
                <td>{c.duration}</td>
                <td>{c.billed_duration}</td>
                <td>{c.cost}</td>
                <td>{c.revenue}</td>
                <td>{c.disposition}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableCard>
    </div>
  );
}
