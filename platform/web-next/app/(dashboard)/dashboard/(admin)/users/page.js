'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import PageHeader from '@/components/dashboard/PageHeader';
import FilterBar from '@/components/dashboard/FilterBar';
import TableCard from '@/components/dashboard/TableCard';

export default function UsersPage() {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => {
    api('/api/users')
      .then((d) => setRows(d.users || []))
      .catch((e) => setErr(e.message));
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (u) =>
        String(u.username || '')
          .toLowerCase()
          .includes(s) ||
        String(u.role || '')
          .toLowerCase()
          .includes(s) ||
        String(u.id) === s
    );
  }, [rows, q]);

  return (
    <div>
      <PageHeader title="Users" subtitle="Platform accounts: balance and billing currency." />
      {err && <p style={{ color: '#f87171' }}>{err}</p>}
      <FilterBar>
        <div className="field" style={{ flex: 1, minWidth: 200, maxWidth: 360 }}>
          <span className="field-label">Search</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Username, role, or ID" />
        </div>
      </FilterBar>
      <TableCard>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Username</th>
              <th>Role</th>
              <th>Balance</th>
              <th>Currency</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id}>
                <td>{u.id}</td>
                <td style={{ fontWeight: 600 }}>{u.username}</td>
                <td>{u.role}</td>
                <td style={{ fontFamily: 'ui-monospace, monospace' }}>{u.balance}</td>
                <td>{u.billing_currency || 'USD'}</td>
                <td>{u.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableCard>
    </div>
  );
}
