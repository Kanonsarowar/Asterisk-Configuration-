'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import PageHeader from '@/components/dashboard/PageHeader';
import FilterBar from '@/components/dashboard/FilterBar';
import TableCard from '@/components/dashboard/TableCard';

export default function NumbersPage() {
  const [rows, setRows] = useState([]);
  const [prefix, setPrefix] = useState('');
  const [err, setErr] = useState('');

  async function load() {
    try {
      const data = await api('/api/numbers');
      setRows(data.numbers || []);
    } catch (e) {
      setErr(e.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const p = prefix.trim();
    if (!p) return rows;
    return rows.filter((n) => {
      const hay = `${n.did || ''}${n.range_start || ''}${n.range_end || ''}${n.prefix || ''}${n.country || ''}`;
      return hay.includes(p);
    });
  }, [rows, prefix]);

  return (
    <div>
      <PageHeader
        title="Numbers"
        subtitle="DID inventory: filter by prefix, range, or country substring."
        actions={
          <button className="btn" type="button" onClick={load}>
            Reload
          </button>
        }
      />
      {err && <p style={{ color: '#f87171' }}>{err}</p>}
      <FilterBar>
        <div className="field" style={{ flex: 1, minWidth: 220, maxWidth: 400 }}>
          <span className="field-label">Prefix search</span>
          <input value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="e.g. 44123" />
        </div>
      </FilterBar>
      <TableCard>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>DID / Range</th>
              <th>Prefix</th>
              <th>Country</th>
              <th>Rate/min</th>
              <th>Type</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((n) => (
              <tr key={n.id}>
                <td>{n.id}</td>
                <td style={{ fontFamily: 'ui-monospace, monospace' }}>{n.did || `${n.range_start}–${n.range_end}`}</td>
                <td style={{ fontWeight: 600 }}>{n.prefix}</td>
                <td>{n.country}</td>
                <td>{n.rate_per_min}</td>
                <td>{n.type}</td>
                <td>{n.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableCard>
    </div>
  );
}
