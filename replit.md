# Light Speed Ghost — AI Academic Writing Platform

## Overview

Light Speed Ghost is a full-stack AI academic writing platform for students and academics. It provides AI-powered paper generation with real verifiable citations, paper revision with tracked changes and grade estimates, AI and plagiarism detection, STEM problem-solving, and an AI study assistant. All outputs target 0% AI detection, ≤8% plagiarism, and ≥92% grade quality.

---

## Canonical Pricing

> **Single source of truth: `artifacts/lightspeed-ghost/src/lib/pricing.ts` (frontend display) and `artifacts/api-server/src/lib/pricingConfig.ts` (backend charge amounts).**
> All UI components must read from these files. Never hardcode prices as string literals in transaction-facing components.

| Plan | Price | Billing |
|---|---|---|
| Starter | **$9.99/mo** | Monthly — amountCents: 999 |
| Pro | **$29.99/mo** | Monthly — amountCents: 2999 |
| Pro Annual | **$269/yr ($22.42/mo)** | Annual — amountCents: 26900 · saves 25% vs monthly |
| Institution | **Custom pricing** | Admin-assigned only. Not available for self-service purchase. amountCents set per contract. |
| Ebooks Add-On | **$29.99/mo** | Monthly — amountCents: 2999 · **completely separate from academic plans** |

### Pay-As-You-Go (PAYG) prices — no subscription required, credits never expire

| Document Type | Paper | Revision | Humanizer |
|---|---|---|---|
| Discussion Post (≤500w) | $3.99 | $1.99 | $1.99 |
| Essay / Short Paper (500–1,500w) | $7.99 | $3.99 | $3.99 |
| Research Paper (1,500–3,500w) | $14.99 | $7.99 | $7.99 |
| Research Proposal / Report (3,500–6,000w) | $24.99 | $12.99 | $12.99 |
| Thesis / Dissertation (6,000–15,000w) | $59.99 | $24.99 | $24.99 |

| Tool | PAYG Price |
|---|---|
| STEM Solve | $1.99 |
| Study Day Pass | $2.99 |
| Plagiarism Check | $1.99 |
| Outline | $1.99 |

---

## Canonical Plan Usage Limits

> **Single source of truth: `artifacts/api-server/src/lib/usageTracker.ts` (`PLAN_LIMITS`).**
> The frontend hook (`useSubscription.ts`) must mirror these exactly. Backend enforcement via `enforceLimit()` is the security layer; frontend is UX only.

| Tool | Starter | Pro | Institution (per seat) |
|---|---|---|---|
| Papers | 3 | 15 | 5 |
| Revisions | 1 | 20 | 8 |
| Humanizer | 1 | 20 | 8 |
| STEM Solves | 15 | 40 | 30 |
| Study Sessions | 20 | 80 | 75 |
| Plagiarism Checks | 5 | 20 | 10 |
| Outlines | 5 | 20 | 10 |
| Assistant (text) | 30 | 300 | 150 |
| Ebooks | 0 (add-on only) | 0 (add-on only) | 0 (add-on only) |

### What plans cover vs. PAYG-only
- **Subscription plans (Starter & Pro):** Paper generation for discussion posts, essays, and research papers only (up to ~3,500 words). All other tools (revision, humanizer, STEM, study, plagiarism, outlines) work with any length within quota.
- **PAYG only — not in any plan:** Research proposals/reports (3,500–6,000w) and dissertations/theses (6,000–15,000w). Higher compute cost makes per-job pricing the only option.
- **Ebooks ($29.99/mo):** Entirely separate business add-on. Unrelated to academic plans. Independent quota, independent subscription. Users can hold one, both, or neither.

---

## Non-Negotiable Quality Gates (enforced server-side before delivery)

- **AI score:** 0% target. Gate triggers humanization loop (up to 3 passes) if score > 0%. All reported scores are real measured values.
- **Plagiarism:** ≤8% ceiling. Gate triggers rephrasing if score > 8%.
- **Grade:** ≥92% against prebuilt rubric or student-uploaded rubric. Grade optimizer loop runs on gaps.
- **Word count:** 95–105% of target (hard cap). Backend auto-corrects if outside range. Excludes: reference list, in-text citations, headings, abstract, ToC, figure/table captions.
- **Citations:** 1 in-text citation per 150–200 words (minimum 3). All citations verified against live academic APIs.

---

## User Preferences

- All work referenced and cited from academic sources unless student instructions say otherwise.
- Word count: body text from introduction through conclusion only.
- Max words: target + 5% hard limit.
- Expand if <95% of target; trim if >105%.
- Citation ratio: 1 per 150–200 words minimum.

---

## System Architecture

**Monorepo:** `pnpm workspaces`, Node.js 24, TypeScript 5.9

