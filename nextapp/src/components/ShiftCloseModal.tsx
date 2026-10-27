'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { usePOS } from '@/lib/context';
import type { Shift } from '@/lib/types';
import { closeShift } from '@/app/actions/shifts';
import { fmtCurrency } from '@/lib/fmt';

interface Props {
  shift: Shift;
}

export default function ShiftCloseModal({ shift }: Props) {
  const { db, save, setSession } = usePOS();
  const router = useRouter();
  const [actualCash, setActualCash] = useState('');
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  const currency = db.settings.currency;

  // ── Z-Report figures ─────────────────────────────────────
  const shiftStart = new Date(shift.openedAt);

  // Tally from local orders since shift opened
  const shiftOrders = db.orders.filter(o => {
    if (o.status !== 'paid') return false;
    return new Date(o.ts) >= shiftStart;
  });

  const cashSales   = shiftOrders.filter(o => o.method === 'cash').reduce((s, o) => s + o.total, 0);
  const cardSales   = shiftOrders.filter(o => o.method !== 'cash').reduce((s, o) => s + o.total, 0);
  const totalSales  = cashSales + cardSales;

  const expenses    = db.vouchers
    .filter(v => v.type === 'out' && new Date(v.ts) >= shiftStart)
    .reduce((s, v) => s + v.amount, 0);

  const expectedCash = shift.openingBalance + cashSales - expenses;

  const actual = parseFloat(actualCash) || 0;
  const variance = actual - expectedCash;

  // ── Handle Close ─────────────────────────────────────────
  const handleClose = () => {
    startTransition(async () => {
      // Update local store
      save(d => {
        const idx = d.shifts.findIndex(s => s.id === shift.id);
        if (idx >= 0) {
          d.shifts[idx] = {
            ...d.shifts[idx],
            status: 'closed',
            closedAt: new Date().toISOString(),
            cashSales,
            cardSales,
            totalSales,
            expenses,
            closingBalance: actual || expectedCash,
          };
        }
        return d;
      });

      // Try to persist to DB
      try { await closeShift(shift.id); } catch { /* offline — local already updated */ }

      setDone(true);

      // Log out and go to login
      setTimeout(() => {
        setSession(null);
        router.push('/login');
      }, 1800);
    });
  };

  const fmt = (n: number) => fmtCurrency(n, currency);

  const row = (label: string, value: string, bold?: boolean, accent?: boolean) => (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,.08)',
      fontSize: bold ? 15 : 13,
      fontWeight: bold ? 700 : 400,
      color: accent ? 'var(--green)' : 'inherit',
    }}>
      <span style={{ color: bold ? 'inherit' : 'rgba(255,255,255,.65)' }}>{label}</span>
      <span>{value}</span>
    </div>
  );

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(5, 10, 20, 0.97)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        width: '100%', maxWidth: 480,
        background: 'var(--bg2)', borderRadius: 16,
        border: '1px solid var(--border)',
        padding: '32px 28px',
        boxShadow: '0 24px 80px rgba(0,0,0,.6)',
      }}>
        {done ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✓</div>
            <h2 style={{ marginBottom: 8, color: 'var(--green)' }}>Shift Closed</h2>
            <p style={{ color: 'var(--text2)', fontSize: 13 }}>Logging out…</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>🔒</div>
              <h2 style={{ fontSize: 20, marginBottom: 4 }}>Business Hours Ended</h2>
              <p style={{ fontSize: 13, color: 'var(--text2)' }}>
                Your operating hours have passed. Please close the shift to lock the POS.
              </p>
            </div>

            {/* Z-Report */}
            <div style={{
              background: 'var(--bg3)', borderRadius: 10, padding: '16px 18px', marginBottom: 20,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1px', color: 'var(--text2)', marginBottom: 10 }}>
                Z-REPORT SUMMARY
              </div>
              {row('Opening Balance', fmt(shift.openingBalance))}
              {row('Cash Sales', fmt(cashSales))}
              {row('Card Sales', fmt(cardSales))}
              {row('Total Sales', fmt(totalSales), true)}
              {row('Expenses / Petty Cash Out', fmt(expenses))}
              {row('Expected Cash in Drawer', fmt(expectedCash), true, true)}
              <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text2)' }}>
                Orders in shift: {shiftOrders.length}
              </div>
            </div>

            {/* Actual cash input */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>
                Actual Cash in Drawer ({currency})
              </label>
              <input
                className="inp"
                type="number"
                min={0}
                step={0.01}
                placeholder={expectedCash.toFixed(2)}
                value={actualCash}
                onChange={e => setActualCash(e.target.value)}
                autoFocus
              />
              {actualCash !== '' && (
                <div style={{
                  marginTop: 6, fontSize: 12,
                  color: Math.abs(variance) < 1 ? 'var(--green)' : 'var(--red)',
                }}>
                  {variance >= 0 ? '+' : ''}{fmt(variance)} variance
                </div>
              )}
            </div>

            {/* Close button */}
            <button
              className="btn btn-primary"
              style={{ width: '100%', padding: '14px', fontSize: 15, justifyContent: 'center' }}
              onClick={handleClose}
              disabled={isPending}
            >
              {isPending ? 'Closing shift…' : '🔒 Close Shift & Lock POS'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
