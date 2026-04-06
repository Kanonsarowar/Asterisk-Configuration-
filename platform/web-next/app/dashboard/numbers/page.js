'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

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

  const filtered = rows.filter((n) => {
    const p = prefix.trim();
    if (!p) return true;
    const hay = `${n.did || ''}${n.range_start || ''}${n.prefix || ''}`;
    return hay.includes(p);
  });

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Numbers</h1>
      {err && <p style={{ color: '#f87171' }}>{err}</p>}
      <div className="card">
        <label>
          Prefix search
          <input value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="e.g. 44123" />
        </label>
      </div>
      <div className="card" style={{ overflowX: 'auto' }}>
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
                <td>{n.did || `${n.range_start}–${n.range_end}`}</td>
                <td>{n.prefix}</td>
                <td>{n.country}</td>
                <td>{n.rate_per_min}</td>
                <td>{n.type}</td>
                <td>{n.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
