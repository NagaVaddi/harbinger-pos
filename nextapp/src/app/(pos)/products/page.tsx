'use client';
import { useState } from 'react';
import { usePOS } from '@/lib/context';
import { Product } from '@/lib/types';
import { fmtCurrency, uid, now } from '@/lib/fmt';

function ProductModal({
  product,
  onSave,
  onClose,
}: {
  product: Partial<Product> | null;
  onSave: (p: Product) => void;
  onClose: () => void;
}) {
  const { settings } = usePOS();
  const isNew = !product?.id;
  const [form, setForm] = useState<Partial<Product>>(product ?? { active: true, taxable: true, stock: 0, price: 0 });

  const set = (field: keyof Product, value: unknown) => setForm(f => ({ ...f, [field]: value }));

  // Auto Arabic
  const autoAr = (en: string) => en; // simplified; full dict in slips.js

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="card" style={{ width: 540, maxHeight: '90vh', overflowY: 'auto' }}>
        <h2 style={{ marginBottom: 20 }}>{isNew ? 'New product' : 'Edit product'}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Name (English)</label>
            <input className="inp" value={form.name ?? ''} onChange={e => {
              set('name', e.target.value);
              if (!form.nameAr || form.nameAr === autoAr(form.name ?? '')) set('nameAr', autoAr(e.target.value));
            }} placeholder="Product name" />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Arabic name <span style={{ color: 'var(--text2)' }}>(optional)</span></label>
            <input className="inp" value={form.nameAr ?? ''} onChange={e => set('nameAr', e.target.value)}
              placeholder="يُملأ تلقائياً — يمكنك تعديله" dir="rtl" />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Price ({settings.currency})</label>
            <input className="inp" type="number" min={0} step={0.01} value={form.price ?? ''} onChange={e => set('price', parseFloat(e.target.value) || 0)} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Cost <span style={{ color: 'var(--text2)' }}>(optional)</span></label>
            <input className="inp" type="number" min={0} step={0.01} value={form.cost ?? ''} onChange={e => set('cost', parseFloat(e.target.value) || undefined)} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>SKU</label>
            <input className="inp" value={form.sku ?? ''} onChange={e => set('sku', e.target.value)} placeholder="Optional" />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Barcode</label>
            <input className="inp" value={form.barcode ?? ''} onChange={e => set('barcode', e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Stock</label>
            <input className="inp" type="number" min={0} value={form.stock ?? 0} onChange={e => set('stock', parseFloat(e.target.value) || 0)} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Min stock (reorder point)</label>
            <input className="inp" type="number" min={0} value={form.minStock ?? ''} onChange={e => set('minStock', parseFloat(e.target.value) || undefined)} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Category</label>
            <input className="inp" value={form.category ?? ''} onChange={e => set('category', e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Unit</label>
            <input className="inp" value={form.unit ?? ''} onChange={e => set('unit', e.target.value)} placeholder="pcs, kg, ltr…" />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer', fontSize: 13 }}>
            <input type="checkbox" checked={form.taxable ?? true} onChange={e => set('taxable', e.target.checked)} />
            Taxable
          </label>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer', fontSize: 13 }}>
            <input type="checkbox" checked={form.active ?? true} onChange={e => set('active', e.target.checked)} />
            Active
          </label>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer', fontSize: 13 }}>
            <input type="checkbox" checked={form.isWeighed ?? false} onChange={e => set('isWeighed', e.target.checked)} />
            Sold by weight
          </label>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer', fontSize: 13 }}>
            <input type="checkbox" checked={form.hasExpiry ?? false} onChange={e => set('hasExpiry', e.target.checked)} />
            Has expiry
          </label>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => {
            if (!form.name?.trim()) return alert('Name required');
            onSave({ id: form.id ?? uid(), name: form.name!, nameAr: form.nameAr, sku: form.sku, barcode: form.barcode, price: form.price ?? 0, cost: form.cost, category: form.category, unit: form.unit, stock: form.stock ?? 0, minStock: form.minStock, taxable: form.taxable ?? true, active: form.active ?? true, isWeighed: form.isWeighed, hasExpiry: form.hasExpiry });
          }}>
            {isNew ? 'Add product' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProductsPage() {
  const { db, save, settings } = usePOS();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Partial<Product> | null | false>(false);

  const products = db.products.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode?.includes(search) || p.sku?.includes(search)
  );

  const handleSave = (p: Product) => {
    save(d => {
      const idx = d.products.findIndex(x => x.id === p.id);
      if (idx >= 0) { d.products[idx] = p; } else { d.products = [...d.products, p]; }
      return d;
    });
    setEditing(false);
  };

  const handleToggle = (id: string) => {
    save(d => { const p = d.products.find(x => x.id === id); if (p) p.active = !p.active; return d; });
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
        <input className="inp" style={{ maxWidth: 320 }} placeholder="Search products…" value={search} onChange={e => setSearch(e.target.value)} />
        <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={() => setEditing({})}>+ New product</button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Product</th>
              <th>SKU / Barcode</th>
              <th style={{ textAlign: 'right' }}>Price</th>
              <th style={{ textAlign: 'right' }}>Cost</th>
              <th style={{ textAlign: 'right' }}>Stock</th>
              <th>Category</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {products.map(p => (
              <tr key={p.id}>
                <td>
                  <div style={{ fontWeight: 500 }}>{p.name}</div>
                  {p.nameAr && <div style={{ fontSize: 12, color: 'var(--text2)', direction: 'rtl', textAlign: 'left' }}>{p.nameAr}</div>}
                </td>
                <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text2)' }}>
                  {p.sku && <div>{p.sku}</div>}
                  {p.barcode && <div>{p.barcode}</div>}
                </td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtCurrency(p.price, settings.currency)}</td>
                <td style={{ textAlign: 'right', color: 'var(--text2)' }}>{p.cost != null ? fmtCurrency(p.cost, settings.currency) : '—'}</td>
                <td style={{ textAlign: 'right' }}>
                  <span style={{ color: p.stock <= 0 ? 'var(--red)' : p.minStock && p.stock <= p.minStock ? 'var(--yellow)' : 'inherit' }}>
                    {p.stock} {p.unit ?? ''}
                  </span>
                </td>
                <td style={{ color: 'var(--text2)' }}>{p.category ?? '—'}</td>
                <td>
                  <span className={`badge ${p.active ? 'badge-green' : 'badge-red'}`}>{p.active ? 'Active' : 'Inactive'}</span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setEditing(p)}>Edit</button>
                    <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => handleToggle(p.id)}>
                      {p.active ? 'Disable' : 'Enable'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text2)', padding: 40 }}>
                {db.products.length === 0 ? 'No products yet — add your first product' : 'No results'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing !== false && (
        <ProductModal product={editing} onSave={handleSave} onClose={() => setEditing(false)} />
      )}
    </div>
  );
}
