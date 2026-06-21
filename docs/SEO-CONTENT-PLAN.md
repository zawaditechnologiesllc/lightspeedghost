# LightspeedGhost — SEO Content Playbook & 12-Month Plan (the hand-written half)

A complete strategy for ranking, getting read by AI engines, and — the part that
actually matters — **turning that traffic into signups and paid subscriptions**.

> **This is the *manual* half of a two-engine system.** The SEO Engine also has an
> **automated** side (the AI Pipeline + daily scheduler) that generates long-tail
> clusters into your Review queue. The two run **side by side** — see
> **`docs/SEO-SETUP.md`** to turn the automated engine on. This playbook is the
> strategy for the pages **you write by hand** in **SEO Engine → ✍️ Write** (the
> high-value pillars and comparisons worth doing yourself). Let the AI engine
> cover breadth; do the depth here. Every page from either engine is served
> **server-rendered** at `https://lightspeedghost.com/seo/<slug>`, so Google, Bing,
> ChatGPT Search, Perplexity, and Google AI Overviews can all read it.

> **How to read this doc:** Sections 1–3 are the strategy (goals, research,
> architecture). Section 4 is the month-by-month calendar. Section 5 is
> copy-paste templates. Sections 6–9 are conversion, workflow, and tracking.
> Start with Section 9 ("First 30 days") if you want to begin today.

---

## 1. The goal: traffic → signups → paid (the funnel)

SEO is not the goal. **Paid subscriptions are the goal.** Traffic is just the top
of a funnel, and every page you publish has to move a reader down it:

```
   Organic search / AI answer
            │  (impressions → clicks)
            ▼
   /seo/<slug> content page            ← you publish these
            │  (read → trust → click a CTA)
            ▼
   Tool page: /write /stem /humanizer …  ← the "money" pages
            │  (try it → hit a limit)
            ▼
   Signup (free)  →  Paid plan ($9.99–$29.99/mo)
```

### Conversion math (set your own numbers, then work backwards)

Plug your real targets in; these are realistic education-SaaS benchmarks to start:

| Funnel step | Benchmark | Why |
|-------------|-----------|-----|
| Click-through from search (CTR) | 2–5% of impressions | depends on rank + title |
| Page → signup (free account) | **1–3%** of visitors | strong CTA + free tool |
| Signup → paid | **4–8%** | hitting the free-tier limits |
| Blended ARPU | **~$15/mo** | mix of $9.99 / $19.99 / $29.99 |

**Worked example — what "good" looks like by month 12:**

| | Monthly organic sessions | Signups (2%) | New paid (5% of signups) | Added MRR (~$15) |
|---|---|---|---|---|
| Target | 30,000 | 600 | 30 | ~$450/mo **new** |

Thirty new paid users *every month* from content compounds fast — and unlike
ads, it keeps paying after you stop. The ramp to get there:

| Phase | Months | Pages live (cumulative) | Realistic sessions/mo | Focus |
|-------|--------|------------------------|----------------------|-------|
| **Foundation** | 1–3 | 60–90 | 200 → 2,000 | publish, get indexed, internal links |
| **Traction** | 4–6 | 120–160 | 2,000 → 10,000 | double down on what ranks |
| **Growth** | 7–12 | 200–280 | 10,000 → 30,000+ | scale winners, refresh, convert |

> SEO has a **3–6 month lag**. Months 1–3 will look flat in traffic but are
> building the asset. Do not quit in month 2 — that is the single most common
> failure.

### Every page gets a job (funnel stage)

Tag each page you write with one stage. It decides the CTA and the keyword:

- **TOFU (top / awareness)** — "how to write a lab report", "apa vs mla". High
  volume, low intent. Job: capture the search, build trust, soft-CTA to a free tool.
- **MOFU (middle / consideration)** — "best ai essay writer", "quillbot
  alternative". Job: position LightspeedGhost, hard-CTA to the tool.
- **BOFU (bottom / decision)** — "lightspeedghost pricing", "lightspeedghost vs
  chatgpt". Lower volume, highest intent. Job: convert — pricing, proof, signup.

