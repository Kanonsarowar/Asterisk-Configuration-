import { useApi } from '../../hooks/useApi';
import DataTable from '../../components/shared/DataTable';

export default function IVR() {
  const { data, loading } = useApi('/api/ivr');

  const columns = [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'IVR Name' },
    { key: 'audio_file', label: 'Audio File', render: r => r.audio_file || <span style={{ color: 'var(--text-dim)' }}>No audio</span> },
    { key: 'language', label: 'Language' },
  ];

  return (
    <div>
      <div className="page-header"><h2>IVR Menus</h2></div>
      <div className="card">
        <DataTable columns={columns} rows={data?.rows} loading={loading} empty="No IVR menus available. Contact admin to set up IVR." />
      </div>
    </div>
  );
}
