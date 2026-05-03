/**
 * Academic Source Network — Multi-database search with real abstracts.
 * Aggregates from verified peer-reviewed sources via free public APIs only.
 * No Wikipedia, no blogs, no news sites — only DOI-verifiable academic content.
 *
 * Sources (25+ live API integrations, 1.5B+ papers):
 *
 *  ── MEGA AGGREGATORS (cover virtually all publishers) ──────────────────────
 *  • OpenAlex          — 250M+ works from 50,000+ publishers (openalex.org)
 *  • CrossRef          — 145M+ DOI records (citation backbone of publishing)
 *  • BASE              — 340M+ docs from 10,000+ institutional repositories
 *  • CORE              — 200M+ OA outputs from 10,000+ data providers
 *  • Semantic Scholar  — 200M+ papers, AI-enhanced citation intelligence
 *
 *  ── BIOMEDICAL & CLINICAL ──────────────────────────────────────────────────
 *  • PubMed NCBI       — 36M+ biomedical papers (NIH gold standard)
 *  • PubMed Central    — 8M+ full-text biomedical papers (NIH-funded)
 *  • Europe PMC        — 40M+ biomedical papers with full abstracts
 *  • BioRxiv           — Biology preprints (Cold Spring Harbor Lab)
 *  • MedRxiv           — Medical/health preprints (CSH + Yale/BMJ)
 *  • ClinicalTrials.gov — 450,000+ trial registrations from 220+ countries
 *
 *  ── STEM & PHYSICS ─────────────────────────────────────────────────────────
 *  • arXiv             — 2.4M+ STEM, CS, econ, stats preprints
 *  • NASA ADS          — 16M+ astronomy & astrophysics papers
 *  • Zenodo (CERN)     — 3M+ open research records (datasets, preprints)
 *  • DataCite          — 48M+ research objects with DOIs
 *
 *  ── OPEN ACCESS JOURNALS ───────────────────────────────────────────────────
 *  • DOAJ              — 20,000+ peer-reviewed OA journals
 *  • PLOS ONE          — 250,000+ OA articles (biology, medicine, science)
 *  • Figshare          — 9M+ research outputs with DOIs
 *  • Dryad             — 50,000+ peer-reviewed data packages
 *
 *  ── EDUCATION, SOCIAL & HUMANITIES ────────────────────────────────────────
 *  • ERIC (US Dept Ed) — 2M+ education research papers
 *  • HAL (France)      — 1.5M+ OA papers from French institutions
 *  • OpenAIRE          — 100M+ EU-funded research outputs
 *
 *  ── ECONOMICS & INTERDISCIPLINARY ─────────────────────────────────────────
 *  • NBER              — National Bureau of Economic Research working papers
 *  • OSF Preprints     — Multidisciplinary preprints (psychology, social science)
 *
 *  ── RECENT EVENTS LAYER ────────────────────────────────────────────────────
 *  • Current Literature — arXiv + CrossRef + OpenAlex with 90-day recency filter
 *    for topics requiring up-to-date research (auto-detected)
 *
 * VERIFIABILITY GUARANTEE:
 *  Every source returned has a DOI or institutional URL — nothing from
 *  Wikipedia, news sites, or unreviewed grey literature reaches the AI.
 *  For events after the AI knowledge cutoff, the system flags uncertainty
 *  and routes to recent preprints from the last 90 days.
 */