A healthy plan is roughly **60% TOFU, 30% MOFU, 10% BOFU.** TOFU brings the
volume; MOFU/BOFU bring the money.

---

## 2. Keyword research — methodology + researched seed banks

### 2.1 How to research a keyword (repeat for every page)

1. **Start from a seed** (Section 2.3 gives you hundreds). e.g. `lab report writer`.
2. **Expand it** — type it into Google and harvest:
   - **Autocomplete** (the dropdown) — real queries people type.
   - **"People also ask"** — each question is a future H2 or FAQ.
   - **"Related searches"** at the bottom of the results page.
   - **Google Search Console** (once you have traffic) → Performance → Queries:
     these are terms you *already* rank for — the fastest wins.
3. **Read the intent** — Google the term and look at page 1. If it's all
   tutorials, write a tutorial. If it's tool/landing pages, write a tool page. If
   it's comparison posts, write a comparison. **Match the format that already ranks.**
4. **Judge difficulty** (no paid tool needed):
   - Page 1 is big brands (Grammarly, Scribbr, Quillbot) only → **hard**, skip for now.
   - Page 1 has forums, weak blogs, thin pages → **easy**, target it.
   - Long, specific phrases (4+ words) → almost always easier and convert better.
5. **Pick ONE primary keyword per page** + 2–4 close variants for the H2s/FAQ.

### 2.2 Intent → page type → funnel stage (the mapping)

| Search looks like | Use page type | Funnel | Primary CTA |
|-------------------|--------------|--------|-------------|
| "how to / guide / format / examples" | `how-to`, `citation-guide` | TOFU | "Try the free tool" |
| "tool / generator / writer / solver" | `tool`, `service` | MOFU | "Start free" |
| "best / top / alternatives" | `comparison`, `use-case` | MOFU | "See why students pick us" |
| "X vs Y" | `comparison` | BOFU | "Compare plans / Start free" |
| "for [subject/level]" | `subject`, `academic-level` | TOFU/MOFU | tool CTA |
| "price / review / is X legit" | `problem-solution` | BOFU | pricing + proof |

### 2.3 Researched seed banks (by tool)

Volumes are **monthly-search estimates to verify in your own tool** — directional,
not gospel. `KD` = rough difficulty (Low/Med/High). Prioritise **Low-KD, long-tail,
MOFU/BOFU** first; they rank fastest and convert best.

**AI Paper Writer — `/write`** (page types: `tool`, `paper-type`, `academic-level`)

| Keyword | Est. vol | Intent | KD | Page type | Stage |
|---|---|---|---|---|---|
| ai essay writer | 40k | tool | High | tool | MOFU |
| research paper writer | 8k | tool | Med | service | MOFU |
| ai lab report writer | 1k | tool | Low | tool | MOFU |
| how to write a thesis statement | 18k | how-to | Med | how-to | TOFU |
| argumentative essay examples | 12k | info | Med | paper-type | TOFU |
| how to write a literature review | 9k | how-to | Med | how-to | TOFU |
| case study writing help | 1.5k | tool | Low | paper-type | MOFU |
| essay writer for college students | 2.5k | tool | Low | academic-level | MOFU |
| reflective essay help | 900 | tool | Low | paper-type | MOFU |

**LightSpeed Humanizer — `/humanizer`** (`tool`, `how-to`, `comparison`)

| Keyword | Est. vol | Intent | KD | Page type | Stage |
|---|---|---|---|---|---|
| ai humanizer | 30k | tool | High | tool | MOFU |
| humanize ai text | 22k | tool | High | tool | MOFU |
| how to humanize ai text | 6k | how-to | Med | how-to | TOFU |
| make ai writing sound human | 3k | how-to | Low | how-to | TOFU |
| quillbot alternative | 4k | comparison | Med | comparison | BOFU |
| ai to human text converter free | 5k | tool | Med | tool | MOFU |
| bypass ai detection *(frame as "reduce AI-detection flags")* | 8k | tool | Med | how-to | MOFU |

> ⚠️ On detector/"bypass" terms: the system auto-rewrites dishonest phrasing on
> save. Keep the page on the **writing-quality** side ("reduce false AI flags",
> "sound natural") — that protects your whole domain from being demoted.

