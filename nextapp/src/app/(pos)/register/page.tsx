'use client';
import { useState, useRef } from 'react';
import { usePOS } from '@/lib/context';
import { OrderLine, Order, Product } from '@/lib/types';
import { fmtCurrency, r2, uid, now } from '@/lib/fmt';

interface CartLine extends OrderLine { key: string }

const METHODS = ['Cash', 'Card', 'Wallet / QR', 'Bank transfer', 'Credit'];

export default function RegisterPage() {
  const { db, save, settings } = usePOS();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [search, setSearch] = useState('');
  const [method, setMethod] = useState('Cash');
  const [customerId, setCustomerId] = useState('');
  const [discount, setDiscount] = useState(0);
  const [paid, setPaid] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const taxRate = settings.taxRate / 100;

  // Product search results
  const results = search.length > 0
    ? db.products.filter(p => p.active && (
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.barcode?.includes(search) ||
        p.sku?.toLowerCase().includes(search.toLowerCase())
      )).slice(0, 12)
    : [];

  const addToCart = (p: Product, qty = 1) => {
    setCart(prev => {
      const existing = prev.find(l => l.productId === p.id);
      if (existing) return prev.map(l => l.productId === p.id ? { ...l, qty: l.qty + qty } : l);
      const tax = p.taxable ? r2(p.price * qty * taxRate) : 0;
      return [...prev, { key: uid(), productId: p.id, name: p.name, qty, price: p.price, tax }];
    });
    setSearch('');
    searchRef.current?.focus();
  };

  const updateQty = (key: string, qty: number) => {
    if (qty <= 0) { setCart(c => c.filter(l => l.key !== key)); return; }
    setCart(c => c.map(l => l.key === key ? { ...l, qty, tax: l.price * qty * (settings.taxRate / 100) } : l));
  };

  const subtotal = r2(cart.reduce((s, l) => s + l.price * l.qty, 0));
  const totalTax = r2(cart.reduce((s, l) => s + (l.tax ?? 0), 0));
  const disc = r2(discount);
  const total = r2(subtotal + totalTax - disc);
  const paidAmt = parseFloat(paid) || 0;
  const change = r2(Math.max(0, paidAmt - total));

  const handleCharge = () => {
    if (cart.length === 0) return alert('Cart is empty');
    if (method === 'Cash' && paidAmt < total) return alert('Amount paid is less than total');

    const order: Order = {
      id: uid(),
      no: `ORD-${Date.now().toString(36).toUpperCase()}`,
      lines: cart.map(({ key, ...l }) => l),
      subtotal,
      tax: totalTax,
      disc,
      total,
      paid: method === 'Cash' ? paidAmt : total,
      change,
      method: method.toLowerCase(),
      customerId: customerId || undefined,
      ts: now(),
      status: 'paid',
    };

    save(d => {
      d.orders = [...d.orders, order];
      // Deduct stock
      if (!settings.allowNegative || true) {
        cart.forEach(l => {
          const p = d.products.find(x => x.id === l.productId);
          if (p) p.stock = r2(p.stock - l.qty);
        });
      }
      return d;
    });

    setCart([]);
    setPaid('');
    setDiscount(0);
    setCustomerId('');
    alert(`✓ Order ${order.no} — Change: ${settings.currency} ${change.toFixed(2)}`);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20, height: 'calc(100vh - 104px)' }}>
      {/* Left — product search + cart */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Search */}
        <div style={{ position: 'relative' }}>
          <input
            ref={searchRef}
            className="inp"
            placeholder="Search product, scan barcode…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
          {results.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
              background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8,
              marginTop: 4, maxHeight: 360, overflowY: 'auto',
            }}>
              {results.map(p => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                  onClick={() => addToCart(p)}>
                  <div>
                    <div style={{ fontWeight: 500 }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text2)' }}>{p.barcode ?? p.sku ?? ''} · Stock: {p.stock}</div>
                  </div>
                  <div style={{ fontWeight: 700, color: 'var(--accent)' }}>{fmtCurrency(p.price, settings.currency)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cart */}
        <div className="card" style={{ flex: 1, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 600 }}>Cart ({cart.length} items)</span>
            {cart.length > 0 && <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setCart([])}>Clear</button>}
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {cart.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text2)', padding: 48 }}>
                Search or scan a product to start
              </div>
            ) : (
              <table className="tbl">
                <thead><tr><th>Item</th><th style={{ textAlign: 'center' }}>Qty</th><th style={{ textAlign: 'right' }}>Price</th><th style={{ textAlign: 'right' }}>Total</th><th></th></tr></thead>
                <tbody>
                  {cart.map(l => (
                    <tr key={l.key}>
                      <td>{l.name}</td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'center', alignItems: 'center' }}>
                          <button className="btn btn-ghost" style={{ padding: '2px 8px' }} onClick={() => updateQty(l.key, l.qty - 1)}>−</button>
                          <input style={{ width: 50, textAlign: 'center', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 4px', color: 'var(--text)' }}
                            type="number" min={0} value={l.qty} onChange={e => updateQty(l.key, parseFloat(e.target.value) || 0)} />
                          <button className="btn btn-ghost" style={{ padding: '2px 8px' }} onClick={() => updateQty(l.key, l.qty + 1)}>+</button>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--text2)' }}>{fmtCurrency(l.price, settings.currency)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtCurrency(l.price * l.qty, settings.currency)}</td>
                      <td><button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => updateQty(l.key, 0)}>✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Right — payment panel */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600 }}>Payment</h2>

        {/* Customer */}
        <div>
          <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Customer (optional)</label>
          <select className="inp" value={customerId} onChange={e => setCustomerId(e.target.value)}>
            <option value="">Walk-in</option>
            {db.customers.filter(c => c.status === 'active').map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Totals */}
        <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: 14 }}>
          {[
            ['Subtotal', fmtCurrency(subtotal, settings.currency)],
            [`${settings.taxLabel} (${settings.taxRate}%)`, fmtCurrency(totalTax, settings.currency)],
            ['Discount', fmtCurrency(disc, settings.currency)],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, color: 'var(--text2)', fontSize: 13 }}>
              <span>{k}</span><span>{v}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20, fontWeight: 700, borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 2 }}>
            <span>TOTAL</span><span style={{ color: 'var(--accent)' }}>{fmtCurrency(total, settings.currency)}</span>
          </div>
        </div>

        {/* Discount */}
        <div>
          <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Discount ({settings.currency})</label>
          <input className="inp" type="number" min={0} step={0.01} value={discount || ''} onChange={e => setDiscount(parseFloat(e.target.value) || 0)} />
        </div>

        {/* Method */}
        <div>
          <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>Payment method</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {METHODS.map(m => (
              <button key={m} onClick={() => setMethod(m)} style={{
                padding: '8px 10px', borderRadius: 8, border: '1px solid', cursor: 'pointer', fontSize: 12, fontWeight: 500,
                borderColor: method === m ? 'var(--accent)' : 'var(--border)',
                background: method === m ? 'rgba(79,142,247,.15)' : 'var(--bg3)',
                color: method === m ? 'var(--accent)' : 'var(--text)',
              }}>
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Cash paid */}
        {method === 'Cash' && (
          <div>
            <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Amount tendered ({settings.currency})</label>
            <input className="inp" type="number" min={0} step={0.01} value={paid} onChange={e => setPaid(e.target.value)} placeholder={total.toFixed(2)} />
            {paidAmt >= total && <div style={{ fontSize: 13, color: 'var(--green)', marginTop: 6 }}>Change: {settings.currency} {change.toFixed(2)}</div>}
          </div>
        )}

        <button className="btn btn-primary" style={{ marginTop: 'auto', padding: '14px', fontSize: 16, justifyContent: 'center' }} onClick={handleCharge}>
          Charge {fmtCurrency(total, settings.currency)}
        </button>
      </div>
    </div>
  );
}
