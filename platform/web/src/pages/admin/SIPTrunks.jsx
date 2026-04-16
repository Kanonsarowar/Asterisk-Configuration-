import { useApi } from '../../hooks/useApi';
import DataTable from '../../components/shared/DataTable';

export default function SIPTrunks() {
  const { data, loading } = useApi('/api/providers');

  const columns = [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Name' },
    { key: 'host', label: 'Host' },
    { key: 'port', label: 'Port' },
    { key: 'transport', label: 'Transport', render: r => r.transport?.toUpperCase() },
    { key: 'cost_per_minute', label: 'Cost/min', render: r => `$${Number(r.cost_per_minute).toFixed(4)}` },
    { key: 'max_cps', label: 'Max CPS' },
    { key: 'status', label: 'Status', render: r => <span className={`badge ${r.status === 'active' ? 'badge-green' : 'badge-red'}`}>{r.status}</span> },
  ];

  return (
    <div>
      <div className="page-header"><h2>SIP Trunk Management</h2></div>
      <div className="card">
        <DataTable columns={columns} rows={data?.providers} loading={loading} />
      </div>
    </div>
  );
}
