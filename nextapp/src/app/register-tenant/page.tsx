'use client';
import { useState, useTransition } from 'react';
import { registerTenant } from '@/app/actions/auth';

const CURRENCIES = ['AED', 'SAR', 'QAR', 'BHD', 'OMR', 'KWD', 'USD', 'EUR', 'GBP', 'INR', 'EGP'];

export default function RegisterTenantPage() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await registerTenant(fd);
      if (!res.ok) setError(res.error ?? 'Registration failed.');
      // on success, registerTenant redirects — nothing to do here
    });
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: 20,
    }}>
      <div style={{ width: '100%', maxWidth: 440 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img src="/logo.png" alt="Harbinger" style={{ height: 56, width: 'auto', objectFit: 'contain', marginBottom: 8 }} />
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Create your workspace</h1>
          <p style={{ color: 'var(--text2)', fontSize: 14, marginTop: 4 }}>
            Set up Harbinger for your business — takes 30 seconds.
          </p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>
                Business name *
              </label>
              <input className="inp" name="businessName" placeholder="Al Noor Café" required minLength={2} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>
                  Your name *
                </label>
                <input className="inp" name="adminName" placeholder="Ahmed Al-Rashid" required minLength={2} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>
                  Admin staff ID *
                </label>
                <input
                  className="inp" name="adminId" placeholder="ADMIN01" required minLength={2}
                  pattern="[A-Z0-9]+" title="Uppercase letters and numbers only"
                  style={{ textTransform: 'uppercase' }}
                  onInput={(e) => {
                    const el = e.currentTarget;
                    el.value = el.value.toUpperCase();
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>
                  Password *
                </label>
                <input className="inp" name="password" type="password" placeholder="Min 8 characters" required minLength={8} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>
                  Currency
                </label>
                <select className="inp" name="currency" defaultValue="AED">
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
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
              {isPending ? 'Creating workspace…' : 'Create workspace'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text2)', marginTop: 20 }}>
          Already have an account?{' '}
          <a href="/login" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Sign in</a>
        </p>
      </div>
    </div>
  );
}
