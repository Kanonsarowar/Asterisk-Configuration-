import { useApi } from '../../hooks/useApi';
import DataTable from '../../components/shared/DataTable';

export default function Routes() {
  const { data, loading } = useApi('/api/routes');

  const columns = [
    { key: 'id', label: 'ID' },
    { key: 'prefix', label: 'Prefix' },
    { key: 'provider_name', label: 'Provider', render: r => r.provider_name || `#${r.provider_id}` },
    { key: 'priority', label: 'Priority' },
    { key: 'rate', label: 'Rate', render: r => `$${Number(r.rate).toFixed(4)}` },
    { key: 'active', label: 'Active', render: r => r.active ? <span className="badge badge-green">Yes</span> : <span className="badge badge-red">No</span> },
  ];

  return (
    <div>
      <div className="page-header"><h2>Routing Rules</h2></div>
      <div className="card">
        <DataTable columns={columns} rows={data?.routes} loading={loading} />
      </div>
    </div>
  );
}
