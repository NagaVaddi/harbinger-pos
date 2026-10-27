'use client';
import { useState, useTransition } from 'react';
import { usePOS } from '@/lib/context';
import { useFeature } from '@/components/providers/FeatureProvider';
import { fmtCurrency, fmtDate, uid, now } from '@/lib/fmt';
import { FeatureKey } from '@/lib/types';
import type { ForecastItem } from '@/app/actions/ai';

type Tab = 'manage' | 'receive' | 'batches' | 'reorder' | 'ai';

export default function StockPage() {
  const { db, save, settings } = usePOS();
  const { isEnabled } = useFeature();
  const aiEnabled = isEnabled(FeatureKey.AI_DEMAND_FORECAST);
  const [tab, setTab] = useState<Tab>('manage');
  const [search, setSearch] = useState('');
  const [forecasts, setForecasts] = useState<ForecastItem[]>([]);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [, startTransition] = useTransition();

  // Receive stock form
  const [recvProductId, setRecvProductId] = useState('');
  const [recvQty, setRecvQty] = useState('');
  const [recvCost, setRecvCost] = useState('');
  const [recvBatch, setRecvBatch] = useState('');
  const [recvExpiry, setRecvExpiry] = useState('');

  const loadForecasts = () => {
    setForecastLoading(true);
    startTransition(async () => {
      try {
        const { forecastDemand } = await import('@/app/actions/ai');
        const data = await forecastDemand();
        setForecasts(data);
      } catch {
        // Demo mode: compute moving average from local orders
        const since = Date.now() - 30 * 86400_000;
        const recentOrders = db.orders.filter(o => o.status === 'paid' && new Date(o.ts).getTime() > since);
        const salesMap = new Map<string, number[]>();
        for (const order of recentOrders) {
          for (const line of order.lines) {
            if (!salesMap.has(line.productId)) salesMap.set(line.productId, []);
            salesMap.get(line.productId)!.push(line.qty);
          }
        }
        const items: ForecastItem[] = [];
        for (const p of db.products.filter(x => x.active)) {
          const sales = salesMap.get(p.id) ?? [];
          if (!sales.length) continue;
          const avg = sales.reduce((s, v) => s + v, 0) / 30;
          items.push({
            productId: p.id, productName: p.name, currentStock: p.stock,
            avgDailySales: Math.round(avg * 10) / 10,
            forecastedDemand: Math.ceil(avg * 7),
            suggestedReorder: Math.max(0, Math.ceil(avg * 7) - p.stock),
            daysUntilStockout: avg > 0 ? Math.floor(p.stock / avg) : null,
            trend: 'flat',
          });
        }
        items.sort((a, b) => (a.daysUntilStockout ?? 999) - (b.daysUntilStockout ?? 999));
        setForecasts(items);
      } finally {
        setForecastLoading(false);
      }
    });
  };

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
    ...(aiEnabled ? [{ key: 'ai' as Tab, label: '🤖 AI Insights' }] : []),
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

      {tab === 'ai' && aiEnabled && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>AI Demand Forecast</h2>
              <p style={{ fontSize: 12, color: 'var(--text2)', margin: '2px 0 0' }}>30-day moving average · Next 7-day demand prediction</p>
            </div>
            <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={loadForecasts} disabled={forecastLoading}>
              {forecastLoading ? 'Analysing…' : '⚡ Run Forecast'}
            </button>
          </div>

          {forecasts.length > 0 ? (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th style={{ textAlign: 'right' }}>Stock</th>
                    <th style={{ textAlign: 'right' }}>Avg daily</th>
                    <th style={{ textAlign: 'right' }}>7-day demand</th>
                    <th style={{ textAlign: 'right' }}>Days left</th>
                    <th>Trend</th>
                    <th style={{ textAlign: 'right' }}>Suggest reorder</th>
                  </tr>
                </thead>
                <tbody>
                  {forecasts.map(f => {
                    const urgent = f.daysUntilStockout !== null && f.daysUntilStockout <= 7;
                    return (
                      <tr key={f.productId} style={{ background: urgent ? 'rgba(239,68,68,.04)' : undefined }}>
                        <td style={{ fontWeight: 500 }}>{f.productName}</td>
                        <td style={{ textAlign: 'right', color: f.currentStock <= 0 ? 'var(--red)' : 'inherit' }}>{f.currentStock}</td>
                        <td style={{ textAlign: 'right', color: 'var(--text2)' }}>{f.avgDailySales}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{f.forecastedDemand}</td>
                        <td style={{ textAlign: 'right', color: urgent ? 'var(--red)' : 'inherit', fontWeight: urgent ? 700 : 400 }}>
                          {f.daysUntilStockout !== null ? f.daysUntilStockout : '∞'}
                        </td>
                        <td>
                          <span style={{ fontSize: 13 }}>{f.trend === 'up' ? '↑' : f.trend === 'down' ? '↓' : '→'}</span>
                          <span style={{ fontSize: 11, color: 'var(--text2)', marginLeft: 4 }}>{f.trend}</span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: f.suggestedReorder > 0 ? 700 : 400, color: f.suggestedReorder > 0 ? 'var(--accent)' : 'var(--text2)' }}>
                          {f.suggestedReorder > 0 ? `+${f.suggestedReorder}` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : !forecastLoading ? (
            <div className="card" style={{ textAlign: 'center', padding: 60, color: 'var(--text2)' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🤖</div>
              <div>Click <strong>Run Forecast</strong> to analyse sales history and predict demand for the next 7 days.</div>
            </div>
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: 60, color: 'var(--text2)' }}>Analysing 30-day sales history…</div>
          )}
        </div>
      )}
    </div>
  );
}
