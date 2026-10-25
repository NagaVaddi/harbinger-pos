# Harbinger POS — Original Product Specification (v1 draft)
Our own product. Same job as any restaurant/retail franchise POS (sell, stock, staff, report), but with Harbinger's own naming, information architecture, visual identity and workflows. No third-party branding, copy, layout or code is reused.

Items marked **[DECISION]** need owner confirmation.

---
## 1. Product Vision
**Harbinger POS** is a cloud point-of-sale and franchise operating system for food-service and retail groups in the GCC. It gives each outlet a fast register and gives head office one place to control menu, stock, people, pricing and money.

Principles
1. **Register first.** Selling must stay fast and work offline.
2. **One source of truth** for catalog, price, stock and cash across all outlets.
3. **Control without friction.** Approvals and limits are automatic, not manual chasing.
4. **Arabic + English** from day one, RTL native.
5. **Insights that tell you what to do**, not just charts.

## 2. Brand & Visual Identity (ours)
| Item | Choice |
|---|---|
| Name | Harbinger POS ("Harbinger Register" = terminal, "Harbinger Console" = back office). Master brand line: "An Innovation Partner" |
| Logo | Supplied file `Harbinger logo.pdf`, two options. **Option 1 "Signal bars"** (striped H-mark; navy / blue / cyan) and **Option 2 "Checker"** (pixel-checker mark; navy / red). **Chosen for the product: Option 1** (see below); Option 2 stays available as Theme B |
| Logo usage in product | Console sidebar: icon mark only (collapsed) / full wordmark (expanded). Register header: icon mark + outlet name. Login, receipts, emails: full lockup. Min clear space = height of the "H" bars; min icon size 24 px. Use white-on-navy, navy-on-white, navy-on-cyan or white-on-blue variants from the sheet; never recolor |
| Why Option 1 | Blue/cyan leaves red free as the universal "danger / void / refund" colour in a POS; Option 2's red brand colour would clash with error states. The stripe mark also maps well to a loading/skeleton motif and a pattern background (page 4 of the logo file) |
| **Theme A (default, from Option 1)** | Navy `#0A0055` (primary text, sidebar) · Brand blue `#124DF8` (primary buttons, links, selected) · Cyan `#00D4E4` (accent, highlights, charts) |
| Theme B (alternative, from Option 2) | Navy `#052846` · Brand red `#EE363B` (accent only) · White; danger colour must then shift to a deeper `#B3261E` with an icon + label to stay distinguishable |
| Semantic colours (both themes) | Success `#1F9D6B` · Warning `#E8A317` · Danger `#D6454B` (Theme A) · Info = brand blue |
| Surfaces | White `#FFFFFF`, cool grey page `#F4F6FB`, borders `#E1E5EF`; dark theme uses navy `#0A0055`→`#07003A` surfaces with cyan accents |
| Colour values note | Hex values were sampled from the PDF preview and are approximate; replace with exact values from the original vector/brand file **[DECISION]** |
| Type | Wordmark is custom; UI headings in **Montserrat** (matches the tagline lettering), body/UI **Inter**, Arabic **IBM Plex Sans Arabic** |
| Shape | 12px cards, 10px controls, 1px borders; horizontal-bar motif (from the mark) reused as section dividers and progress indicators |
| Layout | Console: collapsible left sidebar with labelled groups + command bar (Ctrl+K). Register: three-zone touch layout, large 48px targets |
| Motion | Short 150 ms transitions; bar-stagger loader derived from the logo; no decorative animation on the register |
| Tokens | Colours, radius, type and spacing are defined as design tokens so Theme A/B (and per-franchise white-label theming later) is a config change, not a rebuild |

## 3. Surfaces
| Surface | Users | Device |
|---|---|---|
| **Harbinger Console** (back office) | HQ, owners, managers, accountants | Desktop/tablet web |
| **Harbinger Register** (POS) | Cashiers, waiters | Tablet/desktop PWA, Android wrapper later |
| **Harbinger Kitchen** (KDS) | Kitchen staff | Wall screen/tablet |
| **Harbinger Rider** | Delivery riders | Mobile web/app |
| **Harbinger Mobile** (owner app) | Owners, managers | iOS/Android, later phase |

## 4. Console Information Architecture (our own structure)
| Group | Modules |
|---|---|
| **Command Center** | Live board, Alerts, Approvals inbox |
| **Catalog** | Items, Variants & Add-ons, Categories, Brands, Units, Menus & Schedules, Price Books, Bundles |
| **Stock Room** | Stock on hand, Lots & Expiry, Receiving, Purchase Orders, Suppliers, Transfers, Adjustments, Counts, Waste, Ledger |
| **Guests** | Directory, Segments, Loyalty, Gift cards, Feedback |
| **Promotions** | Offers (automatic), Codes, Happy hours, Campaigns |
| **Team** | People, Departments, Job titles, Roles & Access, Shifts, Attendance, Tips |
| **Outlets** | Outlets, Registers, Floor & Tables, Printers & Devices, Hours |
| **Dispatch** | Delivery partners, Riders, Zones & Fees, Live dispatch, Online ordering, Aggregators |
| **Money** | Payments, Cash control, Day close, Tax (VAT), Refunds, Accounting export |
| **Insights** | Reports library, Scheduled reports, Forecasts, Menu performance |
| **Control Panel** | Business profile, Localization, Tax & charges, Receipt designer, Integrations, API & webhooks, Security, Audit log, Billing |