| Layer | Stack |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, Radix UI, shadcn/ui |
| Backend | Express 5, Pino logging |
| Database | PostgreSQL (Replit-hosted), Drizzle ORM |
| State | TanStack React Query |
| Charts | Recharts |
| Validation | Zod, drizzle-zod |
| Payment | Stripe, Paystack, IntaSend (geo-detected) |
| AI | Claude 3.5 Sonnet (reasoning), GPT-4o (vision/OCR), GPT-4o-mini (detection/bibliography) |
| Caching | Upstash Redis |

---

## Features

### Write Paper
AI paper generation with citations in 11 academic styles (APA, MLA, Chicago, Harvard, IEEE, Turabian, Vancouver, AMA, ASA, Bluebook, OSCOLA). Supports 35 paper types across essays, research, reviews, professional, proposals, personal, and creative categories. Form includes spacing (single/1.5/double), minimum sources, and language dialect (US/UK/Australian English). Data-oriented types accept CSV/Excel uploads with automatic descriptive statistics, correlation analysis, visualization guidance, and financial ratio computation. Interpretive Commentary toggle adds plain-English explanations after every statistic, p-value, and financial ratio.

### Outline Generator
Structured paper outline generation matching all 35 Write Paper types. Phase-based UX.

### Revision Panel
Paper revision with tracked changes and estimated grade feedback.

### LightSpeed Humanizer
Detects AI-generated text and rewrites to bypass AI detection. Tone selection, before/after comparisons.

### AI & Plagiarism Checker
AI detection scores + plagiarism source identification using the open-source plagiarism engine.

### STEM Solver
Step-by-step solutions across 11 subjects (Mathematics, Physics, Chemistry, Biology, Engineering, CS, Statistics, Finance, Accounting, Economics, Actuarial Science) with Recharts visualizations in a handwritten pen-on-paper aesthetic. Finance subjects support TVM, DCF, financial ratios, journal entries, actuarial tables, and credit analysis.

### AI Study Assistant
Chat-based tutor with session history and image/screenshot upload. Math rendered in handwritten style. Finance/economics subjects show a Financial Statements panel (amber theme) injecting ratio context.

### Financial Statements Analysis Engine
Parses Income Statement / Balance Sheet / Cash Flow text, computes 25+ ratios (profitability, liquidity, solvency, efficiency, DuPont, FCF), and injects a structured AI instruction block. Available in Write Paper (finance subjects), STEM Solver (finance/accounting/economics/actuarial), and Study Assistant.

### Ebooks (Add-On)
15 AI-written ebooks/month for Amazon KDP, Apple Books, and all major platforms. Separate $29.99/mo subscription. Not connected to any academic plan.

### Documents
All saved documents with search and filter. Scoped by userId server-side.

---

## Technical Architecture Details

### AI Routing (ClawRouter)
- **Claude 3.5 Sonnet:** Reasoning tasks — paper writing, STEM, tutoring, revision
- **GPT-4o:** Vision/OCR tasks
- **GPT-4o-mini:** Cheaper tasks — bibliography, AI detection, data extraction

### Quota Enforcement
- **Backend (authoritative):** `enforceLimit()` in `usageTracker.ts`. Atomic SQL increment with ceiling check. Returns quota error before any AI processing. Limits overridable from `system_settings` DB table (cached 60s).
- **Frontend (UX):** `useSubscription.ts` → `usePaywallGuard.ts`. Frontend limits must always mirror `usageTracker.ts` exactly.
- **Assistant route:** Checks plan-gated features (image mode) before consuming quota — Pro-only image mode is blocked before quota is charged.

### Payment Security
- All charge amounts calculated server-side from `pricingConfig.ts` / `getPaygPrice()` — never from client input.
- Credit spending validates amount against server-side pricing.
- Plan mapping in `/payments/verify` correctly distinguishes starter, pro, and institution.
- `PaymentSuccess` page only shows success when server verification confirms payment — no false-success fallback.

### Document Ownership
All document CRUD scoped by `userId`. No cross-user access.

### UI/UX Conventions
- **Mobile:** All pages optimized for 390px+. Mobile nav bars, collapsible sidebars, responsive layouts.
- **Handwritten math:** Kalam font, `font-handwritten` / `handwritten-block` / `handwritten-expression` CSS classes.
- **Phase-based progress UX:** Outline, StemSolver, WritePaper, Revision, Humanizer.
- **Brand palette:** Electric blue primary, sky blue accent, deep navy sidebar/dark backgrounds.
- **PWA:** Install banners for Android and iOS.

### Memory System
Short-term conversational context + long-term student profiles in PostgreSQL. Semantic memory recall via `@memvid/sdk`. Modules: `memory.ts`, `memvidMemory.ts`, `learningEngine.ts`.

