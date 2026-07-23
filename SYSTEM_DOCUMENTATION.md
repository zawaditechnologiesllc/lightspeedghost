# LightSpeed Ghost — Complete System Documentation

**Version:** Production-ready  
**Stack:** React + Vite (frontend) · Express + TypeScript (API) · PostgreSQL via Supabase · Drizzle ORM  
**Domain:** https://lightspeedghost.com  
**Admin Panel:** https://lightspeedghost.com/mwaramuriuki-login  

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Environment Variables Required](#2-environment-variables-required)
3. [Tools & Features](#3-tools--features)
4. [Subscription & Billing System](#4-subscription--billing-system)
5. [Admin Panel](#5-admin-panel)
6. [Security Model](#6-security-model)
7. [Cost Optimisation Patterns](#7-cost-optimisation-patterns)
8. [Scalability & Performance](#8-scalability--performance)
9. [Deployment Guide (Render + Supabase)](#9-deployment-guide-render--supabase)
10. [Payment Gateway Setup](#10-payment-gateway-setup)
11. [API Reference](#11-api-reference)
12. [Database Schema](#12-database-schema)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                   FRONTEND (Vite)                    │
│  React · TailwindCSS · Wouter · ShadCN UI           │
│  Port 18522 (dev) · /dist/public (prod)              │
│                                                      │
│  Pages: Landing, Auth, Dashboard, WritePaper,        │
│  Outline, Revision, Humanizer, Plagiarism,           │
│  StemSolver, StudyAssistant, Billing, Admin          │
└──────────────────┬──────────────────────────────────┘
                   │  /api/* proxy (Vite dev)
                   │  Direct fetch (production)
┌──────────────────▼──────────────────────────────────┐
│                  API SERVER (Express)                 │
│  TypeScript · Pino logger · Helmet · CORS allowlist  │
│  Port 8080 · JWT auth (Supabase HS256/ES256/RS256)   │
│                                                      │
│  Routes: writing · revision · humanizer · stem       │
│  study · plagiarism · files · documents · payments   │
│  influencer · assistant · ebooks · admin · auth      │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│              SUPABASE / POSTGRESQL                    │
│  Auth (JWT) · Documents · Subscriptions · Credits    │
│  Usage Tracking · Sessions · Payments · Influencers  │
└─────────────────────────────────────────────────────┘
```

### Monorepo Structure

```
/
├── artifacts/
│   ├── lightspeed-ghost/          # Frontend (React + Vite)
│   │   └── src/
│   │       ├── pages/             # Full-page route components
│   │       ├── components/        # Shared UI components
│   │       ├── contexts/          # React contexts (AuthContext)
│   │       └── hooks/             # Custom hooks
│   └── api-server/                # Backend (Express + TypeScript)
│       └── src/
│           ├── routes/            # Express route handlers
│           ├── middlewares/       # auth.ts (JWT verification)
│           ├── lib/               # Shared utilities & AI clients
│           └── index.ts           # Server entry point
└── packages/
    ├── db/                        # Drizzle ORM schema + pool
    └── api-zod/                   # Shared Zod validation schemas
```

---

## 2. Environment Variables Required

Set all of these in your hosting provider (Render → Environment Variables):

### Core (Required)

| Variable | Where to find it |
|---|---|
| `DATABASE_URL` | Supabase → Settings → Database → Connection string (Transaction mode) |
| `SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `SUPABASE_JWT_SECRET` | Supabase → Settings → API → JWT Settings → JWT Secret |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role key |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys |
| `OPENAI_API_KEY` | platform.openai.com → API Keys |
| `SESSION_SECRET` | Any random 32+ character string |
| `ADMIN_PASSWORD` | Secret password for the admin panel |
| `ALLOWED_ORIGINS` | `https://lightspeedghost.com,https://www.lightspeedghost.com` |
| `FRONTEND_URL` | `https://lightspeedghost.com` |
| `PORT` | `8080` (API) / `18522` (Frontend — set by workflow) |

### Payment Gateways (Add as you activate each)

| Variable | Gateway |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe → Developers → API Keys → Secret key |
| `STRIPE_PUBLISHABLE_KEY` | Stripe → Developers → API Keys → Publishable key |
| `STRIPE_WEBHOOK_SECRET` | Stripe → Webhooks → Signing secret (after creating webhook) |
| `STRIPE_PRICE_PRO_MONTHLY` | Stripe Price ID for Pro Monthly plan |
| `STRIPE_PRICE_PRO_ANNUAL` | Stripe Price ID for Pro Annual plan |
| `STRIPE_PRICE_STARTER_MONTHLY` | Stripe Price ID for Starter Monthly plan |
| `PAYSTACK_SECRET_KEY` | Paystack → Settings → API Keys |
| `PAYSTACK_PUBLIC_KEY` | Paystack → Settings → API Keys |
| `PADDLE_API_KEY` | Paddle → Developer Tools → Authentication |
| `PADDLE_WEBHOOK_SECRET` | Paddle → Notifications → Webhook secret |
| `LEMONSQUEEZY_API_KEY` | Lemon Squeezy → Settings → API |
| `LEMONSQUEEZY_STORE_ID` | Lemon Squeezy → Your Store ID |
| `LEMONSQUEEZY_WEBHOOK_SECRET` | Lemon Squeezy → Webhooks → Signing secret |
| `INTASEND_API_KEY` | IntaSend → API Keys (for Kenya M-Pesa) |
| `INTASEND_PUBLISHABLE_KEY` | IntaSend → Publishable key |
| `INTASEND_WEBHOOK_SECRET` | IntaSend → Webhook secret (optional but recommended) |

---

## 3. Tools & Features

### Academic Writing Tools

| Tool | Route | Description |
|---|---|---|
| **Paper Writer** | `/write` | Full academic paper generation with RAG citations, rubric analysis, dataset import |
| **Outline Builder** | `/outline` | Structured outline generator for any paper type |
| **Paper Revision** | `/revision` | AI revision with grade standards, track changes |
| **LightSpeed Humanizer** | `/humanizer` | AI detection bypass + plagiarism rewriting |
| **AI & Plagiarism Check** | `/plagiarism` | Academic similarity + AI content detection |
| **STEM Solver** | `/stem` | Math, physics, chemistry, coding solver with step-by-step workings |
| **AI Study Assistant** | `/study` | Flashcards, quizzes, summaries, study guides, slides from any material or YouTube URL |
| **Floating AI Assistant** | `/assistant` | Context-aware chat overlay available on all pages |
| **AI Ebook Writer** | `/ebooks` | Long-form ebook generation for publishing platforms |

### Subscription Plans

| Plan | Price | Limits |
|---|---|---|
| **Free** | $0 forever | Unlimited in-browser Writing Analyzer + 3 plagiarism/AI checks per month in local (non-LLM) detection mode. All AI-generation tools are 0 — paywall prompts Pro or PAYG. |
| **Pro Monthly** | $29.99/mo | 15 papers, 20 revisions, 20 humanize, 60 STEM, 150 study, 20 plagiarism, 20 outlines |
| **Pro Annual** | $269/yr | Same as Pro Monthly (saves 25%) |
| **Institution** | Custom quote | Custom seats, one invoice — request via /enterprise contact |
| **Ebooks Monthly** | $29.99/mo | 15 AI ebooks/month for publishing |
| *(legacy)* Starter | $9.99/mo | No longer sold; existing subscribers keep entitlements |
| *(legacy)* Student Pro | $19.99/mo | No longer sold; existing subscribers keep entitlements |

### Pay-As-You-Go Pricing

| Tool | Price |
|---|---|
| Paper — Discussion | $3.99 |
| Paper — Essay | $7.99 |
| Paper — Research | $14.99 |
| Paper — Proposal | $24.99 |
| Paper — Dissertation | $59.99 |
| Revision (same tiers) | ~50% of paper price |
| Humanizer (same tiers) | ~50% of paper price |
| STEM Problem | $1.99 |
| Study Day Pass | $2.99 |
| Plagiarism Check | $1.99 |
| Outline | $1.99 |

---

## 4. Subscription & Billing System

### How Subscriptions Work

1. **Checkout**: User selects a plan → `POST /api/payments/create` → Gateway session created → User redirected to checkout
2. **Confirmation**: User returns to `/payment/success` → `GET /api/payments/verify` → Status confirmed → Subscription activated in `user_subscriptions`
3. **Renewal** (Stripe): Stripe fires `invoice.payment_succeeded` webhook → API extends `current_period_end` → Subscription stays active
4. **Expiry**: If `current_period_end` passes without renewal, `getUserPlan()` returns `"starter"` and marks status `expired` in background; startup sweep also catches any missed expirations
5. **Failed Payment**: Stripe fires `invoice.payment_failed` → status set to `past_due` → user retains access until `current_period_end`
6. **Cancellation**: Stripe fires `customer.subscription.deleted` → status set to `cancelled`

### Usage Limits

Limits are enforced atomically in PostgreSQL using an `ON CONFLICT ... WHERE count + increment <= limit` upsert. This prevents race conditions — two simultaneous requests cannot both succeed if only one slot remains.

Usage resets automatically each calendar month (period key = `YYYY-MM`).

### Credits System

- Credits are stored in `user_credits` (balance in cents)
- Credits can be purchased via any gateway (PAYG credit top-up)
- Spending is validated server-side: the request price is recalculated from `pricingConfig.ts` and compared to the claimed amount — a user cannot manipulate the price client-side
- All credit operations use PostgreSQL transactions with ROLLBACK on negative balance

### Gateway Routing

The system automatically routes users to the optimal gateway based on their country:
- **Kenya** → IntaSend (M-Pesa mobile money)
- **Nigeria, Ghana, South Africa** → Paystack
- **Rest of Africa** → Paystack (card) or IntaSend fallback
- **Europe, US, Canada, Australia, Global** → Stripe
- High-risk users (flagged by admin) are routed to Stripe only

---

## 5. Admin Panel

**URL:** `https://lightspeedghost.com/mwaramuriuki-login`  
**Auth:** Password sent in `x-admin-password` header on every request  
**Brute-force protection:** 10 attempts per 15 minutes per IP

### Admin Tabs

| Tab | What it shows |
|---|---|
| **Overview** | User count, revenue, MRR, document stats, recent activity |
| **Users** | All users with email, plan, credits, ban status; ban/unban; adjust credits; change plan |
| **Tools** | Enable/disable tools; usage stats; error rates; response times |
| **Documents** | Browse all generated documents with search and type filter |
| **Ebooks** | Ebook generation stats + subscriber list |
| **Gateways** | Payment gateway status; pause/unpause gateways; transaction counts |
| **Payments** | Full payment history with status filtering |
| **Credits** | Credit balances; transaction ledger; totals |
| **Finance** | Revenue by gateway, month, type; top spending users; MRR |
| **Analytics** | Live users; daily/weekly active; country breakdown; hourly traffic; tool feedback scores |
| **Logs** | Request logs; error log; 24h summary |
| **Announcements** | Create/edit/delete site-wide announcements shown to all users |
| **Influencers** | Creator codes; view counts; earned/paid balances; record payouts |
| **Settings** | Maintenance mode; signup toggle; PAYG toggle; starter plan limits |
| **Messages** | Contact form submissions; mark read/replied |

---

## 6. Security Model

### Authentication

- All user routes require a valid Supabase JWT (Bearer token in `Authorization` header)
- JWT verification supports HS256 (legacy secret) and ES256/RS256 (JWKS endpoint) — algorithm detected automatically from token header
- Dev-only fallback (unsigned decode) is gated behind `NODE_ENV !== 'production'`

### Admin Security

- Admin routes use a separate password verified with `crypto.timingSafeEqual` (prevents timing attacks)
- Admin login endpoint is rate-limited: **10 attempts per 15 minutes per IP**
- All admin routes are on the non-guessable path `/mwaramuriuki-login/` — never `/admin/`
- Admin password is stored only in a server-side environment variable — never sent to the frontend in code or responses

### CORS

- Strict allowlist in production: only `ALLOWED_ORIGINS` env var and auto-derived `www` variant are permitted
- No wildcard (`*`) allowed in production
- Requests without an `Origin` header are blocked in production

### HTTP Security Headers (Helmet)

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security` (HSTS)
- `X-Powered-By` header suppressed

### Rate Limiting

| Limiter | Window | Max Requests |
|---|---|---|
| Global | 1 minute | 120 per IP |
| AI endpoints | 1 minute | 20 per IP |
| Admin login | 15 minutes | 10 per IP |

> For horizontal scaling (2+ server instances), replace in-memory store with Redis: `rate-limit-redis` + Upstash Redis. Instructions are in `app.ts` comments.

### Webhook Security

| Gateway | Signature Method |
|---|---|
| Stripe | `stripe.webhooks.constructEvent` (HMAC-SHA256 + timestamp) |
| Paystack | HMAC-SHA512 against `PAYSTACK_SECRET_KEY` |
| Paddle | HMAC-SHA256 with timestamp prefix |
| Lemon Squeezy | HMAC-SHA256 |
| IntaSend | HMAC-SHA256 (optional, activated by setting `INTASEND_WEBHOOK_SECRET`) |

### Input Validation

All writing endpoints validate input with Zod before any AI call:
- Topic: 1–3,000 characters
- Word count: 100–30,000
- Citation styles: strict enum
- Academic levels: strict enum
- Max file/body size: 2 MB (20 MB for file uploads)

### SQL Injection

All database queries use parameterised statements (`$1`, `$2`, ...) via `pg` pool and Drizzle ORM. No raw string interpolation into queries.

### Sensitive Data

- No API keys, secrets, or passwords are ever returned in API responses
- `/api/health/config` is disabled in production (returns 404)
- `/api/auth/test` is disabled in production (returns 404)
- Server logs strip query strings from URLs (tokens cannot appear in logs)
- Error responses never include stack traces or internal error details in production

---

## 7. Cost Optimisation Patterns

### Caveman (Prompt Compression)

Short, dense prompts for study tools (flashcards, quizzes, summaries, study guides). Removes filler words, uses structured commands. Saves ~30–40% prompt tokens on high-volume study routes.

### Reducto (PDF Noise Cleaning)

PDF content is cleaned before injection into prompts — strips page numbers, headers, footers, watermarks, and scanner artefacts. Reduces wasted context tokens on document-heavy requests.

### Sub-Agent Delegation (Parallel Processing)

In `writing.ts`, rubric analysis and citation fetching run concurrently via `Promise.all`. Reduces wall-clock latency by ~40% on papers with rubrics.

### Portkey Model Routing

Study tool routes use a lightweight model (Claude Haiku) for simple operations and the full model (Claude Sonnet) only for complex tasks. Controlled by a `complexity` flag set per operation type.

### Input Validation Gate

Zod schemas validate all writing inputs before any AI API call. Malformed requests are rejected at ~0 cost instead of consuming tokens to produce an error.

### Usage Monitor

`GET /api/mwaramuriuki-login/api-costs` tracks per-operation token spend in memory (capped at 10,000 records). Visible in the admin panel under the Overview tab. For multi-instance deployments, migrate to Upstash Redis (instructions in `apiCost.ts` comments).

---

## 8. Scalability & Performance

### Database Indexes (10M+ user scale)

Created automatically at startup (`index.ts`):

| Index | Table | Purpose |
|---|---|---|
| `idx_documents_user_id` | `documents` | Dashboard paper history lookup |
| `idx_documents_user_created` | `documents` | Sorted history (composite) |
| `idx_study_sessions_user_id` | `study_sessions` | Per-user session list |
| `idx_study_sessions_activity` | `study_sessions` | Recent activity sort |
| `idx_study_messages_session` | `study_messages` | Message history join |
| `idx_student_profiles_user` | `student_profiles` | Single-row profile lookup |
| `idx_user_usage_user_period` | `user_usage` | Quota checks (runs on every AI request) |
| `idx_sessions_sid` | `user_sessions` | Session cookie lookup |

### For Horizontal Scaling (2+ Instances)

Replace in-memory rate limiter store:
```typescript
// In app.ts — install: pnpm add rate-limit-redis redis
import { RedisStore } from "rate-limit-redis";
import { createClient } from "redis";
const redisClient = createClient({ url: process.env.REDIS_URL });
// Add to each rateLimit(): store: new RedisStore({ sendCommand: (...args) => redisClient.sendCommand(args) })
```

Replace in-memory API cost counter (`apiCost.ts`):
- Migrate to Upstash Redis KV with atomic `INCR` commands
- Free tier: 10,000 commands/day

### Request Logging

All requests are logged to `request_logs` table with method, path, status, duration, user ID, and country code. Logs older than 60 days are purged automatically (triggered by admin traffic panel load).

---

## 9. Deployment Guide (Render + Supabase)

### Step 1 — Supabase Setup

1. Create a new Supabase project at supabase.com
2. Note your **Project URL**, **anon key**, **service_role key**, and **JWT Secret**
3. In Authentication → Settings: set Site URL to `https://lightspeedghost.com`
4. In Authentication → Settings → Email: enable "Confirm email"

### Step 2 — Deploy API Server on Render

1. Create a new **Web Service** on Render
2. Root directory: `artifacts/api-server`
3. Build command: `pnpm install && pnpm build`
4. Start command: `pnpm start`
5. Add all environment variables from Section 2
6. Set `NODE_ENV=production`
7. Note the Render service URL (e.g. `https://lightspeedghost-api.onrender.com`)

### Step 3 — Deploy Frontend on Render (Static Site)

1. Create a new **Static Site** on Render
2. Root directory: `artifacts/lightspeed-ghost`
3. Build command: `pnpm install && pnpm build`
4. Publish directory: `dist/public`
5. Add environment variable: `VITE_API_URL=https://lightspeedghost-api.onrender.com`
6. Add rewrite rule: `/* → /index.html` (for client-side routing)

### Step 4 — Configure Custom Domain

1. Add `lightspeedghost.com` in Render → your static site → Custom Domains
2. Set DNS CNAME at your registrar: `www → <render-static-site>.onrender.com`
3. Set DNS A record for root domain as instructed by Render

### Step 5 — Stripe Webhook Setup

In Stripe Dashboard → Developers → Webhooks → Add endpoint:
- URL: `https://lightspeedghost-api.onrender.com/api/payments/webhook/stripe`
- Events to listen for:
  - `checkout.session.completed`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
- Copy the **Signing secret** → add as `STRIPE_WEBHOOK_SECRET` on Render

---

## 10. Payment Gateway Setup

### Stripe (Global — Primary)

1. Create account at stripe.com
2. Create products and prices for each plan in the Stripe Dashboard
3. Add environment variables: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`
4. Add price IDs: `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PRO_ANNUAL`, `STRIPE_PRICE_STARTER_MONTHLY`
5. Configure webhook as described in Step 5 above

### Paystack (Africa — Nigeria, Ghana, South Africa, etc.)

1. Create account at paystack.com
2. Go to Settings → API Keys
3. Add `PAYSTACK_SECRET_KEY` and `PAYSTACK_PUBLIC_KEY`
4. Set webhook URL in Paystack Dashboard: `https://lightspeedghost-api.onrender.com/api/payments/webhook/paystack`

### IntaSend (Kenya — M-Pesa)

1. Create account at intasend.com
2. Add `INTASEND_API_KEY` and `INTASEND_PUBLISHABLE_KEY`
3. Optionally set `INTASEND_WEBHOOK_SECRET` for webhook signature verification
4. Webhook URL: `https://lightspeedghost-api.onrender.com/api/payments/webhook/intasend`

### Paddle (Optional — EU VAT handled automatically)

1. Create account at paddle.com
2. Add `PADDLE_API_KEY` and `PADDLE_WEBHOOK_SECRET`
3. Create products/prices in Paddle and add `PADDLE_PRICE_*` env vars
4. Webhook URL: `https://lightspeedghost-api.onrender.com/api/payments/webhook/paddle`

### Lemon Squeezy (Optional)

1. Create account at lemonsqueezy.com
2. Add `LEMONSQUEEZY_API_KEY`, `LEMONSQUEEZY_STORE_ID`, `LEMONSQUEEZY_WEBHOOK_SECRET`
3. Create variants and add `LEMONSQUEEZY_VARIANT_PRO_MONTHLY` etc.
4. Webhook URL: `https://lightspeedghost-api.onrender.com/api/payments/webhook/lemon-squeezy`

---

## 11. API Reference

All routes are prefixed with `/api`.

### Authentication

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/auth/me` | Required | Returns current user ID and email |
| `GET` | `/me` | Optional | Auth diagnostic (returns hint on failure) |

### Writing Tools

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/writing/generate-stream` | Required | Stream paper generation (SSE) |
| `POST` | `/writing/outline` | Required | Generate paper outline |
| `GET` | `/documents` | Required | List user's documents |
| `GET` | `/documents/:id` | Required | Get single document |
| `PATCH` | `/documents/:id` | Required | Update document content |
| `DELETE` | `/documents/:id` | Required | Delete document |

### Revision & Humanizer

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/revision/analyse` | Required | Analyse paper for revision |
| `POST` | `/revision/submit-stream` | Required | Stream revised paper (SSE) |
| `POST` | `/humanizer/detect` | Required | AI detection check |
| `POST` | `/humanizer/humanize-stream` | Required | Stream humanized content (SSE) |

### STEM & Study

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/stem/solve` | Required | Solve STEM problem |
| `POST` | `/study/ask` | Required | Chat with study assistant |
| `POST` | `/study/generate` | Required | Generate flashcards/quiz/summary/slides |
| `GET` | `/study/sessions` | Required | List study sessions |
| `GET` | `/study/sessions/:id/messages` | Required | Get session messages |

### Plagiarism

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/plagiarism/check` | Required | Run plagiarism check |
| `POST` | `/plagiarism/humanize` | Required | Humanize flagged text |
| `POST` | `/plagiarism/code` | Required | Check code plagiarism |

### Payments

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/payments/gateway` | Optional | Detect optimal gateway for user's country |
| `GET` | `/payments/usage` | Optional | Get usage counts and plan |
| `GET` | `/payments/subscription` | Required | Get subscription status |
| `POST` | `/payments/create` | Required | Create payment/checkout session |
| `GET` | `/payments/verify` | Required | Verify payment after redirect |
| `GET` | `/payments/credits` | Required | Get credit balance |
| `POST` | `/payments/credits/spend` | Required | Spend credits for PAYG |
| `GET` | `/payments/transactions` | Required | List payment history |
| `POST` | `/payments/webhook/stripe` | Public | Stripe webhook (signature verified) |
| `POST` | `/payments/webhook/paystack` | Public | Paystack webhook (HMAC verified) |
| `POST` | `/payments/webhook/intasend` | Public | IntaSend webhook |
| `POST` | `/payments/webhook/paddle` | Public | Paddle webhook (HMAC verified) |
| `POST` | `/payments/webhook/lemon-squeezy` | Public | Lemon Squeezy webhook (HMAC verified) |

### Admin (all require `x-admin-password` header)

| Method | Path | Description |
|---|---|---|
| `POST` | `/mwaramuriuki-login/verify` | Verify admin password |
| `GET` | `/mwaramuriuki-login/stats` | System-wide statistics |
| `GET` | `/mwaramuriuki-login/tools` | Tool usage + enable/disable status |
| `PATCH` | `/mwaramuriuki-login/tools/:key/toggle` | Enable/disable a tool |
| `GET` | `/mwaramuriuki-login/users` | All users with activity data |
| `DELETE` | `/mwaramuriuki-login/users/:id` | Delete user and all activity |
| `PATCH` | `/mwaramuriuki-login/users/:id/ban` | Ban or unban user |
| `PATCH` | `/mwaramuriuki-login/users/:id/plan` | Change user plan |
| `POST` | `/mwaramuriuki-login/users/:id/credits` | Adjust user credits |
| `GET` | `/mwaramuriuki-login/credits` | Credit balances + transactions |
| `GET` | `/mwaramuriuki-login/revenue` | Revenue analytics |
| `GET` | `/mwaramuriuki-login/subscriptions` | Active subscriptions |
| `GET` | `/mwaramuriuki-login/gateways` | Gateway settings + stats |
| `PATCH` | `/mwaramuriuki-login/gateways/:name` | Pause/unpause gateway |
| `GET` | `/mwaramuriuki-login/payments` | All payments |
| `PATCH` | `/mwaramuriuki-login/user-risk/:userId` | Set user fraud risk level |
| `GET` | `/mwaramuriuki-login/settings` | System settings |
| `POST` | `/mwaramuriuki-login/settings` | Update system settings |
| `GET` | `/mwaramuriuki-login/traffic` | Live + historical traffic |
| `GET` | `/mwaramuriuki-login/logs` | Request logs |
| `GET` | `/mwaramuriuki-login/documents` | All documents |
| `GET` | `/mwaramuriuki-login/announcements` | Manage announcements |
| `POST` | `/mwaramuriuki-login/announcements` | Create announcement |
| `PATCH` | `/mwaramuriuki-login/announcements/:id` | Update announcement |
| `DELETE` | `/mwaramuriuki-login/announcements/:id` | Delete announcement |
| `GET` | `/mwaramuriuki-login/api-costs` | AI API usage costs |
| `GET` | `/mwaramuriuki-login/ping` | Server health + uptime |
| `GET` | `/mwaramuriuki-login/messages` | Contact form messages |
| `GET` | `/mwaramuriuki-login/influencers` | Influencer program stats |
| `GET` | `/mwaramuriuki-login/ebooks` | Ebook stats + subscribers |

### Public Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Server health check |
| `GET` | `/status` | Maintenance mode + signup state |
| `GET` | `/announcements` | Active announcements |
| `POST` | `/contact` | Contact form submission |
| `POST` | `/feedback` | Tool feedback (thumbs up/down) |

---

## 12. Database Schema

### Core Tables

```sql
-- User documents (papers, revisions, outlines, etc.)
documents (
  id SERIAL PRIMARY KEY,
  user_id TEXT,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL,           -- 'paper' | 'revision' | 'humanizer' | 'stem' | 'outline' | 'ebook'
  subject TEXT,
  doc_number INTEGER DEFAULT 0,
  word_count INTEGER DEFAULT 0,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)

-- Study sessions (AI Tutor)
study_sessions (id, user_id, title, subject, message_count, last_activity, created_at)
study_messages (id, session_id, role, content, created_at)
student_profiles (id, user_id, session_count, strengths, struggles, preferred_subjects, recent_topics, notes)

-- Usage tracking (monthly quota enforcement)
user_usage (user_id, tool, period, count) -- period = 'YYYY-MM'

-- Subscriptions & billing
user_subscriptions (
  user_id TEXT PRIMARY KEY,
  plan TEXT,                          -- 'starter' | 'pro' | 'campus'
  billing TEXT,                       -- 'monthly' | 'annual'
  gateway TEXT,                       -- 'stripe' | 'paystack' | 'paddle' | etc.
  gateway_subscription_id TEXT,       -- ID from the payment gateway
  status TEXT,                        -- 'active' | 'past_due' | 'expired' | 'cancelled'
  current_period_end TIMESTAMPTZ,     -- Expiry date; access blocked after this
  seats INTEGER,                      -- Campus plan only
  created_at, updated_at
)

payments (
  id UUID PRIMARY KEY,
  user_id, gateway, gateway_session_id,
  type TEXT,          -- 'subscription' | 'payg'
  plan, tool, tier,
  amount_cents INTEGER,
  currency TEXT,
  status TEXT,        -- 'pending' | 'completed' | 'failed'
  created_at, completed_at
)

user_credits (user_id, balance_cents, lifetime_earned_cents, lifetime_spent_cents, updated_at)
credit_transactions (id, user_id, amount_cents, type, description, reference_id, created_at)

-- Admin
system_settings (key TEXT PRIMARY KEY, value TEXT, updated_at)
user_bans (user_id TEXT PRIMARY KEY, reason, banned_at, banned_by)
announcements (id, title, message, link, link_text, color, is_active, created_at, updated_at)
contact_messages (id, name, email, institution, message, seats, read, replied, created_at)
tool_feedback (id, user_id, tool, rating, comment, created_at)
request_logs (id, method, path, status, duration_ms, user_id, country, error_msg, created_at)
gateway_settings (gateway, paused, notes, updated_at)
user_risk (user_id, risk_level, reason, updated_at)

-- Influencer program (pay-per-view creator payouts)
influencers (user_id, code, payout_method, payout_details, created_at, last_payout_at)
influencer_views (code, view_day, views)
influencer_payouts (id, user_id, code, views, amount_cents, method, details, status, created_at, paid_at)

-- Ebooks
user_ebook_subscriptions (user_id, status, billing, gateway, gateway_subscription_id, current_period_end, created_at, updated_at)
```

---

## Quick-Start Checklist

Before going live, confirm all of these:

- [ ] All **Required** env vars set on Render
- [ ] At least one payment gateway configured (recommend Stripe first)
- [ ] Stripe webhook created with all 5 event types
- [ ] `ADMIN_PASSWORD` set to a strong, unique password
- [ ] `SESSION_SECRET` set to a random 32+ character string
- [ ] `ALLOWED_ORIGINS` set to your production domain(s)
- [ ] `FRONTEND_URL` set to your production domain
- [ ] `NODE_ENV=production` set on the API server
- [ ] Supabase Auth Site URL set to your production domain
- [ ] Custom domain configured on Render with HTTPS
- [ ] Admin panel accessible at `/mwaramuriuki-login` and login works
- [ ] Test payment processed successfully end-to-end

---

*Documentation generated for LightSpeed Ghost production system.*
