'use client';
import { useState, useTransition, useEffect, useCallback } from 'react';
import { usePOS } from '@/lib/context';
import { useFeature } from '@/components/providers/FeatureProvider';
import { fmtCurrency, fmtDate, uid, now } from '@/lib/fmt';
import { FeatureKey } from '@/lib/types';
import type { ForecastItem } from '@/app/actions/ai';
import type {
  SupplierRow, StockHistoryRow, PurchaseOrderRow,
  StockCountRow, BarcodeConfigData,
} from '@/app/actions/stock';

type Tab = 'manage' | 'receive' | 'batches' | 'history' | 'reorder' | 'suppliers' | 'purchaseorders' | 'stockcount' | 'barcodeconfig' | 'ai';

export default function StockPage() {
  const { db, save, settings } = usePOS();
  const { isEnabled } = useFeature();
  const aiEnabled = isEnabled(FeatureKey.AI_DEMAND_FORECAST);
  const [tab, setTab] = useState<Tab>('manage');
  const [search, setSearch] = useState('');
  const [forecasts, setForecasts] = useState<ForecastItem[]>([]);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [, startTransition] = useTransition();

  // Receive stock form (existing)
  const [recvProductId, setRecvProductId] = useState('');
  const [recvQty, setRecvQty] = useState('');
  const [recvCost, setRecvCost] = useState('');
  const [recvBatch, setRecvBatch] = useState('');
  const [recvExpiry, setRecvExpiry] = useState('');

  // ── New DB-backed tab state ─────────────────────────────────────

  // Stock history
  const [history, setHistory] = useState<StockHistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Suppliers
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [suppliersLoading, setSuppliersLoading] = useState(false);
  const [supplierForm, setSupplierForm] = useState({ name: '', phone: '', email: '', paymentTerms: '' });
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [showSupplierForm, setShowSupplierForm] = useState(false);

  // Purchase orders
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderRow[]>([]);
  const [poLoading, setPoLoading] = useState(false);
  const [showPoForm, setShowPoForm] = useState(false);
  const [poSupplierId, setPoSupplierId] = useState('');
  const [poNotes, setPoNotes] = useState('');
  const [poItems, setPoItems] = useState<{ productId: string; productName: string; quantity: string; unitCost: string }[]>([
    { productId: '', productName: '', quantity: '', unitCost: '' },
  ]);

  // Stock count
  const [stockCounts, setStockCounts] = useState<StockCountRow[]>([]);
  const [countLoading, setCountLoading] = useState(false);
  const [activeCountId, setActiveCountId] = useState<string | null>(null);
  const [countItems, setCountItems] = useState<{ id: string; productId: string; productName: string; expectedQty: number; countedQty: string }[]>([]);
  const [countBlind, setCountBlind] = useState(false);

  // Barcode config
  const [barcodeConfig, setBarcodeConfig] = useState<BarcodeConfigData>({
    barcodePrefix: '99', barcodeScanSku: true, barcodeQtyEntry: true, barcodeLabelsPerRow: 3,
  });
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [barcodeSaving, setBarcodeSaving] = useState(false);

  // ── Data loaders ────────────────────────────────────────────────

  const loadHistory = useCallback(() => {
    setHistoryLoading(true);
    import('@/app/actions/stock').then(({ getStockHistory }) =>
      getStockHistory().then(setHistory).finally(() => setHistoryLoading(false))
    );
  }, []);

  const loadSuppliers = useCallback(() => {
    setSuppliersLoading(true);
    import('@/app/actions/stock').then(({ getSuppliers }) =>
      getSuppliers().then(setSuppliers).finally(() => setSuppliersLoading(false))
    );
  }, []);

  const loadPurchaseOrders = useCallback(() => {
    setPoLoading(true);
    import('@/app/actions/stock').then(({ getPurchaseOrders }) =>
      getPurchaseOrders().then(setPurchaseOrders).finally(() => setPoLoading(false))
    );
  }, []);

  const loadStockCounts = useCallback(() => {
    setCountLoading(true);
    import('@/app/actions/stock').then(({ getStockCounts }) =>
      getStockCounts().then(setStockCounts).finally(() => setCountLoading(false))
    );
  }, []);

  const loadBarcodeConfig = useCallback(() => {
    setBarcodeLoading(true);
    import('@/app/actions/stock').then(({ getBarcodeConfig }) =>
      getBarcodeConfig().then(setBarcodeConfig).finally(() => setBarcodeLoading(false))
    );
  }, []);

  useEffect(() => {
    if (tab === 'history') loadHistory();
    if (tab === 'suppliers') loadSuppliers();
    if (tab === 'purchaseorders') { loadPurchaseOrders(); loadSuppliers(); }
    if (tab === 'stockcount') loadStockCounts();
    if (tab === 'barcodeconfig') loadBarcodeConfig();
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Existing handlers (unchanged) ──────────────────────────────

  const loadForecasts = () => {
    setForecastLoading(true);
    startTransition(async () => {
      try {
        const { forecastDemand } = await import('@/app/actions/ai');
        const data = await forecastDemand();
        setForecasts(data);
      } catch {
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

  // ── New handlers ────────────────────────────────────────────────

  const handleSaveSupplier = async () => {
    if (!supplierForm.name.trim()) return alert('Name is required');
    const { createSupplier, updateSupplier } = await import('@/app/actions/stock');
    if (editingSupplierId) {
      await updateSupplier(editingSupplierId, supplierForm);
    } else {
      await createSupplier(supplierForm);
    }
    setShowSupplierForm(false);
    setEditingSupplierId(null);
    setSupplierForm({ name: '', phone: '', email: '', paymentTerms: '' });
    loadSuppliers();
  };

  const handleDeleteSupplier = async (id: string) => {
    if (!confirm('Delete this supplier?')) return;
    const { deleteSupplier } = await import('@/app/actions/stock');
    await deleteSupplier(id);
    loadSuppliers();
  };

  const handleCreatePO = async () => {
    const validItems = poItems.filter(i => i.productId && parseFloat(i.quantity) > 0);
    if (!validItems.length) return alert('Add at least one item');
    const { createPurchaseOrder } = await import('@/app/actions/stock');
    await createPurchaseOrder({
      supplierId: poSupplierId || undefined,
      notes: poNotes || undefined,
      items: validItems.map(i => ({
        productId: i.productId,
        productName: db.products.find(p => p.id === i.productId)?.name ?? i.productId,
        quantity: parseFloat(i.quantity),
        unitCost: parseFloat(i.unitCost) || 0,
      })),
    });
    setShowPoForm(false);
    setPoSupplierId(''); setPoNotes('');
    setPoItems([{ productId: '', productName: '', quantity: '', unitCost: '' }]);
    loadPurchaseOrders();
  };

  const handleReceivePO = async (poId: string) => {
    if (!confirm('Mark this purchase order as received? This will update stock levels.')) return;
    const { receivePurchaseOrder } = await import('@/app/actions/stock');
    await receivePurchaseOrder(poId);
    loadPurchaseOrders();
  };

  const handleStartCount = async (what: 'all' | 'low') => {
    setCountLoading(true);
    const { startStockCount, getStockCountItems } = await import('@/app/actions/stock');
    const { countId } = await startStockCount(what, countBlind);
    const items = await getStockCountItems(countId);
    setActiveCountId(countId);
    setCountItems(items.map(i => ({ ...i, countedQty: countBlind ? '' : String(i.expectedQty) })));
    setCountLoading(false);
  };

  const handleSubmitCount = async () => {
    if (!activeCountId) return;
    const incomplete = countItems.filter(i => i.countedQty === '');
    if (incomplete.length && !confirm(`${incomplete.length} items have no counted quantity. Treat as 0?`)) return;
    const { submitStockCount } = await import('@/app/actions/stock');
    await submitStockCount(
      activeCountId,
      countItems.map(i => ({
        id: i.id, productId: i.productId, productName: i.productName,
        expectedQty: i.expectedQty, countedQty: parseFloat(i.countedQty) || 0,
      })),
    );
    setActiveCountId(null);
    setCountItems([]);
    loadStockCounts();
    alert('Stock count completed and stock levels updated!');
  };

  const handleSaveBarcodeConfig = async () => {
    setBarcodeSaving(true);
    const { saveBarcodeConfig } = await import('@/app/actions/stock');
    await saveBarcodeConfig(barcodeConfig);
    setBarcodeSaving(false);
    alert('Barcode configuration saved.');
  };

  // ── Tab definition ──────────────────────────────────────────────

  const tabs: { key: Tab; label: string }[] = [
    { key: 'manage', label: 'Manage stock' },
    { key: 'receive', label: 'Receive stock' },
    { key: 'batches', label: 'Stock batches' },
    { key: 'history', label: 'Stock history' },
    { key: 'reorder', label: 'Reorder alerts' },
    { key: 'suppliers', label: 'Suppliers' },
    { key: 'purchaseorders', label: 'Purchase orders' },
    { key: 'stockcount', label: 'Stock count' },
    { key: 'barcodeconfig', label: 'Barcode config' },
    ...(aiEnabled ? [{ key: 'ai' as Tab, label: '🤖 AI Insights' }] : []),
  ];

  const labelStyle = { fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 } as const;

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
            background: tab === t.key ? 'var(--accent)' : 'var(--bg3)',
            color: tab === t.key ? '#fff' : 'var(--text2)',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── MANAGE STOCK (existing) ───────────────────────────────── */}
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

      {/* ── RECEIVE STOCK (existing) ──────────────────────────────── */}
      {tab === 'receive' && (
        <div className="card" style={{ maxWidth: 540 }}>
          <h2 style={{ marginBottom: 20 }}>Receive stock</h2>
          <div style={{ display: 'grid', gap: 14 }}>
            <div>
              <label style={labelStyle}>Product *</label>
              <select className="inp" value={recvProductId} onChange={e => setRecvProductId(e.target.value)}>
                <option value="">Select product…</option>
                {db.products.filter(p => p.active).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Quantity *</label>
                <input className="inp" type="number" min={0} step={0.001} value={recvQty} onChange={e => setRecvQty(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Cost ({settings.currency}, optional)</label>
                <input className="inp" type="number" min={0} step={0.01} value={recvCost} onChange={e => setRecvCost(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Batch number</label>
                <input className="inp" value={recvBatch} onChange={e => setRecvBatch(e.target.value)} placeholder="Optional" />
              </div>
              <div>
                <label style={labelStyle}>Expiry date</label>
                <input className="inp" type="date" value={recvExpiry} onChange={e => setRecvExpiry(e.target.value)} />
              </div>
            </div>
            <button className="btn btn-primary" style={{ justifyContent: 'center', padding: 12 }} onClick={handleReceive}>
              Receive stock
            </button>
          </div>
        </div>
      )}

      {/* ── STOCK BATCHES (existing) ──────────────────────────────── */}
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

      {/* ── STOCK HISTORY (new) ───────────────────────────────────── */}
      {tab === 'history' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button className="btn" onClick={loadHistory} disabled={historyLoading} style={{ fontSize: 13 }}>
              {historyLoading ? 'Loading…' : '↻ Refresh'}
            </button>
          </div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Product</th>
                  <th>Type</th>
                  <th style={{ textAlign: 'right' }}>Qty</th>
                  <th>Reference</th>
                  <th>Staff</th>
                </tr>
              </thead>
              <tbody>
                {history.map(h => (
                  <tr key={h.id}>
                    <td style={{ fontSize: 12, color: 'var(--text2)', whiteSpace: 'nowrap' }}>
                      {new Date(h.createdAt).toLocaleString()}
                    </td>
                    <td style={{ fontWeight: 500 }}>{h.productName}</td>
                    <td>
                      <span className={`badge ${
                        h.type === 'RECEIVE' ? 'badge-green' :
                        h.type === 'DAMAGE' ? 'badge-red' :
                        h.type === 'SALE' ? 'badge-yellow' : 'badge-blue'
                      }`}>{h.type}</span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: h.quantity < 0 ? 'var(--red)' : 'var(--green)' }}>
                      {h.quantity > 0 ? `+${h.quantity}` : h.quantity}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text2)' }}>{h.reference ?? '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--text2)' }}>{h.staffName ?? '—'}</td>
                  </tr>
                ))}
                {!historyLoading && !history.length && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text2)', padding: 32 }}>No stock history yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── SUPPLIERS (new) ───────────────────────────────────────── */}
      {tab === 'suppliers' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 12 }}>
            <button className="btn btn-primary" onClick={() => { setShowSupplierForm(true); setEditingSupplierId(null); setSupplierForm({ name: '', phone: '', email: '', paymentTerms: '' }); }}>
              + Add supplier
            </button>
          </div>

          {showSupplierForm && (
            <div className="card" style={{ maxWidth: 480, marginBottom: 20 }}>
              <h3 style={{ marginBottom: 16, fontSize: 15 }}>{editingSupplierId ? 'Edit supplier' : 'New supplier'}</h3>
              <div style={{ display: 'grid', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Name *</label>
                  <input className="inp" value={supplierForm.name} onChange={e => setSupplierForm(s => ({ ...s, name: e.target.value }))} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Phone</label>
                    <input className="inp" value={supplierForm.phone} onChange={e => setSupplierForm(s => ({ ...s, phone: e.target.value }))} />
                  </div>
                  <div>
                    <label style={labelStyle}>Email</label>
                    <input className="inp" type="email" value={supplierForm.email} onChange={e => setSupplierForm(s => ({ ...s, email: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Payment terms</label>
                  <input className="inp" value={supplierForm.paymentTerms} onChange={e => setSupplierForm(s => ({ ...s, paymentTerms: e.target.value }))} placeholder="e.g. Net 30" />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary" onClick={handleSaveSupplier}>Save</button>
                  <button className="btn" onClick={() => { setShowSupplierForm(false); setEditingSupplierId(null); }}>Cancel</button>
                </div>
              </div>
            </div>
          )}

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="tbl">
              <thead>
                <tr><th>Name</th><th>Phone</th><th>Email</th><th>Payment terms</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {suppliers.map(s => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 500 }}>{s.name}</td>
                    <td style={{ fontSize: 12 }}>{s.phone ?? '—'}</td>
                    <td style={{ fontSize: 12 }}>{s.email ?? '—'}</td>
                    <td style={{ fontSize: 12 }}>{s.paymentTerms ?? '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => {
                          setEditingSupplierId(s.id);
                          setSupplierForm({ name: s.name, phone: s.phone ?? '', email: s.email ?? '', paymentTerms: s.paymentTerms ?? '' });
                          setShowSupplierForm(true);
                        }}>Edit</button>
                        <button className="btn" style={{ fontSize: 12, padding: '4px 10px', color: 'var(--red)' }} onClick={() => handleDeleteSupplier(s.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!suppliersLoading && !suppliers.length && (
                  <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text2)', padding: 32 }}>No suppliers yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── PURCHASE ORDERS (new) ─────────────────────────────────── */}
      {tab === 'purchaseorders' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 12 }}>
            <button className="btn btn-primary" onClick={() => setShowPoForm(v => !v)}>
              {showPoForm ? 'Cancel' : '+ New order'}
            </button>
          </div>

          {showPoForm && (
            <div className="card" style={{ marginBottom: 20 }}>
              <h3 style={{ marginBottom: 16, fontSize: 15 }}>New purchase order</h3>
              <div style={{ display: 'grid', gap: 12, maxWidth: 480, marginBottom: 16 }}>
                <div>
                  <label style={labelStyle}>Supplier</label>
                  <select className="inp" value={poSupplierId} onChange={e => setPoSupplierId(e.target.value)}>
                    <option value="">No supplier</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Notes</label>
                  <input className="inp" value={poNotes} onChange={e => setPoNotes(e.target.value)} />
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 40px', gap: 8, marginBottom: 8, fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>
                  <span>Product</span><span>Qty</span><span>Unit cost</span><span />
                </div>
                {poItems.map((item, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 40px', gap: 8, marginBottom: 8 }}>
                    <select className="inp" value={item.productId} onChange={e => {
                      const pid = e.target.value;
                      setPoItems(items => items.map((it, i) => i === idx ? { ...it, productId: pid } : it));
                    }}>
                      <option value="">Select…</option>
                      {db.products.filter(p => p.active).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <input className="inp" type="number" min={0} step={0.001} placeholder="0" value={item.quantity} onChange={e => setPoItems(items => items.map((it, i) => i === idx ? { ...it, quantity: e.target.value } : it))} />
                    <input className="inp" type="number" min={0} step={0.01} placeholder="0.00" value={item.unitCost} onChange={e => setPoItems(items => items.map((it, i) => i === idx ? { ...it, unitCost: e.target.value } : it))} />
                    <button className="btn" style={{ padding: '4px 8px', color: 'var(--red)' }} onClick={() => setPoItems(items => items.filter((_, i) => i !== idx))}>×</button>
                  </div>
                ))}
                <button className="btn" style={{ fontSize: 12 }} onClick={() => setPoItems(items => [...items, { productId: '', productName: '', quantity: '', unitCost: '' }])}>
                  + Add item
                </button>
              </div>
              <button className="btn btn-primary" onClick={handleCreatePO}>Create order</button>
            </div>
          )}

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="tbl">
              <thead>
                <tr><th>Date</th><th>Supplier</th><th>Items</th><th style={{ textAlign: 'right' }}>Total</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {purchaseOrders.map(po => (
                  <tr key={po.id}>
                    <td style={{ fontSize: 12, color: 'var(--text2)' }}>{new Date(po.createdAt).toLocaleDateString()}</td>
                    <td>{po.supplierName ?? '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--text2)' }}>{po.itemCount} item(s)</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtCurrency(po.totalAmount, settings.currency)}</td>
                    <td>
                      <span className={`badge ${po.status === 'RECEIVED' ? 'badge-green' : po.status === 'ORDERED' ? 'badge-yellow' : 'badge-blue'}`}>
                        {po.status}
                      </span>
                    </td>
                    <td>
                      {po.status !== 'RECEIVED' && (
                        <button className="btn" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => handleReceivePO(po.id)}>
                          Receive
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {!poLoading && !purchaseOrders.length && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text2)', padding: 32 }}>No purchase orders yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── STOCK COUNT (new) ─────────────────────────────────────── */}
      {tab === 'stockcount' && (
        <div>
          {!activeCountId ? (
            <>
              <div className="card" style={{ maxWidth: 480, marginBottom: 20 }}>
                <h3 style={{ fontSize: 15, marginBottom: 16 }}>Start new count</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                    <input type="checkbox" checked={countBlind} onChange={e => setCountBlind(e.target.checked)} />
                    Blind count (hide expected quantities)
                  </label>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary" onClick={() => handleStartCount('all')} disabled={countLoading}>
                    {countLoading ? 'Starting…' : 'Count all products'}
                  </button>
                  <button className="btn" onClick={() => handleStartCount('low')} disabled={countLoading}>
                    Count low-stock only
                  </button>
                </div>
              </div>

              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Past counts</h3>
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table className="tbl">
                  <thead>
                    <tr><th>Date</th><th>Status</th><th>Items</th><th>Staff</th><th>Completed</th></tr>
                  </thead>
                  <tbody>
                    {stockCounts.map(c => (
                      <tr key={c.id}>
                        <td style={{ fontSize: 12, color: 'var(--text2)' }}>{new Date(c.createdAt).toLocaleDateString()}</td>
                        <td><span className={`badge ${c.status === 'COMPLETED' ? 'badge-green' : 'badge-yellow'}`}>{c.status}</span></td>
                        <td style={{ fontSize: 12 }}>{c.itemCount}</td>
                        <td style={{ fontSize: 12, color: 'var(--text2)' }}>{c.staffName ?? '—'}</td>
                        <td style={{ fontSize: 12, color: 'var(--text2)' }}>{c.completedAt ? new Date(c.completedAt).toLocaleDateString() : '—'}</td>
                      </tr>
                    ))}
                    {!countLoading && !stockCounts.length && (
                      <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text2)', padding: 32 }}>No counts yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <h3 style={{ fontSize: 15, margin: 0 }}>Active count — {countItems.length} products</h3>
                <button className="btn btn-primary" onClick={handleSubmitCount} style={{ marginLeft: 'auto' }}>Submit count</button>
                <button className="btn" onClick={() => { setActiveCountId(null); setCountItems([]); }}>Cancel</button>
              </div>
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Product</th>
                      {!countBlind && <th style={{ textAlign: 'right' }}>Expected</th>}
                      <th style={{ textAlign: 'right' }}>Counted</th>
                      {!countBlind && <th style={{ textAlign: 'right' }}>Variance</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {countItems.map((item, idx) => {
                      const counted = parseFloat(item.countedQty) || 0;
                      const variance = counted - item.expectedQty;
                      return (
                        <tr key={item.id}>
                          <td style={{ fontWeight: 500 }}>{item.productName}</td>
                          {!countBlind && <td style={{ textAlign: 'right', color: 'var(--text2)' }}>{item.expectedQty}</td>}
                          <td style={{ textAlign: 'right' }}>
                            <input
                              type="number" min={0} step={0.001}
                              value={item.countedQty}
                              onChange={e => setCountItems(items => items.map((it, i) => i === idx ? { ...it, countedQty: e.target.value } : it))}
                              style={{ width: 80, textAlign: 'right', padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
                            />
                          </td>
                          {!countBlind && (
                            <td style={{ textAlign: 'right', fontWeight: 600, color: variance > 0 ? 'var(--green)' : variance < 0 ? 'var(--red)' : 'var(--text2)' }}>
                              {item.countedQty === '' ? '—' : (variance > 0 ? `+${variance}` : variance)}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── BARCODE CONFIG (new) ──────────────────────────────────── */}
      {tab === 'barcodeconfig' && (
        <div className="card" style={{ maxWidth: 520 }}>
          <h2 style={{ marginBottom: 20, fontSize: 16 }}>Barcode scanner configuration</h2>
          {barcodeLoading ? (
            <div style={{ color: 'var(--text2)', padding: 20 }}>Loading…</div>
          ) : (
            <div style={{ display: 'grid', gap: 18 }}>
              <div>
                <label style={labelStyle}>Barcode prefix</label>
                <input className="inp" style={{ maxWidth: 120 }} value={barcodeConfig.barcodePrefix}
                  onChange={e => setBarcodeConfig(c => ({ ...c, barcodePrefix: e.target.value }))} />
                <p style={{ fontSize: 11, color: 'var(--text2)', marginTop: 4 }}>Prefix used when generating barcodes for products without one.</p>
              </div>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={barcodeConfig.barcodeScanSku}
                    onChange={e => setBarcodeConfig(c => ({ ...c, barcodeScanSku: e.target.checked }))} />
                  <span style={{ fontSize: 13 }}>Scan by SKU (fall back to barcode)</span>
                </label>
              </div>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={barcodeConfig.barcodeQtyEntry}
                    onChange={e => setBarcodeConfig(c => ({ ...c, barcodeQtyEntry: e.target.checked }))} />
                  <span style={{ fontSize: 13 }}>Allow quantity entry at scan</span>
                </label>
              </div>
              <div>
                <label style={labelStyle}>Labels per row</label>
                <select className="inp" style={{ maxWidth: 120 }} value={barcodeConfig.barcodeLabelsPerRow}
                  onChange={e => setBarcodeConfig(c => ({ ...c, barcodeLabelsPerRow: parseInt(e.target.value) }))}>
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                </select>
                <p style={{ fontSize: 11, color: 'var(--text2)', marginTop: 4 }}>Number of barcode labels per row when printing label sheets.</p>
              </div>
              <button className="btn btn-primary" style={{ justifyContent: 'center', padding: 12 }} onClick={handleSaveBarcodeConfig} disabled={barcodeSaving}>
                {barcodeSaving ? 'Saving…' : 'Save configuration'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── AI INSIGHTS (existing) ────────────────────────────────── */}
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
