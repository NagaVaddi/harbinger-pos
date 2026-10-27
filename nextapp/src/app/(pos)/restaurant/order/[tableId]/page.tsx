'use client';
import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { QRCodeCanvas } from 'qrcode.react';
import { usePOS } from '@/lib/context';
import { OrderLine, KOT, KOTItem } from '@/lib/types';
import { uid, fmtCurrency, now } from '@/lib/fmt';

type Step = 'order' | 'qr' | 'pin' | 'kitchen' | 'payment';

const KOT_STATUS_LABELS = { new: 'New', accepted: 'Accepted', preparing: 'Preparing', ready: 'Ready ✓', served: 'Served' };
const KOT_STATUS_COLORS: Record<KOT['status'], string> = {
  new: 'var(--text2)',
  accepted: 'var(--accent)',
  preparing: 'var(--yellow)',
  ready: 'var(--green)',
  served: 'var(--text2)',
};

function genPin() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export default function RestaurantOrderPage({ params }: { params: Promise<{ tableId: string }> }) {
  const { tableId } = use(params);
  const router = useRouter();
  const { db, save, settings } = usePOS();
  const table = db.tables.find(t => t.id === tableId);

  // Active order for this table
  const activeOrder = db.orders.find(o =>
    o.tableId === tableId &&
    o.restaurantStatus &&
    !['served', 'paid', 'void'].includes(o.restaurantStatus)
  );

  const [step, setStep] = useState<Step>(() => {
    if (!activeOrder) return 'order';
    const s = activeOrder.restaurantStatus;
    if (s === 'draft' || s === 'pending_verification') return 'qr';
    if (s === 'verified') return 'pin';
    if (s === 'in_kitchen' || s === 'ready') return 'kitchen';
    if (s === 'served') return 'payment';
    return 'order';
  });

  const [lines, setLines] = useState<OrderLine[]>(activeOrder?.lines || []);
  const [search, setSearch] = useState('');
  const [orderId, setOrderId] = useState<string>(activeOrder?.id || '');
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinAttempts, setPinAttempts] = useState(0);
  const [pinLocked, setPinLocked] = useState(false);
  const [payMethod, setPayMethod] = useState('cash');
  const [cash, setCash] = useState('');
  const [note, setNote] = useState('');

  const products = db.products.filter(p => p.active &&
    (search.length < 2 || p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.category?.toLowerCase().includes(search.toLowerCase()))
  );

  const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const tax = lines.reduce((s, l) => s + l.tax * l.qty, 0);
  const total = subtotal + tax;

  const handleAddProduct = (pid: string) => {
    const prod = db.products.find(p => p.id === pid);
    if (!prod) return;
    setLines(prev => {
      const existing = prev.find(l => l.productId === pid);
      if (existing) return prev.map(l => l.productId === pid ? { ...l, qty: l.qty + 1 } : l);
      const taxAmt = prod.taxable ? (prod.price * (settings.taxRate / 100)) : 0;
      return [...prev, { productId: pid, name: prod.name, qty: 1, price: prod.price, tax: taxAmt }];
    });
  };

  const handleQty = (pid: string, delta: number) => {
    setLines(prev => prev.map(l => l.productId === pid ? { ...l, qty: Math.max(0, l.qty + delta) } : l).filter(l => l.qty > 0));
  };

  // Derive origin for QR URL (client-side only)
  const [origin, setOrigin] = useState('');
  useEffect(() => { setOrigin(window.location.origin); }, []);

  // Poll for verification (storage event fires automatically via context)
  useEffect(() => {
    if (step !== 'qr') return;
    const oid = orderId;
    const interval = setInterval(() => {
      const o = db.orders.find(x => x.id === oid);
      if (o?.restaurantStatus === 'verified') {
        setStep('pin');
        clearInterval(interval);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [step, orderId, db.orders]);

  // Also watch for kitchen completion
  useEffect(() => {
    if (step !== 'kitchen') return;
    const kots = db.kots.filter(k => k.orderId === orderId);
    const allReady = kots.length > 0 && kots.every(k => k.status === 'ready' || k.status === 'served');
    if (allReady) {
      save(d => {
        const o = d.orders.find(x => x.id === orderId);
        if (o) o.restaurantStatus = 'ready';
      });
    }
  }, [db.kots, orderId, step, save]);

  const handleSendForVerification = () => {
    if (lines.length === 0) return;
    const oid = uid();
    const pin = genPin();
    const no = `R${Date.now().toString().slice(-6)}`;
    save(d => {
      d.orders.push({
        id: oid, no, lines, subtotal, tax, disc: 0, total, paid: 0, change: 0,
        method: '', ts: now(), status: 'open',
        tableId, tableName: `Table ${table?.number || '?'}`,
        restaurantStatus: 'pending_verification',
        verificationPin: pin,
        pinExpiry: Date.now() + 10 * 60 * 1000,
      });
      const t = d.tables.find(x => x.id === tableId);
      if (t) { t.status = 'occupied'; t.currentOrderId = oid; }
    });
    setOrderId(oid);
    setStep('qr');
  };

  const MAX_PIN_ATTEMPTS = 3;

  const handleVerifyPin = () => {
    if (pinLocked) return;
    const order = db.orders.find(o => o.id === orderId);
    if (!order?.verificationPin) return;
    if (pinInput === order.verificationPin) {
      // Create KOTs per kitchen — per-product routing takes priority over category routing
      save(d => {
        const o = d.orders.find(x => x.id === orderId);
        if (!o) return;
        o.restaurantStatus = 'in_kitchen';

        const kitchenMap = new Map<string, { kitchen: typeof d.kitchens[0] | undefined; items: KOTItem[] }>();
        for (const line of o.lines) {
          const prod = d.products.find(p => p.id === line.productId);
          // Per-product kitchenId takes priority, else fall back to category routing
          let kitchen = prod?.kitchenId ? d.kitchens.find(k => k.active && k.id === prod.kitchenId) : undefined;
          if (!kitchen) {
            const cat = prod?.category || '';
            kitchen = d.kitchens.find(k => k.active && k.categories.includes(cat));
          }
          const kid = kitchen?.id || '__default__';
          if (!kitchenMap.has(kid)) kitchenMap.set(kid, { kitchen, items: [] });
          kitchenMap.get(kid)!.items.push({ productId: line.productId, name: line.name, qty: line.qty, note: line.note });
        }

        for (const [kid, { kitchen, items }] of kitchenMap) {
          d.kots.push({
            id: uid(), orderId: orderId, orderNo: o.no,
            tableId, tableName: o.tableName,
            kitchenId: kid, kitchenName: kitchen?.name || 'Main Kitchen',
            kitchenColor: kitchen?.color || '#4f8ef7',
            items, status: 'new',
            createdAt: now(), updatedAt: now(),
          });
        }
      });
      setStep('kitchen');
      setPinError('');
      setPinAttempts(0);
    } else {
      const attempts = pinAttempts + 1;
      setPinAttempts(attempts);
      if (attempts >= MAX_PIN_ATTEMPTS) {
        setPinLocked(true);
        setPinError(`Too many wrong attempts. Please ask the customer to re-scan the QR code.`);
        // Reset order back to pending so customer can re-verify
        save(d => {
          const o = d.orders.find(x => x.id === orderId);
          if (o) { o.restaurantStatus = 'pending_verification'; o.verificationPin = undefined; }
        });
      } else {
        setPinError(`Wrong PIN. ${MAX_PIN_ATTEMPTS - attempts} attempt${MAX_PIN_ATTEMPTS - attempts === 1 ? '' : 's'} left.`);
      }
      setPinInput('');
    }
  };

  const handlePayment = () => {
    const paidAmt = payMethod === 'cash' ? parseFloat(cash) || total : total;
    save(d => {
      const o = d.orders.find(x => x.id === orderId);
      if (o) {
        o.paid = paidAmt; o.change = Math.max(0, paidAmt - total);
        o.method = payMethod; o.status = 'paid';
        o.restaurantStatus = 'served';
      }
      const tbl = d.tables.find(x => x.id === tableId);
      if (tbl) { tbl.status = 'available'; tbl.currentOrderId = undefined; }
      // Mark KOTs served
      d.kots.filter(k => k.orderId === orderId).forEach(k => { k.status = 'served'; k.updatedAt = now(); });
    });
    router.push('/restaurant');
  };

  const tableKots = db.kots.filter(k => k.orderId === orderId);
  const allServed = tableKots.length > 0 && tableKots.every(k => k.status === 'ready' || k.status === 'served');
  const currentOrder = db.orders.find(o => o.id === orderId);

  if (!table) return (
    <div style={{ padding: 28 }}>
      <div style={{ color: 'var(--red)' }}>Table not found.</div>
    </div>
  );

  return (
    <div style={{ padding: 28, maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button className="btn btn-ghost" onClick={() => router.push('/restaurant')}>← Back</button>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
          Table {table.number} {table.name ? `· ${table.name}` : ''} — {table.seats} seats
        </h1>
        {currentOrder && (
          <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text2)' }}>Order #{currentOrder.no}</span>
        )}
      </div>

      {/* STEP: ORDER TAKING */}
      {step === 'order' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
          {/* Left: product search */}
          <div>
            <input className="inp" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search products by name or category..." style={{ marginBottom: 14 }} autoFocus />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8, maxHeight: 360, overflowY: 'auto' }}>
              {products.slice(0, 40).map(p => (
                <button key={p.id} className="btn btn-ghost" onClick={() => handleAddProduct(p.id)}
                  style={{ flexDirection: 'column', alignItems: 'flex-start', padding: '10px 12px', height: 'auto', textAlign: 'left', gap: 2 }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</span>
                  {p.category && <span style={{ fontSize: 11, color: 'var(--text2)' }}>{p.category}</span>}
                  <span style={{ fontSize: 13, color: 'var(--accent)', marginTop: 4 }}>{fmtCurrency(p.price, settings.currency)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Right: cart */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Order</div>
            {lines.length === 0 ? (
              <div style={{ color: 'var(--text2)', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>No items yet</div>
            ) : (
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {lines.map(l => {
                  const prod = db.products.find(p => p.id === l.productId);
                  let kitchen = prod?.kitchenId ? db.kitchens.find(k => k.id === prod.kitchenId) : undefined;
                  if (!kitchen && prod?.category) kitchen = db.kitchens.find(k => k.categories.includes(prod.category!));
                  // KOT printer: product override first, then kitchen's printerNo
                  const kotPrinter = prod?.kotPrinter ?? kitchen?.printerNo;
                  return (
                  <div key={l.productId} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, fontSize: 13 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        {l.name}
                        {kitchen ? (
                          <span style={{ background: kitchen.color + '33', color: kitchen.color, fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 10, border: `1px solid ${kitchen.color}` }}>{kitchen.name}</span>
                        ) : (
                          <span title="No kitchen assigned" style={{ fontSize: 12, color: 'var(--yellow)' }}>⚠️</span>
                        )}
                        {kotPrinter && (
                          <span style={{ background: 'var(--bg3)', color: 'var(--text2)', fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 10, border: '1px solid var(--border)' }}>
                            🖨 P{kotPrinter}
                          </span>
                        )}
                      </div>
                      <div style={{ color: 'var(--text2)', fontSize: 11 }}>{fmtCurrency(l.price, settings.currency)} each</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 16 }} onClick={() => handleQty(l.productId, -1)}>−</button>
                      <span style={{ fontSize: 14, fontWeight: 600, minWidth: 20, textAlign: 'center' }}>{l.qty}</span>
                      <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 16 }} onClick={() => handleQty(l.productId, 1)}>+</button>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, minWidth: 60, textAlign: 'right' }}>{fmtCurrency(l.price * l.qty, settings.currency)}</div>
                  </div>
                  );
                })}
              </div>
            )}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--text2)' }}>Subtotal</span>
                <span>{fmtCurrency(subtotal, settings.currency)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--text2)' }}>{settings.taxLabel} ({settings.taxRate}%)</span>
                <span>{fmtCurrency(tax, settings.currency)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 16 }}>
                <span>Total</span>
                <span style={{ color: 'var(--accent)' }}>{fmtCurrency(total, settings.currency)}</span>
              </div>
            </div>
            <button className="btn btn-primary" style={{ justifyContent: 'center', padding: 12 }}
              disabled={lines.length === 0} onClick={handleSendForVerification}>
              Send to Customer for Confirmation →
            </button>
          </div>
        </div>
      )}

      {/* STEP: QR CODE */}
      {step === 'qr' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, padding: '20px 0' }}>
          <div className="card" style={{ maxWidth: 420, width: '100%', textAlign: 'center', padding: 32 }}>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Show QR to Customer</div>
            <div style={{ color: 'var(--text2)', fontSize: 14, marginBottom: 24 }}>
              Customer scans this QR code to view & confirm their order
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
              <div style={{ background: '#fff', padding: 16, borderRadius: 12 }}>
                {origin && <QRCodeCanvas value={`${origin}/verify/${orderId}`} size={200} bgColor="#ffffff" fgColor="#0f1117" level="M" />}
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text2)', wordBreak: 'break-all', marginBottom: 16 }}>
              {origin}/verify/{orderId}
            </div>
            <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center', fontSize: 12 }}
              onClick={() => { navigator.clipboard?.writeText(`${origin}/verify/${orderId}`); }}>
              Copy Link
            </button>

            {/* Order summary */}
            <div style={{ marginTop: 20, textAlign: 'left', borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Order Summary</div>
              {lines.map(l => (
                <div key={l.productId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span>{l.qty}× {l.name}</span>
                  <span>{fmtCurrency(l.price * l.qty, settings.currency)}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                <span>Total</span>
                <span style={{ color: 'var(--accent)' }}>{fmtCurrency(total, settings.currency)}</span>
              </div>
            </div>

            <div style={{ marginTop: 20, padding: '12px 16px', background: 'var(--bg3)', borderRadius: 8, fontSize: 13, color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>⏳</span>
              Waiting for customer to confirm...
            </div>

            <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center', marginTop: 12, fontSize: 13 }}
              onClick={() => {
                // Cancel this order and go back to order step
                save(d => {
                  const o = d.orders.find(x => x.id === orderId);
                  if (o) o.status = 'void';
                  const t = d.tables.find(x => x.id === tableId);
                  if (t) { t.status = 'available'; t.currentOrderId = undefined; }
                });
                setOrderId('');
                setStep('order');
              }}>
              ← Edit Order
            </button>
          </div>

          {/* Demo shortcut */}
          <div className="card" style={{ maxWidth: 420, width: '100%', padding: 16, background: 'rgba(79,142,247,0.1)', border: '1px solid var(--accent)' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', marginBottom: 8 }}>Demo: Simulate Customer Confirmation</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 10 }}>
              Open <a href={`/verify/${orderId}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>/verify/{orderId}</a> in another tab to simulate customer confirming their order.
            </div>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>
              PIN: <strong style={{ color: 'var(--yellow)', fontSize: 16 }}>{currentOrder?.verificationPin}</strong>
            </div>
          </div>
        </div>
      )}

      {/* STEP: PIN ENTRY */}
      {step === 'pin' && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
          <div className="card" style={{ maxWidth: 380, width: '100%', textAlign: 'center', padding: 32 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Customer Confirmed!</div>
            <div style={{ color: 'var(--text2)', fontSize: 14, marginBottom: 24 }}>
              Ask the customer to read the PIN shown on their screen
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {[0,1,2,3].map(i => (
                <input key={i} className="inp" type="text" maxLength={1} value={pinInput[i] || ''}
                  style={{ textAlign: 'center', fontSize: 28, fontWeight: 700, flex: 1, padding: '14px 0' }}
                  onChange={e => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 1);
                    const arr = pinInput.split('');
                    arr[i] = v;
                    setPinInput(arr.join('').padEnd(4, '').trim());
                    if (v && i < 3) {
                      const next = document.getElementById(`pin-${i+1}`);
                      next?.focus();
                    }
                  }}
                  id={`pin-${i}`}
                  onFocus={e => e.target.select()}
                />
              ))}
            </div>
            {pinAttempts > 0 && !pinLocked && (
              <div style={{ fontSize: 12, color: 'var(--yellow)', marginBottom: 8, textAlign: 'center' }}>
                Attempt {pinAttempts} of {MAX_PIN_ATTEMPTS}
              </div>
            )}
            {pinError && <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 12 }}>{pinError}</div>}
            {pinLocked ? (
              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: 14 }}
                onClick={() => {
                  const newPin = genPin();
                  save(d => {
                    const o = d.orders.find(x => x.id === orderId);
                    if (o) {
                      o.restaurantStatus = 'pending_verification';
                      o.verificationPin = newPin;
                      o.pinExpiry = Date.now() + 10 * 60 * 1000;
                    }
                  });
                  setPinLocked(false); setPinAttempts(0); setPinError(''); setPinInput(''); setStep('qr');
                }}>
                Re-send QR to Customer
              </button>
            ) : (
              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: 14 }}
                onClick={handleVerifyPin} disabled={pinInput.length < 4}>
                Confirm & Send to Kitchen
              </button>
            )}
          </div>
        </div>
      )}

      {/* STEP: IN KITCHEN */}
      {step === 'kitchen' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 18 }}>Order in Kitchen</div>
              <div style={{ color: 'var(--text2)', fontSize: 13 }}>Live status from kitchen display</div>
            </div>
            {allServed && (
              <button className="btn btn-primary" onClick={() => setStep('payment')}>
                Collect Payment →
              </button>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {tableKots.map(kot => (
              <div key={kot.id} className="card" style={{ borderLeft: `4px solid ${KOT_STATUS_COLORS[kot.status]}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{kot.kitchenName}</div>
                    <div style={{ fontSize: 12, color: 'var(--text2)' }}>KOT #{kot.id.slice(-6)}</div>
                  </div>
                  <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: 'var(--bg3)', color: KOT_STATUS_COLORS[kot.status] }}>
                    {KOT_STATUS_LABELS[kot.status]}
                  </span>
                </div>
                {kot.items.map((item, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, paddingBottom: 4 }}>
                    <span>{item.qty}× {item.name}</span>
                    {item.note && <span style={{ color: 'var(--text2)', fontSize: 11 }}>{item.note}</span>}
                  </div>
                ))}
              </div>
            ))}
          </div>
          {allServed && (
            <div style={{ marginTop: 16, padding: '14px 18px', background: 'rgba(34,197,94,0.1)', border: '1px solid var(--green)', borderRadius: 10, color: 'var(--green)', fontWeight: 600 }}>
              🎉 All items ready! Proceed to payment.
            </div>
          )}
        </div>
      )}

      {/* STEP: PAYMENT */}
      {step === 'payment' && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
          <div className="card" style={{ maxWidth: 420, width: '100%' }}>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 16 }}>Collect Payment</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {lines.map(l => (
                <div key={l.productId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span>{l.qty}× {l.name}</span>
                  <span>{fmtCurrency(l.price * l.qty, settings.currency)}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text2)' }}>
                <span>{settings.taxLabel}</span><span>{fmtCurrency(tax, settings.currency)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 20, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                <span>Total</span>
                <span style={{ color: 'var(--accent)' }}>{fmtCurrency(total, settings.currency)}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              {['cash', 'card', 'wallet'].map(m => (
                <button key={m} className={`btn ${payMethod === m ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setPayMethod(m)} style={{ flex: 1 }}>
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>

            {payMethod === 'cash' && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Cash Received</label>
                <input className="inp" type="number" value={cash} onChange={e => setCash(e.target.value)}
                  placeholder={`${total}`} style={{ fontSize: 18 }} autoFocus />
                {parseFloat(cash) > 0 && (
                  <div style={{ marginTop: 8, fontSize: 14, color: 'var(--green)', fontWeight: 600 }}>
                    Change: {fmtCurrency(Math.max(0, parseFloat(cash) - total), settings.currency)}
                  </div>
                )}
              </div>
            )}

            <button className="btn btn-success" style={{ width: '100%', justifyContent: 'center', padding: 14, fontSize: 16 }}
              onClick={handlePayment}>
              Complete & Close Table
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
