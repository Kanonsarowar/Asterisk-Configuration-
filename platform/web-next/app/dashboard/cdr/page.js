'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function CdrPage() {
  const [rows, setRows] = useState([]);
  const [prefix, setPrefix] = useState('');
  const [err, setErr] = useState('');

  async function load() {
    try {
      const q = prefix ? `?prefix=${encodeURIComponent(prefix)}` : '';
      const data = await api(`/api/cdr${q}`);
      setRows(data.cdr || []);
    } catch (e) {
      setErr(e.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>CDR</h1>
      {err && <p style={{ color: '#f87171' }}>{err}</p>}
      <div className="card" style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <label>
          Destination prefix
          <input value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="44" />
        </label>
        <button className="btn" type="button" onClick={load}>
          Apply filter
        </button>
      </div>
      <div className="card" style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>CLI</th>
              <th>Destination</th>
              <th>Dur</th>
              <th>Billed</th>
              <th>Cost</th>
              <th>Revenue</th>
              <th>Disposition</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td>{c.created_at}</td>
                <td>{c.cli}</td>
                <td>{c.destination}</td>
                <td>{c.duration}</td>
                <td>{c.billed_duration}</td>
                <td>{c.cost}</td>
                <td>{c.revenue}</td>
                <td>{c.disposition}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