**STEM Solver — `/stem`** (`subject`, `method-specific`, `problem-solution`)

| Keyword | Est. vol | Intent | KD | Page type | Stage |
|---|---|---|---|---|---|
| math problem solver | 60k | tool | High | tool | MOFU |
| physics problem solver with steps | 4k | tool | Low | subject | MOFU |
| chemistry homework help | 9k | tool | Med | subject | MOFU |
| statistics homework solver | 2k | tool | Low | subject | MOFU |
| how to solve calculus problems | 3k | how-to | Med | how-to | TOFU |
| free body diagram solver | 1k | tool | Low | method-specific | MOFU |
| accounting equation solver | 800 | tool | Low | subject | MOFU |

**Plagiarism / AI Checker — `/plagiarism`** (`tool`, `comparison`, `how-to`)

| Keyword | Est. vol | Intent | KD | Page type | Stage |
|---|---|---|---|---|---|
| plagiarism checker for students | 14k | tool | High | tool | MOFU |
| free plagiarism checker | 90k | tool | High | tool | MOFU |
| how to check for plagiarism | 8k | how-to | Med | how-to | TOFU |
| ai content detector | 33k | tool | High | tool | MOFU |
| turnitin alternative for students | 1.2k | comparison | Low | comparison | BOFU |

**Ebook Writer — `/ebooks`** (`ebook-type`, `ebook-platform`, `how-to`)

| Keyword | Est. vol | Intent | KD | Page type | Stage |
|---|---|---|---|---|---|
| how to write an ebook | 12k | how-to | Med | how-to | TOFU |
| how to self publish on amazon kdp | 9k | how-to | Med | ebook-platform | TOFU |
| ai ebook writer | 6k | tool | Med | tool | MOFU |
| ebook outline generator | 1k | tool | Low | ebook-type | MOFU |
| best ai for writing books | 5k | comparison | Med | comparison | MOFU |

**Comparison / brand (highest-converting BOFU)** (`comparison`, `problem-solution`)

| Keyword | Est. vol | Intent | KD | Page type | Stage |
|---|---|---|---|---|---|
| lightspeedghost vs chatgpt | new | comparison | Low | comparison | BOFU |
| lightspeedghost vs jenni ai | new | comparison | Low | comparison | BOFU |
| best ai essay writer 2027 | 6k | listicle | Med | comparison | MOFU |
| grammarly alternative for students | 3k | comparison | Med | comparison | BOFU |
| is using ai for essays allowed | 2k | info | Low | problem-solution | BOFU |

---

## 3. Content architecture — pillars, clusters, page types

### The pillar + cluster model (do this every week)

- **1 Pillar page** — broad, 1,500–2,500 words, targets the head term, links out
  to every supporting page (e.g. *AI Essay Writer for College Students*).
- **3–4 Cluster pages** — 800–1,200 words each, one long-tail angle each, every
  one links **back up** to the pillar.

Google rewards this "topical authority" structure, and it's the same shape the
internal AI engine already uses — you're just doing it deliberately by hand.

### The 15 page types and when to reach for each

`tool` / `service` → a tool landing page (MOFU money page) ·
`how-to` → tutorials (TOFU volume) ·
`comparison` → "X vs Y" / alternatives (BOFU) ·
`paper-type` → essay/report/thesis specific ·
`subject` → maths/chemistry/etc. ·
`academic-level` → "for college / high school / grad students" ·
`use-case` → "for nursing students", "for ESL writers" ·
`citation-guide` → APA/MLA/Chicago ·
`method-specific` → a technique (e.g. free-body diagrams) ·
`software-specific` → "alternative to X" ·
`problem-solution` → "is X allowed / X not working" ·
`ebook-type` / `ebook-platform` → ebook + KDP/Apple Books.

### Internal linking rules (this is where most people leave money on the table)

1. Every cluster page links **up** to its pillar (keyword-rich anchor).
2. Every page links to **at least one money page** (`/write`, `/stem`, …) in-context.
3. Pillars link **down** to each cluster page.
4. New page → add 1–2 links to it from older related pages (spreads ranking power).
5. Link to your **pricing** page from BOFU pages.