Global: command bar (search anything), outlet switcher, date-range, notifications, language/theme, help.

## 5. Module Specifications

### 5.1 Command Center
- **Live board:** today's sales, orders, average order value, guests served, refunds, cash in drawer; compare to same day last week; per-outlet tiles with traffic-light health.
- **Hourly pulse:** sales by hour vs target.
- **Leaderboards:** top items, top outlets, top staff.
- **Alerts:** low stock, expiring lots, long-open registers, unusual voids, failed devices, unsynced registers.
- **Approvals inbox:** discount overrides, refunds, price changes, stock adjustments, POs awaiting action; approve/reject inline with note.
- Realtime via WebSocket; all widgets filterable by outlet group.

### 5.2 Catalog
**Items:** name (EN/AR), short code, barcode(s), category, brand, unit, description, photos, type (standard · weighed · bundle · service), cost, price, tax class, prep station, calories/allergens, tags, outlet availability, sellable channels (register / online / aggregator), status.
**Variants:** size/option grid with own SKU, barcode, price, cost.
**Add-ons:** groups with min/max, free/paid options, default selections.
**Bundles:** slot-based combos with allowed items and upcharges.
**Price Books:** base book plus overrides per outlet, channel, time window, customer tier; effective dates; bulk edit (± % or fixed) with preview and rollback.
**Menus & Schedules:** named menus (breakfast, Ramadan) mapped to outlets/times.
**Tools:** CSV/XLSX import with validation report, bulk image upload by SKU match, duplicate, archive, change history.

### 5.3 Stock Room
- **Stock on hand** per outlet with reorder levels, days-of-cover, value.
- **Lots & Expiry:** lot number, expiry, cost, quantity; FEFO picking suggestion; expiry heatmap.
- **Receiving:** receive against PO or blind receive; capture lot/expiry/cost; discrepancy flags.
- **Purchase Orders:** draft → approval → sent → partially/fully received → closed; supplier price memory; auto-suggest from reorder levels and forecast.
- **Suppliers:** contacts, terms, lead time, price list, performance (on-time, fill rate).
- **Transfers** between outlets with in-transit state.
- **Adjustments/Waste:** reason codes, photo, approval above value limit.
- **Counts:** scheduled or blind counts, variance report, post adjustments.
- **Ledger:** immutable movement history (who/what/when/why).
- Recipes/ingredient depletion (phase 2): selling an item deducts ingredients.
- Weighed items: scale integration, PLU/price-embedded barcode profiles.

### 5.4 Guests
- Directory: name, phones, email, birthday, addresses, notes, tags, consent flags.
- Profile timeline: orders, spend, favourites, visits, loyalty, feedback.
- Segments: rule builder (spend, recency, items, location) and saved lists.
- Loyalty: points or stamps, tiers, earn/burn rules, expiry, birthday rewards, enroll at register by phone.
- Gift cards: sell, reload, redeem, balance check.
- Feedback: post-order survey, rating alerts to managers.
- Merge duplicates, export, right-to-erase request handling.

### 5.5 Promotions
- **Offers (automatic):** rule engine — conditions (items, categories, qty, spend, time, tier, outlet) → actions (% off, amount off, free item, bundle price). Priority and stacking rules, budget cap, preview/simulate against last 7 days.
- **Codes:** single or generated batches, usage limits (total/per guest), validity, minimum spend, channel restrictions.
- **Happy hours:** recurring price windows.
- **Campaigns:** SMS/WhatsApp/email to segments with redemption tracking.

### 5.6 Team
- **People:** profile, photo, documents with expiry alerts (visa, ID, health card), outlet assignment, job title, department, pay rate, PIN, status.
- **Departments / Job titles:** hierarchy, default role mapping.
- **Roles & Access:** permission matrix per module/action, plus numeric limits (max discount %, refund cap, cash variance tolerance).
- **Shifts & Attendance:** rota, clock in/out at register, breaks, overtime, timesheet export.
- **Tips:** pooling rules and payout statements.

### 5.7 Outlets
- Outlet profile: name (EN/AR), code, address + map pin, hours, timezone, tax registration, service modes, contact.
- **Registers:** named terminals bound to outlet and devices; open/close status; assigned cashier; float.
- **Floor & Tables:** visual floor editor, table states, merge/split, QR per table.
- **Printers & Devices:** receipt, kitchen, label printers; cash drawer; scanner; scale; customer display; card terminal; routing rules (item → station → printer); heartbeat status.

