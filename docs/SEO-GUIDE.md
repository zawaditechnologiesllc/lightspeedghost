# LightSpeed Ghost — SEO Engine: Complete Operator's Guide

This is the practical, plain-language guide to the SEO section of your admin
panel: what every part is, how to use it, the two systems and how they differ,
and what you'll actually achieve.

> **Find it at:** Admin → **SEO** tab.
> **Pages go live at:** `https://lightspeedghost.com/seo/<slug>` (real, crawlable
> pages on your own domain — server-rendered by the backend and proxied through
> Cloudflare Pages).

---

## 1. What this whole thing is for

The SEO engine exists to do one job: **win free, recurring traffic from Google**
so you stop paying for every visitor.

Each page targets a real search a student types ("how to humanize AI text",
"best AI tool for a literature review", "ChatGPT vs … for essays") and answers
it well, with a clear path into your product. Publish enough of them and you
build a compounding stream of signups that costs nothing per click — the
opposite of ads.

**What you'll achieve, realistically:**
- A library of indexable article pages on your domain, each aimed at a buyer-
  intent or high-traffic search.
- A sitemap Google can crawl, with the right compliance signals baked in.
- A steady trickle that compounds: SEO is slow for the first 8–12 weeks, then
  builds. Think months, not days. Volume + consistency win.

**This is not instant.** New pages typically take days to get indexed and weeks
to rank. The job is to ship good pages steadily and let them age.

---

## 2. The two systems (the key distinction)

There are **two ways** to create pages. They produce the *same kind* of live
page in the end — they differ in **who writes it** and **how much it costs.**

| | ✍️ **Manual system** (Write tab) | 🚀 **Automatic system** (Pipeline + Scheduler) |
|---|---|---|
| **Who writes** | You (paste your own article) | The AI (Gemini) researches + writes |
| **Cost** | $0 — no AI spend | Gemini tokens (cents per page) |
| **Output** | 1 page you control fully | A **5-page cluster** on one topic |
| **Speed** | As fast as you can write | ~2–3 min per cluster |
| **Control** | Total — your words, your accuracy | You review/approve before publish |
| **Best for** | Cornerstone pages, brand voice, claims that must be exact | Scale — covering many long-tail searches fast |
| **Where it lands** | Saved as **draft**, you publish | Appears in **Pages** as *Review*, you publish/edit |

**Think of it like this:**
- **Manual = hand-craft.** Use it for your most important, money pages and
  anything where wording/accuracy matters (pricing, legal-adjacent claims).
- **Automatic = factory.** Use it to blanket dozens of long-tail keywords you'd
  never have time to write by hand.

You can — and should — use **both**. Hand-write your 10–20 flagship pages;
let the automatic system fill in the long tail.

### Pipeline vs Scheduler (inside the automatic system)
The automatic system has two triggers for the **same** engine:
- **Pipeline tab → "Start"** = run *one* cluster right now, on demand.
- **Scheduler / daily cron** = run that same pipeline **automatically once a
  day**, hands-off, picking its own topic. Set it and forget it.

---

## 3. The page lifecycle (every page moves through these)

```
   draft  ──►  review  ──►  published  ──►  (archived)
```

