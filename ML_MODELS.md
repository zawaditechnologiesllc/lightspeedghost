# Language intelligence — LOCAL-FIRST, no paid APIs

We do **not** depend on Hugging Face's Inference API or on LanguageTool's hosted
service (both are rate-limited free tiers that become **paid** at production
scale). Instead, the paraphrase/humanize, summarise, and semantic-similarity
capabilities — plus the plagiarism corpus — run on **our own engines inside the
Node backend + Supabase Postgres we already pay for**. Zero external calls, zero
per-token cost, deterministic, and fast enough for 2,000+ users/hour.

These are the "works exactly like them, built on our infrastructure"
replacements you asked for.

## What runs where (all shipped, all local)

| Capability | QuillBot/Grammarly/etc. equivalent | Our local engine | Wired into |
|---|---|---|---|
| **Semantic similarity** (paraphrased-plagiarism) | sentence-transformers embeddings | `localSemantic.ts` — word-bigram + char-trigram + token-containment ensemble with synonym canonicalisation | `plagiarism.ts` — blended (max) with TF-cosine on every live + corpus match |
| **Plagiarism corpus index** | Turnitin pre-built index | `plagiarismCorpus.ts` — Postgres **pg_trgm** table that **self-builds** from every scan's fetched sources; queried in-database | `plagiarism.ts` — ingest + `word_similarity` search per window |
| **Summaries** (study) | facebook/bart-large-cnn | `localSummarize.ts` — **TextRank** extractive (never hallucinates; every line is from the source) | `study.ts /generate` — free-plan summary + LLM-parse fallback |
| **Paraphrase / humanize** | humarin T5 paraphraser | `localHumanize.ts` — rule-based de-AI (robotic-transition rewrite, inflated-verb deflation, filler-opener removal, natural cadence) | `humanizer.ts` — free-plan no-LLM path |
| **AI-text detection** | RoBERTa detector | local **burstiness + perplexity** detector (`aiDetection.ts` local mode) | free plan everywhere |
| **Self-learning loop** | — | `learningEngine.ts` — `recordExemplar`/`getTopExemplars`/`buildExemplarBlock` (feedback→prompt) | `humanizer.ts`, `study.ts`, `feedback.ts` |

Nothing above calls an LLM on the **free** plan, and nothing above calls an
external ML API at all by default.

## The self-building plagiarism index (Turnitin-style)

`plagiarism_corpus` (Supabase Postgres, `pg_trgm` GIN index) grows automatically:
every time the live scan pulls abstracts from the 13 academic databases, those
sources are UPSERTed into the corpus (deduped by content hash). Subsequent scans
query the **local** corpus first — instantly, in-database, no external round-trip
— and merge those hits into the same report. The more the tool is used, the more
it catches locally. It degrades to a no-op if `pg_trgm` is ever unavailable, so
it can never break the live scan.

## Optional accelerators (OFF by default — you don't need them)

The hooks in `mlServices.ts` for Hugging Face / LanguageTool remain as a **drop-in
upgrade path only** (e.g. if you later self-host a model on your own GPU box).
They are **disabled unless** you explicitly set the env vars below. Leaving them
unset — the default — means everything uses the local engines.

```
HF_API_TOKEN       = (unset)   # optional; if set, uses HF models instead of local
LANGUAGETOOL_URL   = (unset)   # optional; if set, uses a self-hosted LanguageTool
```

We recommend leaving them unset. The local engines are the product.