### 5.8 Dispatch
- Delivery partners (in-house, 3rd party): commission, settlement terms, contact.
- Riders: profile, availability, live location, cash held.
- Zones & fees: polygons, fee tiers, minimum order, ETA.
- Live dispatch board: new → accepted → preparing → ready → out → delivered/failed; auto-assign; reassign; proof of delivery.
- Online ordering: branded storefront + QR table ordering, scheduled orders, payment links.
- Aggregators (Talabat, Deliveroo, Noon Food, Careem): menu/price sync, order injection, stock-out toggle, reconciliation.

### 5.9 Money
- **Payments:** cash, card terminal, wallet/QR, gift card, loyalty points, store credit, on-account; split tenders; tips; rounding rules.
- **Cash control:** register sessions, opening float, pay-in/pay-out vouchers with reason + attachment, drops, blind close count, variance with tolerance and approval.
- **Day close:** consolidated close per outlet (X/Z), locks the day, emails summary.
- **Tax:** UAE VAT 5%, TRN on receipts/invoices, VAT report and return helper.
- **Refunds:** full/partial, reason, approval, stock return option, refund-to-original-tender.
- **Accounting export:** daily journals to Zoho/QuickBooks/Xero or CSV.

### 5.10 Insights
Reports (all with outlet/date/channel filters, compare-to-previous, drilldown, export, schedule):
Sales summary · Sales by item/category/hour/channel/staff · Payments & reconciliation · Tax · Discounts & promotions · Voids/refunds/comps · Register & cashier sessions · Day-close (Z) · Margin per bill and per item · Stock valuation, usage, variance, expiry · Purchases & supplier performance · Guest cohorts and retention · Loyalty liability · Delivery performance · Aggregator reconciliation · Menu performance matrix · Outlet comparison · Custom report builder.
**Forecasts:** next-7-day demand per item/outlet; suggested prep and purchase quantities.
**Menu performance:** popularity vs margin quadrants with suggested actions.

### 5.11 Control Panel
Business profile & brand assets (logo, banners, social links) · Localization (language, currency, number/date format, timezone) · Tax & service charges · Receipt/invoice designer · Notification rules · Integrations marketplace · API keys & webhooks · Security (password policy, 2FA, IP allowlist, session limits) · Data import/export · Audit log (who/what/before/after/device/IP) · Subscription & billing · Backup & retention.

## 6. Harbinger Register (POS) Specification
**Layout:** left rail — mode switch (Sell · Orders · Tables · Held · Vouchers · Lookup) · centre — search/scan bar, category chips, item tiles (grid/list) · right — ticket.
**Ticket:** order type (dine-in/takeaway/delivery/pickup), table/covers, guest attach (default walk-in), lines with qty stepper, add-ons, notes, per-line and order discount, promo/loyalty, tax breakdown, total, **Pay**.
**Payment sheet:** big tender buttons, quick-cash denominations, split by amount/item/seat, tip, change due, partial pay, pay-later tab; receipt choice (print/SMS/WhatsApp/email/QR).
**Speed features:** barcode scan, favourites, recent items, repeat last order, numeric keypad, hotkeys, long-press for modifiers.
**Sell-by-weight:** live scale weight, tare, price per unit, label/barcode print.
**Orders:** today's orders, reprint, refund, void with PIN, re-fire to kitchen.
**Held tickets:** park and recall with names/notes.
**Vouchers:** cash-out/cash-in with reason.
**Session:** open register (float) → sell → blind close → variance → day-close.
**Offline mode:** full selling, local order numbers with register prefix, queue with idempotency keys, visible sync status, safe card-offline policy **[DECISION]**.
**Security:** PIN login, idle auto-lock, manager PIN for overrides, device registration.
**Customer display (optional):** live ticket, promo, QR pay.

## 7. Roles (starting set)
HQ Admin · Franchise Owner · Outlet Manager · Cashier · Waiter · Stock Keeper · Accountant · Kitchen · Rider.
Permissions are data (matrix + numeric limits), not hard-coded. Every query is scoped Group → Franchise → Outlet → Register.

## 8. Key Flows
1. **Open:** manager opens register, enters float → cashier PIN in.
2. **Sell:** pick type → add items → guest/promo → Pay → kitchen ticket + receipt.
3. **Refund:** find order → refund items → limit check → approval if needed → stock return → receipt.
4. **Restock:** reorder alert → PO → approval → receive with lots → ledger.
5. **Close:** blind count → variance → manager approves → day close → report emailed.
6. **Launch an outlet:** create outlet → registers/devices → assign menu & price book → staff & roles → test order → go live.

