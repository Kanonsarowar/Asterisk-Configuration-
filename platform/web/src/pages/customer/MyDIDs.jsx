import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { api } from '../../api/client';
import DataTable from '../../components/shared/DataTable';
import Modal from '../../components/shared/Modal';

export default function MyDIDs() {
  const { data, loading, refetch } = useApi('/api/did-inventory');
  const [showRoute, setShowRoute] = useState(null);
  const [routeForm, setRouteForm] = useState({ route_type: 'sip_endpoint', route_target: '', failover_target: '' });
  const { data: endpoints } = useApi('/api/sip-endpoints');
  const { data: queues } = useApi('/api/queues');
  const { data: voicemail } = useApi('/api/voicemail');
  const { data: ivrs } = useApi('/api/ivr');
  const { data: tcs } = useApi('/api/time-conditions');

  const columns = [
    { key: 'did_number', label: 'DID Number' },
    { key: 'country_code', label: 'Country' },
    { key: 'status', label: 'Status', render: r => <span className={`badge ${r.status === 'assigned' ? 'badge-green' : 'badge-blue'}`}>{r.status}</span> },
    { key: 'route_type', label: 'Route Type', render: r => r.route_type || <span style={{ color: 'var(--text-dim)' }}>Not configured</span> },
    { key: 'route_target', label: 'Target', render: r => r.route_target || '—' },
    { key: 'failover_target', label: 'Failover', render: r => r.failover_target || '—' },
    { key: 'billing_type', label: 'Billing', render: r => <span className={`badge ${r.billing_type === 'prepaid' ? 'badge-yellow' : 'badge-blue'}`}>{r.billing_type}</span> },
    { key: 'monthly_price', label: 'Monthly', render: r => `$${Number(r.monthly_price).toFixed(2)}` },
    { key: 'actions', label: '', render: r => (
      <button className="btn-primary btn-sm" onClick={() => {
        setShowRoute(r);
        setRouteForm({ route_type: r.route_type || 'sip_endpoint', route_target: r.route_target || '', failover_target: r.failover_target || '' });
      }}>Configure</button>
    )},
  ];

  const handleRoute = async (e) => {
    e.preventDefault();
    try {
      await api(`/api/did-inventory/${showRoute.id}/route`, { method: 'POST', body: routeForm });
      setShowRoute(null);
      refetch();
    } catch (err) { alert(err.message); }
  };

  const targetOptions = () => {
    switch (routeForm.route_type) {
      case 'sip_endpoint': return endpoints?.endpoints?.map(e => ({ value: String(e.id), label: `${e.name} (${e.username})` })) || [];
      case 'queue': return queues?.queues?.map(q => ({ value: String(q.id), label: q.name })) || [];
      case 'voicemail': return voicemail?.voicemail_boxes?.map(v => ({ value: v.mailbox, label: `${v.mailbox}${v.email ? ' — ' + v.email : ''}` })) || [];
      case 'ivr': return ivrs?.rows?.map(i => ({ value: String(i.id), label: i.name })) || [];
      case 'time_condition': return tcs?.time_conditions?.map(t => ({ value: String(t.id), label: t.name })) || [];
      default: return [];
    }
  };

  return (
    <div>
      <div className="page-header"><h2>My DID Numbers</h2></div>
      <div className="card">
        <DataTable columns={columns} rows={data?.dids} loading={loading} empty="No DIDs assigned to your account" />
        {data?.total > 0 && <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 8 }}>Total: {data.total} DIDs</div>}
      </div>
      {showRoute && (
        <Modal title={`Configure Routing: ${showRoute.did_number}`} onClose={() => setShowRoute(null)}>
          <form onSubmit={handleRoute}>
            <div className="form-group">
              <label>Route Type</label>
              <select value={routeForm.route_type} onChange={e => setRouteForm(f => ({ ...f, route_type: e.target.value, route_target: '' }))}>
                <option value="sip_endpoint">SIP Endpoint</option>
                <option value="ivr">IVR Menu</option>
                <option value="queue">Call Queue</option>
                <option value="voicemail">Voicemail</option>
                <option value="failover">Failover Chain</option>
                <option value="time_condition">Time Condition</option>
              </select>
            </div>
            <div className="form-group">
              <label>Primary Target</label>
              {targetOptions().length > 0 ? (
                <select value={routeForm.route_target} onChange={e => setRouteForm(f => ({ ...f, route_target: e.target.value }))}>
                  <option value="">— Select —</option>
                  {targetOptions().map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : (
                <input value={routeForm.route_target} onChange={e => setRouteForm(f => ({ ...f, route_target: e.target.value }))} placeholder="Target identifier" />
              )}
            </div>
            <div className="form-group">
              <label>Failover Target (optional)</label>
              <input value={routeForm.failover_target} onChange={e => setRouteForm(f => ({ ...f, failover_target: e.target.value }))} placeholder="Failover endpoint or voicemail box" />
            </div>
            <button className="btn-primary" style={{ width: '100%', marginTop: 8 }}>Save Routing</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
