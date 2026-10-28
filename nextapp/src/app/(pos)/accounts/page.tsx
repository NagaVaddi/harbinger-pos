'use client';
import { useState, useMemo } from 'react';
import { usePOS } from '@/lib/context';
import { fmtCurrency, fmtDate, uid, now } from '@/lib/fmt';
import Pagination from '@/components/Pagination';

const PAGE_SIZE = 50;

type Tab = 'daybook' | 'ledgers' | 'generalledger' | 'coa' | 'trialbalance' | 'pl' | 'balancesheet' | 'cashbook' | 'vat' | 'outstanding' | 'bookschecks';
type VoucherType = 'payment' | 'receipt' | 'contra' | 'journal' | 'purchase';

interface Voucher {
  id: string;
  type: VoucherType;
  no: string;
  date: string;
  narration: string;
  amount: number;
  ledger: string;
  createdAt: string;
}

const TYPE_COLOR: Record<VoucherType, string> = {
  payment: 'var(--red)',
  receipt: 'var(--green)',
  contra: 'var(--accent)',
  journal: '#f59e0b',
  purchase: '#8b5cf6',
};

const TABS: { id: Tab; label: string }[] = [
  { id: 'daybook',      label: 'Day Book' },
  { id: 'ledgers',      label: 'Ledgers' },
  { id: 'generalledger', label: 'General Ledger' },
  { id: 'coa',          label: 'Chart of Accounts' },
  { id: 'trialbalance', label: 'Trial Balance' },
  { id: 'pl',           label: 'Profit & Loss' },
  { id: 'balancesheet', label: 'Balance Sheet' },
  { id: 'cashbook',     label: 'Cash / Bank Book' },
  { id: 'vat',          label: 'VAT' },
  { id: 'outstanding',  label: 'Outstanding' },
  { id: 'bookschecks',  label: 'Books & Checks' },
];

const DEFAULT_COA = [
  { code: '1001', name: 'Cash',               group: 'Assets',      type: 'Current Asset' },
  { code: '1002', name: 'Bank Account',        group: 'Assets',      type: 'Current Asset' },
  { code: '1101', name: 'Accounts Receivable', group: 'Assets',      type: 'Current Asset' },
  { code: '1201', name: 'Inventory / Stock',   group: 'Assets',      type: 'Current Asset' },
  { code: '2001', name: 'Accounts Payable',    group: 'Liabilities', type: 'Current Liability' },
  { code: '2101', name: 'VAT Payable',         group: 'Liabilities', type: 'Current Liability' },
  { code: '3001', name: 'Owner Equity',        group: 'Equity',      type: 'Equity' },
  { code: '4001', name: 'Sales Revenue',       group: 'Income',      type: 'Revenue' },
  { code: '5001', name: 'Cost of Goods Sold',  group: 'Expenses',    type: 'Expense' },
  { code: '5002', name: 'Discounts Given',     group: 'Expenses',    type: 'Expense' },
  { code: '5003', name: 'Operating Expenses',  group: 'Expenses',    type: 'Expense' },
];

