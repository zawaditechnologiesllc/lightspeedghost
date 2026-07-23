# Light Speed Ghost

Eight AI tools built for students. One platform, purpose-built for academic writing.

**Live site:** https://lightspeedghost.com  
**Stack:** React + Vite · Express + TypeScript · PostgreSQL (Supabase) · Drizzle ORM  
**Deployments:** Vercel (frontend — current) · Cloudflare Pages (staged for cutover) · Render (API)

---

## The Eight Tools

| Tool | URL | What it does |
|---|---|---|
| AI Paper Writer | `/write` | Full academic papers grounded in 10 live databases (1B+ papers), DOI-verified citations, rubric upload |
| LightSpeed Humanizer | `/humanizer` | Detect-rewrite-redetect loop; passes Turnitin, GPTZero, Originality.ai |
| Paper Revision | `/revision` | Upload a draft + target grade; AI revises every section that falls short |
| Outline Builder | `/outline` | Hierarchical Roman-numeral outlines with thesis statement |
| AI & Plagiarism Checker | `/plagiarism` | Lexical-diversity AI detection + cosine-similarity plagiarism scan |
| STEM Solver | `/stem` | Step-by-step solutions with KaTeX equations, molecule diagrams, photo upload |
| AI Study Assistant | `/study` | Persistent-memory tutor; remembers your history across every session |
| AI Ebook Writer | `/ebooks` | Full ebooks for KDP, Apple Books, Gumroad — multiple genres and tones |

---

## Monorepo Structure

```
/
├── artifacts/
│   ├── lightspeed-ghost/          # Frontend — React + Vite
│   │   ├── index.html             # SEO/AEO structured data (Schema.org)
│   │   ├── public/
│   │   │   ├── robots.txt         # AI + search crawler rules
│   │   │   ├── sitemap.xml
│   │   │   ├── llms.txt           # GEO context file (short)
│   │   │   └── llms-full.txt      # GEO context file (full)
│   │   └── src/
│   │       ├── pages/             # Route-level components
│   │       ├── components/        # Shared UI (checkout, layout, paywall)
│   │       ├── hooks/             # usePaywallGuard, useSubscription
│   │       └── lib/               # pricing.ts, exportUtils.ts
│   └── api-server/                # Backend — Express + TypeScript
│       └── src/
│           ├── routes/            # One file per domain
│           ├── middlewares/       # JWT auth (Supabase)
│           └── lib/               # AI clients, usage tracker, pricing config
├── lib/
│   ├── db/                        # Drizzle ORM schema + pool
│   ├── api-zod/                   # Shared Zod validation schemas
│   └── api-client-react/          # Generated React query hooks
├── supabase/
│   └── schema.sql                 # Full database schema — run this first
├── functions/                     # Cloudflare Pages Functions (SEO proxy)
├── render.yaml                    # Render service definition
├── wrangler.toml                  # Cloudflare Pages project config
├── DEPLOYMENT.md                  # Step-by-step deploy guide
├── PAYMENT_ENV_VARS.md            # All payment gateway env vars
└── SYSTEM_DOCUMENTATION.md       # Full architecture + API reference
```

---

## Architecture

```
Browser
  │
  ▼
Cloudflare Pages (React + Vite)
  │  /api/*
  ▼
Render (Express API — port 8080)
  │
  ├── Supabase PostgreSQL (auth + data)
  ├── Anthropic Claude API (AI generation)
  ├── OpenAlex / CrossRef / PubMed / Semantic Scholar
  │   arXiv / CORE / ERIC / Zenodo / DOAJ / Europe PMC
  └── Payment gateways (Stripe · Paystack · IntaSend · Paddle · LemonSqueezy)
```

### Payment gateway routing

| Region | Gateway |
|---|---|
| KE, UG, TZ | IntaSend (M-Pesa, Airtel Money) |
| Nigeria, Ghana, South Africa + Africa | Paystack |
| US, CA, GB, AU, EU, JP, SG, AE + developed markets | Stripe |
| Rest of world | Paddle (auto VAT) |
| Fallback | Lemon Squeezy |

---

## Local Development

### Prerequisites

- Node.js 20+
- pnpm 9+
- A Supabase project with `supabase/schema.sql` applied
- `.env` file in `artifacts/api-server/` (copy from `artifacts/api-server/.env.example`)

### Install

```bash
pnpm install
```

### Run both services

```bash
# Terminal 1 — API server (port 8080)
pnpm --filter @workspace/api-server run dev

# Terminal 2 — Frontend (port 18522)
pnpm --filter @workspace/lightspeed-ghost run dev
```

Frontend dev server proxies `/api/*` to `http://localhost:8080`.

---

## Environment Variables

### Render (API server) — required

| Variable | Description |
|---|---|
| `DATABASE_URL` | Supabase PostgreSQL connection string |
| `SESSION_SECRET` | Random 32+ character string |
| `ALLOWED_ORIGINS` | `https://lightspeedghost.com,https://www.lightspeedghost.com` |
| `NODE_ENV` | `production` |
| `ANTHROPIC_API_KEY` | Claude API key |

