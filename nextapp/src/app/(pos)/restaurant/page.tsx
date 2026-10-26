'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePOS } from '@/lib/context';
import { Table } from '@/lib/types';
import { uid, fmtCurrency, fmtDateTime } from '@/lib/fmt';

const STATUS_COLORS: Record<Table['status'], string> = {
  available: 'var(--green)',
  occupied: 'var(--yellow)',
  bill_requested: 'var(--red)',
  reserved: 'var(--accent)',
};
const STATUS_LABELS: Record<Table['status'], string> = {
  available: 'Available',
  occupied: 'Occupied',
  bill_requested: 'Bill Requested',
  reserved: 'Reserved',
};

function AddTableModal({ onClose, onSave }: { onClose: () => void; onSave: (t: Table) => void }) {
  const [number, setNumber] = useState('');
  const [name, setName] = useState('');
  const [seats, setSeats] = useState(4);
  const [section, setSection] = useState('');
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" style={{ width: 380 }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 18 }}>Add Table</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Table Number *</label>
            <input className="inp" value={number} onChange={e => setNumber(e.target.value)} placeholder="1" autoFocus />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Display Name</label>
            <input className="inp" value={name} onChange={e => setName(e.target.value)} placeholder="Window Table" />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Seats</label>
            <input className="inp" type="number" min={1} value={seats} onChange={e => setSeats(+e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Section</label>
            <input className="inp" value={section} onChange={e => setSection(e.target.value)} placeholder="Indoor / Outdoor" />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}
              onClick={() => {
                if (!number.trim()) return;
                onSave({ id: uid(), number: number.trim(), name: name.trim() || undefined, seats, section: section.trim() || undefined, status: 'available' });
              }}>Save</button>
            <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RestaurantPage() {
  const { db, save, settings } = usePOS();
  const [showAdd, setShowAdd] = useState(false);

  const readyKOTs = db.kots.filter(k => k.status === 'ready');

  const handleAddTable = (t: Table) => {
    save(d => { d.tables.push(t); });
    setShowAdd(false);
  };

  const sections = Array.from(new Set(db.tables.map(t => t.section || 'Main'))).sort();

  return (
    <div style={{ padding: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Tables</h1>
          <div style={{ color: 'var(--text2)', fontSize: 13, marginTop: 2 }}>{db.tables.length} tables · {db.tables.filter(t => t.status === 'occupied').length} occupied</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add Table</button>
      </div>

      {/* Ready alerts */}
      {readyKOTs.length > 0 && (
        <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid var(--green)', borderRadius: 10, padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20 }}>🔔</span>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--green)' }}>{readyKOTs.length} {readyKOTs.length === 1 ? 'order' : 'orders'} ready to serve!</div>
            <div style={{ fontSize: 13, color: 'var(--text2)' }}>
              {readyKOTs.map(k => k.tableName || 'Table').join(', ')}
            </div>
          </div>
          <Link href="/restaurant/kds" style={{ marginLeft: 'auto', color: 'var(--accent)', fontSize: 13, textDecoration: 'none', fontWeight: 600 }}>View KDS →</Link>
        </div>
      )}

      {db.tables.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 60, color: 'var(--text2)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🍽️</div>
          <div style={{ fontSize: 16, marginBottom: 8 }}>No tables yet</div>
          <div style={{ fontSize: 13, marginBottom: 20 }}>Add your first table to start taking restaurant orders</div>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add Table</button>
        </div>
      ) : (
        sections.map(section => (
          <div key={section} style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>{section}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
              {db.tables.filter(t => (t.section || 'Main') === section).map(table => {
                const order = table.currentOrderId ? db.orders.find(o => o.id === table.currentOrderId) : null;
                const kotStatuses = order ? db.kots.filter(k => k.orderId === order.id) : [];
                const hasReady = kotStatuses.some(k => k.status === 'ready');
                return (
                  <Link key={table.id} href={`/restaurant/order/${table.id}`} style={{ textDecoration: 'none' }}>
                    <div style={{
                      background: 'var(--bg2)',
                      border: `2px solid ${hasReady ? 'var(--green)' : STATUS_COLORS[table.status]}`,
                      borderRadius: 12,
                      padding: 16,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      position: 'relative',
                    }}>
                      {hasReady && (
                        <div style={{ position: 'absolute', top: -8, right: -8, background: 'var(--green)', color: '#fff', borderRadius: 10, fontSize: 10, fontWeight: 700, padding: '2px 6px' }}>READY</div>
                      )}
                      <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)' }}>T{table.number}</div>
                      {table.name && <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>{table.name}</div>}
                      <div style={{ fontSize: 11, color: 'var(--text2)' }}>👤 {table.seats} seats</div>
                      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: STATUS_COLORS[table.status] }} />
                        <span style={{ fontSize: 12, color: STATUS_COLORS[table.status], fontWeight: 600 }}>{STATUS_LABELS[table.status]}</span>
                      </div>
                      {order && (
                        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--text2)' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text)' }}>{fmtCurrency(order.total, settings.currency)}</div>
                          <div>{order.lines.length} items</div>
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))
      )}

      {/* Legend */}
      <div style={{ display: 'flex', gap: 20, marginTop: 24, flexWrap: 'wrap' }}>
        {(Object.keys(STATUS_LABELS) as Table['status'][]).map(s => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text2)' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: STATUS_COLORS[s], display: 'inline-block' }} />
            {STATUS_LABELS[s]}
          </div>
        ))}
      </div>

      {showAdd && <AddTableModal onClose={() => setShowAdd(false)} onSave={handleAddTable} />}
    </div>
  );
}
