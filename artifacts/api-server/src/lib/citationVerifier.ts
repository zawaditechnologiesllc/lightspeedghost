/**
 * Citation Verifier — AutoResearchClaw arXiv + Semantic Scholar pattern.
 * Prevents hallucinated references by fetching REAL papers from live APIs.
 * Implements VerifiedRegistry: only grounded, real citations appear in papers.
 */

import { withCache } from "./cache.js";

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

    const response = await fetch(
      `https://api.semanticscholar.org/graph/v1/paper/search?${params}`,
      {
        headers: { "User-Agent": "LightSpeedGhost/1.0 Academic Tool" },
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
      const ssCount = Math.ceil(count * 0.6);
      const arxivCount = Math.ceil(count * 0.4);

      const [ssCites, arxivCites] = await Promise.all([
        searchSemanticScholar(query, ssCount),
        searchArxiv(query, arxivCount),
      ]);

      const merged = [...ssCites, ...arxivCites].slice(0, count);

      return merged.map((c, i) => ({
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
