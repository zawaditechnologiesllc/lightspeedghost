/**
 * Scite-style Smart Citation Quality Scoring
 *
 * Scite (scite.ai) provides "Smart Citations" — for each paper, it shows how
 * many subsequent papers SUPPORT, CONTRAST, or merely MENTION the findings.
 * This is far more valuable than raw citation counts: a paper with 500
 * citations but 200 contrasting ones is scientifically controversial.
 *
 * Since Scite's API requires a paid key, we implement the same concept using:
 *  1. Semantic Scholar's free /citations endpoint — returns citing papers
 *     with `intents` field: ["background", "methodology", "result"] and
 *     `isInfluential` flag (Semantic Scholar's own algorithm)
 *  2. OpenAlex's cited-by context — counts + influential citation indicator
 *
 * The resulting `CitationQuality` object mirrors Scite's output:
 *  • supporting    — papers that positively use / build on this paper's findings
 *  • contrasting   — papers that challenge or dispute findings
 *  • mentioning    — papers that merely cite for background context
 *  • influential   — Semantic Scholar's "highly influential" flag
 *  • qualityScore  — composite 0-100 score (high = credible, well-supported)
 */

import { withCache } from "./cache.js";
import { ssRateLimit } from "./ssRateLimit.js";

export interface CitationQuality {
  paperId: string;
  citationCount: number;
  supportingCount: number;
  contrastingCount: number;
  mentioningCount: number;
  influentialCitationCount: number;
  isInfluential: boolean;
  qualityScore: number;
  qualityLabel: "High" | "Moderate" | "Low" | "Unknown";
  confidence: "high" | "medium" | "low";
  source: "semantic-scholar" | "openalex" | "estimated";
}

// ── Semantic Scholar citation intent scoring ──────────────────────────────────

interface S2CitingPaper {
  intents?: string[];
  isInfluential?: boolean;
  citingPaper?: {
    paperId?: string;
    year?: number;
  };
}

interface S2CitationsResponse {
  data?: S2CitingPaper[];
  next?: number;
}

async function fetchS2CitationData(
  paperId: string,
  limit = 50
): Promise<{ supporting: number; contrasting: number; mentioning: number; influential: number } | null> {
  try {
    await ssRateLimit();

    const fields = "intents,isInfluential";
    const url = `https://api.semanticscholar.org/graph/v1/paper/${encodeURIComponent(paperId)}/citations?fields=${fields}&limit=${limit}`;

    const resp = await fetch(url, {
      headers: { "User-Agent": "LightSpeedGhost/1.0 Citation Quality Scorer" },
      signal: AbortSignal.timeout(8000),
    });

    if (!resp.ok) return null;

    const data = await resp.json() as S2CitationsResponse;
    const citations = data.data ?? [];

    let supporting = 0;
    let contrasting = 0;
    let mentioning = 0;
    let influential = 0;

    for (const c of citations) {
      const intents = c.intents ?? [];
      if (c.isInfluential) influential++;

      // Semantic Scholar intent mapping to Scite categories:
      // "result"      → supporting  (uses/validates the finding)
      // "methodology" → mentioning  (uses the method but not necessarily the result)
      // "background"  → mentioning  (cites for context)
      // When intents is empty, classify as mentioning
      if (intents.includes("result")) {
        supporting++;
      } else if (intents.length === 0 || intents.includes("background") || intents.includes("methodology")) {
        mentioning++;
      }

      // Semantic Scholar doesn't expose "contrasting" intent directly;
      // we estimate from papers that cite without using results AND are
      // relatively recent (suggesting paradigm has shifted)
      // — conservative approach: mark 0 contrasting unless we have context
    }

    return { supporting, contrasting, mentioning, influential };
  } catch {
    return null;
  }
}

// ── OpenAlex citation data (fallback) ─────────────────────────────────────────

interface OAWork {
  cited_by_count?: number;
  counts_by_year?: Array<{ year: number; cited_by_count: number }>;
  is_retracted?: boolean;
}

async function fetchOpenAlexCitationCount(doi: string): Promise<{ citedByCount: number; isRetracted: boolean } | null> {
  try {
    const url = `https://api.openalex.org/works/https://doi.org/${encodeURIComponent(doi)}?select=cited_by_count,is_retracted`;
    const resp = await fetch(url, {
      headers: { "User-Agent": "LightSpeedGhost/1.0 (mailto:admin@lightspeedghost.com)" },
      signal: AbortSignal.timeout(6000),
    });
    if (!resp.ok) return null;
    const data = await resp.json() as OAWork;
    return {
      citedByCount: data.cited_by_count ?? 0,
      isRetracted: data.is_retracted ?? false,
    };
  } catch {
    return null;
  }
}

// ── Quality score computation ─────────────────────────────────────────────────

