'use client';
import { useState } from 'react';
import { usePOS } from '@/lib/context';
import { uid, now } from '@/lib/fmt';

interface Driver {
  id: string;
  name: string;
  phone?: string;
  vehicle?: string;
  active: boolean;
  createdAt: string;
}

export default function DeliveryPage() {
  const { db, save } = usePOS();
  const drivers: Driver[] = (db as any).drivers ?? [];
  const [form, setForm] = useState({ name: '', phone: '', vehicle: '' });
  const [adding, setAdding] = useState(false);

  const handleAdd = () => {
    if (!form.name.trim()) return alert('Name required');
    save((d: any) => {
      d.drivers = [...(d.drivers ?? []), { id: uid(), name: form.name, phone: form.phone, vehicle: form.vehicle, active: true, createdAt: now() }];
      return d;
    });
    setForm({ name: '', phone: '', vehicle: '' });
    setAdding(false);
  };

  const toggle = (id: string) => {
    save((d: any) => { const dr = d.drivers?.find((x: any) => x.id === id); if (dr) dr.active = !dr.active; return d; });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
        <button className="btn btn-primary" onClick={() => setAdding(true)}>+ Add driver</button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Driver name</th>
              <th>Phone</th>
              <th>Vehicle</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {drivers.map((d: Driver) => (
              <tr key={d.id}>
                <td style={{ fontWeight: 500 }}>{d.name}</td>
                <td style={{ color: 'var(--text2)' }}>{d.phone ?? '—'}</td>
                <td style={{ color: 'var(--text2)' }}>{d.vehicle ?? '—'}</td>
                <td><span className={`badge ${d.active ? 'badge-green' : 'badge-red'}`}>{d.active ? 'Active' : 'Inactive'}</span></td>
                <td><button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => toggle(d.id)}>{d.active ? 'Deactivate' : 'Activate'}</button></td>
              </tr>
            ))}
            {drivers.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text2)', padding: 40 }}>No drivers yet</td></tr>}
          </tbody>
        </table>
      </div>

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
              <button className="btn btn-primary" onClick={handleAdd}>Add driver</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
