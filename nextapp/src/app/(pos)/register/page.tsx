'use client';
import { useState, useRef } from 'react';
import { usePOS } from '@/lib/context';
import { OrderLine, Order, Product, BizType, HeldTicket, JournalEntry } from '@/lib/types';
import { fmtCurrency, r2, uid, now } from '@/lib/fmt';

interface CartLine extends OrderLine { key: string }

const METHODS = ['Cash', 'Card', 'Wallet / QR', 'Bank transfer', 'Credit'];

type OrderMeta = Record<string, string>;

function DynamicOrderFields({
  bizType,
  meta,
  setMeta,
  employees,
}: {
  bizType: BizType;
  meta: OrderMeta;
  setMeta: React.Dispatch<React.SetStateAction<OrderMeta>>;
  employees: { id: string; name: string; active: boolean }[];
}) {
  const str = (key: string) => meta[key] ?? '';
  const set = (key: string, v: string) => setMeta(m => ({ ...m, [key]: v }));

  const fieldStyle = {
    fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4,
  } as React.CSSProperties;

  if (bizType === 'garage' || bizType === 'tyre') {
    return (
      <div style={{ padding: '12px 14px', borderRadius: 8, background: 'var(--bg3)', border: '1px solid var(--border)' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', marginBottom: 8 }}>🔧 Vehicle info</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={fieldStyle}>License Plate</label>
            <input className="inp" value={str('licensePlate')} onChange={e => set('licensePlate', e.target.value)} placeholder="e.g. ABC 1234" />
          </div>
          <div>
            <label style={fieldStyle}>VIN</label>
            <input className="inp" value={str('vin')} onChange={e => set('vin', e.target.value)} placeholder="Vehicle ID Number" />
          </div>
          <div>
            <label style={fieldStyle}>Mileage (km)</label>
            <input className="inp" type="number" min={0} value={str('mileage')} onChange={e => set('mileage', e.target.value)} />
          </div>
          <div>
            <label style={fieldStyle}>Make / Model</label>
            <input className="inp" value={str('makeModel')} onChange={e => set('makeModel', e.target.value)} placeholder="e.g. Toyota Camry" />
          </div>
        </div>
      </div>
    );
  }

  if (bizType === 'clinic') {
    return (
      <div style={{ padding: '12px 14px', borderRadius: 8, background: 'var(--bg3)', border: '1px solid var(--border)' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', marginBottom: 8 }}>🏥 Patient info</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={fieldStyle}>Patient Name</label>
            <input className="inp" value={str('patientName')} onChange={e => set('patientName', e.target.value)} />
          </div>
          <div>
            <label style={fieldStyle}>Doctor</label>
            <input className="inp" value={str('doctor')} onChange={e => set('doctor', e.target.value)} />
          </div>
          <div>
            <label style={fieldStyle}>Insurance Provider</label>
            <input className="inp" value={str('insuranceProvider')} onChange={e => set('insuranceProvider', e.target.value)} />
          </div>
        </div>
      </div>
    );
  }

  if (bizType === 'salon') {
    const activeStylists = employees.filter(e => e.active);
    return (
      <div style={{ padding: '12px 14px', borderRadius: 8, background: 'var(--bg3)', border: '1px solid var(--border)' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', marginBottom: 8 }}>💇 Stylist</div>
        <div>
          <label style={fieldStyle}>Assigned Stylist</label>
          <select className="inp" value={str('stylistId')} onChange={e => {
            const emp = activeStylists.find(x => x.id === e.target.value);
            setMeta(m => ({ ...m, stylistId: e.target.value, stylistName: emp?.name ?? '' }));
          }}>
            <option value="">— Walk-in / Any —</option>
            {activeStylists.map(e => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
        </div>
      </div>
    );
  }

  if (bizType === 'ecommerce' || bizType === 'logistics') {
    return (
      <div style={{ padding: '12px 14px', borderRadius: 8, background: 'var(--bg3)', border: '1px solid var(--border)' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', marginBottom: 8 }}>
          {bizType === 'logistics' ? '🚚' : '📦'} Delivery info
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <label style={fieldStyle}>Delivery Address</label>
            <input className="inp" value={str('deliveryAddress')} onChange={e => set('deliveryAddress', e.target.value)} placeholder="Street, City, Postcode" />
          </div>
          <div>
            <label style={fieldStyle}>Driver Notes</label>
            <input className="inp" value={str('driverNotes')} onChange={e => set('driverNotes', e.target.value)} placeholder="e.g. Leave at door, call on arrival" />
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function addEl(parent: Element, tag: string, text?: string, styles?: Partial<CSSStyleDeclaration>) {
  const el = parent.ownerDocument.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (styles) Object.assign(el.style, styles);
  parent.appendChild(el);
  return el;
}

function printSlip(type: 'in' | 'out', amount: number, note: string, currency: string, business: string) {
  const typeLabel = type === 'in' ? 'CASH IN' : 'CASH OUT';
  const w = window.open('', '_blank', 'width=400,height=600');
  if (!w) return;
  const doc = w.document;
  const style = doc.createElement('style');
  style.textContent = 'body{font-family:monospace;max-width:320px;margin:20px auto;font-size:13px}';
  doc.head.appendChild(style);
  const b = doc.body;
  const divider = () => addEl(b, 'hr', undefined, { border: 'none', borderTop: '1px dashed #999', margin: '8px 0' });
  addEl(b, 'div', business, { textAlign: 'center', fontWeight: 'bold', fontSize: '15px' });
  divider();
  addEl(b, 'div', typeLabel, { textAlign: 'center', fontSize: '18px', fontWeight: 'bold', letterSpacing: '2px' });
  divider();
  const tbl = addEl(b, 'table');
  (tbl as HTMLTableElement).style.width = '100%';
  const rows: [string, string][] = [
    ['Date:', new Date().toLocaleString()],
    ['Amount:', `${currency} ${amount.toFixed(2)}`],
    ['Note:', note || '—'],
  ];
  rows.forEach(([label, val]) => {
    const tr = addEl(tbl, 'tr');
    addEl(tr, 'td', label);
    addEl(tr, 'td', val, { textAlign: 'right' });
  });
  divider();
  addEl(b, 'br');
  addEl(b, 'div', undefined, { borderTop: '1px solid #000', marginTop: '40px', marginBottom: '4px', width: '200px' });
  addEl(b, 'div', 'Authorised Signature', { fontSize: '11px', color: '#666' });
  addEl(b, 'br');
  divider();
  addEl(b, 'div', 'This is a transaction slip, not a tax invoice.', { textAlign: 'center', fontSize: '11px', color: '#666' });
  w.print();
}

export default function RegisterPage() {
  const { db, save, settings } = usePOS();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [search, setSearch] = useState('');
  const [method, setMethod] = useState('Cash');
  const [customerId, setCustomerId] = useState('');
  const [discount, setDiscount] = useState(0);
  const [paid, setPaid] = useState('');
  const [orderMeta, setOrderMeta] = useState<OrderMeta>({});
  const searchRef = useRef<HTMLInputElement>(null);

  // Hold / recall modal state
  const [showRecall, setShowRecall] = useState(false);

  // Cash management modal state
  const [showCashMgmt, setShowCashMgmt] = useState(false);
  const [cashType, setCashType] = useState<'in' | 'out'>('in');
  const [cashAmt, setCashAmt] = useState('');
  const [cashNote, setCashNote] = useState('');

  // Profit guard state
  const [showProfitWarn, setShowProfitWarn] = useState(false);
  const [pendingCharge, setPendingCharge] = useState(false);

  const taxRate = settings.taxRate / 100;

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

  // Profit guard: total cost of items in cart
  const cartCost = r2(cart.reduce((s, l) => {
    const p = db.products.find(x => x.id === l.productId);
    return s + (p?.cost ?? 0) * l.qty;
  }, 0));
  const isBelowCost = cartCost > 0 && total < cartCost;

  const clearCart = () => {
    setCart([]); setPaid(''); setDiscount(0); setCustomerId(''); setOrderMeta({});
    setPendingCharge(false);
  };

  const doCharge = () => {
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
      metadata: Object.keys(orderMeta).some(k => orderMeta[k]) ? orderMeta : undefined,
    };

    save(d => {
      d.orders = [...d.orders, order];
      cart.forEach(l => {
        const p = d.products.find(x => x.id === l.productId);
        if (p) p.stock = r2(p.stock - l.qty);
      });

      // Auto-post double-entry journal entries
      const cashLedger = order.method === 'cash' ? 'Cash' : 'Bank Account';
      const newEntries: JournalEntry[] = [{
        id: uid(), orderId: order.id,
        date: order.ts.slice(0, 10),
        description: `${order.no} — Sale`,
        debitLedger: cashLedger,
        creditLedger: 'Sales Revenue',
        amount: r2(order.total - order.tax),
        createdAt: order.ts,
      }];
      if (order.tax > 0) {
        newEntries.push({
          id: uid(), orderId: order.id,
          date: order.ts.slice(0, 10),
          description: `${order.no} — VAT`,
          debitLedger: cashLedger,
          creditLedger: 'VAT Payable',
          amount: order.tax,
          createdAt: order.ts,
        });
      }
      d.journalEntries = [...(d.journalEntries ?? []), ...newEntries];
      return d;
    });

    clearCart();
    alert(`✓ Order ${order.no} — Change: ${settings.currency} ${change.toFixed(2)}`);
  };

  const handleCharge = () => {
    if (cart.length === 0) return alert('Cart is empty');
    if (method === 'Cash' && paidAmt < total) return alert('Amount paid is less than total');

    if (isBelowCost && !pendingCharge) {
      setShowProfitWarn(true);
      return;
    }
    doCharge();
  };

  const holdTicket = () => {
    if (cart.length === 0) return alert('Cart is empty');
    const label = prompt('Label for this held ticket (optional):') ?? '';
    const ticket: HeldTicket = {
      id: uid(),
      label: label.trim() || `Hold #${(db.heldTickets?.length ?? 0) + 1}`,
      lines: cart.map(({ key, ...l }) => l),
      customerId: customerId || undefined,
      discount,
      method,
      orderMeta: { ...orderMeta },
      createdAt: now(),
    };
    save(d => {
      d.heldTickets = [...(d.heldTickets ?? []), ticket];
      return d;
    });
    clearCart();
  };

  const recallTicket = (ticket: HeldTicket) => {
    setCart(ticket.lines.map(l => ({ ...l, key: uid() })));
    setCustomerId(ticket.customerId ?? '');
    setDiscount(ticket.discount);
    setMethod(ticket.method);
    setOrderMeta(ticket.orderMeta);
    save(d => {
      d.heldTickets = (d.heldTickets ?? []).filter(t => t.id !== ticket.id);
      return d;
    });
    setShowRecall(false);
    setPendingCharge(false);
  };

  const handleCashVoucher = () => {
    const amount = parseFloat(cashAmt);
    if (!amount || isNaN(amount)) return alert('Enter a valid amount');
    save(d => {
      d.cashVouchers = [...(d.cashVouchers ?? []), {
        id: uid(),
        amount: cashType === 'in' ? Math.abs(amount) : -Math.abs(amount),
        note: cashNote || (cashType === 'in' ? 'Cash in' : 'Cash out'),
        createdAt: now(),
      }];
      return d;
    });
    printSlip(cashType, Math.abs(amount), cashNote, settings.currency, settings.business);
    setCashAmt(''); setCashNote(''); setShowCashMgmt(false);
  };

  const heldTickets = db.heldTickets ?? [];

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
            <div style={{ display: 'flex', gap: 6 }}>
              {heldTickets.length > 0 && (
                <button className="btn" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setShowRecall(true)}>
                  Recall ({heldTickets.length})
                </button>
              )}
              {cart.length > 0 && (
                <>
                  <button className="btn" style={{ padding: '4px 10px', fontSize: 12 }} onClick={holdTicket}>Hold</button>
                  <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={clearCart}>Clear</button>
                </>
              )}
            </div>
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 15, fontWeight: 600 }}>Payment</h2>
          <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => setShowCashMgmt(true)}>
            💵 Cash drawer
          </button>
        </div>

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

        {/* Dynamic industry fields */}
        <DynamicOrderFields
          bizType={settings.bizType}
          meta={orderMeta}
          setMeta={setOrderMeta}
          employees={db.employees ?? []}
        />

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
          {isBelowCost && (
            <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 6, background: 'rgba(220,38,38,.12)', border: '1px solid rgba(220,38,38,.3)', fontSize: 12, color: '#dc2626', display: 'flex', gap: 6, alignItems: 'center' }}>
              ⚠️ Selling below cost ({settings.currency} {cartCost.toFixed(2)})
            </div>
          )}
        </div>

        {/* Discount */}
        <div>
          <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Discount ({settings.currency})</label>
          <input className="inp" type="number" min={0} step={0.01} value={discount || ''} onChange={e => { setDiscount(parseFloat(e.target.value) || 0); setPendingCharge(false); }} />
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

      {/* ── RECALL MODAL ──────────────────────────────────────────── */}
      {showRecall && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={e => e.target === e.currentTarget && setShowRecall(false)}>
          <div className="card" style={{ width: 500, maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700 }}>Held Tickets</h2>
              <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setShowRecall(false)}>✕ Close</button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {heldTickets.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text2)', padding: 40 }}>No held tickets</div>
              ) : heldTickets.map(t => (
                <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 4px', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{t.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
                      {t.lines.length} item{t.lines.length !== 1 ? 's' : ''} · {new Date(t.createdAt).toLocaleTimeString()}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontWeight: 700 }}>
                      {settings.currency} {r2(t.lines.reduce((s, l) => s + l.price * l.qty, 0)).toFixed(2)}
                    </span>
                    <button className="btn btn-primary" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => recallTicket(t)}>
                      Recall
                    </button>
                    <button className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: 12, color: 'var(--red)', borderColor: 'var(--red)' }}
                      onClick={() => save(d => { d.heldTickets = (d.heldTickets ?? []).filter(x => x.id !== t.id); return d; })}>
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── PROFIT GUARD MODAL ────────────────────────────────────── */}
      {showProfitWarn && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="card" style={{ width: 420 }}>
            <div style={{ fontSize: 36, textAlign: 'center', marginBottom: 12 }}>⚠️</div>
            <h2 style={{ fontWeight: 700, textAlign: 'center', marginBottom: 8, color: '#dc2626' }}>Selling Below Cost</h2>
            <p style={{ fontSize: 14, color: 'var(--text2)', textAlign: 'center', marginBottom: 20 }}>
              Cart cost is <strong>{settings.currency} {cartCost.toFixed(2)}</strong> but sale total is only <strong>{settings.currency} {total.toFixed(2)}</strong>.
              <br /><br />
              This sale will result in a loss. A manager or admin should authorise it.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button className="btn btn-ghost" onClick={() => setShowProfitWarn(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ background: '#dc2626', borderColor: '#dc2626' }}
                onClick={() => { setPendingCharge(true); setShowProfitWarn(false); doCharge(); }}>
                Override &amp; Charge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CASH MANAGEMENT MODAL ─────────────────────────────────── */}
      {showCashMgmt && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={e => e.target === e.currentTarget && setShowCashMgmt(false)}>
          <div className="card" style={{ width: 420 }}>
            <h2 style={{ fontWeight: 700, marginBottom: 16 }}>Cash Drawer</h2>

            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {(['in', 'out'] as const).map(t => (
                <button key={t} onClick={() => setCashType(t)} style={{
                  flex: 1, padding: '10px', borderRadius: 8, border: '1px solid', cursor: 'pointer', fontWeight: 600, fontSize: 14,
                  borderColor: cashType === t ? (t === 'in' ? 'var(--green)' : 'var(--red)') : 'var(--border)',
                  background: cashType === t ? (t === 'in' ? 'rgba(34,197,94,.15)' : 'rgba(239,68,68,.15)') : 'var(--bg3)',
                  color: cashType === t ? (t === 'in' ? 'var(--green)' : 'var(--red)') : 'var(--text)',
                }}>
                  {t === 'in' ? '+ Cash In' : '− Cash Out'}
                </button>
              ))}
            </div>

            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>
                  Amount ({settings.currency}) *
                </label>
                <input className="inp" type="number" min={0} step={0.01} value={cashAmt}
                  onChange={e => setCashAmt(e.target.value)} placeholder="0.00" autoFocus />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>
                  Note / Reason
                </label>
                <input className="inp" value={cashNote} onChange={e => setCashNote(e.target.value)}
                  placeholder={cashType === 'in' ? 'e.g. Opening float, advance...' : 'e.g. Office supplies, petty cash...'} />
              </div>
            </div>

            <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 6, background: 'var(--bg3)', fontSize: 11, color: 'var(--text2)' }}>
              A transaction slip will be printed. This is not a tax invoice.
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <button className="btn btn-ghost" onClick={() => setShowCashMgmt(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCashVoucher}>
                Record &amp; Print Slip
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