## 9. Architecture
| Area | Choice |
|---|---|
| Frontend | React + TypeScript, Tailwind, TanStack Query; Register as PWA with IndexedDB |
| Backend | NestJS (Node), REST + WebSocket, OpenAPI |
| Data | PostgreSQL with row-level tenant isolation; Redis; object storage for media |
| Messaging | Queue for printing, sync, notifications, exports |
| Hosting | GCC region, containers, CI/CD, blue/green deploys |
| Observability | Structured logs, metrics, traces, error tracking, uptime checks |

**[DECISION]** Stack and hosting may be changed by the engineering partner.

## 10. Data Model (core entities)
Group, Franchise, Outlet, Register, Device · User, Role, Permission, Shift · Item, Variant, AddonGroup, Addon, Bundle, Category, Brand, Unit, PriceBook, PriceRule, Menu · Lot, StockLedger, Supplier, PurchaseOrder, Receipt, Transfer, Count · Guest, Address, LoyaltyAccount, Segment · Order, OrderLine, Payment, Refund, Offer, Code, RegisterSession, CashVoucher, DayClose · DeliveryPartner, Rider, Delivery, Zone · Report, Alert, Approval, AuditLog.
All rows: `id, tenant ids, created_at, updated_at, created_by, deleted_at`; money in minor units with currency.

## 11. Non-Functional Targets
Tap-to-cart < 150 ms · Register load < 1.5 s · Pay-to-print < 3 s · Console pages < 2 s · 99.9% uptime with full offline selling · RPO 1 h / RTO 4 h · OWASP ASVS L2 · PCI scope minimized through tokenized payments · UAE VAT compliance and PDPL · WCAG 2.1 AA on Console.

## 12. Phasing
| Phase | Scope |
|---|---|
| **1 — Core (≈14–16 wks)** | Auth/access, Control Panel basics, Catalog, Team, Outlets & Registers, Register (sell, pay, hold, refund, weighed items, print, offline), Stock Room basics (stock, lots, adjustments), Guests directory, Offers & Codes, Command Center, core reports, Cash control & Day close |
| **2 — Operate (≈10–12 wks)** | Purchase orders & receiving, transfers, counts, tables & kitchen display, dispatch & riders, loyalty & gift cards, online/QR ordering, full report library, accounting export, approvals inbox |
| **3 — Scale (≈10+ wks)** | Aggregators, forecasts & menu performance, owner mobile app, public API/webhooks, recipe depletion, advanced hardware, marketplace |

## 13. Differentiators vs a basic POS
Approvals inbox · offer simulator · forecast-driven purchasing · blind-count cash discipline · lot-level FEFO · live outlet health board · open API from day one.

## 14. Open Decisions
1. Logo Option 1 is selected; supply the original vector/brand file for exact colour values (section 2).
2. Offline card-payment policy.
3. Payment gateway(s) for UAE.
4. Stack/hosting confirmation with the engineering partner.
5. Which Phase 1 items can slip to Phase 2.
6. Pilot customer/outlet for UAT.

---

## 15. Advanced Capability Pack ("Harbinger Intelligence & Scale")
Each capability lists what it does, how it works, and its phase. These sit on top of the core in sections 5–6 and are what separates Harbinger from a basic POS. Phase 2/3 refers to section 12.

### 15.1 AI Copilot ("Ask Harbinger") — Phase 2
- Natural-language command bar in the Console: "Why were sales down at Marina yesterday?", "Show items with margin under 30% and falling", "Create a 20% offer on slow mocktails after 4 pm".
- Answers come with the query used, chart, and a one-click action (create offer, raise PO, change price). Every action goes through the normal permission + approval flow and is logged.
- Guardrails: read-only by default, per-role data scope, no raw PII in prompts, full audit of prompts and actions, can be disabled per franchise.
- Daily/weekly **owner briefing** (email, WhatsApp, app): what changed, why, what to do, in the owner's language (EN/AR).

### 15.2 Demand Forecasting & Auto-Replenishment — Phase 2–3
- Per item, per outlet, per day-part forecast using history, weekday, weather, holidays/Ramadan calendar, local events, promotions, and open/closed days.
- Outputs: prep sheets for kitchens, suggested purchase orders (grouped by supplier, respecting MOQ, lead time, shelf life), and over/under-stock risk.
- Closed loop: forecast accuracy (WAPE/bias) tracked per item and fed back; manager can override with a reason that improves the model.
- Auto-PO mode: below-threshold POs auto-sent, above-threshold go to the approvals inbox.

### 15.3 Dynamic Pricing & Promotion Optimiser — Phase 3
- Suggests price changes using elasticity estimates, margin targets and competitor/aggregator price checks, with guardrails (floor/ceiling, max weekly change, brand-price lock items).
- **Offer simulator:** test an offer against last 30–90 days before launch (expected uplift, cannibalisation, margin impact).
- **Happy-hour optimiser:** finds the weak day-parts and proposes time-boxed offers.
- A/B testing of offers/menus by outlet, with significance reporting.

