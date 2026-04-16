import { useApi } from '../../hooks/useApi';
import DataTable from '../../components/shared/DataTable';

export default function CustomerInvoices() {
  const { data, loading } = useApi('/api/billing/invoices');

  const columns = [
    { key: 'id', label: 'Invoice #' },
    { key: 'total_amount', label: 'Amount', render: r => `$${Number(r.total_amount).toFixed(2)}` },
    { key: 'status', label: 'Status', render: r => (
      <span className={`badge ${r.status === 'paid' ? 'badge-green' : r.status === 'issued' ? 'badge-blue' : r.status === 'draft' ? 'badge-yellow' : 'badge-red'}`}>{r.status}</span>
    )},
    { key: 'period', label: 'Period', render: r => `${r.period_start?.slice(0, 10) || '—'} → ${r.period_end?.slice(0, 10) || '—'}` },
    { key: 'created_at', label: 'Created', render: r => new Date(r.created_at).toLocaleDateString() },
    { key: 'actions', label: '', render: r => (
      <a href={`/api/billing/invoices/${r.id}/csv`} className="btn-outline btn-sm" target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>Download</a>
    )},
  ];

  return (
    <div>
      <div className="page-header"><h2>Invoices</h2></div>
      <div className="card">
        <DataTable columns={columns} rows={data?.invoices} loading={loading} empty="No invoices available" />
      </div>
    </div>
  );
}
