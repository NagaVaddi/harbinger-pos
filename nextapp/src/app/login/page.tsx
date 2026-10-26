'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Demo: accept any non-empty credentials
    // In Cloud mode this will POST to /api/auth/login
    if (!email || !password) { setError('Enter email and password'); return; }
    router.push('/dashboard');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div className="card" style={{ width: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent)', marginBottom: 4 }}>⚡ Harbinger</div>
          <div style={{ color: 'var(--text2)', fontSize: 13 }}>Point of Sale</div>
        </div>
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Email</label>
            <input className="inp" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@business.com" autoFocus />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Password</label>
            <input className="inp" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          {error && <div style={{ color: 'var(--red)', fontSize: 13 }}>{error}</div>}
          <button type="submit" className="btn btn-primary" style={{ justifyContent: 'center', padding: '12px', marginTop: 4, fontSize: 15 }}>
            Sign in
          </button>
        </form>
        <div style={{ marginTop: 20, padding: '12px', background: 'var(--bg3)', borderRadius: 8, fontSize: 12, color: 'var(--text2)' }}>
          <strong style={{ color: 'var(--yellow)' }}>Demo mode</strong> — data stored in your browser. Cloud connection coming soon.
        </div>
      </div>
    </div>
  );
}