### 15.4 Menu Engineering & Recipe Costing — Phase 2
- Multi-level recipes (sub-recipes, yields, trim/waste %), live cost from latest lot cost, theoretical vs actual food cost per outlet.
- Popularity × margin matrix (stars, plowhorses, puzzles, dogs) with suggested actions (reprice, reposition, bundle, retire).
- Allergen and nutrition auto-calculated from ingredients; printable menu cards and QR menus.
- Cost-spike alerts when a supplier price change erodes margin.

### 15.5 Fraud, Loss & Anomaly Detection — Phase 2
- Rules + statistical models over voids, refunds, discounts, no-sales, price overrides, cash variance, after-hours logins, and tender patterns.
- Per-employee and per-register baselines; alerts such as "Cashier X voids 4× outlet average after payment".
- Case workflow: alert → evidence (receipt, timeline, camera timestamp link) → resolve/escalate; all closed with reason.
- Inventory shrink detection: theoretical vs actual usage per ingredient; flags suspicious variance patterns.
- CCTV-ready: transaction events can be pushed to an NVR overlay by timestamp (integration later).

### 15.6 Omnichannel Order Orchestration — Phase 2–3
- One order engine for register, kiosk, QR table ordering, web/app ordering, call-centre, WhatsApp ordering and aggregators.
- **Smart kitchen load balancing:** throttle or extend ETAs on online/aggregator channels based on live kitchen queue; auto-pause items or channels when stations are overloaded.
- Auto-accept rules, prep-time prediction, order batching and course firing, driver/rider matching by proximity and load.
- Scheduled/pre-orders and catering/bulk orders with deposits, production sheets and invoices.
- Single guest identity across channels so loyalty and history are unified.

### 15.7 Loyalty 2.0 & Guest Intelligence — Phase 2–3
- Points, stamps, tiers, wallet/store credit, referral rewards, paid memberships/subscriptions (e.g. coffee pass), gift cards, corporate accounts with credit limits.
- Segmentation by RFM, preferences, basket affinity; lifecycle journeys (welcome, win-back, birthday, post-visit survey) via WhatsApp/SMS/email/push with frequency caps and consent.
- Churn-risk and next-best-offer scores; incrementality measurement against holdout groups.
- Apple/Google Wallet passes; phone-number or QR identification at the register in under 2 seconds.

### 15.8 Self-Service & Front-of-House Tools — Phase 2–3
- **Kiosk mode** (tablet/touch screen): menu browsing, add-ons, upsell prompts, card payment, order number, accessibility modes.
- **QR table ordering and pay-at-table**, split by seat/item, tipping, live bill, call-waiter button.
- **Handheld waiter app** with offline tickets, course firing, table transfer, seat-level ordering.
- **Customer-facing display**: live ticket, loyalty sign-up QR, promos, tip prompt.
- **Queue and reservation management:** waitlist with SMS/WhatsApp call-ahead, table-turn predictions, deposit holds.

### 15.9 Kitchen Operations Suite — Phase 2
- Multi-station KDS with routing rules, course timing, allergen flags, modifier highlighting, expedite screen, bump history, recall.
- SLA timers per item/station with colour escalation; prep-time analytics per dish and per cook.
- Ingredient-level prep lists, batch cook planning, labelling (prep/expiry labels with lot), HACCP temperature and checklist logs with photo evidence and alerts.
- 86-list (out-of-stock) sync from stock to register, online and aggregators in seconds.

### 15.10 Franchise & Multi-Brand Control Tower — Phase 2–3
- Group → franchise → brand → outlet hierarchy; central menu/price/promo templates with **outlet-level overrides and locks** (what a franchisee may and may not change).
- Rollout manager: schedule menu/price changes, stage to pilot outlets, monitor impact, roll back.
- Royalty and fee engine: percentage of sales, tiered, minimums, marketing fund; automatic statements and invoicing; dispute tracking.
- Brand-standards audits: mobile checklists, photo evidence, scoring, corrective actions.
- Benchmarking and leaderboards across outlets normalised by size, traffic and region.
- White-label theming per franchise (logo, colours, receipt, domain).

### 15.11 Financial Operations — Phase 2–3
- Real-time P&L per outlet (sales, COGS, labour, fees, rent allocations), budget vs actual, variance commentary.
- Bank/payment-gateway **auto-reconciliation** (card batches, aggregator payouts, COD settlements) with exception queue.
- Supplier invoice capture by photo/email (OCR) with three-way match (PO ↔ receipt ↔ invoice) and payment scheduling.
- Petty cash and expense management with receipts and approvals.
- UAE VAT return preparation, FTA-ready e-invoice format readiness, multi-currency and multi-entity consolidation, GL mapping with direct posting to Zoho/QuickBooks/Xero/Oracle/SAP.
- Cash-flow forecast from sales forecast, payables and payroll.

