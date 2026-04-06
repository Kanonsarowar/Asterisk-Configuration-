'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import PageHeader from '@/components/dashboard/PageHeader';
import FilterBar from '@/components/dashboard/FilterBar';
import TableCard from '@/components/dashboard/TableCard';

export default function RoutesPage() {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState('');
  const [prefix, setPrefix] = useState('');

  useEffect(() => {
    api('/api/routes')
      .then((d) => setRows(d.routes || []))
      .catch((e) => setErr(e.message));
  }, []);

  const filtered = useMemo(() => {
    const p = prefix.trim();
    if (!p) return rows;
    return rows.filter((r) => String(r.prefix || '').includes(p));
  }, [rows, prefix]);

  return (
    <div>
      <PageHeader title="Routes" subtitle="Prefix-based carrier failover and buy rates." />
      {err && <p style={{ color: '#f87171' }}>{err}</p>}
      <FilterBar>
        <div className="field" style={{ flex: 1, minWidth: 200, maxWidth: 360 }}>
          <span className="field-label">Prefix filter</span>
          <input value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="e.g. 88213" />
        </div>
      </FilterBar>
      <TableCard>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Prefix</th>
              <th>Supplier</th>
              <th>Priority</th>
              <th>Rate</th>
              <th>Active</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 600 }}>{r.prefix}</td>
                <td>{r.supplier_name}</td>
                <td>{r.priority}</td>
                <td>{r.rate}</td>
                <td>{r.active ? 'yes' : 'no'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableCard>
    </div>
  );
}
