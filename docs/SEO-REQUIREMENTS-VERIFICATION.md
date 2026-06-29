# SEO Engine — Requirements Verification Matrix

This document enumerates the SEO project's requirements (derived from
`docs/SEO-GUIDE.md`, the operator's guide, plus the documented compliance and
hosting constraints) and verifies each against the implementation, frontend to
backend. Each row cites the code that satisfies it and its verification status.

**Status legend:** ✅ implemented & verified · 🔧 fixed in this QA pass

Last verified: 2026-06-26 · branch `claude/seo-project-qa-c0s35z`

---

## 1. Authoring systems

| # | Requirement | Implementation | Status |
|---|---|---|---|
| R1.1 | Manual authoring: admin writes/pastes their own page (Markdown), $0, full control | `WriteTab` (`SeoAdmin.tsx`) → `POST /api/seo/page/manual` (`routes/seo.ts`) | ✅ |
| R1.2 | Live rule-check before publish (word count, data points, FAQ, prohibited phrasing) | `POST /api/seo/page/check` → `validatePage` + `checkAcademicIntegrity` (`compliance-checker.ts`) | ✅ |
| R1.3 | Automatic authoring: AI generates a 5-page cluster on one topic | `pipeline.ts` `runPipeline` → `five-page-cluster.ts` | ✅ |
| R1.4 | Manual save refuses to clobber an AI-generated page on slug collision | `routes/seo.ts` manual route 409 guard | ✅ |
| R1.5 | Single catalog page generation (on demand) | `POST /api/seo/generate-page` → `orchestrator.generatePage` | ✅ |

## 2. Page lifecycle

| # | Requirement | Implementation | Status |
|---|---|---|---|
| R2.1 | States: draft → review → published → archived | `status` column (`ensure-schema.ts`); transitions in `orchestrator.ts` / `pipeline.ts` | ✅ |
| R2.2 | Nothing is public until published (`published=true`) | `getPublishedPage` filters `published = true` (`orchestrator.ts`) | ✅ |
| R2.3 | AI clusters land in **review** for human approval | `saveClusterPage` writes `status='review'` unless autoPublish (`five-page-cluster.ts`) | ✅ |
| R2.4 | Publish keeps `published` flag in sync with `status` | `PUT /api/seo/page/:slug` syncs `published` (`routes/seo.ts`) | ✅ |

## 3. Public serving & crawlability

| # | Requirement | Implementation | Status |
|---|---|---|---|
| R3.1 | Pages served server-rendered at `/seo/<slug>` | `GET /seo/:slug` → `renderFullPage` (`seo-public.ts`, `html-renderer.ts`) | ✅ |
| R3.2 | Reachable on the main domain via Vercel proxy | `api/seo-proxy.js` + `vercel.json` rewrites | ✅ |
| R3.3 | Proxy is allow-listed (not an open proxy) | `seo-proxy.js` regex allow-list | ✅ |
| R3.4 | SEO sitemap auto-includes every published page at `/seo-sitemap.xml` | `GET /sitemap.xml` → `renderSitemapXml`; proxied as `/seo-sitemap.xml` | ✅ |
| R3.5 | robots.txt allows search + AI crawlers, disallows `/api/` + gated routes, advertises both sitemaps | `renderRobotsTxt` (`html-renderer.ts`); static `public/robots.txt` | 🔧 |
| R3.6 | Canonical URL, OpenGraph, Twitter card, article meta | `renderFullPage` head block | ✅ |

## 4. Compliance (baked-in signals)

| # | Requirement | Implementation | Status |
|---|---|---|---|
| R4.1 | EU AI Act: `ai-generated` meta + visible disclosure on generated pages | `renderFullPage` meta; `buildAIDisclosureLabel`; auto-appended in `content-generator.ts` | ✅ |
| R4.2 | WCAG 2.2 AA: skip link, focus rings, table captions, ARIA, 24px targets | `html-renderer.ts` styles + landmarks | ✅ |
| R4.3 | Academic integrity: no bypass/cheat/undetectable; AI-assistance framing | `PROHIBITED_PATTERNS`/`PROHIBITED_EXACT` + `sanitizeContent` (`compliance-checker.ts`) | ✅ |
| R4.4 | Sanitiser runs at save time for manual + AI pages | `sanitizeContent` in manual route, `content-generator.ts`, integrity auto-fix | ✅ |
| R4.5 | Integrity audit + one-click auto-fix | `GET /api/seo/audit/integrity`, `POST .../fix/:slug` | ✅ |

## 5. Quality gates

| # | Requirement | Implementation | Status |
|---|---|---|---|
| R5.1 | 800+ word minimum (1000 for technical) | `MIN_WORD_COUNT`; validation retries (`content-generator.ts`, `orchestrator.ts`) | ✅ |
| R5.2 | 8+ unique data points | `countUniqueDataPoints` (`compliance-checker.ts`) | ✅ |
| R5.3 | FAQ section + FAQ schema | `extractFAQs` + `buildFAQSchema` (`schema-engine.ts`) | ✅ |
| R5.4 | Structured data: Breadcrumb, FAQ, Article/Service/SoftwareApp, Organization | `buildPageSchemas` (`schema-engine.ts`) | ✅ |

