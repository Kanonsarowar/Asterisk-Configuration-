'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function RoutesPage() {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    api('/api/routes')
      .then((d) => setRows(d.routes || []))
      .catch((e) => setErr(e.message));
  }, []);

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Routes</h1>
      {err && <p style={{ color: '#f87171' }}>{err}</p>}
      <div className="card" style={{ overflowX: 'auto' }}>
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
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.prefix}</td>
                <td>{r.supplier_name}</td>
                <td>{r.priority}</td>
                <td>{r.rate}</td>
                <td>{r.active ? 'yes' : 'no'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
