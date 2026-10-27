'use client';
import { useState, useTransition } from 'react';
import { fmtDateTime } from '@/lib/fmt';

interface AuditEntry {
  id: string;
  action: string;
  entity: string | null;
  entityId: string | null;
  staffId: string | null;
  payload: { detail?: string } | null;
  ip: string | null;
  createdAt: Date | string;
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const load = () => {
    startTransition(async () => {
      try {
        const { getAuditLogs } = await import('@/app/actions/settings');
        const data = await getAuditLogs(0) as AuditEntry[];
        setLogs(data);
        setLoaded(true);
        setPage(0);
      } catch {
        setLogs([]);
        setLoaded(true);
      }
    });
  };

  const filtered = logs.filter(l =>
    !filter ||
    l.action.toLowerCase().includes(filter.toLowerCase()) ||
    (l.staffId ?? '').toLowerCase().includes(filter.toLowerCase()) ||
    (l.payload?.detail ?? '').toLowerCase().includes(filter.toLowerCase())
  );

  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Audit Log</h2>
          <p style={{ fontSize: 12, color: 'var(--text2)', margin: '2px 0 0' }}>
            System activity recorded for compliance and security.
          </p>
        </div>
        <button
          className="btn btn-primary"
          style={{ marginLeft: 'auto' }}
          onClick={load}
          disabled={isPending}
        >
          {isPending ? 'Loading…' : loaded ? 'Refresh' : 'Load log'}
        </button>
      </div>

      {loaded && (
        <>
          <input
            className="inp"
            style={{ maxWidth: 320, marginBottom: 16 }}
            placeholder="Filter by action, staff, or detail…"
            value={filter}
            onChange={e => { setFilter(e.target.value); setPage(0); }}
          />

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Action</th>
                  <th>Staff</th>
                  <th>Detail</th>
                  <th>Entity</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map(l => (
                  <tr key={l.id}>
                    <td style={{ fontSize: 12, color: 'var(--text2)', whiteSpace: 'nowrap' }}>
                      {fmtDateTime(l.createdAt)}
                    </td>
                    <td>
                      <span style={{
                        fontFamily: 'monospace', fontSize: 11,
                        background: 'var(--bg3)', padding: '2px 6px', borderRadius: 4,
                        color: l.action.includes('FAIL') || l.action.includes('DELETE') ? 'var(--red)' : 'var(--text)',
                      }}>
                        {l.action}
                      </span>
                    </td>
                    <td style={{ fontSize: 13 }}>{l.staffId ?? '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--text2)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {l.payload?.detail ?? '—'}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text2)' }}>
                      {l.entity ? `${l.entity}${l.entityId ? ` #${l.entityId.slice(0, 6)}` : ''}` : '—'}
                    </td>
                  </tr>
                ))}
                {paginated.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text2)', padding: 32 }}>
                      {filter ? 'No entries match the filter.' : 'No audit entries yet.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', gap: 8, marginTop: 16, alignItems: 'center' }}>
              <button className="btn" disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Prev</button>
              <span style={{ fontSize: 13, color: 'var(--text2)' }}>
                Page {page + 1} of {totalPages} ({filtered.length} entries)
              </span>
              <button className="btn" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next →</button>
            </div>
          )}
        </>
      )}

      {!loaded && !isPending && (
        <div className="card" style={{ textAlign: 'center', padding: 60, color: 'var(--text2)' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
          Click <strong>Load log</strong> to view recent activity.
        </div>
      )}
    </div>
  );
}
