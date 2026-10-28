'use client';
import { useState } from 'react';
import { usePOS } from '@/lib/context';
import { uid, now } from '@/lib/fmt';

type Tab = 'orders' | 'apps' | 'qrlinks' | 'setup' | 'drivers';

interface Driver {
  id: string;
  name: string;
  phone?: string;
  vehicle?: string;
  active: boolean;
  createdAt: string;
}

const DELIVERY_APPS = [
  { id: 'talabat',      name: 'Talabat',       logo: '🛵', color: '#FF6B00', region: 'UAE/GCC' },
  { id: 'deliveroo',   name: 'Deliveroo',     logo: '🦘', color: '#00CCBC', region: 'UAE' },
  { id: 'careem',      name: 'Careem Now',    logo: '🟢', color: '#1DBF73', region: 'UAE/GCC' },
  { id: 'noon',        name: 'Noon Food',     logo: '🟡', color: '#FEEE00', region: 'UAE' },
  { id: 'keeta',       name: 'Keeta',         logo: '🔴', color: '#E30613', region: 'UAE/SA' },
  { id: 'hungerstation', name: 'HungerStation', logo: '🟠', color: '#F7941D', region: 'KSA' },
  { id: 'jahez',       name: 'Jahez',         logo: '🔵', color: '#0072B1', region: 'KSA' },
  { id: 'mrsool',      name: 'Mrsool',        logo: '💜', color: '#6B2B8A', region: 'KSA/GCC' },
  { id: 'toyou',       name: 'ToYou',         logo: '🟤', color: '#8B4513', region: 'KSA' },
  { id: 'thechefz',    name: 'The Chefz',     logo: '👨‍🍳', color: '#2C3E50', region: 'KSA' },
];