### 15.12 Workforce Management — Phase 3
- Labour-demand forecasting, auto-rota generation by skill, availability, labour law and budget; shift swaps with approvals.
- Mobile clock-in with geofence + PIN/face-verified clock-in (opt-in, privacy-compliant), break compliance, overtime alerts.
- Sales-per-labour-hour dashboards; payroll export (WPS-ready in UAE); tip distribution rules.
- Training and certification tracking, onboarding checklists, document-expiry reminders, performance scorecards.

### 15.13 Offline-First & Resilience — Phase 1 core, expanded Phase 2
- Register works fully offline; local-first database with conflict-free sync; automatic failover between wired/Wi-Fi/4G.
- **Local outlet hub** (small box or designated tablet) shares orders and KDS tickets over the LAN even when the internet is down.
- Store-and-forward card payments within configurable limits; clear policy and indemnity rules per gateway.
- Chaos-tested: tens of thousands of queued offline orders replay safely using idempotency keys; sync health dashboard per register.
- Disaster recovery: multi-AZ database, cross-region backups, tested restores, status page, per-tenant data export.

### 15.14 Open Platform & Integrations — Phase 2–3
- Public REST + GraphQL API, signed webhooks (order.created, stock.low, day.closed …), OAuth apps, sandbox tenant, rate limits, versioning.
- **Marketplace** of certified integrations (accounting, aggregators, payment, loyalty, delivery fleets, HR/payroll, CRM).
- No-code **automation builder** ("When stock of X < N and supplier Y available → create PO, notify manager on WhatsApp").
- Data warehouse export (BigQuery/Snowflake/S3 daily dumps) and BI connectors (Power BI, Looker Studio).
- Event bus so partners can subscribe to real-time streams.

### 15.15 Advanced Payments — Phase 1–3
- Multiple gateways with smart routing and failover; integrated card terminals (semi-integrated, no card data in our systems).
- Tap-to-pay on Android phones/tablets, QR wallets, Apple/Google Pay, BNPL, crypto optional, corporate on-account billing.
- Tip, service-charge and surcharge rules; DCC for tourists; multi-currency tendering with live rates.
- Settlement dashboard per gateway with fee analysis and chargeback tracking.

### 15.16 Security, Privacy & Compliance — Phase 1 core, hardening continuous
- SSO (SAML/OIDC), SCIM provisioning, 2FA/passkeys for admins, device attestation for registers, remote lock/wipe.
- Field-level encryption for PII, customer-managed keys for enterprise, data-residency options (UAE/GCC), immutable audit log with tamper-evidence (hash chain).
- Fine-grained policy engine (ABAC): "Cashier can refund only own-shift orders under AED 100 at own outlet".
- Privacy tooling: consent ledger, data-subject export/erase, retention policies, masking in reports.
- Compliance packs: PCI scope reduction, SOC 2 readiness, ISO 27001 controls, UAE PDPL, VAT record keeping; automated vulnerability scanning and annual pen-test.

### 15.17 Hardware & IoT Ecosystem — Phase 2–3
- Certified hardware list: receipt/kitchen/label printers, drawers, scanners, scales (price-embedded and PLU barcodes), customer displays, card terminals, handhelds, kiosks.
- Device fleet manager: remote config, firmware/app version control, health heartbeat, remote restart, usage and error logs.
- IoT inputs: fridge/freezer temperature sensors and smart scales feeding HACCP logs and shrink analytics; smart-lock and door-sensor events for opening/closing checks.
- Auto-discovery and zero-touch provisioning of new registers via QR pairing.

### 15.18 Sustainability & Waste Intelligence — Phase 3
- Waste logging with reasons and photos; waste cost per outlet/day-part; "near-expiry" auto-promotions (flash offers, staff meals, donations).
- Carbon and packaging reports; supplier sustainability attributes; ESG export for franchisors.

### 15.19 Experience & Productivity Layer — Phase 1–2
- Command bar (Ctrl+K) across every entity and action; saved views, pinned dashboards, role-based home screens.
- Bulk operations everywhere with preview, validation report, undo window.
- Real-time collaboration indicators and comment threads on POs, approvals, incidents.
- Full Arabic/English with RTL, multi-language item names, receipts and campaigns; voice input for notes and search on the register.
- In-product guided tours, sandbox/training mode on the register (no real sales), release notes and feature flags.

## 16. Advanced Data Model Additions
`Forecast, ForecastRun, PrepSheet, Recipe, RecipeLine, CostSnapshot, PriceExperiment, OfferSimulation, AnomalyRule, AnomalyCase, Journey, JourneyStep, Consent, MembershipPlan, Subscription, Wallet, KioskSession, Reservation, WaitlistEntry, RoyaltyRule, RoyaltyStatement, Audit(Brand), AuditFinding, Invoice(Supplier), InvoiceMatch, BankStatementLine, ReconciliationMatch, Rota, ShiftSwap, Certification, SensorReading, HaccpLog, DeviceFleetNode, Webhook, AutomationRule, ApiApp, DataExport, PolicyRule`.

