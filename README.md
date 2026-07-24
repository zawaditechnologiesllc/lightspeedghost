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
| LightSpeed Humanizer | `/humanizer` | Refines AI-assisted text into a natural, authentic academic voice in your own words (reduces the false flags unreliable detectors produce — not framed as evasion) |
| Paper Revision | `/revision` | Upload a draft + target grade; AI revises every section that falls short |
| Outline Builder | `/outline` | Hierarchical Roman-numeral outlines with thesis statement |
| AI & Plagiarism Checker | `/plagiarism` | **Free** — never touches an LLM. Lexical-diversity AI detection + cosine-similarity plagiarism scan against 10B+ pages, every match traced to its source. Blended into the free command box on the landing/dashboard |
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
| Pro Monthly | $29.99/mo | 15 | 20 | 20 | 40 | 150 sessions | 30 |
| Pro Annual | $269/yr | 15 | 20 | 20 | 40 | 150 sessions | 30 |
| Institution | Custom quote | custom | custom | custom | custom | custom | custom |
| Ebooks Add-On | $29.99/mo | — | — | — | — | 15 ebooks | — |
| Pay-as-you-go | From $1.99 | from $3.99 | from $1.99 | from $1.99 | $1.99 | $2.99/day | Free |

> **Limits are economics-tuned and admin-overridable** (`/mwaramuriuki-login` → plan
> limits, backed by `systemSettings.ts` → `usageTracker.ts`). STEM is capped at 40/mo
> (was 60) because it's the top per-unit cost driver (Sonnet + ReAct); plagiarism is
> raised to 30/mo because the checker is near-zero marginal cost. See
> **Unit Economics** below for the full margin analysis.

> The Free plan never touches an LLM: the Writing Analyzer runs entirely in the
> browser, and its plagiarism/AI checks use local statistical detection
> (burstiness + perplexity) instead of a model call. Legacy Starter ($9.99) and
> Student Pro ($19.99) subscribers keep their entitlements, but those plans are
> no longer offered for new purchase.

---

## Unit Economics (2026)

Model prices (`aiGateway.ts`, per 1M tokens): gpt-4o-mini `$0.15/$0.60` · claude-haiku-4-5
`$0.25/$1.25` · gpt-4o `$2.50/$10` · claude-sonnet-4-5 `$3/$15`. Routing: `fast`→mini,
`standard`/`power`→Sonnet. Estimated worst-case cost per unit (Sonnet-heavy, no cache):

| Tool | Model tier | ~Cost/unit | Notes |
|---|---|---|---|
| Paper | power (Sonnet) | ~$0.35 | Research context + draft + quality/plagiarism passes; dissertations up to ~$1.50 |
| Revision | standard | ~$0.12 | |
| Humanizer | standard | ~$0.08 | |
| STEM | power (Sonnet/ReAct) | ~$0.15 | **Top cost driver at scale** |
| Study msg | fast (Haiku) | ~$0.01 | Cheap → keep generous |
| Assistant msg | fast (Haiku) | ~$0.01 | Cheap → keep generous |
| Outline | standard | ~$0.03 | |
| Plagiarism | none / local | ~$0.00–0.01 | Free tool: no LLM |

**Free plan:** ~$0 marginal COGS (never touches an LLM) — the scalable acquisition engine.

**Pro ($29.99/mo) worst-case (100% utilization):** old limits ≈ **$23.6** COGS (STEM 60 = $9
alone) → razor-thin margin for power users. New limits (STEM 60→40, others held, plagiarism
20→30) ≈ **$20.7** worst-case. Typical Pro user (~20–30% utilization, Haiku for study/assistant)
≈ **$4–7** COGS → **~80% gross margin**. After Stripe (~2.9% + $0.30 ≈ $1.17) the floor stays
positive even for power users.

**PAYG margins:** paper $3.99–$59.99 → 96–98% · STEM $1.99 → ~92% · outline $1.99 → ~98%.
The **Study Day Pass ($2.99, unlimited 24h)** is the one unbounded item — recommend a soft cap
(~40 tutor messages / 24h) to bound worst-case at ~$0.40.

**Highest-ROI optimization:** enable Anthropic prompt caching on the paper/STEM research
context (90% input discount) — cuts paper + STEM COGS ~40–50%, the single biggest lever.

---

## Security

Defense-in-depth across the frontend host and the API:

- **Frontend (`public/_headers`, Cloudflare Pages):** Content-Security-Policy that hard-blocks the
  high-impact vectors (`frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`,
  `form-action 'self'`, `upgrade-insecure-requests`) while allowing `https:` scripts/styles/images so
  Google Fonts, Stripe.js, and the chat widget keep working (nonce-based strict-dynamic is the next
  hardening step); `Strict-Transport-Security`
  (2-year, preload), `Cross-Origin-Opener-Policy: same-origin-allow-popups` (keeps OAuth popups
  working), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, hardened `Permissions-Policy`.
- **API (`app.ts`):** `helmet`, strict CORS allowlist (no wildcard; auto www/non-www), hardened
  sessions (`httpOnly` + `secure` + `sameSite`), and rate limiting — global **120 req/min/IP**,
  AI routes **20 req/min/IP**, admin-login limiter.
- **Injection:** SEO/generated HTML is escaped (`escapeHtml`) and run through
  `sanitizeContent`/`checkAcademicIntegrity`; no unsanitized `dangerouslySetInnerHTML` on user input.
- **Cloudflare dashboard (operator action, not code):** enable WAF Managed Rules, Bot Fight Mode,
  DDoS protection, and rate-limiting rules; set SSL/TLS to **Full (strict)** and turn on
  **Always Use HTTPS** + **Automatic HTTPS Rewrites**. These are account-level toggles the code
  cannot set.

---

## Quality Gates (hard blocks before delivery)

1. **Citation verification** — every source must have a real DOI
2. **Plagiarism gate** — cosine similarity < 8%; rewrites and re-checks until clear
3. **AI detection gate** — multi-pass humanization toward a natural, authentic academic voice (detectors are unreliable, so the goal is genuine writing quality, never evasion; always review and edit before submitting)
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
