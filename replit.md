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
- `POST /plagiarism/check` — AI & plagiarism detection
- `POST /plagiarism/humanize` — Humanize AI text
- `GET /stem/subjects` — Available STEM subjects
- `POST /stem/solve` — Step-by-step STEM solution
- `GET /study/sessions` — List study sessions
- `GET /study/sessions/:id/messages` — Session messages
- `POST /study/ask` — Ask study assistant

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