### File Upload
Server-side: PDF (`pdf2json`), DOCX (`mammoth`), text. Client-side: image OCR (`tesseract.js`). Smart autofill across services.

### Shared AI Detection Pipeline
Consistent AI detection across all tools (Plagiarism Checker, Humanizer, Paper Writer, Revision) using GPT-4o-mini + burstiness blend with retry logic (`aiDetection.ts`).

### Open-Source Plagiarism Engine
Sentence-level fingerprinting against Open Library, Wikipedia, Google Books, Internet Archive, and CrossRef (`openSourceSearch.ts`).

---

## External Dependencies & APIs

### Academic Citation APIs (`citationVerifier.ts`, `academicSources.ts`)
**25+ live databases, 1.5B+ papers, fully keyless (except NASA ADS which is optional).**

| Group | Sources |
|---|---|
| Core aggregators | OpenAlex (250M+), CrossRef (145M+), Semantic Scholar (200M+), BASE (340M+), CORE (200M+) |
| Biomedical | PubMed NCBI (36M+), PubMed Central (8M+), Europe PMC (40M+), bioRxiv, medRxiv, ClinicalTrials.gov |
| STEM | arXiv (2.4M+), NASA ADS (16M+ — optional key), Zenodo, DataCite (48M+), Dryad |
| OA Journals | DOAJ (20K+ journals), PLOS ONE, Figshare (9M+) |
| Education/Humanities | ERIC (US Dept of Ed), HAL France (1.5M+), OpenAIRE (100M+ EU), OSF Preprints |
| Economics | NBER Working Papers (35K+) |
| Current Events Layer | arXiv + CrossRef + OpenAlex filtered to last 90 days — auto-triggers on current-events topics |

**Discipline routing:** astronomy→NASA ADS, economics→NBER, biomedical→bioRxiv/medRxiv/ClinicalTrials, etc.
**Verifiability guarantee:** every paper returned has a DOI or institutional URL. No Wikipedia, no news, no hallucinated citations.
**Rate limiters:** all 25+ sources have individual Bottleneck limiters in `ssRateLimit.ts`.
**Adaptive weighting:** performance-learned source weights per subject stored in DB (`source_stats` table).
**Recent-events handling:** `isCurrentEventsTopic()` detects 2024/2025/2026/recent/pandemic/election/etc. keywords and fires the 90-day recency layer in parallel with the main search.

### STEM APIs
EBI BioModels, PubChem

### File Processing
`pdf2json`, `mammoth`, `tesseract.js`

### Other
`@memvid/sdk` (memory), Pino (logging), Drizzle ORM, Zod

---

## Sector Admin System

The admin panel (`/admin`) supports two admin roles:

### Super Admin
- Authenticates with just `ADMIN_PASSWORD` env var (no email required)
- Has access to all tabs including the `admin-management` tab
- Can create, edit, toggle active/inactive, and delete sector admins

### Sector Admin
- Authenticates with email + password (bcrypt-hashed in `admin_users` DB table)
- Has access only to tabs in their assigned sectors (union of sector tab lists)
- Cannot access `admin-management` tab
- Login: enter email in the "Sector Admin Email" field + their password

### Sector-to-Tab Mapping
| Sector | Tabs |
|---|---|
| content | overview, users, documents, ebooks, announcements, messages |
| finance | overview, payments, credits, finance, referrals, gateways |
| analytics | overview, analytics, logs, intelligence |
| support | overview, users, messages, credits |
| technical | overview, tools, gateways, settings, logs |

### Auth flow
- Frontend stores `admin_token`, `admin_role` (JSON), `admin_email` in `sessionStorage`
- Backend: `POST /api/admin/verify` — super admin checks `ADMIN_PASSWORD` env var; sector admin checks bcrypt hash from `admin_users` table
- All admin routes require either super-admin token or `x-admin-email` + `x-admin-password` headers

---

## Workflows

| Workflow | Command | Purpose |
|---|---|---|
| `API Server` | `pnpm --filter @workspace/api-server run dev` | Express backend |
| `artifacts/lightspeed-ghost: web` | `pnpm --filter @workspace/lightspeed-ghost run dev` | React frontend (primary) |
| `artifacts/mockup-sandbox: Component Preview Server` | `pnpm --filter @workspace/mockup-sandbox run dev` | UI sandbox |

The `Start application` workflow conflicts with `artifacts/lightspeed-ghost: web` on port 18522 — this is expected. Only `artifacts/lightspeed-ghost: web` should run.

---

## GitHub

Repository: `zawaditechnologiesllc/lightspeedghost`
Branch: `main`
All commits are pushed automatically at the end of each agent session.