## 17. Advanced Non-Functional Targets
| Area | Target |
|---|---|
| AI Copilot answer latency | p95 < 8 s, with source query shown |
| Forecast accuracy | WAPE ≤ 20% for top-100 items after 8 weeks of data |
| Offline queue | ≥ 5,000 orders per register replayed without duplicates |
| Alert latency (fraud/stock/device) | < 60 s end to end |
| Event delivery (webhooks) | at-least-once, p95 < 5 s, retries up to 24 h |
| Multi-tenant isolation | Automated tests prove no cross-tenant reads on every release |
| Report scale | 10M orders per tenant queried in < 5 s via pre-aggregation |

## 18. Revised Phasing Including Advanced Pack
| Phase | Adds from section 15 |
|---|---|
| 1 Core | 15.13 offline core, 15.15 first gateway, 15.16 baseline security, 15.19 command bar/bulk ops/Arabic |
| 2 Operate | 15.1 Copilot (read-only), 15.2 forecasting v1, 15.4 recipes & costing, 15.5 anomaly rules, 15.6 omnichannel + KDS, 15.7 loyalty, 15.8 QR/handheld/kiosk, 15.9 kitchen suite, 15.10 control tower v1, 15.11 reconciliation + invoice OCR, 15.14 API & webhooks, 15.17 fleet manager |
| 3 Scale | 15.1 Copilot actions, 15.2 auto-PO, 15.3 pricing optimiser, 15.10 royalties & audits, 15.12 workforce, 15.14 marketplace & automation builder, 15.16 enterprise SSO/CMK, 15.18 sustainability |

**Priority picks if budget is tight:** offline hub (15.13), recipe costing (15.4), approvals + anomaly detection (15.5), omnichannel + KDS (15.6/15.9), forecasting-driven purchasing (15.2). These deliver the clearest money-saving and control value first.

---

## 19. Accounting Module — Double-Entry Books (Tally-style)
Implemented in the working app under **Accounts** (role: Admin, Accountant).

**Principles**
- Every transaction is a **voucher** with Dr and Cr entries; total Dr must equal total Cr or it is rejected.
- Chart of accounts uses Tally-style primary groups (Capital, Loans, Current Liabilities → Duties & Taxes / Sundry Creditors, Fixed Assets, Current Assets → Bank / Cash / Stock-in-Hand / Sundry Debtors, Sales, Purchases, Direct/Indirect Income and Expense) with user-defined sub-groups and ledgers.
- Opening balances on asset/liability ledgers only; income/expense ledgers start at zero. Any opening difference is shown as "Difference in opening balances".
- Posted vouchers are never edited. Corrections are made by **cancelling** (posts a reversing voucher; the original stays on record). Period lock blocks manual entries up to a chosen date.
- Perpetual inventory: cost of goods sold is posted with each sale at the actual lot cost, so Stock-in-Hand always agrees with the stock valuation.

**Voucher types:** Sales, Purchase, Payment, Receipt, Contra, Journal, Credit Note (sales return). Numbered per type (SAL-000001 …).

**Automatic postings from the POS**
| Event | Entries |
|---|---|
| Sale | Dr Cash / Card collections / Wallet by tender; Dr Discount Allowed; Cr Sales (before discount, ex-VAT); Cr VAT Output; Dr Cost of Goods Sold, Cr Stock-in-Hand |
| Refund | Reverses the sale voucher (stock/COGS only if returned to stock) as a Credit Note |
| Goods received (PO) | Dr Stock-in-Hand; Dr VAT Input; Cr Supplier ledger |
| Manual stock receipt | Dr Stock-in-Hand; Cr Supplier or GRN Clearing |
| Stock adjustment / wastage | Dr Wastage & Adjustments, Cr Stock-in-Hand (or reverse for additions) |
| Register cash in / out | Dr/Cr Cash-in-Hand against Cash Paid Out (to classify) |
| Register close variance | Dr/Cr Cash Over/Short against Cash-in-Hand |

**Manual entry:** Payment, Receipt, Contra, Journal (live Dr/Cr difference indicator) and supplier Purchase bills with optional input VAT.

**Reports:** Day Book, Ledger statements with running balance, Chart of Accounts with balances, Trial Balance, Profit & Loss (trading + P&L), Balance Sheet, Cash/Bank Book, VAT summary, Outstanding payables/receivables, and a **Books health** page (vouchers balanced, trial balance, stock ledger vs inventory, VAT ledger vs orders, failed postings). All export to CSV.

**Planned (not yet built):** customer credit sales and receivables, bank reconciliation, fixed-asset depreciation, multi-currency, cost centres, GST/VAT return filing format, user-defined voucher numbering, attachment of bills, multi-company, and Tally XML export/import.

