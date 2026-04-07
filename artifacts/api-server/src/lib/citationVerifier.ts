/**
 * Citation Verifier — multi-source grounded citation retrieval.
 * Prevents hallucinated references by fetching REAL papers from live APIs.
 * Implements VerifiedRegistry: only grounded, real citations appear in papers.
 *
 * Sources: Semantic Scholar (primary), arXiv (STEM supplement), CrossRef (fallback)
 */

import { withCache } from "./cache.js";
import { ssRateLimit } from "./ssRateLimit.js";

export interface VerifiedCitation {
  id: string;
  title: string;
  authors: string;
  year: number;
  source: string;
  url: string;
  doi?: string;
  verified: boolean;
  formatted: string;
}

export async function searchSemanticScholar(
  query: string,
  limit = 4
): Promise<VerifiedCitation[]> {
  try {
    const params = new URLSearchParams({
      query,
      limit: String(limit),
      fields: "title,authors,year,externalIds,url,citationCount",
    });

    await ssRateLimit();

    const ssHeaders: Record<string, string> = { "User-Agent": "LightSpeedGhost/1.0 Academic Tool" };
    if (process.env.SEMANTIC_SCHOLAR_API_KEY) ssHeaders["x-api-key"] = process.env.SEMANTIC_SCHOLAR_API_KEY;

    const response = await fetch(
      `https://api.semanticscholar.org/graph/v1/paper/search?${params}`,
      {
        headers: ssHeaders,
        signal: AbortSignal.timeout(8000),
      }
    );

    if (!response.ok) return [];

    const data = (await response.json()) as {
      data: Array<{
        paperId: string;
        title?: string;
        authors?: Array<{ name: string }>;
        year?: number;
        externalIds?: { DOI?: string };
        url?: string;
      }>;
    };

    return (data.data ?? []).slice(0, limit).map((paper) => {
      const authors = (paper.authors ?? []).slice(0, 3).map((a) => a.name);
      const authorsStr =
        authors.join(", ") + ((paper.authors ?? []).length > 3 ? ", et al." : "");
      const doi = paper.externalIds?.DOI;
      const url = doi
        ? `https://doi.org/${doi}`
        : `https://www.semanticscholar.org/paper/${paper.paperId}`;
      const year = paper.year ?? new Date().getFullYear();
      return {
        id: `ss-${paper.paperId}`,
        title: paper.title ?? "Unknown Title",
        authors: authorsStr || "Unknown Authors",
        year,
        source: "Semantic Scholar",
        url,
        doi,
        verified: true,
        formatted: "",
      };
    });
  } catch {
    return [];
  }
}

export async function searchArxiv(
  query: string,
  limit = 3
): Promise<VerifiedCitation[]> {
  try {
    const params = new URLSearchParams({
      search_query: `all:${query}`,
      max_results: String(limit),
      sortBy: "relevance",
    });

    const response = await fetch(
      `https://export.arxiv.org/api/query?${params}`,
      {
        headers: { "User-Agent": "LightSpeedGhost/1.0 Academic Tool" },
        signal: AbortSignal.timeout(8000),
      }
    );

    if (!response.ok) return [];

    const xml = await response.text();
    const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)];
    const citations: VerifiedCitation[] = [];

    for (const entry of entries) {
      const content = entry[1];
      const title = content
        .match(/<title>([\s\S]*?)<\/title>/)?.[1]
        ?.trim()
        .replace(/\s+/g, " ") ?? "";
      const authorMatches = [...content.matchAll(/<author><name>(.*?)<\/name><\/author>/g)];
      const authors = authorMatches.map((m) => m[1]);
      const authorsStr =
        authors.slice(0, 3).join(", ") + (authors.length > 3 ? ", et al." : "");
      const published = content.match(/<published>(.*?)<\/published>/)?.[1] ?? "";
      const year = published ? new Date(published).getFullYear() : new Date().getFullYear();
      const rawId = content.match(/<id>(.*?)<\/id>/)?.[1]?.trim() ?? "";
      const url = rawId.replace("http://", "https://");
      const arxivId = rawId.replace(/^.*arxiv\.org\/abs\//, "");

      if (title && url) {
        citations.push({
          id: `arxiv-${arxivId}`,
          title,
          authors: authorsStr || "Unknown Authors",
          year,
          source: "arXiv",
          url,
          doi: `10.48550/arXiv.${arxivId}`,
          verified: true,
          formatted: "",
        });
      }
    }
    return citations.slice(0, limit);
  } catch {
    return [];
  }
}

// ── CrossRef fallback — DOI-verified citations, all disciplines ───────────────

