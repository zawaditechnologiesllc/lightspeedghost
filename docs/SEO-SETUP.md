# LightspeedGhost SEO Engine — Setup (manual + automated, side by side)

The SEO system has **two engines that share one pipeline**. They are not
alternatives — run both:

| | **Manual engine** (Write tab) | **Automated engine** (Pipeline + scheduler) |
|---|---|---|
| Who writes | you, by hand | AI (Gemini 2.5 Flash) |
| Best for | high-value pillars, comparisons, brand pages | volume, long-tail clusters, filling catalog gaps |
| Cost | $0 | a few cents/page on Gemini (free tier covers light use) |
| Output | a row in `seo_pages` | rows in `seo_pages` (5-page clusters) |
| Review | publish when you're ready | lands in the **Review** queue for your approval |

**They work hand in hand:** both write to the same `seo_pages` table, both are
served **server-rendered** at `https://lightspeedghost.com/seo/<slug>`, and both
are automatically included in `sitemap.xml`, `robots.txt`, and `llms.txt`. The
manual save path will **never overwrite** an AI-generated page (it guards on the
slug), and the AI engine won't touch your manual pages. You see and manage
everything together in the **Pages**, **Dashboard**, **Integrity**, and
**Sitemap** tabs.

Everything below is in the admin panel: **`/mwaramuriuki-login` → SEO**.

---

## 1. One-time database setup

The `seo_*` tables are created by a migration (run once against your production DB):

```bash
psql "$DATABASE_URL" -f scripts/seo-migrations.sql
```

Then in the SEO admin, open **Catalog → Seed catalog** to load the 130+ page
specs the automated engine can generate from.

---

## 2. Environment variables (Render → your service → Environment)

**Required** (the engine runs on just these):

| Var | Needed for | Notes |
|-----|-----------|-------|
| `ADMIN_PASSWORD` | admin access | the super-admin password |
| `DATABASE_URL` | everything | Postgres connection string |
| `GEMINI_API_KEY` | **all AI generation** | free at aistudio.google.com — required, or the automated engine does nothing |

**Recommended / optional** (each one switches on more of the engine):

| Var | Switches on | Notes |
|-----|-------------|-------|
| `SEO_CRON_TOKEN` | the external daily cron | a long random secret guarding the cron URL (see §3) |
| `SEO_GEMINI_MODEL` | model override | defaults to `gemini-2.5-flash` (free tier); set `gemini-2.5-pro` only with billing |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | **Search Console + GA4** | full GCP service-account JSON (one line). Powers data-driven topic selection |
| `GSC_SITE_URL` | Search Console | exact property URL, e.g. `https://lightspeedghost.com/` |
| `GA4_PROPERTY_ID` | Google Analytics 4 | numeric property id — weights topics toward revenue-driving tools |
| `REDDIT_CLIENT_ID` | **Reddit research** | from reddit.com/prefs/apps (see §2a). Real community signal in the research step |
| `REDDIT_CLIENT_SECRET` | Reddit research | the app secret paired with the id above |
| `SEO_BUDGET_LIMIT` | spend cap | monthly USD cap (default `25.00`) — generation pauses when hit |
| `SEO_DAILY_PAGE_LIMIT` | batch size | max catalog pages per batch run (default `30`) |
| `SEO_MIN_WORD_COUNT` | quality gate | per-page minimum (default `800`) |
| `RESEND_API_KEY`, `EMAIL_FROM` | email notifications | see `docs/EMAIL-SETUP.md` |

> The engine **degrades gracefully**: without the Google/Reddit vars it still
> works, just using catalog-gap topic selection + the model's own knowledge
> instead of live Search Console / GA4 / Reddit data. Set them to unlock the
> full, data-driven behaviour. **The manual Write engine needs none of this** —
> only `ADMIN_PASSWORD` + `DATABASE_URL`.

---

## 2a. What the automated engine actually does (and the data behind each step)

When the scheduler/cron fires, the pipeline runs these steps — each uses the data
source in brackets:

1. **Topic selection** (`topic-selector.ts`) — picks the highest-opportunity
   cluster topic from, in priority order: **Google Search Console** quick-wins
   (high-impression, low-CTR queries) → **GA4** revenue by tool page → **catalog
   gaps** (un-generated `PAGE_CATALOG` slugs) → AI-only. *Needs
   `GOOGLE_SERVICE_ACCOUNT_JSON` + `GSC_SITE_URL` / `GA4_PROPERTY_ID` for the first
   two; works on catalog gaps without them.*
2. **Research** (`researcher.ts`) — pulls real discussions from academic
   subreddits and synthesises pain points, questions, keywords and the best
   competitor to compare against. *Needs `REDDIT_CLIENT_ID/SECRET`; falls back to
   the model's own knowledge if absent.*
3. **Outline** (`outliner.ts`) — builds the 5-page cluster structure (hook,
   comparison, breakdown, alternative, trust) with Gemini.
4. **Generation** (`content-generator.ts`, `five-page-cluster.ts`) — writes each
   page with Gemini, with FAQ + schema.org structured data (`schema-engine.ts`).
5. **Compliance** (`compliance-checker.ts`) — academic-integrity sanitising +
   EU AI Act disclosure + word-count/data-point gates.
