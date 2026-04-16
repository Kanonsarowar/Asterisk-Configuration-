import { useApi } from '../../hooks/useApi';
import DataTable from '../../components/shared/DataTable';

export default function SIPTrunks() {
  const { data, loading } = useApi('/api/suppliers');

  const columns = [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Name' },
    { key: 'host', label: 'Host' },
    { key: 'port', label: 'Port' },
    { key: 'protocol', label: 'Protocol', render: r => r.protocol?.toUpperCase() },
    { key: 'cost_per_minute', label: 'Cost/min', render: r => `$${Number(r.cost_per_minute).toFixed(4)}` },
    { key: 'routing_priority', label: 'Priority' },
    { key: 'active', label: 'Active', render: r => r.active ? <span className="badge badge-green">Yes</span> : <span className="badge badge-red">No</span> },
  ];

  return (
    <div>
      <div className="page-header"><h2>SIP Trunk Management</h2></div>
      <div className="card">
        <DataTable columns={columns} rows={data?.suppliers} loading={loading} />
      </div>
    </div>
  );
}
