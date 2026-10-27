export default function Loading() {
  const rows = [1, 2, 3, 4, 5, 6];
  return (
    <div style={{ padding: '0 0 32px' }}>
      {/* Header skeleton */}
      <div style={{
        height: 32, width: 200, borderRadius: 8,
        background: 'var(--bg3)', marginBottom: 24,
        animation: 'skeleton-pulse 1.4s ease-in-out infinite',
      }} />

      {/* Card skeleton */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 20 }}>
        {/* Table header */}
        <div style={{
          display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr',
          gap: 16, padding: '14px 20px',
          borderBottom: '1px solid var(--border)',
        }}>
          {[160, 80, 80, 80].map((w, i) => (
            <div key={i} style={{
              height: 14, width: w, borderRadius: 4,
              background: 'var(--bg3)',
              animation: 'skeleton-pulse 1.4s ease-in-out infinite',
              animationDelay: `${i * 0.1}s`,
            }} />
          ))}
        </div>
        {/* Table rows */}
        {rows.map(i => (
          <div key={i} style={{
            display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr',
            gap: 16, padding: '14px 20px',
            borderBottom: '1px solid var(--border)',
            opacity: 1 - i * 0.1,
          }}>
            {[180, 70, 70, 60].map((w, j) => (
              <div key={j} style={{
                height: 13, width: w, borderRadius: 4,
                background: 'var(--bg3)',
                animation: 'skeleton-pulse 1.4s ease-in-out infinite',
                animationDelay: `${(i * 4 + j) * 0.06}s`,
              }} />
            ))}
          </div>
        ))}
      </div>

      <style>{`
        @keyframes skeleton-pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
