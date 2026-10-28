import Link from 'next/link';

const PILLARS = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </svg>
    ),
    label: 'ERP & Operations',
    color: '#124DF8',
    bg: '#EEF2FF',
    items: ['Inventory & stock control', 'Multi-branch management', 'Double-entry accounting', 'UAE e-invoicing & ZATCA'],
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    label: 'HRM & Payroll',
    color: '#7C3AED',
    bg: '#F5F3FF',
    items: ['Employee directory', 'Shift & time tracking', 'Payroll exports', 'Leave & attendance'],
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
        <polyline points="17 6 23 6 23 12" />
      </svg>
    ),
    label: 'CRM & Sales',
    color: '#00897B',
    bg: '#E0F2F1',
    items: ['Lead pipelines & Kanban', 'Customer loyalty programs', 'WhatsApp integration', 'AI sales forecasting'],
  },
];

const INDUSTRIES = [
  'Restaurants & F&B',
  'Retail & E-Commerce',
  'Healthcare & Clinics',
  'Automotive & Garages',
  'Professional Services',
  'Franchises & Multi-Branch',
];

export default function LandingPage() {
  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { font-family: Inter, system-ui, -apple-system, sans-serif; background: #fff; color: #10123A; -webkit-font-smoothing: antialiased; }
        a { text-decoration: none; color: inherit; }
        :root {
          --navy: #07004A;
          --navy2: #0A0055;
          --blue: #124DF8;
          --cyan: #00D4E4;
          --ink: #10123A;
          --muted: #5A5F86;
          --line: #E1E5EF;
          --soft: #F4F6FB;
          --radius: 14px;
        }
        .wrap { max-width: 1160px; margin: 0 auto; padding: 0 20px; }

        /* ── NAV ── */
        nav {
          position: sticky; top: 0; z-index: 50;
          background: rgba(255,255,255,.94); backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--line);
        }
        .nav-inner {
          display: flex; align-items: center; justify-content: space-between;
          height: 68px;
        }
        .brand {
          display: flex; align-items: center; gap: 10px;
          font-weight: 800; font-size: 21px; color: var(--navy2);
          letter-spacing: -.02em;
        }
        .brand-logo { display: flex; flex-direction: column; gap: 3px; }
        .brand-logo span { display: block; height: 3px; border-radius: 2px; }
        .brand-logo span:nth-child(1) { width: 18px; background: var(--cyan); }
        .brand-logo span:nth-child(2) { width: 26px; background: var(--blue); }
        .brand-logo span:nth-child(3) { width: 18px; background: var(--navy2); }
        .brand-word { color: var(--navy2); }
        .brand-word em { font-style: normal; color: var(--blue); font-weight: 500; }
        .nav-links { display: flex; gap: 6px; align-items: center; }
        .nav-link {
          font-size: 14px; font-weight: 500; color: var(--muted);
          padding: 6px 12px; border-radius: 8px;
          transition: color .15s, background .15s;
        }
        .nav-link:hover { color: var(--navy2); background: var(--soft); }
        .btn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 9px 18px; border-radius: 10px; font-weight: 600;
          font-size: 14px; border: 2px solid transparent; cursor: pointer;
          transition: transform .15s, background .15s, box-shadow .15s;
          white-space: nowrap;
        }
        .btn:hover { transform: translateY(-1px); }
        .btn-primary { background: var(--blue); color: #fff; }
        .btn-primary:hover { background: #0d3fd0; box-shadow: 0 4px 20px rgba(18,77,248,.35); }
        .btn-ghost-nav { border-color: var(--line); color: var(--ink); background: #fff; font-size: 14px; }
        .btn-ghost-nav:hover { border-color: #aab; background: var(--soft); }
        .btn-outline-white { border-color: rgba(255,255,255,.35); color: #fff; background: transparent; }
        .btn-outline-white:hover { background: rgba(255,255,255,.1); }
        .nav-mobile-hide { display: flex; gap: 6px; align-items: center; }

        /* ── HERO ── */
        .hero {
          background: var(--navy2);
          position: relative; overflow: hidden;
        }
        .hero::before {
          content: ""; position: absolute; inset: 0; pointer-events: none;
          background:
            radial-gradient(ellipse 60% 70% at 80% 50%, rgba(0,212,228,.08), transparent 65%),
            radial-gradient(ellipse 40% 50% at 20% 80%, rgba(18,77,248,.18), transparent 60%),
            repeating-linear-gradient(0deg, rgba(18,77,248,.1) 0 1px, transparent 1px 28px);
          mask-image: linear-gradient(90deg, transparent 10%, #000 70%);
          -webkit-mask-image: linear-gradient(90deg, transparent 10%, #000 70%);
        }
        .hero-inner {
          position: relative;
          display: grid; grid-template-columns: 1.05fr .95fr; gap: 56px;
          align-items: center;
          padding-top: 88px; padding-bottom: 104px;
        }
        .eyebrow {
          display: inline-block; font-size: 11px; font-weight: 700;
          letter-spacing: .12em; text-transform: uppercase;
          color: var(--cyan); margin-bottom: 20px;
        }
        .hero h1 {
          font-size: clamp(34px, 4.5vw, 56px); font-weight: 800;
          color: #fff; line-height: 1.08; letter-spacing: -.025em; margin-bottom: 22px;
        }
        .hero h1 em { font-style: normal; color: var(--cyan);
          text-shadow: 0 0 40px rgba(0,212,228,.45); }
        .hero p {
          font-size: 18px; color: #BEC2EB; line-height: 1.7;
          max-width: 500px; margin-bottom: 36px;
        }
        .hero-actions { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
        .hero-note { margin-top: 20px; font-size: 13px; color: #7E83B8; }
        .hero-note span { color: var(--cyan); opacity: .8; }

        /* ── DASHBOARD MOCK ── */
        .dash-mock {
          background: #fff; border-radius: 16px;
          box-shadow: 0 48px 120px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.1);
          overflow: hidden; pointer-events: none;
        }
        .dash-bar {
          display: flex; gap: 5px; align-items: center; padding: 10px 14px;
          background: #F0F2F8; border-bottom: 1px solid #E1E5EF;
        }
        .dash-dot { width: 9px; height: 9px; border-radius: 50%; background: #CBD0E3; }
        .dash-tabs {
          display: flex; gap: 0;
          border-bottom: 1px solid #E1E5EF; background: #fff;
        }
        .dash-tab {
          flex: 1; text-align: center; font-size: 9px; font-weight: 700;
          padding: 7px 4px; color: #8891B0; letter-spacing: .04em; text-transform: uppercase;
          border-bottom: 2px solid transparent;
        }
        .dash-tab.active { color: var(--blue); border-bottom-color: var(--blue); }

        /* ERP panel */
        .erp-panel { padding: 10px 12px; }
        .erp-row {
          display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 4px;
          font-size: 9px; padding: 5px 0; border-bottom: 1px solid #F0F2F8;
          align-items: center;
        }
        .erp-row.head { font-weight: 700; color: #8891B0; text-transform: uppercase; }
        .erp-row.head { font-size: 8px; }
        .erp-name { font-weight: 600; color: #10123A; }
        .erp-stock { color: #5A5F86; text-align: right; }
        .erp-badge {
          font-size: 8px; font-weight: 700; padding: 2px 6px; border-radius: 99px;
          text-align: right;
        }
        .erp-badge.ok { background: #D1FAE5; color: #065F46; }
        .erp-badge.low { background: #FEE2E2; color: #991B1B; }

        /* HRM panel */
        .hrm-panel { padding: 10px 12px; }
        .hrm-emp {
          display: flex; gap: 7px; align-items: center;
          padding: 5px 0; border-bottom: 1px solid #F0F2F8;
          font-size: 9px;
        }
        .hrm-avatar {
          width: 22px; height: 22px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 9px; font-weight: 700; color: #fff; flex-shrink: 0;
        }
        .hrm-name { font-weight: 600; color: #10123A; flex: 1; }
        .hrm-role { color: #8891B0; }
        .hrm-status {
          font-size: 8px; font-weight: 700; padding: 2px 6px; border-radius: 99px;
        }
        .hrm-status.clocked { background: #D1FAE5; color: #065F46; }
        .hrm-status.off { background: #F3F4F6; color: #6B7280; }

        /* CRM panel */
        .crm-panel { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; padding: 10px 12px; }
        .crm-col-head { font-size: 8px; font-weight: 700; color: #8891B0; text-transform: uppercase; margin-bottom: 5px; }
        .crm-card {
          background: #F8F9FC; border: 1px solid #E1E5EF; border-radius: 6px;
          padding: 6px 7px; margin-bottom: 5px;
        }
        .crm-card-name { font-size: 9px; font-weight: 600; color: #10123A; }
        .crm-card-val { font-size: 8px; color: #8891B0; margin-top: 2px; }

        /* ── INDUSTRY STRIP ── */
        .strip {
          border-top: 1px solid var(--line); border-bottom: 1px solid var(--line);
          padding: 20px 0;
        }
        .strip-inner {
          display: flex; flex-wrap: wrap; gap: 10px 32px;
          justify-content: center; align-items: center;
        }
        .strip-item {
          display: flex; align-items: center; gap: 7px;
          font-size: 13px; font-weight: 600; color: var(--muted);
        }
        .strip-dot { width: 8px; height: 8px; border-radius: 2px; background: var(--cyan); flex-shrink: 0; }

        /* ── PILLARS ── */
        .pillars { padding: 88px 0; }
        .section-head { text-align: center; margin-bottom: 56px; }
        .section-head h2 {
          font-size: clamp(28px, 3.5vw, 42px); font-weight: 800;
          color: var(--navy2); letter-spacing: -.02em; margin-bottom: 14px;
        }
        .section-head p { font-size: 17px; color: var(--muted); max-width: 560px; margin: 0 auto; line-height: 1.6; }
        .pillar-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
        .pillar-card {
          border: 1px solid var(--line); border-radius: 18px;
          padding: 32px; background: #fff;
          transition: border-color .2s, box-shadow .2s, transform .2s;
        }
        .pillar-card:hover { border-color: #b0bcff; box-shadow: 0 12px 40px rgba(18,77,248,.1); transform: translateY(-3px); }
        .pillar-icon-wrap {
          width: 48px; height: 48px; border-radius: 14px;
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 18px;
        }
        .pillar-card h3 { font-size: 19px; font-weight: 800; color: var(--navy2); margin-bottom: 16px; }
        .pillar-list { list-style: none; display: flex; flex-direction: column; gap: 9px; }
        .pillar-list li { display: flex; align-items: center; gap: 8px; font-size: 14px; color: var(--muted); }
        .pillar-check { width: 16px; height: 16px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 9px; color: #fff; font-weight: 700; }

        /* ── STATS ── */
        .stats-band { background: var(--soft); border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
        .stats-inner { display: flex; justify-content: space-around; gap: 16px; padding: 44px 0; flex-wrap: wrap; }
        .stat { text-align: center; }
        .stat-num { font-size: 34px; font-weight: 800; color: var(--navy2); letter-spacing: -.02em; }
        .stat-num em { font-style: normal; color: var(--blue); }
        .stat-label { font-size: 13px; color: var(--muted); margin-top: 6px; }

        /* ── CTA ── */
        .cta-section {
          background: var(--navy2); padding: 88px 0; text-align: center;
          position: relative; overflow: hidden;
        }
        .cta-section::before {
          content: ""; position: absolute; inset: 0; pointer-events: none;
          background: radial-gradient(ellipse 60% 60% at 50% 50%, rgba(0,212,228,.08), transparent 70%);
        }
        .cta-section h2 { font-size: clamp(26px, 3.5vw, 42px); font-weight: 800; color: #fff; margin-bottom: 16px; position: relative; }
        .cta-section p { font-size: 17px; color: #BEC2EB; margin-bottom: 36px; max-width: 500px; margin-left: auto; margin-right: auto; position: relative; }
        .cta-btns { display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; position: relative; }

        /* ── FOOTER ── */
        footer {
          border-top: 1px solid var(--line); padding: 28px 0;
          display: flex; justify-content: space-between; align-items: center;
          font-size: 13px; color: var(--muted); flex-wrap: wrap; gap: 12px;
        }
        .footer-brand { font-weight: 800; color: var(--navy2); font-size: 15px; }

        /* ── RESPONSIVE ── */
        @media (max-width: 900px) {
          .nav-mobile-hide { display: none; }
          .hero-inner { grid-template-columns: 1fr; }
          .dash-mock { display: none; }
          .pillar-grid { grid-template-columns: 1fr; }
          .hero p { font-size: 16px; }
        }
        @media (max-width: 640px) {
          .stats-inner { gap: 32px; }
          footer { flex-direction: column; text-align: center; }
          .strip-inner { gap: 8px 20px; }
        }
      `}</style>

      {/* ── NAV ── */}
      <nav>
        <div className="wrap">
          <div className="nav-inner">
            <div className="brand">
              <div className="brand-logo">
                <span />
                <span />
                <span />
              </div>
              <span className="brand-word">Harbinger <em>ERP</em></span>
            </div>
            <div className="nav-mobile-hide nav-links">
              {['Platform', 'Features', 'AI', 'Pricing', 'FAQ'].map(l => (
                <a key={l} href={`#${l.toLowerCase()}`} className="nav-link">{l}</a>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Link href="/login" className="btn btn-ghost-nav">Sign in</Link>
              <Link href="/dashboard" className="btn btn-primary">Book a demo</Link>
            </div>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="hero">
        <div className="wrap">
          <div className="hero-inner">
            {/* Left copy */}
            <div>
              <span className="eyebrow">ERP · HRM · CRM — GCC Edition</span>
              <h1>
                One Platform to Run<br />
                Your <em>Entire Business.</em>
              </h1>
              <p>
                Unify your ERP, HRM, and CRM. Manage inventory, staff,
                payroll, and customer pipelines from a single,
                lightning-fast dashboard.
              </p>
              <div className="hero-actions">
                <Link href="/dashboard" className="btn btn-primary" style={{ fontSize: 16, padding: '13px 28px' }}>
                  Book a live demo
                </Link>
                <Link href="/login" className="btn btn-outline-white" style={{ fontSize: 15 }}>
                  Try the live app
                </Link>
              </div>
              <div className="hero-note">
                <span>Arabic &amp; English</span> · <span>UAE VAT ready</span> · <span>Works offline</span>
              </div>
            </div>

            {/* Right: Tabbed Dashboard Mockup */}
            <div className="dash-mock">
              <div className="dash-bar">
                <div className="dash-dot" /><div className="dash-dot" /><div className="dash-dot" />
              </div>
              <div className="dash-tabs">
                <div className="dash-tab active">ERP</div>
                <div className="dash-tab">HRM</div>
                <div className="dash-tab">CRM</div>
              </div>

              {/* ERP: Inventory list */}
              <div className="erp-panel">
                <div style={{ fontSize: 9, fontWeight: 700, color: '#8891B0', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>Inventory — Branch 1</div>
                <div className="erp-row head">
                  <span>Product</span><span style={{ textAlign: 'right' }}>Stock</span><span style={{ textAlign: 'right' }}>Status</span>
                </div>
                {[
                  { name: 'Chicken Wrap', stock: '42 pcs', ok: true },
                  { name: 'Club Sandwich', stock: '18 pcs', ok: true },
                  { name: 'Fresh Juice', stock: '5 pcs', ok: false },
                  { name: 'Milk Shake', stock: '0 pcs', ok: false },
                  { name: 'French Fries', stock: '90 pcs', ok: true },
                ].map(r => (
                  <div key={r.name} className="erp-row">
                    <span className="erp-name">{r.name}</span>
                    <span className="erp-stock">{r.stock}</span>
                    <span className={`erp-badge ${r.ok ? 'ok' : 'low'}`}>{r.ok ? 'OK' : 'LOW'}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, padding: '6px 0', borderTop: '1px solid #F0F2F8' }}>
                  <span style={{ fontSize: 8, color: '#8891B0' }}>5 of 240 items</span>
                  <div style={{ background: '#124DF8', color: '#fff', fontSize: 8, fontWeight: 700, padding: '3px 8px', borderRadius: 6 }}>View All</div>
                </div>
              </div>

              {/* HRM: Employee list (hidden via CSS tab logic — shown inline as second block) */}
              <div style={{ borderTop: '1px solid #E1E5EF', display: 'none' }}>
                <div className="hrm-panel">
                  {[
                    { name: 'Sara Al Mansouri', role: 'Manager', color: '#7C3AED', clocked: true },
                    { name: 'Ahmed Khalid', role: 'Cashier', color: '#124DF8', clocked: true },
                    { name: 'Fatima Noor', role: 'Chef', color: '#00897B', clocked: false },
                  ].map(e => (
                    <div key={e.name} className="hrm-emp">
                      <div className="hrm-avatar" style={{ background: e.color }}>{e.name[0]}</div>
                      <div style={{ flex: 1 }}>
                        <div className="hrm-name">{e.name}</div>
                        <div className="hrm-role">{e.role}</div>
                      </div>
                      <div className={`hrm-status ${e.clocked ? 'clocked' : 'off'}`}>{e.clocked ? 'Clocked In' : 'Day Off'}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* CRM: Kanban (hidden) */}
              <div style={{ borderTop: '1px solid #E1E5EF', display: 'none' }}>
                <div className="crm-panel">
                  {[
                    { col: 'Lead', cards: [{ name: 'Al Faris Group', val: 'AED 12K' }, { name: 'Noon Retail', val: 'AED 8K' }] },
                    { col: 'Proposal', cards: [{ name: 'Majid Al Futtaim', val: 'AED 45K' }] },
                    { col: 'Won', cards: [{ name: 'Carrefour UAE', val: 'AED 90K' }] },
                  ].map(col => (
                    <div key={col.col}>
                      <div className="crm-col-head">{col.col}</div>
                      {col.cards.map(c => (
                        <div key={c.name} className="crm-card">
                          <div className="crm-card-name">{c.name}</div>
                          <div className="crm-card-val">{c.val}</div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── INDUSTRY STRIP ── */}
      <div className="strip">
        <div className="wrap">
          <div className="strip-inner">
            {INDUSTRIES.map(ind => (
              <div key={ind} className="strip-item">
                <div className="strip-dot" />
                {ind}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── PILLARS SECTION ── */}
      <section className="pillars" id="features">
        <div className="wrap">
          <div className="section-head">
            <h2>Everything your business runs on,<br />in one platform</h2>
            <p>Five connected surfaces share one catalogue, one stock ledger and one guest profile — no syncing, no double entry, no blind spots.</p>
          </div>
          <div className="pillar-grid">
            {PILLARS.map(p => (
              <div key={p.label} className="pillar-card">
                <div className="pillar-icon-wrap" style={{ background: p.bg, color: p.color }}>
                  {p.icon}
                </div>
                <h3>{p.label}</h3>
                <ul className="pillar-list">
                  {p.items.map(item => (
                    <li key={item}>
                      <div className="pillar-check" style={{ background: p.color }}>✓</div>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="stats-band">
        <div className="wrap">
          <div className="stats-inner">
            {[
              ['21', '+', 'Report types built-in'],
              ['10', '+', 'Delivery app integrations'],
              ['5', '%', 'UAE VAT ready out of the box'],
              ['∞', '', 'Offline-first — no downtime'],
            ].map(([n, s, l]) => (
              <div key={l} className="stat">
                <div className="stat-num">{n}<em>{s}</em></div>
                <div className="stat-label">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="cta-section">
        <div className="wrap">
          <h2>Ready to run your entire business on Harbinger?</h2>
          <p>Sign in and start managing your ERP, HRM and CRM — your data stays private until you connect a cloud database.</p>
          <div className="cta-btns">
            <Link href="/dashboard" className="btn btn-primary" style={{ fontSize: 16, padding: '14px 32px' }}>
              Open Platform →
            </Link>
            <Link href="/login" className="btn btn-outline-white" style={{ fontSize: 15, padding: '14px 24px' }}>
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <div className="wrap">
        <footer>
          <span className="footer-brand">Harbinger ERP</span>
          <span>Built for the GCC · UAE VAT compliant · Offline-first</span>
          <a href="https://github.com/NagaVaddi/harbinger-pos" target="_blank" rel="noopener noreferrer" style={{ color: '#124DF8', fontWeight: 600 }}>
            GitHub →
          </a>
        </footer>
      </div>
    </>
  );
}
