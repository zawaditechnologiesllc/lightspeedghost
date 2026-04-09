/**
 * Citation Verifier — multi-source grounded citation retrieval.
 * Prevents hallucinated references by fetching REAL papers from live APIs.
 * Implements VerifiedRegistry: only grounded, real citations appear in papers.
 *
 * Sources:
 *  • Semantic Scholar — 200M+ papers, citation-ranked (primary for most subjects)
 *  • OpenAlex        — 250M+ papers, DOI-verified, all disciplines (primary broad coverage)
 *  • arXiv           — 2.4M+ preprints (STEM supplement)
 *  • Europe PMC      — 40M+ biomedical papers (medical/life science supplement)
 *  • PubMed NCBI     — 36M+ biomedical papers (medical gold standard)
 *  • CrossRef        — 145M+ DOI records (fallback, all disciplines)
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

// ── OpenAlex — 250M+ papers, DOI-verified, all disciplines ───────────────────

async function searchOpenAlexCitations(
  query: string,
  limit: number
): Promise<VerifiedCitation[]> {
  try {
    const params = new URLSearchParams({
      search: query,
      per_page: String(Math.min(limit, 20)),
      select: "id,title,authorships,publication_year,doi,primary_location,cited_by_count",
      filter: "has_doi:true",
      sort: "cited_by_count:desc",
    });

    const res = await fetch(`https://api.openalex.org/works?${params}`, {
      headers: { "User-Agent": "LightSpeedGhost/1.0 (mailto:research@lightspeedghost.com)" },
      signal: AbortSignal.timeout(9000),
    });

    if (!res.ok) return [];

    const data = (await res.json()) as {
      results?: Array<{
        id?: string;
        title?: string;
        authorships?: Array<{ author?: { display_name?: string } }>;
        publication_year?: number;
        doi?: string;
        primary_location?: { source?: { display_name?: string } };
        cited_by_count?: number;
      }>;
    };

    return (data.results ?? [])
      .map((paper): VerifiedCitation | null => {
        if (!paper.doi || !paper.title) return null;
        const doi = paper.doi.replace("https://doi.org/", "");
        const authors = (paper.authorships ?? [])
          .slice(0, 3)
          .map((a) => a.author?.display_name ?? "")
          .filter(Boolean)
          .join(", ");
        const journal = paper.primary_location?.source?.display_name ?? "OpenAlex";
        return {
          id: `oa-${doi.replace(/\//g, "-")}`,
          title: paper.title,
          authors: authors || "Unknown Authors",
          year: paper.publication_year ?? new Date().getFullYear(),
          source: journal,
          url: `https://doi.org/${doi}`,
          doi,
          verified: true,
          formatted: "",
        };
      })
      .filter((c): c is VerifiedCitation => c !== null)
      .slice(0, limit);
  } catch {
    return [];
  }
}

// ── Europe PMC — 40M+ biomedical papers ──────────────────────────────────────

async function searchEuropePMCCitations(
  query: string,
  limit: number
): Promise<VerifiedCitation[]> {
  try {
    const params = new URLSearchParams({
      query,
      format: "json",
      resultType: "lite",
      pageSize: String(Math.min(limit, 15)),
      sort: "CITED desc",
    });

    const res = await fetch(
      `https://www.ebi.ac.uk/europepmc/webservices/rest/search?${params}`,
      { headers: { "User-Agent": "LightSpeedGhost/1.0" }, signal: AbortSignal.timeout(9000) }
    );

    if (!res.ok) return [];

    const data = (await res.json()) as {
      resultList?: {
        result?: Array<{
          id?: string;
          title?: string;
          authorString?: string;
          pubYear?: string;
          doi?: string;
          journalTitle?: string;
        }>;
      };
    };

    return (data.resultList?.result ?? [])
      .map((item): VerifiedCitation | null => {
        if (!item.title) return null;
        const doi = item.doi;
        const url = doi
          ? `https://doi.org/${doi}`
          : item.id ? `https://europepmc.org/article/med/${item.id}` : null;
        if (!url) return null;
        return {
          id: `epmc-${item.id ?? doi}`,
          title: item.title,
          authors: item.authorString ?? "Unknown Authors",
          year: parseInt(item.pubYear ?? String(new Date().getFullYear())),
          source: item.journalTitle ?? "Europe PMC",
          url,
          doi,
          verified: true,
          formatted: "",
        };
      })
      .filter((c): c is VerifiedCitation => c !== null)
      .slice(0, limit);
  } catch {
    return [];
  }
}

// ── PubMed NCBI — 36M+ biomedical papers (medical gold standard) ─────────────

async function searchPubMedCitations(
  query: string,
  limit: number
): Promise<VerifiedCitation[]> {
  try {
    const searchParams = new URLSearchParams({
      db: "pubmed",
      term: query,
      retmax: String(Math.min(limit, 10)),
      retmode: "json",
      sort: "relevance",
    });

    const searchRes = await fetch(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?${searchParams}`,
      { headers: { "User-Agent": "LightSpeedGhost/1.0" }, signal: AbortSignal.timeout(8000) }
    );
    if (!searchRes.ok) return [];

    const searchData = (await searchRes.json()) as { esearchresult?: { idlist?: string[] } };
    const ids = searchData.esearchresult?.idlist ?? [];
    if (ids.length === 0) return [];

    const summaryParams = new URLSearchParams({
      db: "pubmed",
      id: ids.join(","),
      retmode: "json",
    });

    const summaryRes = await fetch(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?${summaryParams}`,
      { headers: { "User-Agent": "LightSpeedGhost/1.0" }, signal: AbortSignal.timeout(9000) }
    );
    if (!summaryRes.ok) return [];

    const summaryData = (await summaryRes.json()) as {
      result?: Record<string, {
        title?: string;
        authors?: Array<{ name?: string }>;
        pubdate?: string;
        fulljournalname?: string;
        elocationid?: string;
      }>;
    };

    const result = summaryData.result ?? {};
    return ids
      .map((id): VerifiedCitation | null => {
        const paper = result[id];
        if (!paper?.title) return null;
        const authors = (paper.authors ?? []).slice(0, 3).map((a) => a.name ?? "").filter(Boolean).join(", ");
        const year = parseInt((paper.pubdate ?? "").slice(0, 4)) || new Date().getFullYear();
        const doi = paper.elocationid?.replace("doi: ", "");
        return {
          id: `pmid-${id}`,
          title: paper.title,
          authors: authors || "Unknown Authors",
          year,
          source: paper.fulljournalname ?? "PubMed",
          url: doi ? `https://doi.org/${doi}` : `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
          doi,
          verified: true,
          formatted: "",
        };
      })
      .filter((c): c is VerifiedCitation => c !== null);
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

      const isSTEM =
        /physics|math|engineer|comput|algorithm|statistic|mechanic|electr|thermody|chemi|quant|circuit|signal|neural|machine.?learn|data.?science/i.test(combined);

      const isBiomedical =
        /biolog|medicine|medic|health|pharma|clinical|disease|cell|protein|gene|drug|anatomy|physiol|immuno|neuro|oncol|psychiatr|epidemiol/i.test(combined);

      // ── Parallel fetch from all 6 sources with subject-aware allocation ──────
      const overFetch = Math.ceil(count * 1.6);   // over-fetch so dedup still hits `count`

      const ssCount      = Math.ceil(overFetch * 0.30);   // Semantic Scholar — always on
      const oaCount      = Math.ceil(overFetch * 0.30);   // OpenAlex — always on, best DOI coverage
      const arxivCount   = isSTEM       ? Math.ceil(overFetch * 0.20) : 0;
      const pmcCount     = isBiomedical ? Math.ceil(overFetch * 0.20) : 0;
      const pubmedCount  = isBiomedical ? Math.ceil(overFetch * 0.15) : 0;

      const [ssResults, oaResults, arxivResults, pmcResults, pubmedResults] = await Promise.all([
        searchSemanticScholar(query, ssCount),
        searchOpenAlexCitations(query, oaCount),
        arxivCount > 0  ? searchArxiv(query, arxivCount)              : Promise.resolve([] as VerifiedCitation[]),
        pmcCount > 0    ? searchEuropePMCCitations(query, pmcCount)   : Promise.resolve([] as VerifiedCitation[]),
        pubmedCount > 0 ? searchPubMedCitations(query, pubmedCount)   : Promise.resolve([] as VerifiedCitation[]),
      ]);

      // Merge with priority: SS (citation-ranked) → OA (DOI-verified) → arXiv/PMC/PubMed
      const flat = [...ssResults, ...oaResults, ...arxivResults, ...pmcResults, ...pubmedResults];

      // Deduplicate by DOI first, then normalised title prefix
      const seen = new Set<string>();
      const deduped: VerifiedCitation[] = [];
      for (const c of flat) {
        const key = c.doi ? c.doi.toLowerCase() : c.title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 40);
        if (!seen.has(key)) { seen.add(key); deduped.push(c); }
      }

      // CrossRef fallback if still short — broadest DOI-verified coverage
      if (deduped.length < count) {
        const needed = count - deduped.length + 3;
        const crResults = await searchCrossRefCitations(query, needed);
        for (const c of crResults) {
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
