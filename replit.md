# Light Speed Ghost - AI Academic Writing Platform

## Overview

Full-stack AI academic writing platform at lightspeedghost.com. Features paper writing with citations, paper revision, AI/plagiarism checking, STEM solving with visualizations, and an AI study assistant.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM (Replit-hosted)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Frontend**: React + Vite + Tailwind CSS
- **UI**: Radix UI + shadcn/ui components
- **Charts**: Recharts (STEM visualizations)
- **Routing**: Wouter
- **State**: TanStack React Query
- **Themes**: next-themes (light/dark)
- **Build**: esbuild (CJS bundle)

## Artifacts

- `artifacts/lightspeed-ghost` — Main React frontend (previewPath: /)
- `artifacts/api-server` — Express API server (previewPath: /api)

## Features

1. **Write Paper** `/write` — AI paper generation with citations & bibliography (APA/MLA/Chicago/Harvard/IEEE)
2. **Outline Generator** `/outline` — Structured paper outline generation with phase-based UX: config → animated progress bar (6 steps) → full-screen results
3. **Revision Panel** `/revision` — Paper revision with tracked changes, grade estimates
4. **LightSpeed Humanizer** `/humanizer` — AI bypass tool: detect AI score then rewrite text with Claude Sonnet 4.5 SSE streaming; 3-step progress, tone selector, before/after tabs, file upload
5. **AI & Plagiarism Checker** `/plagiarism` — AI detection score, plagiarism sources
6. **STEM Solver** `/stem` — Step-by-step solutions with Recharts graph visualization for 7 subject areas; in-page animated progress panel (replaces FullscreenLoader); handwritten pen-on-paper style for step explanations and math expressions (Kalam font + blue ruled background)
7. **AI Study Assistant** `/study` — Chat-based tutor with session history, image/screenshot upload, floating chat bubble; math-containing answers use handwritten font (Kalam) for pen-on-paper feel
8. **Documents** `/documents` — All saved documents with search and filter

## Mobile Responsiveness

All 9 pages fully optimized for mobile (390px+):
- **Layout**: Mobile bottom nav bar (Home/Write/STEM/Study/More), hamburger sidebar, `pb-16 lg:pb-0` main area
- **WritePaper**: Generating phase sidebar stacks vertically on mobile (`flex-col md:flex-row`), stats header scrollable, tab bar overflow-x-auto, stats grid `grid-cols-1 sm:grid-cols-3`, reduced padding on mobile
- **Revision**: Revising sidebar collapses to top strip on mobile, all content paddings responsive, stats grid responsive
- **Plagiarism**: Results side panel (`w-[400px]`) stacks below input on mobile with `max-h-[45vh]`
- **Outline**: Phase-based full-screen: config (form) → generating (progress) → results (full-width sections)
- **Dashboard/Documents**: Responsive padding `p-4 sm:p-6`, headings `text-xl/2xl sm:text-2xl/3xl`

## AI Architecture (OpenClaw-Inspired)

### Models & Routing (ClawRouter)
- `claude-3-5-sonnet-20241022` — Reasoning tasks: STEM solving, paper writing, tutoring, revision
- `gpt-4o` — Vision/OCR tasks
- `gpt-4o-mini` — Cheap tasks: bibliography formatting, AI detection checks, data extraction

