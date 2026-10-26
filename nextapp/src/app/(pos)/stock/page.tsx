'use client';
import { useState } from 'react';
import { usePOS } from '@/lib/context';
import { fmtCurrency, fmtDate, uid, now } from '@/lib/fmt';
import { Product } from '@/lib/types';

type Tab = 'manage' | 'receive' | 'batches' | 'reorder';

export default function StockPage() {
  const { db, save, settings } = usePOS();
  const [tab, setTab] = useState<Tab>('manage');
  const [search, setSearch] = useState('');

  // Receive stock form
  const [recvProductId, setRecvProductId] = useState('');
  const [recvQty, setRecvQty] = useState('');
  const [recvCost, setRecvCost] = useState('');
  const [recvBatch, setRecvBatch] = useState('');
  const [recvExpiry, setRecvExpiry] = useState('');

  const products = db.products.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode?.includes(search)
  );

  const handleReceive = () => {
    const p = db.products.find(x => x.id === recvProductId);
    if (!p) return alert('Select a product');
    const qty = parseFloat(recvQty);
    if (!qty || qty <= 0) return alert('Enter valid quantity');
    save(d => {
      const prod = d.products.find(x => x.id === recvProductId);
      if (prod) {
        prod.stock += qty;
        if (recvCost) prod.cost = parseFloat(recvCost);
      }
      d.batches = [...(d.batches ?? []), {
        id: uid(),
        productId: recvProductId,
        productName: p.name,
        batchNo: recvBatch || undefined,
        totalQty: qty,
        damagedQty: 0,
        expiryDate: recvExpiry || undefined,
        createdAt: now(),
        updatedAt: now(),
      }];
      return d;
    });
    setRecvQty(''); setRecvBatch(''); setRecvExpiry(''); setRecvCost('');
    alert(`✓ Received ${qty} × ${p.name}`);
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'manage', label: 'Manage stock' },
    { key: 'receive', label: 'Receive stock' },
    { key: 'batches', label: 'Stock batches' },
    { key: 'reorder', label: 'Reorder alerts' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
            background: tab === t.key ? 'var(--accent)' : 'var(--bg3)',
            color: tab === t.key ? '#fff' : 'var(--text2)',
          }}>{t.label}</button>
        ))}
      </div>

      {(tab === 'manage' || tab === 'reorder') && (
        <div>
          <input className="inp" style={{ maxWidth: 320, marginBottom: 16 }} placeholder="Search products…" value={search} onChange={e => setSearch(e.target.value)} />
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Product</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                  <th style={{ textAlign: 'right' }}>Available</th>
                  <th style={{ textAlign: 'right' }}>Min stock</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Value</th>
                </tr>
              </thead>
              <tbody>
                {products
                  .filter(p => tab === 'reorder' ? (p.minStock != null && p.stock <= p.minStock) : true)
                  .map(p => {
                    const low = p.minStock != null && p.stock <= p.minStock;
                    const out = p.stock <= 0;
                    return (
                      <tr key={p.id}>
                        <td>
                          <div style={{ fontWeight: 500 }}>{p.name}</div>
                          {p.nameAr && <div style={{ fontSize: 11, color: 'var(--text2)', direction: 'rtl', textAlign: 'left' }}>{p.nameAr}</div>}
                        </td>
                        <td style={{ textAlign: 'right' }}>{p.stock} {p.unit ?? ''}</td>
                        <td style={{ textAlign: 'right', color: out ? 'var(--red)' : low ? 'var(--yellow)' : 'inherit', fontWeight: 600 }}>
                          {p.stock} {p.unit ?? ''}
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--text2)' }}>{p.minStock ?? '—'}</td>
                        <td>
                          <span className={`badge ${out ? 'badge-red' : low ? 'badge-yellow' : 'badge-green'}`}>
                            {out ? 'Out of stock' : low ? 'Low stock' : 'OK'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>{fmtCurrency(p.stock * p.price, settings.currency)}</td>
                      </tr>
                    );
                  })}
                {products.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text2)', padding: 32 }}>No products</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'receive' && (
        <div className="card" style={{ maxWidth: 540 }}>
          <h2 style={{ marginBottom: 20 }}>Receive stock</h2>
          <div style={{ display: 'grid', gap: 14 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Product *</label>
              <select className="inp" value={recvProductId} onChange={e => setRecvProductId(e.target.value)}>
                <option value="">Select product…</option>
                {db.products.filter(p => p.active).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Quantity *</label>
                <input className="inp" type="number" min={0} step={0.001} value={recvQty} onChange={e => setRecvQty(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Cost ({settings.currency}, optional)</label>
                <input className="inp" type="number" min={0} step={0.01} value={recvCost} onChange={e => setRecvCost(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Batch number</label>
                <input className="inp" value={recvBatch} onChange={e => setRecvBatch(e.target.value)} placeholder="Optional" />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Expiry date</label>
                <input className="inp" type="date" value={recvExpiry} onChange={e => setRecvExpiry(e.target.value)} />
              </div>
            </div>
            <button className="btn btn-primary" style={{ justifyContent: 'center', padding: 12 }} onClick={handleReceive}>
              Receive stock
            </button>
          </div>
        </div>
      )}

      {tab === 'batches' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Product</th>
                <th>Batch no.</th>
                <th>Barcode</th>
                <th style={{ textAlign: 'right' }}>Total stock</th>
                <th style={{ textAlign: 'right' }}>Damaged</th>
                <th>Expiry</th>
                <th>Created</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {(db.batches ?? []).map(b => (
                <tr key={b.id}>
                  <td style={{ fontWeight: 500 }}>{b.productName}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{b.batchNo ?? '—'}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text2)' }}>
                    {db.products.find(p => p.id === b.productId)?.barcode ?? '—'}
                  </td>
                  <td style={{ textAlign: 'right' }}>{b.totalQty}</td>
                  <td style={{ textAlign: 'right', color: b.damagedQty > 0 ? 'var(--red)' : 'inherit' }}>{b.damagedQty}</td>
                  <td style={{ color: b.expiryDate && b.expiryDate < new Date().toISOString().slice(0, 10) ? 'var(--red)' : 'var(--text2)', fontSize: 12 }}>
                    {b.expiryDate ? fmtDate(b.expiryDate) : '—'}
                  </td>
                  <td style={{ color: 'var(--text2)', fontSize: 12 }}>{fmtDate(b.createdAt)}</td>
                  <td style={{ color: 'var(--text2)', fontSize: 12 }}>{fmtDate(b.updatedAt)}</td>
                </tr>
              ))}
              {!(db.batches ?? []).length && <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text2)', padding: 32 }}>No batches yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
