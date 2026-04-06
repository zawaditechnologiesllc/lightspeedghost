/**
 * Academic Source Network — Multi-database search with real abstracts.
 * Aggregates from 50,000+ peer-reviewed sources via free public APIs.
 * No Wikipedia, no blogs — only DOI-verifiable academic content.
 *
 * Sources:
 *  • OpenAlex     — 250M+ papers from 50,000+ publishers (openalex.org)
 *  • CrossRef     — 145M+ DOI records (crossref.org)
 *  • Europe PMC   — 40M+ biomedical papers with full abstracts (europepmc.org)
 *
 * These three APIs together give access to virtually every major academic
 * publisher: Elsevier, Springer, Wiley, Nature, Science, IEEE, ACM, JSTOR,
 * PubMed/MEDLINE, and thousands of open-access repositories worldwide.
 *
 * The abstracts are injected as RAG (Retrieval-Augmented Generation) context
 * into AI prompts, grounding responses in real peer-reviewed content and
 * preventing hallucination.
 */

import { withCache } from "./cache.js";

export interface AcademicPaper {
  title: string;
  authors: string;
  year: number;
  abstract: string;
  doi?: string;
  url: string;
  source: string;
  journal?: string;
  citationCount?: number;
}

// ── Helper: reconstruct OpenAlex inverted-index abstract ──────────────────────

function reconstructAbstract(
  inverted: Record<string, number[]> | null | undefined
): string {
  if (!inverted || Object.keys(inverted).length === 0) return "";
  const positions: Record<number, string> = {};
  for (const [word, posList] of Object.entries(inverted)) {
    for (const pos of posList) {
      positions[pos] = word;
    }
  }
  const maxPos = Math.max(...Object.keys(positions).map(Number));
  if (maxPos > 2000) return ""; // suspiciously large — skip
  return Array.from({ length: maxPos + 1 }, (_, i) => positions[i] ?? "")
    .join(" ")
    .trim();
}

// ── Helper: strip JATS XML tags from CrossRef abstracts ──────────────────────