- **draft** — created but not live. Catalog placeholders and manually-saved
  pages start here. (Placeholders have no content yet — they're just a to-do.)
- **review** — finished content waiting for your approval. Automatic clusters
  land here; find them in the **Pages** tab filtered by *Review*, then publish,
  edit, or delete each.
- **published** — **live** at `/seo/<slug>` and included in the sitemap.
- **archived** — retired, no longer served.

**Nothing is public until you publish it.** You are always the final gate.

---

## 4. Tab-by-tab — what each one is and how to use it

Your SEO panel has 9 tabs, in this order:

### ✍️ 1. Write — *the manual system (and the editor for every page)*
Write a brand-new page, **or edit any existing one** (the Pages tab's **Edit**
button drops the page straight in here).
1. Enter a **slug** (the URL ending, e.g. `ai-paper-writer-guide`) and **title**.
2. Pick a **page type** (how-to, tool, comparison, etc.) and add a meta
   description + keywords.
3. Write the body in **Markdown** (the editor renders it live). *When editing an
   existing page the body shows that page's current HTML — edit it directly.*
4. Click **Check** — the rule-checker scores it for word count, AI disclosure,
   FAQ schema, and integrity language. Fix anything it flags.
5. **Save as draft** or **Publish** (go live now). The page is served at
   `/seo/<slug>` instantly — no AI cost. Editing an AI-written page works the
   same way; your changes overwrite it in place.

### 🚀 2. Pipeline — *run the automatic system on demand*
Kick off one AI cluster.
1. Optionally type a **topic** + pick a **tool focus** (or leave blank and the
   AI picks the best topic from your data).
2. Click **Start**. It runs: **Research** (Reddit + AI) → **Outline** →
   **Write 5 pages**, pausing between steps to respect rate limits.
3. Watch the status. When it's **complete**, the 5 pages appear in **Pages**
   with status **Review** (filter the Pages tab by *Review*).
4. If it says **failed**, the error message tells you why (usually a Gemini
   hiccup) — hit **Resume** to retry from where it stopped.

> Each cluster = 5 pages. Daily limit: **5 pipeline pages / 24h** (one cluster
> a day) to stay inside the free Gemini tier.

### ⚡ 3. Dashboard — *health at a glance*
KPI counts (Published / In Review / Draft / Total) and your monthly budget bar.
This is your "is everything OK" view. (If it shows a "backend waking up" banner,
the free-tier server is cold — refresh in ~30s.)

### 📋 4. Catalog — *the master plan of pages to build*
A pre-built list of **300+ planned pages** across 15 types, each a real
keyword target (134 hand-authored + **168 programmatic** matrix pages).
- **Seed catalog** creates **placeholder drafts** for every planned page (titles
  + slugs only, *no content yet*).
- It shows which are already generated/published vs still empty.
- **Generate batch** fills empty placeholders with AI content (up to 30/run).
- Use it as your roadmap: see the gaps, fill the highest-value ones first.

> **Programmatic SEO:** the catalog now includes three template × dataset
> *matrices* — Citation (`how-to-cite-a-{source}-in-{style}`, 112 pages),
> Competitor (`…-alternative-for-students` + `lightspeedghost-vs-…`, 28), and
> Subject (`ai-{subject}-essay/assignment-help`, 28). Generate them in batches and
> **review before publishing** — do not mass-publish thin pages (it risks a
> whole-domain demotion). Strategy + guardrails: `docs/SEO-CONTENT-PLAN.md` §3.

### 📄 5. Pages — *every page in the database (your control center)*
The full table — filter by status (draft/**review**/published), search, and per
row:
- **Publish / Unpublish** — toggle whether it's live.
- **Edit** — opens it in the Write tab, fully loaded, to change anything.
- **Delete** — removes it permanently (super admin only; asks first).

This is where **AI clusters land for approval** (filter by *Review*), and where
you manage, edit, publish, or delete everything that exists — manual or
AI-written alike. Click a slug to open the live page. (Grey, unlinked slugs are
empty placeholders with nothing to view yet.)

### 💰 6. Budget — *what the AI is spending*
Monthly Gemini spend, a budget bar, and the **LLM Cost Log**.
- **Each cost-log row is one AI call, not a finished blog.** A 5-page cluster
  makes several billed calls.
- The **Page** column links the page each call was for — a **404 means the call
  was billed but the page never saved** (a sign of a failed run).
- Cost is logged the moment the AI replies, *before* the page is saved — so
  "spent" and "published" are never the same number.

### 🛡 7. Integrity — *compliance & quality audit*
Checks every generated page for: AI-generated disclosure (EU AI Act), academic-
integrity language, FAQ schema, 800+ word minimum, and WCAG 2.2 accessibility.
Fix flagged pages with one click. Keeps you legally clean and Google-friendly.

### 🗺 8. Sitemap — *what crawlers see*
Preview your live `robots.txt` and `sitemap.xml`. The sitemap auto-includes
every **published** SEO page. Use the links to verify, then submit your sitemap
in Google Search Console (see §6).

### ⚙ 9. Settings — *configuration*
- **Integrations status** — green/red for Gemini (required), Search Console,
  GA4, Reddit (no key needed — it scrapes), and the daily cron token.
- **Scheduler** — turn the daily automatic run on/off and set its UTC time.
- **Engine configuration** — model, budget cap, word minimums, limits (all
  overridable by environment variables).

---

## 5. The two workflows, step by step

### A) Manual workflow (hand-crafted page)
1. **SEO → Write**.
2. Slug + title + page type + meta description.
3. Write the article in Markdown.
4. **Check** → fix anything flagged.
5. **Save draft** (or **Publish**).
6. If saved as draft: go to **Pages**, find it, **Publish** when ready.
7. Open `/seo/<slug>` to confirm it's live.

### B) Automatic workflow (AI cluster)
1. **One-off:** SEO → **Pipeline** → (optional topic) → **Start**.
   **Hands-off:** SEO → **Settings** → enable the **Scheduler** + set a time.
2. Wait ~2–3 minutes (or for the daily run).
3. **SEO → Pages**, filter by **Review** → open/read the new pages.
4. **Publish** the good ones (or **Edit** to tweak, or **Delete** to discard).
5. Open the live URLs to confirm.

### C) Filling the roadmap (catalog batch)
1. **SEO → Catalog → Seed catalog** (creates the placeholder list — once).
2. **Generate batch** to fill empty placeholders with AI content.
3. Review the results in **Pages**, publish the good ones.

---

## 6. One-time setup checklist

- **`GEMINI_API_KEY`** set on the backend (Render) — *required* for any AI
  generation. Check **Settings → Integrations** shows it green.
- **`SEO_CRON_TOKEN`** set — required only if you want the **daily automatic**
  run. Point an external cron (cron-job.org / UptimeRobot) at
  `https://lightspeedghost-5szz.onrender.com/api/seo/cron/run?token=<SEO_CRON_TOKEN>`.
- *(Optional)* **Search Console + GA4** service-account env vars — lets the AI
  pick topics from your real search data instead of just the catalog.
- **Submit your sitemap** once in **Google Search Console**:
  `https://lightspeedghost.com/seo-sitemap.xml`.
- Reddit research needs **no key** — it scrapes public pages.

---

## 7. A sensible operating cadence

- **Week 1:** Hand-write (Write tab) your 10–20 most important pages — your core
  tools and top comparisons. Publish them.
- **Ongoing:** Turn on the **daily Scheduler**. Each day it drafts one cluster;
  spend two minutes in **Pages** (filtered by *Review*) publishing, editing, or
  deleting them.
- **Monthly:** Open **Catalog**, batch-generate a handful of the highest-value
  gaps, review, publish.
- **Always:** Skim **Integrity** so everything stays compliant, and submit/
  refresh the sitemap in Search Console.

Consistency beats bursts. Ten solid pages a week, reviewed by a human, will
outperform 200 dumped at once.

---

## 8. Quick troubleshooting

| Symptom | What it means / do |
|---|---|
| Dashboard shows all zeros | Backend cold (free tier) — refresh in ~30s. If it persists, the backend is still booting. |
| No new pages after a run | Run not finished (~2–3 min) or it failed — check **Pipeline** status + error, hit **Resume**. New pages show in **Pages** under the *Review* filter. |
| Want to change an AI page | **Pages → Edit** opens it in the Write tab; tweak the HTML and Save. **Delete** removes it (super admin). |
| Cost log shows spend but no pages | The AI was billed but the page didn't save (a failed run). Click the **Page** column slug — a 404 confirms it. |
| A draft slug isn't clickable | It's an empty **placeholder** — generate content for it first. |
| Published page looks too plain | Pages are intentionally light-themed for readability/print; the content is server-rendered HTML. |
| "Pipeline started" then an error | The start worked; a follow-up load hit the waking backend. Refresh. |

---

## 9. The cost picture

- **Model:** Gemini 2.5 Flash (cheap, runs on the free tier).
- **Manual pages:** $0.
- **Automatic pages:** cents per page; the **Budget** tab caps monthly spend
  (configurable via `SEO_BUDGET_LIMIT`).
- Cost is per **AI call**, recorded immediately — independent of whether you
  ever publish the result. Review before you mass-generate so you don't pay for
  pages you won't use.

---

### TL;DR
- **Two systems:** **Write** (you write, free, full control) and **Pipeline/
  Scheduler** (AI writes 5-page clusters, cheap, you approve in **Pages**).
- **Every page** lives in the **Pages** tab: Publish/Unpublish, **Edit** (opens
  the Write tab), or **Delete** — for manual and AI pages alike.
- **Every page:** draft → review → **published** at `/seo/<slug>`.
- **You always approve before anything goes live.**
- **Goal:** a compounding library of search-targeted pages that brings free
  signups over months. Ship steadily, review everything, submit your sitemap.