async function searchCrossRefCitations(
  query: string,
  limit: number
): Promise<VerifiedCitation[]> {
  try {
    const params = new URLSearchParams({
      query,
      rows: String(Math.min(limit, 8)),
      select: "DOI,title,author,published,container-title",
      sort: "relevance",
      mailto: "research@lightspeedghost.com",
    });

    const response = await fetch(
      `https://api.crossref.org/works?${params}`,
      { headers: { "User-Agent": "LightSpeedGhost/1.0 (mailto:research@lightspeedghost.com)" }, signal: AbortSignal.timeout(8000) }
    );

    if (!response.ok) return [];

    const data = (await response.json()) as {
      message?: {
        items?: Array<{
          DOI?: string;
          title?: string[];
          author?: Array<{ given?: string; family?: string }>;
          published?: { "date-parts"?: number[][] };
          "container-title"?: string[];
        }>;
      };
    };

    return (data.message?.items ?? [])
      .map((item) => {
        const doi = item.DOI;
        const title = item.title?.[0] ?? "Unknown Title";
        const authors = (item.author ?? [])
          .slice(0, 3)
          .map((a) => [a.given, a.family].filter(Boolean).join(" "))
          .join(", ");
        const year = item.published?.["date-parts"]?.[0]?.[0] ?? new Date().getFullYear();
        const journal = item["container-title"]?.[0] ?? "CrossRef";
        if (!doi || title === "Unknown Title") return null;
        return {
          id: `cr-${doi.replace(/\//g, "-")}`,
          title,
          authors: authors || "Unknown Authors",
          year,
          source: journal,
          url: `https://doi.org/${doi}`,
          doi,
          verified: true,
          formatted: "",
        } as VerifiedCitation;
      })
      .filter((c): c is VerifiedCitation => c !== null)
      .slice(0, limit);
  } catch {
    return [];
  }
}

export async function getVerifiedCitations(
  topic: string,
  subject: string,
  count = 5,
  style: "apa" | "mla" | "chicago" | "harvard" | "ieee" = "apa"
): Promise<VerifiedCitation[]> {
  return withCache(
    "citations",
    async () => {
      const query = `${topic} ${subject}`;
      const combined = `${topic} ${subject}`.toLowerCase();

      // arXiv is a STEM preprint server — useless for humanities, law, business, etc.
      // Only use it when the subject is actually STEM-related.
      const isSTEM =
        /physics|math|engineer|comput|algorithm|statistic|mechanic|electr|thermody|chemi|biolog|quant|circuit|signal|neural|machine.?learn|data.?science/i.test(combined);

      const ssCount = isSTEM ? Math.ceil(count * 0.6) : count + 2;  // over-fetch SS for non-STEM
      const arxivCount = isSTEM ? Math.ceil(count * 0.4) : 0;

      const fetchTasks: Promise<VerifiedCitation[]>[] = [
        searchSemanticScholar(query, ssCount),
      ];
      if (arxivCount > 0) fetchTasks.push(searchArxiv(query, arxivCount));

      const results = await Promise.all(fetchTasks);
      const flat = results.flat();

      // Deduplicate by DOI, then normalised title
      const seen = new Set<string>();
      const deduped: VerifiedCitation[] = [];
      for (const c of flat) {
        const key = c.doi ? c.doi.toLowerCase() : c.title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 40);
        if (!seen.has(key)) { seen.add(key); deduped.push(c); }
      }

      // If primary sources returned too few results, fill from CrossRef
      if (deduped.length < count) {
        const needed = count - deduped.length + 2; // over-fetch
        const crossRefResults = await searchCrossRefCitations(query, needed);
        for (const c of crossRefResults) {
          const key = c.doi ? c.doi.toLowerCase() : c.title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 40);
          if (!seen.has(key)) { seen.add(key); deduped.push(c); }
        }
      }

      return deduped.slice(0, count).map((c, i) => ({
        ...c,
        formatted: formatCitation(c, style, i),
      }));
    },
    topic,
    subject,
    String(count),
    style
  );
}

function formatCitation(c: VerifiedCitation, style: string, idx: number): string {
  switch (style) {
    case "mla":
      return `${c.authors}. "${c.title}." ${c.source}, ${c.year}, ${c.url}.`;
    case "chicago":
      return `${c.authors}. "${c.title}." ${c.source} (${c.year}). ${c.url}.`;
    case "ieee":
      return `[${idx + 1}] ${c.authors}, "${c.title}," ${c.source}, ${c.year}. Available: ${c.url}`;
    case "harvard":
      return `${c.authors} (${c.year}) '${c.title}', ${c.source}. Available at: ${c.url}.`;
    default:
      return `${c.authors} (${c.year}). ${c.title}. ${c.source}. ${c.url}`;
  }
}