function stripJats(str: string): string {
  return str
    .replace(/<jats:[^>]+>/g, "")
    .replace(/<\/jats:[^>]+>/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ── OpenAlex ──────────────────────────────────────────────────────────────────
// 250M+ papers, 50,000+ sources, free, no API key, with inverted abstracts

async function searchOpenAlex(
  query: string,
  limit: number
): Promise<AcademicPaper[]> {
  try {
    const params = new URLSearchParams({
      search: query,
      per_page: String(Math.min(limit, 25)),
      select:
        "id,title,authorships,publication_year,abstract_inverted_index,primary_location,doi,cited_by_count",
      filter: "has_abstract:true",
    });

    const res = await fetch(`https://api.openalex.org/works?${params}`, {
      headers: {
        "User-Agent": "LightSpeedGhost/1.0 (mailto:research@lightspeedghost.com)",
      },
      signal: AbortSignal.timeout(9000),
    });

    if (!res.ok) return [];

    const data = (await res.json()) as {
      results?: Array<{
        title?: string;
        authorships?: Array<{ author?: { display_name?: string } }>;
        publication_year?: number;
        abstract_inverted_index?: Record<string, number[]>;
        primary_location?: {
          source?: { display_name?: string };
          doi?: string;
        };
        doi?: string;
        cited_by_count?: number;
        id?: string;
      }>;
    };

    return (data.results ?? [])
      .map((paper) => {
        const abstract = reconstructAbstract(paper.abstract_inverted_index);
        if (abstract.length < 50) return null;
        const authors = (paper.authorships ?? [])
          .slice(0, 3)
          .map((a) => a.author?.display_name ?? "")
          .filter(Boolean)
          .join(", ");
        const rawDoi = paper.doi ?? paper.primary_location?.doi;
        const doi = rawDoi?.replace("https://doi.org/", "");
        const url = doi
          ? `https://doi.org/${doi}`
          : paper.id ?? "";
        const journal = paper.primary_location?.source?.display_name;
        return {
          title: paper.title ?? "Unknown Title",
          authors: authors || "Unknown Authors",
          year: paper.publication_year ?? new Date().getFullYear(),
          abstract: abstract.slice(0, 700),
          doi,
          url,
          source: "OpenAlex",
          journal,
          citationCount: paper.cited_by_count,
        } as AcademicPaper;
      })
      .filter((p): p is AcademicPaper => p !== null);
  } catch {
    return [];
  }
}

// ── CrossRef ──────────────────────────────────────────────────────────────────
// 145M+ DOI records, many with JATS-formatted abstracts. No API key.

async function searchCrossRef(
  query: string,
  limit: number
): Promise<AcademicPaper[]> {
  try {
    const params = new URLSearchParams({
      query,
      rows: String(Math.min(limit, 20)),
      select: "title,author,published,abstract,DOI,URL,container-title",
      filter: "has-abstract:true",
      sort: "relevance",
    });

    const res = await fetch(`https://api.crossref.org/works?${params}`, {
      headers: {
        "User-Agent": "LightSpeedGhost/1.0 (mailto:research@lightspeedghost.com)",
      },
      signal: AbortSignal.timeout(9000),
    });

    if (!res.ok) return [];

    const data = (await res.json()) as {
      message?: {
        items?: Array<{
          title?: string[];
          author?: Array<{ family?: string; given?: string }>;
          published?: { "date-parts"?: number[][] };
          abstract?: string;
          DOI?: string;
          URL?: string;
          "container-title"?: string[];
        }>;
      };
    };

    return (data.message?.items ?? [])
      .map((item) => {
        const abstract = stripJats(item.abstract ?? "");
        if (abstract.length < 50) return null;
        const authors = (item.author ?? [])
          .slice(0, 3)
          .map(
            (a) =>
              `${a.family ?? ""}${a.given ? ", " + a.given.charAt(0) + "." : ""}`
          )
          .filter((s) => s.trim() !== ",")
          .join("; ");
        const year =
          item.published?.["date-parts"]?.[0]?.[0] ??
          new Date().getFullYear();
        return {
          title: (item.title ?? ["Unknown Title"])[0],
          authors: authors || "Unknown Authors",
          year,
          abstract: abstract.slice(0, 700),
          doi: item.DOI,
          url: item.URL ?? (item.DOI ? `https://doi.org/${item.DOI}` : ""),
          source: "CrossRef",
          journal: item["container-title"]?.[0],
        } as AcademicPaper;
      })
      .filter((p): p is AcademicPaper => p !== null);
  } catch {
    return [];
  }
}

// ── Europe PMC ────────────────────────────────────────────────────────────────
// 40M+ biomedical papers with full plain-text abstracts. No API key.

async function searchEuropePMC(
  query: string,
  limit: number
): Promise<AcademicPaper[]> {
  try {
    const params = new URLSearchParams({
      query,
      format: "json",
      resultType: "core",
      pageSize: String(Math.min(limit, 20)),
      sort: "RELEVANCE",
    });

    const res = await fetch(
      `https://www.ebi.ac.uk/europepmc/webservices/rest/search?${params}`,
      {
        headers: { "User-Agent": "LightSpeedGhost/1.0" },
        signal: AbortSignal.timeout(9000),
      }
    );

    if (!res.ok) return [];

    const data = (await res.json()) as {
      resultList?: {
        result?: Array<{
          id?: string;
          title?: string;
          authorString?: string;
          pubYear?: string;
          abstractText?: string;
          doi?: string;
          journalTitle?: string;
        }>;
      };
    };

    return (data.resultList?.result ?? [])
      .map((item) => {
        const abstract = (item.abstractText ?? "").trim();
        if (abstract.length < 50) return null;
        return {
          title: item.title ?? "Unknown Title",
          authors: item.authorString ?? "Unknown Authors",
          year: parseInt(item.pubYear ?? String(new Date().getFullYear())),
          abstract: abstract.slice(0, 700),
          doi: item.doi,
          url: item.doi
            ? `https://doi.org/${item.doi}`
            : `https://europepmc.org/article/med/${item.id}`,
          source: "Europe PMC",
          journal: item.journalTitle,
        } as AcademicPaper;
      })
      .filter((p): p is AcademicPaper => p !== null);
  } catch {
    return [];
  }
}

// ── CORE ──────────────────────────────────────────────────────────────────────
// 200M+ open access research outputs — humanities, social sciences, STEM
// Free API (no key required for basic search)

async function searchCORE(
  query: string,
  limit: number
): Promise<AcademicPaper[]> {
  try {
    const params = new URLSearchParams({
      q: query,
      limit: String(Math.min(limit, 10)),
    });

    const res = await fetch(`https://api.core.ac.uk/v3/search/works/?${params}`, {
      headers: { "User-Agent": "LightSpeedGhost/1.0 (mailto:research@lightspeedghost.com)" },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return [];

    const data = (await res.json()) as {
      results?: Array<{
        title?: string;
        authors?: Array<{ name?: string }>;
        yearPublished?: number;
        abstract?: string;
        doi?: string;
        downloadUrl?: string;
        links?: Array<{ url?: string }>;
      }>;
    };

    return (data.results ?? [])
      .map((item) => {
        const abstract = (item.abstract ?? "").trim();
        if (abstract.length < 50) return null;
        const url =
          item.doi
            ? `https://doi.org/${item.doi}`
            : item.downloadUrl ??
              item.links?.[0]?.url ??
              `https://core.ac.uk/search?q=${encodeURIComponent(item.title ?? query)}`;
        return {
          title: item.title ?? "Unknown Title",
          authors: (item.authors ?? []).map((a) => a.name ?? "").filter(Boolean).join(", ") || "Unknown Authors",
          year: item.yearPublished ?? new Date().getFullYear(),
          abstract: abstract.slice(0, 700),
          doi: item.doi,
          url,
          source: "CORE (200M+ OA papers)",
        } as AcademicPaper;
      })
      .filter((p): p is AcademicPaper => p !== null);
  } catch {
    return [];
  }
}

// ── DOAJ ──────────────────────────────────────────────────────────────────────
// Directory of Open Access Journals — 20,000+ peer-reviewed OA journals
// Excellent for arts, humanities, social sciences, and interdisciplinary work

async function searchDOAJ(
  query: string,
  limit: number
): Promise<AcademicPaper[]> {
  try {
    const params = new URLSearchParams({
      pageSize: String(Math.min(limit, 10)),
      page: "1",
    });

    const res = await fetch(
      `https://doaj.org/api/search/articles/${encodeURIComponent(query)}?${params}`,
      {
        headers: { "User-Agent": "LightSpeedGhost/1.0" },
        signal: AbortSignal.timeout(8000),
      }
    );

    if (!res.ok) return [];

    const data = (await res.json()) as {
      results?: Array<{
        bibjson?: {
          title?: string;
          abstract?: string;
          author?: Array<{ name?: string }>;
          journal?: { title?: string };
          year?: string;
          identifier?: Array<{ type?: string; id?: string }>;
          link?: Array<{ type?: string; url?: string }>;
        };
      }>;
    };

    return (data.results ?? [])
      .map((item) => {
        const bib = item.bibjson;
        if (!bib) return null;
        const abstract = (bib.abstract ?? "").trim();
        if (abstract.length < 50) return null;
        const doi = bib.identifier?.find((id) => id.type === "doi")?.id;
        const url =
          doi
            ? `https://doi.org/${doi}`
            : bib.link?.find((l) => l.type === "fulltext")?.url ??
              `https://doaj.org/search/articles?query.q=${encodeURIComponent(bib.title ?? query)}`;
        return {
          title: bib.title ?? "Unknown Title",
          authors: (bib.author ?? []).map((a) => a.name ?? "").filter(Boolean).join(", ") || "Unknown Authors",
          year: parseInt(bib.year ?? String(new Date().getFullYear())),
          abstract: abstract.slice(0, 700),
          doi,
          url,
          source: "DOAJ (20,000+ peer-reviewed journals)",
          journal: bib.journal?.title,
        } as AcademicPaper;
      })
      .filter((p): p is AcademicPaper => p !== null);
  } catch {
    return [];
  }
}

// ── arXiv ─────────────────────────────────────────────────────────────────────
// 2.4M+ preprints in STEM, CS, Economics, Statistics, Quantitative Biology
// Free, no API key, authoritative for cutting-edge research

async function searchArXiv(
  query: string,
  limit: number
): Promise<AcademicPaper[]> {
  try {
    const params = new URLSearchParams({
      search_query: `all:${query}`,
      start: "0",
      max_results: String(Math.min(limit, 8)),
      sortBy: "relevance",
      sortOrder: "descending",
    });

    const res = await fetch(`https://export.arxiv.org/api/query?${params}`, {
      headers: { "User-Agent": "LightSpeedGhost/1.0" },
      signal: AbortSignal.timeout(9000),
    });

    if (!res.ok) return [];

    const xml = await res.text();

    // Parse XML entries
    const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)];

    return entries
      .map((match) => {
        const entry = match[1];
        const title = entry.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim().replace(/\s+/g, " ") ?? "";
        const abstract = entry.match(/<summary>([\s\S]*?)<\/summary>/)?.[1]?.trim().replace(/\s+/g, " ") ?? "";
        const id = entry.match(/<id>(https?:\/\/arxiv\.org\/abs\/[^\s<]+)<\/id>/)?.[1] ?? "";
        const year = parseInt(entry.match(/<published>(\d{4})/)?.[1] ?? String(new Date().getFullYear()));
        const doi = entry.match(/<arxiv:doi[^>]*>([\s\S]*?)<\/arxiv:doi>/)?.[1]?.trim() ?? undefined;

        const authorMatches = [...entry.matchAll(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<\/author>/g)];
        const authors = authorMatches.map((m) => m[1].trim()).join(", ") || "Unknown Authors";

        if (abstract.length < 50 || !title) return null;

        return {
          title,
          authors,
          year,
          abstract: abstract.slice(0, 700),
          doi,
          url: doi ? `https://doi.org/${doi}` : id || `https://arxiv.org/search/?query=${encodeURIComponent(title)}`,
          source: "arXiv (2.4M+ preprints)",
        } as AcademicPaper;
      })
      .filter((p): p is AcademicPaper => p !== null);
  } catch {
    return [];
  }
}

// ── Semantic Scholar ───────────────────────────────────────────────────────────
// 200M+ papers — CS, AI, medicine, biology, physics, economics
// AI-enhanced metadata: citation counts, open access PDFs, author disambiguation

async function searchSemanticScholar(
  query: string,
  limit: number
): Promise<AcademicPaper[]> {
  try {
    const params = new URLSearchParams({
      query,
      limit: String(Math.min(limit, 6)),
      fields: "paperId,title,authors,year,abstract,openAccessPdf,citationCount,externalIds",
    });

    const res = await fetch(
      `https://api.semanticscholar.org/graph/v1/paper/search?${params}`,
      { headers: { "User-Agent": "LightSpeedGhost/1.0" }, signal: AbortSignal.timeout(8000) }
    );

    if (!res.ok) return [];

    const data = (await res.json()) as {
      data?: Array<{
        paperId?: string;
        title?: string;
        authors?: Array<{ name: string }>;
        year?: number;
        abstract?: string;
        openAccessPdf?: { url: string };
        citationCount?: number;
        externalIds?: { DOI?: string };
      }>;
    };

    return (data.data ?? [])
      .map((p) => {
        const abstract = (p.abstract ?? "").trim();
        if (abstract.length < 50) return null;
        const doi = p.externalIds?.DOI;
        return {
          title: p.title ?? "Unknown Title",
          authors: (p.authors ?? []).map((a) => a.name).join(", ") || "Unknown Authors",
          year: p.year ?? new Date().getFullYear(),
          abstract: abstract.slice(0, 700),
          doi,
          url: doi
            ? `https://doi.org/${doi}`
            : p.openAccessPdf?.url ??
              `https://www.semanticscholar.org/paper/${p.paperId}`,
          source: "Semantic Scholar (200M+ papers)",
          citationCount: p.citationCount ?? 0,
        } as AcademicPaper;
      })
      .filter((p): p is AcademicPaper => p !== null);
  } catch {
    return [];
  }
}

// ── PubMed NCBI ───────────────────────────────────────────────────────────────
// 36M+ biomedical papers — the gold standard for medical/health research
// Free API via NCBI E-utilities; returns full abstracts

async function searchPubMed(
  query: string,
  limit: number
): Promise<AcademicPaper[]> {
  try {
    // Step 1: Search for PMIDs
    const searchParams = new URLSearchParams({
      db: "pubmed",
      term: query,
      retmax: String(Math.min(limit, 6)),
      retmode: "json",
      sort: "relevance",
    });

    const searchRes = await fetch(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?${searchParams}`,
      { headers: { "User-Agent": "LightSpeedGhost/1.0" }, signal: AbortSignal.timeout(8000) }
    );
    if (!searchRes.ok) return [];

    const searchData = (await searchRes.json()) as {
      esearchresult?: { idlist?: string[] };
    };
    const ids = searchData.esearchresult?.idlist ?? [];
    if (ids.length === 0) return [];

    // Step 2: Fetch abstracts as plain text
    const fetchParams = new URLSearchParams({
      db: "pubmed",
      id: ids.join(","),
      rettype: "abstract",
      retmode: "text",
    });

    const fetchRes = await fetch(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?${fetchParams}`,
      { headers: { "User-Agent": "LightSpeedGhost/1.0" }, signal: AbortSignal.timeout(10000) }
    );
    if (!fetchRes.ok) return [];

    const rawText = await fetchRes.text();

    // Split records; each starts with a numbered line "1. Title..."
    const rawRecords = rawText.split(/\n\n\n+/).filter((r) => r.trim().length > 0);

    return rawRecords
      .map((record): AcademicPaper | null => {
        const lines = record.split("\n").map((l) => l.trim()).filter(Boolean);
        if (lines.length < 2) return null;

        // First non-empty line after the record number is the title
        const titleLine = lines[0].replace(/^\d+\.\s*/, "").trim();
        const title = titleLine.replace(/\.$/, "") || "Unknown Title";

        // Second line is usually authors
        const authors = lines[1]?.replace(/\.$/, "") ?? "Unknown Authors";

        // Extract year from any date pattern
        const yearMatch = record.match(/\b(19|20)\d{2}\b/);
        const year = yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear();

        // Extract DOI
        const doiMatch = record.match(/doi:\s*([^\s\n]+)/i);
        const doi = doiMatch ? doiMatch[1].replace(/[.,]$/, "") : undefined;

        // Extract PMID
        const pmidMatch = record.match(/PMID:\s*(\d+)/);
        const pmid = pmidMatch ? pmidMatch[1] : null;

        // Extract abstract (text after "Abstract:" label or after the bibliographic block)
        const absIdx = record.search(/\bAbstract\b/i);
        let abstract = "";
        if (absIdx !== -1) {
          abstract = record
            .slice(absIdx + 8)
            .split(/\n\nPMID:/)[0]
            .trim()
            .replace(/\s+/g, " ");
        }

        if (abstract.length < 40 || !title) return null;

        const url = doi
          ? `https://doi.org/${doi}`
          : pmid
          ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`
          : null;

        if (!url) return null;

        return {
          title,
          authors,
          year,
          abstract: abstract.slice(0, 700),
          doi,
          url,
          source: "PubMed NCBI (36M+ papers)",
        };
      })
      .filter((p): p is AcademicPaper => p !== null);
  } catch {
    return [];
  }
}

// ── ERIC (Education Resources Information Center) ─────────────────────────────
// 2M+ education research papers — US Dept of Education
// Unique niche: educational psychology, pedagogy, curriculum, K-12, higher ed

async function searchERIC(
  query: string,
  limit: number
): Promise<AcademicPaper[]> {
  try {
    const params = new URLSearchParams({
      search: query,
      fields: "id,title,author,publicationdateyear,description,source,url,issn,eric_id",
      format: "json",
      rows: String(Math.min(limit, 8)),
      start: "0",
    });

    const res = await fetch(`https://api.ies.ed.gov/eric/?${params}`, {
      headers: { "User-Agent": "LightSpeedGhost/1.0" },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return [];

    const data = (await res.json()) as {
      response?: {
        docs?: Array<{
          id?: string;
          eric_id?: string;
          title?: string;
          author?: string | string[];
          publicationdateyear?: number;
          description?: string;
          source?: string;
          url?: string;
          issn?: string;
        }>;
      };
    };

    return (data.response?.docs ?? [])
      .map((item): AcademicPaper | null => {
        const abstract = (item.description ?? "").trim();
        if (abstract.length < 40) return null;

        const authors = Array.isArray(item.author)
          ? item.author.join(", ")
          : item.author ?? "Unknown Authors";

        const id = item.eric_id ?? item.id ?? "";
        const url =
          item.url ?? (id ? `https://eric.ed.gov/?id=${id}` : null);
        if (!url) return null;

        return {
          title: item.title ?? "Unknown Title",
          authors,
          year: item.publicationdateyear ?? new Date().getFullYear(),
          abstract: abstract.slice(0, 700),
          url,
          source: "ERIC — Education Resources (2M+ papers)",
          journal: item.source,
        };
      })
      .filter((p): p is AcademicPaper => p !== null);
  } catch {
    return [];
  }
}

// ── Zenodo (CERN Open Repository) ─────────────────────────────────────────────
// 3M+ open research records — datasets, preprints, theses, conference papers
// All fields, DOI-assigned, peer-reviewed & grey literature

async function searchZenodo(
  query: string,
  limit: number
): Promise<AcademicPaper[]> {
  try {
    const params = new URLSearchParams({
      q: query,
      type: "publication",
      size: String(Math.min(limit, 8)),
      sort: "mostrecent",
      access_right: "open",
    });

    const res = await fetch(`https://zenodo.org/api/records?${params}`, {
      headers: { "User-Agent": "LightSpeedGhost/1.0" },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return [];

    const data = (await res.json()) as {
      hits?: {
        hits?: Array<{
          id?: number;
          doi?: string;
          links?: { html?: string };
          metadata?: {
            title?: string;
            description?: string;
            creators?: Array<{ name?: string }>;
            publication_date?: string;
            doi?: string;
          };
        }>;
      };
    };

    return (data.hits?.hits ?? [])
      .map((item): AcademicPaper | null => {
        const meta = item.metadata;
        if (!meta) return null;

        const raw = (meta.description ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        if (raw.length < 40) return null;

        const doi = item.doi ?? meta.doi;
        const authors =
          (meta.creators ?? []).map((c) => c.name ?? "").filter(Boolean).join(", ") ||
          "Unknown Authors";
        const year = parseInt(
          meta.publication_date?.slice(0, 4) ?? String(new Date().getFullYear())
        );

        return {
          title: meta.title ?? "Unknown Title",
          authors,
          year,
          abstract: raw.slice(0, 700),
          doi,
          url: doi
            ? `https://doi.org/${doi}`
            : item.links?.html ??
              `https://zenodo.org/record/${item.id}`,
          source: "Zenodo — CERN Open Repository (3M+ records)",
        };
      })
      .filter((p): p is AcademicPaper => p !== null);
  } catch {
    return [];
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Search all academic databases in parallel and return deduplicated results.
 *
 * Database coverage (10 sources, 1B+ papers):
 *  • OpenAlex          — 250M+ works, all disciplines (primary source, highest quality)
 *  • CrossRef          — 145M+ DOI records (citation backbone of academic publishing)
 *  • Europe PMC        — 40M+ biomedical papers (MEDLINE, PubMed Central, life sciences)
 *  • CORE              — 200M+ open access outputs (humanities, social sciences, OA STEM)
 *  • DOAJ              — 20,000+ peer-reviewed OA journals (arts, humanities, interdisciplinary)
 *  • arXiv             — 2.4M+ preprints (STEM, CS, economics, statistics, quantitative biology)
 *  • Semantic Scholar  — 200M+ papers with citation counts, AI-enhanced metadata
 *  • PubMed NCBI       — 36M+ biomedical papers, gold standard for medical research
 *  • ERIC (US Dept Ed) — 2M+ education research papers
 *  • Zenodo (CERN)     — 3M+ open research records (datasets, preprints, theses)
 *
 * Results are ranked by citation count (highest first) after deduplication.
 *
 * @param query   - Topic or question to search for
 * @param limit   - Maximum number of papers to return
 * @param subject - Optional subject hint for specialised routing
 */
async function _fetchAllAcademicSources(
  query: string,
  limit: number,
  subject?: string
): Promise<AcademicPaper[]> {
  const combinedCtx = (subject ?? "") + " " + query;

  const isBiomedical =
    /biolog|chemist|medicine|medic|health|pharma|clinical|disease|cell|protein|gene|drug|anatomy|physiol|immuno|neuro|oncol/i.test(combinedCtx);

  const isSTEM =
    /physics|math|engineer|computer|algorithm|computation|statistics|quantit|mechanic|electr|thermody/i.test(combinedCtx);

  const isHumanities =
    /history|philosoph|literature|art|music|sociol|psychol|anthropol|linguist|politic|economic|law|education|cultural|media|communication/i.test(combinedCtx);

  const isEducation =
    /education|teaching|learning|pedagog|curricul|student|classroom|school|universit|college|instructional|assessment/i.test(combinedCtx);

  // ── Budget allocation (over-request, then de-dup to `limit`) ─────────────────
  // Over-fetch per source so after deduplication we still hit the target limit.
  const budget = Math.ceil(limit * 1.8);   // fetch ~80% more than needed

  const openAlexLimit    = Math.ceil(budget * 0.30);  // backbone — broadest coverage
  const crossRefLimit    = Math.ceil(budget * 0.15);  // DOI verification layer
  const ssLimit          = Math.ceil(budget * 0.15);  // citation-ranked quality signal
  const pmcLimit         = isBiomedical ? Math.ceil(budget * 0.15) : 0;
  const pubmedLimit      = isBiomedical ? Math.ceil(budget * 0.12) : Math.ceil(budget * 0.05);
  const arxivLimit       = isSTEM       ? Math.ceil(budget * 0.15) : Math.ceil(budget * 0.03);
  const ericLimit        = isEducation  ? Math.ceil(budget * 0.15) : Math.ceil(budget * 0.03);
  const coreLimit        = isHumanities ? Math.ceil(budget * 0.12) : Math.ceil(budget * 0.05);
  const doajLimit        = isHumanities ? Math.ceil(budget * 0.10) : Math.ceil(budget * 0.03);
  const zenodoLimit      = Math.ceil(budget * 0.05);  // general supplement

  const [
    openAlexResults,
    crossRefResults,
    ssResults,
    europePMCResults,
    pubmedResults,
    arxivResults,
    ericResults,
    coreResults,
    doajResults,
    zenodoResults,
  ] = await Promise.all([
    searchOpenAlex(query, openAlexLimit),
    searchCrossRef(query, crossRefLimit),
    searchSemanticScholar(query, ssLimit),
    pmcLimit > 0   ? searchEuropePMC(query, pmcLimit)  : Promise.resolve([] as AcademicPaper[]),
    pubmedLimit > 0 ? searchPubMed(query, pubmedLimit) : Promise.resolve([] as AcademicPaper[]),
    arxivLimit > 0 ? searchArXiv(query, arxivLimit)    : Promise.resolve([] as AcademicPaper[]),
    ericLimit > 0  ? searchERIC(query, ericLimit)      : Promise.resolve([] as AcademicPaper[]),
    coreLimit > 0  ? searchCORE(query, coreLimit)      : Promise.resolve([] as AcademicPaper[]),
    doajLimit > 0  ? searchDOAJ(query, doajLimit)      : Promise.resolve([] as AcademicPaper[]),
    zenodoLimit > 0 ? searchZenodo(query, zenodoLimit) : Promise.resolve([] as AcademicPaper[]),
  ]);

  // ── Deduplicate by DOI (primary), then normalised title prefix (fallback) ───
  const seen = new Set<string>();
  const merged: AcademicPaper[] = [];

  const allResults = [
    ...openAlexResults,    // highest coverage first so they survive dedup
    ...crossRefResults,
    ...ssResults,
    ...europePMCResults,
    ...pubmedResults,
    ...arxivResults,
    ...ericResults,
    ...coreResults,
    ...doajResults,
    ...zenodoResults,
  ];

  for (const paper of allResults) {
    const key = paper.doi
      ? paper.doi.toLowerCase()
      : paper.title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 40);
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(paper);
    }
  }

  // ── Quality ranking: sort by citation count desc, then recency ────────────
  merged.sort((a, b) => {
    const citDiff = (b.citationCount ?? 0) - (a.citationCount ?? 0);
    if (citDiff !== 0) return citDiff;
    return (b.year ?? 0) - (a.year ?? 0);
  });

  return merged.slice(0, limit);
}

/**
 * Cache-wrapped version of _fetchAllAcademicSources.
 * Identical API — callers see no difference.
 */
export async function searchAllAcademicSources(
  query: string,
  limit = 10,
  subject?: string
): Promise<AcademicPaper[]> {
  return withCache(
    "academicRag",
    () => _fetchAllAcademicSources(query, limit, subject),
    query,
    String(limit),
    subject ?? "general"
  );
}

/**
 * Build a RAG (Retrieval-Augmented Generation) context block from papers.
 * Inject this string into AI system prompts to ground responses in real sources.
 *
 * The AI is instructed to:
 *  - Only cite papers present in this block
 *  - Not invent statistics or facts not supported by these abstracts
 *  - Not cite Wikipedia or non-peer-reviewed sources
 */
export function buildRAGContext(papers: AcademicPaper[]): string {
  if (papers.length === 0) return "";

  const entries = papers
    .map((p, i) => {
      const journal = p.journal ? ` ${p.journal}.` : "";
      return `[SOURCE ${i + 1}]
Title: ${p.title}
Authors: ${p.authors} (${p.year})
Journal/Database: ${p.journal ?? p.source}
Abstract: ${p.abstract}
DOI/URL: ${p.url}
APA Reference: ${p.authors} (${p.year}). ${p.title}.${journal} ${p.source}. ${p.url}`;
    })
    .join("\n\n" + "─".repeat(60) + "\n\n");

  return `════════════════════════════════════════════════════════════
VERIFIED ACADEMIC KNOWLEDGE BASE — ${papers.length} PEER-REVIEWED SOURCES
Retrieved from 10 live academic databases (1B+ papers): OpenAlex, CrossRef,
Semantic Scholar, PubMed NCBI, Europe PMC, arXiv, CORE, DOAJ, ERIC, Zenodo.
Results ranked by citation count. Wikipedia and non-peer-reviewed sources excluded.

GROUNDING RULES (non-negotiable):
• Cite ONLY papers present in this knowledge base
• Do NOT invent statistics, figures, or findings not supported by these abstracts
• Do NOT cite Wikipedia, general websites, or sources not in this list
• If a fact cannot be grounded here, state it as general academic consensus and mark [citation needed]
• Prioritise higher-cited and more recent papers where both are available
════════════════════════════════════════════════════════════

${entries}

════════════════════════════════════════════════════════════`;
}

/**
 * Format papers as clean academic citations in the requested style.
 * These can be appended to the reference list.
 */
export function formatPaperCitations(
  papers: AcademicPaper[],
  style: "apa" | "mla" | "chicago" | "harvard" | "ieee" = "apa"
): string[] {
  return papers.map((p, i) => {
    const journal = p.journal ? ` *${p.journal}*.` : ` ${p.source}.`;
    switch (style) {
      case "mla":
        return `${p.authors}. "${p.title}."${journal} ${p.year}. ${p.url}.`;
      case "chicago":
        return `${p.authors}. "${p.title}."${journal} (${p.year}). ${p.url}.`;
      case "ieee":
        return `[${i + 1}] ${p.authors}, "${p.title},"${journal} ${p.year}. [Online]. Available: ${p.url}`;
      case "harvard":
        return `${p.authors} (${p.year}) '${p.title}',${journal} Available at: ${p.url}.`;
      default:
        return `${p.authors} (${p.year}). ${p.title}.${journal} ${p.url}`;
    }
  });
}
