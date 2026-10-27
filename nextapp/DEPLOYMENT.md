# Harbinger — Deployment Guide

## Prerequisites

- Node.js 18+
- PostgreSQL database (Supabase, Neon, or self-hosted)
- Vercel account (recommended for hosting)

---

## 1. Database Setup (Supabase)

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **Settings → Database → Connection String** and copy the URI
3. Under **Settings → API** note the `anon` and `service_role` keys (not needed for direct DB access)

```bash
# Format
postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
```

---

## 2. Environment Variables

Create `nextapp/.env` (never commit this):

```env
# Required
DATABASE_URL="postgresql://..."
JWT_SECRET="generate-with-openssl-rand-base64-32"

# Optional — defaults work for development
NODE_ENV="production"
```

Generate a strong JWT secret:
```bash
openssl rand -base64 32
```

---

## 3. Database Migration

```bash
cd nextapp
npm install
npx prisma migrate deploy
# Seed a demo tenant (optional)
npm run db:seed
```

---

## 4. Deploy to Vercel

```bash
npm i -g vercel
cd nextapp
vercel --prod
```

Set environment variables in the Vercel dashboard under **Settings → Environment Variables**:
- `DATABASE_URL`
- `JWT_SECRET`

### Vercel config notes

- The app uses Next.js 16 App Router — Vercel detects this automatically
- Server Actions are supported natively
- Set **Node.js version** to 18.x or 20.x in project settings

---

## 5. Thermal Printer (Print Agent)

Harbinger routes KOT/bill printing to network printers via raw TCP (port 9100). Browsers cannot open raw sockets due to Mixed Content rules, so a local print agent is required.

### How it works

A lightweight Node.js agent (`print-agent.js`) runs on the same LAN as the printers. The browser sends `POST http://localhost:PORT/print` and the agent forwards raw ESC/POS bytes to the printer's IP.

### Setup

1. Download `print-agent.js` from **Settings → Kitchen → Printers** in the app
2. Install on a PC or Raspberry Pi on the same network as the printers:

```bash
node print-agent.js --port 3001
```

3. In Harbinger **Settings → Kitchen**, set:
   - Print agent URL: `http://localhost:3001`
   - Printer IP: your printer's LAN IP (e.g. `192.168.1.50`)

> **HTTPS note**: If you serve Harbinger over HTTPS (which Vercel does), the print agent must run over HTTP on `localhost` — browsers allow mixed content to `localhost` but not to other LAN hosts. The kitchen settings page will show a Mixed Content warning if the agent URL is not `localhost`.

---

## 6. Point-in-Time Recovery (PITR)

Supabase Pro includes PITR. Enable it under **Database → Backups**.

For manual backups, use the admin export in **Settings → Backup**:
```bash
# Or run the backup script directly
cd nextapp
npx ts-node --project tsconfig.seed.json scripts/backup.ts
```

---

## 7. Production Checklist

- [ ] `JWT_SECRET` set to a random 32-byte value
- [ ] `DATABASE_URL` points to production DB (not local)
- [ ] Prisma migrations applied (`prisma migrate deploy`)
- [ ] First admin account created via `/register-tenant`
- [ ] Print agent deployed on LAN if thermal printers are used
- [ ] PITR / automated backups enabled on DB provider
