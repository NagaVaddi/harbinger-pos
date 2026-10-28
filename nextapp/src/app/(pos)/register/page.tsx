'use client';
import { useState, useRef } from 'react';
import { usePOS } from '@/lib/context';
import { OrderLine, Order, Product, BizType, HeldTicket, JournalEntry } from '@/lib/types';
import { fmtCurrency, r2, uid, now } from '@/lib/fmt';

interface CartLine extends OrderLine { key: string }
const METHODS = ['Cash', 'Card', 'Wallet / QR', 'Bank transfer', 'Credit'];
type OrderMeta = Record<string, string>;

// ── DOM-safe print helpers ─────────────────────────────────────
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
  divider();
  addEl(b, 'div', 'This is a transaction slip, not a tax invoice.', { textAlign: 'center', fontSize: '11px', color: '#666' });
  w.print();
}

function printReceipt(order: Order, business: string, currency: string, taxLabel: string, taxRate: number) {
  const w = window.open('', '_blank', 'width=400,height=700');
  if (!w) return;
  const doc = w.document;
  const style = doc.createElement('style');
  style.textContent = `body{font-family:monospace;max-width:320px;margin:20px auto;font-size:13px}
    table{width:100%} td{vertical-align:top} .r{text-align:right}`;
  doc.head.appendChild(style);
  const b = doc.body;
  const divider = () => addEl(b, 'hr', undefined, { border: 'none', borderTop: '1px dashed #999', margin: '8px 0' });
  addEl(b, 'div', business, { textAlign: 'center', fontWeight: 'bold', fontSize: '16px' });
  addEl(b, 'div', 'TAX INVOICE', { textAlign: 'center', fontSize: '11px', letterSpacing: '2px', color: '#555', marginTop: '4px' });
  divider();
  const meta = [
    ['Order:', order.no],
    ['Date:', new Date(order.ts).toLocaleString()],
    ['Method:', order.method.toUpperCase()],
  ];
  meta.forEach(([k, v]) => {
    const tr = addEl(addEl(b, 'table'), 'tr');
    addEl(tr, 'td', k, { color: '#555', fontSize: '11px' });
    addEl(tr, 'td', v, { textAlign: 'right', fontSize: '11px' });
  });
  divider();
  order.lines.forEach(l => {
    const row = addEl(b, 'div', undefined, { display: 'flex', justifyContent: 'space-between', marginBottom: '4px' });
    addEl(row, 'span', `${l.qty}x ${l.name}`);
    addEl(row, 'span', `${currency} ${(l.price * l.qty).toFixed(2)}`);
  });
  divider();
  const totals: [string, string][] = [
    ['Subtotal', `${currency} ${order.subtotal.toFixed(2)}`],
    [`${taxLabel} (${taxRate}%)`, `${currency} ${order.tax.toFixed(2)}`],
  ];
  if (order.disc > 0) totals.push(['Discount', `- ${currency} ${order.disc.toFixed(2)}`]);
  totals.forEach(([k, v]) => {
    const row = addEl(b, 'div', undefined, { display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '3px' });
    addEl(row, 'span', k, { color: '#555' });
    addEl(row, 'span', v);
  });
  const totRow = addEl(b, 'div', undefined, { display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '15px', marginTop: '6px', borderTop: '1px solid #000', paddingTop: '6px' });
  addEl(totRow, 'span', 'TOTAL');
  addEl(totRow, 'span', `${currency} ${order.total.toFixed(2)}`);
  if (order.method === 'cash') {
    divider();
    const cashRows: [string, string][] = [
      ['Paid', `${currency} ${order.paid.toFixed(2)}`],
      ['Change', `${currency} ${order.change.toFixed(2)}`],
    ];
    cashRows.forEach(([k, v]) => {
      const row = addEl(b, 'div', undefined, { display: 'flex', justifyContent: 'space-between', fontSize: '13px' });
      addEl(row, 'span', k, { color: '#555' });
      addEl(row, 'span', v);
    });
  }
  divider();
  addEl(b, 'div', 'Thank you for your business!', { textAlign: 'center', fontSize: '12px', color: '#555', marginTop: '10px' });
  w.print();
}

