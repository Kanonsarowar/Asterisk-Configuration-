'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function UsersPage() {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    api('/api/users')
      .then((d) => setRows(d.users || []))
      .catch((e) => setErr(e.message));
  }, []);

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Users</h1>
      {err && <p style={{ color: '#f87171' }}>{err}</p>}
      <div className="card" style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Username</th>
              <th>Role</th>
              <th>Balance</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id}>
                <td>{u.id}</td>
                <td>{u.username}</td>
                <td>{u.role}</td>
                <td>{u.balance}</td>
                <td>{u.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
