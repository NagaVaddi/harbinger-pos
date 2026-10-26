'use client';
import { useState } from 'react';
import { usePOS } from '@/lib/context';
import { Customer } from '@/lib/types';
import { fmtCurrency, fmtDate, uid, now } from '@/lib/fmt';

function CustomerModal({ customer, onSave, onClose }: { customer: Partial<Customer> | null; onSave: (c: Customer) => void; onClose: () => void }) {
  const isNew = !customer?.id;
  const [form, setForm] = useState<Partial<Customer>>(customer ?? { status: 'active', registeredOn: now() });
  const set = (f: keyof Customer, v: unknown) => setForm(p => ({ ...p, [f]: v }));

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="card" style={{ width: 480 }}>
        <h2 style={{ marginBottom: 20 }}>{isNew ? 'New customer' : 'Edit customer'}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Name *</label>
            <input className="inp" value={form.name ?? ''} onChange={e => set('name', e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Phone</label>
            <input className="inp" value={form.phone ?? ''} onChange={e => set('phone', e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Email</label>
            <input className="inp" type="email" value={form.email ?? ''} onChange={e => set('email', e.target.value)} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Address</label>
            <input className="inp" value={form.address ?? ''} onChange={e => set('address', e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Credit limit</label>
            <input className="inp" type="number" min={0} value={form.creditLimit ?? ''} onChange={e => set('creditLimit', parseFloat(e.target.value) || undefined)} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Status</label>
            <select className="inp" value={form.status ?? 'active'} onChange={e => set('status', e.target.value as 'active' | 'inactive')}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => {
            if (!form.name?.trim()) return alert('Name required');
            onSave({ id: form.id ?? uid(), name: form.name!, phone: form.phone, email: form.email, address: form.address, creditLimit: form.creditLimit, balance: form.balance ?? 0, registeredOn: form.registeredOn ?? now(), status: form.status ?? 'active' });
          }}>
            {isNew ? 'Add customer' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CustomersPage() {
  const { db, save, settings } = usePOS();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Partial<Customer> | null | false>(false);

  const customers = db.customers.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search)
  );

  const handleSave = (c: Customer) => {
    save(d => {
      const idx = d.customers.findIndex(x => x.id === c.id);
      if (idx >= 0) d.customers[idx] = c; else d.customers = [...d.customers, c];
      return d;
    });
    setEditing(false);
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
        <input className="inp" style={{ maxWidth: 320 }} placeholder="Search customers…" value={search} onChange={e => setSearch(e.target.value)} />
        <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={() => setEditing({})}>+ New customer</button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Phone</th>
              <th>Email</th>
              <th style={{ textAlign: 'right' }}>Credit limit</th>
              <th style={{ textAlign: 'right' }}>Balance</th>
              <th>Registered</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {customers.map(c => (
              <tr key={c.id}>
                <td style={{ fontWeight: 500 }}>{c.name}</td>
                <td style={{ color: 'var(--text2)' }}>{c.phone ?? '—'}</td>
                <td style={{ color: 'var(--text2)', fontSize: 12 }}>{c.email ?? '—'}</td>
                <td style={{ textAlign: 'right' }}>{c.creditLimit != null ? fmtCurrency(c.creditLimit, settings.currency) : '—'}</td>
                <td style={{ textAlign: 'right', color: (c.balance ?? 0) > 0 ? 'var(--red)' : 'inherit' }}>
                  {fmtCurrency(c.balance ?? 0, settings.currency)}
                </td>
                <td style={{ color: 'var(--text2)', fontSize: 12 }}>{fmtDate(c.registeredOn)}</td>
                <td><span className={`badge ${c.status === 'active' ? 'badge-green' : 'badge-red'}`}>{c.status}</span></td>
                <td><button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setEditing(c)}>Edit</button></td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text2)', padding: 40 }}>
                {db.customers.length === 0 ? 'No customers yet' : 'No results'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing !== false && <CustomerModal customer={editing} onSave={handleSave} onClose={() => setEditing(false)} />}
    </div>
  );
}