---

## 20. Differentiators Built Into the Working App
| Feature | What it does | Why it sells |
|---|---|---|
| **Profit guard** | Live profit and margin % on every register ticket (owner/manager see numbers, cashiers see a warning); selling below the minimum margin needs a manager PIN; every override is audited | Stops discount leakage at the moment it happens, not in next month's report |
| **Daily briefing** | Plain-language insights on the dashboard: vs same day last week, busiest hour, top profit driver, stock about to run out, expiry loss, unreviewed risk alerts, win-back guests, supplier dues | Owner gets "what to do today" instead of charts |
| **Reorder forecast + 1-click POs** | Sales velocity (last 14 days, weighted to last 7), lead time and cover days give order quantities; creates draft POs grouped by supplier; flags stock that will run out before a delivery can arrive | Cuts stock-outs and over-ordering |
| **Expiry risk** | Projects whether each lot will sell before its expiry date and values what is at risk | Reduces wastage |
| **Risk & fraud alerts** | Compares each cashier with the outlet average: refund rate, quick refunds, large refunds, frequent manual discounts, cash variances, after-hours sales, below-cost sales, overselling | Loss prevention that normally needs a separate tool |
| **Menu profit matrix** | Stars / Plowhorses / Puzzles / Dogs from real margin and popularity with a suggested action each | Direct menu and pricing decisions |
| **Guest segments + win-back** | Champion, Loyal, New, At risk, Lost; one-click WhatsApp message to lapsing guests | Repeat-visit revenue |
| **WhatsApp receipts** | Send the receipt to the guest's phone from the register | Paperless and high-demand in the GCC |
| **Kitchen display** | New → Preparing → Ready → Served tickets with timers, late highlighting and a sound alert; syncs between browser windows | Replaces separate KDS hardware |
| **Command search (Ctrl K)** | Jump to any page, item, guest, order, ledger or voucher, or start an action | Speed for power users |
| **Built-in double-entry accounts** | See section 19 | POS and books in one system, no re-keying |

**Next candidates for market advantage:** UAE/KSA e-invoice (QR/XML) output, online/QR ordering with the same kitchen display, aggregator order inbox, Arabic/RTL interface, supplier ordering by WhatsApp/email, multi-outlet consolidation, and a mobile owner app.

---

## 21. E-Invoicing, Online Ordering and Delivery-App Integration (built)
**E-invoicing (E-Invoicing page, Admin/Accountant)**
- **KSA (ZATCA) Phase 1:** every receipt carries the QR code — TLV tags 1–5 (seller name, VAT number, UTC timestamp, total, VAT), UTF-8 safe, base64. Verified by decoding the QR image with an independent reader.
- **KSA Phase 2 (partial):** each invoice/credit note gets a UUID, invoice counter (ICV) and previous-invoice-hash chain (first invoice uses the ZATCA seed); an **unsigned UBL 2.1 XML draft** can be downloaded. *Not done:* CSID onboarding, XAdES signature, canonicalisation, clearance/reporting API — these need ZATCA credentials and a secure server.
- **UAE:** TRN/VAT/currency readiness checks and a UBL (Peppol PINT-AE style) draft for hand-off to an Accredited Service Provider. Customisation/profile IDs must be confirmed with the ASP. Per Ministry of Finance Decisions 243/244 of 2025 as reported by KPMG and Baker McKenzie: pilot from 1 July 2026; revenue ≥ AED 50m by 1 January 2027; smaller businesses by 1 July 2027; B2C-only businesses excluded for now — confirm with the FTA.
- Data validation: KSA VAT number format (15 digits, starts and ends with 3), UAE TRN (15 digits), VAT rate and currency match the region.

**Online & QR ordering (Online & Delivery)**
- Customer storefront (`/order/`, EN + AR with RTL): menu, cart, pickup / delivery / dine-in; table QR codes (`?t=T4`); live order tracking.
- Console inbox: accept (creates the POS order, deducts stock, sends to kitchen, posts accounting and e-invoice), reject with reason, status steps linked to the kitchen display, pay-on-delivery/pickup settlement, guest auto-created from phone, WhatsApp the guest.
- Printable table QR sheets; storefront settings (open/closed, delivery fee, minimum order, prep time).

**Delivery apps**
- One normalised order format; webhooks verified by HMAC; duplicates ignored; **item matching** (remembered mappings) between app items and POS items; prepaid orders post to an *Aggregator Receivables* ledger; **payout entry** posts bank receipt, commission and VAT on commission; menu CSV export per app; test-order simulator.
- *Live connections need each platform's partner credentials and a verified adapter* — see `server/README.md`.

**Gateway server** (`server/gateway.js`, no dependencies): serves the apps, public order API with server-side price checks and rate limits, authenticated inbox, signed webhooks.
