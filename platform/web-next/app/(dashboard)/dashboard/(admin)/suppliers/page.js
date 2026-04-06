'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import PageHeader from '@/components/dashboard/PageHeader';
import FilterBar from '@/components/dashboard/FilterBar';
import TableCard from '@/components/dashboard/TableCard';

export default function SuppliersPage() {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => {
    api('/api/suppliers')
      .then((d) => setRows(d.suppliers || []))
      .catch((e) => setErr(e.message));
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((x) => {
      const hay = `${x.name || ''} ${x.host || ''} ${x.id}`.toLowerCase();
      return hay.includes(s);
    });
  }, [rows, q]);

  return (
    <div>
      <PageHeader title="Suppliers" subtitle="SIP carriers and default cost per minute." />
      {err && <p style={{ color: '#f87171' }}>{err}</p>}
      <FilterBar>
        <div className="field" style={{ flex: 1, minWidth: 200, maxWidth: 360 }}>
          <span className="field-label">Prefix / search</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, host, or ID" />
        </div>
      </FilterBar>
      <TableCard>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Host</th>
              <th>Port</th>
              <th>Protocol</th>
              <th>Active</th>
              <th>Cost/min</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.id}>
                <td>{s.id}</td>
                <td style={{ fontWeight: 600 }}>{s.name}</td>
                <td style={{ fontFamily: 'ui-monospace, monospace' }}>{s.host}</td>
                <td>{s.port}</td>
                <td>{s.protocol}</td>
                <td>{s.active ? 'yes' : 'no'}</td>
                <td>{s.cost_per_minute}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableCard>
    </div>
  );
}
