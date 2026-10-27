'use client';
import { useState, useTransition } from 'react';
import { usePOS } from '@/lib/context';
import { useFeature } from '@/components/providers/FeatureProvider';
import { Customer, PipelineStage, CustomerInteraction } from '@/lib/types';
import { FeatureKey } from '@/lib/types';
import { fmtCurrency, fmtDate, uid, now } from '@/lib/fmt';

const STAGES: PipelineStage[] = ['Lead', 'Qualified', 'Proposal', 'Won', 'Lost'];
const STAGE_COLOR: Record<PipelineStage, string> = {
  Lead:      '#6366f1',
  Qualified: '#0ea5e9',
  Proposal:  '#f59e0b',
  Won:       '#10b981',
  Lost:      '#ef4444',
};

function InteractionModal({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const { save } = usePOS();
  const [type, setType] = useState<CustomerInteraction['type']>('note');
  const [note, setNote] = useState('');

  const handleSave = () => {
    if (!note.trim()) return;
    const entry: CustomerInteraction = { id: uid(), type, note, createdAt: now() };
    save(d => {
      const c = d.customers.find(x => x.id === customer.id);
      if (c) c.interactions = [entry, ...(c.interactions ?? [])];
      return d;
    });
    onClose();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="card" style={{ width: 440 }}>
        <h2 style={{ marginBottom: 16 }}>Log interaction — {customer.name}</h2>
        <div style={{ display: 'grid', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Type</label>
            <select className="inp" value={type} onChange={e => setType(e.target.value as any)}>
              <option value="note">Note</option>
              <option value="call">Call</option>
              <option value="email">Email</option>
              <option value="visit">Visit</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Note *</label>
            <textarea className="inp" rows={3} value={note} onChange={e => setNote(e.target.value)} style={{ resize: 'vertical' }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>Log interaction</button>
        </div>
      </div>
    </div>
  );
}

function CustomerModal({ customer, onSave, onClose }: { customer: Partial<Customer> | null; onSave: (c: Customer) => void; onClose: () => void }) {
  const crmEnabled = useFeature().isEnabled(FeatureKey.CRM_MODULE);
  const isNew = !customer?.id;
  const [form, setForm] = useState<Partial<Customer>>(customer ?? { status: 'active', registeredOn: now(), pipelineStage: 'Lead' });
  const set = (f: keyof Customer, v: unknown) => setForm(p => ({ ...p, [f]: v }));

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="card" style={{ width: 480 }}>
        <h2 style={{ marginBottom: 20 }}>{isNew ? 'New customer' : 'Edit customer'}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Name *</label>
            <input className="inp" value={form.name ?? ''} onChange={e => set('name', e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Phone</label>
            <input className="inp" value={form.phone ?? ''} onChange={e => set('phone', e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Email</label>
            <input className="inp" type="email" value={form.email ?? ''} onChange={e => set('email', e.target.value)} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Address</label>
            <input className="inp" value={form.address ?? ''} onChange={e => set('address', e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Credit limit</label>
            <input className="inp" type="number" min={0} value={form.creditLimit ?? ''} onChange={e => set('creditLimit', parseFloat(e.target.value) || undefined)} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Status</label>
            <select className="inp" value={form.status ?? 'active'} onChange={e => set('status', e.target.value as any)}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          {crmEnabled && (
            <div>
              <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Pipeline stage</label>
              <select className="inp" value={form.pipelineStage ?? 'Lead'} onChange={e => set('pipelineStage', e.target.value as PipelineStage)}>
                {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => {
            if (!form.name?.trim()) return alert('Name required');
            onSave({
              id: form.id ?? uid(), name: form.name!, phone: form.phone, email: form.email,
              address: form.address, creditLimit: form.creditLimit, balance: form.balance ?? 0,
              registeredOn: form.registeredOn ?? now(), status: form.status ?? 'active',
              pipelineStage: form.pipelineStage, interactions: form.interactions,
            });
          }}>{isNew ? 'Add customer' : 'Save changes'}</button>
        </div>
      </div>
    </div>
  );
}

function KanbanColumn({ stage, customers, onDrop, onInteraction }: {
  stage: PipelineStage;
  customers: Customer[];
  onDrop: (customerId: string, stage: PipelineStage) => void;
  onInteraction: (c: Customer) => void;
}) {
  const [over, setOver] = useState(false);

  return (
    <div
      style={{
        flex: 1, minWidth: 180, background: over ? 'var(--bg3)' : 'var(--bg2)',
        borderRadius: 10, border: `2px solid ${over ? STAGE_COLOR[stage] : 'var(--border)'}`,
        padding: 12, transition: 'all .15s',
      }}
      onDragOver={e => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={e => { e.preventDefault(); setOver(false); const id = e.dataTransfer.getData('customerId'); onDrop(id, stage); }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: STAGE_COLOR[stage], flexShrink: 0 }} />
        <span style={{ fontWeight: 600, fontSize: 13 }}>{stage}</span>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text2)', background: 'var(--bg3)', padding: '1px 6px', borderRadius: 99 }}>{customers.length}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {customers.map(c => (
          <div
            key={c.id}
            draggable
            onDragStart={e => e.dataTransfer.setData('customerId', c.id)}
            style={{ background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)', padding: 10, cursor: 'grab' }}
          >
            <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 2 }}>{c.name}</div>
            {c.phone && <div style={{ fontSize: 11, color: 'var(--text2)' }}>{c.phone}</div>}
            {c.lifetimeValue ? <div style={{ fontSize: 11, color: 'var(--green)', marginTop: 4 }}>LTV {c.lifetimeValue?.toFixed(0)}</div> : null}
            <button
              style={{ marginTop: 6, fontSize: 11, padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--text2)' }}
              onClick={() => onInteraction(c)}
            >+ Log interaction</button>
          </div>
        ))}
        {customers.length === 0 && <div style={{ fontSize: 12, color: 'var(--text2)', textAlign: 'center', paddingTop: 8 }}>Drop here</div>}
      </div>
    </div>
  );
}

export default function CustomersPage() {
  const { db, save, settings } = usePOS();
  const { isEnabled } = useFeature();
  const crmEnabled = isEnabled(FeatureKey.CRM_MODULE);

  const [view, setView] = useState<'list' | 'kanban'>('list');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Partial<Customer> | null | false>(false);
  const [interacting, setInteracting] = useState<Customer | null>(null);
  const [, startTransition] = useTransition();

  const customers = db.customers.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search)
  );

  const handleSave = (c: Customer) => {
    save(d => {
      const idx = d.customers.findIndex(x => x.id === c.id);
      if (idx >= 0) d.customers[idx] = c; else d.customers = [...d.customers, c];
      return d;
    });
    setEditing(false);
  };

  const handleDrop = (customerId: string, stage: PipelineStage) => {
    save(d => {
      const c = d.customers.find(x => x.id === customerId);
      if (c) c.pipelineStage = stage;
      return d;
    });
    startTransition(async () => {
      try {
        const { updateCustomerStage } = await import('@/app/actions/crm');
        await updateCustomerStage(customerId, stage);
      } catch { /* local mode */ }
    });
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <input className="inp" style={{ maxWidth: 280 }} placeholder="Search customers…" value={search} onChange={e => setSearch(e.target.value)} />
        {crmEnabled && (
          <div style={{ display: 'flex', background: 'var(--bg3)', borderRadius: 8, padding: 2 }}>
            {(['list', 'kanban'] as const).map(v => (
              <button key={v} onClick={() => setView(v)} style={{
                padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500,
                background: view === v ? 'var(--accent)' : 'transparent',
                color: view === v ? '#fff' : 'var(--text2)',
              }}>{v === 'list' ? '☰ List' : '⊞ Kanban'}</button>
            ))}
          </div>
        )}
        <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={() => setEditing({})}>+ New customer</button>
      </div>

      {/* ── Kanban view ─────────────────────────────────────── */}
      {crmEnabled && view === 'kanban' && (
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
          {STAGES.map(stage => (
            <KanbanColumn
              key={stage}
              stage={stage}
              customers={db.customers.filter(c => (c.pipelineStage ?? 'Lead') === stage)}
              onDrop={handleDrop}
              onInteraction={c => setInteracting(c)}
            />
          ))}
        </div>
      )}

      {/* ── List view ────────────────────────────────────────── */}
      {view === 'list' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Phone</th>
                <th>Email</th>
                {crmEnabled && <th>Pipeline</th>}
                <th style={{ textAlign: 'right' }}>Credit limit</th>
                <th style={{ textAlign: 'right' }}>Balance</th>
                <th>Registered</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {customers.map(c => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 500 }}>{c.name}</td>
                  <td style={{ color: 'var(--text2)' }}>{c.phone ?? '—'}</td>
                  <td style={{ color: 'var(--text2)', fontSize: 12 }}>{c.email ?? '—'}</td>
                  {crmEnabled && (
                    <td>
                      <span style={{
                        fontSize: 11, padding: '2px 8px', borderRadius: 99, fontWeight: 600,
                        background: `${STAGE_COLOR[c.pipelineStage ?? 'Lead']}20`,
                        color: STAGE_COLOR[c.pipelineStage ?? 'Lead'],
                      }}>{c.pipelineStage ?? 'Lead'}</span>
                    </td>
                  )}
                  <td style={{ textAlign: 'right' }}>{c.creditLimit != null ? fmtCurrency(c.creditLimit, settings.currency) : '—'}</td>
                  <td style={{ textAlign: 'right', color: (c.balance ?? 0) > 0 ? 'var(--red)' : 'inherit' }}>
                    {fmtCurrency(c.balance ?? 0, settings.currency)}
                  </td>
                  <td style={{ color: 'var(--text2)', fontSize: 12 }}>{fmtDate(c.registeredOn)}</td>
                  <td><span className={`badge ${c.status === 'active' ? 'badge-green' : 'badge-red'}`}>{c.status}</span></td>
                  <td style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setEditing(c)}>Edit</button>
                    {crmEnabled && <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setInteracting(c)}>Log</button>}
                  </td>
                </tr>
              ))}
              {customers.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--text2)', padding: 40 }}>
                  {db.customers.length === 0 ? 'No customers yet' : 'No results'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {editing !== false && <CustomerModal customer={editing} onSave={handleSave} onClose={() => setEditing(false)} />}
      {interacting && <InteractionModal customer={interacting} onClose={() => setInteracting(null)} />}
    </div>
  );
}