### Render — Stripe (primary payment gateway)

| Variable | Description |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_live_...` |
| `STRIPE_PUBLISHABLE_KEY` | `pk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` |
| `STRIPE_PRICE_STARTER_MONTHLY` | Price ID for $9.99/month |
| `STRIPE_PRICE_PRO_MONTHLY` | Price ID for $29.99/month |
| `STRIPE_PRICE_PRO_ANNUAL` | Price ID for $269/year |
| `STRIPE_PRICE_EBOOKS_MONTHLY` | Price ID for ebooks add-on $29.99/month |

> The API also accepts `STRIPE_PRICE_EBOOK_MONTHLY` (no `S`) as a fallback for the ebooks plan.

Full list of all gateway variables: see [`PAYMENT_ENV_VARS.md`](./PAYMENT_ENV_VARS.md)

### Cloudflare Pages (frontend)

| Variable | Description |
|---|---|
| `VITE_API_URL` | Render backend URL, no trailing slash |
| `SEO_BACKEND_ORIGIN` | Optional — backend origin for the `/seo/*` Pages Function proxy |

---

## Deployment

Full step-by-step instructions: [`DEPLOYMENT.md`](./DEPLOYMENT.md)

**Short version:**
1. Run `supabase/schema.sql` in your Supabase SQL editor
2. Deploy `artifacts/api-server` to Render — set env vars
3. Deploy repo root to Cloudflare Pages — set `VITE_API_URL`
4. Add `lightspeedghost.com` in Cloudflare Pages → Custom domains

Push to `main` triggers both Cloudflare Pages (production) and Render (auto-deploy) simultaneously.

---

## Pricing

| Plan | Price | Papers | Humanizer | Revisions | STEM | Study | Plagiarism |
|---|---|---|---|---|---|---|---|
| Free | $0 forever | — | — | — | — | — | 3 local checks + unlimited in-browser Writing Analyzer |
| Pro Monthly | $29.99/mo | 15 | 20 | 20 | 60 | 150 sessions | 20 |
| Pro Annual | $269/yr | 15 | 20 | 20 | 60 | 150 sessions | 20 |
| Institution | Custom quote | custom | custom | custom | custom | custom | custom |
| Ebooks Add-On | $29.99/mo | — | — | — | — | 15 ebooks | — |
| Pay-as-you-go | From $1.99 | per use | per use | per use | $1.99 | $2.99/day | $1.99 |

> The Free plan never touches an LLM: the Writing Analyzer runs entirely in the
> browser, and its plagiarism/AI checks use local statistical detection
> (burstiness + perplexity) instead of a model call. Legacy Starter ($9.99) and
> Student Pro ($19.99) subscribers keep their entitlements, but those plans are
> no longer offered for new purchase.

---

## Quality Gates (hard blocks before delivery)

1. **Citation verification** — every source must have a real DOI
2. **Plagiarism gate** — cosine similarity < 8%; rewrites and re-checks until clear
3. **AI detection gate** — multi-pass humanization until score reaches 0%
4. **Word count gate** — output must be 95–105% of the target (body text only)
5. **Rubric alignment** — if rubric uploaded, cross-checked against A-grade criteria

---

## Academic Database Network

Queries 10 live databases in parallel on every paper or study search, deduplicated and ranked by citation count:

OpenAlex · CrossRef · PubMed NCBI · Semantic Scholar · ERIC · Zenodo · arXiv · CORE · DOAJ · Europe PMC

Total coverage: ~1 billion papers. Wikipedia and non-peer-reviewed sources excluded.

---

## SEO / GEO / AEO

- `index.html` — full Schema.org structured data: `SoftwareApplication`, `FAQPage`, `HowTo`, `ItemList`, `Product`, `WebSite`, `EducationalOrganization`
- `public/robots.txt` — rules for all major AI crawlers: GPTBot, ClaudeBot, Grok, Gemini, Copilot, Perplexity, Mistral, Amazonbot, YouBot
- `public/sitemap.xml` — all 17 pages with priority and `lastmod`
- `public/llms.txt` — short GEO context file for AI models
- `public/llms-full.txt` — full product context: all 8 tools, 10 databases, pricing, FAQs, competitive context

---

## Admin Panel

URL: `https://lightspeedghost.com/mwaramuriuki-login`

Features: user management, usage metrics, gateway on/off toggles, SEO content editor, influencer payouts, cost monitoring.

---

## Branch History

All feature branches have been merged into `main`:

| Branch | Contents |
|---|---|
| `claude/happy-davinci-IC2MJ` | Stripe ebook fix, 2026 SEO/AEO overhaul, git email correction |
| `seo-2026-compliance-and-payments-fix` | Git config fix docs |
| `codex/find-project-description-and-details` | Application features, quota/payment fixes, security hardening |
| `codex/find-project-description-and-details-2fdh4b` | Word-count enforcement, real-time progress tracking |

`main` is the single source of truth. All branches can be safely deleted.
