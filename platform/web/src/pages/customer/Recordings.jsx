import { useApi } from '../../hooks/useApi';
import DataTable from '../../components/shared/DataTable';

export default function Recordings() {
  const { data, loading } = useApi('/api/recordings');

  const columns = [
    { key: 'id', label: 'ID' },
    { key: 'call_id', label: 'Call ID' },
    { key: 'filename', label: 'Filename' },
    { key: 'direction', label: 'Direction', render: r => <span className={`badge ${r.direction === 'inbound' ? 'badge-green' : 'badge-blue'}`}>{r.direction}</span> },
    { key: 'duration', label: 'Duration', render: r => {
      const m = Math.floor(r.duration / 60);
      const s = r.duration % 60;
      return `${m}:${String(s).padStart(2, '0')}`;
    }},
    { key: 'file_size', label: 'Size', render: r => {
      const kb = r.file_size / 1024;
      return kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb.toFixed(0)} KB`;
    }},
    { key: 'created_at', label: 'Date', render: r => new Date(r.created_at).toLocaleString() },
    { key: 'actions', label: '', render: r => (
      <audio controls preload="none" style={{ height: 28, maxWidth: 200 }}>
        <source src={`/api/recordings/${r.id}/play`} />
      </audio>
    )},
  ];

  return (
    <div>
      <div className="page-header"><h2>Call Recordings</h2></div>
      <div className="card">
        <DataTable columns={columns} rows={data?.recordings} loading={loading} empty="No recordings available" />
      </div>
    </div>
  );
}