### Core Libs (`artifacts/api-server/src/lib/`)
- `ai.ts` — Anthropic + OpenAI client initialization (supports Replit proxy or direct keys)
- `soul.ts` — ACADEMIC/STEM/TUTOR/WRITER/HUMANIZER personas (OpenClaw SOUL.md pattern)
- `reactLoop.ts` — ReAct THOUGHT→ACTION→OBSERVATION loop for STEM solving (OpenClaw Pi Engine)
- `cove.ts` — Chain-of-Verification critic agent + mathjs independent computation verification (OpenClaw CoVe pattern)
- `memory.ts` — Student persistent memory CRUD, Jarvis Effect (OpenClaw MEMORY.md + memU)
- `memvidMemory.ts` — Semantic long-term memory via @memvid/sdk (graceful fallback if unavailable)
- `learningEngine.ts` — Adaptive source weighting + quality signal recording (OpenClaw self-improving retrieval)
- `citationVerifier.ts` — Real citations from 6 APIs: Semantic Scholar, OpenAlex, arXiv, Europe PMC, PubMed, CrossRef; uses citation-js CSL engine for pixel-perfect APA/MLA/Chicago/Harvard/IEEE formatting
- `academicSources.ts` — 13-database academic search aggregator (1B+ papers) with RAG context builder
- `openSourceSearch.ts` — Open-source plagiarism engine: 5 free APIs (Wikipedia, OpenLibrary, Google Books, Internet Archive, CrossRef); uses compromise NLP for sentence segmentation
- `textAnalysis.ts` — Cosine similarity plagiarism + readability + burstiness analysis (ported from Plagiarism-Checker-and-AI-Text-Detection); uses compromise NLP for sentence segmentation
- `winnow.ts` — Winnowing algorithm for document fingerprinting (ported from copydetect/Stanford MOSS)
- `aiDetection.ts` — Shared AI detection pipeline: GPT-4o-mini + burstiness blend, retry-with-fallback
- `datasetAnalysis.ts` — CSV/TSV parsing with descriptive statistics (shared by WritePaper, STEM, Study)
- `gradeStandards.ts` — Built-in A-grade criteria by academic level (high-school/undergrad/masters/PhD)
- `geoGateway.ts` — Geographic payment routing (Stripe/Paystack/IntaSend/mobile money by country)
- `pricingConfig.ts` — Plan pricing and feature definitions
- `usageTracker.ts` — Per-user usage limits by plan (starter/pro/campus), daily and monthly periods
- `apiCost.ts` — Model cost tracking + daily budget guardrails ($5/day default, OpenClaw pattern)
- `ssRateLimit.ts` — Bottleneck-based rate limiters for all 17 external APIs (Semantic Scholar, OpenAlex, CrossRef, Europe PMC, PubMed, arXiv, CORE, DOAJ, ERIC, Zenodo, BASE, DataCite, OpenAIRE, Open Library, Wikipedia, Google Books, Internet Archive)
- `cache.ts` — Upstash Redis cache layer (graceful no-op when env vars not set)
  - TTLs: citations 6h, academic RAG 2h, STEM papers 6h, outline 24h
  - Env vars required on Render: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
  - `withCache(op, compute, ...keyParts)` — generic get-or-compute helper
  - Cache status exposed at `GET /api/healthz` → `{ cache: "redis:upstash" | "disabled" }`
- `docLabels.ts` — Document numbering and title formatting (LSG-WP01, LSG-SS03, etc.)
- `systemSettings.ts` — Maintenance mode + signup toggle, cached from PostgreSQL
- `requestLogger.ts` — Pino-based request logging middleware

### STEM Pipeline
1. Academic RAG prefetch: Semantic Scholar + 13-database network for grounding context
2. ReAct loop: Think → Act → Observe (Claude Sonnet 4.5, streamed)
3. Chain-of-Verification: Critic Agent checks for math/logic errors (Claude Haiku 4.5)
4. KaTeX rendering of all LaTeX output in frontend

## Frontend Infrastructure

### Handwritten Math Rendering
- **Font**: Kalam (Google Fonts, 300/400/700 weights) — pen-on-paper feel
- **Classes**: `.font-handwritten` (Kalam text), `.handwritten-block` (cream/dark background with ruled lines + blue left border), `.handwritten-expression` (formula container with blue tint)
- **Applied to**: StemSolver step explanations + expressions; StudyAssistant math-containing chat messages; StudyAssistant flashcard answers
- **Preserves**: KaTeX formula rendering stays crisp in its own math font

### Service Worker (Offline Support)
- **File**: `artifacts/lightspeed-ghost/public/sw.js`
- **Strategy**: Cache-first for static assets, network-first for navigation (falls back to cached index.html), API requests are network-only (no stale data)
- **Registration**: `src/main.tsx` via `navigator.serviceWorker.register('/sw.js')` on load event

### Offline Banner
- **Component**: `src/components/OfflineBanner.tsx`
- **Behavior**: Shows amber banner when offline, green "Connection restored" banner for 3s when reconnecting
- **Placement**: Inside Layout.tsx above AnnouncementBanner