// ── Industry-specific order fields ─────────────────────────────
function DynamicOrderFields({ bizType, meta, setMeta, employees }: {
  bizType: BizType; meta: OrderMeta;
  setMeta: React.Dispatch<React.SetStateAction<OrderMeta>>;
  employees: { id: string; name: string; active: boolean }[];
}) {
  const str = (k: string) => meta[k] ?? '';
  const set = (k: string, v: string) => setMeta(m => ({ ...m, [k]: v }));
  const lbl = { fontSize: 11, color: 'var(--text2)', display: 'block', marginBottom: 3 } as React.CSSProperties;

  if (bizType === 'garage' || bizType === 'tyre') return (
    <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--bg3)', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', marginBottom: 8 }}>🔧 Vehicle</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {[['License Plate','licensePlate','ABC 1234'],['VIN','vin','Vehicle ID'],['Mileage (km)','mileage',''],['Make / Model','makeModel','Toyota Camry']].map(([label,key,ph]) => (
          <div key={key}><label style={lbl}>{label}</label>
            <input className="inp" value={str(key)} onChange={e => set(key, e.target.value)} placeholder={ph} style={{ fontSize: 12 }} />
          </div>
        ))}
      </div>
    </div>
  );

  if (bizType === 'clinic') return (
    <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--bg3)', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', marginBottom: 8 }}>🏥 Patient</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div style={{ gridColumn: '1/-1' }}><label style={lbl}>Patient Name</label>
          <input className="inp" value={str('patientName')} onChange={e => set('patientName', e.target.value)} style={{ fontSize: 12 }} /></div>
        <div><label style={lbl}>Doctor</label>
          <input className="inp" value={str('doctor')} onChange={e => set('doctor', e.target.value)} style={{ fontSize: 12 }} /></div>
        <div><label style={lbl}>Insurance</label>
          <input className="inp" value={str('insuranceProvider')} onChange={e => set('insuranceProvider', e.target.value)} style={{ fontSize: 12 }} /></div>
      </div>
    </div>
  );

  if (bizType === 'salon') {
    const stylists = employees.filter(e => e.active);
    return (
      <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--bg3)', border: '1px solid var(--border)' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', marginBottom: 8 }}>💇 Stylist</div>
        <select className="inp" value={str('stylistId')} style={{ fontSize: 12 }} onChange={e => {
          const emp = stylists.find(x => x.id === e.target.value);
          setMeta(m => ({ ...m, stylistId: e.target.value, stylistName: emp?.name ?? '' }));
        }}>
          <option value="">— Walk-in / Any —</option>
          {stylists.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      </div>
    );
  }

  if (bizType === 'ecommerce' || bizType === 'logistics') return (
    <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--bg3)', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', marginBottom: 8 }}>
        {bizType === 'logistics' ? '🚚' : '📦'} Delivery
      </div>
      <div><label style={lbl}>Delivery Address</label>
        <input className="inp" value={str('deliveryAddress')} onChange={e => set('deliveryAddress', e.target.value)} placeholder="Street, City" style={{ fontSize: 12 }} /></div>
      <div style={{ marginTop: 8 }}><label style={lbl}>Driver Notes</label>
        <input className="inp" value={str('driverNotes')} onChange={e => set('driverNotes', e.target.value)} placeholder="e.g. Leave at door" style={{ fontSize: 12 }} /></div>
    </div>
  );

  return null;
}