## 6. Pipeline & scheduler

| # | Requirement | Implementation | Status |
|---|---|---|---|
| R6.1 | 3-step pipeline: Research (Reddit + AI) → Outline → Write 5 | `pipeline.ts` `runPipeline` | ✅ |
| R6.2 | Rate-limited (17s between stages) to respect free tier | `STAGE_DELAY_MS` (`pipeline.ts`) | ✅ |
| R6.3 | Daily limit: 5 pipeline pages / 24h | `getDailyPipelineUsage` (`pipeline.ts`) | ✅ |
| R6.4 | Resumable after failure | `resumePipeline`; UI **Retry** (`SeoAdmin.tsx`) | ✅ |
| R6.5 | Live stage labels reflect backend `current_stage` | `STAGE_LABELS` keyed by `research/outline/write_*` | 🔧 |
| R6.6 | Daily scheduler at configurable UTC time, idempotent per day, logged | `scheduler.ts` (`runScheduledPipeline`, `alreadyRanToday`, `seo_scheduler_log`) | ✅ |
| R6.7 | External token-guarded cron (free-tier hosting) | `GET/POST /api/seo/cron/run` (`seo-public.ts`) | ✅ |

## 7. Catalog, topics & budget

| # | Requirement | Implementation | Status |
|---|---|---|---|
| R7.1 | 130+ planned pages, unique slugs | `PAGE_CATALOG` (302 slugs: 134 hand-authored + 168 programmatic matrices in `programmatic-matrices.ts`; 0 duplicates, 0 collisions — verified) | ✅ |
| R7.2 | Seed placeholders | `seedCatalog` (`orchestrator.ts`) | ✅ |
| R7.3 | Batch-generate up to 30/run (matches guide + UI) | `MAX_DAILY_PAGES` default 30 (`orchestrator.ts`) | 🔧 |
| R7.4 | AI topic selection: GSC → GA4 → catalog-gap fallback | `topic-selector.ts` | ✅ |
| R7.5 | Budget: monthly spend, per-call cost log, cap | `budget-tracker.ts`; `GET /api/seo/budget/{status,log}` | ✅ |
| R7.6 | Cost copy matches the cost model | Dashboard pricing `$0.30/M in · $2.50/M out` = `COST_PER_M` | 🔧 |

## 8. Management & security

| # | Requirement | Implementation | Status |
|---|---|---|---|
| R8.1 | Pages tab: filter/search, publish/unpublish, edit, delete | `PagesTab` (`SeoAdmin.tsx`) + `routes/seo.ts` | ✅ |
| R8.2 | Edit opens the page in the Write tab fully loaded | `openEditor` → `WriteTab editSlug` | ✅ |
| R8.3 | Delete is super-admin only, confirms first | `isSuperAdmin` guard; `window.confirm` | ✅ |
| R8.4 | All admin routes auth-guarded | `isAdmin`/`isSuperAdmin` on every `routes/seo.ts` handler | ✅ |
| R8.5 | Self-healing schema on boot | `ensureSeoSchema` (`index.ts` startup) | ✅ |
| R8.6 | Sitemap "verify live" checks the SEO sitemap | `POST /api/seo/sitemap/ping` → `/seo-sitemap.xml` | 🔧 |

---

## Non-functional verification (this QA pass)

| Check | Result |
|---|---|
| Backend typecheck — SEO files (`seo-engine/*`, `routes/seo*.ts`) | ✅ 0 errors (`tsc -p tsconfig.json --noEmit` with libs built) |
| Frontend typecheck — `SeoAdmin.tsx`, `SeoPage.tsx` | ✅ 0 errors |
| Backend tests (`vitest run`) | ✅ 37 pass (incl. new `seoRenderer.test.ts`, 7 cases) |
| Catalog slug uniqueness | ✅ 134 unique, 0 duplicates |
| Dead code | ✅ removed unused `comparison-pages.ts` |

## Fixes applied in this QA pass (🔧 rows above)

1. `renderRobotsTxt` aligned with the served policy (allow search + AI crawlers,
   disallow `/api/` + gated routes) and now advertises **both** sitemaps; the
   `/robots.txt` handler renders directly (dropped an unused per-request query).
2. Sitemap "verify" + UI target the SEO sitemap (`/seo-sitemap.xml`) and render
   the real reachability message (was a broken `pinged` field).
3. Budget tab: removed dead single-vendor "Claude" UI (the engine is Gemini-only).
4. Dashboard: corrected Gemini 2.5 Flash pricing copy to match the cost model.
5. Pipeline tab: `STAGE_LABELS` keyed by backend `current_stage` values.
6. Catalog batch default 10 → 30 (matches guide, Settings tab, Catalog max).
7. `routes/seo.ts`: 4 `req.params.id` (`string | string[]`) call sites wrapped
   with `String(...)` — fixes real type errors surfaced once `lib/db` was built.

## Known out-of-scope items (not SEO project code)

- ~50 pre-existing `tsc` errors in non-SEO routes (`admin.ts`, `stem.ts`,
  `plagiarism.ts`, `study.ts`, `documents.ts`, …) and a duplicate-export issue
  in the generated `lib/api-zod` types. These predate this work and are outside
  the SEO project's surface.
