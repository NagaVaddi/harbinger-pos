# Harbinger Cloud (multi-tenant API)

One deployment, many businesses. Requires **Node 22.5+** (built-in SQLite). No npm dependencies.

```bash
export HB_MASTER_KEY=$(openssl rand -base64 32)    # required in production; keep it secret and backed up
export ALLOW_SIGNUP=1                              # only while you onboard owners; default is closed
node server/cloud/cloud.js                         # http://127.0.0.1:8788
```

| Env | Default | Meaning |
|---|---|---|
| `PORT`, `HOST` | `8788`, `127.0.0.1` | listen address |
| `HB_DB` | `server/cloud/harbinger.db` | SQLite file (keep on an encrypted volume, back it up) |
| `HB_MASTER_KEY` | — | 32-byte base64 key that encrypts 2FA and webhook secrets (**required when `NODE_ENV=production`**) |
| `ALLOW_SIGNUP` | `0` | `1` lets anyone create a business |
| `TRUST_PROXY` | off | trust `X-Forwarded-*` from your reverse proxy |
| `SESSION_IDLE_MIN`, `SESSION_MAX_HOURS` | `120`, `12` | session timeouts |
| `ALLOWED_ORIGINS` | same host | extra origins allowed to call state-changing endpoints |

## API (JSON; state-changing calls need the `X-CSRF-Token` returned at login)

| Endpoint | Who | Purpose |
|---|---|---|
| `POST /api/auth/register` | public, if enabled | create business + owner |
| `POST /api/auth/login` | public | email, password, optional `code` (2FA / backup code) |
| `GET /api/auth/session` · `POST /api/auth/logout` · `/logout-all` · `/change-password` | signed in | session info (user, tenant, csrf, permissions) |
| `POST /api/auth/2fa/setup` · `/enable` · `/disable` | signed in | TOTP enrolment, backup codes |
| `GET/POST /api/users`, `PATCH /api/users/:id`, `POST /api/users/:id/reset-password` | owner/admin | staff management (temporary password shown once) |
| `GET /api/audit` | owner/admin | tenant audit log |
| `GET /api/sync/pull?since=&limit=` · `POST /api/sync/push` | by role | record sync with per-role redaction, append-only history, conflict detection |
| `PUT /api/webhooks/:channel` | owner/admin | (re)generate the signing secret for a delivery-app channel |
| `GET /api/public/:slug/menu` · `POST /api/public/:slug/orders` · `GET /api/public/:slug/orders/:track` | public | storefront |
| `POST /webhooks/:slug/:channel` | delivery apps | HMAC-signed order delivery |

Collections and role rules are defined in `POLICY` at the top of `cloud.js`.

## Tests
`node` scripts in the repo history exercise 105 security checks (tenant isolation, CSRF, lockout, 2FA, RBAC, append-only, injection attempts, webhooks, storefront). Run them before every release.

## Status
Foundation only: the POS web app does not use this server yet. See `SECURITY.md` → "Not done yet".
