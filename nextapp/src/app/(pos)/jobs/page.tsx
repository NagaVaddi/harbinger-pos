'use client';
import { useState } from 'react';
import { usePOS } from '@/lib/context';
import { Job } from '@/lib/types';
import { fmtCurrency, fmtDate, uid, now } from '@/lib/fmt';

const STATUS_COLORS: Record<string, string> = {
  open: 'badge-blue',
  in_progress: 'badge-yellow',
  ready: 'badge-green',
  closed: 'badge',
  cancelled: 'badge-red',
};

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  in_progress: 'In progress',
  ready: 'Ready',
  closed: 'Closed',
  cancelled: 'Cancelled',
};

function NewJobModal({ onSave, onClose }: { onSave: (j: Job) => void; onClose: () => void }) {
  const { db } = usePOS();
  const [form, setForm] = useState({ title: '', customerId: '', notes: '', estimate: '' });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="card" style={{ width: 480 }}>
        <h2 style={{ marginBottom: 20 }}>New job order</h2>
        <div style={{ display: 'grid', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Job title / description *</label>
            <input className="inp" value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Oil change + brake pads" />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Customer</label>
            <select className="inp" value={form.customerId} onChange={e => set('customerId', e.target.value)}>
              <option value="">Walk-in</option>
              {db.customers.filter(c => c.status === 'active').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Estimate ({db.settings.currency}, optional)</label>
            <input className="inp" type="number" min={0} step={0.01} value={form.estimate} onChange={e => set('estimate', e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Notes</label>
            <textarea className="inp" rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} style={{ resize: 'vertical' }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => {
            if (!form.title.trim()) return alert('Title required');
            onSave({ id: uid(), no: `JOB-${Date.now().toString(36).toUpperCase()}`, title: form.title, customerId: form.customerId || undefined, status: 'open', advances: [], estimate: form.estimate ? parseFloat(form.estimate) : undefined, ts: now(), notes: form.notes || undefined });
          }}>Create job</button>
        </div>
      </div>
    </div>
  );
}

export default function JobsPage() {
  const { db, save, settings } = usePOS();
  const [filter, setFilter] = useState<string>('all');
  const [showNew, setShowNew] = useState(false);

  const jobs = db.jobs.filter(j => filter === 'all' || j.status === filter);

  const handleSave = (j: Job) => {
    save(d => { d.jobs = [...d.jobs, j]; return d; });
    setShowNew(false);
  };

  const updateStatus = (id: string, status: Job['status']) => {
    save(d => { const j = d.jobs.find(x => x.id === id); if (j) j.status = status; return d; });
  };

  const STATUSES = ['all', 'open', 'in_progress', 'ready', 'closed', 'cancelled'];

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {STATUSES.map(s => (
            <button key={s} onClick={() => setFilter(s)} style={{
              padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500,
              background: filter === s ? 'var(--accent)' : 'var(--bg3)',
              color: filter === s ? '#fff' : 'var(--text2)',
            }}>
              {s === 'all' ? 'All' : STATUS_LABELS[s]}
            </button>
          ))}
        </div>
        <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={() => setShowNew(true)}>+ New job</button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Job #</th>
              <th>Title</th>
              <th>Customer</th>
              <th>Date</th>
              <th style={{ textAlign: 'right' }}>Estimate</th>
              <th style={{ textAlign: 'right' }}>Advances</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {jobs.map(j => {
              const customer = db.customers.find(c => c.id === j.customerId);
              const totalAdv = j.advances.reduce((s, a) => s + a.amount, 0);
              return (
                <tr key={j.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{j.no}</td>
                  <td style={{ fontWeight: 500 }}>{j.title}</td>
                  <td style={{ color: 'var(--text2)' }}>{customer?.name ?? 'Walk-in'}</td>
                  <td style={{ color: 'var(--text2)', fontSize: 12 }}>{fmtDate(j.ts)}</td>
                  <td style={{ textAlign: 'right' }}>{j.estimate != null ? fmtCurrency(j.estimate, settings.currency) : '—'}</td>
                  <td style={{ textAlign: 'right', color: totalAdv > 0 ? 'var(--green)' : 'var(--text2)' }}>
                    {totalAdv > 0 ? fmtCurrency(totalAdv, settings.currency) : '—'}
                  </td>
                  <td>
                    <span className={`badge ${STATUS_COLORS[j.status] ?? 'badge'}`}>{STATUS_LABELS[j.status]}</span>
                  </td>
                  <td>
                    <select style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', color: 'var(--text)', fontSize: 12, cursor: 'pointer' }}
                      value={j.status} onChange={e => updateStatus(j.id, e.target.value as Job['status'])}>
                      <option value="open">Open</option>
                      <option value="in_progress">In progress</option>
                      <option value="ready">Ready</option>
                      <option value="closed">Closed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </td>
                </tr>
              );
            })}
            {jobs.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text2)', padding: 40 }}>No jobs {filter !== 'all' ? `with status "${STATUS_LABELS[filter]}"` : 'yet'}</td></tr>}
          </tbody>
        </table>
      </div>

      {showNew && <NewJobModal onSave={handleSave} onClose={() => setShowNew(false)} />}
    </div>
  );
}
