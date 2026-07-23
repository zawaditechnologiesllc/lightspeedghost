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

## 3. Frontend hosting — Vercel (current) → Cloudflare Pages (staged)

> **Current production host is Vercel.** The repo keeps both configs side by
> side so nothing breaks before you cut over:
> - **Vercel (active):** `vercel.json` (SPA rewrites + `/seo/*` proxy + headers)
>   and `api/seo-proxy.js`. `.github/workflows/deploy.yml` deploys to Vercel on
>   push to `main`.
> - **Cloudflare Pages (staged):** `functions/`, `public/_headers`, and
>   `wrangler.toml` are ready. To cut over: move DNS to Cloudflare Pages, set the
>   build settings below, then switch `deploy.yml` to `wrangler pages deploy`
>   (or remove it and use Pages' Git integration). Vercel and Cloudflare ignore
>   each other's config files, so they coexist safely.

**Goal:** Deploy the React frontend, connect your domain, and point it at the Render API.

### Cloudflare Pages — Deploy (Git integration — recommended)

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages → Create → Pages → Connect to Git**
2. Select your GitHub repository
3. Configure the build:
   | Setting | Value |
   |---|---|
   | **Project name** | `lightspeedghost` (must match `name` in `wrangler.toml`) |
   | **Production branch** | `main` |
   | **Build command** | `pnpm --filter @workspace/lightspeed-ghost run build` |
   | **Build output directory** | `artifacts/lightspeed-ghost/dist/public` |
   | **Root directory** | `/` (repo root — the `functions/` SEO proxy lives here) |
4. Under **Environment Variables**, add:
   | Key | Value |
   |---|---|
   | `VITE_API_URL` | Your Render URL from step 2 (e.g. `https://lightspeedghost-api.onrender.com`) |
   | `SEO_BACKEND_ORIGIN` | *(optional)* overrides the backend origin the `/seo/*` proxy targets |
5. Click **Save and Deploy** — first deploy takes ~2 min

> **Alternative — CI deploy:** `.github/workflows/deploy.yml` deploys on every push
> to `main` via `wrangler pages deploy`. It needs two repo secrets:
> `CLOUDFLARE_API_TOKEN` (with *Cloudflare Pages: Edit* permission) and
> `CLOUDFLARE_ACCOUNT_ID`. Use either Git integration **or** the workflow — not both,
> or every push deploys twice.

### How the pieces map (formerly vercel.json)

| Concern | Where it lives now |
|---|---|
| `/seo/:slug` → backend proxy | `functions/seo/[slug].js` (Pages Function) |
| `/seo-sitemap.xml` → backend proxy | `functions/seo-sitemap.xml.js` (Pages Function) |
| SPA fallback to `index.html` | Automatic — Pages serves `index.html` for unmatched routes when no `404.html` exists |
| Cache + security headers | `artifacts/lightspeed-ghost/public/_headers` (copied into the build output) |

### Connect your domain

1. In Cloudflare Pages → your project → **Custom domains → Set up a custom domain**
2. Add `lightspeedghost.com`, then repeat for `www.lightspeedghost.com`
3. If the domain's DNS is already on Cloudflare, the records are created automatically.
   Otherwise either move the nameservers to Cloudflare (recommended) or add the
   `CNAME` records Pages shows you (`<project>.pages.dev`) at your registrar
4. SSL is issued automatically within a few minutes

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

### Cloudflare Pages (Frontend)
| Variable | Description |
|---|---|
| `VITE_API_URL` | Render backend URL (no trailing slash) |
| `SEO_BACKEND_ORIGIN` | Optional — backend origin for the `/seo/*` Pages Function proxy |

---

## Redeployment

- **Frontend changes** → push to `main` → Cloudflare Pages auto-deploys
- **Backend changes** → push to `main` → Render auto-deploys (if you connected the repo)
- **Schema changes** → run updated SQL in Supabase SQL Editor, or use `pnpm --filter @workspace/db run push` with `DATABASE_URL` pointing at Supabase
