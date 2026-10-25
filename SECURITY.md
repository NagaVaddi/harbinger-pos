# Harbinger POS — Security model

Harbinger will hold other people's sales, customer and accounting data, so this document says plainly what is protected, how, and what is **not yet** done.

## Two modes — do not confuse them

| | **Demo** (what is on GitHub Pages) | **Cloud** (`server/cloud/`) |
|---|---|---|
| Where data lives | Each visitor's own browser (localStorage) | Server database, one logical tenant per business |
| Logins | Public demo passwords, hashed in the browser | Real accounts: scrypt, 2FA, lockout, server sessions |
| Safe for real data? | **No.** Anyone with the browser profile (or an XSS bug) can read/alter it. | Foundation is in place; the POS front-end is **not yet connected** to it (see "Roadmap"). |

> Until the Cloud connection is finished, **do not onboard real customers onto the demo**.

## Repository & web-app hardening (added 2024)

| Area | Measure |
|---|---|
| **CI** | GitHub Actions workflow runs `npm ci`, `npm test` (618 checks) and `npm audit --audit-level=high` on every push/PR to `main`. |
| **Dependency updates** | Dependabot scans npm packages and GitHub Actions weekly and opens PRs automatically. |
| **Secret scanning** | Automated test (`tests/security.test.js`) scans every tracked file for AWS keys, private-key PEM blocks, Firebase admin keys, Slack tokens, OpenAI keys, GitHub tokens, and `client_secret`-style patterns — fails the build if any match. |
| **No dangerous APIs** | Same test asserts no `eval()`, `document.write()`, `new Function()`, string-argument `setTimeout`/`setInterval`, or inline event-handler attributes (`onclick=`) in any web-app file. |
| **Content-Security-Policy** | Both app pages (`website/app/index.html`, `website/order/index.html`) carry a `<meta>` CSP: `script-src 'self'`; `object-src 'none'`; `base-uri 'self'`; `connect-src 'self' https: localhost`. GitHub Pages cannot add HTTP headers, so the meta tag is the available mechanism; move to a proper server for the header equivalent. |
| **Referrer policy** | `Referrer-Policy: no-referrer` meta on both app pages. |
| **No third-party scripts** | Automated test confirms no `<script src="https://…">` in either app page. |
| **Allow-list `.gitignore`** | The repo uses a deny-all / allow-list `.gitignore` (`/*` then `!` for safe paths) — credential files, `.env`, `.pem`, `.key`, Firebase admin JSON, and `server/cloud/*.db` are blocked from ever being staged. |
| **Parameterised SQL** | Cloud server test asserts no string-template (`${}`) inside `db.prepare()`/`db.exec()` calls. |

## What the Cloud server enforces today (tested: 142 automated checks)

**Identity & sessions**
* Passwords: scrypt (N=32768, r=8, p=1) with a unique salt; policy (10+ chars, not common, not containing name/email). Constant-time comparison; dummy hash for unknown emails so response time does not reveal which emails exist.
* Brute force: 10 attempts / 10 min per email, 30 / 10 min per IP, account lock after 5 failures with doubling lock time (15 min → 24 h).
* Sessions: 256-bit random token in an `HttpOnly; SameSite=Strict` cookie (`Secure` over HTTPS); only the SHA-256 of the token is stored. Idle timeout (default 2 h) and absolute lifetime (default 12 h). Logout, password change, role change and disabling a user revoke sessions server-side.
* CSRF: every state-changing request needs a per-session `X-CSRF-Token`; cross-site `Origin` is rejected (also on login); JSON-only bodies.
* Two-factor (TOTP, RFC 6238) with single-use backup codes, replay protection; secrets encrypted at rest (AES-256-GCM, key from `HB_MASTER_KEY`).
* New staff get a one-time temporary password and **must change it** before using the API.

**Tenant isolation (many owners, one deployment)**
* The tenant comes from the authenticated **session**, never from anything the client sends. Every query is parameterised and tenant-scoped; ids from other tenants look like "not found".
* Tested: tenant B cannot read, overwrite, list, reset or message anything of tenant A (records, users, audit log, storefront, tracking codes, webhooks).

