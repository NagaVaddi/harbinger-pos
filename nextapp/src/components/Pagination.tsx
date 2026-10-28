'use client';

interface PaginationProps {
  total: number;
  page: number;
  pageSize: number;
  onChange: (page: number) => void;
}

export default function Pagination({ total, page, pageSize, onChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center', marginTop: 16, paddingBottom: 8 }}>
      <button
        className="btn"
        disabled={page === 1}
        onClick={() => onChange(page - 1)}
        style={{ padding: '5px 14px', fontSize: 13 }}
      >← Prev</button>
      <span style={{ fontSize: 12, color: 'var(--text2)', minWidth: 100, textAlign: 'center' }}>
        Page {page} of {totalPages}
      </span>
      <button
        className="btn"
        disabled={page === totalPages}
        onClick={() => onChange(page + 1)}
        style={{ padding: '5px 14px', fontSize: 13 }}
      >Next →</button>
    </div>
  );
}
