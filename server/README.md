# Harbinger Gateway

A small, dependency-free Node server (Node 18+) that gives the POS three things a browser-only app cannot do:

1. **Online / QR ordering** for customers on their own phones (`/order/`).
2. **Delivery-app webhooks** (Talabat, Deliveroo, Careem, Noon, HungerStation, Jahez …) with signature checks.
3. **Serving the POS app** (`/app/`) and marketing site over HTTP, with a strict Content-Security-Policy.

## Quick start

```bash
node server/gateway.js
```

* POS app: http://localhost:8787/app/  · Storefront: http://localhost:8787/order/ (QR for a table: `/order/?t=T4`)
* On first start it prints an **API key**. In the POS go to *Online & Delivery → Setup*, leave *Gateway URL* blank (same site) and paste the key.
* Customers can only reach it over your network. To serve the public, put it behind HTTPS (Caddy / nginx / Cloudflare Tunnel) and set `HOST=0.0.0.0`, `TRUST_PROXY=1`.

| Env var | Meaning |
|---|---|
| `PORT` / `HOST` | Listen address (default `8787` / `127.0.0.1`) |
| `DATA_FILE` | JSON data file (default `server/data.json`, created with mode 600) |
| `HARBINGER_API_KEY` | Fix the API key instead of auto-generating |
| `PUBLIC_ORIGINS` | Comma list of origins allowed to call `/api/public/*` from another domain |
| `WEBHOOK_SECRET_<CHANNEL>` | HMAC secret per delivery app, e.g. `WEBHOOK_SECRET_TALABAT` |
| `TRUST_PROXY` | Use `X-Forwarded-For` for rate limiting (only behind your own proxy) |
| `STATIC_DIR` | Folder to serve (default `../website`) |

## How the pieces fit

```
 customer phone ──► /order/ (storefront) ──► POST /api/public/orders ─┐
 Talabat / Deliveroo ─► POST /webhooks/<channel> (HMAC) ──────────────┤  gateway inbox
                                                                       ▼
 POS app (browser) ◄── GET /api/inbox (Bearer key) ── accept / reject ── POST /api/orders/:id/status ──► guest tracking
        │ POST /api/menu  (publishes menu + availability, never cost)
        ▼
   order → kitchen display → stock → accounting → e-invoice
```

### Normalised online order (what the POS expects)

```json
{ "id":"AG-xyz", "track":"#98765", "ts":1761390000000, "channel":"talabat|deliveroo|storefront|…", "source":"aggregator|qr|web",
  "type":"delivery|pickup|dine-in", "table":"", "customer":{"name":"","phone":"","address":""},
  "lines":[{"ext":{"id":"P-77","name":"","sku":""},"itemId":"(storefront only)","name":"","qty":2,"price":20,"note":""}],
  "note":"", "deliveryFee":0, "total":40, "payment":"prepaid|cod" }
```

## Security built in

* Public order endpoint: input validation, **prices recomputed from the published menu** (client prices ignored), idempotency key, rate limits (60 attempts / 10 min, 10 created orders / 10 min per IP), 32 KB body cap.
* Tracking codes are random and the tracking endpoint returns no personal data.
* POS endpoints need the Bearer key (constant-time compare, failed-attempt throttling).
* Webhooks: HMAC-SHA256 over the raw body (`X-Signature`), optional `X-Timestamp` replay window (5 min), duplicate suppression, channel allow-by-secret (no secret = 503).
* Static files: path-traversal protection, CSP on `/app/` and `/order/`, `nosniff`.

## What is NOT done yet — please read

* **Talabat / Deliveroo / Careem / Noon connections are not live.** Those platforms give API access only to approved partners (Noon Food and Careem commonly via a middleware such as Deliverect). `channels.js` contains a *generic* payload mapper that guesses common field names; replace it with an adapter written against the real partner schema and test with real samples. Outbound calls (accept/reject/ready, item availability, menu push) are queued in `/api/outbox` for an adapter to send — they are **not** sent today.
* **Online card payment is not included.** The storefront offers pay on delivery / at the counter. Add a payment provider (Telr, Network International, Stripe, PayTabs…) and set `payment:"prepaid"` after a verified payment webhook.
* **Not hardened for the open internet by itself:** run it behind HTTPS, restrict `/api/*` by network if possible, rotate the API key if exposed, back up `data.json`, and add monitoring. There is no user management on the gateway beyond the single API key.
* Single-process JSON file storage: fine for one restaurant; use a real database for chains.
* ZATCA Phase 2 and UAE e-invoicing submission need credentials and signing — see the E-Invoicing page in the app. Nothing is sent to any tax authority.