export default function DeliveryPage() {
  const { db, settings, save } = usePOS();
  const drivers: Driver[] = (db as any).drivers ?? [];
  const connectedApps: string[] = (db as any).connectedApps ?? [];

  const [tab, setTab] = useState<Tab>('apps');
  const [form, setForm] = useState({ name: '', phone: '', vehicle: '' });
  const [adding, setAdding] = useState(false);
  const [configApp, setConfigApp] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');

  const deliveryOrders = db.orders.filter(o => o.channel === 'delivery' || o.channel === 'online');

  const handleAddDriver = () => {
    if (!form.name.trim()) return alert('Name required');
    save((d: any) => {
      d.drivers = [...(d.drivers ?? []), { id: uid(), name: form.name, phone: form.phone, vehicle: form.vehicle, active: true, createdAt: now() }];
      return d;
    });
    setForm({ name: '', phone: '', vehicle: '' });
    setAdding(false);
  };

  const toggleDriver = (id: string) => {
    save((d: any) => { const dr = d.drivers?.find((x: any) => x.id === id); if (dr) dr.active = !dr.active; return d; });
  };

  const connectApp = (appId: string) => {
    if (!apiKey.trim()) return alert('Enter API key / restaurant ID');
    save((d: any) => {
      d.connectedApps = [...new Set([...(d.connectedApps ?? []), appId])];
      d.appKeys = { ...(d.appKeys ?? {}), [appId]: apiKey };
      return d;
    });
    setApiKey('');
    setConfigApp(null);
  };

  const disconnectApp = (appId: string) => {
    if (!confirm('Disconnect this app?')) return;
    save((d: any) => {
      d.connectedApps = (d.connectedApps ?? []).filter((a: string) => a !== appId);
      return d;
    });
  };

  const TABS: { id: Tab; label: string }[] = [
    { id: 'apps',     label: 'Delivery apps' },
    { id: 'orders',   label: 'Orders' },
    { id: 'drivers',  label: 'Drivers' },
    { id: 'qrlinks',  label: 'QR & links' },
    { id: 'setup',    label: 'Setup' },
  ];

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Online &amp; Delivery</h1>
      <p style={{ color: 'var(--text2)', fontSize: 14, marginBottom: 16 }}>Manage delivery apps, online orders and drivers</p>

      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '8px 16px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: tab === t.id ? 700 : 400,
            background: 'transparent', color: tab === t.id ? 'var(--accent)' : 'var(--text2)',
            borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
            whiteSpace: 'nowrap',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── DELIVERY APPS ─────────────────────────────────────────── */}
      {tab === 'apps' && (
        <div>
          <p style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 20 }}>Connect your restaurant to food delivery platforms. Orders will appear in the Orders tab once connected.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {DELIVERY_APPS.map(app => {
              const connected = connectedApps.includes(app.id);
              return (
                <div key={app.id} className="card" style={{ padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <span style={{ fontSize: 28 }}>{app.logo}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{app.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text2)' }}>{app.region}</div>
                    </div>
                    {connected && <span className="badge badge-green" style={{ fontSize: 11 }}>Connected</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {connected ? (
                      <>
                        <button className="btn btn-primary" style={{ fontSize: 12, padding: '4px 10px' }}>Test order</button>
                        <button className="btn" style={{ fontSize: 12, padding: '4px 10px' }}>Menu CSV</button>
                        <button className="btn" style={{ fontSize: 12, padding: '4px 10px' }}>Payout</button>
                        <button className="btn" style={{ fontSize: 12, padding: '4px 10px', color: 'var(--red)', borderColor: 'var(--red)' }} onClick={() => disconnectApp(app.id)}>Disconnect</button>
                      </>
                    ) : (
                      <button className="btn btn-primary" style={{ fontSize: 12, padding: '4px 12px' }} onClick={() => setConfigApp(app.id)}>Configure</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── ORDERS ────────────────────────────────────────────────── */}
      {tab === 'orders' && (
        <div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="tbl">
              <thead><tr><th>#</th><th>Time</th><th>Channel</th><th>Items</th><th style={{ textAlign: 'right' }}>Total</th><th>Status</th></tr></thead>
              <tbody>
                {deliveryOrders.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text2)', padding: 40 }}>No delivery orders yet. Orders from connected apps appear here.</td></tr>
                ) : deliveryOrders.slice().reverse().map(o => (
                  <tr key={o.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{o.no}</td>
                    <td style={{ fontSize: 12, color: 'var(--text2)' }}>{new Date(o.ts).toLocaleString()}</td>
                    <td><span style={{ textTransform: 'capitalize', fontSize: 13 }}>{o.channel}</span></td>
                    <td style={{ fontSize: 13 }}>{o.lines.length} item{o.lines.length !== 1 ? 's' : ''}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{settings.currency} {o.total.toFixed(2)}</td>
                    <td><span className={`badge badge-${o.status === 'paid' ? 'green' : 'red'}`} style={{ textTransform: 'capitalize' }}>{o.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── DRIVERS ───────────────────────────────────────────────── */}
      {tab === 'drivers' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
            <button className="btn btn-primary" onClick={() => setAdding(true)}>+ Add driver</button>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="tbl">
              <thead><tr><th>Driver name</th><th>Phone</th><th>Vehicle</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {drivers.map((d: Driver) => (
                  <tr key={d.id}>
                    <td style={{ fontWeight: 500 }}>{d.name}</td>
                    <td style={{ color: 'var(--text2)' }}>{d.phone ?? '—'}</td>
                    <td style={{ color: 'var(--text2)' }}>{d.vehicle ?? '—'}</td>
                    <td><span className={`badge ${d.active ? 'badge-green' : 'badge-red'}`}>{d.active ? 'Active' : 'Inactive'}</span></td>
                    <td><button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => toggleDriver(d.id)}>{d.active ? 'Deactivate' : 'Activate'}</button></td>
                  </tr>
                ))}
                {drivers.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text2)', padding: 40 }}>No drivers yet</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── QR & LINKS ────────────────────────────────────────────── */}
      {tab === 'qrlinks' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
            {[
              { label: 'Order online link', url: `${settings.business?.toLowerCase().replace(/\s+/g, '-') ?? 'store'}.harbinger.menu`, icon: '🔗' },
              { label: 'Table QR code', url: 'Scan to order from table', icon: '📱' },
              { label: 'Dine-in menu QR', url: 'Scan to view menu', icon: '🍽️' },
            ].map(item => (
              <div key={item.label} className="card" style={{ padding: 20, textAlign: 'center' }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>{item.icon}</div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{item.label}</div>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12 }}>{item.url}</div>
                <button className="btn" style={{ fontSize: 12 }}>Copy link</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── SETUP ─────────────────────────────────────────────────── */}
      {tab === 'setup' && (
        <div>
          <div className="card" style={{ maxWidth: 560 }}>
            <h3 style={{ fontWeight: 700, marginBottom: 16 }}>Delivery settings</h3>
            {[
              { label: 'Minimum order value', placeholder: '0' },
              { label: 'Delivery radius (km)', placeholder: '5' },
              { label: 'Delivery charge', placeholder: '0' },
              { label: 'Estimated delivery time (min)', placeholder: '30' },
            ].map(f => (
              <div key={f.label} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>{f.label}</label>
                <input className="inp" placeholder={f.placeholder} />
              </div>
            ))}
            <button className="btn btn-primary" style={{ marginTop: 8 }}>Save settings</button>
          </div>
        </div>
      )}

      {/* Add driver modal */}
      {adding && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={e => e.target === e.currentTarget && setAdding(false)}>
          <div className="card" style={{ width: 420 }}>
            <h2 style={{ marginBottom: 20 }}>Add driver</h2>
            <div style={{ display: 'grid', gap: 12 }}>
              {[
                { label: 'Name *', key: 'name', placeholder: 'Driver name' },
                { label: 'Phone', key: 'phone', placeholder: '+971 50 000 0000' },
                { label: 'Vehicle / plate', key: 'vehicle', placeholder: 'e.g. Toyota Hiace · DXB 12345' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>{f.label}</label>
                  <input className="inp" value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <button className="btn btn-ghost" onClick={() => setAdding(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddDriver}>Add driver</button>
            </div>
          </div>
        </div>
      )}

      {/* Configure app modal */}
      {configApp && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={e => e.target === e.currentTarget && setConfigApp(null)}>
          <div className="card" style={{ width: 440 }}>
            <h2 style={{ marginBottom: 8 }}>Connect {DELIVERY_APPS.find(a => a.id === configApp)?.name}</h2>
            <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20 }}>Enter your API key or restaurant ID from the {DELIVERY_APPS.find(a => a.id === configApp)?.name} partner portal.</p>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>API key / Restaurant ID</label>
              <input className="inp" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="Paste your key here" />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <button className="btn" onClick={() => setConfigApp(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => connectApp(configApp)}>Connect</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
