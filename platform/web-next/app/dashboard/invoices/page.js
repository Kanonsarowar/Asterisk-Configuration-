'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function InvoicesPage() {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    api('/api/billing/invoices')
      .then((d) => setRows(d.invoices || []))
      .catch((e) => setErr(e.message));
  }, []);

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Invoices</h1>
      {err && <p style={{ color: '#f87171' }}>{err}</p>}
      <div className="card" style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>User</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((inv) => (
              <tr key={inv.id}>
                <td>{inv.id}</td>
                <td>{inv.user_id}</td>
                <td>{inv.total_amount}</td>
                <td>{inv.status}</td>
                <td>{inv.created_at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