// ── Main POS Register ──────────────────────────────────────────
export default function RegisterPage() {
  const { db, save, settings } = usePOS();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [method, setMethod] = useState('Cash');
  const [customerId, setCustomerId] = useState('');
  const [discount, setDiscount] = useState(0);
  const [paid, setPaid] = useState('');
  const [orderMeta, setOrderMeta] = useState<OrderMeta>({});
  const searchRef = useRef<HTMLInputElement>(null);

  const [showRecall, setShowRecall] = useState(false);
  const [showCashMgmt, setShowCashMgmt] = useState(false);
  const [cashType, setCashType] = useState<'in' | 'out'>('in');
  const [cashAmt, setCashAmt] = useState('');
  const [cashNote, setCashNote] = useState('');
  const [showProfitWarn, setShowProfitWarn] = useState(false);
  const [pendingCharge, setPendingCharge] = useState(false);
  const [lastOrder, setLastOrder] = useState<Order | null>(null);

  const taxRate = settings.taxRate / 100;
  const activeProducts = db.products.filter(p => p.active);

  // Category tabs
  const categories = ['All', ...Array.from(new Set(activeProducts.map(p => p.category).filter(Boolean) as string[])).sort()];

  // Search / category filter
  const displayProducts = search.length > 0
    ? activeProducts.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.barcode?.includes(search) ||
        p.sku?.toLowerCase().includes(search.toLowerCase())
      ).slice(0, 24)
    : activeCategory === 'All'
      ? activeProducts
      : activeProducts.filter(p => p.category === activeCategory);

  const addToCart = (p: Product, qty = 1) => {
    setCart(prev => {
      const existing = prev.find(l => l.productId === p.id);
      if (existing) return prev.map(l => l.productId === p.id ? { ...l, qty: l.qty + qty } : l);
      const tax = p.taxable ? r2(p.price * qty * taxRate) : 0;
      return [...prev, { key: uid(), productId: p.id, name: p.name, qty, price: p.price, tax }];
    });
  };

  const updateQty = (key: string, qty: number) => {
    if (qty <= 0) { setCart(c => c.filter(l => l.key !== key)); return; }
    setCart(c => c.map(l => l.key === key ? { ...l, qty, tax: l.price * qty * taxRate } : l));
  };

  const subtotal = r2(cart.reduce((s, l) => s + l.price * l.qty, 0));
  const totalTax = r2(cart.reduce((s, l) => s + (l.tax ?? 0), 0));
  const disc = r2(discount);
  const total = r2(subtotal + totalTax - disc);
  const paidAmt = parseFloat(paid) || 0;
  const change = r2(Math.max(0, paidAmt - total));

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
    if (cart.length === 0) return;
    const order: Order = {
      id: uid(),
      no: `ORD-${Date.now().toString(36).toUpperCase()}`,
      lines: cart.map(({ key, ...l }) => l),
      subtotal, tax: totalTax, disc, total,
      paid: method === 'Cash' ? paidAmt : total,
      change, method: method.toLowerCase(),
      customerId: customerId || undefined,
      ts: now(), status: 'paid',
      metadata: Object.keys(orderMeta).some(k => orderMeta[k]) ? orderMeta : undefined,
    };
    save(d => {
      d.orders = [...d.orders, order];
      cart.forEach(l => {
        const p = d.products.find(x => x.id === l.productId);
        if (p) p.stock = r2(p.stock - l.qty);
      });
      const cashLedger = order.method === 'cash' ? 'Cash' : 'Bank Account';
      const newEntries: JournalEntry[] = [{
        id: uid(), orderId: order.id,
        date: order.ts.slice(0, 10),
        description: `${order.no} — Sale`,
        debitLedger: cashLedger, creditLedger: 'Sales Revenue',
        amount: r2(order.total - order.tax), createdAt: order.ts,
      }];
      if (order.tax > 0) newEntries.push({
        id: uid(), orderId: order.id,
        date: order.ts.slice(0, 10),
        description: `${order.no} — VAT`,
        debitLedger: cashLedger, creditLedger: 'VAT Payable',
        amount: order.tax, createdAt: order.ts,
      });
      d.journalEntries = [...(d.journalEntries ?? []), ...newEntries];
      return d;
    });
    setLastOrder(order);
    clearCart();
  };

  const handleCharge = () => {
    if (cart.length === 0) return;
    if (method === 'Cash' && paidAmt < total) return alert('Amount paid is less than total');
    if (isBelowCost && !pendingCharge) { setShowProfitWarn(true); return; }
    doCharge();
  };

  const holdTicket = () => {
    if (cart.length === 0) return;
    const label = prompt('Label for this held ticket (optional):') ?? '';
    const ticket: HeldTicket = {
      id: uid(),
      label: label.trim() || `Hold #${(db.heldTickets?.length ?? 0) + 1}`,
      lines: cart.map(({ key, ...l }) => l),
      customerId: customerId || undefined,
      discount, method,
      orderMeta: { ...orderMeta },
      createdAt: now(),
    };
    save(d => { d.heldTickets = [...(d.heldTickets ?? []), ticket]; return d; });
    clearCart();
  };

  const recallTicket = (ticket: HeldTicket) => {
    setCart(ticket.lines.map(l => ({ ...l, key: uid() })));
    setCustomerId(ticket.customerId ?? '');
    setDiscount(ticket.discount);
    setMethod(ticket.method);
    setOrderMeta(ticket.orderMeta);
    save(d => { d.heldTickets = (d.heldTickets ?? []).filter(t => t.id !== ticket.id); return d; });
    setShowRecall(false); setPendingCharge(false);
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

  // ── Quick-entry numpad amount buttons
  const QUICK_AMOUNTS = [10, 20, 50, 100, 200, 500];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: 16, height: 'calc(100vh - 104px)', overflow: 'hidden' }}>

      {/* ── LEFT: Product browser ───────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden' }}>

        {/* Search bar */}
        <div style={{ position: 'relative' }}>
          <input
            ref={searchRef}
            className="inp"
            placeholder="🔍  Search or scan barcode…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Escape' && setSearch('')}
            autoFocus
            style={{ paddingLeft: 14 }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', fontSize: 16 }}
            >✕</button>
          )}
        </div>

        {/* Category tabs */}
        {!search && (
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, flexShrink: 0 }}>
            {categories.map(cat => (
              <button key={cat} onClick={() => setActiveCategory(cat)} style={{
                padding: '6px 14px', borderRadius: 20, border: '1px solid',
                borderColor: activeCategory === cat ? 'var(--accent)' : 'var(--border)',
                background: activeCategory === cat ? 'rgba(79,142,247,.18)' : 'var(--bg2)',
                color: activeCategory === cat ? 'var(--accent)' : 'var(--text2)',
                fontSize: 12, fontWeight: activeCategory === cat ? 600 : 400,
                cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
              }}>
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Product grid */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {displayProducts.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text2)', padding: '60px 20px' }}>
              {search ? `No products matching "${search}"` : 'No products in this category'}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
              {displayProducts.map(p => {
                const inCart = cart.find(l => l.productId === p.id);
                const outOfStock = p.stock <= 0;
                return (
                  <button key={p.id} onClick={() => !outOfStock && addToCart(p)} disabled={outOfStock} style={{
                    position: 'relative',
                    padding: '14px 10px 12px',
                    borderRadius: 10,
                    border: `2px solid ${inCart ? 'var(--accent)' : 'var(--border)'}`,
                    background: inCart ? 'rgba(79,142,247,.1)' : 'var(--bg2)',
                    cursor: outOfStock ? 'not-allowed' : 'pointer',
                    opacity: outOfStock ? 0.45 : 1,
                    textAlign: 'left',
                    transition: 'border-color .15s, background .15s',
                  }}>
                    {inCart && (
                      <span style={{
                        position: 'absolute', top: 6, right: 6,
                        background: 'var(--accent)', color: '#fff',
                        borderRadius: 10, fontSize: 10, fontWeight: 700,
                        padding: '1px 6px',
                      }}>{inCart.qty}</span>
                    )}
                    {p.stock <= 5 && p.stock > 0 && (
                      <span style={{ position: 'absolute', top: 6, left: 6, fontSize: 9, color: '#f59e0b', fontWeight: 700 }}>LOW</span>
                    )}
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4, lineHeight: 1.3 }}>
                      {p.name}
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)' }}>
                      {fmtCurrency(p.price, settings.currency)}
                    </div>
                    {p.category && (
                      <div style={{ fontSize: 10, color: 'var(--text2)', marginTop: 3 }}>{p.category}</div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT: Cart + Payment ───────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, overflow: 'hidden', background: 'var(--bg2)', borderRadius: 12, border: '1px solid var(--border)' }}>

        {/* Cart header */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>🛒 Cart {cart.length > 0 && `(${cart.length})`}</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {heldTickets.length > 0 && (
              <button className="btn btn-ghost" style={{ padding: '3px 9px', fontSize: 11 }} onClick={() => setShowRecall(true)}>
                Recall ({heldTickets.length})
              </button>
            )}
            {cart.length > 0 && (
              <>
                <button className="btn btn-ghost" style={{ padding: '3px 9px', fontSize: 11 }} onClick={holdTicket}>Hold</button>
                <button className="btn btn-ghost" style={{ padding: '3px 9px', fontSize: 11, color: 'var(--red)' }} onClick={clearCart}>Clear</button>
              </>
            )}
          </div>
        </div>

        {/* Cart items */}
        <div style={{ flex: 1, overflowY: 'auto', padding: cart.length === 0 ? 0 : '8px 0' }}>
          {cart.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text2)', padding: '32px 20px', fontSize: 13 }}>
              Tap a product to add it to the cart
            </div>
          ) : (
            cart.map(l => (
              <div key={l.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text2)' }}>{fmtCurrency(l.price, settings.currency)} each</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button className="btn btn-ghost" style={{ padding: '2px 7px', fontSize: 13 }} onClick={() => updateQty(l.key, l.qty - 1)}>−</button>
                  <span style={{ minWidth: 24, textAlign: 'center', fontSize: 13, fontWeight: 600 }}>{l.qty}</span>
                  <button className="btn btn-ghost" style={{ padding: '2px 7px', fontSize: 13 }} onClick={() => updateQty(l.key, l.qty + 1)}>+</button>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, minWidth: 70, textAlign: 'right' }}>
                  {fmtCurrency(l.price * l.qty, settings.currency)}
                </div>
                <button className="btn btn-ghost" style={{ padding: '2px 6px', fontSize: 11, color: 'var(--text2)' }} onClick={() => updateQty(l.key, 0)}>✕</button>
              </div>
            ))
          )}
        </div>

        {/* Payment panel */}
        <div style={{ flexShrink: 0, borderTop: '1px solid var(--border)', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Customer */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select className="inp" style={{ flex: 1, fontSize: 12 }} value={customerId} onChange={e => setCustomerId(e.target.value)}>
              <option value="">👤 Walk-in customer</option>
              {db.customers.filter(c => c.status === 'active').map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <button className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: 12, flexShrink: 0 }} onClick={() => setShowCashMgmt(true)}>
              💵
            </button>
          </div>

          {/* Industry fields */}
          <DynamicOrderFields bizType={settings.bizType} meta={orderMeta} setMeta={setOrderMeta} employees={db.employees ?? []} />

          {/* Totals */}
          <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>
              <span>Subtotal</span><span>{fmtCurrency(subtotal, settings.currency)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>
              <span>{settings.taxLabel} ({settings.taxRate}%)</span><span>{fmtCurrency(totalTax, settings.currency)}</span>
            </div>
            {disc > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--red)', marginBottom: 4 }}>
                <span>Discount</span><span>- {fmtCurrency(disc, settings.currency)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 700, borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4 }}>
              <span>TOTAL</span>
              <span style={{ color: 'var(--accent)' }}>{fmtCurrency(total, settings.currency)}</span>
            </div>
            {isBelowCost && (
              <div style={{ marginTop: 6, padding: '4px 8px', borderRadius: 5, background: 'rgba(220,38,38,.12)', fontSize: 11, color: '#dc2626' }}>
                ⚠️ Below cost ({settings.currency} {cartCost.toFixed(2)})
              </div>
            )}
          </div>

          {/* Discount */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label style={{ fontSize: 11, color: 'var(--text2)', whiteSpace: 'nowrap' }}>Disc ({settings.currency})</label>
            <input className="inp" type="number" min={0} step={0.01}
              value={discount || ''} onChange={e => { setDiscount(parseFloat(e.target.value) || 0); setPendingCharge(false); }}
              style={{ fontSize: 12 }} />
          </div>

          {/* Payment method */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
            {METHODS.map(m => (
              <button key={m} onClick={() => setMethod(m)} style={{
                padding: '7px 8px', borderRadius: 7, border: '1px solid', cursor: 'pointer', fontSize: 11, fontWeight: 500,
                borderColor: method === m ? 'var(--accent)' : 'var(--border)',
                background: method === m ? 'rgba(79,142,247,.15)' : 'var(--bg3)',
                color: method === m ? 'var(--accent)' : 'var(--text)',
              }}>{m}</button>
            ))}
          </div>

          {/* Cash payment */}
          {method === 'Cash' && (
            <div>
              <label style={{ fontSize: 11, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>
                Amount tendered ({settings.currency})
              </label>
              <input className="inp" type="number" min={0} step={0.01}
                value={paid} onChange={e => setPaid(e.target.value)}
                placeholder={total.toFixed(2)} style={{ fontSize: 13, fontWeight: 600 }} />
              {/* Quick amount buttons */}
              <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                <button className="btn btn-ghost" style={{ padding: '3px 8px', fontSize: 11 }}
                  onClick={() => setPaid(total.toFixed(2))}>
                  Exact
                </button>
                {QUICK_AMOUNTS.filter(a => a >= total).slice(0, 4).map(a => (
                  <button key={a} className="btn btn-ghost" style={{ padding: '3px 8px', fontSize: 11 }}
                    onClick={() => setPaid(String(a))}>
                    {a}
                  </button>
                ))}
              </div>
              {paidAmt >= total && paidAmt > 0 && (
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--green)', marginTop: 6 }}>
                  Change: {settings.currency} {change.toFixed(2)}
                </div>
              )}
            </div>
          )}

          {/* Charge button */}
          <button
            className="btn btn-primary"
            style={{ padding: '14px', fontSize: 16, justifyContent: 'center', fontWeight: 700, marginTop: 2 }}
            onClick={handleCharge}
            disabled={cart.length === 0}
          >
            {cart.length === 0 ? 'Add items to cart' : `Charge ${fmtCurrency(total, settings.currency)}`}
          </button>
        </div>
      </div>

      {/* ── RECEIPT MODAL ──────────────────────────────────────── */}
      {lastOrder && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="card" style={{ width: 400, maxWidth: '95vw' }}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 48, marginBottom: 8 }}>✅</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--green)' }}>Payment Complete</div>
              <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 4 }}>{lastOrder.no}</div>
            </div>
            <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: 14, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 6 }}>
                <span style={{ color: 'var(--text2)' }}>Total charged</span>
                <span style={{ fontWeight: 700 }}>{fmtCurrency(lastOrder.total, settings.currency)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 6 }}>
                <span style={{ color: 'var(--text2)' }}>Method</span>
                <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{lastOrder.method}</span>
              </div>
              {lastOrder.method === 'cash' && lastOrder.change > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                  <span style={{ fontWeight: 600 }}>💰 Change due</span>
                  <span style={{ fontWeight: 800, color: 'var(--green)', fontSize: 18 }}>{fmtCurrency(lastOrder.change, settings.currency)}</span>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }}
                onClick={() => printReceipt(lastOrder, settings.business, settings.currency, settings.taxLabel, settings.taxRate)}>
                🖨️ Print Receipt
              </button>
              <button className="btn btn-primary" style={{ flex: 1 }}
                onClick={() => setLastOrder(null)}>
                New Sale
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── RECALL MODAL ───────────────────────────────────────── */}
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
                    <span style={{ fontWeight: 700 }}>{settings.currency} {r2(t.lines.reduce((s, l) => s + l.price * l.qty, 0)).toFixed(2)}</span>
                    <button className="btn btn-primary" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => recallTicket(t)}>Recall</button>
                    <button className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: 12, color: 'var(--red)', borderColor: 'var(--red)' }}
                      onClick={() => save(d => { d.heldTickets = (d.heldTickets ?? []).filter(x => x.id !== t.id); return d; })}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── PROFIT GUARD MODAL ─────────────────────────────────── */}
      {showProfitWarn && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="card" style={{ width: 420 }}>
            <div style={{ fontSize: 36, textAlign: 'center', marginBottom: 12 }}>⚠️</div>
            <h2 style={{ fontWeight: 700, textAlign: 'center', marginBottom: 8, color: '#dc2626' }}>Selling Below Cost</h2>
            <p style={{ fontSize: 14, color: 'var(--text2)', textAlign: 'center', marginBottom: 20 }}>
              Cart cost is <strong>{settings.currency} {cartCost.toFixed(2)}</strong> but sale total is only <strong>{settings.currency} {total.toFixed(2)}</strong>.
              <br /><br />This sale will result in a loss. A manager should authorise it.
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

      {/* ── CASH DRAWER MODAL ──────────────────────────────────── */}
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
                }}>{t === 'in' ? '+ Cash In' : '− Cash Out'}</button>
              ))}
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Amount ({settings.currency}) *</label>
                <input className="inp" type="number" min={0} step={0.01} value={cashAmt} onChange={e => setCashAmt(e.target.value)} placeholder="0.00" autoFocus />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Note / Reason</label>
                <input className="inp" value={cashNote} onChange={e => setCashNote(e.target.value)}
                  placeholder={cashType === 'in' ? 'e.g. Opening float…' : 'e.g. Office supplies…'} />
              </div>
            </div>
            <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 6, background: 'var(--bg3)', fontSize: 11, color: 'var(--text2)' }}>
              A transaction slip will be printed. This is not a tax invoice.
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <button className="btn btn-ghost" onClick={() => setShowCashMgmt(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCashVoucher}>Record &amp; Print Slip</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
