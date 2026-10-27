'use client';
import { useState, useTransition } from 'react';
import { usePOS } from '@/lib/context';
import { useFeature } from '@/components/providers/FeatureProvider';
import { Employee, EmployeeRole, ClockEntry } from '@/lib/types';
import { FeatureKey } from '@/lib/types';
import { uid, now, fmtDateTime } from '@/lib/fmt';

const ROLES: EmployeeRole[] = ['manager', 'cashier', 'waiter', 'kitchen', 'driver', 'other'];

function EmployeeModal({ emp, onSave, onClose }: {
  emp: Partial<Employee> | null;
  onSave: (e: Employee) => void;
  onClose: () => void;
}) {
  const isNew = !emp?.id;
  const [form, setForm] = useState<Partial<Employee>>(emp ?? { active: true, role: 'cashier', hourlyRate: 0 });
  const set = (k: keyof Employee, v: unknown) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="card" style={{ width: 480 }}>
        <h2 style={{ marginBottom: 20 }}>{isNew ? 'New employee' : 'Edit employee'}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Name *</label>
            <input className="inp" value={form.name ?? ''} onChange={e => set('name', e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Role</label>
            <select className="inp" value={form.role ?? 'cashier'} onChange={e => set('role', e.target.value as EmployeeRole)}>
              {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Hourly rate</label>
            <input className="inp" type="number" min={0} step={0.5} value={form.hourlyRate ?? 0} onChange={e => set('hourlyRate', parseFloat(e.target.value) || 0)} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Phone</label>
            <input className="inp" value={form.phone ?? ''} onChange={e => set('phone', e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Email</label>
            <input className="inp" type="email" value={form.email ?? ''} onChange={e => set('email', e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Status</label>
            <select className="inp" value={form.active ? 'active' : 'inactive'} onChange={e => set('active', e.target.value === 'active')}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => {
            if (!form.name?.trim()) return alert('Name required');
            onSave({
              id: form.id ?? uid(), name: form.name!, role: form.role ?? 'cashier',
              phone: form.phone, email: form.email, hourlyRate: form.hourlyRate ?? 0,
              active: form.active ?? true, clockLog: form.clockLog ?? [],
            });
          }}>{isNew ? 'Add employee' : 'Save changes'}</button>
        </div>
      </div>
    </div>
  );
}

function clockStatus(log: ClockEntry[]): 'in' | 'out' {
  if (!log.length) return 'out';
  return log[log.length - 1].type === 'in' ? 'in' : 'out';
}

function lastClockTs(log: ClockEntry[]): string | null {
  return log.length ? log[log.length - 1].ts : null;
}

function todayHours(log: ClockEntry[]): number {
  const today = new Date().toDateString();
  let total = 0;
  for (let i = 0; i < log.length; i++) {
    if (log[i].type === 'in' && log[i + 1]?.type === 'out') {
      const inTs = new Date(log[i].ts);
      const outTs = new Date(log[i + 1].ts);
      if (inTs.toDateString() === today || outTs.toDateString() === today) {
        total += (outTs.getTime() - inTs.getTime()) / 3_600_000;
      }
      i++;
    } else if (log[i].type === 'in' && i === log.length - 1) {
      // currently clocked in — count time so far
      if (new Date(log[i].ts).toDateString() === today) {
        total += (Date.now() - new Date(log[i].ts).getTime()) / 3_600_000;
      }
    }
  }
  return Math.round(total * 10) / 10;
}

export default function HCMPage() {
  const { db, save } = usePOS();
  const { isEnabled } = useFeature();
  const hcmEnabled = isEnabled(FeatureKey.HCM_MODULE);

  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Partial<Employee> | null | false>(false);
  const [, startTransition] = useTransition();

  if (!hcmEnabled) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 80, color: 'var(--text2)' }}>
        <div style={{ fontSize: 40 }}>👥</div>
        <h2>HCM module is not enabled</h2>
        <p style={{ fontSize: 14 }}>Enable the <strong>HCM Module</strong> feature flag in Settings → Features to use this section.</p>
      </div>
    );
  }

  const employees = db.employees.filter(e =>
    !search || e.name.toLowerCase().includes(search.toLowerCase()) || e.role.includes(search.toLowerCase())
  );

  const handleSave = (e: Employee) => {
    save(d => {
      const idx = d.employees.findIndex(x => x.id === e.id);
      if (idx >= 0) d.employees[idx] = e; else d.employees = [...d.employees, e];
      return d;
    });
    setEditing(false);
  };

  const handleClock = (empId: string) => {
    save(d => {
      const emp = d.employees.find(x => x.id === empId);
      if (!emp) return d;
      const log = emp.clockLog ?? [];
      const newType: 'in' | 'out' = (!log.length || log[log.length - 1].type === 'out') ? 'in' : 'out';
      emp.clockLog = [...log, { type: newType, ts: now() }];
      return d;
    });
    startTransition(async () => {
      try {
        const { clockInOut } = await import('@/app/actions/hcm');
        await clockInOut(empId);
      } catch { /* local mode */ }
    });
  };

  const activeCount = db.employees.filter(e => e.active && clockStatus(e.clockLog ?? []) === 'in').length;

  return (
    <div>
      {/* ── Summary cards ───────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        {[
          { label: 'Total employees', value: db.employees.filter(e => e.active).length },
          { label: 'Clocked in now', value: activeCount },
          { label: 'Roles', value: [...new Set(db.employees.map(e => e.role))].length },
        ].map(s => (
          <div key={s.label} className="card" style={{ flex: 1, minWidth: 140, padding: '16px 20px' }}>
            <div style={{ fontSize: 26, fontWeight: 700 }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Toolbar ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
        <input className="inp" style={{ maxWidth: 280 }} placeholder="Search employees…" value={search} onChange={e => setSearch(e.target.value)} />
        <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={() => setEditing({})}>+ New employee</button>
      </div>

      {/* ── Employee grid ────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
        {employees.map(emp => {
          const log = emp.clockLog ?? [];
          const status = clockStatus(log);
          const lastTs = lastClockTs(log);
          const hrs = todayHours(log);

          return (
            <div key={emp.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                  background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: 16, color: '#fff',
                }}>{emp.name.charAt(0).toUpperCase()}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{emp.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', textTransform: 'capitalize' }}>{emp.role}</div>
                </div>
                <div style={{
                  fontSize: 11, padding: '3px 8px', borderRadius: 99, fontWeight: 600,
                  background: status === 'in' ? '#10b98120' : 'var(--bg3)',
                  color: status === 'in' ? '#10b981' : 'var(--text2)',
                }}>{status === 'in' ? '● In' : '○ Out'}</div>
              </div>

              <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text2)' }}>
                <span>Rate: {emp.hourlyRate}/hr</span>
                {emp.phone && <span>{emp.phone}</span>}
              </div>

              {lastTs && (
                <div style={{ fontSize: 11, color: 'var(--text2)' }}>
                  Last {status === 'in' ? 'clocked in' : 'clocked out'}: {fmtDateTime(lastTs)}
                </div>
              )}

              {hrs > 0 && (
                <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 500 }}>
                  Today: {hrs.toFixed(1)} hrs
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button
                  className={`btn ${status === 'out' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ flex: 1, fontSize: 12 }}
                  onClick={() => handleClock(emp.id)}
                >
                  {status === 'out' ? 'Clock In' : 'Clock Out'}
                </button>
                <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => setEditing(emp)}>Edit</button>
              </div>
            </div>
          );
        })}

        {employees.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--text2)', padding: 60 }}>
            {db.employees.length === 0 ? (
              <>
                <div style={{ fontSize: 36, marginBottom: 12 }}>👥</div>
                <div>No employees yet. Add your first team member to get started.</div>
              </>
            ) : 'No results for that search.'}
          </div>
        )}
      </div>

      {editing !== false && <EmployeeModal emp={editing} onSave={handleSave} onClose={() => setEditing(false)} />}
    </div>
  );
}
