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

- Frontend: Can be deployed to Vercel (static build)
- Backend: Can be deployed to Render (Node.js Express server)
- Database: Can be migrated to Supabase (PostgreSQL compatible)
- GitHub: Multi-repo structure planned (frontend + backend separate repos)

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
