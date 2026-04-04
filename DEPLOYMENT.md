# Light Speed Ghost — Deployment Guide

Three services, three platforms. Do them in this order.

---

## 1. Supabase (Database)

**Goal:** Provision the PostgreSQL database and get a connection string for Render.

1. Go to [supabase.com](https://supabase.com) → **New Project**
2. Choose a region close to where you'll deploy on Render (e.g. US East)
3. Wait for the project to spin up (~2 min)
4. Open **SQL Editor** → paste the entire contents of `supabase/schema.sql` → **Run**
5. Go to **Project Settings → Database → Connection string → URI**
6. Copy the connection string — it looks like:
   ```
   postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
   ```
   > Keep this — you'll need it in step 2.

---

## 2. Render (API Backend)

**Goal:** Deploy the Express API server and wire it to Supabase.

1. Go to [render.com](https://render.com) → **New → Web Service**
2. Connect your GitHub repo and select the repository
3. Configure the service:
   | Setting | Value |
   |---|---|
   | **Root Directory** | `artifacts/api-server` |
   | **Runtime** | Node |
   | **Build Command** | `npm install && npm run build` |
   | **Start Command** | `node dist/index.js` |
4. Under **Environment Variables**, add:
   | Key | Value |
   |---|---|
   | `DATABASE_URL` | Your Supabase connection string from step 1 |
   | `PORT` | `8080` |
   | `NODE_ENV` | `production` |
   | `SESSION_SECRET` | Any long random string (32+ chars) |
5. Click **Deploy**
6. Once live, copy your service URL — e.g. `https://lightspeedghost-api.onrender.com`

   > **Note:** Render free tier spins down after 15 min of inactivity. Upgrade to a paid instance type to keep the API always-on.

---

## 3. Vercel (Frontend)

**Goal:** Deploy the React frontend, connect your domain, and point it at the Render API.

### Deploy

1. Go to [vercel.com](https://vercel.com) → **Add New → Project**
2. Import your GitHub repository
3. Vercel will auto-detect the `vercel.json` at the repo root — no framework preset needed
4. Under **Environment Variables**, add:
   | Key | Value |
   |---|---|
   | `VITE_API_URL` | Your Render URL from step 2 (e.g. `https://lightspeedghost-api.onrender.com`) |
5. Click **Deploy** — first deploy takes ~2 min

### Connect your domain

1. In Vercel → your project → **Settings → Domains**
2. Click **Add Domain** → type `lightspeedghost.com`
3. Vercel shows you two DNS records to add:
   - An `A` record pointing to `76.76.21.21`
   - A `CNAME` for `www` pointing to `cname.vercel-dns.com`
4. Log into your domain registrar (GoDaddy, Namecheap, Cloudflare, etc.) and add both records
5. Back in Vercel, click **Verify** — SSL is issued automatically within a few minutes

### Set up CORS on Render

Once your domain is live, add this to Render → your service → **Environment Variables**:
| Key | Value |
|---|---|
| `ALLOWED_ORIGINS` | `https://lightspeedghost.com,https://www.lightspeedghost.com` |

The API server already reads this variable — no code changes needed. Without it set, the server allows all origins (which is fine for initial testing, but set it before going public).

---

## Environment Variable Summary

### Render (API Server)
| Variable | Description |
|---|---|
| `DATABASE_URL` | Supabase PostgreSQL connection string |
| `PORT` | `8080` |
| `NODE_ENV` | `production` |
| `SESSION_SECRET` | Random 32+ character secret |
| `ALLOWED_ORIGINS` | Comma-separated list of allowed frontend origins |

### Vercel (Frontend)
| Variable | Description |
|---|---|
| `VITE_API_URL` | Render backend URL (no trailing slash) |

---

## Redeployment

- **Frontend changes** → push to `main` → Vercel auto-deploys
- **Backend changes** → push to `main` → Render auto-deploys (if you connected the repo)
- **Schema changes** → run updated SQL in Supabase SQL Editor, or use `pnpm --filter @workspace/db run push` with `DATABASE_URL` pointing at Supabase