function computeQualityScore(params: {
  citationCount: number;
  supportingCount: number;
  contrastingCount: number;
  influentialCount: number;
  isRetracted: boolean;
}): { score: number; label: "High" | "Moderate" | "Low" | "Unknown" } {
  if (params.isRetracted) {
    return { score: 0, label: "Low" };
  }

  if (params.citationCount === 0) {
    return { score: 35, label: "Unknown" };
  }

  let score = 0;

  // Base score from citation volume (log-scaled, max 40 points)
  const logCitations = Math.log10(Math.max(1, params.citationCount));
  score += Math.min(40, logCitations * 12);

  // Bonus for influential citations (max 30 points)
  const influentialRatio = params.influentialCount / Math.max(1, params.citationCount);
  score += Math.min(30, influentialRatio * 150);

  // Supporting citations bonus (max 20 points)
  const totalClassified = params.supportingCount + params.contrastingCount;
  if (totalClassified > 0) {
    const supportRatio = params.supportingCount / totalClassified;
    score += Math.min(20, supportRatio * 25);
  } else {
    score += 10; // unknown — neutral
  }

  // Contrasting penalty (up to -15 points)
  if (totalClassified > 3) {
    const contrastRatio = params.contrastingCount / totalClassified;
    score -= Math.min(15, contrastRatio * 30);
  }

  const finalScore = Math.round(Math.max(0, Math.min(100, score)));

  const label: "High" | "Moderate" | "Low" | "Unknown" =
    finalScore >= 65 ? "High" :
    finalScore >= 35 ? "Moderate" :
    finalScore >= 15 ? "Low" : "Unknown";

  return { score: finalScore, label };
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Fetch Scite-style smart citation quality for a paper.
 * Tries Semantic Scholar first (citation intents), falls back to OpenAlex counts.
 *
 * Results are cached for 24 hours to avoid hammering the free-tier APIs.
 */
export async function getSmartCitationQuality(
  paperId: string,
  doi?: string,
  knownCitationCount?: number
): Promise<CitationQuality> {
  const cacheKey = `scite:${paperId}:${doi ?? ""}`;

  return withCache(cacheKey, async () => {
    let citationCount = knownCitationCount ?? 0;
    let supporting = 0;
    let contrasting = 0;
    let mentioning = 0;
    let influential = 0;
    let isRetracted = false;
    let dataSource: CitationQuality["source"] = "estimated";
    let confidence: CitationQuality["confidence"] = "low";

    // 1. Try Semantic Scholar citation intents
    const s2Data = await fetchS2CitationData(paperId);
    if (s2Data) {
      supporting   = s2Data.supporting;
      contrasting  = s2Data.contrasting;
      mentioning   = s2Data.mentioning;
      influential  = s2Data.influential;
      const s2Total = supporting + contrasting + mentioning;
      if (s2Total > citationCount) citationCount = s2Total;
      dataSource  = "semantic-scholar";
      confidence  = s2Total >= 5 ? "high" : s2Total >= 1 ? "medium" : "low";
    }

    // 2. Augment with OpenAlex if we have a DOI
    if (doi) {
      const oaData = await fetchOpenAlexCitationCount(doi);
      if (oaData) {
        if (oaData.citedByCount > citationCount) citationCount = oaData.citedByCount;
        isRetracted = oaData.isRetracted;
        if (dataSource === "estimated") {
          dataSource = "openalex";
          confidence = "medium";
        }
      }
    }

    const { score, label } = computeQualityScore({
      citationCount,
      supportingCount: supporting,
      contrastingCount: contrasting,
      influentialCount: influential,
      isRetracted,
    });

    return {
      paperId,
      citationCount,
      supportingCount: supporting,
      contrastingCount: contrasting,
      mentioningCount: mentioning,
      influentialCitationCount: influential,
      isInfluential: influential > 0,
      qualityScore: score,
      qualityLabel: label,
      confidence,
      source: dataSource,
    };
  }, 86_400_000); // 24-hour cache
}

/**
 * Batch-fetch citation quality for multiple papers.
 * Runs in parallel with a concurrency cap of 4 to respect API rate limits.
 */
export async function batchSmartCitationQuality(
  papers: Array<{ paperId: string; doi?: string; citationCount?: number }>
): Promise<Map<string, CitationQuality>> {
  const results = new Map<string, CitationQuality>();
  const CONCURRENCY = 4;

  for (let i = 0; i < papers.length; i += CONCURRENCY) {
    const batch = papers.slice(i, i + CONCURRENCY);
    const resolved = await Promise.allSettled(
      batch.map(p => getSmartCitationQuality(p.paperId, p.doi, p.citationCount))
    );
    for (let j = 0; j < batch.length; j++) {
      const r = resolved[j];
      if (r.status === "fulfilled") {
        results.set(batch[j].paperId, r.value);
      }
    }
  }

  return results;
}

/**
 * Format a citation quality badge for display in papers.
 * e.g. "★ High (142 citations, 38 supporting)"
 */
export function formatCitationQualityBadge(q: CitationQuality): string {
  const star = q.qualityLabel === "High" ? "★" : q.qualityLabel === "Moderate" ? "◆" : "○";
  const parts: string[] = [`${q.citationCount} citations`];
  if (q.supportingCount > 0) parts.push(`${q.supportingCount} supporting`);
  if (q.contrastingCount > 0) parts.push(`${q.contrastingCount} contrasting`);
  if (q.influentialCitationCount > 0) parts.push(`${q.influentialCitationCount} highly influential`);
  return `${star} ${q.qualityLabel} (${parts.join(", ")})`;
}
