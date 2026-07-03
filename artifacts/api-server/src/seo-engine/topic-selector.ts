/**
 * AI-driven topic selector for the SEO pipeline.
 *
 * Priority order:
 *   1. Google Search Console — high-impression, low-CTR queries (quick wins)
 *   2. Google Analytics 4   — revenue by tool page (weight high-revenue tools)
 *   3. Catalog gap fallback — pages not yet generated from PAGE_CATALOG
 *
 * If Google credentials are absent, falls back to catalog gap analysis only.
 * The competitor is always resolved later in the research step (researcher.ts).
 *
 * Required env vars (all optional — system works without them):
 *   GOOGLE_SERVICE_ACCOUNT_JSON  — JSON string of GCP service account credentials
 *   GSC_SITE_URL                 — e.g. "https://lightspeedghost.com/" (exact GSC property URL)
 *   GA4_PROPERTY_ID              — numeric GA4 property ID, e.g. "123456789"
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import { importPKCS8, SignJWT } from "jose";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";
import { PAGE_CATALOG } from "./page-catalog";
import { GEMINI_PRO_MODEL } from "./researcher";

export interface TopicSelection {
  topic:           string;
  topicSlug:       string;
  toolFocus:       string;
  audienceSegment: string;
  rationale:       string;
  dataSource:      "search-console" | "analytics" | "catalog-gap" | "ai-only";
}

// ── Google service account auth ───────────────────────────────────────────────

interface ServiceAccountCredentials {
  client_email: string;
  private_key:  string;
}

async function getGoogleAccessToken(scope: string): Promise<string | null> {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;

  try {
    const creds = JSON.parse(raw) as ServiceAccountCredentials;
    const privateKey = await importPKCS8(creds.private_key, "RS256");

    const jwt = await new SignJWT({ scope })
      .setProtectedHeader({ alg: "RS256" })
      .setIssuer(creds.client_email)
      .setAudience("https://oauth2.googleapis.com/token")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(privateKey);

    const resp = await fetch("https://oauth2.googleapis.com/token", {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:    new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion:  jwt,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!resp.ok) return null;
    const body = await resp.json() as { access_token?: string };
    return body.access_token ?? null;
  } catch (err) {
    logger.warn({ err }, "[topic-selector] Google auth failed");
    return null;
  }
}

// ── Google Search Console: find keyword opportunities ─────────────────────────

interface GSCQuery {
  query:       string;
  impressions: number;
  clicks:      number;
  ctr:         number;
  position:    number;
}

async function fetchGSCOpportunities(): Promise<GSCQuery[]> {
  const siteUrl = process.env.GSC_SITE_URL;
  if (!siteUrl) return [];

  const token = await getGoogleAccessToken("https://www.googleapis.com/auth/webmasters.readonly");
  if (!token) return [];

  try {
    const encoded = encodeURIComponent(siteUrl);
    const resp = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encoded}/searchAnalytics/query`,
      {
        method:  "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body:    JSON.stringify({
          startDate:   new Date(Date.now() - 90 * 86400_000).toISOString().slice(0, 10),
          endDate:     new Date().toISOString().slice(0, 10),
          dimensions:  ["query"],
          rowLimit:    50,
          dimensionFilterGroups: [{
            filters: [{ dimension: "query", operator: "notContains", expression: "lightspeed" }],
          }],
        }),
        signal: AbortSignal.timeout(15_000),
      },
    );

    if (!resp.ok) return [];
    const body = await resp.json() as { rows?: Array<{ keys: string[]; impressions: number; clicks: number; ctr: number; position: number }> };

    return (body.rows ?? [])
      .filter((r) => r.impressions > 50 && r.ctr < 0.05)
      .map((r) => ({
        query:       r.keys[0] ?? "",
        impressions: r.impressions,
        clicks:      r.clicks,
        ctr:         r.ctr,
        position:    r.position,
      }))
      .slice(0, 20);
  } catch (err) {
    logger.warn({ err }, "[topic-selector] GSC fetch failed");
    return [];
  }
}

// ── GA4: find which tool pages drive the most revenue ─────────────────────────

async function fetchGA4Revenue(): Promise<Record<string, number>> {
  const propertyId = process.env.GA4_PROPERTY_ID;
  if (!propertyId) return {};

  const token = await getGoogleAccessToken("https://www.googleapis.com/auth/analytics.readonly");
  if (!token) return {};

  try {
    const resp = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      {
        method:  "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body:    JSON.stringify({
          dateRanges: [{ startDate: "90daysAgo", endDate: "today" }],
          dimensions: [{ name: "pagePath" }],
          metrics:    [{ name: "purchaseRevenue" }, { name: "conversions" }],
          dimensionFilter: {
            filter: {
              fieldName: "pagePath",
              inListFilter: { values: ["/write", "/revision", "/humanizer", "/stem", "/study", "/plagiarism", "/outline", "/ebooks"] },
            },
          },
          limit: 20,
        }),
        signal: AbortSignal.timeout(15_000),
      },
    );

    if (!resp.ok) return {};
    const body = await resp.json() as {
      rows?: Array<{ dimensionValues: Array<{ value: string }>; metricValues: Array<{ value: string }> }>;
    };

    const revenue: Record<string, number> = {};
    for (const row of body.rows ?? []) {
      const path = row.dimensionValues[0]?.value ?? "";
      const rev  = parseFloat(row.metricValues[0]?.value ?? "0");
      revenue[path] = rev;
    }
    return revenue;
  } catch (err) {
    logger.warn({ err }, "[topic-selector] GA4 fetch failed");
    return {};
  }
}

// ── Catalog gap: find pages not yet generated ─────────────────────────────────

async function getCatalogGaps(): Promise<string[]> {
  const { rows } = await pool.query(
    `SELECT slug FROM seo_pages WHERE content_html IS NOT NULL`,
  );
  const covered = new Set(rows.map((r: { slug: string }) => r.slug));
  return PAGE_CATALOG.filter((p) => !covered.has(p.slug)).map((p) => p.slug);
}

// ── Already-generated cluster topics ─────────────────────────────────────────

// Turn the first uncovered catalog page into a topic selection — used both when
// Gemini fails and when it re-picks an already-written topic.
function catalogGapSelection(catalogGaps: string[]): TopicSelection | null {
  if (catalogGaps.length === 0) return null;
  const slug = catalogGaps[0];
  const spec = PAGE_CATALOG.find((p) => p.slug === slug);
  return {
    topic:           spec?.title ?? slug,
    topicSlug:       slug,
    toolFocus:       spec?.toolFocus ?? "paper-writer",
    audienceSegment: spec?.audienceSegment ?? "students",
    rationale:       "Fallback: first uncovered catalog page",
    dataSource:      "catalog-gap",
  };
}

async function getRecentClusterTopics(days = 30): Promise<string[]> {
  const { rows } = await pool.query(
    `SELECT topic FROM seo_article_clusters WHERE created_at > NOW() - ($1 || ' days')::interval`,
    [days],
  );
  return rows.map((r: { topic: string }) => r.topic);
}

// ── Main topic selector ───────────────────────────────────────────────────────

export async function selectTopic(geminiClient: GoogleGenerativeAI): Promise<TopicSelection> {
  // A full year of past cluster topics: re-picking a covered topic makes the
  // outline derive the SAME formulaic slugs as the earlier cluster (they're
  // built from the topic text), producing near-duplicate content.
  const [gscData, ga4Revenue, catalogGaps, recentTopics] = await Promise.all([
    fetchGSCOpportunities(),
    fetchGA4Revenue(),
    getCatalogGaps(),
    getRecentClusterTopics(365),
  ]);

  const hasGSC     = gscData.length > 0;
  const hasGA4     = Object.keys(ga4Revenue).length > 0;
  const hasGaps    = catalogGaps.length > 0;

  // Build context for Gemini to pick the best topic
  const contextParts: string[] = [];

  if (hasGSC) {
    contextParts.push(`GOOGLE SEARCH CONSOLE — Top keyword opportunities (high impressions, low CTR — quick wins):
${gscData.slice(0, 15).map((q) => `  • "${q.query}" — ${q.impressions.toLocaleString()} impressions, ${(q.ctr * 100).toFixed(1)}% CTR, pos ${q.position.toFixed(0)}`).join("\n")}`);
  }

  if (hasGA4) {
    const sorted = Object.entries(ga4Revenue).sort(([, a], [, b]) => b - a);
    contextParts.push(`GOOGLE ANALYTICS 4 — Revenue by tool page (last 90 days):
${sorted.map(([path, rev]) => `  • ${path}: $${rev.toFixed(2)}`).join("\n")}`);
  }

  if (hasGaps) {
    const sampleGaps = catalogGaps.slice(0, 20);
    const gapDetails = sampleGaps.map((slug) => {
      const spec = PAGE_CATALOG.find((p) => p.slug === slug);
      return spec ? `  • ${slug} — "${spec.title}" (${spec.type}, tool: ${spec.toolFocus ?? "general"})` : `  • ${slug}`;
    });
    contextParts.push(`CATALOG GAPS — Pages not yet generated (coverage opportunities):
${gapDetails.join("\n")}`);
  }

  if (recentTopics.length > 0) {
    contextParts.push(`ALREADY WRITTEN — HARD CONSTRAINT: you MUST NOT pick any topic below, nor a paraphrase or minor variation of one. Pick something genuinely NEW:
${recentTopics.map((t) => `  • ${t}`).join("\n")}`);
  }

  const availableTools = [
    { value: "paper-writer",      label: "AI Paper Writer",    path: "/write" },
    { value: "humanizer",         label: "AI Humanizer",       path: "/humanizer" },
    { value: "revision",          label: "Essay Revision",     path: "/revision" },
    { value: "plagiarism-check",  label: "Plagiarism Checker", path: "/plagiarism" },
    { value: "stem",              label: "STEM Solver",        path: "/stem" },
    { value: "study-assistant",   label: "Study Assistant",    path: "/study" },
    { value: "outline",           label: "Outline Generator",  path: "/outline" },
    { value: "ebook",             label: "Ebook Generator",    path: "/ebooks" },
  ];

  const prompt = `You are an SEO strategist for LightspeedGhost (lightspeedghost.com) — an AI academic writing platform targeting students.

YOUR TASK: Pick the single best article cluster topic to generate TODAY for maximum organic traffic and revenue potential.

${contextParts.join("\n\n")}

AVAILABLE TOOLS TO PROMOTE:
${availableTools.map((t) => `  • ${t.value} — "${t.label}" (${t.path})`).join("\n")}

SELECTION CRITERIA (in priority order):
1. High search demand + low competition (use GSC data if available)
2. Maps to a tool that drives revenue (use GA4 data if available)
3. Has not been covered recently
4. Students are actively searching for help with this topic on Reddit/forums

Return a JSON object:
{
  "topic": "the article cluster topic — e.g. 'How to write a literature review for a PhD thesis'",
  "toolFocus": "one of the tool values above that best solves this problem",
  "audienceSegment": "e.g. 'undergraduate students', 'graduate students', 'high school students', 'STEM students'",
  "rationale": "2–3 sentences explaining why this topic will drive revenue. Mention search volume, competition level, or revenue potential."
}`;

  const model = geminiClient.getGenerativeModel({ model: GEMINI_PRO_MODEL });

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 800,
        responseMimeType: "application/json",
      },
    });

    const parsed = JSON.parse(result.response.text()) as {
      topic?: string;
      toolFocus?: string;
      audienceSegment?: string;
      rationale?: string;
    };

    const topic    = String(parsed.topic ?? "").trim();
    const toolFocus = String(parsed.toolFocus ?? "paper-writer");
    const topicSlug = topic.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 60);

    // Hard duplicate check — the prompt asks Gemini not to repeat itself, but
    // prompts can be ignored; this can't. A repeated topic slug means the same
    // formulaic page slugs and near-duplicate content, so route to a catalog
    // gap instead of writing the same cluster twice.
    const { rows: dupRows } = await pool.query(
      `SELECT 1 FROM seo_article_clusters WHERE topic_slug = $1 AND status <> 'failed' LIMIT 1`,
      [topicSlug],
    );
    if (dupRows.length > 0) {
      logger.warn({ topic, topicSlug }, "[topic-selector] Gemini re-picked an already-written topic — falling back to a catalog gap");
      const gap = catalogGapSelection(catalogGaps);
      if (gap) return gap;
    }

    const selection: TopicSelection = {
      topic,
      topicSlug,
      toolFocus,
      audienceSegment: String(parsed.audienceSegment ?? "students"),
      rationale:       String(parsed.rationale ?? ""),
      dataSource:      hasGSC ? "search-console" : hasGA4 ? "analytics" : hasGaps ? "catalog-gap" : "ai-only",
    };

    logger.info({ topic, toolFocus, dataSource: selection.dataSource }, "[topic-selector] Topic selected");
    return selection;
  } catch (err) {
    logger.error({ err }, "[topic-selector] Gemini topic selection failed — using fallback");

    // Fallback: pick first uncovered catalog page
    const gap = catalogGapSelection(catalogGaps);
    if (gap) return gap;

    // Last resort
    return {
      topic:           "How to write a research paper with AI assistance",
      topicSlug:       "how-to-write-research-paper-ai",
      toolFocus:       "paper-writer",
      audienceSegment: "undergraduate students",
      rationale:       "High-volume evergreen topic for the AI paper writer tool",
      dataSource:      "ai-only",
    };
  }
}
