'use client';
import { usePOS } from '@/lib/context';
import { fmt, fmtCurrency } from '@/lib/fmt';

function KPI({ label, value, sub, up }: { label: string; value: string; sub?: string; up?: boolean }) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {sub && <div className={`kpi-change ${up === true ? 'up' : up === false ? 'dn' : ''}`}>{sub}</div>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text2)', marginBottom: 12, marginTop: 24 }}>
      {children}
    </h2>
  );
}

export default function DashboardPage() {
  const { db, settings } = usePOS();

  // Compute today's stats
  const today = new Date().toDateString();
  const todayOrders = db.orders.filter(o => new Date(o.ts).toDateString() === today && o.status === 'paid');
  const todaySales = todayOrders.reduce((s, o) => s + o.total, 0);
  const todayTx = todayOrders.length;

  const totalProducts = db.products.filter(p => p.active).length;
  const lowStock = db.products.filter(p => p.active && p.minStock != null && p.stock <= p.minStock).length;
  const totalCustomers = db.customers.filter(c => c.status === 'active').length;

  const openJobs = db.jobs.filter(j => j.status === 'open' || j.status === 'in_progress').length;

  return (
    <div>
      {/* KPI row */}
      <SectionTitle>Today</SectionTitle>
      <div className="kpi-grid">
        <KPI label="Sales" value={fmtCurrency(todaySales, settings.currency)} />
        <KPI label="Transactions" value={String(todayTx)} />
        <KPI label="Avg ticket" value={todayTx ? fmtCurrency(todaySales / todayTx, settings.currency) : `${settings.currency} 0.00`} />
        <KPI label="Open jobs" value={String(openJobs)} />
      </div>

      <SectionTitle>Inventory</SectionTitle>
      <div className="kpi-grid">
        <KPI label="Active products" value={String(totalProducts)} />
        <KPI label="Low / out of stock" value={String(lowStock)} up={lowStock === 0 ? true : false} />
        <KPI label="Customers" value={String(totalCustomers)} />
      </div>

      {/* Recent orders */}
      <SectionTitle>Recent transactions</SectionTitle>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>#</th>
              <th>Date</th>
              <th>Items</th>
              <th style={{ textAlign: 'right' }}>Total</th>
              <th>Method</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {db.orders.slice(-20).reverse().map(o => (
              <tr key={o.id}>
                <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{o.no}</td>
                <td style={{ color: 'var(--text2)', fontSize: 12 }}>
                  {new Date(o.ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </td>
                <td>{o.lines.length}</td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtCurrency(o.total, settings.currency)}</td>
                <td style={{ textTransform: 'capitalize' }}>{o.method}</td>
                <td>
                  <span className={`badge ${o.status === 'paid' ? 'badge-green' : o.status === 'void' ? 'badge-red' : 'badge-yellow'}`}>
                    {o.status}
                  </span>
                </td>
              </tr>
            ))}
            {db.orders.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text2)', padding: 32 }}>No transactions yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
