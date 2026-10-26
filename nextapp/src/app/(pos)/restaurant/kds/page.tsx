'use client';
import { useState, useEffect } from 'react';
import { usePOS } from '@/lib/context';
import { KOT } from '@/lib/types';
import { now } from '@/lib/fmt';

const COLS: { key: KOT['status']; label: string; color: string }[] = [
  { key: 'new',       label: 'New',       color: '#ef4444' },
  { key: 'accepted',  label: 'Accepted',  color: '#4f8ef7' },
  { key: 'preparing', label: 'Preparing', color: '#f59e0b' },
  { key: 'ready',     label: 'Ready',     color: '#22c55e' },
];

const NEXT: Partial<Record<KOT['status'], KOT['status']>> = {
  new: 'accepted',
  accepted: 'preparing',
  preparing: 'ready',
};

function elapsed(ts: string): string {
  const secs = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m`;
}

export default function KDSPage() {
  const { db, save } = usePOS();
  const [selectedKitchen, setSelectedKitchen] = useState<string>('all');
  const [tick, setTick] = useState(0);

  // Refresh elapsed timers every 10s
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 10000);
    return () => clearInterval(interval);
  }, []);

  const kitchens = db.kitchens.filter(k => k.active);
  const visibleKOTs = db.kots.filter(k =>
    k.status !== 'served' &&
    (selectedKitchen === 'all' || k.kitchenId === selectedKitchen)
  );

  const advance = (kotId: string) => {
    save(d => {
      const kot = d.kots.find(k => k.id === kotId);
      if (!kot || !NEXT[kot.status]) return;
      kot.status = NEXT[kot.status]!;
      kot.updatedAt = now();
      // If all KOTs for this order are ready, update order restaurantStatus
      if (kot.status === 'ready') {
        const orderKots = d.kots.filter(k => k.orderId === kot.orderId);
        const allReady = orderKots.every(k => k.status === 'ready' || k.status === 'served');
        if (allReady) {
          const order = d.orders.find(o => o.id === kot.orderId);
          if (order) order.restaurantStatus = 'ready';
        }
      }
    });
  };

  const markServed = (kotId: string) => {
    save(d => {
      const kot = d.kots.find(k => k.id === kotId);
      if (kot) { kot.status = 'served'; kot.updatedAt = now(); }
    });
  };

  const kotsByCol = (status: KOT['status']) => visibleKOTs.filter(k => k.status === status);

  return (
    <div style={{ padding: 20, height: 'calc(100vh - 56px)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Kitchen Display</h1>
        {/* Kitchen filter */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={`btn ${selectedKitchen === 'all' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setSelectedKitchen('all')}>All Kitchens</button>
          {kitchens.map(k => (
            <button key={k.id} className={`btn ${selectedKitchen === k.id ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setSelectedKitchen(k.id)}
              style={{ borderLeft: `3px solid ${k.color}` }}>
              {k.name}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', color: 'var(--text2)', fontSize: 13 }}>
          {visibleKOTs.length} active tickets
        </div>
      </div>

      {/* KDS Columns */}
      {visibleKOTs.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text2)', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 48 }}>👨‍🍳</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>No active tickets</div>
          <div style={{ fontSize: 14 }}>Tickets will appear here when orders are confirmed by customers</div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, overflowY: 'auto' }}>
          {COLS.map(col => (
            <div key={col.key}>
              {/* Column header */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', background: 'var(--bg2)',
                borderTop: `3px solid ${col.color}`, borderRadius: '8px 8px 0 0', marginBottom: 8,
              }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: col.color }}>{col.label}</span>
                <span style={{ background: col.color, color: '#fff', borderRadius: 12, fontSize: 12, fontWeight: 700, padding: '2px 8px' }}>
                  {kotsByCol(col.key).length}
                </span>
              </div>

              {/* KOT Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {kotsByCol(col.key).map(kot => {
                  const mins = Math.floor((Date.now() - new Date(kot.createdAt).getTime()) / 60000);
                  const urgent = mins >= 15;
                  return (
                    <div key={kot.id} style={{
                      background: 'var(--bg2)',
                      border: `1px solid ${urgent ? 'var(--red)' : 'var(--border)'}`,
                      borderRadius: 10, padding: 14,
                      animation: urgent ? 'none' : undefined,
                    }}>
                      {/* KOT header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 15 }}>{kot.tableName || 'Table'}</div>
                          <div style={{ fontSize: 11, color: 'var(--text2)' }}>#{kot.orderNo}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: urgent ? 'var(--red)' : 'var(--text2)' }}>
                            ⏱ {elapsed(kot.createdAt)}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text2)' }}>{kot.kitchenName}</div>
                        </div>
                      </div>

                      {/* Items */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                        {kot.items.map((item, i) => (
                          <div key={i} style={{ display: 'flex', gap: 8, fontSize: 14 }}>
                            <span style={{ fontWeight: 700, color: col.color, minWidth: 24 }}>{item.qty}×</span>
                            <span style={{ fontWeight: 600 }}>{item.name}</span>
                          </div>
                        ))}
                      </div>

                      {/* Action button */}
                      {NEXT[kot.status] ? (
                        <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '8px', fontSize: 13 }}
                          onClick={() => advance(kot.id)}>
                          {kot.status === 'new' && '→ Accept'}
                          {kot.status === 'accepted' && '→ Start Cooking'}
                          {kot.status === 'preparing' && '→ Mark Ready'}
                        </button>
                      ) : (
                        kot.status === 'ready' && (
                          <button className="btn" style={{ width: '100%', justifyContent: 'center', padding: '8px', fontSize: 13, background: 'var(--bg3)', color: 'var(--text2)' }}
                            onClick={() => markServed(kot.id)}>
                            Mark Served
                          </button>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
