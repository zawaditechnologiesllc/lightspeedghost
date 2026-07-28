# Revenue & Profit per Student — Light Speed Ghost

_Last updated: 2026-07. All figures are estimates from real model prices and the
live price list. "COGS" = the AI/model cost to serve one unit. Payment fees use
Stripe's standard **2.9% + $0.30**. Numbers are rounded; actual cost varies with
paper length and how many quality passes run._

---

## 1. Cost inputs (what it costs us to serve)

**Model prices** (`aiGateway.ts`, per 1M tokens):

| Model | Input | Output | Used for |
|---|---|---|---|
| gpt-4o-mini | $0.15 | $0.60 | Cheap sub-tasks: query building, extraction, classification, ebook drafts |
| claude-haiku-4-5 | $0.25 | $1.25 | STEM solving, routine tutor/assistant text |
| gpt-4o | $2.50 | $10 | Fallback for standard tier |
| claude-sonnet-4-5 | $3 | $15 | Quality-critical generation: papers, revision, humanizer |

**No-LLM services cost ≈ $0:** the free AI + plagiarism + peer-review **checker**
runs entirely in the browser. Plagiarism *deep scans* hit academic-source APIs
(compute only, ~$0.00–0.01), not an LLM.

---

## 2. Profit per Pay-As-You-Go purchase (no subscription)

Priced by length so long papers monetise best. These are **per-transaction** profits.

| Service | Price | ~COGS | Stripe fee | **Net profit** | Margin |
|---|---|---|---|---|---|
| Discussion post (≤500w) | $3.99 | ~$0.06 | $0.42 | **~$3.51** | ~88% |
| Essay (500–1,500w) | $7.99 | ~$0.12 | $0.53 | **~$7.34** | ~92% |
| **Research paper (1,500–3,500w)** | $14.99 | ~$0.30 | $0.73 | **~$13.96** | ~93% |
| **Research proposal (3,500–6,000w)** | $24.99 | ~$0.60 | $1.02 | **~$23.37** | ~94% |
| **Dissertation / thesis (6,000–15,000w)** | $59.99 | ~$1.50 | $2.04 | **~$56.45** | ~94% |
| Paper revision | $1.99–$24.99 | ~$0.05–0.30 | 2.9%+$0.30 | **~$1.55–$23.7** | ~80–95% |
| LightSpeed Humanizer | $1.99–$24.99 | ~$0.08–0.40 | 2.9%+$0.30 | **~$1.5–$23.6** | ~78–95% |
| STEM solve | $1.99 | ~$0.05 | $0.36 | **~$1.58** | ~79% |
| Outline | $1.99 | ~$0.03 | $0.36 | **~$1.60** | ~80% |
| Study day pass (24h) | $2.99 | ~$0.10–0.40* | $0.39 | **~$2.20–$2.50** | ~74–84% |
| AI & Plagiarism + Peer Review | Free | ~$0 | — | **$0** (acquisition) | — |

\* The Study Day Pass is unlimited for 24h — the only unbounded item. Recommend a
soft cap (~40 tutor messages/24h) to keep the worst case near $0.40.

**Takeaway:** the >3,500-word papers (**proposal $24.99, dissertation $59.99**)
are the highest-value single transactions on the platform — **~$23 and ~$56 net
profit each** — which is why the SEO engine now targets dissertation / research /
proposal keywords and surfaces those prices in page CTAs.

---

## 3. Profit per subscription student

| Plan | Price | Typical COGS/mo | Worst-case COGS/mo | Stripe | **Typical net/mo** |
|---|---|---|---|---|---|
| **Free** | $0 | ~$0 | ~$0 | — | **$0** (funnel top — costs ≈ pennies of infra) |
| **Pro Monthly** | $29.99 | ~$4–7 | ~$18–20 | ~$1.17 | **~$21–25 (≈75–83%)** |
| **Pro Annual** | $269/yr ($22.42/mo) | ~$4–7 | ~$18–20 | ~$0.95/mo | **~$14–17/mo (≈65–75%)** |
| **Institution** | Custom ($3–5/seat/mo) | set at quote | — | invoice | margin set per contract |

