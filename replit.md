# Light Speed Ghost - AI Academic Writing Platform

## Overview

Light Speed Ghost is a full-stack AI academic writing platform designed to assist students and academics. It offers a comprehensive suite of features including AI-powered paper writing with accurate citations, paper revision with tracked changes and grade estimates, AI and plagiarism checking, STEM problem-solving with visualizations, and an AI study assistant. The platform aims to provide high-quality, undetectable, and plagiarism-free academic content, ensuring strict adherence to academic standards and word count requirements.

## User Preferences

- All work must be referenced and cited from academic sources unless student instructions say otherwise.
- Word count excludes: reference list, in-text citations, headings, abstract, ToC, figure/table captions.
- Word count includes: body text from introduction through conclusion.
- Max words cap: target + 5% (hard limit).
- Correction thresholds: expand if <95% of target, trim if >105% — word count is non-negotiable.
- Citation ratio: 1 in-text citation per 150-200 words (minimum 3).
- Non-negotiable Quality Promises:
    - AI score: 0% — gate triggers humanization if score > 0%, up to 3 passes. Target is completely undetectable.
    - Plagiarism: max 8% — gate triggers rephrasing if score > 8%. Non-negotiable ceiling.
    - Grade: at least 92% — per prebuilt grading criteria or student-uploaded rubric. Grade optimizer loop runs if criteria gaps found.
    - Word count: exact — 95-105% of target. Non-negotiable. Backend auto-corrects if outside range.
    - No fake/capped scores — all quality stats reported are real measured values from detection gates.

## System Architecture

The platform is built as a monorepo using `pnpm workspaces`, Node.js 24, and TypeScript 5.9. The frontend is a React application powered by Vite, Tailwind CSS, Radix UI, and shadcn/ui components. The backend is an Express 5 API server. PostgreSQL with Drizzle ORM is used for data persistence.

**Key Features:**
- **Write Paper:** AI paper generation with citations in various academic styles (APA/MLA/Chicago/Harvard/IEEE).
- **Outline Generator:** Structured paper outline generation with a phase-based user experience.
- **Revision Panel:** Allows revision of papers with tracked changes and estimated grades.
- **LightSpeed Humanizer:** Detects AI-generated text and rewrites it to bypass AI detection, featuring tone selection and before/after comparisons.
- **AI & Plagiarism Checker:** Provides AI detection scores and identifies plagiarism sources.
- **STEM Solver:** Offers step-by-step solutions for seven subject areas with Recharts graph visualizations, using a handwritten, pen-on-paper aesthetic.
- **AI Study Assistant:** A chat-based tutor with session history and image/screenshot upload capabilities, rendering math content in a handwritten style.
- **Documents:** Manages all saved documents with search and filter functionalities.

**UI/UX Decisions:**
- **Mobile Responsiveness:** All pages are fully optimized for mobile devices (390px+), featuring mobile navigation bars, collapsible sidebars, and responsive layouts.
- **Handwritten Math Rendering:** Uses the Kalam font and specific CSS classes (`font-handwritten`, `handwritten-block`, `handwritten-expression`) to simulate a pen-on-paper style for STEM solutions and study assistant math.
- **Phase-Based Progress UX:** Implemented across Outline, StemSolver, WritePaper, Revision, and Humanizer features for clear user guidance through multi-step processes.
- **Color Palette:** A blue-forward brand palette with electric blue as primary, sky blue as accent, and deep navy for sidebars and dark mode backgrounds.
- **PWA Install UX:** Provides app installation banners for Android and iOS.

**Technical Implementations:**
- **AI Architecture (OpenClaw-Inspired):**
    - **Models & Routing (ClawRouter):** Utilizes `claude-3-5-sonnet` for reasoning (STEM, paper writing, tutoring, revision), `gpt-4o` for vision/OCR, and `gpt-4o-mini` for cheaper tasks (bibliography, AI detection, data extraction).
    - **Core Libs:** Includes modules for Anthropic/OpenAI client initialization (`ai.ts`), AI personas (`soul.ts`), ReAct loops for STEM solving (`reactLoop.ts`), Chain-of-Verification (`cove.ts`), student persistent memory (`memory.ts`, `memvidMemory.ts`), adaptive learning (`learningEngine.ts`), real citation verification (`citationVerifier.ts`), academic source aggregation (`academicSources.ts`), open-source plagiarism detection (`openSourceSearch.ts`), text analysis (`textAnalysis.ts`), Winnowing algorithm for code similarity (`winnow.ts`), shared AI detection pipeline (`aiDetection.ts`), dataset analysis (`datasetAnalysis.ts`), grade standards (`gradeStandards.ts`), and various utility functions.
- **Frontend Infrastructure:**
    - **Service Worker:** Provides offline support with a cache-first strategy for static assets and network-first for navigation.
    - **Offline Banner:** Displays an amber banner when offline and a green banner upon reconnection.
- **Memory System:** Combines short-term conversational context with long-term student profiles stored in PostgreSQL, leveraging semantic memory for recall.
- **File Upload Feature:** Supports server-side extraction from PDF, DOCX, and text files, client-side OCR for images, and smart autofill for various input fields across services.
- **Shared AI Detection Pipeline:** A critical architecture ensuring consistent AI detection across all tools (Plagiarism Checker, Humanizer, Paper Writer, Revision) using GPT-4o-mini and burstiness blend with retry mechanisms.
- **Open-Source Plagiarism Engine:** Replicates plagiarism detection using free APIs like Open Library, Wikipedia, Google Books, Internet Archive, and CrossRef, employing sentence-level fingerprinting.

## External Dependencies

- **Database:** PostgreSQL (Replit-hosted)
- **AI Models:** Anthropic (Claude 3.5 Sonnet), OpenAI (GPT-4o, GPT-4o-mini)
- **ORM:** Drizzle ORM
- **Validation:** Zod, `drizzle-zod`
- **API Codegen:** Orval
- **Charts:** Recharts
- **State Management:** TanStack React Query
- **UI Components:** Radix UI, shadcn/ui
- **Payment Gateways:** Stripe, Paystack, IntaSend
- **Caching:** Upstash Redis
- **Academic APIs (for `citationVerifier.ts` and `academicSources.ts`):**
    - Semantic Scholar
    - OpenAlex
    - arXiv
    - Europe PMC
    - PubMed
    - CrossRef
    - CORE
    - DOAJ
    - ERIC
    - Zenodo
    - BASE
    - DataCite
    - OpenAIRE
- **Open-Source Plagiarism Sources (for `openSourceSearch.ts`):**
    - Open Library (openlibrary.org)
    - Wikipedia REST API
    - Google Books Volumes API
    - Internet Archive
    - CrossRef DOI search
- **STEM-Specific APIs:**
    - EBI BioModels
    - PubChem
- **File Processing:**
    - `pdf2json`
    - `mammoth`
    - `tesseract.js` (client-side OCR)
- **Memory SDK:** `@memvid/sdk`
- **Logging:** Pino