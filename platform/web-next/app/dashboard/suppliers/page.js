'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function SuppliersPage() {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    api('/api/suppliers')
      .then((d) => setRows(d.suppliers || []))
      .catch((e) => setErr(e.message));
  }, []);

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Suppliers</h1>
      {err && <p style={{ color: '#f87171' }}>{err}</p>}
      <div className="card" style={{ overflowX: 'auto' }}>
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
            {rows.map((s) => (
              <tr key={s.id}>
                <td>{s.id}</td>
                <td>{s.name}</td>
                <td>{s.host}</td>
                <td>{s.port}</td>
                <td>{s.protocol}</td>
                <td>{s.active ? 'yes' : 'no'}</td>
                <td>{s.cost_per_minute}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
