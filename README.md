# Harbinger POS

Cloud point-of-sale and franchise control platform for restaurants and retail in the GCC (UAE, Saudi Arabia, Bahrain, Oman, Kuwait, Qatar) and beyond.

**Status: working demo / prototype.** Data is stored in the browser (localStorage). It is not yet a production system — see "Before real use" below.

## What is in here
| Path | What |
|---|---|
| `website/` | Marketing site (`index.html`) |
| `website/app/` | The POS app: Register, Console, Stock, Guests, Promotions, Accounts (double-entry), E-Invoicing, Online & Delivery, Kitchen display. English + Arabic (RTL). |
| `website/order/` | Customer storefront / QR table ordering (needs the gateway) |
| `server/` | Zero-dependency Node gateway: public order API, signed delivery-app webhooks, serves the apps. See `server/README.md` |
| `POS_Harbinger_Original_Product_Spec.md` | Product specification |

## Try it
* **Quickest:** open `website/app/index.html` in a browser, or the hosted demo if one is published. Demo logins: `admin / admin123`, `manager / manager123`, `cashier / cashier123`.
* **With online ordering:** `node server/gateway.js` (Node 18+), then open http://localhost:8787/app/ — the first start prints the gateway API key.

## Business types — each business gets its own system
Chosen when the account is created (and in Settings): **Restaurant / café · Supermarket / grocery · Retail store · Pharmacy · Clinic / hospital billing · Salon / spa · Tailor / stitching · Butcher · Grocery · Garage · Tyre shop**. The type decides the wording (Guests → Customers / Patients / Clients), the screens, the register behaviour, the staff roles that can be created, the sample catalogue and a **dedicated dashboard**:

| Type | Register & stock | Dashboard highlights |
|---|---|---|
| Restaurant | tables, kitchen display, dine-in/takeaway/delivery | busy hours, channel mix, kitchen queue |
| Supermarket | barcode-first, weighed items & scale barcodes, expiry control | basket size, fast/dead stock, expiry watch, shrink |
| Retail | size/colour variants, scanning, returns | sell-through, margin by category, return rate |
| Pharmacy | prescriptions, controlled drugs with pharmacist approval, batch & expiry (expired stock blocked), insurance | Rx vs OTC, prescription register, expiry risk, claims |
| Clinic / hospital billing | services by department, doctors, insurance co-pay and claims — **billing only, no medical records** | revenue by department/doctor, payer mix, claims outstanding |
| Salon / spa | services by stylist, commissions | stylist leaderboard, repeat clients, commission payable |
| Tailor / stitching | job orders with measurements, due dates, advance and balance (advance held as a liability until delivery), tailor commissions | jobs by stage, due & overdue, advances held, customer credit |
| Butcher | weighed cuts, cutting-note presets, carcass breakdown with cost allocation and yield, short shelf life | cutting yield and waste, kilos sold, customer credit |
| Grocery | scan-first, weighed produce, customer credit (khata) with limits and ageing, expiry | basket size, credit ageing, low stock |
| Garage | job cards with vehicle, estimate → approval → ready, parts and labour, mechanics (technician role), next-service reminders, fleet credit | open job cards, service reminders, labour vs parts |
| Tyre shop | size/brand search, DOT code per tyre, warranty register, vehicle plate and history, fitting services, fleet credit | tyre sizes sold, brand mix, warranties active |

## Reports, stock tools and partners
- **Reports** opens a landing page of grouped cards: Accounts reports (Accounts summary with receivables ageing, Stock report reconciled to the books, tax summary, Day Book, P&L, Balance Sheet, Trial Balance, Cash/Bank Book, Outstanding), Inventory reports (Stock report, Item activity, Stock adjustments & wastage, Expiry / batch report, valuation, reorder) and Sales & operations.
- **Stock Room** has Weighing Management (scale label format: prefix, PLU digits, weight or price, check digit; PLU list; CSV for the scale; test box) and Barcode Config (scanner rules, internal EAN-13 numbering, shelf-label printing).
- **Delivery Partners** (own riders), **Counters** (staff, shifts, active session), **Promo codes**, **Offers & discounts** and **Customers** have searchable tables with status and created dates; long tables are paginated.


## Countries
Profiles for UAE, KSA, Bahrain, Oman, Kuwait, Qatar, plus Egypt, Jordan, UK, India, US and a custom option: currency, decimals (BHD/OMR/KWD use 3), tax rate/label, WhatsApp dial code, e-invoicing region. Optional service charge / municipality fees. Rates and rules change — confirm with your tax authority.

## Security
See [SECURITY.md](SECURITY.md). **The public demo is not safe for real data.** `server/cloud/` is a multi-tenant API (real accounts, 2FA, tenant isolation, server-side permissions, audit log) with 127 automated security checks (including per-business-type access rules); connecting the POS front-end to it is the next milestone.

## Tests
`npm install && npm test` runs all suites (cloud security, gateway, accounting, intelligence, dashboard, regions, online) — 471 checks. Node 22.5+.

## Before real use
* Replace browser storage with a server database and real user accounts (passwords are only hashed client-side in the demo).
* ZATCA Phase 2 / UAE e-invoicing submission and delivery-app APIs (Talabat, Deliveroo, …) need partner credentials and server-side code; the app produces drafts and a QR code only.
* Run the gateway behind HTTPS.

Third-party code: `website/app/js/vendor/qrcode.js` (MIT, see `qrcode.LICENSE.txt`).
