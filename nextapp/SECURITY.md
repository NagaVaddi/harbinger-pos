# Harbinger — Security Guide

## Authentication

- JWT tokens signed with HS256, stored in `HttpOnly; Secure; SameSite=lax` cookies
- Tokens expire after 7 days
- `JWT_SECRET` must be a cryptographically random 32+ byte value in production
- Passwords hashed with bcrypt (cost factor 12)

## Rate Limiting

Login attempts are rate-limited per `staffId@tenantSlug`:
- 5 failed attempts → 15-minute lockout
- All failures are recorded in the audit log
- Rate limiting state is in-memory (resets on process restart); use Redis for multi-instance deployments

## Input Validation

All Server Actions use Zod schemas before touching the database:
- Text fields sanitised against length and format
- Staff IDs restricted to `[A-Z0-9]+`
- Tenant slugs restricted to `[a-z0-9-]+`

## Multi-Tenancy

Every Prisma query is scoped to `tenantId` extracted from the verified JWT — tenants cannot access each other's data. Feature flags are also per-tenant.

## Audit Logging

The `AuditLog` table records:
| Event | When |
|-------|------|
| `LOGIN` | Successful staff login |
| `LOGIN_FAILED` | Failed login attempt |
| `LOGOUT` | Staff logout |
| `TENANT_REGISTERED` | New tenant created |
| `UPDATE_SETTINGS` | Settings changed |
| `INSTALL_TEMPLATE` | Industry template applied |
| `CLOSE_SHIFT` | POS shift closed |
| `DELETE_PRODUCT` | Product deleted (soft) |

Admins and managers can view audit logs at **Settings → Audit Log**.

## Soft Deletes

Products, Customers, Orders, and Employees are soft-deleted (`deletedAt` timestamp) rather than hard-deleted. All queries filter `WHERE deletedAt IS NULL`.

Hard deletes are only performed:
- During a full tenant wipe (not exposed in the UI)
- Via direct DB admin

## Data Masking

Phone numbers are masked for non-admin/manager roles (e.g. `+971•••••1234`). Full numbers are only shown to `admin` and `manager`.

## Sensitive Data in Logs

- Passwords are never logged
- JWT tokens are never logged
- Phone numbers are masked in audit `payload`

## Backup & Recovery

### Manual export

```bash
cd nextapp
npx ts-node --project tsconfig.seed.json scripts/backup.ts
```

This produces a `harbinger-backup-YYYY-MM-DD.json` file in the project root.

### Supabase / Neon PITR

1. **Supabase**: Enable PITR under **Database → Backups** (Pro plan required)
   - Default retention: 7 days
   - To restore: use the Supabase dashboard or `pg_restore`

2. **Neon**: Branching provides instant copy-on-write snapshots
   - Create a restore branch: `neon branches create --parent main@<timestamp>`

### Recommended backup schedule

| Frequency | Method |
|-----------|--------|
| Continuous | Supabase/Neon WAL streaming |
| Daily | Admin export downloaded and stored off-site |
| Weekly | Full `pg_dump` to S3 / Backblaze B2 |

## Environment Variable Security

| Variable | Notes |
|----------|-------|
| `DATABASE_URL` | Contains credentials; never commit |
| `JWT_SECRET` | Must be random 32+ bytes; never reuse across envs |

Generate a secret:
```bash
openssl rand -base64 32
```

## Dependency Hygiene

```bash
npm audit
npm audit fix
```

Run `npm audit` before each production deploy. Critical and high severity issues should block deployment.

## Reporting Vulnerabilities

Open a private security advisory on GitHub or email the maintainer directly.
