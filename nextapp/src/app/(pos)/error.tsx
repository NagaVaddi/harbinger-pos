'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '60vh', gap: 16, padding: 24,
    }}>
      <div style={{ fontSize: 48 }}>⚠️</div>
      <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Something went wrong</h2>
      <p style={{
        color: 'var(--text2)', fontSize: 14, margin: 0,
        maxWidth: 400, textAlign: 'center', lineHeight: 1.6,
      }}>
        {error?.message ?? 'An unexpected error occurred.'}
      </p>
      {error?.digest && (
        <p style={{ color: 'var(--text2)', fontSize: 11, fontFamily: 'monospace', margin: 0 }}>
          ref: {error.digest}
        </p>
      )}
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button className="btn btn-primary" onClick={reset}>Try again</button>
        <button className="btn" onClick={() => window.location.href = '/dashboard'}>
          Go to dashboard
        </button>
      </div>
    </div>
  );
}
