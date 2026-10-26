'use client';
import { useState } from 'react';
import { usePOS } from '@/lib/context';
import { fmtCurrency, fmtDate } from '@/lib/fmt';

type Tab = 'sales' | 'stock' | 'vat' | 'customers';

export default function ReportsPage() {
  const { db, settings } = usePOS();
  const [tab, setTab] = useState<Tab>('sales');

  // Date range filter
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  const paidOrders = db.orders.filter(o => {
    if (o.status !== 'paid') return false;
    const d = o.ts.slice(0, 10);
    return d >= from && d <= to;
  });

  // Sales summary
  const totalSales = paidOrders.reduce((s, o) => s + o.total, 0);
  const totalTax = paidOrders.reduce((s, o) => s + o.tax, 0);
  const totalDisc = paidOrders.reduce((s, o) => s + o.disc, 0);
  const avgTicket = paidOrders.length ? totalSales / paidOrders.length : 0;

  // Stock report
  const stockValue = db.products.reduce((s, p) => s + p.stock * p.price, 0);
  const stockCost = db.products.reduce((s, p) => s + p.stock * (p.cost ?? 0), 0);

  // VAT
  const vatCollected = totalTax;

  // Customer balances
  const debtors = db.customers.filter(c => (c.balance ?? 0) > 0).sort((a, b) => (b.balance ?? 0) - (a.balance ?? 0));

  const tabs: { key: Tab; label: string }[] = [
    { key: 'sales', label: '📊 Sales summary' },
    { key: 'stock', label: '📦 Stock report' },
    { key: 'vat', label: '🧾 VAT summary' },
    { key: 'customers', label: '👥 Customer balances' },
  ];

  return (
    <div>
      {/* Date filter */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20 }}>
        <label style={{ fontSize: 12, color: 'var(--text2)' }}>From</label>
        <input className="inp" type="date" style={{ maxWidth: 160 }} value={from} onChange={e => setFrom(e.target.value)} />
        <label style={{ fontSize: 12, color: 'var(--text2)' }}>To</label>
        <input className="inp" type="date" style={{ maxWidth: 160 }} value={to} onChange={e => setTo(e.target.value)} />
        <span style={{ color: 'var(--text2)', fontSize: 13 }}>{paidOrders.length} transactions</span>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
            background: tab === t.key ? 'var(--accent)' : 'var(--bg3)',
            color: tab === t.key ? '#fff' : 'var(--text2)',
          }}>{t.label}</button>
        ))}
      </div>

      {tab === 'sales' && (
        <div>
          <div className="kpi-grid" style={{ marginBottom: 24 }}>
            {[
              { label: 'Gross sales', value: fmtCurrency(totalSales, settings.currency) },
              { label: 'Tax collected', value: fmtCurrency(totalTax, settings.currency) },
              { label: 'Discounts', value: fmtCurrency(totalDisc, settings.currency) },
              { label: 'Transactions', value: String(paidOrders.length) },
              { label: 'Avg ticket', value: fmtCurrency(avgTicket, settings.currency) },
            ].map(k => (
              <div className="kpi" key={k.label}><div className="kpi-label">{k.label}</div><div className="kpi-value" style={{ fontSize: 20 }}>{k.value}</div></div>
            ))}
          </div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="tbl">
              <thead><tr><th>#</th><th>Date</th><th>Items</th><th style={{ textAlign: 'right' }}>Subtotal</th><th style={{ textAlign: 'right' }}>Tax</th><th style={{ textAlign: 'right' }}>Total</th><th>Method</th></tr></thead>
              <tbody>
                {paidOrders.slice().reverse().map(o => (
                  <tr key={o.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{o.no}</td>
                    <td style={{ fontSize: 12, color: 'var(--text2)' }}>{new Date(o.ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                    <td>{o.lines.length}</td>
                    <td style={{ textAlign: 'right' }}>{fmtCurrency(o.subtotal, settings.currency)}</td>
                    <td style={{ textAlign: 'right' }}>{fmtCurrency(o.tax, settings.currency)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtCurrency(o.total, settings.currency)}</td>
                    <td style={{ textTransform: 'capitalize' }}>{o.method}</td>
                  </tr>
                ))}
                {paidOrders.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text2)', padding: 32 }}>No sales in this period</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'stock' && (
        <div>
          <div className="kpi-grid" style={{ marginBottom: 24 }}>
            <div className="kpi"><div className="kpi-label">Stock value (retail)</div><div className="kpi-value" style={{ fontSize: 20 }}>{fmtCurrency(stockValue, settings.currency)}</div></div>
            <div className="kpi"><div className="kpi-label">Stock value (cost)</div><div className="kpi-value" style={{ fontSize: 20 }}>{fmtCurrency(stockCost, settings.currency)}</div></div>
            <div className="kpi"><div className="kpi-label">Total SKUs</div><div className="kpi-value" style={{ fontSize: 20 }}>{db.products.filter(p => p.active).length}</div></div>
            <div className="kpi"><div className="kpi-label">Out of stock</div><div className="kpi-value" style={{ fontSize: 20, color: 'var(--red)' }}>{db.products.filter(p => p.active && p.stock <= 0).length}</div></div>
          </div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="tbl">
              <thead><tr><th>Product</th><th>SKU</th><th style={{ textAlign: 'right' }}>Stock</th><th>Unit</th><th style={{ textAlign: 'right' }}>Price</th><th style={{ textAlign: 'right' }}>Cost</th><th style={{ textAlign: 'right' }}>Value</th></tr></thead>
              <tbody>
                {db.products.filter(p => p.active).map(p => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 500 }}>{p.name}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text2)' }}>{p.sku ?? p.barcode ?? '—'}</td>
                    <td style={{ textAlign: 'right', color: p.stock <= 0 ? 'var(--red)' : 'inherit' }}>{p.stock}</td>
                    <td style={{ color: 'var(--text2)' }}>{p.unit ?? '—'}</td>
                    <td style={{ textAlign: 'right' }}>{fmtCurrency(p.price, settings.currency)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--text2)' }}>{p.cost != null ? fmtCurrency(p.cost, settings.currency) : '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtCurrency(p.stock * p.price, settings.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'vat' && (
        <div>
          <div className="kpi-grid" style={{ marginBottom: 24 }}>
            <div className="kpi"><div className="kpi-label">{settings.taxLabel} collected</div><div className="kpi-value" style={{ fontSize: 20 }}>{fmtCurrency(vatCollected, settings.currency)}</div></div>
            <div className="kpi"><div className="kpi-label">Net sales (excl. VAT)</div><div className="kpi-value" style={{ fontSize: 20 }}>{fmtCurrency(totalSales - totalTax, settings.currency)}</div></div>
            <div className="kpi"><div className="kpi-label">Gross sales</div><div className="kpi-value" style={{ fontSize: 20 }}>{fmtCurrency(totalSales, settings.currency)}</div></div>
            <div className="kpi"><div className="kpi-label">Tax rate</div><div className="kpi-value" style={{ fontSize: 20 }}>{settings.taxRate}%</div></div>
          </div>
          <div className="card">
            <p style={{ color: 'var(--text2)', fontSize: 13 }}>TRN: {settings.trn || 'Not set'} · Period: {from} to {to}</p>
            <p style={{ marginTop: 8, fontSize: 13 }}>This is a summary report. For ZATCA-compliant tax invoices, use the e-Invoice module.</p>
          </div>
        </div>
      )}

      {tab === 'customers' && (
        <div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="tbl">
              <thead><tr><th>Customer</th><th>Phone</th><th style={{ textAlign: 'right' }}>Credit limit</th><th style={{ textAlign: 'right' }}>Balance owing</th></tr></thead>
              <tbody>
                {debtors.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 500 }}>{c.name}</td>
                    <td style={{ color: 'var(--text2)' }}>{c.phone ?? '—'}</td>
                    <td style={{ textAlign: 'right' }}>{c.creditLimit != null ? fmtCurrency(c.creditLimit, settings.currency) : '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--red)' }}>{fmtCurrency(c.balance ?? 0, settings.currency)}</td>
                  </tr>
                ))}
                {debtors.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text2)', padding: 32 }}>No outstanding balances</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
