'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import { api, getToken } from '@/lib/api';
import PageHeader from '@/components/dashboard/PageHeader';
import FilterBar from '@/components/dashboard/FilterBar';
import TableCard from '@/components/dashboard/TableCard';
import { useSession } from '@/hooks/useSession';
import { isAdmin } from '@/lib/auth';

export default function InvoicesPage() {
  const { user } = useSession({ refresh: false });
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState('');
  const [adminUserId, setAdminUserId] = useState('');
  const [expanded, setExpanded] = useState({});

  const load = useCallback(async () => {
    if (!getToken()) return;
    try {
      let path = '/api/billing/invoices';
      if (isAdmin(user) && adminUserId.trim()) {
        path += `?user_id=${encodeURIComponent(adminUserId.trim())}`;
      }
      const data = await api(path);
      setRows(data.invoices || []);
      setErr('');
    } catch (e) {
      setErr(e.message);
    }
  }, [user, adminUserId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <PageHeader
        title="Invoices"
        subtitle="Issued billing documents; summary_json holds per-prefix totals when generated from the API."
        actions={
          <button className="btn" type="button" onClick={load}>
            Reload
          </button>
        }
      />
      {err && <p style={{ color: '#f87171' }}>{err}</p>}
      {isAdmin(user) && (
        <FilterBar>
          <div className="field" style={{ minWidth: 160, maxWidth: 200 }}>
            <span className="field-label">Filter user ID</span>
            <input value={adminUserId} onChange={(e) => setAdminUserId(e.target.value)} placeholder="optional" />
          </div>
          <button className="btn" type="button" onClick={load} style={{ alignSelf: 'flex-end' }}>
            Apply
          </button>
        </FilterBar>
      )}
      <TableCard>
        <table>
          <thead>
            <tr>
              <th style={{ width: 40 }} />
              <th>ID</th>
              <th>User</th>
              <th>Amount</th>
              <th>Currency</th>
              <th>Status</th>
              <th>Period</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((inv) => (
              <Fragment key={inv.id}>
                <tr>
                  <td>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ padding: '4px 8px', fontSize: 12 }}
                      onClick={() => setExpanded((e) => ({ ...e, [inv.id]: !e[inv.id] }))}
                    >
                      {expanded[inv.id] ? '−' : '+'}
                    </button>
                  </td>
                  <td>{inv.id}</td>
                  <td>{inv.user_id}</td>
                  <td style={{ fontWeight: 600 }}>{inv.total_amount}</td>
                  <td>{inv.currency || 'USD'}</td>
                  <td>{inv.status}</td>
                  <td style={{ fontSize: 12 }}>
                    {inv.period_start || '—'} → {inv.period_end || '—'}
                  </td>
                  <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{inv.created_at}</td>
                </tr>
                {expanded[inv.id] && (
                  <tr>
                    <td colSpan={8} style={{ background: 'rgba(0,0,0,0.2)', verticalAlign: 'top' }}>
                      <pre
                        style={{
                          margin: 12,
                          padding: 12,
                          borderRadius: 8,
                          border: '1px solid var(--border)',
                          overflow: 'auto',
                          fontSize: 12,
                          maxHeight: 280,
                        }}
                      >
                        {inv.summary_json
                          ? JSON.stringify(
                              typeof inv.summary_json === 'string' ? JSON.parse(inv.summary_json) : inv.summary_json,
                              null,
                              2
                            )
                          : 'No summary_json stored for this invoice.'}
                      </pre>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </TableCard>
    </div>
  );
}