### Phase-Based Progress UX
- **Outline** (`/outline`): config → generating (animated 6-step progress bar) → results (full-screen)
- **StemSolver** (`/stem`): progress via `solveStep` state + 1.1s interval timer; 8-step STEM-specific progress panel
- **WritePaper** (`/write`): pre-existing; phase config → generating (streaming SSE) → results
- **Revision** (`/revision`): pre-existing; phases upload → analysing → decision → revising → results
- **Humanizer** (`/humanizer`): pre-existing; phases input → detecting → decision → humanizing → results

### Humanizer Pipeline
1. Claude 3.5 Sonnet with HUMANIZER_SOUL persona
2. GPT-4o-mini internal detection pass
3. Recursive rewrite up to 3 passes until AI score < 25%
4. Ghost Writer Intensity slider (0-100): Light/Medium/Heavy modes

### Memory System
- Short-term: Full conversation context per request
- Long-term: `student_profiles` PostgreSQL table (strengths, struggles, topics)
- Memory flush: key facts saved after each session (memU pattern)

## Database Schema

- `documents` — All saved papers, revisions, STEM solutions, study sessions
- `study_sessions` — Study chat sessions
- `study_messages` — Individual messages in study sessions
- `student_profiles` — Persistent student memory (strengths, struggles, topics, session count)

## API Routes

All routes prefixed with `/api`:
- `GET /documents/stats` — Dashboard statistics
- `GET/POST /documents` — Document CRUD
- `GET/PUT/DELETE /documents/:id` — Document operations
- `POST /writing/generate` — Generate paper with citations
- `POST /writing/outline` — Generate outline
- `POST /revision/submit` — AI paper revision
- `POST /plagiarism/check` — AI & plagiarism detection (real cosine similarity + lexical diversity)
- `POST /plagiarism/humanize` — Humanize AI text
- `POST /plagiarism/code` — Code similarity via Winnowing algorithm (MOSS approach)
- `GET /stem/subjects` — Available STEM subjects
- `POST /stem/solve` — Step-by-step STEM solution
- `GET /stem/papers` — Semantic Scholar paper search
- `POST /stem/papers/recommend` — Paper recommendations
- `GET /stem/biomodels` — EBI BioModels search (bio/chem)
- `POST /stem/molecule` — PubChem molecule lookup (chemistry)
- `GET /study/sessions` — List study sessions
- `GET /study/sessions/:id/messages` — Session messages
- `POST /study/ask` — Ask study assistant

## Integrated GitHub Repos (7 total)

### Repo 1: awesome-ai-for-science
- Source: `stemResources.ts` — 200+ AI tools mapped by subject (Math, Physics, Chemistry, Biology, Engineering, CS, Stats)
- Semantic Scholar integration: `/stem/papers` endpoint for real research paper search

### Repo 2: AIAgents4Pharmabio
- EBI BioModels search: `/stem/biomodels` (biology/chemistry subjects only)
- Semantic Scholar paper recommendations: `/stem/papers/recommend`
- Biology AI resources: Talk2BioModels, Talk2Scholars, Talk2KnowledgeGraphs, Talk2Cells

### Repo 3: chemcrow-public
- PubChem molecule lookup: `/stem/molecule` — mirrors ChemCrow Name2SMILES/Mol2CAS/SMILES2Weight toolchain
- Molecule Lookup tab in StemSolver (chemistry only): SMILES, CAS, MW, formula, LogP, H-bond data, TPSA, GHS safety classification
- Chemistry resource panel: ChemCrow tool suite (18 tools), IBM RXN4Chemistry, ChemSpace

### Repo 4: copydetectcode
- Winnowing algorithm ported to TypeScript: `lib/winnow.ts`
- Code Similarity tab in AI & Plagiarism page: side-by-side code comparison with matched region highlighting
- Real structural similarity detection (works even with renamed variables)
- Algorithm: k-gram hashing + sliding window fingerprint selection (Stanford MOSS approach)
- Attribution: Aiken et al. SIGMOD 2003