6. **Review** — pages land in the **Review** queue at status `review`; you
   approve → published, server-rendered at `/seo/<slug>`, and added to
   `sitemap.xml` automatically.

Budget is tracked per run (`budget-tracker.ts`) against `SEO_BUDGET_LIMIT`, and a
sitemap ping notifies Google + Bing on publish.

### Setting up Google Search Console + GA4 (optional but high-value)
1. In Google Cloud, create a **service account** and download its JSON key.
2. Enable the **Search Console API** and **Google Analytics Data API** for the project.
3. In **Search Console → Settings → Users**, add the service-account email as a
   user. In **GA4 → Admin → Property Access**, add it as a Viewer.
4. Put the *entire* JSON (minified to one line) in `GOOGLE_SERVICE_ACCOUNT_JSON`,
   set `GSC_SITE_URL` to your exact property URL, and `GA4_PROPERTY_ID` to the
   numeric id.

### Setting up Reddit research (optional)
Reddit's public API now blocks server/datacenter requests (you'll see `403` in the
logs), so the research step needs an app token:
1. Go to **reddit.com/prefs/apps → Create another app → "script"**. Set the
   redirect URI to `http://localhost` (unused for app-only auth).
2. Copy the **client id** (under the app name) and **secret** into
   `REDDIT_CLIENT_ID` and `REDDIT_CLIENT_SECRET`.
3. Redeploy. The research step now reads real subreddit discussions; without the
   creds it logs a warning and falls back to the model's own knowledge (the
   pipeline still completes).

---

## 3. Turn the automated engine ON

The automated engine is idle until you start it. Two ways — **use the cron** if
you're on Render's free tier:

### Option A (recommended on free hosting) — external cron
Render's free tier hibernates, so the in-process daily timer can't be trusted.
Drive it from outside instead:

1. Set `GEMINI_API_KEY` and `SEO_CRON_TOKEN` (above) and redeploy.
2. Create an **UptimeRobot** HTTP(s) monitor (5-min interval is fine) pointing at:
   ```
   https://lightspeedghost-5szz.onrender.com/api/seo/cron/run?token=<SEO_CRON_TOKEN>
   ```
3. It self-throttles to **one generation run per day** (a 20-hour guard) and each
   ping also keeps the backend awake. Verify in **SEO → Settings → Automation
   status** — `GEMINI_API_KEY` and `SEO_CRON_TOKEN` should read ✓ Detected, with
   the last run shown.

### Option B — built-in scheduler
**SEO → Settings → Daily Auto-Scheduler → On**, set a UTC run time. This uses an
in-process timer; reliable only if your backend stays awake (paid tier, or the
cron from Option A is already keeping it warm).

### What a run does
Scheduler/cron fires → AI selects the best topic (from catalog gaps + any GSC/GA4
data) → researches it → writes a **5-page cluster** → pages land in the **Review**
queue. You read them in **Review**, then **Publish all** (or discard). Nothing
goes live without your approval unless you enable auto-publish.

You can also trigger it on demand: **Settings → Run Now**, or **Pipeline →** enter
a topic to generate a specific cluster immediately.

---

## 4. Use the manual engine

**SEO → ✍️ Write:** compose a page in Markdown, watch the live **Rule check**
(prohibited phrasing, length, FAQ, data points), then **Save draft** or **Publish**.
It's live at `/seo/<slug>` immediately. Edit any page (manual or AI) later from
the **Pages** tab. Full keyword/calendar/template strategy is in
`docs/SEO-CONTENT-PLAN.md`.

---

## 5. The recommended hybrid workflow

1. **AI engine runs daily** (cron) → produces long-tail clusters into Review.
2. **You triage Review** — approve the good ones, discard weak ones, lightly edit.
3. **You hand-write the money pages** (pillars, "X vs Y", brand pages) in Write —
   these are higher intent and convert best, and are worth doing yourself.
4. **Everything lands in the same place** — Pages, Sitemap, robots, llms.txt — so
   search engines and AI answer engines see one coherent, growing site.
5. **Watch Budget + Dashboard** — the Dashboard shows published/review/draft across
   both engines; Budget shows AI spend against your cap.

Rule of thumb: let the **AI engine cover breadth** (volume, catalog gaps) and do
the **depth by hand** (the pages you most want to rank and convert). Keep an eye on
quality — discard thin AI pages rather than publishing everything, so the domain
stays strong.

---

## 6. Troubleshooting

- **AI pages are empty / placeholder, logs show `429 ... limit: 0`** — you're on
  `gemini-2.5-pro`, which has no free tier. Leave `SEO_GEMINI_MODEL` unset (defaults
  to Flash) or set it to `gemini-2.5-flash`, or enable billing on the Google project.
- **Cron returns `Forbidden`** — point the monitor at the Render backend URL
  directly (not `lightspeedghost.com`, whose CDN blocks non-browser requests).
- **Cron returns `SEO_CRON_TOKEN is not configured`** — set the env var in Render.
- **Scheduler never runs** — on free Render the in-process timer sleeps; use the
  external cron (Option A).
- **Nothing generates** — confirm `GEMINI_API_KEY` is set (SEO → Settings →
  Automation status), and that you've run the DB migration + seeded the catalog.