**Business type decides access (enforced on the server)**
* The owner picks a business type at sign-up (restaurant, supermarket, retail, pharmacy, clinic, salon). It fixes which **staff roles** can exist (e.g. a pharmacy can create pharmacists and store keepers but not waiters; a clinic can create billing clerks but not cashiers) and which **data collections** exist at all (prescription logs only for pharmacy/clinic; providers only for clinic/salon; online ordering and storefront not for clinic/salon). A collection that does not exist for a type is refused even to the owner.
* Role capabilities are separate per role: e.g. a store keeper can receive and count stock but cannot read customers, orders or accounts and cannot change prices or cost; a pharmacist records prescriptions (append-only) but a counter assistant cannot; kitchen staff only see orders.

**Authorisation (enforced on the server, not in the UI)**
* Per-collection read/write rules by role (owner, admin, manager, cashier, accountant, kitchen). Examples: cashiers cannot read accounting data or item cost, cannot write prices, settings or ledgers; kitchen sees orders only.
* Field-level protection: roles that cannot see `cost` cannot change it either (server keeps the real value).
* Append-only history: orders, stock movements, cash vouchers and accounting vouchers cannot be edited or deleted except for a short allow-list of status fields.
* Optimistic concurrency: a stale write returns a conflict instead of silently overwriting.
* Owner/admin hierarchy: only the owner can create or change owners/admins; a business always keeps one active owner.

**Public endpoints (storefront, webhooks)**
* Prices are recomputed on the server from the published menu; strict validation, size limits, rate limits, idempotency keys.
* Tracking pages expose no personal data. Delivery-app webhooks need an HMAC-SHA256 signature using a per-tenant secret (shown once, stored encrypted), replay window and duplicate suppression; unknown tenants and wrong signatures look identical.

**Platform**
* Security headers on all responses (`no-store` for the API, `nosniff`, frame deny, no referrer; HSTS over HTTPS), strict CSP on the apps, path-traversal protection.
* Audit log per tenant (logins, failures, user/role changes, 2FA, webhook rotation, denied writes, sync counts). Passwords/secrets are never logged.
* Refuses to start in production without a master encryption key.

## Not done yet — be honest about these

1. **The POS front-end does not talk to the Cloud server yet.** Needed: a login screen against `/api/auth`, a sync adapter (`/api/sync`), stock quantities derived from the append-only movements ledger (so two tills cannot overwrite each other), per-till order/voucher numbering, and server-side accounting/e-invoice posting so a cashier device cannot be trusted with ledgers.
2. **Email**: no email verification, invitations or password-reset emails (an operator resets owners from the command line). Needs an email provider.
3. **Account recovery for owners with lost 2FA**: operator-assisted only.
4. **Data protection**: customer details are stored as JSON in the database; rely on disk/volume encryption and encrypted backups. No per-tenant data export/erasure tooling yet (needed for GDPR/PDPL requests).
5. **Operations**: backups, monitoring/alerting, WAF/DDoS protection, log shipping, secrets management, dependency scanning, a third-party penetration test — all must be done before real customers.
6. **Payments**: nothing in this codebase stores card data; keep it that way (use a hosted gateway such as Telr/Network International/Stripe so card numbers never touch Harbinger).
7. **Compliance**: ZATCA Phase 2 signing and submission, UAE ASP submission, retention rules (e.g. 5 years) and a data-processing agreement for customers — not started.
8. **Client-side demo hardening**: the demo stores its gateway key in localStorage and hashes passwords in the browser; both go away in Cloud mode.

## Deployment checklist (Cloud)

- [ ] Node 22.5+ on a patched OS; run as an unprivileged user; only the reverse proxy is public.
- [ ] HTTPS everywhere (Caddy / nginx / managed LB); set `TRUST_PROXY=1` only behind your own proxy; `NODE_ENV=production`.
- [ ] `HB_MASTER_KEY` from a secret manager (`openssl rand -base64 32`); never commit it. Back it up separately from the database.
- [ ] `ALLOW_SIGNUP=0` unless you run public sign-up with email verification and bot protection.
- [ ] Encrypted volume; automatic encrypted backups with a tested restore.
- [ ] Rotate any credential that has ever been in a repository (note: the working folder contains a Firebase admin key that is deliberately **not** committed — rotate it if it was ever shared).
- [ ] Penetration test and dependency/CVE scanning before launch.

## Reporting a vulnerability
Open a private security advisory on the GitHub repository or contact the maintainer directly; please do not post details publicly.