### Repo 6: OpenClaw
- `soul.ts` — SOUL.md AI personas (ACADEMIC, STEM, TUTOR, WRITER, HUMANIZER)
- `modelRouter.ts` — ClawRouter multi-model routing (Claude 3.5 Sonnet / GPT-4o / GPT-4o-mini)
- `reactLoop.ts` — ReAct Pi Engine (THOUGHT→ACTION→OBSERVE→REFLECT) for STEM solving
- `cove.ts` — Chain-of-Verification critic agent (~80% math/logic error reduction)
- `memory.ts` — MEMORY.md + memU student persistent memory (Jarvis Effect)
- `contextManager.ts` — Two-Layer Memory Architecture sliding window for long documents
- `citationVerifier.ts` — AutoResearchClaw arXiv + Semantic Scholar real citation verification

### Repo 7: Memvid
- `memvidMemory.ts` — LightSpeed AI Memory: persistent per-student semantic memory capsule
- Storage: `.mv2` capsule stored as base64 in `user_memory_capsules` PostgreSQL table (no extra infra)
- Pattern: PostgreSQL ↔ /tmp/{userId}.mv2 ↔ @memvid/sdk ↔ PostgreSQL
- `indexStudyExchange()` — indexes every study Q&A into the user's capsule (fire-and-forget)
- `recallStudyContext()` — BM25 semantic search over past sessions injected into AI system prompt
- `getStudyTimeline()` — chronological topic history for the Study Assistant dashboard
- DB table: `user_memory_capsules` (user_id, capsule_data TEXT base64, frame_count, updated_at)
- Build: `@memvid/sdk` and transitive deps externalized in `build.mjs`

### Repo 5: Plagiarism-Checker-and-AI-Text-Detection
- Cosine similarity plagiarism detection: TF vector dot products against academic corpus
- `lib/textAnalysis.ts`: `analyseTextPlagiarism()` (cosine similarity vs ACADEMIC_CORPUS) + `computeReadabilityScores()` + `computeBurstiness()` + `sampleTextSections()`
- `lib/academicCorpus.ts`: 12 academic reference sources (AI/ML, research methods, climate science, biology, economics, psychology, mathematics, etc.)
- UI enhancements: Writing Metrics card (lexical diversity + avg sentence length), AI flags, corpus matched words

### Shared AI Detection Pipeline (lib/aiDetection.ts) — CRITICAL ARCHITECTURE
All tools (Plagiarism Checker, Humanizer, Paper Writer, Revision) use the SAME detection model:
- **GPT-4o-mini + burstiness blend**: `detectAIScore()` — single source of truth for AI probability
- **Retry on failure**: 2 attempts before returning `score: -1` (unavailable); all callers handle `-1` gracefully
- **Shared humanization**: `humanizeTextOnce()` — one-pass humanization used by all tools' auto-gates
- **Paper Writer AI gate**: After plagiarism gate, runs AI detection; auto-humanizes if score > 0%, up to 3 passes
- **Revision AI gate**: After grade verification and plagiarism gate; same 3-pass humanization loop
- **Plagiarism checker**: 13-database live academic search + open-source sentence matching; AI score uses same model
- **Quick humanizer** (plagiarism page): TARGET_SCORE = 0%; uses shared detection model; handles unavailable detection
- **Scores are consistent**: All tools use identical detection — results are reproducible across tools

### Open-Source Plagiarism Engine (lib/openSourceSearch.ts) — NO PAID API
Replicates CopyLeaks/Copyscape algorithm using 5 completely free sources:
- **Open Library** (openlibrary.org) — 20M+ book records, no key required
- **Wikipedia REST API** — all articles, no key required
- **Google Books Volumes API** — free quota (1,000/day), no key required
- **Internet Archive** — 70M+ items including web archives, no key required
- **CrossRef DOI search** — 145M+ academic records, no key required
Algorithm: sentence-level fingerprinting → extract 8-word n-grams from distinctive sentences → concurrent search across all sources → sentence-level match percentage + highlighted flagged sentences
Frontend: source type badges (Wikipedia/Book/Academic/Archive), sentence-level match display, "N sources scanned" counter

### FloatingWidget fixes
- Input cleared immediately on send (snapshot taken before clearing, sent to API)
- Trigger button moved to LEFT side (`left-4 lg:left-6`) to avoid Tidio chat conflict
- Panel initial position starts at left edge (x: 20) instead of right edge
- Mode change clears results: switching modes aborts in-flight stream, clears answer/error/detected mode

