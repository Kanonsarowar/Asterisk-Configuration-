import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { api } from '../../api/client';
import DataTable from '../../components/shared/DataTable';
import Modal from '../../components/shared/Modal';

export default function DIDInventory() {
  const [filters, setFilters] = useState({ status: '', country_code: '' });
  const qs = Object.entries(filters).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join('&');
  const { data, loading, refetch } = useApi(`/api/did-inventory${qs ? '?' + qs : ''}`);
  const [showAdd, setShowAdd] = useState(false);
  const [showRoute, setShowRoute] = useState(null);
  const [form, setForm] = useState({ did_number: '', carrier_id: '', country_code: '', monthly_price: 0, billing_type: 'prepaid' });
  const [routeForm, setRouteForm] = useState({ route_type: 'sip_endpoint', route_target: '', failover_target: '' });

  const columns = [
    { key: 'id', label: 'ID' },
    { key: 'did_number', label: 'DID Number' },
    { key: 'country_code', label: 'Country' },
    { key: 'carrier_name', label: 'Carrier' },
    { key: 'customer_name', label: 'Customer' },
    { key: 'status', label: 'Status', render: r => <span className={`badge ${r.status === 'assigned' ? 'badge-green' : r.status === 'available' ? 'badge-blue' : 'badge-yellow'}`}>{r.status}</span> },
    { key: 'route_type', label: 'Route', render: r => r.route_type || <span style={{ color: 'var(--text-dim)' }}>—</span> },
    { key: 'billing_type', label: 'Billing', render: r => <span className={`badge ${r.billing_type === 'prepaid' ? 'badge-yellow' : 'badge-blue'}`}>{r.billing_type}</span> },
    { key: 'monthly_price', label: 'Price', render: r => `$${Number(r.monthly_price).toFixed(2)}` },
    { key: 'actions', label: '', render: r => (
      <div className="flex-gap">
        <button className="btn-outline btn-sm" onClick={() => { setShowRoute(r); setRouteForm({ route_type: r.route_type || 'sip_endpoint', route_target: r.route_target || '', failover_target: r.failover_target || '' }); }}>Route</button>
      </div>
    )},
  ];

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      await api('/api/did-inventory', { method: 'POST', body: form });
      setShowAdd(false);
      refetch();
    } catch (err) { alert(err.message); }
  };

  const handleRoute = async (e) => {
    e.preventDefault();
    try {
      await api(`/api/did-inventory/${showRoute.id}/route`, { method: 'POST', body: routeForm });
      setShowRoute(null);
      refetch();
    } catch (err) { alert(err.message); }
  };

  return (
    <div>
      <div className="page-header">
        <h2>DID Inventory</h2>
        <div className="flex-gap">
          <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))} style={{ width: 140 }}>
            <option value="">All Status</option>
            <option value="available">Available</option>
            <option value="assigned">Assigned</option>
            <option value="reserved">Reserved</option>
            <option value="blocked">Blocked</option>
          </select>
          <button className="btn-primary" onClick={() => setShowAdd(true)}>+ Add DID</button>
        </div>
      </div>
      <div className="card">
        <DataTable columns={columns} rows={data?.dids} loading={loading} />
        {data?.total > 0 && <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 8 }}>Total: {data.total}</div>}
      </div>
      {showAdd && (
        <Modal title="Add DID" onClose={() => setShowAdd(false)}>
          <form onSubmit={handleAdd}>
            <div className="form-group"><label>DID Number</label><input value={form.did_number} onChange={e => setForm(f => ({ ...f, did_number: e.target.value }))} required placeholder="+1234567890" /></div>
            <div className="form-row">
              <div className="form-group"><label>Country Code</label><input value={form.country_code} onChange={e => setForm(f => ({ ...f, country_code: e.target.value }))} placeholder="US" /></div>
              <div className="form-group"><label>Monthly Price</label><input type="number" step="0.01" value={form.monthly_price} onChange={e => setForm(f => ({ ...f, monthly_price: e.target.value }))} /></div>
            </div>
            <div className="form-group">
              <label>Billing Type</label>
              <select value={form.billing_type} onChange={e => setForm(f => ({ ...f, billing_type: e.target.value }))}>
                <option value="prepaid">Prepaid</option>
                <option value="postpaid">Postpaid</option>
              </select>
            </div>
            <button className="btn-primary" style={{ width: '100%', marginTop: 8 }}>Create DID</button>
          </form>
        </Modal>
      )}
      {showRoute && (
        <Modal title={`Route: ${showRoute.did_number}`} onClose={() => setShowRoute(null)}>
          <form onSubmit={handleRoute}>
            <div className="form-group">
              <label>Route Type</label>
              <select value={routeForm.route_type} onChange={e => setRouteForm(f => ({ ...f, route_type: e.target.value }))}>
                <option value="sip_endpoint">SIP Endpoint</option>
                <option value="ivr">IVR</option>
                <option value="queue">Queue</option>
                <option value="voicemail">Voicemail</option>
                <option value="failover">Failover</option>
                <option value="time_condition">Time Condition</option>
              </select>
            </div>
            <div className="form-group"><label>Route Target</label><input value={routeForm.route_target} onChange={e => setRouteForm(f => ({ ...f, route_target: e.target.value }))} placeholder="endpoint ID or name" /></div>
            <div className="form-group"><label>Failover Target</label><input value={routeForm.failover_target} onChange={e => setRouteForm(f => ({ ...f, failover_target: e.target.value }))} placeholder="optional" /></div>
            <button className="btn-primary" style={{ width: '100%', marginTop: 8 }}>Save Route</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
