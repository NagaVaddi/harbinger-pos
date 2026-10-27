'use client';
import { useState, useMemo } from 'react';
import { usePOS } from '@/lib/context';
import { useFeature } from '@/components/providers/FeatureProvider';
import { fmtCurrency, fmtDate } from '@/lib/fmt';
import { FeatureKey } from '@/lib/types';
import dynamic from 'next/dynamic';

// Dynamic import to avoid SSR issues with Recharts
const BarChart = dynamic(() => import('recharts').then(m => m.BarChart), { ssr: false });
const Bar = dynamic(() => import('recharts').then(m => m.Bar), { ssr: false });
const LineChart = dynamic(() => import('recharts').then(m => m.LineChart), { ssr: false });
const Line = dynamic(() => import('recharts').then(m => m.Line), { ssr: false });
const XAxis = dynamic(() => import('recharts').then(m => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then(m => m.YAxis), { ssr: false });
const CartesianGrid = dynamic(() => import('recharts').then(m => m.CartesianGrid), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then(m => m.Tooltip), { ssr: false });
const ResponsiveContainer = dynamic(() => import('recharts').then(m => m.ResponsiveContainer), { ssr: false });

type Tab = 'sales' | 'stock' | 'vat' | 'customers' | 'custom';
type Metric = 'revenue' | 'orders' | 'avg_ticket' | 'tax';
type GroupBy = 'day' | 'week' | 'product' | 'method';
type ChartType = 'bar' | 'line';

export default function ReportsPage() {
  const { db, settings } = usePOS();
  const { isEnabled } = useFeature();
  const customReportsEnabled = isEnabled(FeatureKey.CUSTOM_REPORTS);
  const [tab, setTab] = useState<Tab>('sales');

  // Custom report state
  const [metric, setMetric] = useState<Metric>('revenue');
  const [groupBy, setGroupBy] = useState<GroupBy>('day');
  const [chartType, setChartType] = useState<ChartType>('bar');

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

  // Custom report data computation
  const customData = useMemo(() => {
    if (tab !== 'custom') return [];
    const getVal = (o: (typeof paidOrders)[0]) => {
      if (metric === 'revenue') return o.total;
      if (metric === 'orders') return 1;
      if (metric === 'tax') return o.tax;
      if (metric === 'avg_ticket') return o.total;
      return o.total;
    };
    const buckets = new Map<string, number[]>();
    for (const o of paidOrders) {
      let key: string;
      if (groupBy === 'day') key = o.ts.slice(0, 10);
      else if (groupBy === 'week') {
        const d = new Date(o.ts);
        const wk = new Date(d); wk.setDate(d.getDate() - d.getDay());
        key = wk.toISOString().slice(0, 10);
      } else if (groupBy === 'method') key = o.method ?? 'unknown';
      else key = '';  // handled below
      if (groupBy === 'product') {
        for (const l of o.lines) {
          const k = l.name ?? l.productId;
          if (!buckets.has(k)) buckets.set(k, []);
          buckets.get(k)!.push(metric === 'orders' ? 1 : metric === 'revenue' || metric === 'avg_ticket' ? l.price * l.qty : 0);
        }
      } else {
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key)!.push(getVal(o));
      }
    }
    return [...buckets.entries()]
      .map(([name, vals]) => ({
        name: name.length > 16 ? name.slice(0, 14) + '…' : name,
        value: metric === 'avg_ticket'
          ? vals.reduce((s, v) => s + v, 0) / vals.length
          : vals.reduce((s, v) => s + v, 0),
      }))
      .sort((a, b) => (groupBy === 'day' || groupBy === 'week') ? a.name.localeCompare(b.name) : b.value - a.value)
      .slice(0, 30);
  }, [tab, metric, groupBy, paidOrders]);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'sales', label: '📊 Sales summary' },
    { key: 'stock', label: '📦 Stock report' },
    { key: 'vat', label: '🧾 VAT summary' },
    { key: 'customers', label: '👥 Customer balances' },
    ...(customReportsEnabled ? [{ key: 'custom' as Tab, label: '🔮 Custom report' }] : []),
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

      {tab === 'custom' && customReportsEnabled && (
        <div>
          {/* Builder toolbar */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text2)', display: 'block', marginBottom: 3 }}>Metric</label>
              <select className="inp" style={{ fontSize: 13 }} value={metric} onChange={e => setMetric(e.target.value as Metric)}>
                <option value="revenue">Revenue</option>
                <option value="orders">Orders count</option>
                <option value="avg_ticket">Avg ticket</option>
                <option value="tax">Tax collected</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text2)', display: 'block', marginBottom: 3 }}>Group by</label>
              <select className="inp" style={{ fontSize: 13 }} value={groupBy} onChange={e => setGroupBy(e.target.value as GroupBy)}>
                <option value="day">Day</option>
                <option value="week">Week</option>
                <option value="product">Product</option>
                <option value="method">Payment method</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text2)', display: 'block', marginBottom: 3 }}>Chart type</label>
              <div style={{ display: 'flex', background: 'var(--bg3)', borderRadius: 8, padding: 2 }}>
                {(['bar', 'line'] as ChartType[]).map(ct => (
                  <button key={ct} onClick={() => setChartType(ct)} style={{
                    padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12,
                    background: chartType === ct ? 'var(--accent)' : 'transparent',
                    color: chartType === ct ? '#fff' : 'var(--text2)',
                  }}>{ct === 'bar' ? '📊 Bar' : '📈 Line'}</button>
                ))}
              </div>
            </div>
            <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text2)' }}>
              {customData.length} data points
            </div>
          </div>

          {customData.length > 0 ? (
            <div className="card">
              <div style={{ width: '100%', height: 340 }}>
                <ResponsiveContainer width="100%" height="100%">
                  {chartType === 'bar' ? (
                    <BarChart data={customData} margin={{ top: 8, right: 16, bottom: 40, left: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text2)' }} angle={-35} textAnchor="end" interval={0} />
                      <YAxis tick={{ fontSize: 11, fill: 'var(--text2)' }} />
                      <Tooltip
                        contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                        formatter={((v: unknown) => { const n = Number(v ?? 0); return metric === 'orders' ? n : fmtCurrency(n, settings.currency); }) as any}
                      />
                      <Bar dataKey="value" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  ) : (
                    <LineChart data={customData} margin={{ top: 8, right: 16, bottom: 40, left: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text2)' }} angle={-35} textAnchor="end" interval={0} />
                      <YAxis tick={{ fontSize: 11, fill: 'var(--text2)' }} />
                      <Tooltip
                        contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                        formatter={((v: unknown) => { const n = Number(v ?? 0); return metric === 'orders' ? n : fmtCurrency(n, settings.currency); }) as any}
                      />
                      <Line type="monotone" dataKey="value" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  )}
                </ResponsiveContainer>
              </div>

              {/* Data table */}
              <div style={{ marginTop: 20, overflowX: 'auto' }}>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>{groupBy === 'day' ? 'Date' : groupBy === 'week' ? 'Week start' : groupBy === 'product' ? 'Product' : 'Method'}</th>
                      <th style={{ textAlign: 'right' }}>{metric === 'revenue' ? 'Revenue' : metric === 'orders' ? 'Orders' : metric === 'avg_ticket' ? 'Avg ticket' : 'Tax'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customData.map(d => (
                      <tr key={d.name}>
                        <td>{d.name}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          {metric === 'orders' ? d.value : fmtCurrency(d.value, settings.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: 60, color: 'var(--text2)' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🔮</div>
              <div>No data for this combination. Try changing the date range, metric, or group-by.</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