### Word Count & Citation Policy
- **Word count excludes**: reference list, in-text citations, headings, abstract, ToC, figure/table captions
- **Word count includes**: body text from introduction through conclusion
- **Max words cap**: target + 5% (hard limit)
- **Correction thresholds**: expand if <95% of target, trim if >105% — word count is non-negotiable
- **Citation ratio**: 1 in-text citation per 150-200 words → `Math.ceil(requestedWords / 175)` (min 3)
- **All work must be referenced and cited from academic sources** unless student instructions say otherwise

### Non-Negotiable Quality Promises (WritePaper, Revision, Humanizer, Outline)
- **AI score: 0%** — gate triggers humanization if score > 0%, up to 3 passes. Target is completely undetectable.
- **Plagiarism: max 8%** — gate triggers rephrasing if score > 8%. Non-negotiable ceiling.
- **Grade: at least 92%** — per prebuilt grading criteria or student-uploaded rubric. Grade optimizer loop runs if criteria gaps found.
- **Word count: exact** — 95-105% of target. Non-negotiable. Backend auto-corrects if outside range.
- **No fake/capped scores** — all quality stats reported are real measured values from detection gates.

### PWA Install UX
- App Store / Google Play banners on landing page trigger install action directly
- Android: native `beforeinstallprompt` triggers Chrome install dialog; fallback shows "Install App" button
- iOS: centered modal with share icon and single CTA (Safari limitation — no native install API)

## File Upload Feature (Phases 1-2-3)

All services now support file upload with smart autofill:

**Server-side extraction** (`artifacts/api-server/src/routes/files.ts`):
- `POST /api/files/extract` — multer + pdf2json (PDF) + mammoth (DOCX) + text/plain
- Images returned with base64 for client-side OCR; pdf2json + mammoth externalized in build
- Build externals: pdf-parse, pdf2json, mammoth added to `build.mjs`

**Frontend components** (`artifacts/lightspeed-ghost/src/components/`):
- `FileUploadZone.tsx` — reusable drag-and-drop + click zone; compact mode for inline use
- `StemImageOcr.tsx` — image OCR via tesseract.js (client-side WASM, dynamic import)

**Smart autofill utils** (`artifacts/lightspeed-ghost/src/lib/autofill.ts`):
- `detectPaperType()` — thesis/literature_review/report/essay/research from keywords
- `detectCitationStyle()` — APA/MLA/Chicago/Harvard/IEEE from keywords
- `detectLength()` — short/medium/long from word count patterns ("1500 words")
- `extractTopic()` — first meaningful line (10-150 chars)
- `extractSubject()` — keyword match against 20+ academic disciplines

**Per-service integration**:
- WritePaper: upload assignment brief → auto-fills topic, subject, paperType, citationStyle, length, additionalInstructions
- Revision: upload paper (>300 words → originalText) or rubric (<300 words → gradingCriteria); separate rubric upload button
- Plagiarism: compact upload zone above text area → fills text
- StudyAssistant: paperclip button in chat bar → opens upload zone → injects as context message
- StemSolver: image upload (browser OCR) + text file upload → fills problem field

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/lightspeed-ghost run dev` — run frontend locally

## Color Palette

Blue-forward brand palette:
- Primary: Electric blue (211 100% 50% light / 60% dark)
- Accent: Sky blue (199 90% 48%)
- Sidebar: Deep navy (215 60% 13%)
- Background: Soft blue-white (213 100% 98% light / deep navy dark)

## Deployment Notes

- Frontend: Served via Vite dev server on port 18522 (artifact: `artifacts/lightspeed-ghost`)
- Backend: Express API server on port 8080 (artifact: `artifacts/api-server`)
- Database: Replit-hosted PostgreSQL via `DATABASE_URL` env var (auto-provisioned)

## Replit Workflows

- `Start application` — Frontend Vite dev server (`pnpm --filter @workspace/lightspeed-ghost run dev`)
- `API Server` — Express API server (`pnpm --filter @workspace/api-server run dev`)

## Dev Scripts

Both package.json dev scripts use `${PORT:-<default>}` to ensure PORT is always set even when not provided by the workflow environment:
- Frontend: `PORT=${PORT:-18522} vite ...`
- API Server: `export NODE_ENV=development PORT=${PORT:-8080} && pnpm run build && pnpm run start`

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
