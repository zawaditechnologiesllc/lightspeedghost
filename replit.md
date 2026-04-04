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
2. **Outline Generator** `/outline` — Structured paper outline generation
3. **Revision Panel** `/revision` — Paper revision with tracked changes, grade estimates
4. **AI & Plagiarism Checker** `/plagiarism` — AI detection score, plagiarism sources, humanize button
5. **STEM Solver** `/stem` — Step-by-step solutions with Recharts graph visualization for 7 subject areas
6. **AI Study Assistant** `/study` — Chat-based tutor with session history
7. **Documents** `/documents` — All saved documents with search and filter

## Database Schema

- `documents` — All saved papers, revisions, STEM solutions, study sessions
- `study_sessions` — Study chat sessions
- `study_messages` — Individual messages in study sessions

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

## Integrated GitHub Repos (5 total)

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

### Repo 5: Plagiarism-Checker-and-AI-Text-Detection
- Cosine similarity plagiarism detection: TF vector dot products against academic corpus
- Lexical diversity AI detection: unique-word ratio heuristic (AI text → lower diversity)
- `lib/textAnalysis.ts`: `analyseTextPlagiarism()` + `analyseAIContent()`
- `lib/academicCorpus.ts`: 12 academic reference sources (AI/ML, research methods, climate science, biology, economics, psychology, mathematics, etc.)
- UI enhancements: Writing Metrics card (lexical diversity + avg sentence length), AI flags, corpus matched words

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