---

## 4. The 12-month editorial calendar (January → December)

This is an **annual, repeatable** cycle aligned to the (Northern-Hemisphere)
academic year — your largest market. Start at the current month now; the calendar
loops every year, so each January you refresh and re-run it. Each month: a
**theme**, the **pillar**, a **cluster**, the **conversion focus**, and the
**cadence**.

**Default cadence:** 1 pillar + 3–4 cluster pages per week (~16–20 pages/month).
Drop to 3 pages/week (Mon/Wed/Fri) if that's more sustainable — **consistency beats
volume, and thin mass-produced pages get the whole domain demoted.**

---

### JANUARY — New term, new-year intent, application results
Spring semester begins; "new year, better grades" searches spike; US early-decision
results drive transfer/essay activity.
- **Pillar:** *AI Essay Writer for the New Semester* (`tool`, MOFU)
- **Cluster:** how to start an essay (`how-to`) · spring-semester study plan
  (`use-case`) · how to write a 5-paragraph essay (`how-to`) · scholarship essay
  help (`use-case`)
- **Keywords:** `ai essay writer`, `how to start an essay`, `scholarship essay help`,
  `study plan template`
- **Conversion focus:** push the free paper-writer trial; CTA "Start your first
  essay free."

### FEBRUARY — First essays & midterm build-up
First major assignments land; citation panic begins.
- **Pillar:** *Citation Generator & Guide (APA, MLA, Chicago)* (`citation-guide`, TOFU)
- **Cluster:** apa format guide (`citation-guide`) · mla works cited (`citation-guide`)
  · how to avoid plagiarism (`how-to`) · annotated bibliography example (`paper-type`)
- **Keywords:** `apa citation guide`, `mla format`, `how to avoid plagiarism`,
  `annotated bibliography`
- **Conversion:** link citation guides → free plagiarism checker → paper writer.

### MARCH — Research papers & spring break catch-up
Research-paper season; spring break = binge catch-up.
- **Pillar:** *AI Research Paper Writer with Real Citations* (`service`, MOFU)
- **Cluster:** how to write a research paper (`how-to`) · literature review guide
  (`how-to`) · how to write a methodology (`how-to`) · research question examples
  (`paper-type`)
- **Keywords:** `research paper writer`, `how to write a research paper`,
  `literature review`, `methodology section`
- **Conversion:** emphasise the 25+ databases / real citations differentiator.

### APRIL — Finals approach & STEM crunch
Problem sets, lab reports, exam revision begin.
- **Pillar:** *AI STEM Problem Solver (Math, Physics, Chemistry)* (`tool`, MOFU)
- **Cluster:** physics solver with steps (`subject`) · how to write a lab report
  (`paper-type`) · chemistry homework help (`subject`) · statistics help (`subject`)
- **Keywords:** `physics problem solver`, `lab report`, `chemistry homework help`,
  `statistics solver`
- **Conversion:** free STEM queries; CTA "Solve your first problem free."

### MAY — Finals & AP exams (peak academic stress)
Highest assignment + revision intent of spring. Front-load quality.
- **Pillar:** *Final Exam Revision & Study Assistant* (`service`, MOFU)
- **Cluster:** how to study for finals (`how-to`) · last-minute essay help
  (`use-case`) · how to revise effectively (`how-to`) · paper revision tool
  (`tool`)
- **Keywords:** `how to study for finals`, `last minute essay help`,
  `revise for exams`, `paper revision`
- **Conversion:** Revision tool + Study Assistant; bundle CTA to Student Pro.

### JUNE — Summer school, dissertations, ebook side-projects
Grad students write theses; creators start ebooks over summer.
- **Pillar:** *AI Dissertation & Thesis Writing Assistant* (`service`, MOFU)
- **Cluster:** how to structure a dissertation (`how-to`) · how to write an ebook
  (`how-to`) · summer school essay help (`use-case`) · self-publish on KDP
  (`ebook-platform`)
- **Keywords:** `dissertation help`, `how to write an ebook`, `self publish amazon kdp`,
  `thesis assistant`
- **Conversion:** introduce the Ebooks add-on ($29.99) to the creator audience.

