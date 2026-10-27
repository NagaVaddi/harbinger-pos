# Harbinger — Cloud Deployment Guide

> **Target:** Vercel (Next.js) + PostgreSQL (Supabase or Neon)  
> **Estimated time:** 30–45 minutes for a first deployment

---

## Environment Variables (complete reference)

Add these to Vercel before deploying. See Phase 2, Step 4 for where to paste them.

| Variable | Required | Example | Notes |
|---|---|---|---|
| `DATABASE_URL` | ✅ | `postgresql://user:pass@host:5432/db?pgbouncer=true` | Supabase: use pooler URL. Neon: standard URL. |
| `DIRECT_URL` | Supabase only | `postgresql://user:pass@host:5432/db` | Direct (non-pooler) connection. See Phase 1. |
| `JWT_SECRET` | ✅ | (32+ random chars) | Signs login tokens. **Never commit this.** |
| `NEXT_PUBLIC_APP_URL` | Recommended | `https://your-app.vercel.app` | Used for QR codes and absolute URLs. |
| `NODE_ENV` | Auto | `production` | Set automatically by Vercel — do not add manually. |

Generate a secure `JWT_SECRET`:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Phase 1 — The Cloud Database

### Option A: Neon (recommended for simplicity)

1. Go to [neon.tech](https://neon.tech) → **Sign up free**.
2. Create a new project. Choose the region closest to your users.
3. On the dashboard, click **Connection string** → copy the `postgresql://...` URL.
4. That single URL is your `DATABASE_URL`. No extra setup needed — Neon handles connection pooling automatically.

### Option B: Supabase

1. Go to [supabase.com](https://supabase.com) → **Start your project** → create a free project.
2. Once provisioned, go to **Project Settings → Database → Connection string**.
3. You need **two** URLs:
   - **Pooler (Transaction mode)** — used at runtime by Vercel serverless functions.  
     Copy the "URI" under **Connection pooling**, add `?pgbouncer=true&connection_limit=1` to the end.  
     → This is your `DATABASE_URL`.
   - **Direct connection** — used for `prisma db push` / migrations.  
     Copy the "URI" under **Direct connection**.  
     → This is your `DIRECT_URL`.
4. Add `DIRECT_URL` to your `prisma/schema.prisma` datasource block (one-time edit):

   ```prisma
   datasource db {
     provider  = "postgresql"
     url       = env("DATABASE_URL")
     directUrl = env("DIRECT_URL")
   }
   ```

   Then run `tsc --noEmit` to confirm it still compiles, and commit the schema change.

### Initialise the database tables

Run this **once** from your local machine, pointed at the cloud database:

```bash
# Set the variable inline (PowerShell)
$env:DATABASE_URL = "your-direct-connection-string-here"
npx prisma db push

# Set the variable inline (bash / Mac / Linux)
DATABASE_URL="your-direct-connection-string-here" npx prisma db push
```

You should see:
```
Your database is now in sync with your Prisma schema.
```

> **Tip — seed demo data:** If you want a demo tenant pre-created, run:
> ```bash
> npm run db:seed
> ```
> This requires `DATABASE_URL` to point to the cloud DB. The seed creates a
> `harbinger-demo` tenant with staff ID `ADMIN001` / password `admin123`.  
> **Change the password immediately after your first login in production.**

---

## Phase 2 — GitHub & Vercel

### Step 1 — Push to GitHub

```bash
# From the nextapp/ directory (or repo root, depending on your structure)
git add .
git commit -m "feat: production-ready Harbinger POS"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

Use a **private** repository to protect your business logic.

### Step 2 — Import into Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New → Project**.
2. Select **Import Git Repository** → connect your GitHub account if prompted.
3. Find your repo and click **Import**.
4. Vercel auto-detects Next.js. **Root Directory**: if your `package.json` is inside `nextapp/`, set Root Directory to `nextapp`. If it's at the repo root, leave it blank.
5. Do **not** click Deploy yet — set env vars first.

### Step 3 — Configure Build Settings

Vercel should auto-populate these from `vercel.json`. Verify they match:

| Setting | Value |
|---|---|
| Framework | Next.js |
| Build Command | `npm run build` |
| Output Directory | `.next` |
| Install Command | `npm install` |

### Step 4 — Set Environment Variables

In the Vercel project, go to **Settings → Environment Variables**.

Add each variable from the table at the top of this guide. For `DATABASE_URL` and `JWT_SECRET`, make sure to select all three environments: **Production**, **Preview**, and **Development**.

> **Security tip:** Create a separate database (or Neon branch) for Preview/Development so test data never touches your production database.

### Step 5 — Deploy

Click **Deploy**. The build runs `prisma generate && next build`.

Watch the build logs. A successful build ends with:
```
✓ Compiled successfully
✓ Collecting page data
✓ Generating static pages
```

Your live URL is `https://your-project-name.vercel.app`.

---

## Phase 3 — The Print Agent (CRITICAL for Kitchen Printing)

> ### ⚠️ IMPORTANT: Thermal Printing Requires a Local Agent
>
> Vercel deploys your POS over **HTTPS**. Modern browsers **block** any HTTP
> request made from an HTTPS page to a local IP address — this is the browser's
> "Mixed Content" security policy. Without the print agent, clicking **Test Print**
> in Kitchen Settings will silently fail or show a "Print Agent Required" dialog.
>
> **This is not a bug.** It is by design, and the solution is the Harbinger Print
> Agent.

### How it works

```
Browser (HTTPS) ──HTTPS──▶ localhost:9101 ──TCP──▶ 192.168.1.100:9100 (printer)
                         (Print Agent)
```

Browsers allow HTTPS pages to call `http://localhost` (loopback). The Print Agent
accepts the job on `localhost:9101` and opens a raw TCP socket to the actual
printer on your LAN.

### Setup instructions (for the cashier / admin computer)

1. Make sure [Node.js](https://nodejs.org) is installed (v18 or later).
2. In the Harbinger POS, go to **Restaurant → Kitchen Setup → Edit a kitchen** and click **⬇ Download Print Agent** — or download `harbinger-print-agent.js` from the project's `public/downloads/` folder.
3. Open a terminal in the folder where you saved the file and run:
   ```bash
   node harbinger-print-agent.js
   ```
4. You should see:
   ```
     ╔══════════════════════════════════════════╗
     ║   Harbinger Print Agent  v1.0            ║
     ╠══════════════════════════════════════════╣
     ║   Listening on http://localhost:9101     ║
     ╚══════════════════════════════════════════╝
   
     Keep this window open while using the POS.
   ```
5. Keep this terminal open. Go back to Kitchen Settings and click **🖨️ Test Print** — it should now succeed.

### Make it start automatically (Windows)

Create a shortcut or a scheduled task that runs `node harbinger-print-agent.js` on login. A simple `.bat` file:

```bat
@echo off
node "C:\path\to\harbinger-print-agent.js"
pause
```

Save it to `shell:startup` to run at Windows login.

---

## Phase 4 — Post-Deploy Checks

Work through this checklist after your first successful deploy:

- [ ] **Login** — Go to `https://your-app.vercel.app/login`. Enter your tenant slug, staff ID, and password. You should land on the POS dashboard.
- [ ] **Register a new tenant** — Go to `/register-tenant` and create a test account. Confirm the record appears in Supabase/Neon's table viewer.
- [ ] **Make a sale** — Add a product, charge a customer, verify the order appears in Reports.
- [ ] **Test the Print Agent** — Start the agent on the cashier computer, go to Kitchen Setup, enter a printer IP, and run Test Print. Confirm the receipt prints.
- [ ] **Change the demo admin password** — If you seeded demo data, log in as `ADMIN001` and change the password immediately under Settings → Staff.
- [ ] **Custom domain (optional)** — In Vercel → Project → Domains, add your domain and follow the DNS instructions.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Build error: `Cannot find module '@prisma/client'` | `prisma generate` didn't run | Confirm `build` script is `prisma generate && next build` in `package.json` |
| Login returns "Server error" | `DATABASE_URL` wrong or DB not initialised | Check Vercel logs; re-run `prisma db push` against the cloud DB |
| "Prepared statement already exists" (Supabase) | PgBouncer in session mode | Ensure `?pgbouncer=true` is appended to the Supabase pooler URL |
| Print Agent dialog appears on every test print | Agent not running | Start `node harbinger-print-agent.js` and keep the terminal open |
| Prisma migration errors locally after deploy | `DIRECT_URL` not set | Add `directUrl = env("DIRECT_URL")` to `schema.prisma` (Supabase only) |
| 500 on `/login` in production only | `JWT_SECRET` missing | Check Vercel → Settings → Environment Variables |
