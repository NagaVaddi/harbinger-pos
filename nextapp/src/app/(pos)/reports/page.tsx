'use client';
import { useState, useMemo } from 'react';
import { usePOS } from '@/lib/context';
import { useFeature } from '@/components/providers/FeatureProvider';
import { fmtCurrency, fmtDate } from '@/lib/fmt';
import { FeatureKey } from '@/lib/types';
import dynamic from 'next/dynamic';

const BarChart = dynamic(() => import('recharts').then(m => m.BarChart), { ssr: false });
const Bar = dynamic(() => import('recharts').then(m => m.Bar), { ssr: false });
const LineChart = dynamic(() => import('recharts').then(m => m.LineChart), { ssr: false });
const Line = dynamic(() => import('recharts').then(m => m.Line), { ssr: false });
const XAxis = dynamic(() => import('recharts').then(m => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then(m => m.YAxis), { ssr: false });
const CartesianGrid = dynamic(() => import('recharts').then(m => m.CartesianGrid), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then(m => m.Tooltip), { ssr: false });
const ResponsiveContainer = dynamic(() => import('recharts').then(m => m.ResponsiveContainer), { ssr: false });

type ReportId =
  | 'accounts_summary' | 'stock_books' | 'vat_summary' | 'daybook' | 'profit_loss'
  | 'balance_sheet' | 'trial_balance' | 'cash_book' | 'outstanding' | 'ledger' | 'vat_ledger'
  | 'stock_report' | 'item_activity' | 'stock_adjustments' | 'expiry_batch' | 'stock_valuation' | 'reorder'
  | 'sales_summary' | 'by_item' | 'by_category' | 'payments' | 'by_cashier'
  | 'margin_bill' | 'tax_report' | 'busy_hours' | 'menu_profit' | 'risk_alerts'
  | 'custom';

interface ReportCard { id: ReportId; title: string; desc: string; }

const ACCOUNTS: ReportCard[] = [
  { id: 'accounts_summary', title: 'Accounts summary', desc: 'Cash, receivables, payables, stock, tax and profit in one place, with customer ageing' },
  { id: 'stock_books', title: 'Stock report (books)', desc: 'Stock value by category, reconciled to the stock ledger' },
  { id: 'vat_summary', title: 'VAT summary', desc: 'Taxable sales, output and input tax by month' },
  { id: 'daybook', title: 'Day Book', desc: 'Every voucher in date order' },
  { id: 'profit_loss', title: 'Profit & Loss', desc: 'Income, cost of sales and expenses' },
  { id: 'balance_sheet', title: 'Balance Sheet', desc: 'What you own and owe on a date' },
  { id: 'trial_balance', title: 'Trial Balance', desc: 'All ledger balances; debits equal credits' },
  { id: 'cash_book', title: 'Cash / Bank Book', desc: 'Receipts and payments by cash and bank ledger' },
  { id: 'outstanding', title: 'Outstanding', desc: 'Receivables and payables' },
  { id: 'ledger', title: 'Ledger statements', desc: 'Open any ledger and see its entries' },
  { id: 'vat_ledger', title: 'VAT ledger view', desc: 'Tax ledgers for the selected dates' },
];

const INVENTORY: ReportCard[] = [
  { id: 'stock_report', title: 'Stock report', desc: 'Quantity, value and status of every tracked item' },
  { id: 'item_activity', title: 'Item activity', desc: 'Every movement of one item: in, out and running balance' },
  { id: 'stock_adjustments', title: 'Stock adjustments', desc: 'Counts, corrections and wastage with value lost' },
  { id: 'expiry_batch', title: 'Expiry / batch report', desc: 'Batches by expiry date, so you can act before they spoil' },
  { id: 'stock_valuation', title: 'Stock valuation', desc: 'Total stock value at cost' },
  { id: 'reorder', title: 'Reorder suggestions', desc: 'What to buy, based on sales speed' },
];

const SALES: ReportCard[] = [
  { id: 'sales_summary', title: 'Sales summary', desc: 'Every completed bill, day by day, with discounts and tax' },
  { id: 'by_item', title: 'By item', desc: 'Best sellers and slow movers' },
  { id: 'by_category', title: 'By category', desc: 'Revenue and share per category' },
  { id: 'payments', title: 'Payments', desc: 'Cash, card and other tender totals' },
  { id: 'by_cashier', title: 'By cashier', desc: 'Bills and discounts per team member' },
  { id: 'margin_bill', title: 'Margin per bill', desc: 'Cost, tax and profit on each bill' },
  { id: 'tax_report', title: 'Tax report', desc: 'VAT collected on sales in the range' },
  { id: 'busy_hours', title: 'Busy hours', desc: 'Which hours and days are busiest' },
  { id: 'menu_profit', title: 'Menu profit', desc: 'Popularity against profit for each item' },
  { id: 'risk_alerts', title: 'Risk alerts', desc: 'Unusual discounts, voids and refunds' },
];

function KPI({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value" style={{ fontSize: 20, color: color ?? 'inherit' }}>{value}</div>
    </div>
  );
}

function TblWrap({ children }: { children: React.ReactNode }) {
  return <div className="card" style={{ padding: 0, overflow: 'hidden' }}><table className="tbl">{children}</table></div>;
}

export default function ReportsPage() {
  const { db, settings } = usePOS();
  const { isEnabled } = useFeature();
  const customReportsEnabled = isEnabled(FeatureKey.CUSTOM_REPORTS);

  const [active, setActive] = useState<ReportId | null>(null);
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [itemSearch, setItemSearch] = useState('');
  const [ledgerCust, setLedgerCust] = useState('');
  const [customMetric, setCustomMetric] = useState<'revenue'|'orders'|'avg_ticket'|'tax'>('revenue');
  const [customGroup, setCustomGroup] = useState<'day'|'week'|'product'|'method'>('day');
  const [customChart, setCustomChart] = useState<'bar'|'line'>('bar');

  const cur = settings.currency;
  const fmt = (v: number) => fmtCurrency(v, cur);

  const paidOrders = useMemo(() => db.orders.filter(o => {
    if (o.status !== 'paid') return false;
    const d = o.ts.slice(0, 10);
    return d >= from && d <= to;
  }), [db.orders, from, to]);

  const allPaidOrders = useMemo(() => db.orders.filter(o => o.status === 'paid'), [db.orders]);

  // Aggregates
  const totalSales = paidOrders.reduce((s, o) => s + o.total, 0);
  const totalTax   = paidOrders.reduce((s, o) => s + o.tax, 0);
  const totalDisc  = paidOrders.reduce((s, o) => s + o.disc, 0);
  const totalCOGS  = paidOrders.reduce((s, o) => s + o.lines.reduce((ls, l) => {
    const p = db.products.find(x => x.id === l.productId);
    return ls + (p?.cost ?? 0) * l.qty;
  }, 0), 0);
  const grossProfit = totalSales - totalTax - totalCOGS;
  const avgTicket  = paidOrders.length ? totalSales / paidOrders.length : 0;
  const stockValue = db.products.reduce((s, p) => s + p.stock * p.price, 0);
  const stockCost  = db.products.reduce((s, p) => s + p.stock * (p.cost ?? 0), 0);
  const debtors    = db.customers.filter(c => (c.balance ?? 0) > 0);
  const totalDebt  = debtors.reduce((s, c) => s + (c.balance ?? 0), 0);

  // By-day breakdown
  const byDay = useMemo(() => {
    const m = new Map<string, { sales: number; orders: number; tax: number; disc: number }>();
    for (const o of paidOrders) {
      const k = o.ts.slice(0, 10);
      const e = m.get(k) ?? { sales: 0, orders: 0, tax: 0, disc: 0 };
      m.set(k, { sales: e.sales + o.total, orders: e.orders + 1, tax: e.tax + o.tax, disc: e.disc + o.disc });
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, v]) => ({ date, ...v }));
  }, [paidOrders]);

  // By-item
  const byItem = useMemo(() => {
    const m = new Map<string, { name: string; qty: number; revenue: number; cost: number }>();
    for (const o of paidOrders) {
      for (const l of o.lines) {
        const p = db.products.find(x => x.id === l.productId);
        const e = m.get(l.productId) ?? { name: l.name, qty: 0, revenue: 0, cost: 0 };
        m.set(l.productId, { name: l.name, qty: e.qty + l.qty, revenue: e.revenue + l.price * l.qty, cost: e.cost + (p?.cost ?? 0) * l.qty });
      }
    }
    return [...m.values()].sort((a, b) => b.revenue - a.revenue);
  }, [paidOrders, db.products]);

  // By-category
  const byCategory = useMemo(() => {
    const m = new Map<string, { revenue: number; qty: number }>();
    for (const o of paidOrders) {
      for (const l of o.lines) {
        const p = db.products.find(x => x.id === l.productId);
        const cat = p?.category ?? 'Uncategorised';
        const e = m.get(cat) ?? { revenue: 0, qty: 0 };
        m.set(cat, { revenue: e.revenue + l.price * l.qty, qty: e.qty + l.qty });
      }
    }
    return [...m.entries()].sort((a, b) => b[1].revenue - a[1].revenue).map(([cat, v]) => ({ cat, ...v }));
  }, [paidOrders, db.products]);

  // By-method
  const byMethod = useMemo(() => {
    const m = new Map<string, { total: number; count: number }>();
    for (const o of paidOrders) {
      const key = o.method ?? 'unknown';
      const e = m.get(key) ?? { total: 0, count: 0 };
      m.set(key, { total: e.total + o.total, count: e.count + 1 });
    }
    return [...m.entries()].sort((a, b) => b[1].total - a[1].total).map(([method, v]) => ({ method, ...v }));
  }, [paidOrders]);

  // By-cashier
  const byCashier = useMemo(() => {
    const m = new Map<string, { name: string; total: number; orders: number; disc: number }>();
    for (const o of paidOrders) {
      const key = o.staffId ?? 'unknown';
      const staff = db.staff?.find((s: { id: string; name: string }) => s.id === key);
      const name = staff?.name ?? o.staffId ?? 'Unknown';
      const e = m.get(key) ?? { name, total: 0, orders: 0, disc: 0 };
      m.set(key, { name, total: e.total + o.total, orders: e.orders + 1, disc: e.disc + o.disc });
    }
    return [...m.values()].sort((a, b) => b.total - a.total);
  }, [paidOrders, db.staff]);

  // Busy hours
  const busyHours = useMemo(() => {
    const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    for (const o of allPaidOrders) {
      const d = new Date(o.ts);
      const day = d.getDay();
      const hour = d.getHours();
      grid[day][hour]++;
    }
    return grid;
  }, [allPaidOrders]);

  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // VAT by month
  const vatByMonth = useMemo(() => {
    const m = new Map<string, { net: number; tax: number; gross: number }>();
    for (const o of paidOrders) {
      const key = o.ts.slice(0, 7);
      const e = m.get(key) ?? { net: 0, tax: 0, gross: 0 };
      m.set(key, { net: e.net + (o.total - o.tax), tax: e.tax + o.tax, gross: e.gross + o.total });
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([month, v]) => ({ month, ...v }));
  }, [paidOrders]);

  // Low stock / reorder
  const reorderItems = db.products.filter(p => p.active && p.minStock != null && p.stock <= p.minStock);

  // Expiry batches
  const today = new Date().toISOString().slice(0, 10);
  const expiryBatches = (db.batches ?? [])
    .filter(b => b.expiryDate)
    .sort((a, b) => (a.expiryDate ?? '').localeCompare(b.expiryDate ?? ''));

  // Risk alerts
  const riskAlerts = useMemo(() => {
    const alerts: { type: string; order: string; detail: string; ts: string; amount: number }[] = [];
    const avgDisc = paidOrders.length ? totalDisc / paidOrders.length : 0;
    for (const o of paidOrders) {
      if (o.disc > avgDisc * 3 && o.disc > 0) alerts.push({ type: 'High discount', order: o.no, detail: `Discount ${fmt(o.disc)}`, ts: o.ts, amount: o.disc });
      if (o.status === 'void') alerts.push({ type: 'Voided bill', order: o.no, detail: 'Bill was voided', ts: o.ts, amount: o.total });
      if (o.status === 'refund') alerts.push({ type: 'Refund', order: o.no, detail: 'Refund issued', ts: o.ts, amount: o.total });
    }
    return alerts.slice(0, 100);
  }, [paidOrders, totalDisc]);

  // Item activity
  const itemActivityProduct = db.products.find(p =>
    p.name.toLowerCase().includes(itemSearch.toLowerCase()) || p.id === itemSearch
  );
  const itemBatches = (db.batches ?? []).filter(b => b.productId === itemActivityProduct?.id);

  // Custom report
  const customData = useMemo(() => {
    const buckets = new Map<string, number[]>();
    for (const o of paidOrders) {
      const getVal = () => {
        if (customMetric === 'revenue') return o.total;
        if (customMetric === 'orders') return 1;
        if (customMetric === 'tax') return o.tax;
        return o.total;
      };
      if (customGroup === 'product') {
        for (const l of o.lines) {
          const k = l.name ?? l.productId;
          if (!buckets.has(k)) buckets.set(k, []);
          buckets.get(k)!.push(customMetric === 'revenue' || customMetric === 'avg_ticket' ? l.price * l.qty : 1);
        }
      } else {
        let key: string;
        if (customGroup === 'day') key = o.ts.slice(0, 10);
        else if (customGroup === 'week') {
          const d = new Date(o.ts);
          const wk = new Date(d); wk.setDate(d.getDate() - d.getDay());
          key = wk.toISOString().slice(0, 10);
        } else key = o.method ?? 'unknown';
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key)!.push(getVal());
      }
    }
    return [...buckets.entries()]
      .map(([name, vals]) => ({
        name: name.length > 16 ? name.slice(0, 14) + '…' : name,
        value: customMetric === 'avg_ticket' ? vals.reduce((s, v) => s + v, 0) / vals.length : vals.reduce((s, v) => s + v, 0),
      }))
      .sort((a, b) => (customGroup === 'day' || customGroup === 'week') ? a.name.localeCompare(b.name) : b.value - a.value)
      .slice(0, 30);
  }, [paidOrders, customMetric, customGroup]);

  // ── Report index (card grid) ────────────────────────────────────
  if (!active) {
    const CardGrid = ({ cards }: { cards: ReportCard[] }) => (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12, marginBottom: 32 }}>
        {cards.map(r => (
          <button key={r.id} onClick={() => setActive(r.id)} style={{
            display: 'flex', alignItems: 'flex-start', gap: 12,
            background: 'var(--bg2)', border: '1px solid var(--border)',
            borderRadius: 12, padding: '16px 18px', cursor: 'pointer', textAlign: 'left',
            transition: 'border-color .15s',
          }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
          >
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(99,102,241,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
              </svg>
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{r.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.4 }}>{r.desc}</div>
            </div>
            <svg style={{ marginLeft: 'auto', flexShrink: 0, color: 'var(--text3)' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        ))}
      </div>
    );

    return (
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Reports</h1>
        <p style={{ color: 'var(--text2)', fontSize: 14, marginBottom: 28 }}>Choose a report to view</p>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 12 }}>Accounts reports</h2>
        <CardGrid cards={ACCOUNTS} />
        <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 12 }}>Inventory reports</h2>
        <CardGrid cards={INVENTORY} />
        <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 12 }}>Sales &amp; operations</h2>
        <CardGrid cards={[...SALES, ...(customReportsEnabled ? [{ id: 'custom' as ReportId, title: 'Custom report', desc: 'Build your own chart — choose metric, group-by, and chart type' }] : [])]} />
      </div>
    );
  }

  // ── Individual report view ──────────────────────────────────────
  const allCards = [...ACCOUNTS, ...INVENTORY, ...SALES, { id: 'custom' as ReportId, title: 'Custom report', desc: '' }];
  const card = allCards.find(c => c.id === active);

  const Header = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
      <button className="btn" onClick={() => setActive(null)} style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
        ← Reports
      </button>
      <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{card?.title}</h2>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--text2)' }}>From</span>
        <input className="inp" type="date" style={{ maxWidth: 150 }} value={from} onChange={e => setFrom(e.target.value)} />
        <span style={{ fontSize: 12, color: 'var(--text2)' }}>To</span>
        <input className="inp" type="date" style={{ maxWidth: 150 }} value={to} onChange={e => setTo(e.target.value)} />
      </div>
    </div>
  );

  // ── ACCOUNTS SUMMARY ────────────────────────────────────────────
  if (active === 'accounts_summary') return (
    <div><Header />
      <div className="kpi-grid" style={{ marginBottom: 24 }}>
        <KPI label="Gross sales" value={fmt(totalSales)} />
        <KPI label="Tax collected" value={fmt(totalTax)} />
        <KPI label="Discounts given" value={fmt(totalDisc)} />
        <KPI label="COGS" value={fmt(totalCOGS)} />
        <KPI label="Gross profit" value={fmt(grossProfit)} color={grossProfit >= 0 ? 'var(--green)' : 'var(--red)'} />
        <KPI label="Stock value (retail)" value={fmt(stockValue)} />
        <KPI label="Receivables" value={fmt(totalDebt)} color="var(--red)" />
        <KPI label="Transactions" value={String(paidOrders.length)} />
      </div>
      <h3 style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>Customer ageing</h3>
      <TblWrap>
        <thead><tr><th>Customer</th><th>Phone</th><th style={{ textAlign: 'right' }}>Balance</th><th style={{ textAlign: 'right' }}>Credit limit</th></tr></thead>
        <tbody>
          {debtors.map(c => (
            <tr key={c.id}>
              <td style={{ fontWeight: 500 }}>{c.name}</td>
              <td style={{ color: 'var(--text2)' }}>{c.phone ?? '—'}</td>
              <td style={{ textAlign: 'right', color: 'var(--red)', fontWeight: 600 }}>{fmt(c.balance ?? 0)}</td>
              <td style={{ textAlign: 'right' }}>{c.creditLimit != null ? fmt(c.creditLimit) : '—'}</td>
            </tr>
          ))}
          {!debtors.length && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text2)', padding: 32 }}>No outstanding balances</td></tr>}
        </tbody>
      </TblWrap>
    </div>
  );

  // ── STOCK REPORT (BOOKS) ─────────────────────────────────────────
  if (active === 'stock_books') {
    const cats = [...new Set(db.products.map(p => p.category ?? 'Uncategorised'))].sort();
    return (
      <div><Header />
        <div className="kpi-grid" style={{ marginBottom: 24 }}>
          <KPI label="Total stock (retail)" value={fmt(stockValue)} />
          <KPI label="Total stock (cost)" value={fmt(stockCost)} />
          <KPI label="Gross margin in stock" value={`${stockValue ? Math.round((stockValue - stockCost) / stockValue * 100) : 0}%`} />
        </div>
        {cats.map(cat => {
          const catProds = db.products.filter(p => (p.category ?? 'Uncategorised') === cat && p.active);
          const catVal = catProds.reduce((s, p) => s + p.stock * p.price, 0);
          const catCost = catProds.reduce((s, p) => s + p.stock * (p.cost ?? 0), 0);
          return (
            <div key={cat} style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700 }}>{cat}</h3>
                <span style={{ fontSize: 13, color: 'var(--text2)' }}>{fmt(catVal)} retail · {fmt(catCost)} cost</span>
              </div>
              <TblWrap>
                <thead><tr><th>Product</th><th style={{ textAlign: 'right' }}>Stock</th><th style={{ textAlign: 'right' }}>Cost</th><th style={{ textAlign: 'right' }}>Value (cost)</th><th style={{ textAlign: 'right' }}>Value (retail)</th></tr></thead>
                <tbody>
                  {catProds.map(p => (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      <td style={{ textAlign: 'right' }}>{p.stock}</td>
                      <td style={{ textAlign: 'right', color: 'var(--text2)' }}>{p.cost != null ? fmt(p.cost) : '—'}</td>
                      <td style={{ textAlign: 'right' }}>{fmt(p.stock * (p.cost ?? 0))}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(p.stock * p.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </TblWrap>
            </div>
          );
        })}
      </div>
    );
  }

  // ── VAT SUMMARY ──────────────────────────────────────────────────
  if (active === 'vat_summary') return (
    <div><Header />
      <div className="kpi-grid" style={{ marginBottom: 24 }}>
        <KPI label={`${settings.taxLabel} collected`} value={fmt(totalTax)} />
        <KPI label="Net sales (excl. tax)" value={fmt(totalSales - totalTax)} />
        <KPI label="Gross sales" value={fmt(totalSales)} />
        <KPI label="Tax rate" value={`${settings.taxRate}%`} />
        <KPI label="TRN" value={settings.trn || 'Not set'} />
      </div>
      <TblWrap>
        <thead><tr><th>Month</th><th style={{ textAlign: 'right' }}>Net sales</th><th style={{ textAlign: 'right' }}>Tax</th><th style={{ textAlign: 'right' }}>Gross</th></tr></thead>
        <tbody>
          {vatByMonth.map(r => (
            <tr key={r.month}>
              <td>{r.month}</td>
              <td style={{ textAlign: 'right' }}>{fmt(r.net)}</td>
              <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(r.tax)}</td>
              <td style={{ textAlign: 'right' }}>{fmt(r.gross)}</td>
            </tr>
          ))}
          {!vatByMonth.length && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text2)', padding: 32 }}>No data in period</td></tr>}
        </tbody>
      </TblWrap>
    </div>
  );

  // ── DAY BOOK ────────────────────────────────────────────────────
  if (active === 'daybook') return (
    <div><Header />
      <TblWrap>
        <thead><tr><th>Date</th><th>#</th><th>Customer</th><th style={{ textAlign: 'right' }}>Sales</th><th style={{ textAlign: 'right' }}>Tax</th><th style={{ textAlign: 'right' }}>Disc</th><th style={{ textAlign: 'right' }}>Total</th><th>Method</th></tr></thead>
        <tbody>
          {paidOrders.slice().reverse().map(o => {
            const cust = db.customers.find(c => c.id === o.customerId);
            return (
              <tr key={o.id}>
                <td style={{ fontSize: 12, color: 'var(--text2)', whiteSpace: 'nowrap' }}>{new Date(o.ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{o.no}</td>
                <td style={{ fontSize: 13 }}>{cust?.name ?? '—'}</td>
                <td style={{ textAlign: 'right' }}>{fmt(o.subtotal)}</td>
                <td style={{ textAlign: 'right', color: 'var(--text2)' }}>{fmt(o.tax)}</td>
                <td style={{ textAlign: 'right', color: o.disc > 0 ? 'var(--red)' : 'var(--text2)' }}>{fmt(o.disc)}</td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(o.total)}</td>
                <td style={{ textTransform: 'capitalize', fontSize: 12 }}>{o.method}</td>
              </tr>
            );
          })}
          {!paidOrders.length && <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text2)', padding: 32 }}>No entries in this period</td></tr>}
        </tbody>
      </TblWrap>
    </div>
  );

  // ── PROFIT & LOSS ────────────────────────────────────────────────
  if (active === 'profit_loss') return (
    <div><Header />
      <div style={{ maxWidth: 580 }}>
        {[
          { label: 'Gross sales', value: totalSales, bold: false },
          { label: `Less: Tax (${settings.taxLabel})`, value: -totalTax, bold: false },
          { label: 'Less: Discounts', value: -totalDisc, bold: false },
          { label: 'Net revenue', value: totalSales - totalTax - totalDisc, bold: true, border: true },
          { label: 'Cost of goods sold (COGS)', value: -totalCOGS, bold: false },
          { label: 'Gross profit', value: totalSales - totalTax - totalDisc - totalCOGS, bold: true, border: true, color: grossProfit >= 0 ? 'var(--green)' : 'var(--red)' },
        ].map((row, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', borderBottom: row.border ? '2px solid var(--border)' : '1px solid var(--border)', fontWeight: row.bold ? 700 : 400 }}>
            <span style={{ color: row.bold ? 'inherit' : 'var(--text2)' }}>{row.label}</span>
            <span style={{ color: row.color ?? (row.value < 0 ? 'var(--red)' : 'inherit') }}>{row.value < 0 ? `(${fmt(-row.value)})` : fmt(row.value)}</span>
          </div>
        ))}
        <div style={{ padding: '16px', color: 'var(--text2)', fontSize: 12 }}>
          Gross margin: {totalSales ? Math.round((grossProfit / totalSales) * 100) : 0}% · Period: {from} to {to}
        </div>
      </div>
    </div>
  );

  // ── BALANCE SHEET ────────────────────────────────────────────────
  if (active === 'balance_sheet') return (
    <div><Header />
      <p style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 20 }}>Snapshot as at {to}</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, maxWidth: 800 }}>
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: 'var(--accent)' }}>Assets</h3>
          {[
            { label: 'Stock (retail value)', value: stockValue },
            { label: 'Receivables (customer balances)', value: totalDebt },
          ].map((r, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 13 }}>{r.label}</span><span style={{ fontWeight: 600 }}>{fmt(r.value)}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', fontWeight: 700, fontSize: 15 }}>
            <span>Total assets</span><span>{fmt(stockValue + totalDebt)}</span>
          </div>
        </div>
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: 'var(--red)' }}>Liabilities &amp; equity</h3>
          {[
            { label: 'Retained earnings', value: grossProfit },
          ].map((r, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 13 }}>{r.label}</span><span style={{ fontWeight: 600 }}>{fmt(r.value)}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', fontWeight: 700, fontSize: 15 }}>
            <span>Total L&amp;E</span><span>{fmt(grossProfit)}</span>
          </div>
        </div>
      </div>
      <p style={{ color: 'var(--text2)', fontSize: 12, marginTop: 16 }}>Note: This is a simplified view based on available POS data. Consult your accountant for a full balance sheet.</p>
    </div>
  );

  // ── TRIAL BALANCE ────────────────────────────────────────────────
  if (active === 'trial_balance') return (
    <div><Header />
      <TblWrap>
        <thead><tr><th>Account</th><th style={{ textAlign: 'right' }}>Debit</th><th style={{ textAlign: 'right' }}>Credit</th></tr></thead>
        <tbody>
          {[
            { account: 'Sales revenue', debit: 0, credit: totalSales },
            { account: `${settings.taxLabel} payable`, debit: 0, credit: totalTax },
            { account: 'Discounts given', debit: totalDisc, credit: 0 },
            { account: 'Cost of goods sold', debit: totalCOGS, credit: 0 },
            { account: 'Inventory (stock)', debit: stockValue, credit: 0 },
            { account: 'Accounts receivable', debit: totalDebt, credit: 0 },
            { account: 'Retained earnings', debit: 0, credit: grossProfit > 0 ? grossProfit : 0 },
          ].map((r, i) => (
            <tr key={i}>
              <td>{r.account}</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{r.debit ? fmt(r.debit) : '—'}</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{r.credit ? fmt(r.credit) : '—'}</td>
            </tr>
          ))}
          <tr style={{ fontWeight: 700, borderTop: '2px solid var(--border)' }}>
            <td>Totals</td>
            <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(totalDisc + totalCOGS + stockValue + totalDebt)}</td>
            <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(totalSales + totalTax + (grossProfit > 0 ? grossProfit : 0))}</td>
          </tr>
        </tbody>
      </TblWrap>
    </div>
  );

  // ── CASH / BANK BOOK ─────────────────────────────────────────────
  if (active === 'cash_book') {
    const cashOrders = paidOrders.filter(o => (o.method ?? '').toLowerCase().includes('cash'));
    const cardOrders = paidOrders.filter(o => !(o.method ?? '').toLowerCase().includes('cash'));
    return (
      <div><Header />
        <div className="kpi-grid" style={{ marginBottom: 24 }}>
          <KPI label="Cash receipts" value={fmt(cashOrders.reduce((s, o) => s + o.total, 0))} />
          <KPI label="Card / other receipts" value={fmt(cardOrders.reduce((s, o) => s + o.total, 0))} />
          <KPI label="Total receipts" value={fmt(totalSales)} />
        </div>
        <TblWrap>
          <thead><tr><th>Date</th><th>#</th><th style={{ textAlign: 'right' }}>Amount</th><th>Method</th></tr></thead>
          <tbody>
            {paidOrders.slice().reverse().map(o => (
              <tr key={o.id}>
                <td style={{ fontSize: 12, color: 'var(--text2)' }}>{new Date(o.ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{o.no}</td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(o.total)}</td>
                <td style={{ textTransform: 'capitalize' }}>{o.method}</td>
              </tr>
            ))}
            {!paidOrders.length && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text2)', padding: 32 }}>No entries</td></tr>}
          </tbody>
        </TblWrap>
      </div>
    );
  }

  // ── OUTSTANDING ──────────────────────────────────────────────────
  if (active === 'outstanding') return (
    <div><Header />
      <h3 style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Customer receivables</h3>
      <TblWrap>
        <thead><tr><th>Customer</th><th>Phone</th><th style={{ textAlign: 'right' }}>Balance owing</th><th style={{ textAlign: 'right' }}>Credit limit</th><th>Status</th></tr></thead>
        <tbody>
          {debtors.map(c => (
            <tr key={c.id}>
              <td style={{ fontWeight: 500 }}>{c.name}</td>
              <td style={{ color: 'var(--text2)' }}>{c.phone ?? '—'}</td>
              <td style={{ textAlign: 'right', color: 'var(--red)', fontWeight: 700 }}>{fmt(c.balance ?? 0)}</td>
              <td style={{ textAlign: 'right' }}>{c.creditLimit != null ? fmt(c.creditLimit) : '—'}</td>
              <td>
                <span className={`badge ${(c.balance ?? 0) > (c.creditLimit ?? Infinity) ? 'badge-red' : 'badge-yellow'}`}>
                  {(c.balance ?? 0) > (c.creditLimit ?? Infinity) ? 'Over limit' : 'Outstanding'}
                </span>
              </td>
            </tr>
          ))}
          {!debtors.length && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text2)', padding: 32 }}>No outstanding balances</td></tr>}
        </tbody>
      </TblWrap>
    </div>
  );

  // ── LEDGER STATEMENTS ─────────────────────────────────────────────
  if (active === 'ledger') {
    const custOrders = paidOrders.filter(o => o.customerId === ledgerCust);
    const ledgerCustomer = db.customers.find(c => c.id === ledgerCust);
    return (
      <div><Header />
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Select customer</label>
          <select className="inp" style={{ maxWidth: 300 }} value={ledgerCust} onChange={e => setLedgerCust(e.target.value)}>
            <option value="">Choose customer…</option>
            {db.customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        {ledgerCustomer && (
          <div>
            <div className="kpi-grid" style={{ marginBottom: 20 }}>
              <KPI label="Customer" value={ledgerCustomer.name} />
              <KPI label="Balance owing" value={fmt(ledgerCustomer.balance ?? 0)} color="var(--red)" />
              <KPI label="Orders in period" value={String(custOrders.length)} />
              <KPI label="Spend in period" value={fmt(custOrders.reduce((s, o) => s + o.total, 0))} />
            </div>
            <TblWrap>
              <thead><tr><th>Date</th><th>#</th><th style={{ textAlign: 'right' }}>Amount</th><th>Method</th></tr></thead>
              <tbody>
                {custOrders.map(o => (
                  <tr key={o.id}>
                    <td style={{ fontSize: 12, color: 'var(--text2)' }}>{new Date(o.ts).toLocaleString()}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{o.no}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(o.total)}</td>
                    <td style={{ textTransform: 'capitalize' }}>{o.method}</td>
                  </tr>
                ))}
                {!custOrders.length && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text2)', padding: 32 }}>No orders for this customer in period</td></tr>}
              </tbody>
            </TblWrap>
          </div>
        )}
      </div>
    );
  }

  // ── VAT LEDGER VIEW ───────────────────────────────────────────────
  if (active === 'vat_ledger') return (
    <div><Header />
      <div className="kpi-grid" style={{ marginBottom: 24 }}>
        <KPI label="Output tax (sales)" value={fmt(totalTax)} />
        <KPI label="Net of tax" value={fmt(totalSales - totalTax)} />
        <KPI label="TRN" value={settings.trn || 'Not set'} />
      </div>
      <TblWrap>
        <thead><tr><th>Date</th><th>#</th><th style={{ textAlign: 'right' }}>Net</th><th style={{ textAlign: 'right' }}>Tax</th><th style={{ textAlign: 'right' }}>Gross</th></tr></thead>
        <tbody>
          {paidOrders.slice().reverse().filter(o => o.tax > 0).map(o => (
            <tr key={o.id}>
              <td style={{ fontSize: 12, color: 'var(--text2)' }}>{new Date(o.ts).toLocaleDateString()}</td>
              <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{o.no}</td>
              <td style={{ textAlign: 'right' }}>{fmt(o.total - o.tax)}</td>
              <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(o.tax)}</td>
              <td style={{ textAlign: 'right' }}>{fmt(o.total)}</td>
            </tr>
          ))}
          {!paidOrders.filter(o => o.tax > 0).length && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text2)', padding: 32 }}>No taxable sales in period</td></tr>}
        </tbody>
      </TblWrap>
    </div>
  );

  // ── STOCK REPORT ─────────────────────────────────────────────────
  if (active === 'stock_report') return (
    <div><Header />
      <div className="kpi-grid" style={{ marginBottom: 24 }}>
        <KPI label="Total SKUs (active)" value={String(db.products.filter(p => p.active).length)} />
        <KPI label="Out of stock" value={String(db.products.filter(p => p.active && p.stock <= 0).length)} color="var(--red)" />
        <KPI label="Low stock" value={String(db.products.filter(p => p.active && p.minStock != null && p.stock > 0 && p.stock <= p.minStock).length)} color="var(--yellow)" />
        <KPI label="Value (retail)" value={fmt(stockValue)} />
        <KPI label="Value (cost)" value={fmt(stockCost)} />
      </div>
      <TblWrap>
        <thead><tr><th>Product</th><th>SKU</th><th>Category</th><th style={{ textAlign: 'right' }}>Stock</th><th>Unit</th><th style={{ textAlign: 'right' }}>Price</th><th style={{ textAlign: 'right' }}>Cost</th><th style={{ textAlign: 'right' }}>Value</th><th>Status</th></tr></thead>
        <tbody>
          {db.products.filter(p => p.active).map(p => {
            const low = p.minStock != null && p.stock <= p.minStock && p.stock > 0;
            const out = p.stock <= 0;
            return (
              <tr key={p.id}>
                <td style={{ fontWeight: 500 }}>{p.name}</td>
                <td style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text2)' }}>{p.sku ?? '—'}</td>
                <td style={{ color: 'var(--text2)', fontSize: 12 }}>{p.category ?? '—'}</td>
                <td style={{ textAlign: 'right', color: out ? 'var(--red)' : low ? 'var(--yellow)' : 'inherit', fontWeight: 600 }}>{p.stock}</td>
                <td style={{ color: 'var(--text2)' }}>{p.unit ?? '—'}</td>
                <td style={{ textAlign: 'right' }}>{fmt(p.price)}</td>
                <td style={{ textAlign: 'right', color: 'var(--text2)' }}>{p.cost != null ? fmt(p.cost) : '—'}</td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(p.stock * p.price)}</td>
                <td><span className={`badge ${out ? 'badge-red' : low ? 'badge-yellow' : 'badge-green'}`}>{out ? 'Out' : low ? 'Low' : 'OK'}</span></td>
              </tr>
            );
          })}
        </tbody>
      </TblWrap>
    </div>
  );

  // ── ITEM ACTIVITY ─────────────────────────────────────────────────
  if (active === 'item_activity') return (
    <div><Header />
      <div style={{ marginBottom: 20 }}>
        <input className="inp" style={{ maxWidth: 320 }} placeholder="Search product name…" value={itemSearch} onChange={e => setItemSearch(e.target.value)} />
      </div>
      {itemActivityProduct ? (
        <div>
          <div className="kpi-grid" style={{ marginBottom: 20 }}>
            <KPI label="Product" value={itemActivityProduct.name} />
            <KPI label="Current stock" value={`${itemActivityProduct.stock} ${itemActivityProduct.unit ?? ''}`} />
            <KPI label="Batches received" value={String(itemBatches.length)} />
          </div>
          <h3 style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Sales activity</h3>
          <TblWrap>
            <thead><tr><th>Date</th><th>#</th><th style={{ textAlign: 'right' }}>Qty</th><th style={{ textAlign: 'right' }}>Price</th><th>Method</th></tr></thead>
            <tbody>
              {paidOrders.flatMap(o => o.lines.filter(l => l.productId === itemActivityProduct.id).map(l => ({ o, l }))).map(({ o, l }, i) => (
                <tr key={i}>
                  <td style={{ fontSize: 12, color: 'var(--text2)' }}>{new Date(o.ts).toLocaleDateString()}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{o.no}</td>
                  <td style={{ textAlign: 'right' }}>{l.qty}</td>
                  <td style={{ textAlign: 'right' }}>{fmt(l.price * l.qty)}</td>
                  <td style={{ textTransform: 'capitalize', fontSize: 12 }}>{o.method}</td>
                </tr>
              ))}
            </tbody>
          </TblWrap>
          {itemBatches.length > 0 && (<>
            <h3 style={{ fontWeight: 600, fontSize: 14, margin: '20px 0 12px' }}>Stock received (batches)</h3>
            <TblWrap>
              <thead><tr><th>Batch no.</th><th style={{ textAlign: 'right' }}>Qty received</th><th>Expiry</th><th>Date</th></tr></thead>
              <tbody>
                {itemBatches.map(b => (
                  <tr key={b.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{b.batchNo ?? '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{b.totalQty}</td>
                    <td style={{ color: b.expiryDate && b.expiryDate < today ? 'var(--red)' : 'var(--text2)', fontSize: 12 }}>{b.expiryDate ? fmtDate(b.expiryDate) : '—'}</td>
                    <td style={{ color: 'var(--text2)', fontSize: 12 }}>{fmtDate(b.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </TblWrap>
          </>)}
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: 60, color: 'var(--text2)' }}>
          Search for a product name above to see its activity.
        </div>
      )}
    </div>
  );

  // ── STOCK ADJUSTMENTS ─────────────────────────────────────────────
  if (active === 'stock_adjustments') return (
    <div><Header />
      <p style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 20 }}>Stock adjustments recorded via the Stock Room → Receive / Count tabs.</p>
      <TblWrap>
        <thead><tr><th>Date</th><th>Product</th><th style={{ textAlign: 'right' }}>Qty received</th><th>Batch</th><th>Expiry</th></tr></thead>
        <tbody>
          {(db.batches ?? []).filter(b => {
            const d = b.createdAt.slice(0, 10);
            return d >= from && d <= to;
          }).map(b => (
            <tr key={b.id}>
              <td style={{ fontSize: 12, color: 'var(--text2)' }}>{fmtDate(b.createdAt)}</td>
              <td style={{ fontWeight: 500 }}>{b.productName}</td>
              <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--green)' }}>+{b.totalQty}</td>
              <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{b.batchNo ?? '—'}</td>
              <td style={{ fontSize: 12, color: b.expiryDate && b.expiryDate < today ? 'var(--red)' : 'var(--text2)' }}>{b.expiryDate ? fmtDate(b.expiryDate) : '—'}</td>
            </tr>
          ))}
          {!(db.batches ?? []).length && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text2)', padding: 32 }}>No adjustments in period</td></tr>}
        </tbody>
      </TblWrap>
    </div>
  );

  // ── EXPIRY / BATCH REPORT ─────────────────────────────────────────
  if (active === 'expiry_batch') {
    const expired = expiryBatches.filter(b => (b.expiryDate ?? '') < today);
    const soon = expiryBatches.filter(b => {
      const d = b.expiryDate ?? '';
      const in30 = new Date(); in30.setDate(in30.getDate() + 30);
      return d >= today && d <= in30.toISOString().slice(0, 10);
    });
    return (
      <div><Header />
        <div className="kpi-grid" style={{ marginBottom: 24 }}>
          <KPI label="Expired" value={String(expired.length)} color="var(--red)" />
          <KPI label="Expiring within 30 days" value={String(soon.length)} color="var(--yellow)" />
          <KPI label="Total batches" value={String(expiryBatches.length)} />
        </div>
        <TblWrap>
          <thead><tr><th>Product</th><th>Batch no.</th><th style={{ textAlign: 'right' }}>Qty</th><th>Expiry</th><th>Status</th></tr></thead>
          <tbody>
            {expiryBatches.map(b => {
              const isExp = (b.expiryDate ?? '') < today;
              const in30 = new Date(); in30.setDate(in30.getDate() + 30);
              const isSoon = !isExp && (b.expiryDate ?? '') <= in30.toISOString().slice(0, 10);
              return (
                <tr key={b.id}>
                  <td style={{ fontWeight: 500 }}>{b.productName}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{b.batchNo ?? '—'}</td>
                  <td style={{ textAlign: 'right' }}>{b.totalQty}</td>
                  <td style={{ color: isExp ? 'var(--red)' : isSoon ? 'var(--yellow)' : 'inherit', fontWeight: isExp ? 700 : 400 }}>{fmtDate(b.expiryDate!)}</td>
                  <td><span className={`badge ${isExp ? 'badge-red' : isSoon ? 'badge-yellow' : 'badge-green'}`}>{isExp ? 'Expired' : isSoon ? 'Expiring soon' : 'OK'}</span></td>
                </tr>
              );
            })}
            {!expiryBatches.length && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text2)', padding: 32 }}>No batches with expiry dates</td></tr>}
          </tbody>
        </TblWrap>
      </div>
    );
  }

  // ── STOCK VALUATION ───────────────────────────────────────────────
  if (active === 'stock_valuation') return (
    <div><Header />
      <div className="kpi-grid" style={{ marginBottom: 24 }}>
        <KPI label="Total stock value (cost)" value={fmt(stockCost)} />
        <KPI label="Total stock value (retail)" value={fmt(stockValue)} />
        <KPI label="Potential gross profit" value={fmt(stockValue - stockCost)} color="var(--green)" />
      </div>
      <TblWrap>
        <thead><tr><th>Product</th><th>Category</th><th style={{ textAlign: 'right' }}>Stock</th><th style={{ textAlign: 'right' }}>Unit cost</th><th style={{ textAlign: 'right' }}>Total cost</th><th style={{ textAlign: 'right' }}>Total retail</th></tr></thead>
        <tbody>
          {db.products.filter(p => p.active && p.cost != null).sort((a, b) => (b.stock * (b.cost ?? 0)) - (a.stock * (a.cost ?? 0))).map(p => (
            <tr key={p.id}>
              <td style={{ fontWeight: 500 }}>{p.name}</td>
              <td style={{ fontSize: 12, color: 'var(--text2)' }}>{p.category ?? '—'}</td>
              <td style={{ textAlign: 'right' }}>{p.stock}</td>
              <td style={{ textAlign: 'right', color: 'var(--text2)' }}>{fmt(p.cost!)}</td>
              <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(p.stock * (p.cost ?? 0))}</td>
              <td style={{ textAlign: 'right' }}>{fmt(p.stock * p.price)}</td>
            </tr>
          ))}
        </tbody>
      </TblWrap>
    </div>
  );

  // ── REORDER SUGGESTIONS ───────────────────────────────────────────
  if (active === 'reorder') return (
    <div><Header />
      <div className="kpi-grid" style={{ marginBottom: 24 }}>
        <KPI label="Items to reorder" value={String(reorderItems.length)} color={reorderItems.length > 0 ? 'var(--red)' : 'inherit'} />
      </div>
      <TblWrap>
        <thead><tr><th>Product</th><th>Category</th><th style={{ textAlign: 'right' }}>Current stock</th><th style={{ textAlign: 'right' }}>Min stock</th><th style={{ textAlign: 'right' }}>To reorder</th><th>Status</th></tr></thead>
        <tbody>
          {reorderItems.map(p => (
            <tr key={p.id}>
              <td style={{ fontWeight: 500 }}>{p.name}</td>
              <td style={{ color: 'var(--text2)', fontSize: 12 }}>{p.category ?? '—'}</td>
              <td style={{ textAlign: 'right', color: p.stock <= 0 ? 'var(--red)' : 'var(--yellow)', fontWeight: 700 }}>{p.stock}</td>
              <td style={{ textAlign: 'right', color: 'var(--text2)' }}>{p.minStock}</td>
              <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--accent)' }}>+{Math.max(0, (p.minStock ?? 0) * 2 - p.stock)}</td>
              <td><span className={`badge ${p.stock <= 0 ? 'badge-red' : 'badge-yellow'}`}>{p.stock <= 0 ? 'Out of stock' : 'Low stock'}</span></td>
            </tr>
          ))}
          {!reorderItems.length && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text2)', padding: 32 }}>All items above minimum stock levels</td></tr>}
        </tbody>
      </TblWrap>
    </div>
  );

  // ── SALES SUMMARY ─────────────────────────────────────────────────
  if (active === 'sales_summary') return (
    <div><Header />
      <div className="kpi-grid" style={{ marginBottom: 24 }}>
        <KPI label="Gross sales" value={fmt(totalSales)} />
        <KPI label="Tax" value={fmt(totalTax)} />
        <KPI label="Discounts" value={fmt(totalDisc)} />
        <KPI label="Transactions" value={String(paidOrders.length)} />
        <KPI label="Avg ticket" value={fmt(avgTicket)} />
      </div>
      <h3 style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Daily breakdown</h3>
      <TblWrap>
        <thead><tr><th>Date</th><th style={{ textAlign: 'right' }}>Sales</th><th style={{ textAlign: 'right' }}>Tax</th><th style={{ textAlign: 'right' }}>Discounts</th><th style={{ textAlign: 'right' }}>Orders</th></tr></thead>
        <tbody>
          {byDay.map(r => (
            <tr key={r.date}>
              <td>{r.date}</td>
              <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(r.sales)}</td>
              <td style={{ textAlign: 'right', color: 'var(--text2)' }}>{fmt(r.tax)}</td>
              <td style={{ textAlign: 'right', color: 'var(--text2)' }}>{fmt(r.disc)}</td>
              <td style={{ textAlign: 'right' }}>{r.orders}</td>
            </tr>
          ))}
          {!byDay.length && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text2)', padding: 32 }}>No sales in period</td></tr>}
        </tbody>
      </TblWrap>
    </div>
  );

  // ── BY ITEM ───────────────────────────────────────────────────────
  if (active === 'by_item') return (
    <div><Header />
      <TblWrap>
        <thead><tr><th>Product</th><th style={{ textAlign: 'right' }}>Qty sold</th><th style={{ textAlign: 'right' }}>Revenue</th><th style={{ textAlign: 'right' }}>COGS</th><th style={{ textAlign: 'right' }}>Margin</th></tr></thead>
        <tbody>
          {byItem.map(r => {
            const margin = r.revenue > 0 ? Math.round((r.revenue - r.cost) / r.revenue * 100) : 0;
            return (
              <tr key={r.name}>
                <td style={{ fontWeight: 500 }}>{r.name}</td>
                <td style={{ textAlign: 'right' }}>{r.qty}</td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(r.revenue)}</td>
                <td style={{ textAlign: 'right', color: 'var(--text2)' }}>{fmt(r.cost)}</td>
                <td style={{ textAlign: 'right', color: margin > 50 ? 'var(--green)' : margin < 20 ? 'var(--red)' : 'inherit' }}>{margin}%</td>
              </tr>
            );
          })}
          {!byItem.length && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text2)', padding: 32 }}>No sales in period</td></tr>}
        </tbody>
      </TblWrap>
    </div>
  );

  // ── BY CATEGORY ───────────────────────────────────────────────────
  if (active === 'by_category') {
    const catTotal = byCategory.reduce((s, r) => s + r.revenue, 0);
    return (
      <div><Header />
        <TblWrap>
          <thead><tr><th>Category</th><th style={{ textAlign: 'right' }}>Revenue</th><th style={{ textAlign: 'right' }}>Qty</th><th style={{ textAlign: 'right' }}>Share</th></tr></thead>
          <tbody>
            {byCategory.map(r => (
              <tr key={r.cat}>
                <td style={{ fontWeight: 500 }}>{r.cat}</td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(r.revenue)}</td>
                <td style={{ textAlign: 'right', color: 'var(--text2)' }}>{r.qty}</td>
                <td style={{ textAlign: 'right', color: 'var(--text2)' }}>{catTotal ? Math.round(r.revenue / catTotal * 100) : 0}%</td>
              </tr>
            ))}
            {!byCategory.length && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text2)', padding: 32 }}>No sales in period</td></tr>}
          </tbody>
        </TblWrap>
      </div>
    );
  }

  // ── PAYMENTS ──────────────────────────────────────────────────────
  if (active === 'payments') {
    const pyTotal = byMethod.reduce((s, r) => s + r.total, 0);
    return (
      <div><Header />
        <div className="kpi-grid" style={{ marginBottom: 24 }}>
          {byMethod.slice(0, 4).map(r => <KPI key={r.method} label={r.method.charAt(0).toUpperCase() + r.method.slice(1)} value={fmt(r.total)} />)}
        </div>
        <TblWrap>
          <thead><tr><th>Method</th><th style={{ textAlign: 'right' }}>Transactions</th><th style={{ textAlign: 'right' }}>Total</th><th style={{ textAlign: 'right' }}>Share</th></tr></thead>
          <tbody>
            {byMethod.map(r => (
              <tr key={r.method}>
                <td style={{ fontWeight: 500, textTransform: 'capitalize' }}>{r.method}</td>
                <td style={{ textAlign: 'right' }}>{r.count}</td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(r.total)}</td>
                <td style={{ textAlign: 'right', color: 'var(--text2)' }}>{pyTotal ? Math.round(r.total / pyTotal * 100) : 0}%</td>
              </tr>
            ))}
            {!byMethod.length && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text2)', padding: 32 }}>No payments in period</td></tr>}
          </tbody>
        </TblWrap>
      </div>
    );
  }

  // ── BY CASHIER ────────────────────────────────────────────────────
  if (active === 'by_cashier') return (
    <div><Header />
      <TblWrap>
        <thead><tr><th>Cashier</th><th style={{ textAlign: 'right' }}>Bills</th><th style={{ textAlign: 'right' }}>Discounts</th><th style={{ textAlign: 'right' }}>Sales</th><th style={{ textAlign: 'right' }}>Avg ticket</th></tr></thead>
        <tbody>
          {byCashier.map(r => (
            <tr key={r.name}>
              <td style={{ fontWeight: 500 }}>{r.name}</td>
              <td style={{ textAlign: 'right' }}>{r.orders}</td>
              <td style={{ textAlign: 'right', color: r.disc > 0 ? 'var(--red)' : 'var(--text2)' }}>{fmt(r.disc)}</td>
              <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(r.total)}</td>
              <td style={{ textAlign: 'right', color: 'var(--text2)' }}>{fmt(r.orders ? r.total / r.orders : 0)}</td>
            </tr>
          ))}
          {!byCashier.length && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text2)', padding: 32 }}>No sales in period</td></tr>}
        </tbody>
      </TblWrap>
    </div>
  );

  // ── MARGIN PER BILL ───────────────────────────────────────────────
  if (active === 'margin_bill') return (
    <div><Header />
      <TblWrap>
        <thead><tr><th>#</th><th>Date</th><th style={{ textAlign: 'right' }}>Revenue</th><th style={{ textAlign: 'right' }}>COGS</th><th style={{ textAlign: 'right' }}>Tax</th><th style={{ textAlign: 'right' }}>Profit</th><th style={{ textAlign: 'right' }}>Margin</th></tr></thead>
        <tbody>
          {paidOrders.slice().reverse().map(o => {
            const cogs = o.lines.reduce((s, l) => {
              const p = db.products.find(x => x.id === l.productId);
              return s + (p?.cost ?? 0) * l.qty;
            }, 0);
            const profit = o.total - o.tax - cogs;
            const margin = o.total > 0 ? Math.round(profit / o.total * 100) : 0;
            return (
              <tr key={o.id}>
                <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{o.no}</td>
                <td style={{ fontSize: 12, color: 'var(--text2)' }}>{new Date(o.ts).toLocaleDateString()}</td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(o.total)}</td>
                <td style={{ textAlign: 'right', color: 'var(--text2)' }}>{fmt(cogs)}</td>
                <td style={{ textAlign: 'right', color: 'var(--text2)' }}>{fmt(o.tax)}</td>
                <td style={{ textAlign: 'right', color: profit >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>{fmt(profit)}</td>
                <td style={{ textAlign: 'right', color: margin > 50 ? 'var(--green)' : margin < 0 ? 'var(--red)' : 'inherit' }}>{margin}%</td>
              </tr>
            );
          })}
          {!paidOrders.length && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text2)', padding: 32 }}>No sales in period</td></tr>}
        </tbody>
      </TblWrap>
    </div>
  );

  // ── TAX REPORT ────────────────────────────────────────────────────
  if (active === 'tax_report') return (
    <div><Header />
      <div className="kpi-grid" style={{ marginBottom: 24 }}>
        <KPI label={`${settings.taxLabel} collected`} value={fmt(totalTax)} />
        <KPI label="Taxable transactions" value={String(paidOrders.filter(o => o.tax > 0).length)} />
        <KPI label="Net sales" value={fmt(totalSales - totalTax)} />
        <KPI label="Tax rate" value={`${settings.taxRate}%`} />
      </div>
      <TblWrap>
        <thead><tr><th>Month</th><th style={{ textAlign: 'right' }}>Net</th><th style={{ textAlign: 'right' }}>Tax</th><th style={{ textAlign: 'right' }}>Gross</th></tr></thead>
        <tbody>
          {vatByMonth.map(r => (
            <tr key={r.month}>
              <td>{r.month}</td>
              <td style={{ textAlign: 'right' }}>{fmt(r.net)}</td>
              <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(r.tax)}</td>
              <td style={{ textAlign: 'right' }}>{fmt(r.gross)}</td>
            </tr>
          ))}
          {!vatByMonth.length && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text2)', padding: 32 }}>No data in period</td></tr>}
        </tbody>
      </TblWrap>
    </div>
  );

  // ── BUSY HOURS ────────────────────────────────────────────────────
  if (active === 'busy_hours') {
    const maxVal = Math.max(...busyHours.flat(), 1);
    const peakHours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];
    return (
      <div><Header />
        <p style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 20 }}>Based on all-time order data. Darker = more orders.</p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr>
                <th style={{ padding: '4px 8px', color: 'var(--text2)', textAlign: 'left' }}>Day</th>
                {peakHours.map(h => <th key={h} style={{ padding: '4px 6px', color: 'var(--text2)', fontWeight: 400, minWidth: 36 }}>{h}:00</th>)}
              </tr>
            </thead>
            <tbody>
              {DAYS.map((day, di) => (
                <tr key={day}>
                  <td style={{ padding: '4px 8px', fontWeight: 600, color: 'var(--text2)', whiteSpace: 'nowrap' }}>{day}</td>
                  {peakHours.map(h => {
                    const val = busyHours[di][h];
                    const intensity = val / maxVal;
                    return (
                      <td key={h} title={`${val} orders`} style={{
                        padding: '8px 6px', textAlign: 'center', borderRadius: 4,
                        background: val === 0 ? 'var(--bg3)' : `rgba(99,102,241,${0.1 + intensity * 0.85})`,
                        color: intensity > 0.5 ? '#fff' : 'var(--text)',
                        fontWeight: val > 0 ? 600 : 400, fontSize: 11,
                      }}>{val || ''}</td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ── MENU PROFIT ───────────────────────────────────────────────────
  if (active === 'menu_profit') return (
    <div><Header />
      <TblWrap>
        <thead><tr><th>Product</th><th>Category</th><th style={{ textAlign: 'right' }}>Qty sold</th><th style={{ textAlign: 'right' }}>Revenue</th><th style={{ textAlign: 'right' }}>Cost</th><th style={{ textAlign: 'right' }}>Profit</th><th style={{ textAlign: 'right' }}>Margin</th><th>Rating</th></tr></thead>
        <tbody>
          {byItem.map(r => {
            const profit = r.revenue - r.cost;
            const margin = r.revenue > 0 ? profit / r.revenue : 0;
            const rating = margin > 0.6 ? 'Star' : margin > 0.3 ? 'Workhorse' : margin < 0 ? 'Loss' : 'Marginal';
            return (
              <tr key={r.name}>
                <td style={{ fontWeight: 500 }}>{r.name}</td>
                <td style={{ fontSize: 12, color: 'var(--text2)' }}>{db.products.find(p => p.name === r.name)?.category ?? '—'}</td>
                <td style={{ textAlign: 'right' }}>{r.qty}</td>
                <td style={{ textAlign: 'right' }}>{fmt(r.revenue)}</td>
                <td style={{ textAlign: 'right', color: 'var(--text2)' }}>{fmt(r.cost)}</td>
                <td style={{ textAlign: 'right', fontWeight: 600, color: profit >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(profit)}</td>
                <td style={{ textAlign: 'right' }}>{Math.round(margin * 100)}%</td>
                <td><span className={`badge ${rating === 'Star' ? 'badge-green' : rating === 'Loss' ? 'badge-red' : 'badge-yellow'}`}>{rating}</span></td>
              </tr>
            );
          })}
          {!byItem.length && <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text2)', padding: 32 }}>No sales in period</td></tr>}
        </tbody>
      </TblWrap>
    </div>
  );

  // ── RISK ALERTS ───────────────────────────────────────────────────
  if (active === 'risk_alerts') return (
    <div><Header />
      <div className="kpi-grid" style={{ marginBottom: 24 }}>
        <KPI label="Risk events" value={String(riskAlerts.length)} color={riskAlerts.length > 0 ? 'var(--red)' : 'inherit'} />
        <KPI label="Voided orders" value={String(db.orders.filter(o => o.status === 'void').length)} />
        <KPI label="Refunds" value={String(db.orders.filter(o => o.status === 'refund').length)} />
        <KPI label="Total discounts given" value={fmt(totalDisc)} />
      </div>
      <TblWrap>
        <thead><tr><th>Type</th><th>#</th><th>Detail</th><th>Date</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
        <tbody>
          {riskAlerts.map((a, i) => (
            <tr key={i}>
              <td><span className="badge badge-red">{a.type}</span></td>
              <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{a.order}</td>
              <td style={{ color: 'var(--text2)', fontSize: 13 }}>{a.detail}</td>
              <td style={{ fontSize: 12, color: 'var(--text2)' }}>{new Date(a.ts).toLocaleDateString()}</td>
              <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--red)' }}>{fmt(a.amount)}</td>
            </tr>
          ))}
          {!riskAlerts.length && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text2)', padding: 32 }}>No risk events detected in period</td></tr>}
        </tbody>
      </TblWrap>
    </div>
  );

  // ── CUSTOM REPORT ─────────────────────────────────────────────────
  if (active === 'custom' && customReportsEnabled) return (
    <div><Header />
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        {[
          { label: 'Metric', id: 'metric', opts: [['revenue', 'Revenue'], ['orders', 'Order count'], ['avg_ticket', 'Avg ticket'], ['tax', 'Tax collected']], value: customMetric, set: (v: string) => setCustomMetric(v as typeof customMetric) },
          { label: 'Group by', id: 'group', opts: [['day', 'Day'], ['week', 'Week'], ['product', 'Product'], ['method', 'Payment method']], value: customGroup, set: (v: string) => setCustomGroup(v as typeof customGroup) },
        ].map(ctrl => (
          <div key={ctrl.id}>
            <label style={{ fontSize: 11, color: 'var(--text2)', display: 'block', marginBottom: 3 }}>{ctrl.label}</label>
            <select className="inp" style={{ fontSize: 13 }} value={ctrl.value} onChange={e => ctrl.set(e.target.value)}>
              {ctrl.opts.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
            </select>
          </div>
        ))}
        <div style={{ display: 'flex', background: 'var(--bg3)', borderRadius: 8, padding: 2, alignSelf: 'flex-end' }}>
          {(['bar', 'line'] as const).map(ct => (
            <button key={ct} onClick={() => setCustomChart(ct)} style={{ padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, background: customChart === ct ? 'var(--accent)' : 'transparent', color: customChart === ct ? '#fff' : 'var(--text2)' }}>
              {ct === 'bar' ? '📊 Bar' : '📈 Line'}
            </button>
          ))}
        </div>
      </div>
      {customData.length > 0 ? (
        <div className="card">
          <div style={{ width: '100%', height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              {customChart === 'bar' ? (
                <BarChart data={customData} margin={{ top: 8, right: 16, bottom: 40, left: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text2)' }} angle={-35} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text2)' }} />
                  <Tooltip contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} formatter={((v: unknown) => { const n = Number(v ?? 0); return customMetric === 'orders' ? n : fmt(n); }) as any} />
                  <Bar dataKey="value" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                </BarChart>
              ) : (
                <LineChart data={customData} margin={{ top: 8, right: 16, bottom: 40, left: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text2)' }} angle={-35} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text2)' }} />
                  <Tooltip contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} formatter={((v: unknown) => { const n = Number(v ?? 0); return customMetric === 'orders' ? n : fmt(n); }) as any} />
                  <Line type="monotone" dataKey="value" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: 60, color: 'var(--text2)' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🔮</div>
          No data for this combination. Adjust the date range or filters.
        </div>
      )}
    </div>
  );

  return <div><Header /><div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text2)' }}>Report coming soon.</div></div>;
}