### JULY — Thesis season + early back-to-school prep
- **Pillar:** *AI Ebook Writer for Amazon KDP* (`tool`, MOFU)
- **Cluster:** ebook outline generator (`ebook-type`) · how to format an ebook
  (`how-to`) · publish on apple books (`ebook-platform`) · best ai for writing books
  (`comparison`)
- **Keywords:** `ai ebook writer`, `ebook outline`, `publish apple books`,
  `best ai for books`
- **Conversion:** KDP guide as lead magnet → Ebooks add-on.

### AUGUST — Back-to-school & college applications (Common App opens Aug 1)
- **Pillar:** *College Application Essay Assistant* (`service`, MOFU)
- **Cluster:** how to write a personal statement (`how-to`) · common app prompts
  (`paper-type`) · statement of purpose vs personal statement (`comparison`) ·
  scholarship essays (`use-case`)
- **Keywords:** `college application essay help`, `personal statement writer`,
  `common app essay prompts`, `statement of purpose`
- **Conversion:** high-intent season — push signups hard; testimonials.

### SEPTEMBER — Semester start (PEAK TRAFFIC MONTH)
Single highest-intent month of the year. Publish your **best** pillars here.
- **Pillar:** *The Complete AI Toolkit for College Students* (`tool`, MOFU)
- **Cluster:** ai essay writer (`tool`) · best ai tools for students 2027
  (`comparison`) · how to write a college essay (`how-to`) · plagiarism checker for
  students (`tool`)
- **Keywords:** `ai tools for students`, `best ai essay writer 2027`,
  `plagiarism checker for students`, `college essay`
- **Conversion:** everything points to free signup; run your strongest CTAs.

### OCTOBER — Midterms & STEM peak
- **Pillar:** *Homework Help for Every Subject* (`service`, MOFU)
- **Cluster:** calculus solver (`subject`) · how to write a lab report (`paper-type`)
  · biology homework help (`subject`) · engineering problem solver (`subject`)
- **Keywords:** `calculus solver`, `lab report writer`, `biology homework help`,
  `engineering problems`
- **Conversion:** STEM free queries → Student Pro upgrade at the limit.

### NOVEMBER — Term papers, finals ramp & NaNoWriMo
- **Pillar:** *Term Paper Writer with Verified Sources* (`service`, MOFU)
- **Cluster:** how to write a term paper (`how-to`) · how to humanize ai text
  (`how-to`) · annotated bibliography (`paper-type`) · write a novel with ai
  (`ebook-type`)
- **Keywords:** `term paper writer`, `how to humanize ai text`, `write a book with ai`,
  `annotated bibliography`
- **Conversion:** Humanizer as the hook (high search), upsell Student Pro.

### DECEMBER — Finals, end-of-term papers, New-Year planning
- **Pillar:** *Last-Minute Essay & Exam Help* (`service`, MOFU)
- **Cluster:** how to write an essay fast (`how-to`) · end-of-term checklist
  (`problem-solution`) · how to study for finals (`how-to`) · new-year study planner
  (`use-case`)
- **Keywords:** `write an essay fast`, `study for finals`, `last minute essay`,
  `study planner`
- **Conversion:** urgency CTAs ("draft in minutes"); annual-plan promo for January.

---

## 5. Page templates (paste into the ✍️ Write tab)

Each template is **Markdown** — paste it, replace the brackets, watch the Rule-check
panel go green, Publish. The renderer adds the header, footer, schema, and styling.

### Template A — Tool / service page (MOFU money page)