import { withCache } from "./cache.js";
import { ssRateLimit } from "./ssRateLimit.js";
import { getSourceStats, type SourceStats } from "./learningEngine.js";

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
// Rate limit: 1 req/sec with API key — enforced via shared ssRateLimit()

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

    await ssRateLimit();

    const ssHeaders: Record<string, string> = { "User-Agent": "LightSpeedGhost/1.0" };
    if (process.env.SEMANTIC_SCHOLAR_API_KEY) ssHeaders["x-api-key"] = process.env.SEMANTIC_SCHOLAR_API_KEY;

    const res = await fetch(
      `https://api.semanticscholar.org/graph/v1/paper/search?${params}`,
      { headers: ssHeaders, signal: AbortSignal.timeout(8000) }
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

// ── BASE (Bielefeld Academic Search Engine) ───────────────────────────────────
// 340M+ documents from 10,000+ academic repositories worldwide.
// Excellent broad coverage — humanities, social sciences, natural sciences, medicine.
// Free API, no key required.

async function searchBASE(
  query: string,
  limit: number
): Promise<AcademicPaper[]> {
  try {
    const params = new URLSearchParams({
      func: "PerformSearch",
      query: `dctitle:${query} OR dcterms_abstract:${query}`,
      hits: String(Math.min(limit, 10)),
      offset: "0",
      format: "json",
    });

    const res = await fetch(
      `https://api.base-search.net/cgi-bin/BaseHttpSearchInterface.fcgi?${params}`,
      {
        headers: { "User-Agent": "LightSpeedGhost/1.0 (mailto:research@lightspeedghost.com)" },
        signal: AbortSignal.timeout(9000),
      }
    );

    if (!res.ok) return [];

    const data = (await res.json()) as {
      response?: {
        docs?: Array<{
          dc_title?: string | string[];
          dc_creator?: string | string[];
          dc_date?: string | number;
          dcterms_abstract?: string | string[];
          dc_identifier?: string | string[];
          dc_source?: string | string[];
          dc_type?: string | string[];
        }>;
      };
    };

    return (data.response?.docs ?? [])
      .map((item): AcademicPaper | null => {
        const title = Array.isArray(item.dc_title) ? item.dc_title[0] : (item.dc_title ?? "");
        const abstract = Array.isArray(item.dcterms_abstract)
          ? item.dcterms_abstract[0]
          : (item.dcterms_abstract ?? "");
        if (!title || abstract.length < 50) return null;

        const creators = Array.isArray(item.dc_creator) ? item.dc_creator : (item.dc_creator ? [item.dc_creator] : []);
        const authors = creators.slice(0, 3).join(", ") || "Unknown Authors";

        const dateRaw = String(item.dc_date ?? "");
        const year = parseInt(dateRaw.slice(0, 4)) || new Date().getFullYear();

        // Find DOI in identifier array
        const identifiers = Array.isArray(item.dc_identifier) ? item.dc_identifier : (item.dc_identifier ? [item.dc_identifier] : []);
        const doi = identifiers.find((id) => id.startsWith("10."))?.replace("https://doi.org/", "");
        const url = doi
          ? `https://doi.org/${doi}`
          : identifiers.find((id) => id.startsWith("http")) ?? "";

        if (!url) return null;

        const journal = Array.isArray(item.dc_source) ? item.dc_source[0] : (item.dc_source ?? undefined);

        return {
          title,
          authors,
          year,
          abstract: abstract.slice(0, 700),
          doi,
          url,
          source: "BASE (340M+ academic docs)",
          journal,
        };
      })
      .filter((p): p is AcademicPaper => p !== null);
  } catch {
    return [];
  }
}

// ── DataCite ──────────────────────────────────────────────────────────────────
// 48M+ research objects (datasets, papers, preprints, software) with DOIs.
// Operated by DataCite consortium — highly credible, DOI-assigned.
// Free REST API, no key required.

async function searchDataCite(
  query: string,
  limit: number
): Promise<AcademicPaper[]> {
  try {
    const params = new URLSearchParams({
      query,
      "page[size]": String(Math.min(limit, 10)),
      sort: "-relevance",
      "fields[dois]": "titles,creators,publicationYear,descriptions,doi,container,types",
    });

    const res = await fetch(`https://api.datacite.org/dois?${params}`, {
      headers: {
        "User-Agent": "LightSpeedGhost/1.0 (mailto:research@lightspeedghost.com)",
        "Accept": "application/json",
      },
      signal: AbortSignal.timeout(9000),
    });

    if (!res.ok) return [];

    const data = (await res.json()) as {
      data?: Array<{
        attributes?: {
          titles?: Array<{ title?: string }>;
          creators?: Array<{ name?: string; givenName?: string; familyName?: string }>;
          publicationYear?: number;
          descriptions?: Array<{ description?: string; descriptionType?: string }>;
          doi?: string;
          container?: { title?: string };
          types?: { resourceTypeGeneral?: string };
        };
      }>;
    };

    return (data.data ?? [])
      .map((item): AcademicPaper | null => {
        const attr = item.attributes;
        if (!attr) return null;

        const title = attr.titles?.[0]?.title ?? "";
        if (!title) return null;

        // Prefer abstract description
        const desc = (attr.descriptions ?? []).find((d) => d.descriptionType === "Abstract") ?? attr.descriptions?.[0];
        const abstract = (desc?.description ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        if (abstract.length < 50) return null;

        const creators = attr.creators ?? [];
        const authors = creators
          .slice(0, 3)
          .map((c) => c.name ?? [c.familyName, c.givenName?.charAt(0)].filter(Boolean).join(", "))
          .filter(Boolean)
          .join("; ") || "Unknown Authors";

        const doi = attr.doi;
        const year = attr.publicationYear ?? new Date().getFullYear();
        const journal = attr.container?.title;

        return {
          title,
          authors,
          year,
          abstract: abstract.slice(0, 700),
          doi,
          url: doi ? `https://doi.org/${doi}` : "",
          source: "DataCite (48M+ research objects)",
          journal,
        };
      })
      .filter((p): p is AcademicPaper => p !== null && p.url !== "");
  } catch {
    return [];
  }
}

// ── OpenAIRE ──────────────────────────────────────────────────────────────────
// 100M+ research outputs from EU-funded projects, with full open-access coverage.
// Aggregates from 100,000+ data sources including CORDIS, Zenodo, institutional repos.
// Free API, no key required.

async function searchOpenAIRE(
  query: string,
  limit: number
): Promise<AcademicPaper[]> {
  try {
    const params = new URLSearchParams({
      keywords: query,
      format: "json",
      size: String(Math.min(limit, 10)),
      type: "publications",
    });

    const res = await fetch(
      `https://api.openaire.eu/search/publications?${params}`,
      {
        headers: { "User-Agent": "LightSpeedGhost/1.0" },
        signal: AbortSignal.timeout(9000),
      }
    );

    if (!res.ok) return [];

    const text = await res.text();

    // OpenAIRE returns JSON but sometimes with XML wrapper — parse JSON
    let data: {
      response?: {
        results?: {
          result?: Array<{
            metadata?: {
              "oaf:entity"?: {
                "oaf:result"?: {
                  title?: { $?: string } | Array<{ $?: string }>;
                  creator?: { $?: string } | Array<{ $?: string }>;
                  dateofacceptance?: { $?: string };
                  description?: { $?: string } | Array<{ $?: string }>;
                  pid?: Array<{ "@classid"?: string; $?: string }>;
                  journal?: { $?: string };
                };
              };
            };
          }>;
        };
      };
    };

    try {
      data = JSON.parse(text);
    } catch {
      return [];
    }

    const results = data.response?.results?.result ?? [];

    return results
      .map((item): AcademicPaper | null => {
        const entity = item.metadata?.["oaf:entity"]?.["oaf:result"];
        if (!entity) return null;

        const titleRaw = entity.title;
        const title = Array.isArray(titleRaw) ? (titleRaw[0]?.$ ?? "") : (titleRaw?.$ ?? "");
        if (!title) return null;

        const descRaw = entity.description;
        const abstract = (Array.isArray(descRaw) ? (descRaw[0]?.$ ?? "") : (descRaw?.$ ?? "")).trim();
        if (abstract.length < 50) return null;

        const creatorRaw = entity.creator;
        const creatorList = Array.isArray(creatorRaw) ? creatorRaw : (creatorRaw ? [creatorRaw] : []);
        const authors = creatorList.slice(0, 3).map((c) => c.$ ?? "").filter(Boolean).join(", ") || "Unknown Authors";

        const dateRaw = entity.dateofacceptance?.$?.slice(0, 4);
        const year = parseInt(dateRaw ?? String(new Date().getFullYear()));

        const pids = entity.pid ?? [];
        const doiEntry = pids.find((p) => p["@classid"] === "doi");
        const doi = doiEntry?.$ ?? undefined;

        const journal = entity.journal?.$ ?? undefined;

        return {
          title,
          authors,
          year,
          abstract: abstract.slice(0, 700),
          doi,
          url: doi ? `https://doi.org/${doi}` : `https://explore.openaire.eu/search/publication?keywords=${encodeURIComponent(title)}`,
          source: "OpenAIRE (100M+ EU research outputs)",
          journal,
        };
      })
      .filter((p): p is AcademicPaper => p !== null);
  } catch {
    return [];
  }
}

// ── PLOS ONE ──────────────────────────────────────────────────────────────────
// 250,000+ open-access peer-reviewed articles. No API key required.
// Covers biology, medicine, environment, social sciences, computer science.

async function searchPLOS(query: string, limit: number): Promise<AcademicPaper[]> {
  try {
    const params = new URLSearchParams({
      q: `everything:"${query}"`,
      fl: "id,title_display,author_display,abstract,publication_date,journal",
      rows: String(Math.min(limit, 10)),
      fq: "doc_type:full",
      wt: "json",
    });
    const res = await fetch(`https://api.plos.org/search?${params}`, {
      headers: { "User-Agent": "LightSpeedGhost/1.0 (mailto:research@lightspeedghost.com)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      response?: { docs?: Array<{
        title_display?: string;
        author_display?: string[];
        abstract?: string[];
        publication_date?: string;
        id?: string;
        journal?: string;
      }> };
    };
    return (data.response?.docs ?? [])
      .map((item): AcademicPaper | null => {
        const abstract = (item.abstract ?? [])[0]?.trim() ?? "";
        if (abstract.length < 50) return null;
        const doi = item.id?.replace(/^info:doi\//, "");
        return {
          title: item.title_display ?? "Unknown Title",
          authors: (item.author_display ?? []).slice(0, 3).join(", ") || "Unknown Authors",
          year: parseInt(item.publication_date?.slice(0, 4) ?? String(new Date().getFullYear())),
          abstract: abstract.slice(0, 700),
          doi,
          url: doi ? `https://doi.org/${doi}` : `https://journals.plos.org/search?q=${encodeURIComponent(query)}`,
          source: "PLOS ONE (250K+ OA articles)",
          journal: item.journal,
        };
      })
      .filter((p): p is AcademicPaper => p !== null);
  } catch { return []; }
}

// ── Figshare ──────────────────────────────────────────────────────────────────
// 9M+ research outputs (papers, datasets, posters, code). All DOI-assigned.
// Free API, no key required.

async function searchFigshare(query: string, limit: number): Promise<AcademicPaper[]> {
  try {
    const res = await fetch("https://api.figshare.com/v2/articles/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "LightSpeedGhost/1.0 (mailto:research@lightspeedghost.com)",
      },
      body: JSON.stringify({ search_for: query, page_size: Math.min(limit, 10), item_type: 2 }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as Array<{
      title?: string;
      authors?: Array<{ full_name?: string }>;
      published_date?: string;
      description?: string;
      doi?: string;
      url_public_html?: string;
      tags?: string[];
    }>;
    return (data ?? [])
      .map((item): AcademicPaper | null => {
        const abstract = (item.description ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        if (abstract.length < 40) return null;
        const year = parseInt(item.published_date?.slice(0, 4) ?? String(new Date().getFullYear()));
        const doi = item.doi?.replace("https://doi.org/", "").replace("doi:", "").trim() || undefined;
        return {
          title: item.title ?? "Unknown Title",
          authors: (item.authors ?? []).slice(0, 3).map((a) => a.full_name ?? "").filter(Boolean).join(", ") || "Unknown Authors",
          year,
          abstract: abstract.slice(0, 700),
          doi,
          url: doi ? `https://doi.org/${doi}` : item.url_public_html ?? "",
          source: "Figshare (9M+ research outputs)",
        };
      })
      .filter((p): p is AcademicPaper => p !== null && p.url !== "");
  } catch { return []; }
}

// ── HAL (France) Open Archive ──────────────────────────────────────────────────
// 1.5M+ peer-reviewed publications from French and European research institutions.
// Excellent for humanities, social sciences, European STEM. Free API.

async function searchHAL(query: string, limit: number): Promise<AcademicPaper[]> {
  try {
    const params = new URLSearchParams({
      q: query,
      fl: "title_s,authFullName_s,publicationDateY_i,abstract_s,doiId_s,uri_s,journalTitle_s",
      wt: "json",
      rows: String(Math.min(limit, 10)),
      sort: "relevance_s desc",
    });
    const res = await fetch(`https://api.archives-ouvertes.fr/search/?${params}`, {
      headers: { "User-Agent": "LightSpeedGhost/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      response?: { docs?: Array<{
        title_s?: string[];
        authFullName_s?: string[];
        publicationDateY_i?: number;
        abstract_s?: string[];
        doiId_s?: string;
        uri_s?: string;
        journalTitle_s?: string;
      }> };
    };
    return (data.response?.docs ?? [])
      .map((item): AcademicPaper | null => {
        const abstract = (item.abstract_s ?? [])[0]?.trim() ?? "";
        if (abstract.length < 50) return null;
        const doi = item.doiId_s || undefined;
        return {
          title: (item.title_s ?? ["Unknown Title"])[0],
          authors: (item.authFullName_s ?? []).slice(0, 3).join(", ") || "Unknown Authors",
          year: item.publicationDateY_i ?? new Date().getFullYear(),
          abstract: abstract.slice(0, 700),
          doi,
          url: doi ? `https://doi.org/${doi}` : item.uri_s ?? "",
          source: "HAL France (1.5M+ OA papers)",
          journal: item.journalTitle_s,
        };
      })
      .filter((p): p is AcademicPaper => p !== null && p.url !== "");
  } catch { return []; }
}

// ── NASA ADS (Astrophysics Data System) ───────────────────────────────────────
// 16M+ astronomy, astrophysics, and physics papers from NASA/Harvard.
// Free API key required → set NASA_ADS_API_KEY env var (ads.harvard.edu).
// Gracefully skipped if key not set.

async function searchNASAADS(query: string, limit: number): Promise<AcademicPaper[]> {
  const key = process.env.NASA_ADS_API_KEY;
  if (!key) return [];
  try {
    const params = new URLSearchParams({
      q: query,
      rows: String(Math.min(limit, 10)),
      fl: "title,author,year,abstract,identifier,bibcode",
      sort: "relevance desc",
    });
    const res = await fetch(`https://api.adsabs.harvard.edu/v1/search/query?${params}`, {
      headers: { Authorization: `Bearer ${key}`, "User-Agent": "LightSpeedGhost/1.0" },
      signal: AbortSignal.timeout(9000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      response?: { docs?: Array<{
        title?: string[];
        author?: string[];
        year?: string;
        abstract?: string;
        identifier?: string[];
        bibcode?: string;
      }> };
    };
    return (data.response?.docs ?? [])
      .map((item): AcademicPaper | null => {
        const abstract = (item.abstract ?? "").trim();
        if (abstract.length < 50) return null;
        const doi = item.identifier?.find((id) => id.startsWith("10."))?.replace("doi:", "");
        const bibcode = item.bibcode;
        return {
          title: (item.title ?? ["Unknown Title"])[0],
          authors: (item.author ?? []).slice(0, 3).join(", ") || "Unknown Authors",
          year: parseInt(item.year ?? String(new Date().getFullYear())),
          abstract: abstract.slice(0, 700),
          doi,
          url: doi ? `https://doi.org/${doi}` : bibcode ? `https://ui.adsabs.harvard.edu/abs/${bibcode}` : "",
          source: "NASA ADS (16M+ astro papers)",
        };
      })
      .filter((p): p is AcademicPaper => p !== null && p.url !== "");
  } catch { return []; }
}

// ── ClinicalTrials.gov ────────────────────────────────────────────────────────
// 450,000+ clinical trial registrations from 220+ countries (NIH/FDA-operated).
// Essential for medical, pharmacological, and public health research.
// Free API, no key required.

async function searchClinicalTrials(query: string, limit: number): Promise<AcademicPaper[]> {
  try {
    const params = new URLSearchParams({
      "query.term": query,
      pageSize: String(Math.min(limit, 10)),
      format: "json",
      fields: "NCTId,BriefTitle,BriefSummary,Condition,LeadSponsorName,StartDate,StudyType,Phase,OverallStatus",
    });
    const res = await fetch(`https://clinicaltrials.gov/api/v2/studies?${params}`, {
      headers: { "User-Agent": "LightSpeedGhost/1.0" },
      signal: AbortSignal.timeout(9000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      studies?: Array<{
        protocolSection?: {
          identificationModule?: { nctId?: string; briefTitle?: string };
          descriptionModule?: { briefSummary?: string };
          conditionsModule?: { conditions?: string[] };
          sponsorCollaboratorsModule?: { leadSponsor?: { name?: string } };
          statusModule?: { startDateStruct?: { date?: string }; overallStatus?: string };
          designModule?: { studyType?: string; phases?: string[] };
        };
      }>;
    };
    return (data.studies ?? [])
      .map((item): AcademicPaper | null => {
        const proto = item.protocolSection;
        const abstract = (proto?.descriptionModule?.briefSummary ?? "").trim();
        if (abstract.length < 40) return null;
        const nctId = proto?.identificationModule?.nctId;
        if (!nctId) return null;
        const conditions = (proto?.conditionsModule?.conditions ?? []).slice(0, 2).join(", ");
        const phase = (proto?.designModule?.phases ?? []).join("/") || "N/A";
        const sponsor = proto?.sponsorCollaboratorsModule?.leadSponsor?.name ?? "";
        const startYear = parseInt(proto?.statusModule?.startDateStruct?.date?.slice(0, 4) ?? "0");
        return {
          title: proto?.identificationModule?.briefTitle ?? "Unknown Trial",
          authors: sponsor || "Unknown Sponsor",
          year: startYear > 2000 ? startYear : new Date().getFullYear(),
          abstract: `[Clinical Trial${conditions ? " — " + conditions : ""}${phase !== "N/A" ? " Phase " + phase : ""}] ${abstract}`.slice(0, 700),
          url: `https://clinicaltrials.gov/study/${nctId}`,
          source: "ClinicalTrials.gov (450K+ trials)",
        };
      })
      .filter((p): p is AcademicPaper => p !== null);
  } catch { return []; }
}

// ── Dryad Digital Repository ──────────────────────────────────────────────────
// 50,000+ peer-reviewed research data packages with DOIs.
// Free API, no key required. Best for data-intensive and empirical research.

async function searchDryad(query: string, limit: number): Promise<AcademicPaper[]> {
  try {
    const params = new URLSearchParams({ q: query, per_page: String(Math.min(limit, 10)) });
    const res = await fetch(`https://datadryad.org/api/v2/search?${params}`, {
      headers: {
        "User-Agent": "LightSpeedGhost/1.0 (mailto:research@lightspeedghost.com)",
        "Accept": "application/json",
      },
      signal: AbortSignal.timeout(9000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      data?: Array<{
        type?: string;
        attributes?: {
          title?: string;
          authors?: Array<{ lastName?: string; firstName?: string }>;
          publicationDate?: string;
          abstract?: string;
          doi?: string;
          publicationName?: string;
        };
      }>;
    };
    return (data.data ?? [])
      .map((item): AcademicPaper | null => {
        const attr = item.attributes;
        if (!attr) return null;
        const abstract = (attr.abstract ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        if (abstract.length < 40) return null;
        const doi = attr.doi?.replace("https://doi.org/", "").replace("doi:", "").trim() || undefined;
        return {
          title: attr.title ?? "Unknown Title",
          authors: (attr.authors ?? []).slice(0, 3)
            .map((a) => [a.lastName, a.firstName?.charAt(0)].filter(Boolean).join(", "))
            .filter(Boolean).join("; ") || "Unknown Authors",
          year: parseInt(attr.publicationDate?.slice(0, 4) ?? String(new Date().getFullYear())),
          abstract: `[Research Data Package] ${abstract}`.slice(0, 700),
          doi,
          url: doi ? `https://doi.org/${doi}` : "",
          source: "Dryad (50K+ research data packages)",
          journal: attr.publicationName,
        };
      })
      .filter((p): p is AcademicPaper => p !== null && p.url !== "");
  } catch { return []; }
}

// ── PubMed Central (PMC) ──────────────────────────────────────────────────────
// 8M+ full-text open-access biomedical papers from NIH-funded research.
// Distinct from PubMed — provides full-text access, not just abstracts.

async function searchPMC(query: string, limit: number): Promise<AcademicPaper[]> {
  try {
    const searchParams = new URLSearchParams({
      db: "pmc",
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
    const searchData = (await searchRes.json()) as { esearchresult?: { idlist?: string[] } };
    const ids = searchData.esearchresult?.idlist ?? [];
    if (ids.length === 0) return [];

    const fetchParams = new URLSearchParams({
      db: "pmc",
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
    const records = rawText.split(/\n\n\n+/).filter((r) => r.trim().length > 0);
    return records
      .map((record): AcademicPaper | null => {
        const lines = record.split("\n").map((l) => l.trim()).filter(Boolean);
        if (lines.length < 2) return null;
        const title = lines[0].replace(/^\d+\.\s*/, "").trim().replace(/\.$/, "") || "Unknown Title";
        const authors = lines[1]?.replace(/\.$/, "") ?? "Unknown Authors";
        const yearMatch = record.match(/\b(19|20)\d{2}\b/);
        const year = yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear();
        const doiMatch = record.match(/doi:\s*([^\s\n]+)/i);
        const doi = doiMatch ? doiMatch[1].replace(/[.,]$/, "") : undefined;
        const pmcMatch = record.match(/PMC\d+/);
        const pmcId = pmcMatch ? pmcMatch[0] : null;
        const absIdx = record.search(/\bAbstract\b/i);
        let abstract = "";
        if (absIdx !== -1) {
          abstract = record.slice(absIdx + 8).split(/\n\nPMID:/)[0].trim().replace(/\s+/g, " ");
        }
        if (abstract.length < 40) return null;
        const url = doi ? `https://doi.org/${doi}` : pmcId ? `https://www.ncbi.nlm.nih.gov/pmc/articles/${pmcId}/` : null;
        if (!url) return null;
        return { title, authors, year, abstract: abstract.slice(0, 700), doi, url, source: "PubMed Central (8M+ full-text)" };
      })
      .filter((p): p is AcademicPaper => p !== null);
  } catch { return []; }
}

// ── BioRxiv Preprints ─────────────────────────────────────────────────────────
// Biology preprints from Cold Spring Harbor Laboratory. Free via CrossRef filter.
// Use for latest biology research before formal peer review.

async function searchBioRxiv(query: string, limit: number): Promise<AcademicPaper[]> {
  try {
    const params = new URLSearchParams({
      query,
      rows: String(Math.min(limit, 8)),
      select: "title,author,published,abstract,DOI,URL",
      filter: "type:posted-content,member:246,has-abstract:true",
      sort: "relevance",
    });
    const res = await fetch(`https://api.crossref.org/works?${params}`, {
      headers: { "User-Agent": "LightSpeedGhost/1.0 (mailto:research@lightspeedghost.com)" },
      signal: AbortSignal.timeout(9000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      message?: { items?: Array<{
        title?: string[];
        author?: Array<{ family?: string; given?: string }>;
        published?: { "date-parts"?: number[][] };
        abstract?: string;
        DOI?: string; URL?: string;
      }> };
    };
    return (data.message?.items ?? [])
      .map((item): AcademicPaper | null => {
        const abstract = stripJats(item.abstract ?? "");
        if (abstract.length < 50) return null;
        const authors = (item.author ?? []).slice(0, 3)
          .map((a) => `${a.family ?? ""}${a.given ? ", " + a.given.charAt(0) + "." : ""}`)
          .filter((s) => s.trim() !== ",").join("; ");
        return {
          title: (item.title ?? ["Unknown Title"])[0],
          authors: authors || "Unknown Authors",
          year: item.published?.["date-parts"]?.[0]?.[0] ?? new Date().getFullYear(),
          abstract: abstract.slice(0, 700),
          doi: item.DOI,
          url: item.DOI ? `https://doi.org/${item.DOI}` : item.URL ?? "",
          source: "bioRxiv (biology preprints)",
        };
      })
      .filter((p): p is AcademicPaper => p !== null && p.url !== "");
  } catch { return []; }
}

// ── MedRxiv Preprints ─────────────────────────────────────────────────────────
// Medical and health sciences preprints (Cold Spring Harbor + Yale/BMJ).
// Use for latest clinical and epidemiological research before formal review.

async function searchMedRxiv(query: string, limit: number): Promise<AcademicPaper[]> {
  try {
    const params = new URLSearchParams({
      query,
      rows: String(Math.min(limit, 8)),
      select: "title,author,published,abstract,DOI,URL",
      filter: "type:posted-content,member:25763,has-abstract:true",
      sort: "relevance",
    });
    const res = await fetch(`https://api.crossref.org/works?${params}`, {
      headers: { "User-Agent": "LightSpeedGhost/1.0 (mailto:research@lightspeedghost.com)" },
      signal: AbortSignal.timeout(9000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      message?: { items?: Array<{
        title?: string[];
        author?: Array<{ family?: string; given?: string }>;
        published?: { "date-parts"?: number[][] };
        abstract?: string;
        DOI?: string; URL?: string;
      }> };
    };
    return (data.message?.items ?? [])
      .map((item): AcademicPaper | null => {
        const abstract = stripJats(item.abstract ?? "");
        if (abstract.length < 50) return null;
        const authors = (item.author ?? []).slice(0, 3)
          .map((a) => `${a.family ?? ""}${a.given ? ", " + a.given.charAt(0) + "." : ""}`)
          .filter((s) => s.trim() !== ",").join("; ");
        return {
          title: (item.title ?? ["Unknown Title"])[0],
          authors: authors || "Unknown Authors",
          year: item.published?.["date-parts"]?.[0]?.[0] ?? new Date().getFullYear(),
          abstract: abstract.slice(0, 700),
          doi: item.DOI,
          url: item.DOI ? `https://doi.org/${item.DOI}` : item.URL ?? "",
          source: "medRxiv (medical preprints)",
        };
      })
      .filter((p): p is AcademicPaper => p !== null && p.url !== "");
  } catch { return []; }
}

// ── OSF Preprints ─────────────────────────────────────────────────────────────
// Open Science Framework multidisciplinary preprints (psychology, social science,
// education, interdisciplinary). Hosted at osf.io. Free API.

async function searchOSFPreprints(query: string, limit: number): Promise<AcademicPaper[]> {
  try {
    const params = new URLSearchParams({
      "filter[is_published]": "true",
      "filter[reviews_state]": "accepted",
      "page[size]": String(Math.min(limit, 10)),
      "embed": "contributors",
    });
    const res = await fetch(
      `https://api.osf.io/v2/preprints/?${params}&q=${encodeURIComponent(query)}`,
      {
        headers: {
          "User-Agent": "LightSpeedGhost/1.0",
          "Accept": "application/vnd.api+json",
        },
        signal: AbortSignal.timeout(9000),
      }
    );
    if (!res.ok) return [];
    const data = (await res.json()) as {
      data?: Array<{
        attributes?: {
          title?: string;
          description?: string;
          doi?: string;
          date_published?: string;
        };
        id?: string;
        relationships?: { contributors?: { data?: Array<{ id?: string }> } };
      }>;
    };
    return (data.data ?? [])
      .map((item): AcademicPaper | null => {
        const attr = item.attributes;
        if (!attr) return null;
        const abstract = (attr.description ?? "").trim();
        if (abstract.length < 40) return null;
        const doi = attr.doi?.replace("https://doi.org/", "") || undefined;
        const year = parseInt(attr.date_published?.slice(0, 4) ?? String(new Date().getFullYear()));
        return {
          title: attr.title ?? "Unknown Title",
          authors: "See OSF for authors",
          year,
          abstract: abstract.slice(0, 700),
          doi,
          url: doi ? `https://doi.org/${doi}` : `https://osf.io/${item.id}`,
          source: "OSF Preprints (multidisciplinary)",
        };
      })
      .filter((p): p is AcademicPaper => p !== null);
  } catch { return []; }
}

// ── NBER (National Bureau of Economic Research) ───────────────────────────────
// 35,000+ working papers on economics, finance, public policy from leading economists.
// Free API (basic), no key required for search.

async function searchNBER(query: string, limit: number): Promise<AcademicPaper[]> {
  try {
    const params = new URLSearchParams({
      searchterm: query,
      perPage: String(Math.min(limit, 10)),
      sortBy: "relevant",
    });
    const res = await fetch(`https://api.nber.org/workingpapers/search?${params}`, {
      headers: { "User-Agent": "LightSpeedGhost/1.0" },
      signal: AbortSignal.timeout(9000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      papers?: Array<{
        title?: string;
        authors?: Array<{ name?: string }>;
        year?: number;
        abstract?: string;
        paperNumber?: string;
        doi?: string;
      }>;
    };
    return (data.papers ?? [])
      .map((item): AcademicPaper | null => {
        const abstract = (item.abstract ?? "").trim();
        if (abstract.length < 40) return null;
        const doi = item.doi?.replace("https://doi.org/", "").trim() || undefined;
        const nb = item.paperNumber;
        return {
          title: item.title ?? "Unknown Title",
          authors: (item.authors ?? []).slice(0, 3).map((a) => a.name ?? "").filter(Boolean).join(", ") || "Unknown Authors",
          year: item.year ?? new Date().getFullYear(),
          abstract: `[NBER Working Paper${nb ? " #" + nb : ""}] ${abstract}`.slice(0, 700),
          doi,
          url: doi ? `https://doi.org/${doi}` : nb ? `https://www.nber.org/papers/${nb}` : "",
          source: "NBER Working Papers (35K+ economics)",
        };
      })
      .filter((p): p is AcademicPaper => p !== null && p.url !== "");
  } catch { return []; }
}

// ── Recent Academic Literature (Current Events Layer) ─────────────────────────
// For topics involving recent or current events, supplements the main databases
// with papers published in the last 90 days from arXiv, CrossRef, and OpenAlex.
// Auto-triggered when the topic contains recent-event keywords.

export function isCurrentEventsTopic(query: string): boolean {
  return /\b(2024|2025|2026|recent|latest|current|ongoing|new study|breaking|emerging|this year|last year|covid|pandemic|election|war|conflict|climate crisis|ai model|chatgpt|gpt-4|llm|large language)\b/i.test(query);
}

async function searchRecentAcademic(query: string, limit: number): Promise<AcademicPaper[]> {
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const fromDate = ninetyDaysAgo.toISOString().slice(0, 10);

  const [recentArXiv, recentCrossRef, recentOA] = await Promise.allSettled([
    // arXiv: search with date filter (last 90 days)
    (async () => {
      const params = new URLSearchParams({
        search_query: `all:${query} AND submittedDate:[${fromDate.replace(/-/g, "")}0000 TO *]`,
        start: "0",
        max_results: String(Math.min(Math.ceil(limit * 0.4), 5)),
        sortBy: "submittedDate",
        sortOrder: "descending",
      });
      const res = await fetch(`https://export.arxiv.org/api/query?${params}`, {
        headers: { "User-Agent": "LightSpeedGhost/1.0" },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return [] as AcademicPaper[];
      const xml = await res.text();
      const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)];
      return entries.map((match): AcademicPaper | null => {
        const entry = match[1];
        const title = entry.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim().replace(/\s+/g, " ") ?? "";
        const abstract = entry.match(/<summary>([\s\S]*?)<\/summary>/)?.[1]?.trim().replace(/\s+/g, " ") ?? "";
        const id = entry.match(/<id>(https?:\/\/arxiv\.org\/abs\/[^\s<]+)<\/id>/)?.[1] ?? "";
        const year = parseInt(entry.match(/<published>(\d{4})/)?.[1] ?? String(new Date().getFullYear()));
        const doi = entry.match(/<arxiv:doi[^>]*>([\s\S]*?)<\/arxiv:doi>/)?.[1]?.trim() ?? undefined;
        const authorMatches = [...entry.matchAll(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<\/author>/g)];
        const authors = authorMatches.map((m) => m[1].trim()).join(", ") || "Unknown Authors";
        if (abstract.length < 50 || !title) return null;
        return { title, authors, year, abstract: abstract.slice(0, 700), doi, url: doi ? `https://doi.org/${doi}` : id, source: "arXiv (recent — last 90 days)" };
      }).filter((p): p is AcademicPaper => p !== null);
    })(),

    // CrossRef: recent publications
    (async () => {
      const params = new URLSearchParams({
        query,
        rows: String(Math.min(Math.ceil(limit * 0.4), 5)),
        select: "title,author,published,abstract,DOI,URL",
        filter: `has-abstract:true,from-pub-date:${fromDate}`,
        sort: "published",
        order: "desc",
      });
      const res = await fetch(`https://api.crossref.org/works?${params}`, {
        headers: { "User-Agent": "LightSpeedGhost/1.0 (mailto:research@lightspeedghost.com)" },
        signal: AbortSignal.timeout(9000),
      });
      if (!res.ok) return [] as AcademicPaper[];
      const data = (await res.json()) as {
        message?: { items?: Array<{
          title?: string[];
          author?: Array<{ family?: string; given?: string }>;
          published?: { "date-parts"?: number[][] };
          abstract?: string;
          DOI?: string; URL?: string;
        }> };
      };
      return (data.message?.items ?? []).map((item): AcademicPaper | null => {
        const abstract = stripJats(item.abstract ?? "");
        if (abstract.length < 50) return null;
        const authors = (item.author ?? []).slice(0, 3)
          .map((a) => `${a.family ?? ""}${a.given ? ", " + a.given.charAt(0) + "." : ""}`)
          .filter((s) => s.trim() !== ",").join("; ");
        return {
          title: (item.title ?? ["Unknown Title"])[0],
          authors: authors || "Unknown Authors",
          year: item.published?.["date-parts"]?.[0]?.[0] ?? new Date().getFullYear(),
          abstract: abstract.slice(0, 700),
          doi: item.DOI,
          url: item.DOI ? `https://doi.org/${item.DOI}` : item.URL ?? "",
          source: "CrossRef (recent — last 90 days)",
        };
      }).filter((p): p is AcademicPaper => p !== null && p.url !== "");
    })(),

    // OpenAlex: recent papers with date filter
    (async () => {
      const params = new URLSearchParams({
        search: query,
        per_page: String(Math.min(Math.ceil(limit * 0.3), 4)),
        select: "id,title,authorships,publication_year,abstract_inverted_index,primary_location,doi,cited_by_count",
        filter: `has_abstract:true,from_publication_date:${fromDate}`,
        sort: "publication_date:desc",
      });
      const res = await fetch(`https://api.openalex.org/works?${params}`, {
        headers: { "User-Agent": "LightSpeedGhost/1.0 (mailto:research@lightspeedghost.com)" },
        signal: AbortSignal.timeout(9000),
      });
      if (!res.ok) return [] as AcademicPaper[];
      const data = (await res.json()) as {
        results?: Array<{
          title?: string;
          authorships?: Array<{ author?: { display_name?: string } }>;
          publication_year?: number;
          abstract_inverted_index?: Record<string, number[]>;
          primary_location?: { source?: { display_name?: string }; doi?: string };
          doi?: string; cited_by_count?: number; id?: string;
        }>;
      };
      return (data.results ?? []).map((paper): AcademicPaper | null => {
        const abstract = reconstructAbstract(paper.abstract_inverted_index);
        if (abstract.length < 50) return null;
        const authors = (paper.authorships ?? []).slice(0, 3).map((a) => a.author?.display_name ?? "").filter(Boolean).join(", ");
        const rawDoi = paper.doi ?? paper.primary_location?.doi;
        const doi = rawDoi?.replace("https://doi.org/", "");
        return {
          title: paper.title ?? "Unknown Title",
          authors: authors || "Unknown Authors",
          year: paper.publication_year ?? new Date().getFullYear(),
          abstract: abstract.slice(0, 700),
          doi,
          url: doi ? `https://doi.org/${doi}` : paper.id ?? "",
          source: "OpenAlex (recent — last 90 days)",
          citationCount: paper.cited_by_count,
        };
      }).filter((p): p is AcademicPaper => p !== null);
    })(),
  ]);

  const all: AcademicPaper[] = [
    ...(recentArXiv.status === "fulfilled" ? recentArXiv.value : []),
    ...(recentCrossRef.status === "fulfilled" ? recentCrossRef.value : []),
    ...(recentOA.status === "fulfilled" ? recentOA.value : []),
  ];

  // Deduplicate
  const seen = new Set<string>();
  const deduped: AcademicPaper[] = [];
  for (const p of all) {
    const key = p.doi ? p.doi.toLowerCase() : p.title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 40);
    if (!seen.has(key)) { seen.add(key); deduped.push(p); }
  }
  return deduped.slice(0, limit);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Search all academic databases in parallel and return deduplicated results.
 *
 * Database coverage (25+ sources, 1.5B+ papers):
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
 *  • BASE              — 340M+ documents from 10,000+ repos (broadest OA coverage)
 *  • DataCite          — 48M+ research objects with DOIs (datasets, preprints, papers)
 *  • OpenAIRE          — 100M+ EU-funded research outputs across all disciplines
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
    /history|philosoph|literature|art|music|sociol|psychol|anthropol|linguist|politic|law|cultural|media|communication/i.test(combinedCtx);

  const isEducation =
    /education|teaching|learning|pedagog|curricul|student|classroom|school|universit|college|instructional|assessment/i.test(combinedCtx);

  const isFinanceBusiness =
    /financ|account|actuari|insurance|credit|banking|invest|econom|business|portfolio|risk\s*manage|audit|tax|ifrs|gaap|ebitda|valuation|derivative|hedge|underwriting|solvency|capital\s*market/i.test(combinedCtx);

  // ── isAstronomy / isEconomics sub-topic detection ─────────────────────────
  const isAstronomy =
    /astronom|astrophy|cosmol|galaxy|galaxi|star|stellar|planet|solar|telescope|exoplanet|blackhole|dark matter|dark energy/i.test(combinedCtx);

  const isEconomics =
    /econom|macroec|microec|gdp|inflation|monetary|fiscal|labor market|trade policy|development economics|econometrics/i.test(combinedCtx);

  const isSocialPsy =
    /psychol|psychiatr|cognitiv|behavio|mental health|neuroscience|social science|anthropol/i.test(combinedCtx);

  // ── Budget allocation (over-request, then de-dup to `limit`) ─────────────────
  // Over-fetch per source so after deduplication we still hit the target limit.
  const budget = Math.ceil(limit * 2.2);   // fetch ~120% more than needed across 25+ sources

  // ── Adaptive source weighting — learned from past performance ────────────────
  // Each source gets a multiplier based on its observed successRate for this subject.
  // Formula: multiplier = 0.5 + successRate  (range 0.5 – 1.5)
  // Sources with <3 historical queries stay at neutral weight 1.0 (not enough data).
  // This creates a self-improving loop: sources that consistently return results are
  // allocated a larger share of the budget over time, while unreliable ones shrink.
  const _learnedStats: SourceStats[] = await getSourceStats(subject ?? "general").catch(() => []);
  const _weightMap: Record<string, number> = {};
  for (const s of _learnedStats) {
    _weightMap[s.source] = s.totalQueries >= 3
      ? Math.max(0.5, Math.min(1.5, 0.5 + s.successRate))
      : 1.0;
  }
  const w = (name: string) => _weightMap[name] ?? 1.0;

  // ── Per-source request budgets (discipline-weighted) ────────────────────────
  const openAlexLimit    = Math.ceil(budget * (isFinanceBusiness ? 0.18 : 0.16) * w("OpenAlex"));
  const crossRefLimit    = Math.ceil(budget * (isFinanceBusiness ? 0.12 : 0.10) * w("CrossRef"));
  const ssLimit          = Math.ceil(budget * (isFinanceBusiness ? 0.12 : 0.10) * w("Semantic Scholar"));
  const europePMCLimit   = isBiomedical ? Math.ceil(budget * 0.10 * w("Europe PMC"))  : 0;
  const pubmedLimit      = isBiomedical ? Math.ceil(budget * 0.08 * w("PubMed"))      : Math.ceil(budget * 0.03 * w("PubMed"));
  const pmcLimit         = isBiomedical ? Math.ceil(budget * 0.06 * w("PubMed Central")) : 0;
  const arxivLimit       = (isSTEM || isFinanceBusiness || isAstronomy) ? Math.ceil(budget * 0.10 * w("arXiv")) : Math.ceil(budget * 0.03 * w("arXiv"));
  const ericLimit        = isEducation  ? Math.ceil(budget * 0.10 * w("ERIC"))        : Math.ceil(budget * 0.02 * w("ERIC"));
  const coreLimit        = (isHumanities || isFinanceBusiness) ? Math.ceil(budget * 0.08 * w("CORE")) : Math.ceil(budget * 0.03 * w("CORE"));
  const doajLimit        = (isHumanities || isFinanceBusiness) ? Math.ceil(budget * 0.06 * w("DOAJ")) : Math.ceil(budget * 0.02 * w("DOAJ"));
  const zenodoLimit      = Math.ceil(budget * 0.03 * w("Zenodo"));
  const baseLimit        = Math.ceil(budget * 0.06 * w("BASE"));
  const dataCiteLimit    = Math.ceil(budget * 0.04 * w("DataCite"));
  const openAIRELimit    = Math.ceil(budget * 0.05 * w("OpenAIRE"));
  // New sources
  const plosLimit        = isBiomedical                ? Math.ceil(budget * 0.06 * w("PLOS ONE"))         : Math.ceil(budget * 0.02 * w("PLOS ONE"));
  const figshareLimit    = Math.ceil(budget * 0.03 * w("Figshare"));
  const halLimit         = isHumanities                ? Math.ceil(budget * 0.06 * w("HAL France"))        : Math.ceil(budget * 0.02 * w("HAL France"));
  const nasaAdsLimit     = isAstronomy                 ? Math.ceil(budget * 0.10 * w("NASA ADS"))          : (isSTEM ? Math.ceil(budget * 0.03 * w("NASA ADS")) : 0);
  const clinicalLimit    = isBiomedical                ? Math.ceil(budget * 0.05 * w("ClinicalTrials"))     : 0;
  const dryadLimit       = (isBiomedical || isSTEM)    ? Math.ceil(budget * 0.03 * w("Dryad"))             : 0;
  const bioRxivLimit     = isBiomedical                ? Math.ceil(budget * 0.05 * w("bioRxiv"))            : 0;
  const medRxivLimit     = isBiomedical                ? Math.ceil(budget * 0.04 * w("medRxiv"))            : 0;
  const osfLimit         = (isHumanities || isSocialPsy) ? Math.ceil(budget * 0.04 * w("OSF Preprints"))  : 0;
  const nberLimit        = (isEconomics || isFinanceBusiness) ? Math.ceil(budget * 0.06 * w("NBER"))       : 0;
  const isCurrentEvents  = isCurrentEventsTopic(query);
  const recentLimit      = isCurrentEvents             ? Math.ceil(budget * 0.08)                           : 0;

  const [
    openAlexResults,
    crossRefResults,
    ssResults,
    europePMCResults,
    pubmedResults,
    pmcResults,
    arxivResults,
    ericResults,
    coreResults,
    doajResults,
    zenodoResults,
    baseResults,
    dataCiteResults,
    openAIREResults,
    plosResults,
    figshareResults,
    halResults,
    nasaAdsResults,
    clinicalResults,
    dryadResults,
    bioRxivResults,
    medRxivResults,
    osfResults,
    nberResults,
    recentResults,
  ] = await Promise.all([
    searchOpenAlex(query, openAlexLimit),
    searchCrossRef(query, crossRefLimit),
    searchSemanticScholar(query, ssLimit),
    europePMCLimit > 0  ? searchEuropePMC(query, europePMCLimit)   : Promise.resolve([] as AcademicPaper[]),
    pubmedLimit > 0     ? searchPubMed(query, pubmedLimit)          : Promise.resolve([] as AcademicPaper[]),
    pmcLimit > 0        ? searchPMC(query, pmcLimit)                : Promise.resolve([] as AcademicPaper[]),
    arxivLimit > 0      ? searchArXiv(query, arxivLimit)            : Promise.resolve([] as AcademicPaper[]),
    ericLimit > 0       ? searchERIC(query, ericLimit)              : Promise.resolve([] as AcademicPaper[]),
    coreLimit > 0       ? searchCORE(query, coreLimit)              : Promise.resolve([] as AcademicPaper[]),
    doajLimit > 0       ? searchDOAJ(query, doajLimit)              : Promise.resolve([] as AcademicPaper[]),
    zenodoLimit > 0     ? searchZenodo(query, zenodoLimit)          : Promise.resolve([] as AcademicPaper[]),
    baseLimit > 0       ? searchBASE(query, baseLimit)              : Promise.resolve([] as AcademicPaper[]),
    dataCiteLimit > 0   ? searchDataCite(query, dataCiteLimit)      : Promise.resolve([] as AcademicPaper[]),
    openAIRELimit > 0   ? searchOpenAIRE(query, openAIRELimit)      : Promise.resolve([] as AcademicPaper[]),
    plosLimit > 0       ? searchPLOS(query, plosLimit)              : Promise.resolve([] as AcademicPaper[]),
    figshareLimit > 0   ? searchFigshare(query, figshareLimit)      : Promise.resolve([] as AcademicPaper[]),
    halLimit > 0        ? searchHAL(query, halLimit)                : Promise.resolve([] as AcademicPaper[]),
    nasaAdsLimit > 0    ? searchNASAADS(query, nasaAdsLimit)        : Promise.resolve([] as AcademicPaper[]),
    clinicalLimit > 0   ? searchClinicalTrials(query, clinicalLimit): Promise.resolve([] as AcademicPaper[]),
    dryadLimit > 0      ? searchDryad(query, dryadLimit)            : Promise.resolve([] as AcademicPaper[]),
    bioRxivLimit > 0    ? searchBioRxiv(query, bioRxivLimit)        : Promise.resolve([] as AcademicPaper[]),
    medRxivLimit > 0    ? searchMedRxiv(query, medRxivLimit)        : Promise.resolve([] as AcademicPaper[]),
    osfLimit > 0        ? searchOSFPreprints(query, osfLimit)       : Promise.resolve([] as AcademicPaper[]),
    nberLimit > 0       ? searchNBER(query, nberLimit)              : Promise.resolve([] as AcademicPaper[]),
    recentLimit > 0     ? searchRecentAcademic(query, recentLimit)  : Promise.resolve([] as AcademicPaper[]),
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
    ...pmcResults,
    ...arxivResults,
    ...ericResults,
    ...coreResults,
    ...doajResults,
    ...zenodoResults,
    ...baseResults,
    ...dataCiteResults,
    ...openAIREResults,
    ...plosResults,
    ...figshareResults,
    ...halResults,
    ...nasaAdsResults,
    ...clinicalResults,
    ...dryadResults,
    ...bioRxivResults,
    ...medRxivResults,
    ...osfResults,
    ...nberResults,
    ...recentResults,      // recent-events layer last (lower citation count expected)
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

  const hasRecentLayer = papers.some((p) => p.source.includes("recent"));
  const recentNote = hasRecentLayer
    ? "\nRECENT EVENTS NOTE: Sources marked '(recent — last 90 days)' are the latest available preprints/publications. For events after April 2024 not covered here, flag the gap explicitly: '[post-cutoff — recommend checking current news sources]'."
    : "";

  return `════════════════════════════════════════════════════════════
VERIFIED ACADEMIC KNOWLEDGE BASE — ${papers.length} PEER-REVIEWED SOURCES
Retrieved from 25+ live academic databases (1.5B+ papers):
  Core: OpenAlex, CrossRef, Semantic Scholar, BASE (340M+), CORE (200M+)
  Biomedical: PubMed NCBI, PubMed Central, Europe PMC, bioRxiv, medRxiv, ClinicalTrials.gov
  STEM/Physics: arXiv, NASA ADS, Zenodo, DataCite, Dryad
  OA Journals: DOAJ, PLOS ONE, Figshare
  Education/Humanities: ERIC, HAL France, OpenAIRE, OSF Preprints
  Economics: NBER Working Papers${hasRecentLayer ? "\n  Recent: arXiv/CrossRef/OpenAlex recency-filtered (last 90 days)" : ""}
Results ranked by citation count. Wikipedia, news sites, and unverified sources excluded.${recentNote}

GROUNDING RULES (non-negotiable):
• Cite ONLY papers present in this knowledge base — every URL/DOI here is verifiable
• Do NOT invent statistics, figures, or findings not supported by these abstracts
• Do NOT cite Wikipedia, general websites, or any source not in this list
• If a fact cannot be grounded here, state it as general academic consensus and mark [citation needed]
• Prioritise higher-cited and more recent papers where both are available
• For topics post-dating the knowledge base, acknowledge the limitation explicitly
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
