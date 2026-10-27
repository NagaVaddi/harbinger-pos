'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { loginAction } from '@/app/actions/auth';

export default function LoginPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await loginAction(fd);
      if (res.ok) {
        router.push('/dashboard');
      } else {
        setError(res.error ?? 'Login failed.');
      }
    });
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: 20,
    }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img src="/logo.png" alt="Harbinger" style={{ height: 56, width: 'auto', objectFit: 'contain', marginBottom: 8 }} />
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Harbinger</h1>
          <p style={{ color: 'var(--text2)', fontSize: 14, marginTop: 4 }}>Sign in to your POS</p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>
                Workspace
              </label>
              <input
                className="inp"
                name="tenantSlug"
                placeholder="your-business-name"
                required
                pattern="[a-z0-9-]+"
                title="Lowercase letters, numbers and hyphens only"
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>
                Staff ID
              </label>
              <input className="inp" name="staffId" placeholder="EMP001" required />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>
                Password
              </label>
              <input className="inp" name="password" type="password" placeholder="••••••••" required />
            </div>

            {error && (
              <div style={{
                background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)',
                borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--red)',
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={isPending}
              style={{ justifyContent: 'center', padding: '12px 0', marginTop: 4 }}
            >
              {isPending ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text2)', marginTop: 20 }}>
          New business?{' '}
          <a href="/register-tenant" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
            Create an account
          </a>
        </p>
      </div>
    </div>
  );
}