```markdown
# [Tool Name]: [Primary Keyword] for [Audience]

[One sentence that answers the search and names the benefit. Put the keyword in
the first sentence.] LightspeedGhost's [tool] helps [audience] [outcome] in [time].

## What [Tool] does
- [Benefit 1 — concrete, with a number]
- [Benefit 2]
- [Benefit 3]

## How it works (3 steps)
1. [Step] 2. [Step] 3. [Step]

## Why students choose LightspeedGhost over [alternative]
| | LightspeedGhost | [Alternative] |
|---|---|---|
| [Feature] | ✅ | ❌ |
| Real citations from 25+ databases | ✅ | ❌ |
| Price | from $9.99/mo | [x] |

> **Try it free → [Start now](/write)**   ← primary CTA, in-context

## Frequently asked questions
**Is this allowed by my university?**
LightspeedGhost is a writing-support tool, like a tutor or Grammarly. Always
review and make the work your own.

**How much does it cost?**
Plans start at $9.99/month, with pay-as-you-go from $3.99. [Link to /pricing.]

**[Question from "People also ask"]?**
[Answer.]
```
*CTA: 1 in-body + the FAQ price answer → /pricing. Funnel: MOFU.*

### Template B — How-to / tutorial (TOFU volume)

```markdown
# How to [Task]: A Step-by-Step Guide ([Year])

[Answer the question in the first 2 sentences — this wins featured snippets and
AI Overviews.]

## What you'll need
- [item] · [item]

## Step 1 — [Action]
[Detail. Add a real example.]

## Step 2 — [Action]
...

## Common mistakes to avoid
- [Mistake → fix]

## Do it faster with AI
You can do every step above manually, or [LightspeedGhost's [tool]](/write) does
it in [time]. [Soft CTA — helpful, not pushy.]

## Frequently asked questions
**[PAA question]?** [Answer.]
**[PAA question]?** [Answer.]
```
*CTA: 1 soft mid-article + 1 in FAQ. Funnel: TOFU → tool.*

### Template C — Comparison / "X vs Y" (BOFU — highest converting)

```markdown
# [LightspeedGhost] vs [Competitor]: Which Is Better for [Audience] in [Year]?

Short answer: [one-line verdict with a hedge]. Here's the full breakdown.

## Quick verdict
- **Choose LightspeedGhost if** [scenario].
- **Choose [Competitor] if** [scenario].

## Feature comparison
| Feature | LightspeedGhost | [Competitor] |
|---|---|---|
| Real academic citations | ✅ 25+ databases | [x] |
| Humanizer included | ✅ | [x] |
| STEM solver | ✅ | [x] |
| Price | from $9.99/mo | [x] |

## Where LightspeedGhost wins
[2–3 honest paragraphs.]

## Where [Competitor] wins
[Be fair — credibility converts. 1 paragraph.]

> **See plans and start free → [/pricing](/pricing)**

## FAQ
**Is [Competitor] free?** [Answer.]
**Can I switch easily?** [Answer.]
```
*CTA: → /pricing + free signup. Funnel: BOFU.*

### Template D — Listicle / "best X for Y" (MOFU)

```markdown
# The [N] Best [Category] for [Audience] in [Year]

[Intro: who this is for + how you ranked them.]

## 1. LightspeedGhost — best for [specific strength]
[Why #1. Be specific and honest. Link: [/write](/write).]

## 2. [Competitor] — best for [their strength]
...

## How to choose
[Decision guidance that favours your strengths.]

## FAQ
**What's the best free option?** [Answer that routes to your free tier.]
```
*Put yourself #1 but keep the list genuinely useful. Funnel: MOFU.*

### Template E — Subject / citation guide (TOFU authority)

```markdown
# [Subject/Style] Guide for Students: [Primary Keyword]

[Definition + why it matters, in the first paragraph.]

## [Core concept 1]
## [Core concept 2]
## Examples
[Worked examples — this is what students copy and what ranks.]

## Get help with [subject]
[Soft CTA to /stem or /write.]

## FAQ
**[PAA]?** [Answer.] **[PAA]?** [Answer.]
```
*Funnel: TOFU → builds topical authority + soft tool CTA.*

---

## 6. Conversion optimization — turning readers into paid users

Writing the page is half the job. These mechanics are what make it pay:

1. **The CTA ladder (soft → hard by funnel stage).**
   - TOFU: one *soft* in-context link ("you can do this faster with [tool]").
   - MOFU: one *primary* CTA button-style line + a comparison table.
   - BOFU: pricing link + "Start free" + proof (numbers, testimonials).
2. **Lead with the free tool, not the paywall.** "Start your first essay free" beats
   "Subscribe." Let the **free-tier limits** do the selling — that's where the
   Signup→Paid conversion happens.
