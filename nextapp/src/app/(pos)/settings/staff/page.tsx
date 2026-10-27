'use client';
import { useState, useEffect, useTransition } from 'react';
import { getStaffList, createStaff, updateStaff, toggleStaffActive, deleteStaff } from '@/app/actions/settings';

type StaffRow = { id: string; staffId: string; name: string; role: string; active: boolean; createdAt: Date };
type Mode = 'add' | 'edit';

const ROLES = ['admin', 'manager', 'waiter', 'kitchen', 'cashier'];

const EMPTY_FORM = { staffId: '', name: '', role: 'waiter', password: '' };

export default function StaffPage() {
  const [list, setList] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<{ mode: Mode; row?: StaffRow } | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isPending, startTransition] = useTransition();

  const load = () => {
    setLoading(true);
    getStaffList().then(rows => { setList(rows); setLoading(false); }).catch(e => { setError(e.message); setLoading(false); });
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => { setForm(EMPTY_FORM); setModal({ mode: 'add' }); };
  const openEdit = (row: StaffRow) => { setForm({ staffId: row.staffId, name: row.name, role: row.role, password: '' }); setModal({ mode: 'edit', row }); };
  const closeModal = () => setModal(null);

  const handleSave = () => {
    startTransition(async () => {
      try {
        if (modal?.mode === 'add') {
          if (!form.staffId || !form.name || !form.password) { setError('Staff ID, name and password are required'); return; }
          await createStaff(form);
        } else if (modal?.row) {
          const upd: { name?: string; role?: string; password?: string } = { name: form.name, role: form.role };
          if (form.password) upd.password = form.password;
          await updateStaff(modal.row.id, upd);
        }
        closeModal();
        load();
        setError('');
      } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Error'); }
    });
  };

  const handleToggle = (row: StaffRow) => {
    startTransition(async () => {
      try { await toggleStaffActive(row.id, !row.active); load(); } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Error'); }
    });
  };

  const handleDelete = (row: StaffRow) => {
    if (!confirm(`Delete ${row.name}? This cannot be undone.`)) return;
    startTransition(async () => {
      try { await deleteStaff(row.id); load(); } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Error'); }
    });
  };

  const roleBadge = (r: string) => {
    const colours: Record<string, string> = { admin: '#6366f1', manager: '#8b5cf6', waiter: '#0ea5e9', kitchen: '#f59e0b', cashier: '#10b981' };
    return <span style={{ background: colours[r] ?? '#64748b', color: '#fff', borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>{r}</span>;
  };

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0 }}>Staff</h1>
          <p style={{ color: 'var(--text2)', fontSize: 13, margin: '4px 0 0' }}>Manage who can log in and their roles</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Staff</button>
      </div>

      {error && <div style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 8, padding: '10px 14px', color: 'var(--red)', fontSize: 13, marginBottom: 16 }}>{error}</div>}

      {loading ? (
        <p style={{ color: 'var(--text2)' }}>Loading…</p>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg2)' }}>
                {['Staff ID', 'Name', 'Role', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((row, i) => (
                <tr key={row.id} style={{ borderBottom: i < list.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <td style={{ padding: '10px 14px', fontSize: 13, fontFamily: 'monospace', color: 'var(--text2)' }}>{row.staffId}</td>
                  <td style={{ padding: '10px 14px', fontSize: 14, fontWeight: 500 }}>{row.name}</td>
                  <td style={{ padding: '10px 14px' }}>{roleBadge(row.role)}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ color: row.active ? 'var(--green)' : 'var(--red)', fontSize: 13, fontWeight: 500 }}>
                      {row.active ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => openEdit(row)}>Edit</button>
                      <button className="btn" style={{ padding: '4px 10px', fontSize: 12, color: row.active ? 'var(--red)' : 'var(--green)' }} onClick={() => handleToggle(row)} disabled={isPending}>
                        {row.active ? 'Disable' : 'Enable'}
                      </button>
                      <button className="btn" style={{ padding: '4px 10px', fontSize: 12, color: 'var(--red)' }} onClick={() => handleDelete(row)} disabled={isPending}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: 'var(--text2)', fontSize: 13 }}>No staff yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="card" style={{ width: 400, padding: 24 }}>
            <h2 style={{ margin: '0 0 20px' }}>{modal.mode === 'add' ? 'Add Staff' : 'Edit Staff'}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {modal.mode === 'add' && (
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Staff ID *</label>
                  <input className="inp" value={form.staffId} onChange={e => setForm(f => ({ ...f, staffId: e.target.value.toUpperCase() }))} placeholder="EMP001" />
                </div>
              )}
              <div>
                <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Full Name *</label>
                <input className="inp" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="John Smith" />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Role *</label>
                <select className="inp" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                  {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>
                  {modal.mode === 'add' ? 'Password *' : 'New Password (leave blank to keep current)'}
                </label>
                <input className="inp" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="••••••••" />
              </div>
            </div>
            {error && <p style={{ color: 'var(--red)', fontSize: 13, marginTop: 12 }}>{error}</p>}
            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button className="btn" onClick={closeModal}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={isPending}>{isPending ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