Pro worst-case assumes a power user maxing every limit; the economics-tuned limits
(15 papers, 40 STEM, 30 plagiarism, etc.) keep even that positive. See the
**Unit Economics** section in `README.md`.

---

## 4. Per-student lifetime value (illustrative)

| Student type | Behaviour | **~Profit** |
|---|---|---|
| Free-only | Uses the free checker; never pays | **$0** (but feeds referrals + conversion) |
| Light PAYG | 1 research paper / month | **~$14/mo → ~$168/yr** |
| Heavy PAYG | 1 dissertation + 2 research papers / semester | **~$56 + ~$28 = ~$84 / semester** |
| Pro subscriber | Stays 6 months | **~$21–25 × 6 ≈ $130–150** |
| Pro annual | Pays upfront | **~$170–200 / year** |

**Conversion is the lever:** every Free student costs ~$0 to serve, so the free
checker + peer review is a zero-marginal-cost acquisition engine. Even a low
free→paid conversion rate is highly profitable because paid margins are 75–94%.

---

## 5. Model-per-tool map (right-sized, not "shiny")

Each tool uses the cheapest model that does the job well; expensive models are
reserved for quality-critical generation. Sub-tasks (query building, extraction,
classification) run on the cheapest model regardless of tool.

| Tool | Main model | Rationale |
|---|---|---|
| Free checker + Peer Review | **none (in-browser)** | Deterministic heuristics — $0, private |
| Paper Writer | claude-sonnet-4-5 (draft) + gpt-4o-mini (scaffolding) | Draft quality matters; scaffolding is cheap |
| Paper Revision | sonnet (rewrite) + gpt-4o-mini (analysis) | Rewrite quality matters; analysis is cheap |
| LightSpeed Humanizer | claude-sonnet-4-5 | Natural-voice rewriting is quality-critical |
| STEM Solver | **claude-haiku-4-5** | Haiku 4.5 solves step-by-step well at a fraction of Sonnet's cost |
| Study Assistant | claude-sonnet-4-5 (text) / haiku for routine | Reasoning tutor; routine chat can drop to Haiku |
| Outline Builder | standard tier | Short, structured output |
| Ebook Generator | gpt-4o-mini | Long-form at low cost; separate $29.99 plan |
| SEO engine | **gemini-2.5-flash** | Has a real free tier; Flash is plenty for research/outlines |

Guiding rule (per your instruction): **don't reach for a shiny model when an
older/cheaper one does the job better or equally well.** Candidate future saving:
route routine Study-Assistant chat fully to Haiku 4.5 (kept as-is for now to avoid
an untested quality change to a paid tool).

---

## 6. Self-learning status & roadmap

Some tools already learn from real signals; others have the foundation planned.

**Already self-learning today:**
- **SEO engine** — `topic-selector.ts` reads **Google Search Console** impressions/
  clicks and **GA4 revenue** to choose the next topics, so it doubles down on what
  actually ranks and earns. It also avoids re-writing covered topics (no keyword
  cannibalisation). The researcher now also pulls **live Google autocomplete** to
  chase currently-trending queries.
- **Study Assistant** — persistent **per-student memory**: it remembers each
  student's history, weak points and materials across sessions and adapts.

**Foundation for every tool (recommended next phase — not yet wired end-to-end):**
1. **Capture** a quality signal on every tool output — thumbs up/down, "regenerate",
   accepted vs discarded, and (for papers) the grade the student reports back.
2. **Store** it in a `tool_feedback` table keyed by tool + a hash of the request.
3. **Learn** by mining the highest-rated outputs into few-shot exemplars that are
   injected into each tool's prompt, and by nudging model/temperature choices from
   aggregate ratings. This is a feedback→prompt loop (no model fine-tuning needed).

> Honest note: true "self-learning for every tool" is a multi-step programme. The
> SEO + Study loops are live; the cross-tool feedback loop above is designed and
> ready to build but is **not** claimed as shipped. It needs a DB migration and a
> UI hook in each tool, which should be built and tested against the live database.