3. **Always link to a money page in-context.** A page with no link to `/write`,
   `/stem`, `/humanizer`, or `/pricing` is a dead end. Never publish one.
4. **Match CTA to intent.** A "how to write a lab report" reader wants the STEM/
   paper tool — link *that*, not a generic "sign up."
5. **Put one CTA above the fold and one in the FAQ.** Two is plenty; more feels spammy.
6. **Use the FAQ to handle objections** ("Is it allowed?", "How much?", "Is it
   detectable?") — these are the last doubts before signup.
7. **Refresh winners quarterly.** When GSC shows a page ranking #5–15, improve it
   (more depth, better CTA, fresher data) — that's the cheapest traffic you'll get.

---

## 7. Publishing workflow & weekly cadence

**The weekly rhythm (pillar + cluster):**

| Day | Post | Length | Type |
|---|---|---|---|
| Mon | Pillar for the month's theme | 1,500–2,500 w | tool/service |
| Tue | How-to angle | 900–1,200 w | how-to |
| Wed | Comparison angle | 900–1,200 w | comparison |
| Thu | Use-case / audience angle | 900–1,200 w | use-case |
| Fri | Problem→solution / subject angle | 800–1,000 w | problem-solution |

**The 7-step publishing loop (per page):**
1. Pick one keyword (Section 2). 2. Confirm intent (Google it). 3. Outline the H2s.
4. Open **SEO → ✍️ Write**, fill Title (50–60 chars, keyword in it), Slug, Meta
(140–160 chars), Page type, Keywords. 5. Write in Markdown from the matching
template; get the **Rule check** green (800+ words, FAQ, no flagged phrasing).
6. **Publish** → live at `/seo/<slug>`. 7. **Sitemap tab → ping**, then submit the
URL in **Google Search Console**.

---

## 8. Tracking & KPIs (15-minute monthly review)

Set up once: **Google Search Console** (verify the domain) and **GA4** (or Plausible)
with a **signup conversion event**. Then each month, check:

| Metric | Where | Target trend |
|---|---|---|
| Impressions & clicks | GSC → Performance | up every month |
| Avg. position of target keywords | GSC → Queries | toward page 1 |
| Pages in "striking distance" (pos 5–15) | GSC | refresh these first |
| Organic sessions | GA4 | up (after the 3-mo lag) |
| Signups from organic | GA4 conversion | the number that matters |
| Signup→paid rate | your billing data | optimise CTAs if low |

**The one rule:** judge the plan on **signups from organic**, not vanity traffic.
A page with 200 visits and 6 signups beats one with 2,000 visits and 1.

---

## 9. First 30 days — exact action list

**Week 1 — set up + first cluster (target September-style evergreen demand now):**
- [ ] Verify the site in Google Search Console; submit `sitemap.xml`.
- [ ] Add a GA4 signup conversion event.
- [ ] Publish pillar: *AI Essay Writer for College Students* (Template A).
- [ ] Publish 3 clusters: APA citation guide (E), how to write a 5-paragraph essay
  (B), plagiarism checker for students (A). Internal-link them to the pillar.
- [ ] Sitemap → ping; submit all 4 URLs in GSC.

**Week 2 — STEM cluster:**
- [ ] Pillar: *AI STEM Problem Solver* (A) + physics solver (A), how to write a lab
  report (B), chemistry homework help (A). Link to pillar + `/stem`.

**Week 3 — comparison/BOFU (start converting):**
- [ ] *LightspeedGhost vs ChatGPT for essays* (C) · *best AI tools for students 2027*
  (D) · *is using AI for essays allowed?* (problem-solution). Link to `/pricing`.

**Week 4 — Humanizer + review:**
- [ ] *AI Humanizer* (A) + how to humanize AI text (B) + quillbot alternative (C).
- [ ] Open GSC: note which pages are getting impressions; plan next month around them.

After 30 days you'll have ~15–18 interlinked, converting pages live. Keep the weekly
rhythm, follow the calendar, and review monthly. **Consistency for 6–12 months is
what wins** — pick the keyword, write the honest answer, link to the tool, publish,
repeat.
