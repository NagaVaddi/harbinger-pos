'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePOS } from '@/lib/context';

type LoginTab = 'admin' | 'waiter' | 'kitchen';

export default function LoginPage() {
  const router = useRouter();
  const { db, setSession } = usePOS();
  const [tab, setTab] = useState<LoginTab>('admin');

  // Admin
  const [email, setEmail] = useState('');
  const [adminPw, setAdminPw] = useState('');

  // Waiter
  const [waiterStaffId, setWaiterStaffId] = useState('');
  const [waiterPw, setWaiterPw] = useState('');

  // Kitchen
  const [kitchenStaffId, setKitchenStaffId] = useState('');
  const [kitchenPw, setKitchenPw] = useState('');
  const [kitchenSection, setKitchenSection] = useState('');

  const [error, setError] = useState('');

  const activeKitchens = db.kitchens.filter(k => k.active);

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !adminPw) { setError('Enter email and password'); return; }

    // Check staff with admin role by email match (staffId field used as email for admin)
    const staff = db.staff.find(s => s.role === 'admin' && s.active && s.staffId === email);
    if (staff) {
      if (staff.password !== adminPw) { setError('Wrong password'); return; }
      setSession({ staffId: staff.staffId, staffName: staff.name, role: 'admin' });
    } else {
      // Demo: allow any non-empty admin login
      setSession({ staffId: email, staffName: 'Admin', role: 'admin' });
    }
    router.push('/dashboard');
  };

  const handleWaiterLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!waiterStaffId || !waiterPw) { setError('Enter Staff ID and password'); return; }

    const staff = db.staff.find(s => s.role === 'waiter' && s.active && s.staffId === waiterStaffId);
    if (staff) {
      if (staff.password !== waiterPw) { setError('Wrong password'); return; }
      setSession({ staffId: staff.staffId, staffName: staff.name, role: 'waiter' });
    } else {
      // Demo: allow if no staff configured
      if (db.staff.filter(s => s.role === 'waiter').length > 0) {
        setError('Staff ID not found');
        return;
      }
      setSession({ staffId: waiterStaffId, staffName: `Waiter ${waiterStaffId}`, role: 'waiter' });
    }
    router.push('/restaurant');
  };

  const handleKitchenLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!kitchenStaffId || !kitchenPw) { setError('Enter Staff ID and password'); return; }
    if (!kitchenSection) { setError('Select your kitchen section'); return; }

    const staff = db.staff.find(s => s.role === 'kitchen' && s.active && s.staffId === kitchenStaffId);
    const kitchen = db.kitchens.find(k => k.id === kitchenSection);
    if (staff) {
      if (staff.password !== kitchenPw) { setError('Wrong password'); return; }
      setSession({
        staffId: staff.staffId, staffName: staff.name, role: 'kitchen',
        kitchenId: kitchenSection, kitchenName: kitchen?.name,
      });
    } else {
      if (db.staff.filter(s => s.role === 'kitchen').length > 0) {
        setError('Staff ID not found');
        return;
      }
      setSession({
        staffId: kitchenStaffId, staffName: `Kitchen ${kitchenStaffId}`, role: 'kitchen',
        kitchenId: kitchenSection, kitchenName: kitchen?.name,
      });
    }
    router.push('/restaurant/kds');
  };

  const tabs: { key: LoginTab; label: string; icon: string }[] = [
    { key: 'admin', label: 'Admin', icon: '🔐' },
    { key: 'waiter', label: 'Waiter', icon: '🍽️' },
    { key: 'kitchen', label: 'Kitchen', icon: '👨‍🍳' },
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div className="card" style={{ width: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent)', marginBottom: 4 }}>⚡ Harbinger</div>
          <div style={{ color: 'var(--text2)', fontSize: 13 }}>Select your role to sign in</div>
        </div>

        {/* Role tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 24 }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => { setTab(t.key); setError(''); }} style={{
              flex: 1, padding: '10px 0', border: 'none', background: 'none', cursor: 'pointer',
              color: tab === t.key ? 'var(--text)' : 'var(--text2)',
              fontWeight: tab === t.key ? 700 : 400, fontSize: 13,
              borderBottom: tab === t.key ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: -1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            }}>
              <span style={{ fontSize: 20 }}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* Admin Login */}
        {tab === 'admin' && (
          <form onSubmit={handleAdminLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Email / Admin ID</label>
              <input className="inp" type="text" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="admin@business.com" autoFocus />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Password</label>
              <input className="inp" type="password" value={adminPw} onChange={e => setAdminPw(e.target.value)} placeholder="••••••••" />
            </div>
            {error && <div style={{ color: 'var(--red)', fontSize: 13 }}>{error}</div>}
            <button type="submit" className="btn btn-primary" style={{ justifyContent: 'center', padding: '12px', marginTop: 4, fontSize: 15 }}>
              Sign in as Admin
            </button>
          </form>
        )}

        {/* Waiter Login */}
        {tab === 'waiter' && (
          <form onSubmit={handleWaiterLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Staff ID</label>
              <input className="inp" value={waiterStaffId} onChange={e => setWaiterStaffId(e.target.value)}
                placeholder="e.g. W001" autoFocus />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Password</label>
              <input className="inp" type="password" value={waiterPw} onChange={e => setWaiterPw(e.target.value)} placeholder="••••••••" />
            </div>
            {error && <div style={{ color: 'var(--red)', fontSize: 13 }}>{error}</div>}
            <button type="submit" className="btn btn-primary" style={{ justifyContent: 'center', padding: '12px', marginTop: 4, fontSize: 15 }}>
              Sign in as Waiter
            </button>
          </form>
        )}

        {/* Kitchen Login */}
        {tab === 'kitchen' && (
          <form onSubmit={handleKitchenLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Staff ID</label>
              <input className="inp" value={kitchenStaffId} onChange={e => setKitchenStaffId(e.target.value)}
                placeholder="e.g. K001" autoFocus />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Password</label>
              <input className="inp" type="password" value={kitchenPw} onChange={e => setKitchenPw(e.target.value)} placeholder="••••••••" />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Kitchen Section *</label>
              {activeKitchens.length === 0 ? (
                <div style={{ color: 'var(--text2)', fontSize: 13, padding: '10px 0' }}>
                  No kitchens configured. Ask admin to set up kitchen sections first.
                </div>
              ) : (
                <select className="inp" value={kitchenSection} onChange={e => setKitchenSection(e.target.value)}>
                  <option value="">— Select section —</option>
                  {activeKitchens.map(k => (
                    <option key={k.id} value={k.id}>{k.name}</option>
                  ))}
                </select>
              )}
            </div>
            {error && <div style={{ color: 'var(--red)', fontSize: 13 }}>{error}</div>}
            <button type="submit" className="btn btn-primary" style={{ justifyContent: 'center', padding: '12px', marginTop: 4, fontSize: 15 }}
              disabled={activeKitchens.length === 0}>
              Sign in to Kitchen
            </button>
          </form>
        )}

        <div style={{ marginTop: 20, padding: '12px', background: 'var(--bg3)', borderRadius: 8, fontSize: 12, color: 'var(--text2)' }}>
          <strong style={{ color: 'var(--yellow)' }}>Demo mode</strong> — any credentials work if no staff are configured. Cloud connection coming soon.
        </div>
      </div>
    </div>
  );
}
