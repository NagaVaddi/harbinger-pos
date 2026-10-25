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

## Countries
Profiles for UAE, KSA, Bahrain, Oman, Kuwait, Qatar, plus Egypt, Jordan, UK, India, US and a custom option: currency, decimals (BHD/OMR/KWD use 3), tax rate/label, WhatsApp dial code, e-invoicing region. Optional service charge / municipality fees. Rates and rules change — confirm with your tax authority.

## Before real use
* Replace browser storage with a server database and real user accounts (passwords are only hashed client-side in the demo).
* ZATCA Phase 2 / UAE e-invoicing submission and delivery-app APIs (Talabat, Deliveroo, …) need partner credentials and server-side code; the app produces drafts and a QR code only.
* Run the gateway behind HTTPS.

Third-party code: `website/app/js/vendor/qrcode.js` (MIT, see `qrcode.LICENSE.txt`).
