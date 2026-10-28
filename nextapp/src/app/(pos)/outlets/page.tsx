'use client';
import { useState, useMemo } from 'react';
import { usePOS } from '@/lib/context';
import { fmtCurrency, uid, now } from '@/lib/fmt';

type Tab = 'registers' | 'sessions' | 'cashvouchers';

interface Register {
  id: string;
  name: string;
  username: string;
  staff: string;
  status: 'open' | 'closed';
  currentShift?: string;
  createdAt: string;
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'registers',    label: 'Registers' },
  { id: 'sessions',     label: 'Sessions & Z-reports' },
  { id: 'cashvouchers', label: 'Cash vouchers' },
];

export default function OutletsPage() {
  const { db, settings, save } = usePOS();
  const cur = settings.currency;
  const fmt = (v: number) => fmtCurrency(v, cur);

  const [tab, setTab] = useState<Tab>('registers');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', username: '', staff: '' });
  const [editId, setEditId] = useState<string | null>(null);

  const registers: Register[] = (db as any).registers ?? [];
  const sessions: any[] = (db as any).shifts ?? [];
  const cashVouchers: any[] = (db as any).cashVouchers ?? [];

  const paidOrders = db.orders.filter(o => o.status === 'paid');
  const totalSales = paidOrders.reduce((s, o) => s + o.total, 0);

  const sessionRows = useMemo(() => {
    return sessions.slice().reverse().map(s => ({
      ...s,
      sales: paidOrders.filter(o => {
        const opened = new Date(s.startTime || s.createdAt).getTime();
        const closed = s.endTime ? new Date(s.endTime).getTime() : Date.now();
        const ts = new Date(o.ts).getTime();
        return ts >= opened && ts <= closed;
      }).reduce((sum, o) => sum + o.total, 0),
    }));
  }, [sessions, paidOrders]);

  const handleSave = () => {
    if (!form.name.trim()) return alert('Register name required');
    if (editId) {
      save((d: any) => {
        const r = (d.registers ?? []).find((x: any) => x.id === editId);
        if (r) Object.assign(r, { name: form.name, username: form.username, staff: form.staff });
        return d;
      });
    } else {
      save((d: any) => {
        d.registers = [...(d.registers ?? []), { id: uid(), name: form.name, username: form.username, staff: form.staff, status: 'closed', createdAt: now() }];
        return d;
      });
    }
    setForm({ name: '', username: '', staff: '' });
    setShowForm(false);
    setEditId(null);
  };

  const deleteRegister = (id: string) => {
    if (!confirm('Delete this register?')) return;
    save((d: any) => { d.registers = (d.registers ?? []).filter((x: any) => x.id !== id); return d; });
  };

  const openEdit = (r: Register) => {
    setForm({ name: r.name, username: r.username ?? '', staff: r.staff ?? '' });
    setEditId(r.id);
    setShowForm(true);
  };

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Outlets &amp; Registers</h1>
      <p style={{ color: 'var(--text2)', fontSize: 14, marginBottom: 16 }}>Manage counters, shifts and cash movements</p>

      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--border)' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '8px 16px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: tab === t.id ? 700 : 400,
            background: 'transparent', color: tab === t.id ? 'var(--accent)' : 'var(--text2)',
            borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── REGISTERS ─────────────────────────────────────────────── */}
      {tab === 'registers' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button className="btn btn-primary" onClick={() => { setForm({ name: '', username: '', staff: '' }); setEditId(null); setShowForm(true); }}>+ Add register</button>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="tbl">
              <thead><tr><th>Register name</th><th>Username</th><th>Staff</th><th>Active session</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {registers.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600 }}>{r.name}</td>
                    <td style={{ color: 'var(--text2)', fontFamily: 'monospace', fontSize: 12 }}>{r.username || '—'}</td>
                    <td>{r.staff || '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--text2)' }}>{r.currentShift ? `Open since ${r.currentShift}` : '—'}</td>
                    <td><span className={`badge badge-${r.status === 'open' ? 'green' : 'red'}`} style={{ textTransform: 'capitalize' }}>{r.status}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn" style={{ fontSize: 12, padding: '3px 10px' }} onClick={() => openEdit(r)}>Edit</button>
                        <button className="btn" style={{ fontSize: 12, padding: '3px 10px', color: 'var(--red)', borderColor: 'var(--red)' }} onClick={() => deleteRegister(r.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {registers.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text2)', padding: 40 }}>No registers yet. Add one to track your counters.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── SESSIONS & Z-REPORTS ──────────────────────────────────── */}
      {tab === 'sessions' && (
        <div>
          <div className="kpi-grid" style={{ marginBottom: 20 }}>
            <div className="kpi"><div className="kpi-label">Total sessions</div><div className="kpi-value">{sessions.length}</div></div>
            <div className="kpi"><div className="kpi-label">All-time sales</div><div className="kpi-value">{fmt(totalSales)}</div></div>
            <div className="kpi"><div className="kpi-label">Total orders</div><div className="kpi-value">{paidOrders.length}</div></div>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="tbl">
              <thead><tr><th>#</th><th>Opened</th><th>Closed</th><th>Staff</th><th style={{ textAlign: 'right' }}>Sales</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {sessionRows.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text2)', padding: 40 }}>No sessions recorded yet</td></tr>
                ) : sessionRows.map((s, i) => (
                  <tr key={s.id ?? i}>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>#{String(sessions.length - i).padStart(4, '0')}</td>
                    <td style={{ fontSize: 12, color: 'var(--text2)' }}>{s.startTime ? new Date(s.startTime).toLocaleString() : s.createdAt ? new Date(s.createdAt).toLocaleString() : '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--text2)' }}>{s.endTime ? new Date(s.endTime).toLocaleString() : '—'}</td>
                    <td>{s.staffName ?? '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(s.sales ?? 0)}</td>
                    <td><span className={`badge badge-${s.endTime ? 'red' : 'green'}`}>{s.endTime ? 'Closed' : 'Open'}</span></td>
                    <td>
                      <button className="btn" style={{ fontSize: 12, padding: '3px 10px' }} onClick={() => {
                        const rows = [['Z-Report'], ['Session'], [s.startTime ?? s.createdAt ?? ''], ['Closed', s.endTime ?? 'Still open'], ['Sales', fmt(s.sales ?? 0)], ['Orders', String(paidOrders.length)]];
                        const csv = rows.map(r => r.join(',')).join('\n');
                        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `z-report-${i + 1}.csv`; a.click();
                      }}>Z-Report</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── CASH VOUCHERS ─────────────────────────────────────────── */}
      {tab === 'cashvouchers' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, alignItems: 'center' }}>
            <span style={{ fontSize: 14, color: 'var(--text2)' }}>Record cash in / cash out movements</span>
            <button className="btn btn-primary" onClick={() => {
              const amount = prompt('Amount (positive = cash in, negative = cash out):');
              const note = prompt('Note / reason:') ?? '';
              if (!amount || isNaN(parseFloat(amount))) return;
              save((d: any) => {
                d.cashVouchers = [...(d.cashVouchers ?? []), { id: uid(), amount: parseFloat(amount), note, createdAt: now() }];
                return d;
              });
            }}>+ Cash voucher</button>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="tbl">
              <thead><tr><th>Date</th><th>Note</th><th style={{ textAlign: 'right' }}>Amount</th><th>Type</th></tr></thead>
              <tbody>
                {cashVouchers.slice().reverse().map(v => (
                  <tr key={v.id}>
                    <td style={{ fontSize: 12, color: 'var(--text2)' }}>{new Date(v.createdAt).toLocaleString()}</td>
                    <td>{v.note || '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: v.amount >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(Math.abs(v.amount))}</td>
                    <td><span className={`badge badge-${v.amount >= 0 ? 'green' : 'red'}`}>{v.amount >= 0 ? 'Cash in' : 'Cash out'}</span></td>
                  </tr>
                ))}
                {cashVouchers.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text2)', padding: 40 }}>No cash vouchers yet</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit register modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
          onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="card" style={{ width: 420 }}>
            <h3 style={{ fontWeight: 700, marginBottom: 16 }}>{editId ? 'Edit register' : 'Add register'}</h3>
            {[
              { label: 'Register name *', key: 'name', placeholder: 'e.g. Counter 1' },
              { label: 'Username', key: 'username', placeholder: 'Login username' },
              { label: 'Staff name', key: 'staff', placeholder: 'Assigned staff member' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>{f.label}</label>
                <input className="inp" value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} />
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
