'use client';
import { useState } from 'react';
import { usePOS } from '@/lib/context';
import { Shift } from '@/lib/types';
import { uid } from '@/lib/fmt';

function money(n: number, currency: string) {
  return `${currency} ${n.toFixed(2)}`;
}

function ZReport({ shift, currency, onClose }: { shift: Shift; currency: string; onClose: () => void }) {
  const expected = shift.openingBalance + shift.cashSales - shift.expenses;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" style={{ width: 400 }}>
        <h2 style={{ textAlign: 'center', marginBottom: 20 }}>Z-Report</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <tbody>
            {[
              ['Opening balance',     money(shift.openingBalance, currency)],
              ['Cash sales',          money(shift.cashSales, currency)],
              ['Card sales',          money(shift.cardSales, currency)],
              ['Total sales',         money(shift.totalSales, currency)],
              ['Expenses / cash out', money(shift.expenses, currency)],
            ].map(([label, val]) => (
              <tr key={label} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '8px 0', color: 'var(--text2)' }}>{label}</td>
                <td style={{ padding: '8px 0', textAlign: 'right' }}>{val}</td>
              </tr>
            ))}
            <tr>
              <td style={{ padding: '10px 0', fontWeight: 700 }}>Expected in drawer</td>
              <td style={{ padding: '10px 0', textAlign: 'right', fontWeight: 700, color: 'var(--accent)' }}>{money(expected, currency)}</td>
            </tr>
            {shift.closingBalance !== undefined && (
              <tr style={{ borderTop: '2px solid var(--border)' }}>
                <td style={{ padding: '10px 0' }}>Actual counted</td>
                <td style={{ padding: '10px 0', textAlign: 'right', color: shift.closingBalance >= expected ? 'var(--green)' : 'var(--red)' }}>
                  {money(shift.closingBalance, currency)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text2)', textAlign: 'center' }}>
          {new Date(shift.openedAt).toLocaleString()} – {shift.closedAt ? new Date(shift.closedAt).toLocaleString() : 'Open'}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 18, justifyContent: 'center' }}>
          <button className="btn btn-ghost" onClick={() => window.print()}>🖨️ Print</button>
          <button className="btn btn-primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default function ShiftsPage() {
  const { db, save, settings, session } = usePOS();
  const [openingBalance, setOpeningBalance] = useState(0);
  const [closingBalance, setClosingBalance] = useState(0);
  const [zReport, setZReport] = useState<Shift | null>(null);

  const openShift = db.shifts.find(s => s.status === 'open');

  const handleOpenShift = () => {
    if (openShift) return;
    const shift: Shift = {
      id: uid(),
      openedAt: new Date().toISOString(),
      openingBalance,
      cashSales: 0,
      cardSales: 0,
      totalSales: 0,
      expenses: 0,
      status: 'open',
      staffId: session?.staffId,
      staffName: session?.staffName,
    };
    save(d => { d.shifts.push(shift); return d; });
    setOpeningBalance(0);
  };

  const handleCloseShift = () => {
    if (!openShift) return;
    // Tally from orders placed during this shift
    const shiftOrders = db.orders.filter(o =>
      o.status === 'paid' &&
      new Date(o.ts) >= new Date(openShift.openedAt) &&
      (!openShift.closedAt || new Date(o.ts) <= new Date(openShift.closedAt))
    );
    const cashSales = shiftOrders.filter(o => o.method === 'Cash').reduce((s, o) => s + o.total, 0);
    const cardSales = shiftOrders.filter(o => o.method !== 'Cash').reduce((s, o) => s + o.total, 0);
    const totalSales = shiftOrders.reduce((s, o) => s + o.total, 0);
    const expenses = db.vouchers
      .filter(v => v.type === 'out' && new Date(v.ts) >= new Date(openShift.openedAt))
      .reduce((s, v) => s + v.amount, 0);

    const closed: Shift = {
      ...openShift,
      closedAt: new Date().toISOString(),
      cashSales, cardSales, totalSales, expenses,
      closingBalance,
      status: 'closed',
    };
    save(d => {
      const i = d.shifts.findIndex(s => s.id === openShift.id);
      if (i >= 0) d.shifts[i] = closed;
      return d;
    });
    setZReport(closed);
  };

  const pastShifts = [...db.shifts].filter(s => s.status === 'closed').reverse().slice(0, 10);

  return (
    <div style={{ maxWidth: 680 }}>
      <h1 style={{ marginBottom: 4 }}>Shift Management</h1>
      <p style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 24 }}>
        Open and close counter shifts. Closing a shift generates a Z-Report.
      </p>

      {/* Current Shift */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginBottom: 16 }}>Current Shift</h3>
        {openShift ? (
          <div>
            <div style={{ display: 'flex', gap: 20, marginBottom: 16, flexWrap: 'wrap' }}>
              {[
                ['Opened', new Date(openShift.openedAt).toLocaleString()],
                ['Opening balance', money(openShift.openingBalance, settings.currency)],
                ['Staff', openShift.staffName ?? '—'],
              ].map(([l, v]) => (
                <div key={l}>
                  <div style={{ fontSize: 12, color: 'var(--text2)' }}>{l}</div>
                  <div style={{ fontWeight: 600 }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>
                  Actual cash in drawer ({settings.currency})
                </label>
                <input className="inp" type="number" min={0} step={0.01}
                  value={closingBalance} onChange={e => setClosingBalance(parseFloat(e.target.value) || 0)}
                  style={{ width: 140 }} />
              </div>
              <button className="btn btn-danger" onClick={handleCloseShift}>
                Close Shift &amp; Print Z-Report
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>
                Opening float ({settings.currency})
              </label>
              <input className="inp" type="number" min={0} step={0.01}
                value={openingBalance} onChange={e => setOpeningBalance(parseFloat(e.target.value) || 0)}
                style={{ width: 140 }} />
            </div>
            <button className="btn btn-primary" onClick={handleOpenShift}>
              Open Shift
            </button>
          </div>
        )}
      </div>

      {/* Past Shifts */}
      {pastShifts.length > 0 && (
        <div className="card">
          <h3 style={{ marginBottom: 14 }}>Recent Shifts</h3>
          <table className="tbl" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Staff</th>
                <th style={{ textAlign: 'right' }}>Total Sales</th>
                <th style={{ textAlign: 'right' }}>Cash</th>
                <th style={{ textAlign: 'right' }}>Card</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pastShifts.map(s => (
                <tr key={s.id}>
                  <td style={{ fontSize: 12 }}>{new Date(s.openedAt).toLocaleDateString()}</td>
                  <td style={{ fontSize: 12, color: 'var(--text2)' }}>{s.staffName ?? '—'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{money(s.totalSales, settings.currency)}</td>
                  <td style={{ textAlign: 'right', fontSize: 12 }}>{money(s.cashSales, settings.currency)}</td>
                  <td style={{ textAlign: 'right', fontSize: 12 }}>{money(s.cardSales, settings.currency)}</td>
                  <td>
                    <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }}
                      onClick={() => setZReport(s)}>Z-Report</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {zReport && (
        <ZReport shift={zReport} currency={settings.currency} onClose={() => setZReport(null)} />
      )}
    </div>
  );
}