export default function AccountsPage() {
  const { db, settings, save } = usePOS();
  const cur = settings.currency;
  const fmt = (v: number) => fmtCurrency(v, cur);

  const [tab, setTab] = useState<Tab>('daybook');
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<VoucherType | 'all'>('all');
  const [showVoucherForm, setShowVoucherForm] = useState<VoucherType | null>(null);
  const [vForm, setVForm] = useState({ narration: '', amount: '', ledger: 'Cash', date: new Date().toISOString().slice(0, 10) });
  const [dayBookPage, setDayBookPage] = useState(1);
  const [glPage, setGlPage] = useState(1);
  const [glLedger, setGlLedger] = useState<string>('all');

  const vouchers: Voucher[] = db.accountVouchers ?? [];

  const filtered = useMemo(() => vouchers.filter(v => {
    if (v.date < from || v.date > to) return false;
    if (typeFilter !== 'all' && v.type !== typeFilter) return false;
    if (search && !v.narration.toLowerCase().includes(search.toLowerCase()) && !v.ledger.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [vouchers, from, to, typeFilter, search]);

  const saveVoucher = () => {
    if (!vForm.narration.trim() || !vForm.amount) return alert('Fill all fields');
    const type = showVoucherForm!;
    const prefix = { payment: 'PY', receipt: 'RC', contra: 'CT', journal: 'JV', purchase: 'PU' }[type];
    const no = `${prefix}-${String(vouchers.length + 1).padStart(4, '0')}`;
    const v: Voucher = { id: uid(), type, no, date: vForm.date, narration: vForm.narration, amount: parseFloat(vForm.amount), ledger: vForm.ledger, createdAt: now() };
    save((d: any) => { d.accountVouchers = [...(d.accountVouchers ?? []), v]; return d; });
    setVForm({ narration: '', amount: '', ledger: 'Cash', date: new Date().toISOString().slice(0, 10) });
    setShowVoucherForm(null);
  };

  // Aggregates from POS orders
  const paidOrders = useMemo(() => db.orders.filter(o => {
    if (o.status !== 'paid') return false;
    const d = o.ts.slice(0, 10);
    return d >= from && d <= to;
  }), [db.orders, from, to]);

  const totalSales = paidOrders.reduce((s, o) => s + o.total, 0);
  const totalTax   = paidOrders.reduce((s, o) => s + o.tax, 0);
  const totalDisc  = paidOrders.reduce((s, o) => s + o.disc, 0);
  const totalCOGS  = paidOrders.reduce((s, o) => s + o.lines.reduce((ls, l) => {
    const p = db.products.find(x => x.id === l.productId);
    return ls + (p?.cost ?? 0) * l.qty;
  }, 0), 0);
  const grossProfit  = totalSales - totalTax - totalCOGS;
  const stockValue   = db.products.reduce((s, p) => s + p.stock * p.price, 0);
  const stockCost    = db.products.reduce((s, p) => s + p.stock * (p.cost ?? 0), 0);
  const totalDebt    = db.customers.filter(c => (c.balance ?? 0) > 0).reduce((s, c) => s + (c.balance ?? 0), 0);
  const cashReceipts = paidOrders.filter(o => (o.method ?? '').toLowerCase().includes('cash')).reduce((s, o) => s + o.total, 0);
  const bankReceipts = paidOrders.filter(o => !(o.method ?? '').toLowerCase().includes('cash')).reduce((s, o) => s + o.total, 0);
  const vatByMonth   = useMemo(() => {
    const m = new Map<string, { net: number; tax: number }>();
    for (const o of paidOrders) {
      const k = o.ts.slice(0, 7);
      const e = m.get(k) ?? { net: 0, tax: 0 };
      m.set(k, { net: e.net + (o.total - o.tax), tax: e.tax + o.tax });
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([month, v]) => ({ month, ...v }));
  }, [paidOrders]);

  const exportCSV = () => {
    const rows = [['No', 'Date', 'Type', 'Narration', 'Ledger', 'Amount']];
    filtered.forEach(v => rows.push([v.no, v.date, v.type, v.narration, v.ledger, String(v.amount)]));
    // Also add POS orders
    paidOrders.forEach(o => rows.push([o.no, o.ts.slice(0, 10), 'receipt', `POS Sale`, o.method, String(o.total)]));
    const csv = rows.map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `accounts-${from}-${to}.csv`;
    a.click();
  };

  const TblWrap = ({ children }: { children: React.ReactNode }) => (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}><table className="tbl">{children}</table></div>
  );

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Accounts</h1>
      <p style={{ color: 'var(--text2)', fontSize: 14, marginBottom: 16 }}>Double-entry books — every entry balances</p>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, overflowX: 'auto', borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '8px 14px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: tab === t.id ? 700 : 400,
            background: 'transparent', color: tab === t.id ? 'var(--accent)' : 'var(--text2)',
            borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
            whiteSpace: 'nowrap',
          }}>{t.label}</button>
        ))}
      </div>

      {/* Date range (shared) */}
      {tab !== 'coa' && tab !== 'bookschecks' && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--text2)' }}>From</span>
          <input className="inp" type="date" style={{ maxWidth: 150 }} value={from} onChange={e => setFrom(e.target.value)} />
          <span style={{ fontSize: 12, color: 'var(--text2)' }}>To</span>
          <input className="inp" type="date" style={{ maxWidth: 150 }} value={to} onChange={e => setTo(e.target.value)} />
          <button className="btn" onClick={exportCSV} style={{ marginLeft: 'auto', fontSize: 12 }}>Export CSV</button>
        </div>
      )}

      {/* ── DAY BOOK ─────────────────────────────────────────────── */}
      {tab === 'daybook' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <input className="inp" style={{ maxWidth: 280 }} placeholder="Search voucher, ledger or narration" value={search} onChange={e => setSearch(e.target.value)} />
            <select className="inp" style={{ maxWidth: 160 }} value={typeFilter} onChange={e => setTypeFilter(e.target.value as any)}>
              <option value="all">All types</option>
              <option value="payment">Payment</option>
              <option value="receipt">Receipt</option>
              <option value="contra">Contra</option>
              <option value="journal">Journal</option>
              <option value="purchase">Purchase</option>
            </select>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(['payment', 'receipt', 'contra', 'journal', 'purchase'] as VoucherType[]).map(t => (
                <button key={t} className="btn btn-primary" onClick={() => { setShowVoucherForm(t); setVForm({ narration: '', amount: '', ledger: 'Cash', date: new Date().toISOString().slice(0, 10) }); }} style={{ fontSize: 12 }}>
                  + {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Voucher form modal */}
          {showVoucherForm && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
              onClick={e => e.target === e.currentTarget && setShowVoucherForm(null)}>
              <div className="card" style={{ width: 400 }}>
                <h3 style={{ fontWeight: 700, marginBottom: 16, textTransform: 'capitalize' }}>+ {showVoucherForm}</h3>
                {[
                  { label: 'Date', key: 'date', type: 'date' },
                  { label: 'Narration', key: 'narration', type: 'text' },
                  { label: 'Ledger', key: 'ledger', type: 'text' },
                  { label: 'Amount', key: 'amount', type: 'number' },
                ].map(f => (
                  <div key={f.key} style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>{f.label}</label>
                    <input className="inp" type={f.type} value={(vForm as any)[f.key]} onChange={e => setVForm(p => ({ ...p, [f.key]: e.target.value }))} />
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
                  <button className="btn" onClick={() => setShowVoucherForm(null)}>Cancel</button>
                  <button className="btn btn-primary" onClick={saveVoucher}>Save</button>
                </div>
              </div>
            </div>
          )}

          {(() => {
            const posRows = paidOrders.filter(o => {
              if (typeFilter !== 'all' && typeFilter !== 'receipt') return false;
              if (search && !o.no.toLowerCase().includes(search.toLowerCase())) return false;
              return true;
            });
            const totalRows = filtered.length + posRows.length;
            const pageFiltered = filtered.slice((dayBookPage - 1) * PAGE_SIZE, dayBookPage * PAGE_SIZE);
            const pagePosRows = posRows.slice(Math.max(0, (dayBookPage - 1) * PAGE_SIZE - filtered.length), dayBookPage * PAGE_SIZE - filtered.length);
            return (
              <>
                <TblWrap>
                  <thead><tr><th>#</th><th>Date</th><th>Type</th><th>Narration</th><th>Ledger</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
                  <tbody>
                    {pageFiltered.map(v => (
                      <tr key={v.id}>
                        <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{v.no}</td>
                        <td style={{ fontSize: 12, color: 'var(--text2)' }}>{v.date}</td>
                        <td><span className="badge" style={{ background: TYPE_COLOR[v.type] + '22', color: TYPE_COLOR[v.type], border: `1px solid ${TYPE_COLOR[v.type]}44`, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>{v.type}</span></td>
                        <td>{v.narration}</td>
                        <td style={{ color: 'var(--text2)' }}>{v.ledger}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(v.amount)}</td>
                      </tr>
                    ))}
                    {pagePosRows.map(o => (
                      <tr key={o.id} style={{ opacity: 0.7 }}>
                        <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{o.no}</td>
                        <td style={{ fontSize: 12, color: 'var(--text2)' }}>{o.ts.slice(0, 10)}</td>
                        <td><span className="badge" style={{ background: 'var(--green)22', color: 'var(--green)', border: '1px solid var(--green)44', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>receipt</span></td>
                        <td>POS Sale</td>
                        <td style={{ color: 'var(--text2)', textTransform: 'capitalize' }}>{o.method}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(o.total)}</td>
                      </tr>
                    ))}
                    {!totalRows && (
                      <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text2)', padding: 40 }}>No vouchers in this range.</td></tr>
                    )}
                  </tbody>
                </TblWrap>
                <Pagination total={totalRows} page={dayBookPage} pageSize={PAGE_SIZE} onChange={setDayBookPage} />
              </>
            );
          })()}
        </div>
      )}

      {/* ── LEDGERS ──────────────────────────────────────────────── */}
      {tab === 'ledgers' && (
        <div>
          {[
            { name: 'Sales Revenue', entries: paidOrders.map(o => ({ date: o.ts.slice(0, 10), no: o.no, dr: 0, cr: o.total })) },
            { name: 'Cash', entries: paidOrders.filter(o => (o.method ?? '').toLowerCase().includes('cash')).map(o => ({ date: o.ts.slice(0, 10), no: o.no, dr: o.total, cr: 0 })) },
            { name: 'Bank Account', entries: paidOrders.filter(o => !(o.method ?? '').toLowerCase().includes('cash')).map(o => ({ date: o.ts.slice(0, 10), no: o.no, dr: o.total, cr: 0 })) },
            { name: 'VAT Payable', entries: paidOrders.filter(o => o.tax > 0).map(o => ({ date: o.ts.slice(0, 10), no: o.no, dr: 0, cr: o.tax })) },
          ].map(ledger => {
            const balance = ledger.entries.reduce((s, e) => s + e.dr - e.cr, 0);
            return (
              <div key={ledger.name} style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700 }}>{ledger.name}</h3>
                  <span style={{ fontSize: 12, color: 'var(--text2)' }}>Balance: <strong>{fmt(Math.abs(balance))}</strong> {balance >= 0 ? 'Dr' : 'Cr'}</span>
                </div>
                <TblWrap>
                  <thead><tr><th>Date</th><th>#</th><th style={{ textAlign: 'right' }}>Debit</th><th style={{ textAlign: 'right' }}>Credit</th></tr></thead>
                  <tbody>
                    {ledger.entries.slice(-20).map((e, i) => (
                      <tr key={i}>
                        <td style={{ fontSize: 12, color: 'var(--text2)' }}>{e.date}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{e.no}</td>
                        <td style={{ textAlign: 'right', color: e.dr > 0 ? 'var(--green)' : 'var(--text2)' }}>{e.dr > 0 ? fmt(e.dr) : '—'}</td>
                        <td style={{ textAlign: 'right', color: e.cr > 0 ? 'var(--red)' : 'var(--text2)' }}>{e.cr > 0 ? fmt(e.cr) : '—'}</td>
                      </tr>
                    ))}
                    {!ledger.entries.length && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text2)', padding: 24 }}>No entries</td></tr>}
                  </tbody>
                </TblWrap>
              </div>
            );
          })}
        </div>
      )}

      {/* ── GENERAL LEDGER ───────────────────────────────────────── */}
      {tab === 'generalledger' && (() => {
        const entries = db.journalEntries ?? [];
        const inRange = entries.filter(e => e.date >= from && e.date <= to);
        const ledgerNames = Array.from(new Set(inRange.flatMap(e => [e.debitLedger, e.creditLedger]))).sort();
        const glFiltered = glLedger === 'all' ? inRange : inRange.filter(e => e.debitLedger === glLedger || e.creditLedger === glLedger);
        const glPaged = glFiltered.slice((glPage - 1) * PAGE_SIZE, glPage * PAGE_SIZE);
        return (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              <select className="inp" style={{ maxWidth: 220 }} value={glLedger} onChange={e => { setGlLedger(e.target.value); setGlPage(1); }}>
                <option value="all">All accounts</option>
                {ledgerNames.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <span style={{ fontSize: 12, color: 'var(--text2)' }}>{glFiltered.length} entries auto-posted from sales</span>
            </div>
            {glFiltered.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', color: 'var(--text2)', padding: 48 }}>
                No journal entries yet. Entries are auto-posted when orders are charged at the Register.
              </div>
            ) : (
              <>
                <TblWrap>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Description</th>
                      <th>Debit</th>
                      <th>Credit</th>
                      <th style={{ textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {glPaged.map(e => (
                      <tr key={e.id}>
                        <td style={{ fontSize: 12, color: 'var(--text2)', whiteSpace: 'nowrap' }}>{e.date}</td>
                        <td style={{ fontSize: 13 }}>{e.description}</td>
                        <td style={{ fontSize: 12, color: 'var(--green)', fontWeight: 500 }}>{e.debitLedger}</td>
                        <td style={{ fontSize: 12, color: 'var(--red)', fontWeight: 500 }}>{e.creditLedger}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(e.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </TblWrap>
                <Pagination total={glFiltered.length} page={glPage} pageSize={PAGE_SIZE} onChange={setGlPage} />
              </>
            )}
          </div>
        );
      })()}

      {/* ── CHART OF ACCOUNTS ────────────────────────────────────── */}
      {tab === 'coa' && (
        <TblWrap>
          <thead><tr><th>Code</th><th>Account name</th><th>Group</th><th>Type</th></tr></thead>
          <tbody>
            {DEFAULT_COA.map(a => (
              <tr key={a.code}>
                <td style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--text2)' }}>{a.code}</td>
                <td style={{ fontWeight: 500 }}>{a.name}</td>
                <td style={{ color: 'var(--text2)', fontSize: 13 }}>{a.group}</td>
                <td style={{ fontSize: 12, color: 'var(--text2)' }}>{a.type}</td>
              </tr>
            ))}
          </tbody>
        </TblWrap>
      )}

      {/* ── TRIAL BALANCE ─────────────────────────────────────────── */}
      {tab === 'trialbalance' && (
        <TblWrap>
          <thead><tr><th>Account</th><th style={{ textAlign: 'right' }}>Debit</th><th style={{ textAlign: 'right' }}>Credit</th></tr></thead>
          <tbody>
            {[
              { account: 'Sales Revenue',   dr: 0,           cr: totalSales },
              { account: 'VAT Payable',     dr: 0,           cr: totalTax },
              { account: 'Discounts Given', dr: totalDisc,   cr: 0 },
              { account: 'COGS',            dr: totalCOGS,   cr: 0 },
              { account: 'Inventory',       dr: stockValue,  cr: 0 },
              { account: 'Receivables',     dr: totalDebt,   cr: 0 },
              { account: 'Retained Earnings', dr: 0, cr: grossProfit > 0 ? grossProfit : 0 },
            ].map((r, i) => (
              <tr key={i}>
                <td>{r.account}</td>
                <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{r.dr ? fmt(r.dr) : '—'}</td>
                <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{r.cr ? fmt(r.cr) : '—'}</td>
              </tr>
            ))}
            <tr style={{ fontWeight: 700, borderTop: '2px solid var(--border)' }}>
              <td>Totals</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(totalDisc + totalCOGS + stockValue + totalDebt)}</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(totalSales + totalTax + (grossProfit > 0 ? grossProfit : 0))}</td>
            </tr>
          </tbody>
        </TblWrap>
      )}

      {/* ── PROFIT & LOSS ─────────────────────────────────────────── */}
      {tab === 'pl' && (
        <div style={{ maxWidth: 560 }}>
          {[
            { label: 'Gross sales',                        value: totalSales,                               bold: false },
            { label: `Less: Tax (${settings.taxLabel})`,   value: -totalTax,                                bold: false },
            { label: 'Less: Discounts',                    value: -totalDisc,                               bold: false },
            { label: 'Net revenue',                        value: totalSales - totalTax - totalDisc,        bold: true, border: true },
            { label: 'Cost of goods sold',                 value: -totalCOGS,                               bold: false },
            { label: 'Gross profit',                       value: grossProfit, bold: true, border: true, color: grossProfit >= 0 ? 'var(--green)' : 'var(--red)' },
          ].map((row, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', borderBottom: row.border ? '2px solid var(--border)' : '1px solid var(--border)', fontWeight: row.bold ? 700 : 400 }}>
              <span style={{ color: row.bold ? 'inherit' : 'var(--text2)' }}>{row.label}</span>
              <span style={{ color: row.color ?? (row.value < 0 ? 'var(--red)' : 'inherit') }}>{row.value < 0 ? `(${fmt(-row.value)})` : fmt(row.value)}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── BALANCE SHEET ─────────────────────────────────────────── */}
      {tab === 'balancesheet' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, maxWidth: 700 }}>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: 'var(--accent)' }}>Assets</h3>
            {[
              { label: 'Cash', value: cashReceipts },
              { label: 'Bank', value: bankReceipts },
              { label: 'Inventory (retail)', value: stockValue },
              { label: 'Receivables', value: totalDebt },
            ].map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 13 }}>{r.label}</span>
                <span style={{ fontWeight: 600 }}>{fmt(r.value)}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', fontWeight: 700, fontSize: 15 }}>
              <span>Total assets</span><span>{fmt(cashReceipts + bankReceipts + stockValue + totalDebt)}</span>
            </div>
          </div>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: 'var(--red)' }}>Liabilities &amp; Equity</h3>
            {[
              { label: 'VAT payable', value: totalTax },
              { label: 'Retained earnings', value: grossProfit },
            ].map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 13 }}>{r.label}</span>
                <span style={{ fontWeight: 600 }}>{fmt(r.value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── CASH / BANK BOOK ──────────────────────────────────────── */}
      {tab === 'cashbook' && (
        <div>
          <div className="kpi-grid" style={{ marginBottom: 20 }}>
            <div className="kpi"><div className="kpi-label">Cash receipts</div><div className="kpi-value">{fmt(cashReceipts)}</div></div>
            <div className="kpi"><div className="kpi-label">Bank receipts</div><div className="kpi-value">{fmt(bankReceipts)}</div></div>
            <div className="kpi"><div className="kpi-label">Total</div><div className="kpi-value">{fmt(totalSales)}</div></div>
          </div>
          <TblWrap>
            <thead><tr><th>Date</th><th>#</th><th style={{ textAlign: 'right' }}>Amount</th><th>Method</th></tr></thead>
            <tbody>
              {paidOrders.slice().reverse().map(o => (
                <tr key={o.id}>
                  <td style={{ fontSize: 12, color: 'var(--text2)' }}>{new Date(o.ts).toLocaleDateString()}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{o.no}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(o.total)}</td>
                  <td style={{ textTransform: 'capitalize', fontSize: 12 }}>{o.method}</td>
                </tr>
              ))}
              {!paidOrders.length && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text2)', padding: 32 }}>No entries</td></tr>}
            </tbody>
          </TblWrap>
        </div>
      )}

      {/* ── VAT ───────────────────────────────────────────────────── */}
      {tab === 'vat' && (
        <div>
          <div className="kpi-grid" style={{ marginBottom: 20 }}>
            <div className="kpi"><div className="kpi-label">Output tax</div><div className="kpi-value">{fmt(totalTax)}</div></div>
            <div className="kpi"><div className="kpi-label">Net sales</div><div className="kpi-value">{fmt(totalSales - totalTax)}</div></div>
            <div className="kpi"><div className="kpi-label">Rate</div><div className="kpi-value">{settings.taxRate}%</div></div>
          </div>
          <TblWrap>
            <thead><tr><th>Month</th><th style={{ textAlign: 'right' }}>Net</th><th style={{ textAlign: 'right' }}>Tax</th><th style={{ textAlign: 'right' }}>Gross</th></tr></thead>
            <tbody>
              {vatByMonth.map(r => (
                <tr key={r.month}>
                  <td>{r.month}</td>
                  <td style={{ textAlign: 'right' }}>{fmt(r.net)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(r.tax)}</td>
                  <td style={{ textAlign: 'right' }}>{fmt(r.net + r.tax)}</td>
                </tr>
              ))}
              {!vatByMonth.length && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text2)', padding: 32 }}>No taxable sales in period</td></tr>}
            </tbody>
          </TblWrap>
        </div>
      )}

      {/* ── OUTSTANDING ───────────────────────────────────────────── */}
      {tab === 'outstanding' && (
        <div>
          <h3 style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Customer receivables</h3>
          <TblWrap>
            <thead><tr><th>Customer</th><th>Phone</th><th style={{ textAlign: 'right' }}>Balance owing</th><th style={{ textAlign: 'right' }}>Credit limit</th></tr></thead>
            <tbody>
              {db.customers.filter(c => (c.balance ?? 0) > 0).map(c => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 500 }}>{c.name}</td>
                  <td style={{ color: 'var(--text2)' }}>{c.phone ?? '—'}</td>
                  <td style={{ textAlign: 'right', color: 'var(--red)', fontWeight: 700 }}>{fmt(c.balance ?? 0)}</td>
                  <td style={{ textAlign: 'right' }}>{c.creditLimit != null ? fmt(c.creditLimit) : '—'}</td>
                </tr>
              ))}
              {!db.customers.filter(c => (c.balance ?? 0) > 0).length && (
                <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text2)', padding: 32 }}>No outstanding balances</td></tr>
              )}
            </tbody>
          </TblWrap>
        </div>
      )}

      {/* ── BOOKS & CHECKS ────────────────────────────────────────── */}
      {tab === 'bookschecks' && (
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Data integrity checks</h3>
            {[
              { label: 'Orders with missing total', ok: db.orders.every(o => o.total >= 0), detail: `${db.orders.filter(o => o.total < 0).length} found` },
              { label: 'Products with negative stock', ok: db.products.every(p => p.stock >= 0), detail: `${db.products.filter(p => p.stock < 0).length} found` },
              { label: 'Customers with over-limit balance', ok: db.customers.every(c => !c.creditLimit || (c.balance ?? 0) <= c.creditLimit), detail: `${db.customers.filter(c => c.creditLimit && (c.balance ?? 0) > c.creditLimit).length} found` },
            ].map((c, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 14 }}>{c.label}</span>
                <span style={{ fontWeight: 700, color: c.ok ? 'var(--green)' : 'var(--red)' }}>{c.ok ? '✓ Pass' : `✗ ${c.detail}`}</span>
              </div>
            ))}
          </div>
          <div className="card">
            <h3 style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Book summary</h3>
            {[
              { label: 'Total orders recorded', value: String(db.orders.length) },
              { label: 'Products in system', value: String(db.products.length) },
              { label: 'Active customers', value: String(db.customers.filter(c => c.status !== 'inactive').length) },
              { label: 'Vouchers (manual)', value: String(vouchers.length) },
            ].map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text2)', fontSize: 13 }}>{r.label}</span>
                <span style={{ fontWeight: 600 }}>{r.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
